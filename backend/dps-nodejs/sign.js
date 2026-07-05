/**
 * CLI signer for DPS API authorization
 * Supports: JKS (PrivatBank), IIT binary (.dat), IIT ZIP (.dat ZIP archive)
 * Usage: node sign.js <key_path> <password>
 * Output: base64-encoded CAdES-BES signature of EDRPOU (to stdout)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const jk = require('jkurwa');
const gost89 = require('gost89');

/**
 * HTTP transport for CMP/OCSP queries to Ukrainian CA servers
 */
function httpQuery(method, url, headers, payload, cb) {
    let u;
    try { u = new URL(url); } catch (e) { return cb(null, 0); }
    const req = http.request({
        method,
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        headers: { 'Content-Type': 'application/octet-stream', ...headers },
        timeout: 8000,
    }, (res) => {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => cb(Buffer.concat(chunks), res.statusCode));
    });
    req.on('error', () => cb(null, 0));
    req.on('timeout', () => { req.destroy(); cb(null, 0); });
    if (payload) req.write(payload);
    req.end();
}

/**
 * Load CMP server URLs from bundled CAs.json (Ukrainian CA list)
 * Returns array of CMP endpoint URLs, tax CA first
 */
function getCmpUrls() {
    try {
        const cas = JSON.parse(fs.readFileSync(path.join(__dirname, 'CAs.json'), 'utf8'));
        const urls = [];
        for (const ca of cas) {
            if (ca.cmpAddress) {
                urls.push('http://' + ca.cmpAddress + '/services/cmp/');
            }
        }
        // Prioritize tax CA (most common for DPS keys)
        urls.sort((a, b) => (b.includes('tax.gov.ua') ? 1 : 0) - (a.includes('tax.gov.ua') ? 1 : 0));
        return urls;
    } catch (e) {
        return ['http://ca.tax.gov.ua/services/cmp/'];
    }
}

/**
 * Detect if buffer is a ZIP archive (starts with PK magic)
 */
function isZip(buf) {
    return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;
}

/**
 * Extract key and cert buffers from ZIP archive (IIT export format)
 * Returns { keyEntries: [{name,data}], certEntries: [{name,data}] }
 */
function extractFromZip(buf) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buf);
    const entries = zip.getEntries().filter(e => !e.isDirectory);

    const keyEntries = entries.filter(e => {
        const n = e.name.toLowerCase();
        return n.endsWith('.dat') || n.endsWith('.jks') || n.endsWith('.pfx') || n.endsWith('.p12');
    });

    const certEntries = entries.filter(e => {
        const n = e.name.toLowerCase();
        return n.endsWith('.cer') || n.endsWith('.crt') || n.endsWith('.pem');
    });

    // Log all files for debugging
    process.stderr.write('[ZIP] all entries: ' + entries.map(e => e.name).join(', ') + '\n');

    if (keyEntries.length === 0) {
        throw new Error('ZIP archive does not contain any key files (.dat, .jks, .pfx, .p12). Found: ' + entries.map(e => e.name).join(', '));
    }
    return {
        keyEntries: keyEntries.map(e => ({ name: e.name, data: e.getData() })),
        certEntries: certEntries.map(e => ({ name: e.name, data: e.getData() })),
    };
}

/**
 * Load key from buffer and manually attach DER/PEM certs via box.add + _indexKeys
 * (jkurwa's certBuffers uses from_pem which fails on binary DER .cer files)
 */
function tryLoadBuffer(box, keyBuf, password, certBufs, algos) {
    box.load({ keyBuffers: [keyBuf], password });

    if (certBufs && certBufs.length > 0) {
        process.stderr.write('[CERT] Loading ' + certBufs.length + ' cert buffers\n');
        for (let i = 0; i < certBufs.length; i++) {
            const certBuf = certBufs[i];
            try {
                let cert;
                const str = certBuf.toString('utf8', 0, 30);
                if (str.includes('-----BEGIN')) {
                    cert = jk.Certificate.from_pem(certBuf);
                    process.stderr.write('[CERT] Loaded PEM cert\n');
                } else {
                    cert = jk.Certificate.from_asn1(certBuf);
                    process.stderr.write('[CERT] Loaded DER cert\n');
                }
                box.add({ cert });
            } catch (e) {
                process.stderr.write('[CERT] Failed to load cert ' + i + ': ' + e.message + '\n');
            }
        }
        box._indexKeys();
        process.stderr.write('[CERT] certsById keys: ' + Object.keys(box.certsById || {}).length + '\n');
    }

    return box.keys && box.keys.length > 0;
}

/**
 * Find signing certificate — key.cert (if embedded) OR first cert from certsById
 * For IIT keys with separate .cer, keyid may not match, so we manually attach the cert
 */
