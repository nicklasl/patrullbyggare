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
        const patrolName = patrol.name || `Patrull ${index + 1}`;
        console.log(`${patrolName} (${patrol.length} scouter):`);
        result.records
            .filter(record => record.patrol === patrolName)
            .forEach(record => {
                const memberNote = record.memberStatus && record.memberStatus !== 'Fri scout'
                    ? ` [${record.memberStatus}]`
                    : '';
                console.log(
                    `  - ${record.scout}${memberNote} `
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
    if (statistics.totalBaseMembers > 0) {
        console.log(
            `Behållna grundmedlemmar: ${statistics.retainedBaseMembers} / `
            + `${statistics.totalBaseMembers}`
        );
    }
    console.log(`\nResultat har sparats till: ${outputCsvPath}`);
}

function parseCliArgs(argv) {
    let inputFile = 'test_scouter.csv';
    let targetSizeArg;
    let basePatrolsMode = 'locked';
    let newPatrolsMode = 'target-size';

    const positional = [];

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--base-patrols=')) {
            basePatrolsMode = arg.split('=')[1];
        } else if (arg === '--base-patrols') {
            basePatrolsMode = argv[++i];
        } else if (arg.startsWith('--new-patrols=')) {
            newPatrolsMode = arg.split('=')[1];
        } else if (arg === '--new-patrols') {
            newPatrolsMode = argv[++i];
        } else {
            positional.push(arg);
        }
    }

    if (positional[0]) inputFile = positional[0];
    if (positional[1]) targetSizeArg = positional[1];

    return {
        inputFile,
        targetSizeArg,
        options: { basePatrolsMode, newPatrolsMode },
    };
}

function main() {
    const { inputFile, targetSizeArg, options } = parseCliArgs(process.argv.slice(2));
    let targetSize;

    try {
        targetSize = patrolCore.parseTargetSize(targetSizeArg);
    } catch (error) {
        console.error(`Fel: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    let csvContent;
    try {
        csvContent = fs.readFileSync(inputFile, 'utf-8');
    } catch (error) {
        console.error(`Fel vid läsning av fil "${inputFile}": ${error.message}`);
        process.exitCode = 1;
        return;
    }

    const scouts = patrolCore.parseCsv(csvContent);

    try {
        patrolCore.validateRosterSize(scouts.size, targetSize);
    } catch (error) {
        console.error(`Fel: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    let patrols;
    try {
        patrols = patrolCore.buildPatrols(scouts, targetSize, options);
    } catch (error) {
        console.error(`Fel: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    const outputFile = 'patruller_resultat.csv';
    const mermaidFile = 'patruller_resultat.mmd';
    const svgFile = 'patruller_resultat.svg';

    exportAndReport(patrols, scouts, outputFile, targetSize);
    exportVisualizations(patrols, scouts, mermaidFile, svgFile);
    console.log(`Visualiseringar har sparats till: ${mermaidFile} och ${svgFile}`);
}

if (require.main === module) main();

module.exports = patrolCore;
