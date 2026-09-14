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

function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function createGraphModel(patrols, scouter) {
    const nodes = [];
    const nodeByName = new Map();

    patrols.forEach((patrol, patrolIndex) => {
        patrol.forEach(name => {
            const node = {
                id: `scout_${nodes.length}`,
                name,
                patrolIndex,
                preferences: scouter.get(name) || [],
            };
            nodes.push(node);
            nodeByName.set(name, node);
        });
    });

    const edges = nodes.flatMap(source => source.preferences
        .map(preference => nodeByName.get(preference))
        .filter(Boolean)
        .map(target => ({
            source,
            target,
            fulfilled: source.patrolIndex === target.patrolIndex,
        })));

    return { nodes, edges };
}

function createMermaidGraph(patrols, scouter) {
    const { nodes, edges } = createGraphModel(patrols, scouter);
    const lines = ['flowchart LR'];

    patrols.forEach((patrol, patrolIndex) => {
        lines.push(`  subgraph patrol_${patrolIndex + 1}["Patrull ${patrolIndex + 1}"]`);
        lines.push('    direction TB');
        nodes.filter(node => node.patrolIndex === patrolIndex).forEach(node => {
            lines.push(`    ${node.id}["${escapeXml(node.name)}"]`);
        });
        lines.push('  end');
    });

    edges.forEach(edge => {
        const connector = edge.fulfilled ? '-->' : '-.->';
        lines.push(`  ${edge.source.id} ${connector}|önskar| ${edge.target.id}`);
    });

    lines.push('  classDef satisfied fill:#dcfce7,stroke:#15803d,color:#14532d');
    lines.push('  classDef unsatisfied fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d');
    lines.push('  classDef neutral fill:#f1f5f9,stroke:#64748b,color:#1e293b');

    nodes.forEach(node => {
        const hasFulfilledPreference = edges.some(edge => edge.source === node && edge.fulfilled);
        const className = node.preferences.length === 0
            ? 'neutral'
            : (hasFulfilledPreference ? 'satisfied' : 'unsatisfied');
        lines.push(`  class ${node.id} ${className}`);
    });

    return `${lines.join('\n')}\n`;
}

