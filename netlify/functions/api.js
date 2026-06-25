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

    const dataDir = path.resolve(__dirname, '..', '..', 'public');
    const debugInfo = [];
    const matches = [];

    for (const entry of entries) {
        const filePath = path.join(dataDir, entry.file);
        
        const fileExists = fs.existsSync(filePath);
        debugInfo.push({ file: entry.file, exists: fileExists });

        if (!fileExists) continue;

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            debugInfo[debugInfo.length - 1].lines = lines.length;
            
            if (lines.length > 0) {
                const sample = lines[0].substring(0, 80);
                debugInfo[debugInfo.length - 1].sample = sample;
                debugInfo[debugInfo.length - 1].hasStar = lines[0].indexOf('☆') !== -1;
            }

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineTrimmed = line.trim();
                const starIdx = lineTrimmed.indexOf('☆');

                if (starIdx === -1) {
                    if (lineTrimmed.toLowerCase() === targetLower) {
                        matches.push({ file: entry.file, type: entry.label, line: i + 1, hash: lineTrimmed, format: 'hash-only' });
                    }
                } else {
                    const hashPart = lineTrimmed.substring(starIdx + 1).trim();
                    const plain = lineTrimmed.substring(0, starIdx).trim();
                    if (hashPart.toLowerCase() === targetLower) {
                        matches.push({ file: entry.file, type: entry.label, line: i + 1, plain: plain, hash: hashPart, format: 'plain-hash' });
                    }
                }
            }
        } catch(e) {
            debugInfo[debugInfo.length - 1].error = e.message;
        }
    }

    if (matches.length > 0) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ found: true, results: matches })
        };
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ found: false, debug: { target: targetLower, targetLen: targetLen, dataDir: dataDir, files: debugInfo } })
    };
};