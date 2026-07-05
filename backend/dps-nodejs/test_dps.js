const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jk = require('jkurwa');
const gost89 = require('gost89');

async function main() {
    const jksPath = path.join(__dirname, '../uapki/test_key.jks');
    const jksPassword = 'Mn290876';
    const edrpou = '2800003498';

    // Create Box with algorithms
    const algos = gost89.compat.algos();
    const box = new jk.Box({ algo: algos });

    // Load JKS
    const jksData = fs.readFileSync(jksPath);
    box.load({ keyBuffers: [jksData], password: jksPassword });

    console.log('Keys loaded:', box.keys.length);
    console.log('EDRPOU:', edrpou);

    // Sign EDRPOU (as per DPS API docs - direct Authorization header)
    const data = Buffer.from(edrpou, 'utf8');

    console.log('\n--- Test 1: CAdES-BES (attached, no TSP) ---');
    const signedMsg = await box.sign(data, undefined, undefined, {
        tax: false,
        detached: false,
        includeChain: false,
        tsp: false
    });
    const signedBytes = signedMsg.as_asn1();
    const sigB64 = signedBytes.toString('base64');

    console.log('Signature length:', sigB64.length);

    // Try DPS API with Authorization header
    try {
        console.log('\nSending GET /ws/public_api/ta/splatp with Authorization header...');
        const response = await axios.get('https://cabinet.tax.gov.ua/ws/public_api/ta/splatp', {
            params: { year: 2024 },
            headers: {
                'Authorization': sigB64,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        console.log('SUCCESS! Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.log('Status:', e.response?.status);
        console.log('Response:', JSON.stringify(e.response?.data));
    }

    console.log('\n--- Test 2: CAdES-BES with tax=true (UA_SIGN1 wrapper) ---');
    const signedMsg2 = await box.sign(data, undefined, undefined, {
        tax: true,
        detached: false,
        includeChain: false,
        tsp: false
    });
    const signedBytes2 = signedMsg2.as_asn1();
    const sigB64_2 = signedBytes2.toString('base64');

    console.log('Signature length (tax=true):', sigB64_2.length);

    try {
        console.log('Sending GET /ws/public_api/ta/splatp with UA_SIGN1 Authorization header...');
        const response2 = await axios.get('https://cabinet.tax.gov.ua/ws/public_api/ta/splatp', {
            params: { year: 2024 },
            headers: {
                'Authorization': sigB64_2,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        console.log('SUCCESS! Status:', response2.status);
        console.log('Response:', JSON.stringify(response2.data, null, 2));
    } catch (e) {
        console.log('Status:', e.response?.status);
        console.log('Response:', JSON.stringify(e.response?.data));
    }

    console.log('\n--- Test 3: CAdES-T with TSP (timestamps) ---');
    try {
        const signedMsg3 = await box.sign(data, undefined, undefined, {
            tax: false,
            detached: false,
            includeChain: false,
            tsp: 'content'
        });
        const signedBytes3 = signedMsg3.as_asn1();
        const sigB64_3 = signedBytes3.toString('base64');
        console.log('Signature length (CAdES-T):', sigB64_3.length);

        const response3 = await axios.get('https://cabinet.tax.gov.ua/ws/public_api/ta/splatp', {
            params: { year: 2024 },
            headers: {
                'Authorization': sigB64_3,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        console.log('SUCCESS! Status:', response3.status);
        console.log('Response:', JSON.stringify(response3.data, null, 2));
    } catch (e) {
        console.log('Status:', e.response?.status);
        console.log('Response:', JSON.stringify(e.response?.data));
    }
}

main().catch(console.error);
