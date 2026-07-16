# Ontwerp: Klant-aanmelding op de boekingspagina

Datum: 2026-07-16
Status: goedgekeurd

## Doel

Een klant die al eerder een afspraak maakte (of als klant is toegevoegd) kan
zich op de boekingspagina aanmelden met e-mail- of sms-verificatie. Na een
juiste code worden zijn gegevens alvast ingevuld, zodat hij ze niet opnieuw
hoeft in te typen. De klant is daarmee in feite geverifieerd: de code ging
naar het kanaal dat hij zelf opgaf.

## Afgestemde keuzes

- Plek: in de stap **Uw gegevens** (na het kiezen van dag en tijd), boven het
  formulier.
- Onbekend contact → duidelijke melding: "Wij kennen dit e-mailadres (of
  telefoonnummer) nog niet. Vul uw gegevens gewoon hieronder in."
- Alleen voor deze paginaweergave; geen klantsessie, niets wordt onthouden.

## Flow

1. In `#stap-gegevens`, boven het formulier: de regel
   "Al eerder een afspraak gemaakt? **Haal uw gegevens op.**" (linkknop).
2. Klik → blok met één veld **"E-mailadres of telefoonnummer"** + knop
   **"Stuur code"** + foutregel. Bevat de invoer een `@`, dan is het kanaal
   e-mail; anders sms.
3. Opzoeken via `OberPoesDb.zoekKlantOpContact(tenant.code, invoer)`:
   - **Onbekend** → melding (zie boven), geen codestap.
   - **Bekend** → codestap zoals de beheer-login: 6-cijferige democode
     zichtbaar op het scherm ("Demo: in een echte omgeving ontvangt u deze
     code per e-mail/sms."), invoerveld, knop "Bevestig", link
     "Andere invoer" (terug naar stap 2). Foute code → "Deze code klopt niet."
4. Juiste code → `vulKlantIn(klant)`: zelfde prefill-gedrag als de
   uitnodigingslink (alleen niet-lege waarden; `adres` alleen zetten als
   straat én plaats beide gevuld; melding "Uw gegevens zijn alvast ingevuld —
   klopt alles nog?"). Het aanmeldblok sluit; het formulier blijft volledig
   aanpasbaar en de bestaande validatie blijft ongewijzigd.

## Wijzigingen per bestand

### js/db.js

Nieuwe functie `zoekKlantOpContact(tenantCode, invoer)`:

- Zoekt in de samengevoegde lijst `this.klantenVoor(tenantCode)` (dus zowel
  handmatig toegevoegde klanten als klanten uit eerdere afspraken).
- Bevat `invoer` een `@` → vergelijk met `email`, hoofdletterongevoelig en
  getrimd.
- Anders → vergelijk telefoonnummers op cijfers: van beide kanten alle
  niet-cijfers strippen (`String(x).replace(/\D/g, '')`) en vergelijken;
  lege cijferreeksen matchen nooit.
- Geeft het klantobject (met `naam`, `email`, `telefoon`, `straat`,
  `huisnummer`, `postcode`, `plaats`) of `null`.

### tenant.html

In `#stap-gegevens`, direct ná `#prefill-melding` en vóór het formulier:

- De aanmeldregel met linkknop ("Haal uw gegevens op").
- Een standaard verborgen aanmeldblok met: contactveld + "Stuur code" +
  foutregel (stap 2), en een eveneens verborgen codestap met democode-blok,
  code-invoerveld, knop "Bevestig", link "Andere invoer" en foutregel
  (stap 3). Zelfde opbouw en klassen als de login-kaart in beheer.html
  (`demo-code`, `melding melding-info`, `fout` met `aria-live="polite"`).

### js/tenant.js

- **Refactor (DRY):** de bestaande uitnodigings-prefill-logica wordt een
  functie `vulKlantIn(klant)` (velden invullen met niet-lege waarden,
  straat/plaats + `adres` alleen bij beide gevuld, prefill-melding tonen).
  De uitnodigingsflow (`?klant=<id>`) roept die functie aan; gedrag identiek
  aan nu.
- **Nieuw:** handlers voor het aanmeldblok volgens de Flow hierboven, met
  dezelfde patronen als de beheer-login (`verwachteCode`-variabele,
  `Math.floor(100000 + Math.random() * 900000)`, Enter-toets bevestigt).
  Na een juiste code: `vulKlantIn(gevondenKlant)` en het aanmeldblok sluiten.

## Privacy (demo-kader)

- Gegevens worden pas getoond ná een juiste code via het door de klant zelf
  opgegeven kanaal.
- In de demo staat de code op het scherm, consistent met de beheer-login.
- Geen persoonsgegevens in URL's; geen opslag/sessie na de paginaweergave.

## Tests (js/tests.js)

- `zoekKlantOpContact`: vindt op e-mail hoofdletterongevoelig; vindt op
  telefoon met spaties/streepjes in de invoer; geeft `null` bij onbekend
  contact. (73 → 75 tests, in twee testfuncties.)
- Browser-e2e: bekende klant → code → prefill → boeking afronden; onbekend
  contact → duidelijke melding, geen codestap; foute code → "Deze code klopt
  niet."; uitnodigingslink-prefill werkt nog (regressie na de refactor).

## Wat bewust NIET verandert

- Geen klantsessie of opslag van de aanmelding.
- Validatie, PDOK-flow en het boekingsproces blijven ongewijzigd.
- De uitnodigingslink-prefill blijft functioneel identiek (alleen intern
  verhuisd naar `vulKlantIn`).
- Interne identifiers/bestandsnamen blijven ongewijzigd.
