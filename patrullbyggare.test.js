const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, 'patrullbyggare.js');
const invalidTargetSizes = ['-1', '0', '1', '1.5', 'fem'];

invalidTargetSizes.forEach(targetSize => {
    const result = spawnSync(process.execPath, [script, 'saknas.csv', targetSize], {
        encoding: 'utf-8',
        timeout: 1000,
    });

    assert.strictEqual(result.status, 1, `Förväntade att ${targetSize} skulle avvisas`);
    assert.ok(/måste vara ett heltal på minst 2/.test(result.stderr));
});

console.log('Ogiltiga patrullstorlekar avvisas.');
