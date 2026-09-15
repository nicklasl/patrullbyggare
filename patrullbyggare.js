const fs = require('fs');
const patrolCore = require('./patrol-core');
const { exportVisualizations } = require('./visualize');

function exportAndReport(patrols, scouts, outputCsvPath, targetSize) {
    const result = patrolCore.createPatrolResult(patrols, scouts);
    const { statistics } = result;
    const minSize = Math.max(2, targetSize - 1);
    const maxSize = targetSize + 1;

    console.log(
        `=== RESULTERANDE PATRULLER `
        + `(Mål: ${targetSize}, Tillåtet intervall: ${minSize}–${maxSize}) ===\n`
    );

    patrols.forEach((patrol, index) => {
        console.log(`Patrull ${index + 1} (${patrol.length} scouter):`);
        result.records
            .filter(record => record.patrol === `Patrull ${index + 1}`)
            .forEach(record => {
                console.log(
                    `  - ${record.scout} `
                    + `(Önskade: ${record.preferences.join(', ') || 'Inga'}) `
                    + `-> Kamrat i patrull: ${record.status}`
                );
            });
        console.log('');
    });

    fs.writeFileSync(outputCsvPath, patrolCore.createResultCsv(result), 'utf-8');

    console.log('=== STATISTIK ===');
    console.log(`Totalt antal scouter: ${statistics.scoutCount}`);
    console.log(`Scouter med önskemål: ${statistics.totalWithPreferences}`);
    console.log(
        `Scouter som fick minst en önskad kamrat: ${statistics.satisfiedCount} / `
        + `${statistics.totalWithPreferences} (${statistics.satisfiedPercentage}%)`
    );
    console.log(`\nResultat har sparats till: ${outputCsvPath}`);
}

function main() {
    const args = process.argv.slice(2);
    const inputFile = args[0] || 'test_scouter.csv';
    let targetSize;

    try {
        targetSize = patrolCore.parseTargetSize(args[1]);
    } catch (error) {
        console.error(`Fel: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    const scouts = patrolCore.parseCsv(fs.readFileSync(inputFile, 'utf-8'));

    try {
        patrolCore.validateRosterSize(scouts.size, targetSize);
    } catch (error) {
        console.error(`Fel: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    const patrols = patrolCore.buildPatrols(scouts, targetSize);
    const outputFile = 'patruller_resultat.csv';
    const mermaidFile = 'patruller_resultat.mmd';
    const svgFile = 'patruller_resultat.svg';

    exportAndReport(patrols, scouts, outputFile, targetSize);
    exportVisualizations(patrols, scouts, mermaidFile, svgFile);
    console.log(`Visualiseringar har sparats till: ${mermaidFile} och ${svgFile}`);
}

if (require.main === module) main();

module.exports = patrolCore;