function createSvgGraph(patrols, scouter) {
    const { nodes, edges } = createGraphModel(patrols, scouter);
    const columnCount = Math.min(3, patrols.length);
    const rowCount = Math.ceil(patrols.length / columnCount);
    const panelWidth = 280;
    const panelGap = 32;
    const nodeHeight = 36;
    const nodeGap = 12;
    const panelPadding = 20;
    const headingHeight = 48;
    const maxPatrolSize = Math.max(...patrols.map(patrol => patrol.length));
    const panelHeight = headingHeight + panelPadding + maxPatrolSize * (nodeHeight + nodeGap);
    const legendHeight = 64;
    const width = columnCount * panelWidth + (columnCount + 1) * panelGap;
    const height = rowCount * panelHeight + (rowCount + 1) * panelGap + legendHeight;
    const positions = new Map();

    nodes.forEach(node => {
        const column = node.patrolIndex % columnCount;
        const row = Math.floor(node.patrolIndex / columnCount);
        const patrolNodes = nodes.filter(candidate => candidate.patrolIndex === node.patrolIndex);
        const memberIndex = patrolNodes.indexOf(node);
        positions.set(node.id, {
            x: panelGap + column * (panelWidth + panelGap) + panelPadding,
            y: panelGap + row * (panelHeight + panelGap) + headingHeight + memberIndex * (nodeHeight + nodeGap),
        });
    });

    const lines = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">`,
        '  <title id="title">Patrullernas kamratönskemål</title>',
        '  <desc id="description">Grön heldragen pil visar ett uppfyllt önskemål. Röd streckad pil visar ett önskemål till en annan patrull.</desc>',
        '  <defs>',
        '    <marker id="fulfilled-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#15803d"/></marker>',
        '    <marker id="unfulfilled-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#b91c1c"/></marker>',
        '  </defs>',
        '  <rect width="100%" height="100%" fill="#ffffff"/>',
    ];

    patrols.forEach((patrol, patrolIndex) => {
        const column = patrolIndex % columnCount;
        const row = Math.floor(patrolIndex / columnCount);
        const x = panelGap + column * (panelWidth + panelGap);
        const y = panelGap + row * (panelHeight + panelGap);
        lines.push(`  <rect x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" rx="12" fill="#f8fafc" stroke="#475569" stroke-width="2"/>`);
        lines.push(`  <text x="${x + panelPadding}" y="${y + 30}" font-family="sans-serif" font-size="18" font-weight="700" fill="#0f172a">Patrull ${patrolIndex + 1}</text>`);
    });

    edges.forEach(edge => {
        const source = positions.get(edge.source.id);
        const target = positions.get(edge.target.id);
        const startX = source.x + panelWidth - panelPadding * 2;
        const startY = source.y + nodeHeight / 2;
        const endX = target.x;
        const endY = target.y + nodeHeight / 2;
        const controlX = (startX + endX) / 2;
        const color = edge.fulfilled ? '#15803d' : '#b91c1c';
        const dash = edge.fulfilled ? '' : ' stroke-dasharray="7 5"';
        const marker = edge.fulfilled ? 'fulfilled-arrow' : 'unfulfilled-arrow';
        lines.push(`  <path d="M ${startX} ${startY} Q ${controlX} ${startY}, ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="2"${dash} marker-end="url(#${marker})" opacity="0.75"/>`);
    });

    nodes.forEach(node => {
        const position = positions.get(node.id);
        const hasFulfilledPreference = edges.some(edge => edge.source === node && edge.fulfilled);
        const fill = node.preferences.length === 0
            ? '#f1f5f9'
            : (hasFulfilledPreference ? '#dcfce7' : '#fee2e2');
        const stroke = node.preferences.length === 0
            ? '#64748b'
            : (hasFulfilledPreference ? '#15803d' : '#b91c1c');
        lines.push(`  <rect x="${position.x}" y="${position.y}" width="${panelWidth - panelPadding * 2}" height="${nodeHeight}" rx="6" fill="${fill}" stroke="${stroke}"/>`);
        lines.push(`  <text x="${position.x + 12}" y="${position.y + 24}" font-family="sans-serif" font-size="14" fill="#0f172a">${escapeXml(node.name)}</text>`);
    });

    const legendY = height - legendHeight + 24;
    lines.push(`  <line x1="${panelGap}" y1="${legendY}" x2="${panelGap + 40}" y2="${legendY}" stroke="#15803d" stroke-width="2" marker-end="url(#fulfilled-arrow)"/>`);
    lines.push(`  <text x="${panelGap + 52}" y="${legendY + 5}" font-family="sans-serif" font-size="14" fill="#334155">Uppfyllt önskemål</text>`);
    lines.push(`  <line x1="${panelGap + 210}" y1="${legendY}" x2="${panelGap + 250}" y2="${legendY}" stroke="#b91c1c" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#unfulfilled-arrow)"/>`);
    lines.push(`  <text x="${panelGap + 262}" y="${legendY + 5}" font-family="sans-serif" font-size="14" fill="#334155">Önskemål till annan patrull</text>`);
    lines.push('</svg>');

    return `${lines.join('\n')}\n`;
}

function exportVisualizations(patrols, scouter, mermaidPath, svgPath) {
    fs.writeFileSync(mermaidPath, createMermaidGraph(patrols, scouter), 'utf-8');
    fs.writeFileSync(svgPath, createSvgGraph(patrols, scouter), 'utf-8');
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
    const mermaidFile = 'patruller_resultat.mmd';
    const svgFile = 'patruller_resultat.svg';

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
    exportVisualizations(patrols, scouter, mermaidFile, svgFile);
    console.log(`Visualiseringar har sparats till: ${mermaidFile} och ${svgFile}`);
}

if (require.main === module) main();

module.exports = {
    buildPatrols,
    createMermaidGraph,
    createSvgGraph,
    getPatrolSizes,
    scorePatrols,
};
