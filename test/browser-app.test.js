const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
assert.match(html, /Scouterna skriver varsin lapp/);
assert.match(html, /stryka under det/);
assert.match(html, /scoutens eget namn i kolumn A/);
assert.match(html, /Börja direkt på rad 1 utan rubrikrad/);
assert.match(html, /Google Kalkylark/);
assert.match(html, /Excel/);
assert.match(html, /CSV UTF-8/);
assert.match(html, /Steg 4/);
assert.match(html, /<dialog id="csv-format-dialog"/);
assert.doesNotMatch(html, /<section id="csv-format"/);
assert.match(html, /<details class="visualization" open>/);
assert.match(html, /JA<\/span> Minst ett kompisönskemål finns i samma patrull/);

assert.match(app, /addEventListener\('drop'/);
assert.match(app, /PatrullbyggareCsvLint/);
assert.match(app, /createResultCsv/);
assert.match(app, /createSvgGraph/);
assert.match(app, /createMermaidGraph/);
assert.doesNotMatch(app, /\bfetch\s*\(/);
assert.doesNotMatch(app, /XMLHttpRequest/);

function createElement(properties) {
    return Object.assign({
        attributes: {},
        listeners: {},
        addEventListener(name, listener) {
            this.listeners[name] = listener;
        },
        classList: { add() {}, remove() {} },
        getAttribute(name) {
            return this.attributes[name];
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        focus() {},
    }, properties);
}

const uploadTab = createElement({
    attributes: { 'aria-controls': 'upload-panel' },
    dataset: { tab: 'upload' },
});
const pasteTab = createElement({
    attributes: { 'aria-controls': 'paste-panel' },
    dataset: { tab: 'paste' },
});
const uploadPanel = createElement({ hidden: false });
const pastePanel = createElement({ hidden: true });
const csvFormatDialog = createElement({
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
});
const showCsvFormat = createElement({});
const closeCsvFormat = createElement({});
const element = createElement({});
const browser = {
    console,
    document: {
        querySelector: selector => ({
            '#upload-panel': uploadPanel,
            '#paste-panel': pastePanel,
            '#csv-format-dialog': csvFormatDialog,
            '#show-csv-format': showCsvFormat,
            '#close-csv-format': closeCsvFormat,
        })[selector] || element,
        querySelectorAll: selector => selector === '[role="tab"]'
            ? [uploadTab, pasteTab]
            : [],
    },
};
browser.window = browser;
vm.createContext(browser);

['patrol-core.js', 'lint_csv.js', 'visualize.js'].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(webRoot, '..', file), 'utf-8'), browser);
});
assert.doesNotThrow(() => vm.runInContext(app, browser));
pasteTab.listeners.click();
assert.strictEqual(pasteTab.attributes['aria-selected'], 'true');
assert.strictEqual(uploadPanel.hidden, true);
assert.strictEqual(pastePanel.hidden, false);
showCsvFormat.listeners.click();
assert.strictEqual(csvFormatDialog.open, true);
closeCsvFormat.listeners.click();
assert.strictEqual(csvFormatDialog.open, false);

console.log('Webbappen har två CSV-lägen, lokala exporter och inga nätverksanrop.');
