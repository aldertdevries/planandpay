# PlanAndPay — beheermenu herordenen + terminologie Rekening/Producten (ontwerp)

Datum: 2026-07-16
Status: goedgekeurd door gebruiker

## 1. Beheermenu: volgorde en labels

Nieuwe volgorde en labels (element-id's en view-namen blijven ongewijzigd,
alleen DOM-volgorde en zichtbare tekst wijzigen):

| # | id | oud label | nieuw label |
|---|---|---|---|
| 1 | menu-agenda | Agenda | **Afspraken** |
| 2 | menu-facturen | Facturen | **Rekeningen** |
| 3 | menu-klanten | Klanten | Klanten |
| 4 | menu-regels | Factuurregels | **Producten** |
| 5 | menu-tijden | Openingstijden | Openingstijden |
| 6 | menu-berichten | Berichten | **Bericht Sjablonen** |
| 7 | menu-profiel | Profiel | **Instellingen** |
| 8 | menu-uitloggen | Uitloggen | Uitloggen |

De `<a>`-elementen in `beheer.html` worden in deze volgorde gezet; de
`toonView`/menu-arrays in `js/beheer.js` behouden dezelfde interne namen
(`agenda`, `facturen`, `klanten`, `regels`, `tijden`, `berichten`,
`profiel`).

## 2. Terminologie: Factuur → Rekening (alleen zichtbare tekst)

Overal in de UI wordt "Factuur/factuur" → "Rekening/rekening",
"Facturen/facturen" → "Rekeningen/rekeningen". **Niet** gewijzigd (anders
breekt de app): methodenamen (`maakFactuur`, `facturenVoor`, `vindFactuur`,
`crediteerFactuur`, `zetFactuurStatus`, `zetFactuurReeks`,
`zetFactuurVoettekst`), db-velden (`factuurId`, `factuurRegels`,
`factuurReeks`, `factuurVoettekst`), element-id's/klassen (`view-facturen`,
`menu-facturen`, `f-nummer`, …), bestandsnamen (`factuur.html`,
`js/factuur.js`), URL's en query's (`factuur.html?id=`,
`betaal.html?factuur=`), en de sjablonensleutel `factuur` in `Berichten`.

Concrete zichtbare wijzigingen (o.a.):
- Menu "Rekeningen"; pagina/tab-koppen "Rekeningen", "Rekening".
- `factuur.html`: titel "Rekening"; kop "REKENING"/"CREDITREKENING";
  "Rekeningnummer", "Rekeningdatum", "Rekening aan", "Creditrekening voor
  rekening <nr>"; bijlagetekst "rekening-<nr>.pdf".
- Rekening-opbouwscherm: "Rekening maken en mailen", knop "Rekening maken"
  in de afsprakenrij; "Voeg minimaal één product toe".
- Rekeningmail (sjabloon `factuur`): "Hierbij sturen wij u rekening
  {nummer}"; berichttype-label "Rekeningmail".
- Betaalpagina/betaalmail: "Rekening {nummer}", "Deze rekening is betaald",
  "U kunt deze rekening niet betalen", onderwerp "Betaling ontvangen —
  rekening {nummer}".
- Instellingen: "Rekeningtekst", "Rekeningreeks — prefix".
- CSV: downloadknop/bestandsnaam `rekeningen-<code>.csv`; kolom "Op rekening"
  (was "Gefactureerd").
- Over-pagina + README: "facturen"→"rekeningen", "factuur"→"rekening".

## 3. Producten (voorheen factuurregels)

Binnen de Producten-tab en het opbouwscherm heet alles voortaan **product**:
"Producten", "Product toevoegen", "Nog geen producten gedefinieerd",
"Product kiezen of nieuw maken", "— nieuw product —", "Ook bewaren als
product", "Producten op deze rekening". Db-veld `factuurRegels` en de
regel-objecten blijven intern ongewijzigd.

## 4. Status "Gefactureerd" → "Op rekening"

Badge in Afspraken en CSV-kolom worden **"Op rekening"**; de
annuleer-blokkademelding wordt "U heeft al een rekening voor deze afspraak
gekregen …". De statuswaarde van facturen (`Open`/`Betaald`/… ) blijft
ongewijzigd (dat is geen factuur-woord).

## Verificatie

`node scripts/run-tests.mjs` → alle tests groen (interne namen ongewijzigd;
test-teksten kunnen 'factuur' bevatten maar controleren gedrag, niet UI-
woorden). Browser: beheermenu in de nieuwe volgorde met nieuwe labels; de
hele klik-route (afspraak → rekening maken → rekening bekijken → betalen)
toont overal "rekening"/"product"; geen zichtbare "Factuur"/"factuur" meer
in de UI (m.u.v. interne, niet-zichtbare identifiers); rekening-, afspraken-
en klanten-CSV werken; app draait zonder console-fouten. Daarna commit +
push.
