const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'patrullbyggare-generator-'));
const output = path.join(directory, 'scouter.csv');
const script = path.join(__dirname, 'generera_testdata.js');

try {
    const result = spawnSync(process.execPath, [script, output, '30'], {
        encoding: 'utf-8',
        timeout: 5000,
    });

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);

    const names = fs.readFileSync(output, 'utf-8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map(row => row.split(',')[0]);

    assert.strictEqual(names.length, 30);
    assert.strictEqual(new Set(names).size, 30);
} finally {
    if (fs.existsSync(output)) fs.unlinkSync(output);
    fs.rmdirSync(directory);
}

console.log('Genererade scoutnamn är unika.');
