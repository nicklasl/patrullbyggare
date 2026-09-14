const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.join(__dirname, '..');
const builderScript = path.join(repositoryRoot, 'patrullbyggare.js');
const generatorScript = path.join(repositoryRoot, 'generera_testdata.js');

function removeDirectory(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) removeDirectory(entryPath);
        else fs.unlinkSync(entryPath);
    });
    fs.rmdirSync(directory);
}

function withTemporaryDirectory(callback) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'patrullbyggare-test-'));
    try {
        callback(directory);
    } finally {
        removeDirectory(directory);
    }
}

function run(script, args, cwd) {
    const result = spawnSync(process.execPath, [script].concat(args || []), {
        cwd,
        encoding: 'utf-8',
        timeout: 5000,
    });
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
    return result;
}

function readLines(file) {
    return fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter(line => line !== '');
}

function readPatrolResult(file) {
    const lines = readLines(file);
    assert.strictEqual(lines[0], 'Patrull,Scout,Har Önskad Kamrat i Patrull');

    return lines.slice(1).map(line => {
        const match = line.match(/^"([^"]*)","([^"]*)","([^"]*)"$/);
        assert.ok(match, `Ogiltig resultatrad: ${line}`);
        return { patrol: match[1], scout: match[2], status: match[3] };
    });
}

function assertUniqueScouts(records, expectedScouts) {
    const actualScouts = records.map(record => record.scout);
    assert.strictEqual(new Set(actualScouts).size, actualScouts.length);
    assert.deepStrictEqual(actualScouts.slice().sort(), expectedScouts.slice().sort());
}

function patrolSizes(records) {
    return records.reduce((sizes, record) => {
        sizes.set(record.patrol, (sizes.get(record.patrol) || 0) + 1);
        return sizes;
    }, new Map());
}

function test(name, callback) {
    callback();
    console.log(`✓ ${name}`);
}

test('generatorn skapar önskat antal giltiga scouter', () => {
    withTemporaryDirectory(directory => {
        const output = path.join(directory, 'scouter.csv');
        run(generatorScript, [output, '10'], directory);

        const rows = readLines(output).map(line => line.split(','));
        const names = rows.map(parts => parts[0]);
        assert.strictEqual(rows.length, 10);
        assert.strictEqual(new Set(names).size, 10);

        rows.forEach(parts => {
            const scout = parts[0];
            const preferences = parts.slice(1).filter(Boolean);
            assert.strictEqual(new Set(preferences).size, preferences.length);
            preferences.forEach(friend => {
                assert.notStrictEqual(friend, scout);
                assert.ok(names.includes(friend));
            });
        });
    });
});

test('generatorn använder dokumenterade standardvärden', () => {
    withTemporaryDirectory(directory => {
        run(generatorScript, [], directory);
        const rows = readLines(path.join(directory, 'test_scouter.csv'));
        assert.strictEqual(rows.length, 28);
    });
});

test('byggaren hanterar CRLF, blankrader och mellanslag', () => {
    withTemporaryDirectory(directory => {
        const input = path.join(directory, 'scouter.csv');
        fs.writeFileSync(input, 'Sven, Anna\r\nAnna,Sven\r\n\r\nKarin\r\nOlof\r\n');

        run(builderScript, [input, '5'], directory);
        const records = readPatrolResult(path.join(directory, 'patruller_resultat.csv'));
        assertUniqueScouts(records, ['Sven', 'Anna', 'Karin', 'Olof']);
        assert.strictEqual(records.find(record => record.scout === 'Sven').status, 'JA');
        assert.strictEqual(records.find(record => record.scout === 'Anna').status, 'JA');
        assert.strictEqual(records.find(record => record.scout === 'Karin').status, 'Inga önskemål');
        assert.match(
            fs.readFileSync(path.join(directory, 'patruller_resultat.mmd'), 'utf-8'),
            /^flowchart LR/
        );
        assert.match(
            fs.readFileSync(path.join(directory, 'patruller_resultat.svg'), 'utf-8'),
            /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/
        );
    });
});

test('byggaren bevarar fristående scouter inom storleksintervallet', () => {
    withTemporaryDirectory(directory => {
        const scouts = Array.from({ length: 10 }, (_, index) => `Scout ${index + 1}`);
        const input = path.join(directory, 'scouter.csv');
        fs.writeFileSync(input, scouts.join('\n'));

        run(builderScript, [input, '5'], directory);
        const records = readPatrolResult(path.join(directory, 'patruller_resultat.csv'));
        assertUniqueScouts(records, scouts);
        assert.deepStrictEqual(Array.from(patrolSizes(records).values()).sort(), [5, 5]);
    });
});

test('byggaren bevarar scouter när ett stort kluster delas', () => {
    withTemporaryDirectory(directory => {
        const scouts = Array.from({ length: 12 }, (_, index) => `Scout ${index + 1}`);
        const rows = scouts.map((scout, index) => `${scout},${scouts[(index + 1) % scouts.length]}`);
        const input = path.join(directory, 'scouter.csv');
        fs.writeFileSync(input, rows.join('\n'));

        run(builderScript, [input, '5'], directory);
        const records = readPatrolResult(path.join(directory, 'patruller_resultat.csv'));
        assertUniqueScouts(records, scouts);
        assert.deepStrictEqual(Array.from(patrolSizes(records).values()).sort(), [6, 6]);
    });
});

test('byggaren använder standardfil och standardstorlek', () => {
    withTemporaryDirectory(directory => {
        const scouts = ['Sven', 'Anna', 'Karin', 'Olof'];
        fs.writeFileSync(path.join(directory, 'test_scouter.csv'), scouts.join('\n'));

        const result = run(builderScript, [], directory);
        const records = readPatrolResult(path.join(directory, 'patruller_resultat.csv'));
        assertUniqueScouts(records, scouts);
        assert.ok(result.stdout.includes('Mål: 5'));
    });
});
