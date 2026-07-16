# PlanAndPay — beheerder voegt handmatig klanten toe (ontwerp)

Datum: 2026-07-16
Status: goedgekeurd door gebruiker

## Doel

In het Klanten-tabblad kan de beheerder handmatig een nieuwe klant
toevoegen. Deze klanten worden apart opgeslagen en samengevoegd met de
klanten die uit afspraken worden afgeleid.

## Opslag (js/db.js)

Nieuwe collectie `klanten` in `oberpoes_db` (naast `afspraken`/`facturen`),
migratie: bij lezen aanvullen als het veld ontbreekt.

Klant-record: `{ id, tenantCode, naam, email, telefoon, straat, huisnummer,
postcode, plaats, aangemaaktOp }`.

Nieuwe functies:
- `voegKlantToe({tenantCode, naam, email, telefoon, straat, huisnummer,
  postcode, plaats}) → Klant` — **upsert op e-mail** (case-insensitief per
  tenant): bestaat er al een handmatige klant met dat e-mailadres, dan wordt
  die bijgewerkt in plaats van gedupliceerd.
- `handmatigeKlantenVoor(tenantCode) → Klant[]`.

## Samenvoegen (klantenVoor)

`klantenVoor(tenantCode)` bouwt de map nu op als volgt:
1. Start met de handmatige klanten (per genormaliseerd e-mailadres):
   `aantal: 0`, `laatste: ''`, met hun ingevoerde naam/adres/telefoon.
2. Loop daarna door de afspraken (oud → nieuw) zoals nu: overschrijf
   naam/adres/telefoon met de **laatste** afspraakgegevens en tel `aantal`
   op; zet `laatste` op de afspraakdatum.

Zo verschijnt een handmatige klant zonder afspraken met `aantal 0` en een
lege laatste-datum; heeft de klant (later) afspraken op hetzelfde
e-mailadres, dan winnen de recentste afspraakgegevens en telt `aantal` mee.
Sortering blijft op `laatste` aflopend (lege datum onderaan). In de tabel
wordt een lege laatste-datum als "—" getoond en blijft die zonder JS-fout.

## UI (js/beheer.js, Klanten-tab)

- Knop **Klant toevoegen** boven de tabel opent een formulierkaart onder de
  lijst (`#klant-formulier`): Naam*, E-mailadres*, Telefoon, Postcode,
  Huisnummer, Straat (readonly), Plaats (readonly). Postcode + huisnummer
  vullen via de bestaande **Adres**-helper (PDOK) automatisch straat/plaats;
  adres is optioneel. Validatie: naam ≥ 2 tekens, geldig e-mailformaat
  (`Validatie.email`). Knoppen **Opslaan** en **Annuleren**.
- Opslaan → `voegKlantToe(...)`, formulier sluit, lijst ververst, de nieuwe/
  bijgewerkte klant is zichtbaar. Bestaat de e-mail al (afspraak of eerdere
  invoer) → samengevoegd, geen duplicaat.
- `beheer.html` laadt voortaan ook `js/adres.js` (voor de PDOK-lookup).

## Verificatie

Unit (Node + browser): `voegKlantToe` (opslaan, upsert op e-mail
case-insensitief); `klantenVoor` toont handmatige klant met `aantal 0` en
lege laatste; handmatige klant + latere afspraak op zelfde e-mail → één rij,
recentste gegevens, `aantal` telt. Bestaande tests blijven groen.

End-to-end: Klant toevoegen met naam+e-mail (en PDOK-adres) → verschijnt in
de lijst met aantal 0; klant is te selecteren en uit te nodigen en komt in
de CSV; een afspraak op dat e-mailadres voegt samen tot één rij. Daarna
commit + push.
