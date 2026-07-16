# PlanAndPay — Klanten sorteren en uitnodigen (ontwerp)

Datum: 2026-07-16
Status: goedgekeurd door gebruiker

## 1. Sorteerbare kolommen (Klanten-tabblad)

Klik op een kolomkop sorteert de klantenlijst; opnieuw klikken keert de
richting om. De actieve kop toont ▲ (oplopend) of ▼ (aflopend).

- Sorteerbare kolommen met bijbehorend veld: Naam (`naam`), Adres
  (`plaats` + straat als tiebreak), E-mail (`email`), Telefoon (`telefoon`),
  Laatste afspraak (`laatste`), Aantal (`aantal`).
- Tekstvelden: hoofdletterongevoelig via `localeCompare`. `aantal`
  numeriek. `laatste` als datumstring (`YYYY-MM-DD` sorteert correct).
- Standaard: `laatste` aflopend (zoals nu). Nieuwe kolom → oplopend; zelfde
  kolom → richting omdraaien.
- Sorteren gebeurt vóór zoeken/pagineren; de gekozen sortering blijft bij
  bladeren behouden. State in `js/beheer.js` (`klantenSortVeld`,
  `klantenSortOp`).

## 2. Klanten selecteren

- Checkbox-kolom vooraan; een selecteer-alles-checkbox in de kop selecteert/
  deselecteert alle klanten van de **volledige** lijst (niet alleen de
  huidige pagina). Geselecteerde e-mailadressen worden bijgehouden in een
  `Set` (`klantenSelectie`), die bij zoeken/sorteren/bladeren behouden blijft.
- Boven de tabel een knop **Uitnodiging sturen (n)** met het aantal
  geselecteerde klanten; uitgeschakeld als er niets is geselecteerd.

## 3. Nieuw berichttype 'uitnodiging'

- `Berichten.STANDAARD.uitnodiging` (NL) met placeholders `{naam}`,
  `{tenant}`, `{link}`:
  > Beste {naam},\n\nMaak eenvoudig online een afspraak bij {tenant} via
  > deze link: {link}\n\nTot ziens!\n{tenant}
- Toegevoegd aan `BERICHT_TYPES` in het Berichten-tabblad (bewerkbaar, met
  veldenlegenda `{naam} {tenant} {link}`), dus de tenant kan de tekst
  aanpassen; herstel-standaard blijft werken.

## 4. Uitnodiging versturen (gesimuleerd, per klant)

Bij **Uitnodiging sturen** verschijnt onder de tabel per geselecteerde klant
een aparte gesimuleerde mail:
- Aan: klant-e-mail; Onderwerp: "Uitnodiging om een afspraak te maken —
  {tenantnaam}";
- Body: `Berichten.voor(tenant, 'uitnodiging')` gerenderd met de klantnaam,
  tenantnaam en de boekingslink (`tenant.html?code=<code>`), waarbij `{link}`
  een klikbare `<a>` wordt.
Een korte kop "Uitnodigingen verzonden (demo) — n klant(en)" erboven, en een
knop **Sluiten** die de mailweergave weer verbergt.

## Verificatie

Bestaande tests blijven groen (65). Nieuwe unit-test: `Berichten.voor`
levert de standaard uitnodigingstekst en `render` vult `{link}` correct.
Browser: kolomkoppen sorteren op- en aflopend met pijltje; selecteer-alles
en losse selectie werken over zoeken/bladeren heen; "Uitnodiging sturen"
toont per geselecteerde klant een mail met juiste naam en werkende
boekingslink; uitnodiging is bewerkbaar op het Berichten-tabblad. Daarna
commit + push.
