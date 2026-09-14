const fs = require('fs');

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    const scouter = new Map();

    lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        const name = parts[0];
        const preferences = parts.slice(1).filter(p => p !== '');
        scouter.set(name, preferences);
    });

    return scouter;
}

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

function buildPatrols(scouter, targetSize) {
    const minSize = Math.max(2, targetSize - 1);
    const maxSize = targetSize + 1;

    const clusters = createClusters(scouter);
    clusters.sort((a, b) => b.length - a.length);

    let patrolList = [];

    // Fill patrols with the clusters
    clusters.forEach(cluster => {
        let placed = false;

        for (const patrol of patrolList) {
            if (patrol.length + cluster.length <= maxSize) {
                patrol.push(...cluster);
                placed = true;
                break;
            }
        }

        if (!placed) {
            if (cluster.length <= maxSize) {
                patrolList.push([...cluster]);
            } else {
                let remaining = [...cluster];
                while (remaining.length > 0) {
                    const chunk = remaining.splice(0, targetSize);
                    patrolList.push(chunk);
                }
            }
        }
    });

    // Post-processing: Handle undersized patrols (< minSize)
    let smallPatrols = patrolList.filter(p => p.length < minSize);
    patrolList = patrolList.filter(p => p.length >= minSize);

    smallPatrols.forEach(smallPatrol => {
        smallPatrol.forEach(scout => {
            const prefs = scouter.get(scout) || [];
            let placed = false;

            // Prioritize a patrol with room and a known friend
            for (const patrol of patrolList) {
                const hasFriend = prefs.some(f => patrol.includes(f));
                if (hasFriend && patrol.length < maxSize) {
                    patrol.push(scout);
                    placed = true;
                    break;
                }
            }

            // Otherwise, place the scout in the smallest patrol with room
            if (!placed) {
                patrolList.sort((a, b) => a.length - b.length);
                for (const patrol of patrolList) {
                    if (patrol.length < maxSize) {
                        patrol.push(scout);
                        placed = true;
                        break;
                    }
                }
            }

            // Fallback when every patrol is full
            if (!placed) {
                patrolList.sort((a, b) => a.length - b.length);
                const scoutsAvailableForRebalancing = patrolList
                    .reduce((total, patrol) => total + Math.max(0, patrol.length - minSize), 0);

                if (scoutsAvailableForRebalancing >= minSize - 1) {
                    const newPatrol = [scout];
                    patrolList.sort((a, b) => b.length - a.length);

                    for (const patrol of patrolList) {
                        while (patrol.length > minSize && newPatrol.length < minSize) {
                            newPatrol.push(patrol.pop());
                        }
                    }

                    patrolList.push(newPatrol);
                } else {
                    patrolList[0].push(scout);
                }
            }
        });
    });

    return patrolList;
}

function exportAndReport(patrols, scouter, outputCsvPath, targetSize) {
    const csvRows = ["Patrull,Scout,Har Önskad Kamrat i Patrull"];
    let satisfiedCount = 0;
    let totalWithPreferences = 0;
    const minSize = Math.max(2, targetSize - 1);
    const maxSize = targetSize + 1;

    console.log(`=== RESULTERANDE PATRULLER (Mål: ${targetSize}, Tillåtet intervall: ${minSize}–${maxSize}) ===\n`);

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

function parseTargetSize(value) {
    if (value === undefined) return 5;

    const targetSize = Number(value);
    if (!Number.isInteger(targetSize) || targetSize < 2) {
        throw new Error('Önskad patrullstorlek måste vara ett heltal på minst 2.');
    }

    return targetSize;
}

function main() {
    const args = process.argv.slice(2);
    const inputFile = args[0] || 'test_scouter.csv';
    let targetSize;

    try {
        targetSize = parseTargetSize(args[1]);
    } catch (error) {
        console.error(`Fel: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    const outputFile = 'patruller_resultat.csv';

    const scouter = parseCSV(inputFile);
    const patrols = buildPatrols(scouter, targetSize);
    exportAndReport(patrols, scouter, outputFile, targetSize);
}

main();
