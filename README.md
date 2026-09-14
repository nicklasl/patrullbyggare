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

### Kör från GitHub

1. Exportera Google-arket som CSV.
2. Base64-koda filen till en enda rad:

   ```bash
   base64 < mina_scouter.csv | tr -d '\n'
   ```

3. Öppna **Actions → Vet CSV → Run workflow**, klistra in Base64-strängen och
   kör valideringen.
4. Rätta eventuella problem lokalt och Base64-koda filen igen.
5. Öppna **Actions → Build Patrols → Run workflow**, klistra in den nya strängen,
   ange önskad patrullstorlek och kör.

Byggstegets logg visar hela patrullindelningen. Resultatfilen
`patruller_resultat.csv` visas i körningens sammanfattning och kan laddas ned som
en fil i 24 timmar. Indatafilen laddas inte upp som en artefakt.

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

1. **Balanserade patrullstorlekar:** Angiven patrullstorlek ses som en
   *riktlinje*. Om du anger exempelvis **5** tillåts patrullstorlekar på **4 till
   6** personer, och programmet väljer så jämna storlekar som möjligt.
2. **Kandidater:** Programmet skapar flera deterministiska startfördelningar från
   filordningen, kompisgrupper och blandade ordningar.
3. **Preferensoptimering:** Scouter byter patrull när bytet ökar antalet scouter
   som får minst en önskad kamrat. Om två fördelningar hjälper lika många används
   det totala antalet uppfyllda önskemål som utslagsgivare.

Optimeringen är en heuristik och garanterar därför inte den matematiskt bästa
fördelningen, men undviker att stora sammanhängande kompisgrupper delas enbart
efter grafens traverseringsordning.
