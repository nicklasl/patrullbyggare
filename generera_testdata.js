const fs = require('fs');

// Pool av namn för slumpmässig validering
const namnPool = [
    "Sven", "Anna", "Erik", "Karin", "Olof", "Maja", "Lukas", "Ida",
    "Nils", "Sara", "Johan", "Elin", "Filip", "Sofia", "Hugo", "Viktor",
    "Alma", "Gustav", "Oscar", "Alice", "Ebba", "William", "Leo", "Noah",
    "Lucas", "Freja", "Liam", "Astrid", "Emil", "Linnea", "Saga", "Alexander"
];

function generateScoutData(count = 28) {
    // Välj ett unikt set av namn upp till 'count'
    const scouter = namnPool.slice(0, count);
    const rows = [];

    scouter.forEach((scout, index) => {
        const preferences = [];

        // Ge ~80% av scouterna 1-3 önskemål, resten får inga
        if (Math.random() > 0.2) {
            // Slumpa 1-3 vänner som inte är scouten själv
            const possibleFriends = scouter.filter(s => s !== scout);
            
            // Prioritera grannar i listan ibland för att skapa kluster/ömsesidighet
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
