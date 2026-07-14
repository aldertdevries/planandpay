# KassaGenda-rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Volledige rebrand naar KassaGenda (logo, kleuren, typografie, teksten) volgens `kassagenda style guide.html`, gevolgd door een push naar de publieke GitHub-repo `kassagenda`.

**Architecture:** `css/style.css` wordt herschreven op de nieuwe huisstijlvariabelen; het logo is een pure CSS-component (`.logo-icon` + woordmerk) in de headers; elke pagina krijgt Google Fonts- en favicon-links; inline `var(--paars…)`-verwijzingen en zichtbare "OberPoes"-teksten worden vervangen. Technische internals blijven onaangeroerd.

**Tech Stack:** Bestaand vanilla HTML/CSS/JS; Google Fonts (Poppins 600/700, Inter 400/500) via CDN; gh CLI voor de repo-push.

## Global Constraints

- Kleuren exact: mint `#A8E6CF`, roze `#FFB7B2`, charcoal `#2D3748`, achtergrond `#F7FAFC`, gedempt `#718096`.
- Kaarten: radius 24px, schaduw `0 10px 30px rgba(45,55,72,.05)`, geen rand. Primaire knop: roze/charcoal, radius 14px, hover −2px + `0 5px 15px rgba(255,183,178,.4)`.
- Internals ongewijzigd: `oberpoes_db`, sessiesleutels, `OberPoesDb`, admin-login `oberpoes`/`miauw2026`, bestandsnamen.
- Alle zichtbare "OberPoes" → "KassaGenda"; contact `info@kassagenda.nl`.
- Testsuite blijft 58/58 (geen logicawijzigingen).

---

### Task 1: Huisstijl en logo

**Files:**
- Modify: `css/style.css` (volledige restyling), `index.html`, `over.html`, `admin.html`, `beheer.html`, `tenant.html`, `afspraak.html`, `factuur.html`, `betaal.html` (head-links + headers), `js/beheer.js` (kop-naam + weekcel-kleuren), `js/admin.js` (tegelkleur)

**Interfaces:**
- Produces: CSS-klassen `.logo`, `.logo-icon`, `.logo-kassa`, `.logo-genda`, `.card-title`, `.card-value`; variabelen `--mint`, `--roze`, `--charcoal`, `--bg`, `--grijstekst`, `--rand`, `--font-koppen`, `--font-body` (oude `--paars*`-variabelen vervallen).

- [ ] **Step 1: Head-links op alle acht pagina's (na `<link rel="stylesheet" ...>`)**

```html
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23A8E6CF'/%3E%3Cstop offset='1' stop-color='%23FFB7B2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='40' height='40' rx='12' fill='url(%23g)'/%3E%3Ctext x='20' y='27' font-family='sans-serif' font-size='20' font-weight='bold' fill='white' text-anchor='middle'%3EK%3C/text%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Herschrijf css/style.css**

Volledige inhoud (vervangt het bestand):

```css
:root {
  --mint: #A8E6CF;
  --roze: #FFB7B2;
  --charcoal: #2D3748;
  --bg: #F7FAFC;
  --grijstekst: #718096;
  --rand: #E2E8F0;
  --rood: #c0392b;
  --groen: #1e8e4e;
  --blauw: #2471a3;
  --grijs: #7f8c8d;
  --font-koppen: 'Poppins', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--charcoal);
  line-height: 1.6;
}
h1, h2, h3 { font-family: var(--font-koppen); font-weight: 600; }
.container { max-width: 900px; margin: 0 auto; padding: 0 1.25rem; }

