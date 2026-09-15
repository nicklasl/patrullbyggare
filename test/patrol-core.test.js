const assert = require('assert');
const {
    buildPatrols,
    createPatrolResult,
    createResultCsv,
    parseCsv,
    parseTargetSize,
    validateRosterSize,
} = require('../patrol-core');

const content = 'Alice,Bob\r\nBob,Alice\r\nCharlie,Diana\r\nDiana,Charlie\r\n';
const scouts = parseCsv(content);

assert.deepStrictEqual(Array.from(scouts.entries()), [
    ['Alice', ['Bob']],
    ['Bob', ['Alice']],
    ['Charlie', ['Diana']],
    ['Diana', ['Charlie']],
]);
assert.strictEqual(parseTargetSize(undefined), 5);
assert.strictEqual(parseTargetSize('4'), 4);
validateRosterSize(scouts.size, 4);

const patrols = buildPatrols(scouts, 4);
const result = createPatrolResult(patrols, scouts);
const csv = createResultCsv(result);

assert.strictEqual(result.statistics.scoutCount, 4);
assert.strictEqual(result.statistics.satisfiedCount, 4);
assert.strictEqual(result.statistics.satisfiedPercentage, 100);
assert.match(csv, /^Patrull,Scout,Har Önskad Kamrat i Patrull\n/);
assert.match(csv, /"Alice"/);
assert.ok(!csv.endsWith('\n'));

const quotedResult = createPatrolResult([['Alice "Scout"', 'Bob']], new Map([
    ['Alice "Scout"', ['Bob']],
    ['Bob', ['Alice "Scout"']],
]));
assert.match(createResultCsv(quotedResult), /"Alice ""Scout"""/);

console.log('Den delade kärnan läser CSV och skapar nedladdningsbart resultat.');
