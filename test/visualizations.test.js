const assert = require('assert');
const {
    createMermaidGraph,
    createSvgGraph,
} = require('../visualize');

const patrols = [
    ['Alice & Bob', 'Charlie'],
    ['Diana <Scout>', 'Eve'],
];
const scouts = new Map([
    ['Alice & Bob', ['Charlie']],
    ['Charlie', ['Diana <Scout>']],
    ['Diana <Scout>', ['Eve']],
    ['Eve', []],
]);

const mermaid = createMermaidGraph(patrols, scouts);
assert.match(mermaid, /^flowchart LR/);
assert.match(mermaid, /subgraph patrol_1\["Patrull 1"\]/);
assert.match(mermaid, /Alice &amp; Bob/);
assert.match(mermaid, /scout_0 -->\|önskar\| scout_1/);
assert.match(mermaid, /scout_1 -\.->\|önskar\| scout_2/);
assert.match(mermaid, /class scout_0 satisfied/);
assert.match(mermaid, /class scout_1 unsatisfied/);
assert.match(mermaid, /class scout_3 neutral/);

const svg = createSvgGraph(patrols, scouts);
assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(svg, /<title id="title">Patrullernas kamratönskemål<\/title>/);
assert.match(svg, /Alice &amp; Bob/);
assert.match(svg, /Diana &lt;Scout&gt;/);
assert.match(svg, /marker-end="url\(#fulfilled-arrow\)"/);
assert.match(svg, /stroke-dasharray="7 5" marker-end="url\(#unfulfilled-arrow\)"/);

console.log('Mermaid- och SVG-diagram beskriver patruller och kamratönskemål.');