/* Header en menu */
.site-header { background: #fff; box-shadow: 0 2px 12px rgba(45, 55, 72, 0.06); }
.header-inner { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1.25rem; }

/* Logo (style guide) */
.logo {
  font-family: var(--font-koppen); font-size: 1.5rem; font-weight: 700;
  display: flex; align-items: center; gap: 12px;
  color: var(--charcoal); text-decoration: none;
}
.logo-icon {
  width: 40px; height: 40px; flex: none;
  background: linear-gradient(135deg, var(--mint), var(--roze));
  border-radius: 12px;
  display: flex; justify-content: center; align-items: center;
  color: #fff; font-size: 20px; font-family: var(--font-koppen); font-weight: 700;
}
.logo-kassa { color: var(--charcoal); }
.logo-genda { color: var(--roze); }
.logo small { font-size: 0.9rem; color: var(--grijstekst); font-weight: 500; }

.site-header nav a {
  color: var(--charcoal); text-decoration: none; margin-left: 1.25rem;
  padding-bottom: 3px; font-weight: 500;
}
.site-header nav a.actief, .site-header nav a:hover { border-bottom: 3px solid var(--roze); }

/* Hero */
.hero { text-align: center; padding: 3rem 0 2rem; }
.hero h1 { font-size: 2.4rem; margin: 0 0 0.5rem; color: var(--charcoal); font-weight: 700; }
.hero p { font-size: 1.15rem; color: var(--grijstekst); max-width: 34rem; margin: 0 auto; }

/* Kaarten en formulieren */
.kaart {
  background: #fff; border-radius: 24px; padding: 2rem; margin: 1.5rem 0;
  box-shadow: 0 10px 30px rgba(45, 55, 72, 0.05);
}
.kaart h2 { margin-top: 0; color: var(--charcoal); }
.veld { margin-bottom: 1rem; }
.veld label { display: block; font-weight: 500; margin-bottom: 0.25rem; }
.veld input, .veld select {
  width: 100%; padding: 0.55rem 0.7rem; border: 1px solid var(--rand);
  border-radius: 10px; font-size: 1rem; background: #fff; font-family: var(--font-body);
}
.veld input[readonly] { background: #EDF2F7; color: var(--grijstekst); }
.veld input:focus, .veld select:focus { outline: 2px solid var(--charcoal); border-color: var(--charcoal); }
.veld .fout { color: var(--rood); font-size: 0.85rem; display: block; min-height: 1.1rem; }
.fout { color: var(--rood); font-size: 0.85rem; display: block; }
.velden-rij { display: flex; gap: 1rem; }
.velden-rij .veld { flex: 1; }

/* Knoppen (style guide: blossom-roze primair) */
.knop {
  background: var(--roze); color: var(--charcoal); border: none; border-radius: 14px;
  padding: 0.65rem 1.4rem; font-size: 1rem; font-weight: 500; cursor: pointer;
  text-decoration: none; display: inline-block; font-family: var(--font-body);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.knop:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 183, 178, 0.4); }
.knop-secundair { background: #fff; color: var(--charcoal); border: 1px solid var(--charcoal); }
.knop-secundair:hover { box-shadow: 0 5px 15px rgba(45, 55, 72, 0.15); }
.knop-gevaar { background: var(--rood); color: #fff; }
.knop-gevaar:hover { box-shadow: 0 5px 15px rgba(192, 57, 43, 0.35); }
.knop-goed { background: var(--groen); color: #fff; }
.knop-goed:hover { box-shadow: 0 5px 15px rgba(30, 142, 78, 0.35); }
.knop-klein { padding: 0.3rem 0.8rem; font-size: 0.85rem; }
.knop:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

/* Statusbadges */
.badge { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; color: #fff; }
.badge-aangevraagd { background: var(--blauw); }
.badge-afgewezen { background: var(--rood); }
.badge-actief { background: var(--groen); }
.badge-inactief { background: var(--grijs); }

/* Tabellen */
.tabel { width: 100%; border-collapse: collapse; }
.tabel th, .tabel td { text-align: left; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--rand); vertical-align: middle; }
.tabel th { background: #EDF2F7; color: var(--charcoal); font-family: var(--font-body); font-weight: 600; }
.tabel img { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--rand); }
.tabel tr.klikbaar { cursor: pointer; }
.tabel tr.klikbaar:hover { background: var(--bg); }

/* Dashboard-tegels (style guide dashboard-card) */
.card-title {
  font-weight: 500; font-size: 13px; text-transform: uppercase;
  letter-spacing: 0.5px; color: #4A5568;
}
.card-value { font-family: var(--font-koppen); font-size: 24px; font-weight: 700; margin-top: 4px; }

/* Toegankelijkheid */
.knop:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
  outline: 3px solid var(--charcoal);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; transition: none !important; }
}

/* Hulpklassen */
.verborgen { display: none !important; }
.melding { padding: 0.8rem 1rem; border-radius: 12px; margin: 1rem 0; }
.melding-fout { background: #fdecea; color: var(--rood); border-left: 5px solid var(--rood); }
.melding-info { background: rgba(168, 230, 207, 0.15); color: var(--charcoal); border-left: 5px solid var(--mint); }
.melding-goed { background: #e9f7ef; color: var(--groen); border-left: 5px solid var(--groen); }
.demo-code { font-family: monospace; font-size: 1.3rem; background: #EDF2F7; padding: 0.2rem 0.6rem; border-radius: 8px; letter-spacing: 2px; }
.tabel .demo-code { font-size: 0.95rem; }
.logo-preview { width: 150px; height: 150px; border: 1px dashed var(--rand); border-radius: 12px; background: #fff; object-fit: contain; }
.site-footer { text-align: center; color: var(--grijstekst); padding: 2rem 0; font-size: 0.9rem; }
```

- [ ] **Step 3: Logo-markup in de headers**

`index.html` en `over.html` (menutekst "Over OberPoes" wordt in Task 2 hernoemd):

```html
      <a class="logo" href="index.html">
        <span class="logo-icon" aria-hidden="true">K</span>
        <span><span class="logo-kassa">Kassa</span><span class="logo-genda">Genda</span></span>
      </a>
```

`admin.html`:

```html
      <a class="logo" href="admin.html">
        <span class="logo-icon" aria-hidden="true">K</span>
        <span><span class="logo-kassa">Kassa</span><span class="logo-genda">Genda</span> <small>beheer</small></span>
      </a>
```

`beheer.html`:

```html
      <span class="logo">
        <span class="logo-icon" aria-hidden="true">K</span>
        <span id="kop-naam">Beheer</span>
      </span>
```

en in `js/beheer.js`: `el('kop-naam').textContent = \`${tenant.naam} — beheer\`;` (🐾 weg).

- [ ] **Step 4: Inline kleurverwijzingen bijwerken**

- `tenant.html` + `afspraak.html` `<style>`: `var(--paars-donker)` → `var(--charcoal)`; `.keuze-grid .knop-secundair.gekozen { background: var(--charcoal); color: #fff; }`.
- `factuur.html`: `border-top: 2px solid var(--paars)` → `var(--charcoal)`; `.factuur-kop h1/h2` erven Poppins.
- `betaal.html`: `color: var(--paars-donker)` → `var(--charcoal)`.
- `js/admin.js`: dashboard-tegel gebruikt `.card-title`/`.card-value`-klassen i.p.v. inline font/kleur.
- `js/beheer.js`: weekcellen `#f0eef8` → `#EDF2F7`, `#e3e0ef` → `#E2E8F0`.

- [ ] **Step 5: Verifieer in de browser en commit**

```bash
git add -A
git commit -m "feat: KassaGenda-huisstijl en logo volgens style guide"
```

---

### Task 2: Tekst-rebrand

**Files:**
- Modify: `index.html`, `over.html`, `admin.html`, `tenant.html`, `afspraak.html`, `factuur.html`, `betaal.html`, `README.md`

- [ ] **Step 1: Vervang alle zichtbare "OberPoes" door "KassaGenda"**

Grep op `OberPoes` in `*.html` en `README.md` (niet in `js/` — modulenamen blijven) en vervang: paginatitels, hero ("KassaGenda — het platform..."), menu "Over KassaGenda", voetteksten "mogelijk gemaakt door KassaGenda" / "© 2026 KassaGenda — prototype", "Uw unieke KassaGenda-code", over-pagina-inhoud, `info@oberpoes.nl` → `info@kassagenda.nl`. README: titel "KassaGenda — prototype" + zin dat de admin-login `oberpoes`/`miauw2026` bewust ongewijzigd is.

- [ ] **Step 2: Controleer dat js/-bestanden geen zichtbare merknaam bevatten**

`grep -n "OberPoes" js/*.js` → alleen `OberPoesDb`-verwijzingen (modulenaam, geen UI-tekst).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: tekstuele rebrand naar KassaGenda"
```

---

### Task 3: Eindverificatie en push naar GitHub

- [ ] **Step 1: Tests + browsersweep**

`node scripts/run-tests.mjs` → 58/58. Browser: index/over/admin/beheer/tenant/afspraak/factuur/betaal — logo, Poppins/Inter geladen, roze knoppen, geen zichtbare "OberPoes" (tekstzoekactie per pagina), klikroute boeken → beheer werkt.

- [ ] **Step 2: Repo aanmaken en pushen**

```bash
gh auth status
gh repo create kassagenda --public --source=. --remote=origin --push
```

Als de repo al bestaat: `git remote add origin <url>` + `git push -u origin master`.

- [ ] **Step 3: Rapporteer de repo-URL en Pages-instructie.**
