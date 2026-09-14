const fs = require('fs');

// Name pool for randomized validation
const namnPool = [
    "Sven", "Anna", "Erik", "Karin", "Olof", "Maja", "Lukas", "Ida",
    "Nils", "Sara", "Johan", "Elin", "Filip", "Sofia", "Hugo", "Viktor",
    "Alma", "Gustav", "Oscar", "Alice", "Ebba", "William", "Leo", "Noah",
    "Lucas", "Freja", "Liam", "Astrid", "Emil", "Linnea", "Saga", "Alexander"
];

function generateScoutData(count = 28) {
    // Select a unique set of names up to 'count'
    const scouter = namnPool.slice(0, count);
    const rows = [];

    scouter.forEach((scout, index) => {
        const preferences = [];

        // Give ~80% of the scouts 1–3 preferences; the rest get none
        if (Math.random() > 0.2) {
            // Pick 1–3 random friends other than the scout
            const possibleFriends = scouter.filter(s => s !== scout);
            
            // Sometimes prioritize list neighbors to create clusters and reciprocity
            if (index > 0 && Math.random() < 0.6) {
                preferences.push(scouter[index - 1]);
            }

            while (preferences.length < Math.floor(Math.random() * 3) + 1) {
                const randomFriend = possibleFriends[Math.floor(Math.random() * possibleFriends.length)];
                if (!preferences.includes(randomFriend)) {
                    preferences.push(randomFriend);
                }
            }
        }

        const row = [scout, ...preferences].join(',');
        rows.push(row);
    });

    return rows.join('\n');
}

function main() {
    const outputFile = process.argv[2] || 'test_scouter.csv';
    const totalScouts = parseInt(process.argv[3], 10) || 28;

    const csvContent = generateScoutData(totalScouts);
    fs.writeFileSync(outputFile, csvContent, 'utf-8');

    console.log(`\n CSV-fil skapad: "${outputFile}"`);
    console.log(` Antal scouter: ${totalScouts}`);
    console.log('\n--- Exempel på rader ---');
    console.log(csvContent.split('\n').slice(0, 5).join('\n'));
    console.log('...\n');
}

main();
