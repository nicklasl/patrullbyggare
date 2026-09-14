const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.join(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);

function findTests(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).reduce((tests, entry) => {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return tests;

        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return tests.concat(findTests(entryPath));
        if (entry.isFile() && entry.name.endsWith('.test.js')) tests.push(entryPath);
        return tests;
    }, []);
}

const tests = findTests(repositoryRoot).sort();

if (tests.length === 0) {
    console.error('Inga testfiler hittades.');
    process.exit(1);
}

tests.forEach(test => {
    console.log(`\nKör ${path.relative(repositoryRoot, test)}`);
    const result = spawnSync(process.execPath, [test], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
});

console.log(`\nAlla ${tests.length} testfiler godkändes.`);
