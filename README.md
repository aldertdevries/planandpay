# OberPoes — prototype

Statisch HTML-prototype van SaaS-platform OberPoes. Geen build-stap, geen
dependencies: direct hostbaar op GitHub Pages.

## Onderdelen

| Pagina | Beschrijving |
|---|---|
| `index.html` | Openbare landingpage met tenant-inschrijving (verificatie + PDOK-adreslookup) |
| `over.html` | Over OberPoes |
| `admin.html` | Afgesloten beheer: aanvragen goedkeuren/afkeuren, tenants beheren |
| `tenant.html?code=X` | Openbare boekingspagina van één actieve tenant (deelbaar / iframe) |
| `afspraak.html?id=X` | Klantpagina: afspraak inzien, verzetten of annuleren |
| `beheer.html?code=X` | Beheer van één tenant: agenda, facturatie, openingstijden, profiel (login via e-mail-/sms-verificatiecode) |
| `factuur.html?id=X` | Printbare factuur (logo, regels, btw-uitsplitsing) — "PDF-bijlage" in de demo |
| `betaal.html?factuur=X` | Demo-betaalpagina (Mollie-simulatie) die de factuur op Betaald zet |
| `tests.html` | Browser-tests voor database-, agenda- en validatielogica |

## Demo-inloggegevens

- Gebruikersnaam: `oberpoes`
- Wachtwoord: `miauw2026`

> Let op: dit is een prototype. De "database" is localStorage (per browser),
> de verificatiecodes worden op het scherm getoond en het admin-wachtwoord
> staat hardcoded in de bron. Niets hiervan is productieveilig — bewust.

## Hosten op GitHub Pages

1. Push deze repo naar GitHub.
2. Ga naar **Settings → Pages**, kies branch `master` (of `main`), map `/ (root)`.
3. De site staat daarna op `https://<gebruiker>.github.io/<repo>/`.

## Lokaal draaien

Open `index.html` in een browser, of start een simpele webserver:
`python -m http.server` of `npx serve`.

Tests draaien kan ook zonder browser: `node scripts/run-tests.mjs`.
