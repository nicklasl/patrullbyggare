const assert = require('assert');
const fs = require('fs');
const path = require('path');

const webRoot = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(webRoot, 'index.html'), 'utf-8');
const app = fs.readFileSync(path.join(webRoot, 'app.js'), 'utf-8');

assert.match(html, /role="tablist"/);
assert.match(html, /data-tab="upload"/);
assert.match(html, /data-tab="paste"/);
assert.match(html, /type="file" accept="\.csv,text\/csv"/);
assert.match(html, /<textarea[\s\S]+id="csv-text"/);
assert.match(html, /connect-src 'none'/);
assert.match(html, /Ingen scoutdata skickas eller sparas/);

assert.match(app, /addEventListener\('drop'/);
assert.match(app, /PatrullbyggareCsvLint/);
assert.match(app, /createResultCsv/);
assert.match(app, /createSvgGraph/);
assert.match(app, /createMermaidGraph/);
assert.doesNotMatch(app, /\bfetch\s*\(/);
assert.doesNotMatch(app, /XMLHttpRequest/);

console.log('Webbappen har två CSV-lägen, lokala exporter och inga nätverksanrop.');
