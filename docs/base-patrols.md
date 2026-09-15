# Grundpatruller

## Syfte

Patrullbyggaren ska kunna utgå från befintliga patruller när en scoutgrupp löper
över flera år. Befintliga medlemmar kan antingen vara låsta till sina patruller
eller användas som en vägledande startpunkt. Nya scouter fördelas fortfarande
med hänsyn till patrullstorlek och kompisönskemål.

Alla patruller måste även fortsättningsvis innehålla mellan
`önskad patrullstorlek - 1` och `önskad patrullstorlek + 1` scouter.

## Begrepp

- **Grundpatrull:** En namngiven patrull som redan finns i verksamheten.
- **Grundmedlem:** En scout som har en grundpatrull i indata.
- **Fri scout:** En scout utan grundpatrull.
- **Ny patrull:** En patrull som algoritmen skapar utöver grundpatrullerna.
- **Omplacering:** En grundmedlem placeras i en annan patrull än sin
  grundpatrull.

## CSV-format

Det utökade formatet har en rubrikrad. Scoutens namn ligger kvar i första
kolumnen, grundpatrullen anges i den andra och kompisönskemålen följer därefter.

```csv
Scout,Grundpatrull,Önskemål 1,Önskemål 2
Anna,Räven,Bo,Clara
Bo,Räven,Anna
Clara,,Anna,David
David,,Clara
```

- `Scout` och `Grundpatrull` är fasta kolumner.
- Alla kolumner efter `Grundpatrull` behandlas som kompisönskemål.
- Tom `Grundpatrull` betyder att scouten får placeras fritt.
- Varje grundmedlem ska ha patrullnamnet på sin egen rad. Sammanslagna celler
  eller värden som underförstås från raden ovan stöds inte.
- Inledande och avslutande blanksteg tas bort från namn och patrullnamn.
- Skillnader enbart i skiftläge eller Unicode-normalisering ska inte skapa nya
  patruller. Den första stavningen används i resultatet.
- Lintningen ska varna för patrullnamn som sannolikt är stavfel, exempelvis
  `Räven` och `Raven`.

Det befintliga rubriklösa formatet ska fortsätta fungera oförändrat:

```csv
Anna,Bo,Clara
Bo,Anna
Clara,Anna,David
David,Clara
```

Om första raden börjar med `Scout,Grundpatrull` används det utökade formatet.
Annars tolkas filen som det befintliga formatet utan grundpatruller.

## När inställningarna visas

Inställningarna för grundpatruller ska vara helt dolda tills giltig indata
innehåller minst en scout med en grundpatrull. En rubrikrad med en tom
`Grundpatrull`-kolumn är inte tillräckligt.

När grundpatruller hittas visas en sammanfattning före inställningarna:

> **Befintliga patruller hittades**
>
> Vi hittade 3 befintliga patruller med 12 placerade scouter. Välj hur de ska
> användas när resten av gruppen delas in.

Om användaren byter eller redigerar indata så att grundpatrullerna försvinner
ska inställningarna döljas och återställas till sina standardvärden.

## Inställning: befintliga medlemmar

Rubrik: **Befintliga medlemmar**

### Behåll i sin patrull

Standardval.

> Medlemmarna i grundpatrullerna flyttas inte.

Grundmedlemmar är hårt låsta till sina namngivna patruller. Fria scouter kan
placeras i grundpatrullerna eller i nya patruller.

### Tillåt omplaceringar

> Medlemmar får flyttas om det förbättrar helheten. Grundpatrullerna behandlas
> som önskemål, inte krav.

Grundpatrullen används som startplacering. När alla storlekskrav är uppfyllda
prioriterar optimeringen i följande ordning:

1. maximera antalet scouter som får minst ett kompisönskemål uppfyllt;
2. maximera det totala antalet uppfyllda önskemål;
3. minimera antalet omplaceringar från grundpatrullerna.

En grundmedlem flyttas därmed inte när två lösningar ger samma
kompisuppfyllelse. Varje namngiven grundpatrull ska fortfarande finnas kvar i
resultatet.

## Inställning: nya patruller

Rubrik: **Nya patruller**

### Håll patrullerna nära riktstorleken

Standardval. Etiketten ska innehålla den valda riktstorleken, exempelvis:

> **Håll patrullerna nära 5 scouter**
>
> Patrullerna får innehålla 4–6 scouter. Nya patruller kan skapas även om
> befintliga patruller fortfarande har plats.

Algoritmen väljer det giltiga antalet patruller som ligger närmast
`antal scouter / riktstorlek`. Antalet får aldrig vara lägre än antalet
grundpatruller. Vid lika avstånd väljs det lägre antalet patruller.

### Fyll befintliga patruller först

> **Fyll befintliga patruller först**
>
> Befintliga patruller fylls upp till 6 scouter innan en ny skapas.

Algoritmen minimerar antalet nya patruller. En ny patrull skapas endast när
scouterna inte får plats i grundpatrullerna utan att överskrida den högsta
tillåtna storleken. Alla patruller måste samtidigt nå den lägsta tillåtna
storleken.

Inställningen styr antalet patruller, inte hur fria scouter fördelas mellan dem.
Kompisönskemålen styr fortfarande den fördelningen.

## Gemensamma regler

