# OberPoes — verbeterronde (ontwerp)

Datum: 2026-07-13
Status: goedgekeurd door gebruiker
Bouwt voort op alle eerdere specs in deze map.

## Scope

Zeven onderdelen binnen het bestaande statische prototype (mail/betaling
gesimuleerd, localStorage-database):

1. Klant: bevestigingsmail + herinneringsvermelding + zelf annuleren/verzetten
2. Weekkalender in beheer-agenda + capaciteit per slot
3. Meerdaagse blokkades
4. Facturen crediteren/vervallen + instelbare nummerreeks
5. Zoeken en pagineren in lijsten
6. Hoofdadmin dashboard + notificaties
7. Toegankelijkheid

## 1. Klantcommunicatie

- Na geslaagde boeking toont `tenant.html` naast de bevestiging een
  gesimuleerde **bevestigingsmail**: aan (klant-e-mail), onderwerp
  "Afspraakbevestiging — <tenantnaam>", tekst met datum/tijd/locatie, de zin
  "24 uur voor uw afspraak ontvangt u een herinnering per e-mail"
  (gesimuleerd) en een beheerlink `afspraak.html?id=<afspraakId>`.
- Nieuwe pagina **afspraak.html + js/afspraak.js** (kale opmaak, zelfde stijl
  als tenant.html): toont afspraak (tenantnaam/logo, datum, tijd, adres) en
  twee acties:
  - **Annuleren** — alleen als niet gefactureerd; via `annuleerAfspraak`;
    daarna bevestiging "Uw afspraak is geannuleerd."
  - **Verzetten** — alleen als niet gefactureerd; toont dag-/slotkeuze
    (zelfde logica en uitsluitingen als boeken: openingstijden, blokkades,
    capaciteit) en bevestigt met nieuwe datum/tijd.
  - Gefactureerde afspraak → melding "Neem contact op met <tenantnaam>
    (<e-mail>)"; onbekend id → "Deze pagina is niet beschikbaar".
- Nieuwe db-functie: `verzetAfspraak(id, datum, tijd) → Afspraak|null` —
  `null` bij onbekend id, gefactureerde afspraak of vol slot (capaciteit).

## 2. Weekkalender + capaciteit

- Tenant-instelling `capaciteit` (integer 1–5, default 1), instelbaar op het
  Openingstijden-tabblad naast slotduur; `zetOpeningstijden(code,
  openingstijden, slotDuur, capaciteit)`.
- `Agenda.sloten(...)` krijgt zesde parameter `capaciteit = 1`: een slot is
  vrij zolang (aantal afspraken op datum+tijd) < capaciteit én geen blokkade.
- `maakAfspraak` en `verzetAfspraak` gebruiken dezelfde telling (capaciteit
  van de tenant uit de database, default 1).
- Beheer-agenda krijgt toggle **Lijst | Week**:
  - Weekweergave: kolommen ma–zo met datum, rijen alle tijden (op basis van
    vroegste `van` en laatste `tot` van open dagen, stap = slotDuur), cellen
    tonen klantnamen (meerdere bij capaciteit > 1), blokkade-cellen grijs met
    omschrijving, dichte dagen volledig grijs.
  - Navigatie: ← vorige week / vandaag / volgende week →. Nieuwe pure helper
    `Agenda.maandagVan(datumIso) → 'YYYY-MM-DD'`.

## 3. Meerdaagse blokkades

- Eenmalige blokkade krijgt optioneel veld `datumTot` (default = `datum`).
- Toepasselijk op datum D als `datum <= D <= (datumTot || datum)`.
- Verlopen als `(datumTot || datum) < vandaag` (actieveBlokkades).
- UI: extra datumveld "t/m (optioneel)" bij type eenmalig; weergave
  "14-7-2026 t/m 18-7-2026 09:00–17:00" (t/m weggelaten als gelijk aan
  startdatum). Validatie: datumTot ≥ datum.

## 4. Facturen: crediteren, vervallen, nummerreeks

