# Scoutpatrullbyggare

Ett Node.js-program för att automatiskt dela in scouter i patruller baserat på kamratönskemål. Programmet använder graf-analys (klustring) för att säkerställa att så många scouter som möjligt hamnar tillsammans med minst en av sina önskade kamrater.

---

## Filöversikt

- **`patrullbyggare.js`**: Huvudprogrammet som läser in scoutdata från en CSV-fil, analyserar kamratrelationer, skapar patruller och exporterar resultatet.
- **`generera_testdata.js`**: Hjälpskript för att skapa slumpmässig testdata i CSV-format.
- **`lint_csv.js`**: Validerar scoutdata och föreslår rättstavningar för okända namn.

---

## Förutsättningar

- [Node.js](https://nodejs.org/) (version 12 eller nyare) installerat på din dator.

---

## Installation & Användning

### Tester

Kör lintning, syntaxkontroll och alla automatiska tester med:

```bash
npm run ci
```

Testerna körs automatiskt för pull requests och för uppdateringar av `main`.

### Validera en CSV-fil

Kontrollera filen innan patrullerna byggs:

```bash
npm run lint:csv -- mina_scouter.csv
```

Verktyget visar rad och kolumn för okända eller dubblerade namn, självönskemål och
dubblerade önskemål. När ett okänt namn liknar en scout i filen föreslås den
troligaste rättstavningen.

### 1. Generera testdata (frivilligt)

Om du inte har en egen CSV-fil kan du skapa en testfil med genererade namn och kamratönskemål:

```bash
node generera_testdata.js [filnamn.csv] [antal_scouter]
```

**Exempel:**
```bash
# Skapar "test_scouter.csv" med 28 scouter (default)
node generera_testdata.js

# Skapar "mina_scouter.csv" med 35 scouter
node generera_testdata.js mina_scouter.csv 35
```

---

### 2. Kör Patrullbyggaren

För att skapa patruller utifrån din CSV-fil kör du `patrullbyggare.js`:

```bash
node patrullbyggare.js [input_csv] [onskad_patrullstorlek]
```

**Exempel:**
```bash
# Kör med standardfilen (test_scouter.csv) och riktstorlek 5 scouter/patrull
node patrullbyggare.js test_scouter.csv 5
```

---

## In- och Utdataformat

### Indata (`.csv`)
CSV-filen ska innehålla scoutens namn på den första kolumnen följt av önskade kamrater:
```csv
Sven,Anna,Erik
Anna,Sven,Erik
Karin,Olof
Johan
```
*   **Observera:** Scouter utan önskemål anges med enbart sitt namn (t.ex. `Johan`).

### Utdata (`patruller_resultat.csv` & konsol)
Programmet skriver ut patrullfördelning och statistik direkt i terminalen samt sparar resultatfilen `patruller_resultat.csv`:
```csv
"Patrull","Scout","Har Önskad Kamrat i Patrull"
"Patrull 1","Sven","JA"
"Patrull 1","Anna","JA"
"Patrull 1","Erik","JA"
...
```

---

## Algoritm & Logik

1. **Grafklustring (Connected Components):** Programmet analyserar utgående och ingående önskemål för att hitta naturliga "kompisgrupper".
2. **Patrullbyggnad med intervall ($\pm 1$):**
   - Angiven patrullstorlek ses som en *riktlinje*. Om du anger t.ex. **5** tillåts patrullstorlekar på **4 till 6** personer.
   - Klustren sorteras och fördelas så att kompisgrupper hålls ihop i största möjliga utsträckning.
3. **Efterbearbetning för små patruller:**
   - Alla patruller som hamnar under minsta tillåtna storlek (t.ex. $< 4$) upplöses.
   - Medlemmarna omfördelas med prioritet till patruller där deras önskade vänner finns, alternativt till de minsta patrullerna med ledig plats.
