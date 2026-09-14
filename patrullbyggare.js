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

function getPatrolSizes(scoutCount, targetSize) {
    const minSize = Math.max(2, targetSize - 1);
    const maxSize = targetSize + 1;
    const minPatrolCount = Math.ceil(scoutCount / maxSize);
    const maxPatrolCount = Math.floor(scoutCount / minSize);
    const preferredPatrolCount = Math.max(1, Math.round(scoutCount / targetSize));
    const patrolCount = minPatrolCount <= maxPatrolCount
        ? Math.max(minPatrolCount, Math.min(preferredPatrolCount, maxPatrolCount))
        : preferredPatrolCount;
    const baseSize = Math.floor(scoutCount / patrolCount);
    const largerPatrolCount = scoutCount % patrolCount;

    return Array.from(
        { length: patrolCount },
        (_, index) => baseSize + (index < largerPatrolCount ? 1 : 0)
    );
}

function createPatrolsFromOrder(scouts, patrolSizes) {
    let start = 0;
    return patrolSizes.map(size => {
        const patrol = scouts.slice(start, start + size);
        start += size;
        return patrol;
    });
}

function scorePatrols(patrols, scouter) {
    let satisfiedScouts = 0;
    let matchedPreferences = 0;

    patrols.forEach(patrol => {
        const patrolMembers = new Set(patrol);
        patrol.forEach(scout => {
            const matches = (scouter.get(scout) || [])
                .filter(friend => patrolMembers.has(friend)).length;
            if (matches > 0) satisfiedScouts++;
            matchedPreferences += matches;
        });
    });

    return { satisfiedScouts, matchedPreferences };
}

function isBetterScore(candidate, current) {
    return candidate.satisfiedScouts > current.satisfiedScouts
        || (candidate.satisfiedScouts === current.satisfiedScouts
            && candidate.matchedPreferences > current.matchedPreferences);
}

function optimizePatrols(patrols, scouter) {
    let currentScore = scorePatrols(patrols, scouter);

    while (true) {
        let bestSwap;
        let bestScore = currentScore;

        for (let leftPatrol = 0; leftPatrol < patrols.length; leftPatrol++) {
            for (let rightPatrol = leftPatrol + 1; rightPatrol < patrols.length; rightPatrol++) {
                for (let leftScout = 0; leftScout < patrols[leftPatrol].length; leftScout++) {
                    for (let rightScout = 0; rightScout < patrols[rightPatrol].length; rightScout++) {
                        const left = patrols[leftPatrol][leftScout];
                        const right = patrols[rightPatrol][rightScout];
                        patrols[leftPatrol][leftScout] = right;
                        patrols[rightPatrol][rightScout] = left;

                        const candidateScore = scorePatrols(patrols, scouter);
                        if (isBetterScore(candidateScore, bestScore)) {
                            bestScore = candidateScore;
                            bestSwap = { leftPatrol, rightPatrol, leftScout, rightScout };
                        }

                        patrols[leftPatrol][leftScout] = left;
                        patrols[rightPatrol][rightScout] = right;
                    }
                }
            }
        }

        if (!bestSwap) return patrols;

        const left = patrols[bestSwap.leftPatrol][bestSwap.leftScout];
        patrols[bestSwap.leftPatrol][bestSwap.leftScout]
            = patrols[bestSwap.rightPatrol][bestSwap.rightScout];
        patrols[bestSwap.rightPatrol][bestSwap.rightScout] = left;
        currentScore = bestScore;
    }
}

function shuffledScouts(scouts, seed) {
    const shuffled = [...scouts];
    let state = seed;

    for (let index = shuffled.length - 1; index > 0; index--) {
        state = (state * 1664525 + 1013904223) >>> 0;
        const swapIndex = state % (index + 1);
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
}

function buildPatrols(scouter, targetSize) {
    const scouts = Array.from(scouter.keys());
    const patrolSizes = getPatrolSizes(scouts.length, targetSize);
    const clusteredScouts = createClusters(scouter)
        .sort((left, right) => right.length - left.length)
        .flat();
    const startingOrders = [scouts, clusteredScouts, [...scouts].reverse()];
    const shuffledOrderCount = Math.min(20, Math.max(4, scouts.length));

    for (let seed = 1; seed <= shuffledOrderCount; seed++) {
        startingOrders.push(shuffledScouts(scouts, seed));
    }

    let bestPatrols;
    let bestScore;

    startingOrders.forEach(order => {
        const patrols = optimizePatrols(createPatrolsFromOrder(order, patrolSizes), scouter);
        const score = scorePatrols(patrols, scouter);

        if (!bestScore || isBetterScore(score, bestScore)) {
            bestPatrols = patrols;
            bestScore = score;
        }
    });

    return bestPatrols;
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

function validateRosterSize(scoutCount, targetSize) {
    const minSize = Math.max(2, targetSize - 1);
    if (scoutCount >= minSize) return;

    const suggestedTargetSize = Math.max(2, scoutCount);

    if (scoutCount < 2) {
        const missingScoutCount = 2 - scoutCount;
        const scoutLabel = missingScoutCount === 1 ? 'scout' : 'scouter';
        throw new Error(
            `Minst 2 scouter krävs för att bygga en patrull. ` +
            `Lägg till ${missingScoutCount} ${scoutLabel}. ` +
            `Föreslagen patrullstorlek: ${suggestedTargetSize}.`
        );
    }

    throw new Error(
        `${scoutCount} scouter är för få för patrullstorlek ${targetSize}, ` +
        `som kräver minst ${minSize}. Föreslagen patrullstorlek: ${suggestedTargetSize}.`
    );
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

    try {
        validateRosterSize(scouter.size, targetSize);
    } catch (error) {
        console.error(`Fel: ${error.message}`);
        process.exitCode = 1;
        return;
    }

    const patrols = buildPatrols(scouter, targetSize);
    exportAndReport(patrols, scouter, outputFile, targetSize);
}

if (require.main === module) main();

module.exports = { buildPatrols, getPatrolSizes, scorePatrols };