- Statussen: `Open`, `Betaald`, `Gecrediteerd`, `Vervallen`, `Credit`.
- `laatVervallen(id) → Factuur|null` — alleen vanuit `Open`.
- `crediteerFactuur(id) → Factuur|null` — alleen vanuit `Open` of `Betaald`:
  maakt creditfactuur (kopie regels met genegeerde `bedragCent` × −1, eigen
  nummer uit de reeks, status `Credit`, veld `creditVoor: <origineel
  nummer>`), zet origineel op `Gecrediteerd` en verwijdert `factuurId` van de
  afspraak (weer factureerbaar/annuleerbaar/verzetbaar).
- Nummerreeks: tenantveld `factuurReeks = { prefix, volgende }`; default bij
  eerste gebruik `{ prefix: <huidig jaar>, volgende: <aantal bestaande
  facturen van de tenant> + 1 }`. `maakFactuur` (en crediteren) gebruikt en
  verhoogt de reeks. Instelbaar op Profiel-tabblad (prefix-tekst +
  volgnummer, validatie: volgnummer ≥ 1). `zetFactuurReeks(code, prefix,
  volgende)`.
- Facturenlijst: filter krijgt alle statussen; per rij knoppen **Crediteren**
  (Open/Betaald) en **Vervallen** (Open); Credit-facturen tonen "credit voor
  <nummer>". Badges: Open=blauw, Betaald=groen, Vervallen=grijs,
  Gecrediteerd=rood, Credit=grijs.
- Betaalpagina: alleen `Open` is betaalbaar; andere statussen tonen een
  passende melding.
- `Facturatie.totalen` werkt ongewijzigd met negatieve bedragen.

## 5. Zoeken en pagineren

- Nieuwe pure module **js/lijst.js**:
  `Lijst.filterEnPagineer(items, zoekterm, velden, pagina, perPagina = 10) →
  { items, totaal, paginas, pagina }` — case-insensitieve substring-match op
  de opgegeven velden; pagina wordt geklemd op [1, paginas].
- Toegepast op: hoofdadmin **Tenants** (naam/code/plaats), beheer
  **Facturen** (nummer/klantNaam), beheer **Agenda-lijst** (naam/datum).
  UI: zoekveld boven de tabel, onder de tabel "‹ Vorige — pagina x van y —
  Volgende ›".

## 6. Hoofdadmin: dashboard + notificaties

- Nieuw menu-item **Dashboard**, openingsscherm na inloggen: tegels met
  aantal tenants per status (4×), totaal afspraken, totaal facturen met
  open/betaald-verdeling.
- Postvak-blok (gesimuleerde e-mailnotificaties): per tenant met status
  `Aangevraagd` een regel "📧 Nieuwe aanvraag van <naam> — <datum>" met link
  naar Aanvragen.
- Menu-item Aanvragen toont badge met aantal openstaande aanvragen; wordt
  ververst bij elke view-wissel.

## 7. Toegankelijkheid

- CSS: `:focus-visible`-outline (2px accentkleur) op `.knop`, links en
  formuliervelden; gedempte tekstkleuren opgehoogd naar minimaal ~4.5:1
  (o.a. `.site-footer`, kleine grijze teksten op betaal-/factuurpagina);
  `@media (prefers-reduced-motion: reduce)` schakelt smooth scroll uit.
- Markup: `aria-current="page"` op actieve menu-items (statisch én in de
  JS-menu's), `aria-live="polite"` op foutmeldingcontainers en
  `role="status"` op succes-/infomeldingen die dynamisch verschijnen,
  `scope="col"` op tabelkoppen in de templates.

## Testaanpak

Unit (bestaand harnas): capaciteit in `sloten` en `maakAfspraak`;
`verzetAfspraak` (slaagt / vol slot / gefactureerd / onbekend); meerdaagse
blokkade binnen/buiten periode en verlopen-filter op `datumTot`;
`maandagVan`; nummerreeks (default-afleiding, doortellen, instelbaar);
`crediteerFactuur` (negatieve regels, statusovergangen, afspraak
vrijgegeven, reeksnummer); `laatVervallen` (alleen Open);
`Lijst.filterEnPagineer` (zoeken, klemmen, paginering).

End-to-end per onderdeel in de browser, inclusief: boeken → bevestigingsmail
→ verzetten via klantlink → vol slot geweigerd; weekweergave toont afspraken
en blokkades; capaciteit 2 staat dubbele boeking toe; crediteren geeft
afspraak vrij; zoeken/pagineren; dashboardcijfers kloppen; focus zichtbaar
met toetsenbord.
