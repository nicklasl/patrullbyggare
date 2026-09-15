const assert = require('assert');
const fs = require('fs');
const path = require('path');

const workflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'pages.yml'),
    'utf-8'
);

assert.match(workflow, /branches: \[main\]/);
assert.match(workflow, /actions\/upload-pages-artifact@v4/);
assert.match(workflow, /actions\/deploy-pages@v4/);
assert.match(workflow, /path: _site/);
assert.match(workflow, /pages: write/);
assert.match(workflow, /id-token: write/);
assert.doesNotMatch(workflow, /csv_base64|patruller_resultat/);

console.log('Pages-arbetsflödet publicerar endast den statiska webbappen.');
