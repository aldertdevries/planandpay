# Ontwerp: Rekening als betaald markeren + betaald-status in het afsprakenoverzicht

Datum: 2026-07-17
Status: goedgekeurd

## Doel

1. Een nog niet betaalde rekening met betaalwijze **Mollie** kan in het
   rekeningenoverzicht als betaald worden gemarkeerd met **pin** of
   **contant** — bijvoorbeeld omdat de klant toch aan de balie afrekende.
2. In het afsprakenoverzicht toont de badge **"Betaald"** zodra de gekoppelde
   rekening betaald is; anders blijft het **"Op rekening"**.

## Afgestemde keuzes

- Bij het markeren verandert de **betaalwijze mee** naar pin of contant, zodat
  kolom, filter en CSV de werkelijke betaalvorm tonen.
- Bediening: **twee kleine knoppen** per open Mollie-rij — "Betaald (pin)" en
  "Betaald (contant)" — elk met een bevestigingsvraag.
- Na het markeren verschijnt een **demo-betalingsbevestiging** (sjabloon
  `betaling`) boven de lijst, consistent met de andere betaalflows.

## Wijzigingen per bestand

### js/db.js

Nieuwe functie `markeerBetaald(id, betaalwijze)`:

- Alleen geldig als de rekening bestaat en status `'Open'` heeft; anders `null`.
- `betaalwijze` moet `'pin'` of `'contant'` zijn; andere waarden → `null`
  (dit is een expliciete actie, geen default naar mollie).
- Zet `status = 'Betaald'` en `betaalwijze` op de gekozen waarde, schrijft de
  database en geeft de bijgewerkte rekening terug.
- Plaatsing: bij de andere factuur-functies, direct ná `zetFactuurStatus`.

### js/beheer.js — rekeningenoverzicht (`renderFacturen`)

- Bij rijen met status `'Open'` én betaalwijze mollie
  (`(f.betaalwijze || 'mollie') === 'mollie'`): twee extra knoppen
  `Betaald (pin)` en `Betaald (contant)` (klasse `knop knop-secundair
  knop-klein`, data-attributen met factuur-id en wijze).
- Klik → `confirm('Weet u zeker dat u deze rekening als betaald (pin) wilt
  markeren?')` (of `(contant)`), dan `OberPoesDb.markeerBetaald(id, wijze)`.
- Na succes: de demo-betalingsbevestiging opslaan in een module-variabele
  (bijv. `facturenMailHtml`) en `renderFacturen()` opnieuw aanroepen. De
  view-template rendert die variabele als meldingskaart boven de lijst:
  Aan {klantEmail}, Onderwerp "Betaling ontvangen — rekening {nummer}",
  inhoud via `Berichten.voor(t, 'betaling')` met `{naam, tenant, nummer,
  bedrag}`, plus een sluitknop die de variabele leegt en opnieuw rendert.
- Een rekening die bij aanmaken al pin/contant was staat al op Betaald; de
  knoppen verschijnen daar dus nooit.

### js/beheer.js — afsprakenoverzicht (agenda-lijst, `renderAgenda`)

- De bestaande badge voor gefactureerde afspraken kijkt nu naar de status van
  de gekoppelde rekening via `OberPoesDb.vindFactuur(a.factuurId)`:
  - status `'Betaald'` → badge **"Betaald"** met klasse `badge-actief` (groen);
  - anders → badge **"Op rekening"** met klasse `badge-aangevraagd` (zelfde
    kleur als status Open in het rekeningenoverzicht, voor consistent
    kleurgebruik; dit was `badge-actief`).
- De badge blijft een link naar `factuur.html?id=...`.

## Wat bewust NIET verandert

- Crediteren- en vervallen-acties, de betaalpagina en `zetFactuurStatus`
  blijven ongewijzigd.
- De afspraken-CSV (kolom "Op rekening" met ja/nee) blijft ongewijzigd.
- Interne identifiers/ids/query-params blijven ongewijzigd.

## Tests (js/tests.js)

- `markeerBetaald`: Open+pin → Betaald/pin; Open+contant → Betaald/contant;
  rekening die al Betaald is → `null` (status blijft); ongeldige wijze
  (bijv. 'mollie' of 'onzin') → `null`. (75 → 77 tests, twee testfuncties.)
- Browser-e2e: open Mollie-rekening → "Betaald (pin)" → bevestigingsvraag →
  demo-mail boven de lijst, rij toont Betaald + Pin; agenda-badge van de
  gekoppelde afspraak toont "Betaald"; een andere, nog open rekening houdt
  badge "Op rekening"; filter op betaalwijze Pin vindt de gemarkeerde
  rekening.
