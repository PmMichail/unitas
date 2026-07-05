const fs = require('fs');
const axios = require('axios');
const jk = require('jkurwa');
const gost89 = require('gost89');

const DPS_BASE_URL = 'https://cabinet.tax.gov.ua';

/**
 * DPS API Client for Ukrainian Tax Service
 * Uses jkurwa (dstucrypt) for DSTU 4145-2002 digital signatures
 *
 * TESTED WORKING:
 *   - CAdES-BES (no TSP), attached, no chain
 *   - Authorization: <Base64 of CMS SignedData of EDRPOU>
 *   - GET /ws/public_api/ta/splatp?year=YYYY
 */
class DPSClient {
    constructor(jksPath, jksPassword) {
        this.jksPath = jksPath;
        this.jksPassword = jksPassword;
        this.box = null;
        this.edrpou = null;
    }

    async init() {
        const algos = gost89.compat.algos();
        this.box = new jk.Box({ algo: algos });

        const jksData = fs.readFileSync(this.jksPath);
        this.box.load({ keyBuffers: [jksData], password: this.jksPassword });

        if (!this.box.keys || this.box.keys.length === 0) {
            throw new Error('No keys found in JKS file');
        }

        const subject = this.box.keys[0].cert.subject;
        const serialNumber = subject.serialNumber || '';
        this.edrpou = serialNumber.replace('TINUA-', '');

        console.log(`[DPS] Loaded key for: ${subject.commonName} (EDRPOU: ${this.edrpou})`);
        return this;
    }

    async _signEdrpou() {
        const data = Buffer.from(this.edrpou, 'utf8');
        const signedMsg = await this.box.sign(data, undefined, undefined, {
            tax: false,
            detached: false,
            includeChain: false,
            tsp: false,
        });
        return signedMsg.as_asn1().toString('base64');
    }

    async _get(path, params = {}) {
        const authHeader = await this._signEdrpou();
        const response = await axios.get(`${DPS_BASE_URL}${path}`, {
            params,
            headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            timeout: 30000,
        });
        return response.data;
    }

    /** Отримати стан розрахунків (splatp) за рік */
    async getSplatp(year) {
        return this._get('/ws/public_api/ta/splatp', { year });
    }

    /** Надіслати звіт (підписаний XML в транспортному контейнері) */
    async sendReport(xmlData, fname) {
        const signedMsg = await this.box.sign(
            Buffer.isBuffer(xmlData) ? xmlData : Buffer.from(xmlData, 'utf8'),
            undefined, undefined,
            { tax: true, detached: false, includeChain: false, tsp: false }
        );
        const contentBase64 = signedMsg.as_asn1().toString('base64');

        const response = await axios.post(
            `${DPS_BASE_URL}/cabinet/public/api/exchange/report`,
            [{ fname, contentBase64 }],
            {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                timeout: 30000,
            }
        );
        return response.data;
    }
}

// CLI demo
async function main() {
    const jksPath = process.argv[2] || '../uapki/test_key.jks';
    const jksPassword = process.argv[3] || 'Mn290876';
    const year = parseInt(process.argv[4] || '2024');

    const client = await new DPSClient(jksPath, jksPassword).init();

    console.log(`\n[DPS] Fetching splatp for year ${year}...`);
    const data = await client.getSplatp(year);
    console.log(`[DPS] Got ${data.length} records`);
    console.log(JSON.stringify(data, null, 2));
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}

module.exports = DPSClient;
