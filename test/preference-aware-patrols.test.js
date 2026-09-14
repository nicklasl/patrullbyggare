const assert = require('assert');
const { buildPatrols, scorePatrols } = require('../patrullbyggare');

const rows = [
    ['Sven', 'Anna', 'Erik'],
    ['Anna', 'Sven', 'Maja'],
    ['Erik', 'Karin', 'Sven'],
    ['Karin', 'Olof', 'Maja'],
    ['Olof', 'Maja', 'Karin'],
    ['Maja', 'Olof', 'Lukas'],
    ['Lukas', 'Ida', 'Nils'],
    ['Ida', 'Lukas', 'Sara'],
    ['Nils', 'Sara', 'Johan'],
    ['Sara', 'Johan', 'Elin'],
    ['Johan', 'Elin', 'Filip'],
    ['Elin', 'Johan', 'Sofia'],
    ['Filip', 'Sofia', 'Hugo'],
    ['Sofia', 'Filip', 'Viktor'],
    ['Hugo', 'Viktor', 'Alma'],
    ['Viktor', 'Alma', 'Gustav'],
    ['Alma', 'Gustav', 'Oscar'],
    ['Gustav', 'Oscar', 'Alice'],
    ['Oscar', 'Alice', 'Ebba'],
    ['Alice', 'Ebba', 'William'],
    ['Ebba', 'William', 'Leo'],
    ['William', 'Leo', 'Noah'],
    ['Leo', 'Noah', 'Lucas'],
    ['Noah', 'Lucas', 'Freja'],
    ['Lucas', 'Freja', 'Liam'],
    ['Freja', 'Liam', 'Astrid'],
    ['Liam', 'Astrid', 'Emil'],
    ['Astrid', 'Emil', 'Sven'],
    ['Emil', 'Sven', 'Anna'],
    ['Alcie', 'Alice', 'Anna'],
];
const scouts = new Map(rows.map(([name, ...preferences]) => [name, preferences]));
const patrols = buildPatrols(scouts, 6);
const assignedScouts = patrols.flat();
const score = scorePatrols(patrols, scouts);

assert.deepStrictEqual(patrols.map(patrol => patrol.length), [6, 6, 6, 6, 6]);
assert.strictEqual(new Set(assignedScouts).size, 30);
assert.deepStrictEqual([...assignedScouts].sort(), [...scouts.keys()].sort());
assert.ok(score.satisfiedScouts >= 26, `Förväntade minst 26 nöjda scouter, fick ${score.satisfiedScouts}`);

console.log(`${score.satisfiedScouts} av 30 scouter fick minst en önskad kamrat.`);
