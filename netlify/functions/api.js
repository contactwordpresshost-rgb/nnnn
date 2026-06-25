const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

function searchInFile(filePath, targetLower) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return resolve({ found: null, status: 'FILE_NOT_FOUND', totalLines: 0, sampleLines: [] });
        }

        const rl = readline.createInterface({
            input: fs.createReadStream(filePath, { encoding: 'utf8' }),
            crlfDelay: Infinity
        });

        let lineNum = 0;
        let found = null;
        let sampleLines = [];

        rl.on('line', (rawLine) => {
            lineNum++;
            if (lineNum <= 5) sampleLines.push(rawLine); // simpan 5 baris pertama

            if (found) return;
            const line = rawLine.trim();
            if (!line) return;

            const starIdx = line.indexOf('☆');

            if (starIdx === -1) {
                if (line.toLowerCase() === targetLower) {
                    found = { lineNum, hash: line, plain: null };
                    rl.close();
                }
            } else {
                const hashPart = line.substring(starIdx + 1).trim();
                if (hashPart.toLowerCase() === targetLower) {
                    const plain = line.substring(0, starIdx).trim();
                    found = { lineNum, hash: hashPart, plain };
                    rl.close();
                }
            }
        });

        rl.on('close', () => resolve({ found, status: 'OK', totalLines: lineNum, sampleLines }));
        rl.on('error', reject);
    });
}

exports.handler = async (event) => {
    const target = event.queryStringParameters?.text;

    if (!target) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing text parameter' })
        };
    }

    const targetLower = target.toLowerCase().trim();
    const targetLen = targetLower.length;

    // Scan semua file txt yang ada di direktori
    const allTxtFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.txt'));

    const entries = FILE_MAP[targetLen];
    if (!entries) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                found: false,
                error: 'Hash length not recognized',
                targetLen,
                allTxtFiles,
                dir: __dirname
            })
        };
    }

    const debugInfo = [];

    for (const entry of entries) {
        const filePath = path.join(__dirname, entry.file);
        try {
            const result = await searchInFile(filePath, targetLower);

            debugInfo.push({
                file: entry.file,
                status: result.status,
                totalLines: result.totalLines,
                sample: result.sampleLines
            });

            if (result.found) {
                const response = {
                    found: true,
                    type: entry.label,
                    line: result.found.lineNum,
                    hash: result.found.hash
                };
                if (result.found.plain !== null) response.plain = result.found.plain;
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(response)
                };
            }
        } catch (err) {
            debugInfo.push({ file: entry.file, status: 'ERROR', error: err.message });
        }
    }

    // Selalu tampilkan debug kalau tidak ketemu
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            found: false,
            target: targetLower,
            targetLen,
            dir: __dirname,
            allTxtFiles,
            checkedFiles: debugInfo
        })
    };
};
