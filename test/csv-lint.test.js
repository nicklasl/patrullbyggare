const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { findSpellingSuggestion, lintCsv, spellingDistance } = require('../lint_csv');

const script = path.join(__dirname, '..', 'lint_csv.js');

assert.strictEqual(spellingDistance('Alcie', 'Alice'), 1);
assert.strictEqual(spellingDistance('ANNA', 'Anna'), 0);
assert.strictEqual(findSpellingSuggestion('Alcie', ['Alice', 'Bob']), 'Alice');
assert.strictEqual(findSpellingSuggestion('Zorg', ['Alice', 'Bob']), undefined);

assert.deepStrictEqual(lintCsv('Alice,Bob\nBob,Alice'), []);
assert.deepStrictEqual(lintCsv('  \n'), [
    { row: 1, column: 1, message: 'CSV-filen innehåller inga scouter.' },
]);

const typoDiagnostics = lintCsv('Alice,Bob\nBob,Alcie');
assert.strictEqual(typoDiagnostics.length, 1);
assert.deepStrictEqual(typoDiagnostics[0], {
    row: 2,
    column: 2,
    message: '"Alcie" finns inte i scoutlistan. Möjligt stavfel – menade du "Alice"?',
});

const rowDiagnostics = lintCsv('Alice\n\nBob,Alic');
assert.strictEqual(rowDiagnostics[0].row, 3);
assert.strictEqual(rowDiagnostics[0].column, 2);

const structuralDiagnostics = lintCsv('Alice,Alice,Bob,Bob\nAlice\nBob');
assert.ok(structuralDiagnostics.some(diagnostic => /angett sig själv/.test(diagnostic.message)));
assert.ok(structuralDiagnostics.some(diagnostic => /förekommer flera gånger/.test(diagnostic.message)));
assert.ok(structuralDiagnostics.some(diagnostic => /finns redan på rad 1/.test(diagnostic.message)));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'patrullbyggare-csv-lint-'));
const input = path.join(directory, 'scouter.csv');

try {
    fs.writeFileSync(input, 'Alice,Bob\nBob,Alcie');
    const invalidResult = spawnSync(process.execPath, [script, input], {
        encoding: 'utf-8',
        timeout: 1000,
    });
    assert.strictEqual(invalidResult.status, 1);
    assert.match(invalidResult.stderr, /Rad 2, kolumn 2/);
    assert.match(invalidResult.stderr, /menade du "Alice"/);

    fs.writeFileSync(input, 'Alice,Bob\nBob,Alice');
    const validResult = spawnSync(process.execPath, [script, input], {
        encoding: 'utf-8',
        timeout: 1000,
    });
    assert.strictEqual(validResult.status, 0, validResult.stderr);
    assert.match(validResult.stdout, /CSV-filen är giltig/);
} finally {
    fs.unlinkSync(input);
    fs.rmdirSync(directory);
}

console.log('CSV-lintning hittar strukturfel och föreslår rättstavade scoutnamn.');
