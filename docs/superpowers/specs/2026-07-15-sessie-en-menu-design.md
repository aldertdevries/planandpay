# PlanAndPay — langere sessie, tab-menu en kleine verbeteringen (ontwerp)

Datum: 2026-07-15
Status: goedgekeurd door gebruiker

## 1. Sessie: glijdend 1 uur (js/sessie.js)

Admin- en tenantbeheer-login blijven bewaard tot **1 uur na het laatste
gebruik**, ook na het sluiten van een tab (handig op mobiel). Nu staat de
sessievlag in `sessionStorage` (weg bij tabsluiting); dat wordt
`localStorage` met een tijdstempel.

Nieuwe hulpmodule `Sessie`:
- `Sessie.MAX = 3600000` (1 uur in ms).
- `Sessie.actief(sleutel) → boolean` — leest de tijdstempel; binnen een uur
  → vernieuwt de stempel (glijdend) en geeft `true`; anders wist de sleutel
  en geeft `false`.
- `Sessie.begin(sleutel)` — zet stempel op nu.
- `Sessie.eind(sleutel)` — verwijdert de sleutel.
- `Sessie.bewaak(sleutel, opVerlopen)` — vernieuwt de stempel bij activiteit
  (click/keydown/touch, hooguit eens per 30 s) en controleert elke 60 s of
  de sessie is verlopen; zo ja → `opVerlopen()`.

`js/admin.js` en `js/beheer.js` gebruiken deze module i.p.v. directe
`sessionStorage`-aanroepen (sleutels blijven `oberpoes_admin` en
`oberpoes_tenant_<CODE>`). Bij inloggen `begin`, bij uitloggen `eind`, bij
laden `actief`, en `bewaak(sleutel, () => location.reload())` zodat een
verlopen sessie vanzelf naar het loginscherm terugvalt. `sessie.js` wordt
op admin.html en beheer.html vóór het paginascript geladen.

## 2. Menu als tab-balk onder de header (admin + beheer)

De navigatie van beide applicaties komt op een volle-breedte rij **onder**
de headerregel i.p.v. ernaast, met het actieve tabblad blauw onderstreept.
Uitsluitend CSS (geen DOM-verplaatsing): `#admin-menu`/`#beheer-menu` krijgen
op desktop `order: 3; width: 100%`, een bovenrand als scheiding, en tabs met
ruime klikvlakken; het actieve/hover-tabblad krijgt `border-bottom: 3px
solid Plan Blue`. `.header-inner` krijgt `flex-wrap: wrap` zodat de nav naar
de tweede regel zakt (openbare menu's blijven ongewijzigd naast het logo).
Op mobiel blijft de hamburger het menu tonen (ongewijzigd). De
**Uitloggen**-tab wordt rechts uitgelijnd (`margin-left: auto`).

## 3. Ingelogde naam + Uitloggen

- Beheer: de tenantnaam staat al in het logo (`kop-naam`) — dat toont wie is
  ingelogd. De Uitloggen-tab staat rechts.
- Admin: een klein label **"Beheerder"** in de header, zichtbaar na
  inloggen (verborgen op het loginscherm), en de Uitloggen-tab rechts.

## 4. Bevestiging vóór verwijderacties

Een korte `bevestig(tekst)`-helper (native `confirm`) vóór onomkeerbare
acties, met duidelijke NL-tekst:
- Beheer agenda: **Annuleren** van een afspraak.
- Klantpagina (`afspraak.html`): **Annuleren** door de klant.
- Admin aanvragen: **Afkeuren**.
- Beheer facturen: **Crediteren** en **Vervallen**.
Bij "Nee/Annuleren" gebeurt er niets.

## Verificatie

`node scripts/run-tests.mjs` → 62/62 (geen kernlogica gewijzigd). Browser
desktop + mobiel: tab-balk onder de header met blauwe onderstreping op het
actieve tabblad; Uitloggen rechts; admin toont "Beheerder"; inloggen →
herladen blijft ingelogd (localStorage); verlopen wordt gesimuleerd door de
stempel terug te zetten (>1 uur) → volgende check toont login; bevestiging
verschijnt vóór annuleren/afkeuren/crediteren/vervallen en afbreken doet
niets. Daarna commit + push (auto-deploy).
