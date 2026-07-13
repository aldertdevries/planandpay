# OberPoes — facturatie in het tenantbeheer (ontwerp)

Datum: 2026-07-13
Status: goedgekeurd door gebruiker
Bouwt voort op: `2026-07-13-tenantportalen-design.md`,
`2026-07-13-beheer-login-verificatie-design.md`

## Doel

Tenants kunnen afspraken factureren: factuurregels definiëren, per afspraak
een factuur opbouwen, de factuur (met logo en naam) als "PDF per mail" naar
de klant sturen met een Mollie-betaallink, en de betaalstatus volgen in een
filterbare facturenlijst. Gefactureerde afspraken zijn niet meer annuleerbaar.

## Demo-keuzes (statisch prototype, geen backend)

| Onderwerp | Keuze |
|---|---|
| PDF + mail | Printbare factuurpagina (`factuur.html?id=X`) met print-CSS; "mailen" is een gesimuleerde mailweergave (aan, onderwerp, tekst, betaallink, bijlagelink) |
| Mollie | Demo-betaalpagina (`betaal.html?factuur=X`) die een Mollie-checkout nabootst; knop Betalen zet de factuur op Betaald; het per tenant ingestelde Mollie API id wordt getoond/meegegeven |
| Factureerbaar | Alle nog niet gefactureerde afspraken (geen datumrestrictie) |
| Btw | hoog = 21%, laag = 9%; regelbedragen zijn **inclusief** btw |
| Bedragen | Opgeslagen in centen (integer), weergave als euro's |

## Datamodel

Tenant, nieuwe velden:

| Veld | Type | Toelichting |
|---|---|---|
| `factuurRegels` | array | Voorgedefinieerde regels `{id, naam, btw: 'hoog'\|'laag', bedragCent}` |
| `mollieApiId` | string | Instelbaar in beheer (Profiel), default leeg |

Nieuwe collectie `facturen` in `oberpoes_db`:

| Veld | Type | Toelichting |
|---|---|---|
| `id` | string | Uniek (bestaande generator) |
| `nummer` | string | Per tenant oplopend: `<jaar>-<4 cijfers>` (bijv. `2026-0001`) |
| `tenantCode` | string | |
| `afspraakId` | string | |
| `klantNaam` / `klantEmail` | string | Overgenomen van de afspraak |
| `regels` | array | `{naam, btw, bedragCent}` (kopie op factuur, los van voorgedefinieerd) |
| `status` | string | `Open` \| `Betaald` |
| `gemaaktOp` | string | ISO |

Afspraak krijgt `factuurId` zodra gefactureerd.

## Modules en functies

`js/facturatie.js` (puur, testbaar):
- `Facturatie.BTW = { hoog: 21, laag: 9 }`
- `Facturatie.totalen(regels) → { inclCent, btwHoogCent, btwLaagCent, exclCent }`
  (btw-deel per regel = bedragCent × pct / (100 + pct), per regel afgerond)
- `Facturatie.euro(cent) → '€ 12,34'` (nl-NL notatie)

`js/db.js`, nieuw:
- `zetFactuurRegels(code, regels) → Tenant|null`
- `zetMollieApiId(code, id) → Tenant|null`
- `maakFactuur({tenantCode, afspraakId, regels}) → Factuur|null` — `null` als
  afspraak onbekend of al gefactureerd; zet nummer (per tenant oplopend, jaar
  uit `gemaaktOp`), status `Open`, `factuurId` op de afspraak; klantgegevens
  komen uit de afspraak
- `facturenVoor(tenantCode) → Factuur[]` (case-insensitive)
- `vindFactuur(id) → Factuur|null`
- `zetFactuurStatus(id, status) → Factuur|null`
- `annuleerAfspraak(id)` → weigert (return `false`) als de afspraak een
  `factuurId` heeft
- Migratie: databases zonder `facturen`-veld worden bij lezen aangevuld
- `activeerTenant`: zet ook `factuurRegels: []` en `mollieApiId: ''` defaults
- Demo-data: actieve tenant krijgt 2 voorbeeld-factuurregels en een
  Mollie API id (`demo_mollie_123`)

## Tenantbeheer (js/beheer.js) — menu: Agenda | Factuurregels | Facturen | Openingstijden | Profiel

- **Factuurregels**: tabel (naam, btw, bedrag incl.) + formulier om toe te
  voegen (naam, btw-keuze hoog/laag, bedrag in euro's) + verwijderknop per
  regel. Validatie: naam ≥ 2 tekens, bedrag > 0.
- **Agenda**: per afspraak zonder `factuurId` knoppen **Factureren** en
  **Annuleren**; met `factuurId` een badge "Gefactureerd" (link naar
  `factuur.html?id=X`) en géén annuleerknop. Factureren opent een
  opbouwscherm onder de agenda:
  - checkbox per voorgedefinieerde regel;
  - ad-hoc regel toevoegen (naam, btw, bedrag) met vinkje "bewaar als
    voorgedefinieerde regel";
  - live totaaloverzicht (incl., btw hoog, btw laag);
  - knop **Factureren en mailen** (minimaal 1 regel vereist) → factuur
    aangemaakt → gesimuleerde mail in beeld: aan (klant-e-mail), onderwerp
    ("Factuur <nummer> van <tenantnaam>"), tekst met betaallink
    (`betaal.html?factuur=X`) en bijlage-link (`factuur.html?id=X`).
- **Facturen**: tabel (nummer, datum, klant, totaalbedrag, statusbadge
  Open=blauw / Betaald=groen, links Factuur en Betaalpagina), filter op
  status (Alle/Open/Betaald).
- **Profiel**: extra veld **Mollie API id** + opslaanknop.

## Factuurpagina (factuur.html + js/factuur.js)

`factuur.html?id=X`: logo (klein), tenantnaam, adres, KvK; factuurnummer,
datum, status; klantnaam/-e-mail; afspraakdatum en -tijd; regeltabel (naam,
btw-tarief, bedrag incl.); btw-uitsplitsing (excl., btw laag, btw hoog,
totaal incl.); knop "Opslaan als PDF (afdrukken)" die `window.print()`
aanroept; print-CSS verbergt knoppen. Voettekst "mogelijk gemaakt door
OberPoes". Onbekend id → "Deze pagina is niet beschikbaar".

## Demo-betaalpagina (betaal.html + js/betaal.js)

`betaal.html?factuur=X`: Mollie-achtige checkout: tenantnaam, omschrijving
("Factuur <nummer>"), totaalbedrag, demomelding met het ingestelde
Mollie API id van de tenant. Status Open → knop **Betalen** zet status op
`Betaald` en toont bevestiging; status Betaald → melding "Deze factuur is al
betaald." Onbekend id → "Deze pagina is niet beschikbaar".

## Testaanpak

Unit (bestaand harnas): totalen (alleen hoog, alleen laag, gemengd,
afronding op regelniveau), euro-notatie, `maakFactuur` (nummering 0001/0002
per tenant, klantgegevens uit afspraak, dubbel factureren → null),
`annuleerAfspraak` weigert gefactureerde afspraak, `facturenVoor` alleen
eigen tenant, `zetFactuurStatus`, `zetFactuurRegels`/`zetMollieApiId`,
migratie zonder `facturen`-veld, demo-data met regels.

End-to-end: factuurregel definiëren → afspraak factureren met mix van
voorgedefinieerde en nieuwe regel → mail-simulatie klopt → factuurpagina
toont logo/regels/btw → betaallink → Betalen → status Betaald in lijst →
filter Open/Betaald → gefactureerde afspraak heeft geen annuleerknop en
db-weigering blijft staan.