function findCert(box) {
    for (const k of box.keys) {
        if (k.cert) return k.cert;
    }
    const certs = Object.values(box.certsById || {});
    if (certs.length > 0) {
        // For IIT: pick the end-entity cert (not CA)
        const endEntity = certs.find(c => {
            try { return !c.subject.equals(c.issuer); } catch { return true; }
        }) || certs[0];
        // Manually attach to first key if not already linked
        if (box.keys.length > 0 && !box.keys[0].cert) {
            box.keys[0].cert = endEntity;
        }
        return endEntity;
    }
    return null;
}

async function main() {
    const keyPath = process.argv[2];
    const keyPassword = process.argv[3];

    if (!keyPath || !keyPassword) {
        process.stderr.write('Usage: node sign.js <key_path> <password>\n');
        process.exit(1);
    }

    const algos = gost89.compat.algos();
    const rawData = fs.readFileSync(keyPath);

    // Debug: show file type
    process.stderr.write('[FILE] size: ' + rawData.length + ' bytes, isZIP: ' + isZip(rawData) + '\n');

    let box = new jk.Box({ algo: algos, query: httpQuery });
    let loaded = false;

    if (isZip(rawData)) {
        // IIT ZIP export — contains key-6.dat + possibly .cer certificate
        let extracted;
        try {
            extracted = extractFromZip(rawData);
        } catch (e) {
            process.stderr.write('Failed to extract ZIP: ' + e.message + '\n');
            process.exit(1);
        }

        const certBufs = extracted.certEntries.map(e => e.data);

        // debug: list ZIP contents
        const allNames = [...extracted.keyEntries, ...extracted.certEntries].map(e => e.name);
        process.stderr.write('[ZIP] key files: ' + extracted.keyEntries.map(e => e.name).join(', ') + '\n');
        process.stderr.write('[ZIP] cert files: ' + (extracted.certEntries.map(e => e.name).join(', ') || 'none') + '\n');

        for (const entry of extracted.keyEntries) {
            try {
                box = new jk.Box({ algo: algos, query: httpQuery });
                if (tryLoadBuffer(box, entry.data, keyPassword, certBufs, algos)) {
                    loaded = true;
                    break;
                }
            } catch (e) {
                process.stderr.write('[ZIP] failed to load ' + entry.name + ': ' + e.message + '\n');
            }
        }

        if (!loaded) {
            process.stderr.write('Could not load any key from ZIP archive. Check password.\n');
            process.exit(1);
        }
    } else {
        // Direct binary: JKS or IIT binary format
        process.stderr.write('[KEY] Loading as direct binary (not ZIP)\n');
        try {
            loaded = tryLoadBuffer(box, rawData, keyPassword, [], algos);
            process.stderr.write('[KEY] Load result: ' + loaded + ', keys: ' + (box.keys?.length || 0) + '\n');
        } catch (e) {
            process.stderr.write('[KEY] Failed to load: ' + e.message + '\n');
            process.exit(1);
        }

        if (!loaded) {
            process.stderr.write('[KEY] No keys found. This file may be a certificate (.cer) without private key, or password is incorrect.\n');
            process.exit(1);
        }
    }

    let cert = findCert(box);

    // If no cert found locally, fetch from Ukrainian CA CMP servers using key id
    if (!cert) {
        process.stderr.write('[CMP] No local cert — fetching from CA servers...\n');
        const cmpUrls = getCmpUrls();
        for (const url of cmpUrls) {
            try {
                const n = await box.loadCertsCmp(url);
                if (n > 0) {
                    process.stderr.write('[CMP] Got ' + n + ' cert(s) from ' + url + '\n');
                    break;
                }
            } catch (e) {
                // try next CA
            }
        }
        cert = findCert(box);
    }

    if (!cert) {
        process.stderr.write('Certificate not found. The key has no embedded certificate and it could not be fetched from any CA server. Please add the .cer certificate file.\n');
        process.exit(1);
    }

    const subject = cert.subject;
    const serialNumber = subject.serialNumber || '';
    const serialId = serialNumber.replace('TINUA-', '');

    // Determine the taxpayer identifier to sign.
    // DPS public_api expects: EDRPOU for legal entities, RNOKPP/DRFO for individuals.
    const ipn = (cert.extension && cert.extension.ipn) || {};
    const edrpou = (ipn.EDRPOU || '').toString().trim();
    const drfo = (ipn.DRFO || '').toString().trim();
    // EDRPOU has priority (legal entity), then DRFO (individual/FOP), then serial.
    const idToSign = (edrpou && !/^0+$/.test(edrpou)) ? edrpou
        : (drfo && !/^0+$/.test(drfo)) ? drfo
        : serialId;

    process.stderr.write('[SIGN] idToSign=' + idToSign + ' (EDRPOU=' + edrpou + ', DRFO=' + drfo + ', serial=' + serialId + ')\n');

    const data = Buffer.from(idToSign, 'utf8');
    const signedMsg = await box.sign(data, undefined, undefined, {
        tax: false,
        detached: false,
        includeChain: false,
        tsp: false,
    });

    process.stdout.write(signedMsg.as_asn1().toString('base64'));
}

main().catch((err) => {
    process.stderr.write(err.message + '\n');
    process.exit(1);
});