Storleksintervallet `riktstorlek ± 1` är ett hårt krav i alla kombinationer av
inställningarna.

Algoritmen ska:

1. skapa en patrullplats för varje unik grundpatrull;
2. bestämma antalet nya patruller enligt vald strategi;
3. placera låsta grundmedlemmar, om grundpatrullerna är låsta;
4. fördela övriga scouter med nuvarande kompisoptimering;
5. aldrig ta bort eller byta namn på en grundpatrull;
6. ge nya patruller stabila genererade namn som inte krockar med befintliga
   patrullnamn.

Standardkombinationen är:

- **Behåll i sin patrull**
- **Håll patrullerna nära riktstorleken**

## Validering och omöjliga lägen

Verktyget ska stoppa och ge ett åtgärdsförslag när hårda krav inte kan
uppfyllas. Det får inte tyst bryta en låsning eller storleksgräns.

Minst följande fall ska valideras:

- En låst grundpatrull innehåller fler än `riktstorlek + 1` medlemmar.
- Det finns för många grundpatruller för att alla ska kunna nå
  `riktstorlek - 1`.
- Det finns för få patruller för att alla scouter ska få plats inom
  `riktstorlek + 1` och en ny patrull kan inte nå minsta storleken.
- Samma scout förekommer på flera rader.
- Patrullnamn verkar vara dubbletter eller stavfel.

Felmeddelanden ska föreslå relevanta åtgärder, till exempel att:

- tillåta omplaceringar;
- ändra riktstorleken;
- rätta ett patrullnamn;
- ta bort en felaktig grundpatrull;
- lägga till eller ta bort scouter.

Om en låst scout önskar en scout i en annan låst grundpatrull är indata
fortfarande giltig. Önskemålet markeras som ouppfyllt och förklaras som påverkat
av en låst placering.

## Resultat

Grundpatrullernas namn ska användas i tabeller, nedladdad CSV och diagram. Nya
patruller använder genererade namn.

Resultatet ska visa:

- `Grundpatrull` på scouter som behöll sin tidigare patrull;
- `Omplacerad från Räven` på en grundmedlem som flyttades;
- `Ny patrull` på en patrull som skapades av algoritmen;
- en sammanfattning, exempelvis `10 av 12 scouter behöll sin grundpatrull`;
- när ett kompisönskemål inte kunde uppfyllas på grund av en låst placering.

Nedladdad resultat-CSV ska innehålla grundpatrull, resulterande patrull och om
scouten omplacerades. Befintliga resultatkolumner ska behållas.

## Webbgränssnitt

Inställningarna implementeras som två grupper av radioknappar i ett separat
fält för hittade grundpatruller. Beskrivningen för varje val ska alltid vara
synlig; betydelsen ska inte döljas i en tooltip.

Riktstorlekens aktuella minimi- och maximivärden ska interpoleras i texten. När
riktstorleken ändras uppdateras beskrivningen direkt.

All bearbetning sker även fortsättningsvis lokalt i webbläsaren utan
nätverksanrop.

## Kommandorad

CLI:n ska läsa båda CSV-formaten. Följande val kan läggas till utan att ändra
nuvarande positionsargument:

```text
--base-patrols locked|flexible
--new-patrols target-size|fill-existing
```

Om flaggorna saknas används webbgränssnittets standardvärden. Flaggorna har
ingen effekt när indata saknar grundpatruller.

## Acceptanskriterier

- Befintliga rubriklösa CSV-filer ger samma resultat som tidigare.
- Grundpatrullsinställningar visas endast när grundpatruller finns i giltig
  indata.
- Båda medlemsstrategierna och båda strategierna för nya patruller fungerar i
  kombination.
- Ingen lösning bryter mot `riktstorlek ± 1`.
- Låsta grundmedlemmar flyttas aldrig.
- Vägledande grundmedlemmar flyttas endast till en bättre lösning enligt den
  dokumenterade prioritetsordningen.
- Grundpatrullsnamn bevaras i gränssnitt, CSV, Mermaid och SVG.
- Omöjliga kombinationer ger tydliga och åtgärdbara fel.
- Resultatet förklarar behållna och omplacerade grundmedlemmar.
- Funktionen är deterministisk för samma indata och inställningar.
- Webbappen gör inga nätverksanrop med scoutdata.

## Testfall

Testerna ska minst täcka:

- gammalt CSV-format utan grundpatruller;
- nytt CSV-format med tomma och ifyllda grundpatruller;
- låsta respektive vägledande grundpatruller;
- riktstorleksstrategi respektive fyll-befintliga-först;
- samtliga fyra kombinationer av de två inställningarna;
- grundpatrull vid minimi- och maximistorlek;
- för stor låst grundpatrull;
- för många grundpatruller för antalet scouter;
- nya patrullnamn som inte krockar med befintliga namn;
- stavningsvarianter av patrullnamn;
- resultat och exporter för behållna och omplacerade scouter;
- att inställningarna visas, döljs och återställs vid ändrad indata.

## Utanför första versionen

- Låsning per scout eller per grundpatrull.
- Redigering av grundpatruller direkt i resultatet.
- Flera grundpatruller för samma scout.
- Optimering för ålder, erfarenhet, kön eller ledartillgång.
- Automatisk import från Google Kalkylark eller Excel.
