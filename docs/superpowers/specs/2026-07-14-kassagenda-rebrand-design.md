# KassaGenda-rebrand (ontwerp)

Datum: 2026-07-14
Status: goedgekeurd door gebruiker
Bron: `kassagenda style guide.html` (repo-root)

## Doel

Volledige visuele en tekstuele rebrand van het prototype van OberPoes naar
**KassaGenda**, exact volgens de style guide, gevolgd door een push naar de
nieuwe publieke GitHub-repo `kassagenda`.

## Huisstijl (uit de guide)

| Element | Waarde |
|---|---|
| Mint-groen | `#A8E6CF` |
| Blossom-roze | `#FFB7B2` |
| Deep charcoal | `#2D3748` |
| Achtergrond | `#F7FAFC` |
| Gedempte tekst | `#718096` |
| Koppen/logo | Poppins 600/700 (Google Fonts, fallback system-ui) |
| Lopende tekst | Inter 400/500 |
| Kaarten | Wit, radius 24px, schaduw `0 10px 30px rgba(45,55,72,.05)`, geen rand |
| Primaire knop | Roze achtergrond, charcoal tekst, radius 14px, hover: −2px + roze gloed |
| Info-melding | Dashboard-kaartstijl: `rgba(168,230,207,.15)` + 5px mint linkerrand, radius 12 |
| Tegel (admin) | card-title: 13px uppercase letter-spacing .5px `#4A5568`; card-value: Poppins 24px 700 |

Overig: header wit met subtiele schaduw; actieve navlink roze onderstreping
(`aria-current` blijft); focus-outline charcoal; secundaire knop wit met
charcoal rand; knop-goed/knop-gevaar behouden groen/rood; statusbadges
behouden hun semantische kleuren. Alle inline `var(--paars…)`-verwijzingen
in HTML `<style>`-blokken en JS-templates gaan mee naar de nieuwe
variabelen (`--mint`, `--roze`, `--charcoal`, `--grijstekst`, `--bg`,
`--rand`).

## Logo

CSS-component volgens de guide:
- `.logo-icon`: 40×40, `linear-gradient(135deg, mint, roze)`, radius 12px,
  witte letter "K" in Poppins 700 20px, gecentreerd.
- Woordmerk: `Kassa` in charcoal + `Genda` in roze, Poppins 700 28px.
- Gebruik: headers van `index.html`, `over.html`, `admin.html` (met suffix
  "beheer"); `beheer.html` toont het icoon + tenantnaam. Voetteksten:
  "mogelijk gemaakt door KassaGenda".
- Favicon: inline SVG data-URI met gradient-vierkant + witte K, op elke
  pagina.

## Tekst-rebrand

Alle zichtbare "OberPoes" → "KassaGenda": paginatitels, hero, menu "Over
KassaGenda", voetteksten, "KassaGenda-code", gesimuleerde mails,
over-pagina-inhoud, README, contactadres `info@kassagenda.nl`.

**Ongewijzigd (bewust):** localStorage-sleutel `oberpoes_db`,
sessiesleutels, modulenaam `OberPoesDb`, bestandsnamen, admin-login
`oberpoes`/`miauw2026` (blijft in README gedocumenteerd), map-/reponaam
lokaal.

## GitHub

Na verificatie: `gh repo create kassagenda --public --source=. --push`
(of, als de repo al bestaat: remote toevoegen en pushen). Resultaat:
publieke repo `kassagenda` met de volledige historie op `master`.

## Verificatie

- `node scripts/run-tests.mjs` → 58/58 (rebrand raakt geen logica).
- Browser: elke pagina toont het nieuwe logo/favicon, Poppins/Inter en het
  nieuwe kleurenpalet; geen zichtbare "OberPoes" meer (controle via zoekactie
  in de gerenderde tekst); klikroute boeken → beheer → factuur → betalen
  werkt ongewijzigd.
- `git push` geslaagd en repo-URL gerapporteerd.
