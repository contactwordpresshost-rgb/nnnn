const fs = require('fs');
const path = require('path');

const FILE_MAP = {
    32: [
        { file: 'reyhanMD5.txt', label: 'MD5' },
        { file: 'reyhanNTLM.txt', label: 'NTLM' },
        { file: 'reyhanLM.txt', label: 'LM' }
    ],
    40: [{ file: 'reyhanSHA1.txt', label: 'SHA1' }],
    64: [{ file: 'reyhanSHA256.txt', label: 'SHA256' }],
    128: [{ file: 'reyhanSHA512.txt', label: 'SHA512' }]
};

exports.handler = async (event) => {
    const target = event.queryStringParameters?.text;

    if (!target) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ found: false, error: 'Missing text parameter' })
        };
    }

    const targetLower = target.toLowerCase().trim();
    const targetLen = targetLower.length;

    const entries = FILE_MAP[targetLen];
    if (!entries) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ found: false, error: 'Unknown hash length' })
        };
    }

    const dataDir = __dirname;

    for (const entry of entries) {
        const filePath = path.join(dataDir, entry.file);

        try {
            if (!fs.existsSync(filePath)) continue;

            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const starIdx = line.indexOf('☆');

                if (starIdx === -1) {
                    if (line.trim().toLowerCase() === targetLower) {
                        return {
                            statusCode: 200,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                found: true,
                                file: entry.file,
                                type: entry.label,
                                line: i + 1,
                                hash: line.trim()
                            })
                        };
                    }
                    continue;
                }

                const hashPart = line.substring(starIdx + 1).trim();
                if (hashPart.toLowerCase() === targetLower) {
                    const plain = line.substring(0, starIdx).trim();
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            found: true,
                            file: entry.file,
                                type: entry.label,
                            line: i + 1,
                            plain: plain,
                            hash: hashPart
                        })
                    };
                }
            }
        } catch(e) {
            continue;
        }
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ found: false })
    };
};