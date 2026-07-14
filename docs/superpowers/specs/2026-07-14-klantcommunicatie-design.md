# KassaGenda — klantcommunicatie-uitbreiding (ontwerp)

Datum: 2026-07-14
Status: goedgekeurd door gebruiker

## Scope

1. ics-agendabijlage bij bevestiging van nieuwe én verzette afspraken
2. Kopieerbare QR-code in het tenantprofiel naar het klantenportaal
3. Bevestigingsmail naar de klant bij ontvangen betaling
4. Door de tenant instelbare teksten voor alle klantberichten
5. Zakelijkere factuurlayout + instelbare factuurtekst (profiel)

Alles binnen het statische prototype; mails gesimuleerd zoals bestaand.

## 1. Agenda-bijlage (js/kalender.js, puur)

- `Kalender.ics({ titel, locatie, omschrijving, datum, tijd, duurMinuten, uid })
  → string` — geldige VCALENDAR/VEVENT met CRLF-regeleinden, `DTSTART`/
  `DTEND` als lokale tijd (`YYYYMMDDTHHMMSS`), eindtijd = start + duur
  (klopt over uur-/daggrens), `SUMMARY`, `LOCATION`, `DESCRIPTION`, `UID`.
- `Kalender.icsDataUrl(inhoud) → 'data:text/calendar;charset=utf-8,...'`.
- Gebruik: bijlage-link `📅 afspraak.ics` (met `download`-attribuut) in de
  boekingsbevestiging (tenant.html) en in het nieuwe verzetbericht
  (afspraak.html). Duur = slotDuur van de tenant; uid = afspraak.id.

## 2. QR-code in profiel

- Profiel-tabblad toont onder de boekingslink een QR-afbeelding via
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=<url>`
  (gratis, geen key — zelfde externe-API-patroon als PDOK).
- Knoppen: **Kopieer QR** (afbeelding → canvas → klembord via
  `ClipboardItem`; bij mislukken nette foutmelding) en **Download QR**
  (canvas → png-download `boekingslink-qr.png`).
- `onerror` op de afbeelding → melding "QR-service niet bereikbaar" met de
  kale link als terugvaloptie; alt-tekst "QR-code naar uw boekingspagina".

## 3. Betalingsbevestiging (betaal.html/js)

Na klik op Betalen verschijnt onder de checkout een gesimuleerde mail:
Aan = klantEmail, Onderwerp = "Betaling ontvangen — factuur {nummer}",
body = berichtsjabloon `betaling` (zie 4) met `{bedrag}` en `{nummer}`.

## 4. Instelbare berichtteksten (js/berichten.js, puur)

- `Berichten.STANDAARD` — vier sjablonen (NL) met placeholders:
  - `boeking`: {naam}, {tenant}, {datum}, {tijd}
  - `verzet`: {naam}, {tenant}, {datum}, {tijd}
  - `factuur`: {naam}, {tenant}, {nummer}, {bedrag}
  - `betaling`: {naam}, {tenant}, {nummer}, {bedrag}
- `Berichten.render(sjabloon, data) → string` — vervangt `{sleutel}`;
  onbekende placeholders blijven letterlijk staan.
- `Berichten.voor(tenant, type) → string` — tenant-eigen tekst of standaard.
- Tenantveld `berichten` (object, per type optioneel); db-setter
  `zetBerichten(code, berichten)`.
- Nieuw beheer-tabblad **Berichten** (menu: Agenda | Factuurregels |
  Facturen | Openingstijden | Berichten | Profiel): per type een textarea
  met legenda van beschikbare placeholders, één opslaanknop, en
  "Herstel standaardteksten" (wist de tenant-teksten).
- Alle vier de mail-simulaties renderen voortaan het sjabloon (regeleinden
  → `<br>`); onderwerpen en bijlage-links blijven vaste onderdelen buiten
  het sjabloon.

## 5. Zakelijke factuur + instelbare factuurtekst

- factuur.html/js formeler: kop "FACTUUR"; gegevensblok met factuurnummer,
  factuurdatum, vervaldatum (= factuurdatum + 14 dagen), betalingskenmerk
  (factuurnummer); blok "Factuur aan" met klantgegevens; kleiner logo
  (56px); strakke horizontale lijnen, geen kaart-schaduw in print;
  "Creditfactuur voor {nummer}" indien `creditVoor`; statusregel.
- Onderaan de instelbare **factuurtekst**: tenantveld `factuurVoettekst`,
  default "Gelieve het bedrag binnen 14 dagen over te maken onder
  vermelding van het factuurnummer." Instelbaar via textarea op het
  Profiel-tabblad; db-setter via bestaand `wijzig` (`zetFactuurVoettekst`).

## Testaanpak

Unit: `Kalender.ics` (DTEND over uurgrens, verplichte velden, CRLF, uid),
`Berichten.render` (vervangen, onbekend blijft staan) en `Berichten.voor`
(tenant-tekst wint, anders standaard), `zetBerichten`/`zetFactuurVoettekst`.
End-to-end: boeken → mail met eigen tekst + werkende ics-link; verzetten →
verzetmail + ics; betalen → betalingsmail; teksten wijzigen + herstellen;
QR zichtbaar, kopieer-/downloadknoppen aanwezig; factuur toont zakelijk
format met vervaldatum en eigen voettekst. Na verificatie push naar GitHub.
