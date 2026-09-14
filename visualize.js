const fs = require('fs');

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

module.exports = { createMermaidGraph, createSvgGraph, exportVisualizations };
