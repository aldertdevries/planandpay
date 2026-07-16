# Ontwerp: Betaalwijze bij rekeningen (Mollie / Pin / Contant)

Datum: 2026-07-16
Status: goedgekeurd

## Doel

Bij het maken van een rekening kan de beheerder kiezen uit drie betaalwijzen:
**Mollie**, **Pin** of **Contant**. De standaardbetaalwijze is een instelling
per tenant (default: Mollie). Bij Pin of Contant wordt de rekening meteen op
**Betaald** gezet en wordt geen Mollie-betaallink gemaakt; er kan direct een
betalingsbevestiging worden verstuurd. In het overzicht Rekeningen komt een
extra kolom Betaalwijze die ook in de CSV-download zit en waarop gefilterd kan
worden.

## Terminologie

Overal het woord **Betaalwijze** (kolomkop, instelling "Standaard betaalwijze",
keuzeveld "Betaalwijze"). De drie waarden worden intern lowercase opgeslagen
(`'mollie' | 'pin' | 'contant'`) en getoond met label **Mollie / Pin / Contant**.

## Datamodel

- `factuur.betaalwijze`: `'mollie' | 'pin' | 'contant'`. Vastgelegd bij het
  aanmaken in `maakFactuur`.
- `tenant.standaardBetaalwijze`: `'mollie' | 'pin' | 'contant'`, default
  `'mollie'`.

### Terugwaartse compatibiliteit

Bestaande rekeningen in de opslag hebben geen `betaalwijze`-veld. Ze worden
overal (lijst, kolom, filter, CSV) behandeld als **Mollie** via een leesmoment-
default `f.betaalwijze || 'mollie'`. Er worden geen opgeslagen records
herschreven. `maakFactuur` zonder `betaalwijze`-parameter valt terug op
`'mollie'` → status `'Open'`, zodat bestaand gedrag en bestaande tests
ongewijzigd blijven.

## Wijzigingen per bestand

### js/db.js

- `maakFactuur({ tenantCode, afspraakId, regels, betaalwijze })`:
  - `betaalwijze` normaliseren naar een van `mollie|pin|contant`; standaard
    `'mollie'`.
  - status: `pin`/`contant` → `'Betaald'`; `mollie` → `'Open'` (zoals nu).
  - `betaalwijze` op het factuur-object opslaan.
- Nieuwe setter `zetStandaardBetaalwijze(code, wijze)` (via `this.wijzig`).
- `crediteerFactuur`: de creditrekening neemt de `betaalwijze` van het origineel
  over (geen nieuwe keuze; puur voor consistente kolom/CSV/filter).

### js/beheer.js

**Opbouwscherm (`renderFactuurOpbouw`)**
- Extra keuzeveld `Betaalwijze` (id `opbouw-betaalwijze`), opties Mollie/Pin/
  Contant, voorgevuld met `huidigeTenant().standaardBetaalwijze || 'mollie'`.
- `knop-factureer`: gekozen betaalwijze meegeven aan `OberPoesDb.maakFactuur`.

**`toonMail(factuur)`** splitst op `factuur.betaalwijze`:
- **mollie** → huidige rekeningmail met Mollie-betaallink én rekening-pdf
  (`factuur.html?id=…`) als bijlage. Kop "Mail verzonden (demo)".
- **pin/contant** → betalingsbevestiging: sjabloon `'betaling'`
  (`Berichten.voor(t, 'betaling')`), onderwerp "Betaling ontvangen — rekening
  {nummer}", rekening-pdf als bijlage, **geen** Mollie-betaallink, plus een
  regel dat de rekening met pin/contant is voldaan. De rekening staat al op
  Betaald (via `maakFactuur`).

**Overzicht Rekeningen (`renderFacturen`)**
- Nieuwe kolom **Betaalwijze** in kop en rijen: volgorde
  Nummer · Datum · Klant · Bedrag · Status · **Betaalwijze** · acties.
  Waarde via labelmap op `f.betaalwijze || 'mollie'`.
- Nieuw filter **Filter op betaalwijze** (Alle / Mollie / Pin / Contant) naast
  het statusfilter; nieuwe state-variabele `facturenBetaalwijzeFilter`
  (default `'Alle'`), reset paginanummer bij wijziging. Werkt naast het
  bestaande statusfilter (beide tegelijk toepasbaar).
- CSV-download: extra kolom "Betaalwijze" (na "Status") met het label.
- Kleine labelhelper in beheer.js: `{ mollie:'Mollie', pin:'Pin', contant:'Contant' }`.
- De "Betaalpagina"-actielink blijft op alle rijen staan (voor pin/contant toont
  die vanzelf "betaald"); geen aparte logica nodig.

**Instellingen (profiel-view)**
- Nieuw veld **Standaard betaalwijze** (keuzelijst `standaard-betaalwijze` +
  knop `knop-betaalwijze-opslaan` + bevestigingsmelding), bij het Mollie-veld.
  Voorgevuld met `t.standaardBetaalwijze || 'mollie'`; opslaan via
  `OberPoesDb.zetStandaardBetaalwijze`.

### js/betaal.js / betaal.html

Geen wijziging. Pin/contant-rekeningen hebben status Betaald, dus de
betaalpagina toont via de bestaande logica "Deze rekening is betaald".

## Tests (js/tests.js + scripts/run-tests.mjs)

- `maakFactuur` met `betaalwijze: 'pin'` → status `'Betaald'` en veld opgeslagen.
- `maakFactuur` met `betaalwijze: 'contant'` → status `'Betaald'`.
- `maakFactuur` met `betaalwijze: 'mollie'` en zónder betaalwijze → status
  `'Open'` (terugwaartse compatibiliteit).
- `zetStandaardBetaalwijze` slaat de tenant-instelling op.
- Bestaande 68 tests blijven groen.

## Wat bewust NIET verandert

- Interne identifiers, methodenamen, element-ids en query-parameters die al
  `factuur`/`facturen` heten (bijv. `maakFactuur`, `betaal.html?factuur=`,
  `view-facturen`). Alleen zichtbare tekst en het nieuwe `betaalwijze`-concept
  worden toegevoegd.
- De Mollie-flow zelf (betaallink, betaalpagina) blijft ongewijzigd.
