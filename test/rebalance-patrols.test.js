const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const workingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'patrullbyggare-'));
const inputPath = path.join(workingDirectory, 'scouter.csv');
const scouts = Array.from({ length: 13 }, (_, index) => `Scout ${index + 1}`);
const rows = scouts.map((scout, index) => `${scout},${scouts[(index + 1) % scouts.length]}`);

fs.writeFileSync(inputPath, rows.join('\n'));

const result = spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'patrullbyggare.js'), inputPath, '5'],
    { cwd: workingDirectory, encoding: 'utf-8' }
);

assert.strictEqual(result.status, 0, result.stderr);

const patrolSizes = fs.readFileSync(path.join(workingDirectory, 'patruller_resultat.csv'), 'utf-8')
    .split('\n')
    .slice(1)
    .reduce((sizes, row) => {
        const patrol = row.split(',')[0];
        sizes.set(patrol, (sizes.get(patrol) || 0) + 1);
        return sizes;
    }, new Map());

assert.deepStrictEqual([...patrolSizes.values()].sort((a, b) => a - b), [4, 4, 5]);

fs.unlinkSync(inputPath);
fs.unlinkSync(path.join(workingDirectory, 'patruller_resultat.csv'));
fs.unlinkSync(path.join(workingDirectory, 'patruller_resultat.mmd'));
fs.unlinkSync(path.join(workingDirectory, 'patruller_resultat.svg'));
fs.rmdirSync(workingDirectory);
