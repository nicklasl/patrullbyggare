function parseCsv(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    const scouts = new Map();

    lines.forEach(line => {
        const parts = line.split(',').map(part => part.trim());
        scouts.set(parts[0], parts.slice(1).filter(Boolean));
    });

    return scouts;
}

function createClusters(scouts) {
    const visited = new Set();
    const clusters = [];

    scouts.forEach((preferences, scout) => {
        if (visited.has(scout)) return;

        const cluster = new Set();
        const queue = [scout];

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;

            visited.add(current);
            cluster.add(current);

            const outgoing = scouts.get(current) || [];
            const incoming = [];
            scouts.forEach((otherPreferences, otherScout) => {
                if (otherPreferences.includes(current)) incoming.push(otherScout);
            });

            [...outgoing, ...incoming].forEach(friend => {
                if (scouts.has(friend) && !visited.has(friend)) queue.push(friend);
            });
        }

        clusters.push(Array.from(cluster));
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

function scorePatrols(patrols, scouts) {
    let satisfiedScouts = 0;
    let matchedPreferences = 0;

    patrols.forEach(patrol => {
        const patrolMembers = new Set(patrol);
        patrol.forEach(scout => {
            const matches = (scouts.get(scout) || [])
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

function optimizePatrols(patrols, scouts) {
    let currentScore = scorePatrols(patrols, scouts);

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

                        const candidateScore = scorePatrols(patrols, scouts);
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

function buildPatrols(scouts, targetSize) {
    const scoutNames = Array.from(scouts.keys());
    const patrolSizes = getPatrolSizes(scoutNames.length, targetSize);
    const clusteredScouts = createClusters(scouts)
        .sort((left, right) => right.length - left.length)
        .flat();
    const startingOrders = [scoutNames, clusteredScouts, [...scoutNames].reverse()];
    const shuffledOrderCount = Math.min(20, Math.max(4, scoutNames.length));

    for (let seed = 1; seed <= shuffledOrderCount; seed++) {
        startingOrders.push(shuffledScouts(scoutNames, seed));
    }

    let bestPatrols;
    let bestScore;

    startingOrders.forEach(order => {
        const patrols = optimizePatrols(createPatrolsFromOrder(order, patrolSizes), scouts);
        const score = scorePatrols(patrols, scouts);

        if (!bestScore || isBetterScore(score, bestScore)) {
            bestPatrols = patrols;
            bestScore = score;
        }
    });

    return bestPatrols;
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
            `Minst 2 scouter krävs för att bygga en patrull. `
            + `Lägg till ${missingScoutCount} ${scoutLabel}. `
            + `Föreslagen patrullstorlek: ${suggestedTargetSize}.`
        );
    }

    throw new Error(
        `${scoutCount} scouter är för få för patrullstorlek ${targetSize}, `
        + `som kräver minst ${minSize}. Föreslagen patrullstorlek: ${suggestedTargetSize}.`
    );
}

function createPatrolResult(patrols, scouts) {
    let satisfiedCount = 0;
    let totalWithPreferences = 0;
    const records = [];

    patrols.forEach((patrol, patrolIndex) => {
        patrol.forEach(scout => {
            const preferences = scouts.get(scout) || [];
            const hasFriendInPatrol = preferences.some(friend => patrol.includes(friend));
            if (preferences.length > 0) {
                totalWithPreferences++;
                if (hasFriendInPatrol) satisfiedCount++;
            }

            records.push({
                patrol: `Patrull ${patrolIndex + 1}`,
                scout,
                preferences,
                status: preferences.length === 0
                    ? 'Inga önskemål'
                    : (hasFriendInPatrol ? 'JA' : 'NEJ'),
            });
        });
    });

    return {
        records,
        statistics: {
            scoutCount: scouts.size,
            totalWithPreferences,
            satisfiedCount,
            satisfiedPercentage: totalWithPreferences === 0
                ? 0
                : Math.round((satisfiedCount / totalWithPreferences) * 100),
        },
    };
}

function escapeCsvCell(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
}

function createResultCsv(result) {
    const rows = ['Patrull,Scout,Har Önskad Kamrat i Patrull'];
    result.records.forEach(record => {
        rows.push([
            escapeCsvCell(record.patrol),
            escapeCsvCell(record.scout),
            escapeCsvCell(record.status),
        ].join(','));
    });
    return rows.join('\n');
}

const patrolCore = {
    buildPatrols,
    createPatrolResult,
    createResultCsv,
    getPatrolSizes,
    parseCsv,
    parseTargetSize,
    scorePatrols,
    validateRosterSize,
};

if (typeof module !== 'undefined') module.exports = patrolCore;
if (typeof window !== 'undefined') window.Patrullbyggare = patrolCore;
