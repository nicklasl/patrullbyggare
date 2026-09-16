function parseCsv(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    const scouts = new Map();
    const basePatrols = new Map();
    const basePatrolCanonicalMap = new Map();

    if (lines.length === 0) {
        scouts.basePatrols = basePatrols;
        scouts.hasBasePatrols = false;
        return scouts;
    }

    const firstLineParts = lines[0].split(',').map(part => part.trim());
    const firstCol = (firstLineParts[0] || '').toLowerCase();
    const secondCol = (firstLineParts[1] || '').toLowerCase();
    const hasHeader = firstLineParts.length >= 2
        && (firstCol === 'grundpatrull' || firstCol === 'patrull')
        && secondCol === 'scout';

    const hasEmptyFirstCell = !hasHeader && lines.some(line => {
        const parts = line.split(',').map(p => p.trim());
        return parts.length >= 2 && parts[0] === '' && Boolean(parts[1]);
    });

    const isPatrolColumnFormat = hasHeader || hasEmptyFirstCell;
    const dataLines = hasHeader ? lines.slice(1) : lines;

    dataLines.forEach(line => {
        const parts = line.split(',').map(part => part.trim());
        if (parts.every(p => !p)) return;

        let basePatrol = '';
        let scoutName = '';
        let preferences = [];

        if (isPatrolColumnFormat) {
            basePatrol = parts[0] || '';
            scoutName = parts[1] || '';
            preferences = parts.slice(2).filter(Boolean);
        } else {
            scoutName = parts[0] || '';
            preferences = parts.slice(1).filter(Boolean);
        }

        if (!scoutName) return;

        if (basePatrol) {
            const canonical = basePatrol.normalize('NFC').toLocaleLowerCase('sv-SE');
            if (!basePatrolCanonicalMap.has(canonical)) {
                basePatrolCanonicalMap.set(canonical, basePatrol);
            }
            const firstSpelling = basePatrolCanonicalMap.get(canonical);
            basePatrols.set(scoutName, firstSpelling);
        }

        scouts.set(scoutName, preferences);
    });

    scouts.basePatrols = basePatrols;
    scouts.hasBasePatrols = basePatrols.size > 0;
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

function getPatrolSizesForCount(scoutCount, patrolCount) {
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

function scorePatrols(patrols, scouts, basePatrols) {
    let satisfiedScouts = 0;
    let matchedPreferences = 0;
    let reassignments = 0;

    patrols.forEach(patrol => {
        const patrolName = patrol.name;
        const patrolMembers = new Set(patrol);
        patrol.forEach(scout => {
            const matches = (scouts.get(scout) || [])
                .filter(friend => patrolMembers.has(friend)).length;
            if (matches > 0) satisfiedScouts++;
            matchedPreferences += matches;

            if (basePatrols && basePatrols.has(scout)) {
                if (basePatrols.get(scout) !== patrolName) {
                    reassignments++;
                }
            }
        });
    });

    return { satisfiedScouts, matchedPreferences, reassignments };
}

function isBetterScore(candidate, current) {
    if (candidate.satisfiedScouts !== current.satisfiedScouts) {
        return candidate.satisfiedScouts > current.satisfiedScouts;
    }
    if (candidate.matchedPreferences !== current.matchedPreferences) {
        return candidate.matchedPreferences > current.matchedPreferences;
    }
    return candidate.reassignments < current.reassignments;
}

function optimizePatrols(patrols, scouts, basePatrols, isLocked) {
    let currentScore = scorePatrols(patrols, scouts, basePatrols);

    while (true) {
        let bestSwap;
        let bestScore = currentScore;

        for (let leftPatrol = 0; leftPatrol < patrols.length; leftPatrol++) {
            for (let rightPatrol = leftPatrol + 1; rightPatrol < patrols.length; rightPatrol++) {
                for (let leftScout = 0; leftScout < patrols[leftPatrol].length; leftScout++) {
                    for (let rightScout = 0; rightScout < patrols[rightPatrol].length; rightScout++) {
                        const left = patrols[leftPatrol][leftScout];
                        const right = patrols[rightPatrol][rightScout];

                        // If locked mode, do not swap locked base members
                        if (isLocked) {
                            if (basePatrols && basePatrols.has(left)) continue;
                            if (basePatrols && basePatrols.has(right)) continue;
                        }

                        patrols[leftPatrol][leftScout] = right;
                        patrols[rightPatrol][rightScout] = left;

                        const candidateScore = scorePatrols(patrols, scouts, basePatrols);
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

function buildPatrols(scouts, targetSize, options = {}) {
    const {
        basePatrolsMode = 'locked',
        newPatrolsMode = 'target-size',
    } = options;

    const scoutNames = Array.from(scouts.keys());
    const scoutCount = scoutNames.length;
    const basePatrols = scouts.basePatrols || new Map();
    const isLocked = basePatrolsMode === 'locked';

    const minSize = Math.max(2, targetSize - 1);
    const maxSize = targetSize + 1;

    // Collect unique base patrol names in order of appearance
    const uniqueBasePatrols = [];
    basePatrols.forEach(patrolName => {
        if (!uniqueBasePatrols.includes(patrolName)) {
            uniqueBasePatrols.push(patrolName);
        }
    });

    const basePatrolCount = uniqueBasePatrols.length;

    // Validate locked base patrol sizes
    if (isLocked && basePatrolCount > 0) {
        const counts = new Map();
        basePatrols.forEach(patrolName => {
            counts.set(patrolName, (counts.get(patrolName) || 0) + 1);
        });

        counts.forEach((count, patrolName) => {
            if (count > maxSize) {
                throw new Error(
                    `Grundpatrullen "${patrolName}" har ${count} medlemmar, `
                    + `vilket överskrider högsta tillåtna storlek på ${maxSize}. `
                    + `Ändra riktstorleken eller tillåt omplaceringar.`
                );
            }
        });
    }

    // Validate total scouts vs base patrol count
    if (basePatrolCount > 0) {
        const minRequiredScouts = basePatrolCount * minSize;
        if (scoutCount < minRequiredScouts) {
            throw new Error(
                `För många grundpatruller (${basePatrolCount}) för ${scoutCount} scouter `
                + `med lägsta tillåtna storlek ${minSize}. `
                + `Ändra riktstorleken eller ta bort en grundpatrull.`
            );
        }
    }

    // Determine number of patrols
    let totalPatrolCount;
    if (newPatrolsMode === 'fill-existing' && basePatrolCount > 0) {
        const minPatrolsForMaxCapacity = Math.ceil(scoutCount / maxSize);
        totalPatrolCount = Math.max(basePatrolCount, minPatrolsForMaxCapacity);
    } else {
        const standardSizes = getPatrolSizes(scoutCount, targetSize);
        totalPatrolCount = Math.max(basePatrolCount, standardSizes.length);
    }

    // Verify size boundaries for totalPatrolCount
    const patrolSizes = getPatrolSizesForCount(scoutCount, totalPatrolCount);
    const invalidSize = patrolSizes.some(size => size < minSize || size > maxSize);
    if (invalidSize) {
        throw new Error(
            `Kan inte fördela ${scoutCount} scouter i ${totalPatrolCount} patruller `
            + `inom storleksintervallet ${minSize}–${maxSize}. Ändra riktstorleken.`
        );
    }

    // Generate names for new patrols
    const patrolNames = [...uniqueBasePatrols];
    let nextPatrolNum = 1;
    while (patrolNames.length < totalPatrolCount) {
        const candidateName = `Patrull ${nextPatrolNum}`;
        nextPatrolNum++;
        if (!patrolNames.includes(candidateName)) {
            patrolNames.push(candidateName);
        }
    }

    // Initial assignment logic
    // Assign base patrol members to their respective patrol index if locked/flexible baseline
    const initialPatrols = patrolSizes.map((size, idx) => {
        const arr = [];
        arr.name = patrolNames[idx];
        return arr;
    });

    const unassignedScouts = [];

    scoutNames.forEach(scout => {
        const bp = basePatrols.get(scout);
        if (bp !== undefined) {
            const patrolIdx = patrolNames.indexOf(bp);
            if (patrolIdx !== -1 && initialPatrols[patrolIdx].length < patrolSizes[patrolIdx]) {
                initialPatrols[patrolIdx].push(scout);
                return;
            }
        }
        unassignedScouts.push(scout);
    });

    // Fill remaining spots from unassignedScouts
    let unassignedIdx = 0;
    initialPatrols.forEach((patrol, idx) => {
        while (patrol.length < patrolSizes[idx] && unassignedIdx < unassignedScouts.length) {
            patrol.push(unassignedScouts[unassignedIdx]);
            unassignedIdx++;
        }
    });

    // Solve & optimize
    const clusteredScouts = createClusters(scouts)
        .sort((left, right) => right.length - left.length)
        .flat();

    const startingOrders = [scoutNames, clusteredScouts, [...scoutNames].reverse()];
    const shuffledOrderCount = Math.min(20, Math.max(4, scoutNames.length));

    for (let seed = 1; seed <= shuffledOrderCount; seed++) {
        startingOrders.push(shuffledScouts(scoutNames, seed));
    }

    let bestPatrols = initialPatrols;
    let bestScore = scorePatrols(initialPatrols, scouts, basePatrols);

    startingOrders.forEach(order => {
        // Construct candidate patrols starting with base assignments
        const candidatePatrols = patrolSizes.map((size, idx) => {
            const arr = [];
            arr.name = patrolNames[idx];
            return arr;
        });

        // Place locked members first if in locked mode
        const orderUnassigned = [];
        order.forEach(scout => {
            const bp = basePatrols.get(scout);
            if (isLocked && bp !== undefined) {
                const patrolIdx = patrolNames.indexOf(bp);
                if (patrolIdx !== -1 && candidatePatrols[patrolIdx].length < patrolSizes[patrolIdx]) {
                    candidatePatrols[patrolIdx].push(scout);
                    return;
                }
            }
            orderUnassigned.push(scout);
        });

        let uIdx = 0;
        candidatePatrols.forEach((patrol, idx) => {
            while (patrol.length < patrolSizes[idx] && uIdx < orderUnassigned.length) {
                patrol.push(orderUnassigned[uIdx]);
                uIdx++;
            }
        });

        const optimized = optimizePatrols(candidatePatrols, scouts, basePatrols, isLocked);
        const score = scorePatrols(optimized, scouts, basePatrols);

        if (isBetterScore(score, bestScore)) {
            bestPatrols = optimized;
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
    let totalBaseMembers = 0;
    let retainedBaseMembers = 0;
    const basePatrols = scouts.basePatrols || new Map();
    const records = [];

    patrols.forEach((patrol, patrolIndex) => {
        const patrolName = patrol.name || `Patrull ${patrolIndex + 1}`;
        patrol.forEach(scout => {
            const preferences = scouts.get(scout) || [];
            const hasFriendInPatrol = preferences.some(friend => patrol.includes(friend));
            if (preferences.length > 0) {
                totalWithPreferences++;
                if (hasFriendInPatrol) satisfiedCount++;
            }

            const basePatrol = basePatrols.get(scout) || '';
            const isBaseMember = Boolean(basePatrol);
            const isRetained = isBaseMember && basePatrol === patrolName;
            const isReassigned = isBaseMember && !isRetained;

            if (isBaseMember) {
                totalBaseMembers++;
                if (isRetained) retainedBaseMembers++;
            }

            let memberStatus = 'Fri scout';
            if (isRetained) memberStatus = 'Grundpatrull';
            else if (isReassigned) memberStatus = `Omplacerad från ${basePatrol}`;

            records.push({
                patrol: patrolName,
                scout,
                basePatrol,
                reassigned: isReassigned,
                memberStatus,
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
            totalBaseMembers,
            retainedBaseMembers,
        },
    };
}

function escapeCsvCell(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
}

function createResultCsv(result) {
    const hasBasePatrols = result.records.some(r => r.basePatrol || r.reassigned);
    const headers = hasBasePatrols
        ? ['Patrull', 'Resulterande Patrull', 'Scout', 'Omplacerad', 'Har Önskad Kamrat i Patrull']
        : ['Patrull', 'Scout', 'Har Önskad Kamrat i Patrull'];

    const rows = [headers.join(',')];
    result.records.forEach(record => {
        if (hasBasePatrols) {
            rows.push([
                escapeCsvCell(record.basePatrol),
                escapeCsvCell(record.patrol),
                escapeCsvCell(record.scout),
                escapeCsvCell(record.reassigned ? 'JA' : 'NEJ'),
                escapeCsvCell(record.status),
            ].join(','));
        } else {
            rows.push([
                escapeCsvCell(record.patrol),
                escapeCsvCell(record.scout),
                escapeCsvCell(record.status),
            ].join(','));
        }
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
