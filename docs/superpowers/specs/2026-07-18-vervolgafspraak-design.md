# Ontwerp: Vervolgafspraak inplannen na het maken van een rekening

Datum: 2026-07-18
Status: goedgekeurd

## Doel

Na het maken van een rekening is hét moment om een vervolgafspraak te maken
(bijv. "over 6 weken weer"). De beheerder vult een termijn in (getal +
dagen/weken/maanden), ziet open dagen rond de berekende doeldatum en legt
handmatig een nieuwe afspraak vast. De klant krijgt daarover een
boekingsbevestiging. De gekozen termijn wordt per klant onthouden en de
volgende keer voorgevuld.

Harde regels:
- De nieuwe afspraak kan **nooit vandaag** zijn — altijd in de toekomst
  (het dagvenster begint op z'n vroegst morgen).
- Afspraken over **weken of maanden** vooruit moeten haalbaar zijn (het
  dagvenster is verplaatsbaar met eerder/later-navigatie).

## Afgestemde keuzes

- Termijnvorm: **één getal + eenheid** (`dagen` / `weken` / `maanden`).
- Startpunt: de termijn telt vanaf de **datum van de afspraak** waarvoor de
  rekening net is gemaakt.
- Nog geen termijn bekend voor de klant → veld **leeg**, bewust invullen;
  daarna onthouden.
- Mail: de bestaande **boekingsbevestiging** (sjabloon `boeking`) met
  agenda-bestand (ics) en verzet/annuleer-link — identiek aan zelf boeken.

## Wijzigingen per bestand

### js/agenda.js

Nieuwe pure functie `datumPlus(datumIso, aantal, eenheid)`:

- `eenheid` is `'dagen'`, `'weken'` of `'maanden'`.
- dagen: `setDate(+aantal)`; weken: `setDate(+aantal*7)`; maanden:
  `setMonth(+aantal)` (natuurlijk JS-gedrag; 31 januari + 1 maand kan in
  maart uitkomen — acceptabel omdat de beheerder toch handmatig een dag in
  de buurt kiest).
- Geeft een ISO-datum (`YYYY-MM-DD`) terug. Rekent met `T12:00:00` zoals de
  rest van de module (geen tijdzone-randgevallen).

### js/db.js

Nieuwe setter `zetKlantVervolgTermijn(klantId, termijn)`:

- `termijn = { aantal, eenheid }`; geldig alleen als `aantal` een geheel
  getal ≥ 1 is en `eenheid` een van `dagen|weken|maanden`; anders `null` en
  niets wijzigen.
- Zoekt het klantrecord op id (zoals `vindKlant`), zet `vervolgTermijn`,
  schrijft en geeft het record terug; onbekende id → `null`.

### js/beheer.js — vervolgblok in `toonMail`

Onder de demo-mailkaart (beide varianten: mollie én pin/contant) komt een
blok **"Vervolgafspraak inplannen"**:

1. **Termijnstap**: invoerveld aantal (`type="number"`, min 1) + keuzelijst
   eenheid (dagen/weken/maanden) + knop "Zoek dagen". Voorvullen: de klant
   wordt bij het openen van het blok opgezocht/ge-upsert via
   `voegKlantToe` met de gegevens van de originele afspraak (zelfde patroon
   als de uitnodigingen); heeft het record een `vervolgTermijn`, dan staan
   aantal en eenheid voorgevuld.
2. **Dagstap**: doeldatum = `Agenda.datumPlus(afspraak.datum, aantal,
   eenheid)`. Het dagvenster toont de open dagen uit een venster van 14
   kalenderdagen dat begint op `venterStart = max(morgen, doeldatum - 3
   dagen)` via het bestaande `Agenda.komendeOpenDagen(openingstijden,
   vanafIso, 14)`. Boven de dagen staat de doeldatum vermeld ("Rond
   <datum>"). Knoppen **‹ eerder** en **later ›** schuiven het venster 14
   dagen op; "eerder" nooit vóór morgen (knop disabled zodra het venster op
   morgen begint).
3. **Tijdstap**: dag kiezen → vrije tijdsloten via het bestaande
   `Agenda.sloten(...)` met capaciteit en blokkades (zoals tenant.js);
   bezette sloten disabled.
4. **Vastleggen**: knop "Afspraak vastleggen en mailen" →
   `OberPoesDb.maakAfspraak` met de klantgegevens van de originele afspraak
   (naam, email, telefoon, straat, huisnummer, postcode, plaats; `extra`
   leeg). Slot net bezet (`null`) → melding "Deze tijd is net bezet. Kies
   een andere tijd." en tijden verversen. Bij succes:
   - termijn opslaan: `zetKlantVervolgTermijn(klant.id, { aantal, eenheid })`;
   - demo-boekingsbevestiging tonen (zoals tenant.js): sjabloon `boeking`
     met `{naam, tenant, datum, tijd}`, verzetlink `afspraak.html?id=...`
     en ics-bijlage via `Kalender.ics`/`Kalender.icsDataUrl`;
   - agenda-lijst ververst mee (`renderAgenda()` wordt al aangeroepen in de
     bestaande flow; zo nodig nogmaals).

De hulpberekening van de venterstart komt als pure functie in beheer.js of
agenda.js zodat "nooit vóór morgen" testbaar is: in agenda.js
`vensterStart(doeldatumIso, vandaagIso)` → `max(vandaag + 1 dag,
doeldatum - 3 dagen)` (ISO-stringvergelijking volstaat).

## Randgevallen

- Doeldatum vandaag of in het verleden (korte termijn na een oude
  afspraak) → venster begint gewoon morgen.
- Termijnveld leeg of 0/negatief → foutmelding "Vul een termijn in (getal
  van minimaal 1)." en geen dagstap.
- Geen open dagen in het venster (vakantieblokkade) → melding "Geen open
  dagen in deze periode." + navigatieknoppen blijven werken.
- Het blok is optioneel: sluiten van de mailkaart sluit ook het vervolgblok.

## Tests (js/tests.js)

- `datumPlus`: +10 dagen, +6 weken, +3 maanden, maand-overloop (2026-01-31 +
  1 maand → 2026-03-03: setMonth-overloop, februari 2026 heeft 28 dagen),
  jaargrens.
- `vensterStart`: doeldatum ver vooruit → doeldatum − 3 dagen; doeldatum
  vandaag/verleden → morgen; doeldatum morgen of overmorgen → morgen.
- `zetKlantVervolgTermijn`: opslaan en teruglezen; ongeldige eenheid of
  aantal < 1 → `null` en record onveranderd; onbekende id → `null`.
- (77 → 80 tests, drie testfuncties.)
- Browser-e2e: rekening maken → vervolgblok → termijn 6 weken → doeldatum
  klopt, dagen rond doeldatum, later ›/‹ eerder werken, eerder stopt bij
  morgen → dag + tijd kiezen → afspraak bestaat, boekingsmail met ics en
  verzetlink zichtbaar → tweede rekening voor dezelfde klant → termijn
  voorgevuld. Kort geval: termijn 1 dag na een afspraak van gisteren →
  venster begint morgen.

## Wat bewust NIET verandert

- De boekingspagina, de rekeningflow zelf, sjablonen en de agenda-views.
- Geen automatische afspraak — de beheerder kiest altijd handmatig dag en
  tijd ("in de buurt van" de doeldatum).
- Interne identifiers blijven ongewijzigd.
