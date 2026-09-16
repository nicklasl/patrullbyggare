const assert = require('assert');
const patrolCore = require('../patrol-core');
const csvLint = require('../lint_csv');
const { createMermaidGraph, createSvgGraph } = require('../visualize');

// 1. Parsing headers & base patrols
const csvWithHeader = `Grundpatrull,Scout,Önskemål 1,Önskemål 2
Räven,Anna,Bo,Clara
Räven,Bo,Anna
,Clara,Anna,David
,David,Clara
`;

const parsedWithHeader = patrolCore.parseCsv(csvWithHeader);
assert.strictEqual(parsedWithHeader.size, 4);
assert.strictEqual(parsedWithHeader.basePatrols.get('Anna'), 'Räven');
assert.strictEqual(parsedWithHeader.basePatrols.get('Bo'), 'Räven');
assert.strictEqual(parsedWithHeader.basePatrols.get('Clara'), undefined);

// Header with 'Patrull' instead of 'Grundpatrull'
const csvWithPatrullHeader = `Patrull,Scout,Önskemål 1
Räven,Anna,Bo
`;
const parsedWithPatrullHeader = patrolCore.parseCsv(csvWithPatrullHeader);
assert.strictEqual(parsedWithPatrullHeader.basePatrols.get('Anna'), 'Räven');

// Headerless CSV with empty first cell indicating Patrol column
const csvImplicitPatrol = `Räven,Anna,Bo,Clara
Räven,Bo,Anna
,Clara,Anna,David
,David,Clara
`;
const parsedImplicit = patrolCore.parseCsv(csvImplicitPatrol);
assert.strictEqual(parsedImplicit.size, 4);
assert.strictEqual(parsedImplicit.basePatrols.get('Anna'), 'Räven');
assert.strictEqual(parsedImplicit.basePatrols.get('Clara'), undefined);

// 2. Linting spelling variant warnings for base patrols
const lintTypoResult = csvLint.lintCsv(`Grundpatrull,Scout,Önskemål 1
Räven,Anna,Bo
Raven,Bo,Anna
,Bo,Anna
`);
assert.ok(lintTypoResult.some(d => d.message.includes('liknar "Räven"')));

// 3. Solving: Locked mode vs Flexible mode & Strategy combinations
const baseCsv = `Grundpatrull,Scout,Önskemål 1,Önskemål 2
Räven,Anna,Bo,Clara
Räven,Bo,Anna,Clara
Örn,Clara,David,Anna
Örn,David,Clara,Bo
,Erik,Anna,David
,Filip,Bo,Clara
,Gustav,Erik,Filip
,Hugo,Filip,Erik
,Ida,Hugo,Gustav
,Johan,Ida,Hugo
`;

const scouts = patrolCore.parseCsv(baseCsv);

// Combination 1: locked + target-size (defaults)
const result1 = patrolCore.buildPatrols(scouts, 5, {
    basePatrolsMode: 'locked',
    newPatrolsMode: 'target-size',
});
assert.strictEqual(result1.length, 2);
const ravenPatrol = result1.find(p => p.name === 'Räven');
assert.ok(ravenPatrol.includes('Anna'));
assert.ok(ravenPatrol.includes('Bo'));
const ornPatrol = result1.find(p => p.name === 'Örn');
assert.ok(ornPatrol.includes('Clara'));
assert.ok(ornPatrol.includes('David'));

// Combination 2: flexible + target-size
const result2 = patrolCore.buildPatrols(scouts, 5, {
    basePatrolsMode: 'flexible',
    newPatrolsMode: 'target-size',
});
assert.strictEqual(result2.length, 2);

// Combination 3: locked + fill-existing
const result3 = patrolCore.buildPatrols(scouts, 5, {
    basePatrolsMode: 'locked',
    newPatrolsMode: 'fill-existing',
});
assert.strictEqual(result3.length, 2);

// Combination 4: flexible + fill-existing
const result4 = patrolCore.buildPatrols(scouts, 5, {
    basePatrolsMode: 'flexible',
    newPatrolsMode: 'fill-existing',
});
assert.strictEqual(result4.length, 2);

// 4. Overfilled locked base patrol error validation
const overfilledCsv = `Grundpatrull,Scout
Räven,Anna
Räven,Bo
Räven,Clara
Räven,David
Räven,Erik
Räven,Filip
Räven,Gustav
`;
const overfilledScouts = patrolCore.parseCsv(overfilledCsv);
assert.throws(() => {
    patrolCore.buildPatrols(overfilledScouts, 5, { basePatrolsMode: 'locked' });
}, /Grundpatrullen "Räven" har 7 medlemmar/);

// 5. Too many base patrols validation error
const tooManyBasePatrolsCsv = `Grundpatrull,Scout
P1,Anna
P2,Bo
P3,Clara
P4,David
`;
const tooManyScouts = patrolCore.parseCsv(tooManyBasePatrolsCsv);
assert.throws(() => {
    patrolCore.buildPatrols(tooManyScouts, 5, { basePatrolsMode: 'locked' });
}, /För många grundpatruller \(4\) för 4 scouter/);

// 6. Name collision avoidance for generated patrol names
const collisionCsv = `Grundpatrull,Scout
Patrull 1,Anna
Patrull 1,Bo
Patrull 1,Clara
Patrull 1,David
`;
const extraScoutsContent = collisionCsv + `
,Erik
,Filip
,Gustav
,Hugo
,Ida
,Johan
`;
const collisionScouts = patrolCore.parseCsv(extraScoutsContent);
const collisionPatrols = patrolCore.buildPatrols(collisionScouts, 5);
const patrolNames = collisionPatrols.map(p => p.name);
const uniqueNames = new Set(patrolNames);
assert.strictEqual(uniqueNames.size, patrolNames.length, 'No duplicate patrol names');
assert.ok(patrolNames.includes('Patrull 1'));
assert.ok(patrolNames.includes('Patrull 2'));

// 7. Verification of outputs and visualization preserving base patrol names
const patrolRes = patrolCore.createPatrolResult(result1, scouts);
const resCsv = patrolCore.createResultCsv(patrolRes);
assert.match(resCsv, /^Patrull,Resulterande Patrull,Scout,Omplacerad,Har Önskad Kamrat i Patrull/);

const mmd = createMermaidGraph(result1, scouts);
assert.match(mmd, /subgraph patrol_1\["Räven"\]/);

const svg = createSvgGraph(result1, scouts);
assert.match(svg, />Räven<\/text>/);

console.log('Alla testfall för grundpatruller godkändes.');
