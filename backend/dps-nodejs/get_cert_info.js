const jk = require('jkurwa');
const gost89 = require('gost89');
const fs = require('fs');
const http = require('http');
const cryptoNode = require('crypto');
const path = require('path');

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

function getCmpUrls() {
    try {
        const cas = JSON.parse(fs.readFileSync(path.join(__dirname, 'CAs.json'), 'utf8'));
        const urls = [];
        for (const ca of cas) {
            if (ca.cmpAddress) {
                urls.push('http://' + ca.cmpAddress + '/services/cmp/');
            }
        }
        urls.sort((a, b) => (b.includes('tax.gov.ua') ? 1 : 0) - (a.includes('tax.gov.ua') ? 1 : 0));
        return urls;
    } catch (e) {
        return ['http://ca.tax.gov.ua/services/cmp/'];
    }
}

function findCert(box) {
    for (const k of box.keys) {
        if (k.cert) return k.cert;
    }
    const certs = Object.values(box.certsById || {});
    if (certs.length > 0) {
        const endEntity = certs.find(c => {
            try { return !c.subject.equals(c.issuer); } catch { return true; }
        }) || certs[0];
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
        console.error('Usage: node get_cert_info.js <key_path> <password>');
        process.exit(1);
    }

    const algos = gost89.compat.algos();
    const box = new jk.Box({ algo: algos, query: httpQuery });
    box.load({ keyBuffers: [fs.readFileSync(keyPath)], password: keyPassword });
    
    let cert = findCert(box);
    if (!cert) {
        const cmpUrls = getCmpUrls();
        for (const url of cmpUrls) {
            try {
                const n = await box.loadCertsCmp(url);
                if (n > 0) break;
            } catch (e) {}
        }
        cert = findCert(box);
    }
    
    if (!cert) {
        console.error('Certificate not found');
        process.exit(1);
    }
    
    const subject = cert.subject || {};
    const issuer = cert.issuer || {};
    
    const cert_owner_name = subject.commonName || subject.organizationName || 'КЕП Власник';
    const cert_issuer = issuer.organizationName || issuer.commonName || 'Невідомий АЦСК';
    const cert_serial = cert.serial || (subject.serialNumber || '').replace('TINUA-', '') || 'unknown';
    
    const valid_from_ms = cert.valid && cert.valid.from;
    const valid_to_ms = cert.valid && cert.valid.to;
    
    const valid_from = valid_from_ms ? new Date(valid_from_ms).toISOString() : new Date().toISOString();
    const valid_to = valid_to_ms ? new Date(valid_to_ms).toISOString() : new Date(Date.now() + 365*24*60*60*1000).toISOString();
    
    const cert_pem = typeof cert.to_pem === 'function' ? cert.to_pem() : (typeof cert.as_pem === 'function' ? cert.as_pem() : '');

    let cert_thumbprint = '';
    if (cert_pem) {
        const base64Data = cert_pem.replace(/-----\w+ CERTIFICATE-----/g, '').replace(/\s+/g, '');
        const derBuffer = Buffer.from(base64Data, 'base64');
        const shasum = cryptoNode.createHash('sha1');
        shasum.update(derBuffer);
        cert_thumbprint = shasum.digest('hex').toLowerCase();
    }

    const result = {
        cert_owner_name,
        cert_issuer,
        cert_serial,
        valid_from,
        valid_to,
        cert_thumbprint,
        cert_pem
    };
    
    console.log(JSON.stringify(result));
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
