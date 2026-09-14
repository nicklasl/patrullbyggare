const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'patrullbyggare.js');

function runWithRoster(scouts, targetSize) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'patrullbyggare-roster-'));
    const input = path.join(directory, 'scouter.csv');
    fs.writeFileSync(input, scouts.join('\n'));

    try {
        return spawnSync(process.execPath, [script, input, String(targetSize)], {
            cwd: directory,
            encoding: 'utf-8',
            timeout: 1000,
        });
    } finally {
        fs.unlinkSync(input);
        fs.readdirSync(directory).forEach(file => fs.unlinkSync(path.join(directory, file)));
        fs.rmdirSync(directory);
    }
}

const emptyRoster = runWithRoster([], 5);
assert.strictEqual(emptyRoster.status, 1);
assert.match(emptyRoster.stderr, /Lägg till 2 scouter/);
assert.match(emptyRoster.stderr, /Föreslagen patrullstorlek: 2/);
assert.strictEqual(emptyRoster.stdout, '');

const singleScout = runWithRoster(['Alice'], 5);
assert.strictEqual(singleScout.status, 1);
assert.match(singleScout.stderr, /Lägg till 1 scout/);
assert.match(singleScout.stderr, /Föreslagen patrullstorlek: 2/);
assert.doesNotMatch(singleScout.stderr, /TypeError/);

const smallRoster = runWithRoster(['Alice', 'Bob', 'Charlie'], 5);
assert.strictEqual(smallRoster.status, 1);
assert.match(smallRoster.stderr, /kräver minst 4/);
assert.match(smallRoster.stderr, /Föreslagen patrullstorlek: 3/);

const validRoster = runWithRoster(['Alice', 'Bob', 'Charlie', 'Diana'], 5);
assert.strictEqual(validRoster.status, 0, validRoster.stderr);

console.log('För små scoutgrupper avvisas med en användbar rekommendation.');
