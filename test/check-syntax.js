const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.join(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);

function findJavaScriptFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).reduce((files, entry) => {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return files;

        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return files.concat(findJavaScriptFiles(entryPath));
        if (entry.isFile() && entry.name.endsWith('.js')) files.push(entryPath);
        return files;
    }, []);
}

const files = findJavaScriptFiles(repositoryRoot);

files.forEach(file => {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf-8' });
    if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exit(result.status || 1);
    }
});

console.log(`Syntaxkontroll klar: ${files.length} filer.`);
