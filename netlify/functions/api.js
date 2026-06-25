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

// Baca file txt line-by-line menggunakan stream (hemat memori)
function searchInFile(filePath, targetLower) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return resolve(null);
        }

        const rl = readline.createInterface({
            input: fs.createReadStream(filePath, { encoding: 'utf8' }),
            crlfDelay: Infinity // Handle \r\n (Windows line endings)
        });

        let lineNum = 0;
        let found = null;

        rl.on('line', (rawLine) => {
            if (found) return; // Sudah ketemu, skip sisa baris

            lineNum++;
            const line = rawLine.trim();
            if (!line) return;

            const starIdx = line.indexOf('☆');

            if (starIdx === -1) {
                // Format: hanya hash
                if (line.toLowerCase() === targetLower) {
                    found = { lineNum, hash: line, plain: null };
                    rl.close();
                }
            } else {
                // Format: plaintext☆hash
                const hashPart = line.substring(starIdx + 1).trim();
                if (hashPart.toLowerCase() === targetLower) {
                    const plain = line.substring(0, starIdx).trim();
                    found = { lineNum, hash: hashPart, plain };
                    rl.close();
                }
            }
        });

        rl.on('close', () => resolve(found));
        rl.on('error', (err) => reject(err));
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

    const entries = FILE_MAP[targetLen];
    if (!entries) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ found: false, error: 'Hash length not recognized', len: targetLen })
        };
    }

    for (const entry of entries) {
        const filePath = path.join(__dirname, entry.file);

        try {
            const result = await searchInFile(filePath, targetLower);

            if (result) {
                const response = {
                    found: true,
                    type: entry.label,
                    line: result.lineNum,
                    hash: result.hash
                };
                if (result.plain !== null) {
                    response.plain = result.plain;
                }
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(response)
                };
            }
        } catch (err) {
            console.error(`Error reading ${entry.file}:`, err.message);
            // Lanjut ke file berikutnya jika ada error
        }
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ found: false })
    };
};
