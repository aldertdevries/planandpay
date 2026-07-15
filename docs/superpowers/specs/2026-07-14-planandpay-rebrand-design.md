# PlanAndPay-rebrand (ontwerp)

Datum: 2026-07-14
Status: goedgekeurd door gebruiker
Bron: `planandpay style guide.jpg` (repo-root)

## Doel

Volledige visuele en tekstuele rebrand van KassaGenda naar **PlanAndPay**
volgens de style guide, en publiceren naar een **nieuwe publieke GitHub-repo
`planandpay`**.

## Huisstijl (uit de guide)

| Rol | Kleur |
|---|---|
| Plan Blue (primair) | `#2563EB` |
| Pay Green (success/positief) | `#10B981` |
| Growth Orange (accent/in afwachting) | `#F59E0B` |
| Midnight (donkere tekst) | `#0F172A` |
| Slate (gedempte tekst) | `#475569` |
| Light Border | `#CBD5E1` |
| Background | `#F8FAFC` |
| White | `#FFFFFF` |

Typografie ongewijzigd: Poppins SemiBold (koppen/logo), Inter Regular (tekst).

## Logo

Kalender-met-€ icoon (inline SVG): blauwe kalenderomlijning met groene €.
Woordmerk **Plan** (Plan Blue) + **And** (Midnight) + **Pay** (Pay Green),
Poppins 700. Tagline *"Van afspraak tot betaling."* in de hero en op de
Over-pagina. Favicon: blauw afgerond vierkant met witte kalender+€.
Nieuwe CSS-klassen `.logo-plan`, `.logo-and`, `.logo-pay`; `.logo-icon`
wordt een transparante container voor het SVG-icoon (geen gradient meer).

## Kleuren in CSS (`css/style.css` :root)

Variabelen herzien: `--blauw #2563EB` (primair), `--groen #10B981`,
`--oranje #F59E0B` (nieuw), `--charcoal #0F172A`, `--grijstekst #475569`,
`--rand #CBD5E1`, `--bg #F8FAFC`, `--rood #DC2626`, `--grijs #64748B`. De
oude `--roze`/`--mint` vervallen; hun gebruik (primaire knop, nav-accent,
logo) gaat over op `--blauw`.

## Knoppen (besluit: alles blauw behalve verwijderen)

- Primair `.knop`: Plan Blue achtergrond, **witte** tekst, radius 14px,
  hover −2px + blauwe gloed.
- Goedkeuren/opslaan/boeken/factureren/betalen: primair blauw (de bestaande
  `knop-goed` op "Goedkeuren" wordt gewone `knop`).
- `.knop-gevaar` (rood): alleen annuleren, afkeuren, verwijderen, vervallen.
- `.knop-secundair`: wit met rand + charcoal tekst.
- Growth Orange als losse accentkleur (bijv. tegelaccent), niet als knop.

## Statuslabels (badges, zachte pill-stijl uit de guide)

Lichte achtergrond + donkere tekst i.p.v. massieve kleur:
- Betaald / Actief → groen (`#D1FAE5` / `#047857`)
- In afwachting: Open / Aangevraagd → oranje (`#FEF3C7` / `#B45309`)
- Geannuleerd / Afgewezen / Gecrediteerd → rood (`#FEE2E2` / `#B91C1C`)
- Inactief / Vervallen / Credit → slate (`#E2E8F0` / `#475569`)

## Tekst-rebrand

Alle zichtbare "KassaGenda" → "PlanAndPay"; tagline toegevoegd; contact
`info@planandpay.nl`; voetteksten "mogelijk gemaakt door PlanAndPay" /
"© 2026 PlanAndPay — prototype"; paginatitels; "PlanAndPay-code".

**Ongewijzigd (bewust):** localStorage-sleutel `oberpoes_db`, `OberPoesDb`,
sessiesleutels, admin-login `oberpoes`/`miauw2026`, bestandsnamen.

## GitHub

Nieuwe publieke repo `planandpay`, code pushen, en dezelfde Actions-workflow
(pages.yml) zorgt voor automatische Pages-deploy.

## Verificatie

`node scripts/run-tests.mjs` → 62/62 (geen logica). Browser (desktop +
mobiel 375px): nieuw logo + favicon, blauw/groen/oranje palet, blauwe
primaire knoppen met witte tekst, zachte statusbadges, hamburger werkt,
geen zichtbare "KassaGenda" meer; klikroute boeken → beheer → factuur →
betalen intact. Repo aangemaakt, push + deploy geslaagd, URL gerapporteerd.
