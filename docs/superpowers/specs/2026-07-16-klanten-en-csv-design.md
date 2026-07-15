# PlanAndPay — Klanten-tabblad en CSV-downloads (ontwerp)

Datum: 2026-07-16
Status: goedgekeurd door gebruiker

## Doel

Een nieuw tabblad **Klanten** in het tenantbeheer dat de afspraken samenvat
per klant, en CSV-downloads voor de klanten-, afspraken- en facturenlijst.

## 1. Klanten samenvatten (pure functie)

`OberPoesDb.klantenVoor(tenantCode) → Klant[]` (of een pure helper op basis
van `afsprakenVoor`). Groeperen op **e-mailadres** (case-insensitief,
getrimd). Per e-mailadres:
- `email` — het (genormaliseerde) e-mailadres;
- `naam`, `straat`, `huisnummer`, `postcode`, `plaats`, `telefoon` — van de
  **laatste** afspraak (hoogste datum+tijd) met dat e-mailadres;
- `laatste` — datum van de laatste afspraak (`YYYY-MM-DD`);
- `aantal` — aantal afspraken met dat e-mailadres.

Afspraken zonder e-mailadres worden overgeslagen. Sortering: op `laatste`
aflopend (recentste klant boven).

## 2. Tabblad Klanten (js/beheer.js)

Menu: Agenda | Factuurregels | Facturen | Openingstijden | Berichten |
**Klanten** | Profiel. De view toont een tabel met kolommen: Naam, Adres
(straat huisnummer, postcode plaats), E-mail, Telefoon, Laatste afspraak,
Aantal. Zoekveld (naam/e-mail/plaats) en paginering via de bestaande
`Lijst.filterEnPagineer`. Lege staat: "Nog geen klanten." Knop **Download
CSV** boven de tabel.

## 3. CSV-module (js/csv.js, puur)

- `Csv.genereer(kolommen: string[], rijen: (string|number)[][]) → string` —
  puntkomma-gescheiden, waarden met `;`, `"`, of nieuwe regel worden tussen
  dubbele quotes gezet en interne quotes verdubbeld; regels met `\r\n`.
- `Csv.download(bestandsnaam, inhoud)` — voegt een UTF-8 **BOM** toe
  (`﻿`) en start een download via een `data:`- of Blob-URL. (Alleen in
  de browser; niet getest in Node.)

## 4. CSV-downloads koppelen

- **Klanten**: kolommen Naam, Straat, Huisnummer, Postcode, Plaats, E-mail,
  Telefoon, Laatste afspraak, Aantal afspraken. Bestand `klanten-<code>.csv`.
- **Afspraken** (bestaande lijst): knop **Download CSV**; kolommen Datum,
  Tijd, Naam, E-mail, Telefoon, Straat, Huisnummer, Postcode, Plaats, Extra,
  Gefactureerd (ja/nee). Bestand `afspraken-<code>.csv`.
- **Facturen** (bestaande lijst): knop **Download CSV**; kolommen Nummer,
  Datum, Klant, E-mail, Bedrag (incl. btw in euro's), Status, Credit voor.
  Bestand `facturen-<code>.csv`.

Alle drie de downloads exporteren de **volledige** lijst van de tenant
(niet alleen de gefilterde/gepagineerde weergave), zodat de export compleet
is. Bedragen als `12,34` (NL-notatie, komma).

## Testaanpak

Unit (Node + browser): `Csv.genereer` (escaping van `;`/quote/newline,
kopregel, lege lijst); klanten-samenvatting (groeperen op e-mail
case-insensitief, laatste naam/adres/telefoon bij meerdere afspraken,
aantal, sortering, afspraak zonder e-mail overgeslagen). `Csv.download`
wordt niet in Node getest (DOM/Blob).

End-to-end: Klanten-tab toont samengevatte rijen; twee afspraken met
hetzelfde e-mailadres maar verschillende naam/telefoon → één rij met de
laatste gegevens en aantal 2; zoeken/pagineren werkt; CSV-downloads bij
klanten, afspraken en facturen leveren een bestand met de juiste kop en
rijen (gecontroleerd via de gegenereerde CSV-string). Daarna commit + push.
