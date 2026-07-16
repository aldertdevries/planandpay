# Ontwerp: Uitnodigings-prefill op de boekingspagina

Datum: 2026-07-16
Status: goedgekeurd

## Doel

Wie via een uitnodigingsmail een afspraak komt maken, is al bekend bij het
bedrijf. De uitnodigingslink wordt daarom persoonlijk: de boekingspagina vult
naam, e-mailadres, telefoonnummer en adres alvast in. De klant hoeft alleen een
dag en tijd te kiezen en te controleren of de gegevens nog kloppen. Alle velden
blijven aanpasbaar.

## Afgestemde keuzes

- Velden **vooringevuld maar aanpasbaar**, met de melding
  "Uw gegevens zijn alvast ingevuld — klopt alles nog?".
- **Opaak token** in de link, géén e-mailadres of andere persoonsgegevens in de
  URL (die belandt in browsergeschiedenis en logs).
- Gekozen aanpak: **klant-id als token** — bij het versturen van uitnodigingen
  wordt elke gekozen klant ge-upsert via het bestaande `voegKlantToe`, dat elk
  record een willekeurige id geeft (`genereerCode()`). Geen nieuw dataveld.

## Linkformaat

`tenant.html?code=<TENANTCODE>&klant=<KLANT_ID>`

De bestaande `code`-parameter blijft leidend voor welke tenant getoond wordt;
`klant` is optioneel en alleen een prefill-hint.

## Wijzigingen per bestand

### js/db.js

- Nieuwe functie `vindKlant(id)`: zoekt in `db.klanten` op `id`; geeft het
  klantrecord of `null`. Geen datamodel-wijziging.

### js/beheer.js — `toonUitnodigingen`

- Per gekozen klant (uit de samengevoegde `klantenVoor`-lijst) eerst
  `OberPoesDb.voegKlantToe({ tenantCode, naam, email, telefoon, straat,
  huisnummer, postcode, plaats })` aanroepen. Dit is een upsert op e-mail:
  bestaande handmatige klanten behouden hun id, afspraak-afgeleide klanten
  krijgen er een.
- De link in de uitnodigingsmail wordt per klant persoonlijk:
  `tenant.html?code=<CODE>&klant=<id>` (in plaats van de huidige generieke
  boekingslink voor iedereen).

### js/tenant.js — boekingspagina

- Leest `klant` uit de URL-parameters. Zo ja: `OberPoesDb.vindKlant(id)` en
  controle dat `klant.tenantCode` (hoofdletterongevoelig) overeenkomt met de
  getoonde tenant. Onbekend token of andere tenant → **stille terugval** naar
  het normale lege formulier; geen foutmelding.
- Bij een geldige klant, direct bij het laden van de pagina:
  - Velden `naam`, `email`, `telefoon`, `postcode`, `huisnummer` voorinvullen —
    alleen met niet-lege waarden.
  - Velden `straat` en `plaats` (readonly weergavevelden) vullen én de interne
    variabele `adres = { straat, plaats }` zetten met de opgeslagen gegevens,
    zodat het formulier verzendbaar is zonder nieuwe PDOK-lookup. Dit alleen
    doen als straat én plaats beide gevuld zijn; anders blijft `adres = null`
    en werkt de bestaande PDOK-flow.
  - Past de bezoeker postcode of huisnummer aan, dan doet de bestaande
    `Adres.bind` opnieuw de lookup en overschrijft straat/plaats/`adres`.
  - In `stap-gegevens`, boven het formulier, een info-melding tonen:
    "Uw gegevens zijn alvast ingevuld — klopt alles nog?" (nieuw element in
    tenant.html, standaard verborgen).
- De bestaande validatie bij verzenden blijft volledig ongewijzigd; een
  ontbrekend deelveld (bijv. geen telefoon) blijft leeg en wordt door de
  validatie afgevangen.

### tenant.html

- Eén nieuw, standaard verborgen meldingselement in `stap-gegevens` voor de
  prefill-melding (`melding melding-info`, `role="status"`).

## Demo-kanttekening

Alles staat in localStorage van dezelfde browser; de persoonlijke link werkt
dus zolang die in dezelfde browser wordt geopend — consistent met de rest van
de mailsimulatie.

## Tests (js/tests.js)

- `vindKlant`: vindt een via `voegKlantToe` aangemaakte klant op id; geeft
  `null` bij een onbekende id.
- De prefill zelf is UI: browserverificatie — uitnodiging versturen, de
  persoonlijke link uit de mail volgen, controleren dat de velden gevuld zijn
  en de melding zichtbaar is, en de boeking afronden zonder de adresvelden aan
  te raken (bewijst dat `adres` correct gezet is). Ook: link met onzin-token →
  leeg formulier zonder melding.

## Wat bewust NIET verandert

- Geen persoonsgegevens in de URL; alleen de opake klant-id.
- Geen nieuw tokenveld in het datamodel.
- Validatie, PDOK-flow en het boekingsproces zelf blijven ongewijzigd.
- Interne identifiers/bestandsnamen blijven ongewijzigd.
