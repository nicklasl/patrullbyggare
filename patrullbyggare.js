const fs = require('fs');
const path = require('path');

// --- 1. Generera Test-CSV ---
function generateTestData(filePath) {
    const testData = [
        "Sven,Anna,Erik",
        "Anna,Sven,Erik",
        "Erik,Anna,Sven",
        "Karin,Olof,Maja",
        "Olof,Karin",
        "Maja,Karin,Olof",
        "Lukas,Ida",
        "Ida,Lukas",
        "Nils,Sara",
        "Sara,Nils",
        "Johan",              // Inga önskemål
        "Elin",               // Inga önskemål
        "Filip,Karin",
        "Sofia,Lukas",
        "Hugo,Sven"
    ];

    fs.writeFileSync(filePath, testData.join('\n'), 'utf-8');
    console.log(`Test-CSV skapad: ${filePath}\n`);
}

// --- 2. Läs och Parsa CSV ---
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    
    const scouter = new Map(); // namn -> Array av önskemål

    lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        const name = parts[0];
        const preferences = parts.slice(1).filter(p => p !== '');
        scouter.set(name, preferences);
    });

    return scouter;
}

// --- 3. Skapa Kluster av Önskemål ---
function createClusters(scouter) {
    const visited = new Set();
    const clusters = [];

    scouter.forEach((prefs, scout) => {
        if (!visited.has(scout)) {
            const cluster = new Set();
            const queue = [scout];

            while (queue.length > 0) {
                const current = queue.shift();
                if (!visited.has(current)) {
                    visited.add(current);
                    cluster.add(current);

                    // Lägg till alla hen önskar + alla som önskat hen
                    const outgoing = scouter.get(current) || [];
                    const incoming = [];
                    scouter.forEach((otherPrefs, otherScout) => {
                        if (otherPrefs.includes(current)) incoming.push(otherScout);
                    });

                    [...outgoing, ...incoming].forEach(friend => {
                        if (scouter.has(friend) && !visited.has(friend)) {
                            queue.push(friend);
                        }
                    });
                }
            }
            clusters.push(Array.from(cluster));
        }
    });

    return clusters;
}

// --- 4. Fördela Kluster till Patruller ---
function buildPatrols(scouter, maxPerPatrol) {
    const clusters = createClusters(scouter);
    
    // Sortera klustren från största till minsta
    clusters.sort((a, b) => b.length - a.length);

    const patrolList = [];

    clusters.forEach(cluster => {
        let placed = false;

        // Försök placera hela klustret i en befintlig patrull som har plats
        for (const patrol of patrolList) {
            if (patrol.length + cluster.length <= maxPerPatrol) {
                patrol.push(...cluster);
                placed = true;
                break;
            }
        }

        // Om klustret ryms i en egen patrull (eller om det är för stort)
        if (!placed) {
            if (cluster.length <= maxPerPatrol) {
                patrolList.push([...cluster]);
            } else {
                // Klustret är större än maxPerPatrol: Dela upp det så att par/vänner hålls ihop
                let remaining = [...cluster];
                while (remaining.length > 0) {
                    const chunk = remaining.splice(0, maxPerPatrol);
                    patrolList.push(chunk);
                }
            }
        }
    });

    return patrolList;
}

// --- 5. Utvärdering & CSV-Export ---
function exportAndReport(patrols, scouter, outputCsvPath) {
    const csvRows = ["Patrull,Scout,Har Önskad Kamrat i Patrull"];
    let satisfiedCount = 0;
    let totalWithPreferences = 0;

    console.log("=== RESULTERANDE PATRULLER ===\n");

    patrols.forEach((patrol, index) => {
        const patrolName = `Patrull ${index + 1}`;
        console.log(`${patrolName} (${patrol.length} scouter):`);

        patrol.forEach(scout => {
            const prefs = scouter.get(scout) || [];
            const hasFriendInPatrol = prefs.some(friend => patrol.includes(friend));

            if (prefs.length > 0) {
                totalWithPreferences++;
                if (hasFriendInPatrol) satisfiedCount++;
            }

            const status = prefs.length === 0 
                ? "Inga önskemål" 
                : (hasFriendInPatrol ? "JA" : "NEJ");

            console.log(`  - ${scout} (Önskade: ${prefs.join(', ') || 'Inga'}) -> Kamrat i patrull: ${status}`);
            csvRows.push(`"${patrolName}","${scout}","${status}"`);
        });
        console.log('');
    });

    fs.writeFileSync(outputCsvPath, csvRows.join('\n'), 'utf-8');

    console.log("=== STATISTIK ===");
    console.log(`Totalt antal scouter: ${scouter.size}`);
    console.log(`Scouter med önskemål: ${totalWithPreferences}`);
    console.log(`Scouter som fick minst en önskad kamrat: ${satisfiedCount} / ${totalWithPreferences} (${Math.round((satisfiedCount/totalWithPreferences)*100)}%)`);
    console.log(`\nResultat har sparats till: ${outputCsvPath}`);
}

// --- HUVUDPROGRAM ---
function main() {
    const args = process.argv.slice(2);
    const inputFile = args[0] || 'test_scouter.csv';
    const targetSize = parseInt(args[1], 10) || 5;
    const outputFile = 'patruller_resultat.csv';

    // Skapa testdata om filen inte finns
    if (!fs.existsSync(inputFile)) {
        generateTestData(inputFile);
    }

    console.log(`Läser in ${inputFile} med målstorlek ${targetSize} scouter per patrull...\n`);

    const scouter = parseCSV(inputFile);
    const patrols = buildPatrols(scouter, targetSize);
    exportAndReport(patrols, scouter, outputFile);
}

main();