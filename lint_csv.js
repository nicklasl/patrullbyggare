const fs = require('fs');

function normalize(value) {
    return Array.from(value.normalize('NFC').toLocaleLowerCase('sv-SE'));
}

function spellingDistance(left, right) {
    const source = normalize(left);
    const target = normalize(right);
    const matrix = Array.from({ length: source.length + 1 }, () =>
        Array(target.length + 1).fill(0)
    );

    for (let row = 0; row <= source.length; row++) matrix[row][0] = row;
    for (let column = 0; column <= target.length; column++) matrix[0][column] = column;

    for (let row = 1; row <= source.length; row++) {
        for (let column = 1; column <= target.length; column++) {
            const substitutionCost = source[row - 1] === target[column - 1] ? 0 : 1;
            matrix[row][column] = Math.min(
                matrix[row - 1][column] + 1,
                matrix[row][column - 1] + 1,
                matrix[row - 1][column - 1] + substitutionCost
            );

            const transposed = row > 1 && column > 1
                && source[row - 1] === target[column - 2]
                && source[row - 2] === target[column - 1];

            if (transposed) {
                matrix[row][column] = Math.min(
                    matrix[row][column],
                    matrix[row - 2][column - 2] + 1
                );
            }
        }
    }

    return matrix[source.length][target.length];
}

function findSpellingSuggestion(value, knownNames) {
    if (knownNames.length === 0) return undefined;

    const closest = knownNames
        .map(name => ({ name, distance: spellingDistance(value, name) }))
        .sort((left, right) => left.distance - right.distance || left.name.localeCompare(right.name))[0];
    const maxDistance = Math.max(1, Math.floor(Math.max(value.length, closest.name.length) / 3));

    return closest.distance <= maxDistance ? closest.name : undefined;
}

function lintCsv(content) {
    const diagnostics = [];
    const rows = content.split(/\r?\n/)
        .map((line, index) => ({
            number: index + 1,
            cells: line.split(',').map(cell => cell.trim()),
            empty: line.trim() === '',
        }))
        .filter(row => !row.empty);
    const scoutRows = new Map();

    if (rows.length === 0) {
        return [{ row: 1, column: 1, message: 'CSV-filen innehåller inga scouter.' }];
    }

    rows.forEach(row => {
        const name = row.cells[0];
        if (!name) {
            diagnostics.push({
                row: row.number,
                column: 1,
                message: 'Scoutens namn saknas.',
            });
            return;
        }

        if (scoutRows.has(name)) {
            diagnostics.push({
                row: row.number,
                column: 1,
                message: `Scouten "${name}" finns redan på rad ${scoutRows.get(name)}.`,
            });
            return;
        }

        scoutRows.set(name, row.number);
    });

    const knownNames = Array.from(scoutRows.keys());

    rows.forEach(row => {
        const scout = row.cells[0];
        const seenPreferences = new Set();

        row.cells.slice(1).forEach((preference, index) => {
            if (!preference) return;

            const column = index + 2;
            if (preference === scout) {
                diagnostics.push({
                    row: row.number,
                    column,
                    message: `Scouten "${scout}" har angett sig själv som önskemål.`,
                });
            }

            if (seenPreferences.has(preference)) {
                diagnostics.push({
                    row: row.number,
                    column,
                    message: `Önskemålet "${preference}" förekommer flera gånger på raden.`,
                });
            }
            seenPreferences.add(preference);

            if (!scoutRows.has(preference)) {
                const suggestion = findSpellingSuggestion(preference, knownNames);
                const suggestionText = suggestion
                    ? ` Möjligt stavfel – menade du "${suggestion}"?`
                    : '';
                diagnostics.push({
                    row: row.number,
                    column,
                    message: `"${preference}" finns inte i scoutlistan.${suggestionText}`,
                });
            }
        });
    });

    return diagnostics;
}

function main() {
    const file = process.argv[2];
    if (!file) {
        console.error('Användning: node lint_csv.js <fil.csv>');
        process.exitCode = 2;
        return;
    }

    let content;
    try {
        content = fs.readFileSync(file, 'utf-8');
    } catch (error) {
        console.error(`Kunde inte läsa "${file}": ${error.message}`);
        process.exitCode = 2;
        return;
    }

    const diagnostics = lintCsv(content);
    if (diagnostics.length === 0) {
        console.log(`CSV-filen är giltig: ${file}`);
        return;
    }

    diagnostics.forEach(diagnostic => {
        console.error(`Rad ${diagnostic.row}, kolumn ${diagnostic.column}: ${diagnostic.message}`);
    });
    console.error(`\nHittade ${diagnostics.length} problem i ${file}.`);
    process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { findSpellingSuggestion, lintCsv, spellingDistance };
