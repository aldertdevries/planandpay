# Verbeterronde Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zeven verbeteringen: klant-bevestiging + zelf annuleren/verzetten, weekkalender + capaciteit, meerdaagse blokkades, facturen crediteren/vervallen + nummerreeks, zoeken/pagineren, hoofdadmin-dashboard, toegankelijkheid.

**Architecture:** Pure logica eerst (agenda/db/facturen/lijst, TDD), daarna de UI-lagen: nieuwe klantpagina `afspraak.html`, uitbreidingen in `js/beheer.js` (week, capaciteit, blokkades, facturen, reeks), `js/admin.js` (dashboard, zoeken) en tot slot een toegankelijkheids-sweep over CSS en templates.

**Tech Stack:** Bestaand: vanilla ES2020, localStorage, testharnas (`node scripts/run-tests.mjs` + `tests.html`).

## Global Constraints

- Geen build-stap, geen dependencies; Nederlands; mail/betaling gesimuleerd.
- Capaciteit: integer 1–5, default 1; slot vrij zolang aantal afspraken < capaciteit.
- Meerdaagse blokkade: `datumTot` optioneel, default = `datum`; verlopen o.b.v. `datumTot || datum`.
- Factuurstatussen exact: `Open`, `Betaald`, `Gecrediteerd`, `Vervallen`, `Credit`.
- Nummerreeks: `factuurReeks = { prefix, volgende }`; default prefix = huidig jaar, volgende = bestaand aantal + 1; nummer `<prefix>-<4 cijfers>`.
- Paginering: 10 per pagina; zoeken case-insensitief substring op opgegeven velden.
- Annuleren/verzetten door klant alleen als afspraak niet gefactureerd is.
- Bestaande aanroepen zonder nieuwe parameters blijven werken (defaults).

---

### Task 1: Kernlogica agenda + database (capaciteit, verzetten, meerdaagse blokkades) — TDD

**Files:**
- Modify: `js/agenda.js`, `js/db.js`, `js/tests.js`

**Interfaces:**
- Produces:
  - `Agenda.maandagVan(datumIso) → 'YYYY-MM-DD'`
  - `Agenda.sloten(openingstijden, slotDuur, datumIso, afspraken, blokkades = [], capaciteit = 1)`
  - Blokkade-toepasselijkheid eenmalig: `b.datum <= D <= (b.datumTot || b.datum)`
  - `Agenda.actieveBlokkades`: verlopen o.b.v. `(b.datumTot || b.datum)`
  - `OberPoesDb.zetOpeningstijden(code, openingstijden, slotDuur, capaciteit?)`
  - `OberPoesDb.verzetAfspraak(id, datum, tijd) → Afspraak|null`
  - `maakAfspraak` respecteert `tenant.capaciteit || 1`; `activeerTenant` default `capaciteit: 1`

- [ ] **Step 1: Schrijf de failende tests (js/tests.js, vóór afsluitende `OberPoesDb.wisAlles();`)**

```javascript
// --- Verbeterronde: agenda ---
test('maandagVan: geeft maandag van de week', () => {
  assert(Agenda.maandagVan('2026-07-15') === '2026-07-13');
  assert(Agenda.maandagVan('2026-07-13') === '2026-07-13');
  assert(Agenda.maandagVan('2026-07-19') === '2026-07-13');
});
test('sloten: capaciteit 2 laat twee afspraken per slot toe', () => {
  const een = [{ datum: '2026-07-13', tijd: '10:00' }];
  const twee = [...een, { datum: '2026-07-13', tijd: '10:00' }];
  const t = Agenda.standaardOpeningstijden();
  assert(Agenda.sloten(t, 30, '2026-07-13', een, [], 2).find((s) => s.tijd === '10:00').vrij === true);
  assert(Agenda.sloten(t, 30, '2026-07-13', twee, [], 2).find((s) => s.tijd === '10:00').vrij === false);
});
test('sloten: meerdaagse blokkade blokkeert hele periode', () => {
  const blok = [{ type: 'eenmalig', datum: '2026-07-14', datumTot: '2026-07-16', van: '09:00', tot: '17:00' }];
  const t = Agenda.standaardOpeningstijden();
  assert(Agenda.sloten(t, 30, '2026-07-14', [], blok).every((s) => !s.vrij));
  assert(Agenda.sloten(t, 30, '2026-07-16', [], blok).every((s) => !s.vrij));
  assert(Agenda.sloten(t, 30, '2026-07-13', [], blok).every((s) => s.vrij));
  assert(Agenda.sloten(t, 30, '2026-07-17', [], blok).every((s) => s.vrij));
});
test('actieveBlokkades: meerdaags verloopt op t/m-datum', () => {
  const blok = [
    { type: 'eenmalig', datum: '2026-07-01', datumTot: '2026-07-12', van: '09:00', tot: '17:00' },
    { type: 'eenmalig', datum: '2026-07-01', datumTot: '2026-07-14', van: '09:00', tot: '17:00' },
  ];
  const actief = Agenda.actieveBlokkades(blok, '2026-07-13');
  assert(actief.length === 1 && actief[0].datumTot === '2026-07-14');
});
// --- Verbeterronde: database ---
test('maakAfspraak: respecteert capaciteit van de tenant', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Cap BV' });
  OberPoesDb.activeerTenant(t.code);
  OberPoesDb.zetOpeningstijden(t.code, Agenda.standaardOpeningstijden(), 30, 2);
  assert(OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'A' }) !== null);
  assert(OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'B' }) !== null);
  assert(OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'C' }) === null);
});
test('verzetAfspraak: verzet, weigert vol slot en gefactureerd', () => {
  const t = OberPoesDb.alleTenants()[0]; // Cap BV, capaciteit 2
  const a = OberPoesDb.afsprakenVoor(t.code)[0];
  const verzet = OberPoesDb.verzetAfspraak(a.id, '2026-07-15', '11:00');
  assert(verzet && verzet.datum === '2026-07-15' && verzet.tijd === '11:00');
  OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'D' });
  assert(OberPoesDb.verzetAfspraak(a.id, '2026-07-14', '10:00') === null, 'vol slot');
  OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id, regels: [] });
  assert(OberPoesDb.verzetAfspraak(a.id, '2026-07-16', '09:00') === null, 'gefactureerd');
});
```

- [ ] **Step 2: Tests draaien → 6 nieuwe FAILs**

Run: `node scripts/run-tests.mjs`

- [ ] **Step 3: Pas js/agenda.js aan**

Onder `komendeOpenDagen` toevoegen:

```javascript
    maandagVan(datumIso) {
      const d = new Date(datumIso + 'T12:00:00');
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    },
```

`sloten` vervangen door:

```javascript
    sloten(openingstijden, slotDuur, datumIso, afspraken, blokkades = [], capaciteit = 1) {
      const dag = openingstijden[dagVan(datumIso)];
      if (!dag.open) return [];
      const perTijd = {};
      afspraken.filter((a) => a.datum === datumIso)
        .forEach((a) => { perTijd[a.tijd] = (perTijd[a.tijd] || 0) + 1; });
      const geblokkeerd = blokkades.filter((b) =>
        (b.type === 'eenmalig' && b.datum <= datumIso && datumIso <= (b.datumTot || b.datum))
        || (b.type === 'wekelijks' && b.dag === dagVan(datumIso)));
      const uit = [];
      for (let m = naarMinuten(dag.van); m + slotDuur <= naarMinuten(dag.tot); m += slotDuur) {
        const tijd = naarTijd(m);
        const inBlokkade = geblokkeerd.some((b) =>
          m < naarMinuten(b.tot) && m + slotDuur > naarMinuten(b.van));
        uit.push({ tijd, vrij: (perTijd[tijd] || 0) < capaciteit && !inBlokkade });
      }
      return uit;
    },
    actieveBlokkades(blokkades, vanafIso) {
      return blokkades.filter((b) => b.type === 'wekelijks' || (b.datumTot || b.datum) >= vanafIso);
    },
```

- [ ] **Step 4: Pas js/db.js aan**

`activeerTenant`: `capaciteit: bestaand.capaciteit || 1,` toevoegen.
`zetOpeningstijden` vervangen door:

```javascript
    zetOpeningstijden(code, openingstijden, slotDuur, capaciteit) {
      const velden = { openingstijden, slotDuur };
      if (capaciteit !== undefined) velden.capaciteit = capaciteit;
      return this.wijzig(code, velden);
    },
```

`maakAfspraak`: vervang de bezet-check door:

```javascript
      const norm = String(velden.tenantCode).toUpperCase();
      const tenant = zoek(db, norm);
      const capaciteit = (tenant && tenant.capaciteit) || 1;
      const aantal = db.afspraken.filter((a) => a.tenantCode.toUpperCase() === norm
        && a.datum === velden.datum && a.tijd === velden.tijd).length;
      if (aantal >= capaciteit) return null;
```

Nieuwe functie na `annuleerAfspraak`:

```javascript
    verzetAfspraak(id, datum, tijd) {
      const db = lees();
      const afspraak = db.afspraken.find((a) => a.id === id);
      if (!afspraak || afspraak.factuurId) return null;
      const norm = afspraak.tenantCode.toUpperCase();
      const tenant = zoek(db, norm);
      const capaciteit = (tenant && tenant.capaciteit) || 1;
      const aantal = db.afspraken.filter((a) => a.id !== id
        && a.tenantCode.toUpperCase() === norm && a.datum === datum && a.tijd === tijd).length;
      if (aantal >= capaciteit) return null;
      afspraak.datum = datum;
      afspraak.tijd = tijd;
      schrijf(db);
      return afspraak;
    },
```

- [ ] **Step 5: Tests → PASS (53/53). Commit**

```bash
git add js/agenda.js js/db.js js/tests.js
git commit -m "feat: capaciteit per slot, verzetten en meerdaagse blokkades in kernlogica"
```

---

### Task 2: Facturen-kernlogica (reeks, crediteren, vervallen) — TDD

**Files:**
- Modify: `js/db.js`, `js/tests.js`

**Interfaces:**
- Produces:
  - `OberPoesDb.zetFactuurReeks(code, prefix, volgende) → Tenant|null`
  - `OberPoesDb.crediteerFactuur(id) → Factuur|null` (alleen Open/Betaald)
  - `OberPoesDb.laatVervallen(id) → Factuur|null` (alleen Open)
  - `maakFactuur` gebruikt/verhoogt `factuurReeks`

- [ ] **Step 1: Failende tests**

```javascript
// --- Verbeterronde: facturen ---
test('factuurReeks: default, doortellen en instelbaar', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Reeks BV' });
  const a1 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '09:00', naam: 'A', email: 'a@x.nl' });
  const a2 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'B', email: 'b@x.nl' });
  const f1 = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a1.id, regels: [] });
  assert(f1.nummer.endsWith('-0001'), f1.nummer);
  OberPoesDb.zetFactuurReeks(t.code, 'BJ27', 100);
  const f2 = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a2.id, regels: [] });
  assert(f2.nummer === 'BJ27-0100', f2.nummer);
  assert(OberPoesDb.vindTenant(t.code).factuurReeks.volgende === 101);
});
test('crediteerFactuur: credit met negatieve regels, afspraak vrij', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Credit BV' });
  const a = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '09:00', naam: 'A', email: 'a@x.nl' });
  const f = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id,
    regels: [{ naam: 'Consult', btw: 'hoog', bedragCent: 5000 }] });
  const credit = OberPoesDb.crediteerFactuur(f.id);
  assert(credit.status === 'Credit' && credit.creditVoor === f.nummer);
  assert(credit.regels[0].bedragCent === -5000);
  assert(OberPoesDb.vindFactuur(f.id).status === 'Gecrediteerd');
  assert(OberPoesDb.afsprakenVoor(t.code)[0].factuurId === undefined, 'afspraak weer vrij');
  assert(OberPoesDb.crediteerFactuur(f.id) === null, 'niet nogmaals');
});
test('laatVervallen: alleen vanuit Open', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Verval BV' });
  const a = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '09:00', naam: 'A', email: 'a@x.nl' });
  const f = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id, regels: [] });
  assert(OberPoesDb.laatVervallen(f.id).status === 'Vervallen');
  assert(OberPoesDb.laatVervallen(f.id) === null, 'niet nogmaals');
});
test('totalen: negatieve bedragen (creditfactuur)', () => {
  const t = Facturatie.totalen([{ naam: 'C', btw: 'hoog', bedragCent: -12100 }]);
  assert(t.inclCent === -12100 && t.btwHoogCent === -2100 && t.exclCent === -10000);
});
```

- [ ] **Step 2: Tests draaien → 3 nieuwe FAILs (totalen-negatief slaagt al of faalt op afronding — controleren)**

Run: `node scripts/run-tests.mjs`

- [ ] **Step 3: Implementeer in js/db.js**

Module-helper (naast `zoek`):

```javascript
  function volgendNummer(db, tenantCode) {
    const norm = String(tenantCode).toUpperCase();
    const tenant = zoek(db, norm);
    const reeks = (tenant && tenant.factuurReeks) || {
      prefix: new Date().toISOString().slice(0, 4),
      volgende: db.facturen.filter((f) => f.tenantCode.toUpperCase() === norm).length + 1,
    };
    const nummer = `${reeks.prefix}-${String(reeks.volgende).padStart(4, '0')}`;
    if (tenant) tenant.factuurReeks = { prefix: reeks.prefix, volgende: reeks.volgende + 1 };
    return nummer;
  }
```

In `maakFactuur`: vervang de `volgnummer`-berekening en `nummer:`-regel door
`nummer: volgendNummer(db, afspraak.tenantCode),` (de losse
`const volgnummer = ...;`-regel vervalt).

Nieuwe functies na `zetFactuurStatus`:

```javascript
    zetFactuurReeks(code, prefix, volgende) {
      return this.wijzig(code, { factuurReeks: { prefix, volgende } });
    },
    crediteerFactuur(id) {
      const db = lees();
      const origineel = db.facturen.find((f) => f.id === id);
      if (!origineel || !['Open', 'Betaald'].includes(origineel.status)) return null;
      const credit = {
        id: this.genereerCode(),
        nummer: volgendNummer(db, origineel.tenantCode),
        tenantCode: origineel.tenantCode,
        afspraakId: origineel.afspraakId,
        klantNaam: origineel.klantNaam,
        klantEmail: origineel.klantEmail,
        regels: origineel.regels.map((r) => ({ ...r, bedragCent: -r.bedragCent })),
        status: 'Credit',
        creditVoor: origineel.nummer,
        gemaaktOp: new Date().toISOString(),
      };
      origineel.status = 'Gecrediteerd';
      const afspraak = db.afspraken.find((a) => a.id === origineel.afspraakId);
      if (afspraak) delete afspraak.factuurId;
      db.facturen.push(credit);
      schrijf(db);
      return credit;
    },
    laatVervallen(id) {
      const db = lees();
      const factuur = db.facturen.find((f) => f.id === id);
      if (!factuur || factuur.status !== 'Open') return null;
      factuur.status = 'Vervallen';
      schrijf(db);
      return factuur;
    },
```

- [ ] **Step 4: Tests → PASS (57/57). Commit**

```bash
git add js/db.js js/tests.js
git commit -m "feat: instelbare nummerreeks, crediteren en vervallen van facturen"
```

---

### Task 3: Lijst-module (zoeken + pagineren) — TDD

**Files:**
- Create: `js/lijst.js`
- Modify: `js/tests.js`, `tests.html`, `scripts/run-tests.mjs`, `admin.html`, `beheer.html` (script-tag)

**Interfaces:**
- Produces: `Lijst.filterEnPagineer(items, zoekterm, velden, pagina, perPagina = 10) → { items, totaal, paginas, pagina }`

- [ ] **Step 1: Failende test**

```javascript
// --- Verbeterronde: lijst ---
test('filterEnPagineer: zoekt, pagineert en klemt', () => {
  const items = Array.from({ length: 25 }, (_, i) =>
    ({ naam: 'Item ' + (i + 1), plaats: i < 5 ? 'Amsterdam' : 'Utrecht' }));
  const p1 = Lijst.filterEnPagineer(items, '', ['naam'], 1);
  assert(p1.items.length === 10 && p1.paginas === 3 && p1.totaal === 25);
  assert(Lijst.filterEnPagineer(items, '', ['naam'], 3).items.length === 5);
  assert(Lijst.filterEnPagineer(items, 'amster', ['naam', 'plaats'], 1).totaal === 5);
  assert(Lijst.filterEnPagineer(items, '', ['naam'], 99).pagina === 3, 'pagina geklemd');
});
```

- [ ] **Step 2: run-tests.mjs-lijst uitbreiden met `'js/lijst.js'` (na facturatie.js), tests draaien → FAIL**

- [ ] **Step 3: Schrijf js/lijst.js**

```javascript
// Puur zoek- en pagineerhulpje voor tabellen.
const Lijst = {
  filterEnPagineer(items, zoekterm, velden, pagina, perPagina = 10) {
    const term = String(zoekterm || '').trim().toLowerCase();
    const gefilterd = term
      ? items.filter((item) => velden.some((v) => String(item[v] || '').toLowerCase().includes(term)))
      : items;
    const paginas = Math.max(1, Math.ceil(gefilterd.length / perPagina));
    const huidige = Math.min(Math.max(1, pagina || 1), paginas);
    return {
      items: gefilterd.slice((huidige - 1) * perPagina, huidige * perPagina),
      totaal: gefilterd.length,
      paginas,
      pagina: huidige,
    };
  },
};
```

- [ ] **Step 4: Script-tags toevoegen**

`tests.html`, `admin.html` en `beheer.html`: `<script src="js/lijst.js"></script>` direct vóór `js/db.js`.

- [ ] **Step 5: Tests → PASS (58/58). Commit**

```bash
git add js/lijst.js js/tests.js tests.html scripts/run-tests.mjs admin.html beheer.html
git commit -m "feat: zoek- en pagineermodule"
```

---

### Task 4: Klant — bevestigingsmail en afspraakpagina (annuleren/verzetten)

**Files:**
- Modify: `tenant.html` (mailblok in stap-klaar), `js/tenant.js` (mail vullen + capaciteit doorgeven)
- Create: `afspraak.html`, `js/afspraak.js`

**Interfaces:**
- Consumes: `OberPoesDb.verzetAfspraak/annuleerAfspraak/alleAfspraken/vindTenant`, `Agenda.komendeOpenDagen/sloten/DAG_NAMEN`.

- [ ] **Step 1: tenant.html — voeg binnen `#stap-klaar`, ná de bestaande melding, toe:**

```html
        <div class="melding melding-info" id="bevestiging-mail" role="status"></div>
```

- [ ] **Step 2: js/tenant.js**

In `renderTijden`: geef capaciteit door — `Agenda.sloten(tenant.openingstijden, tenant.slotDuur || 30, gekozenDatum, OberPoesDb.afsprakenVoor(tenant.code), tenant.blokkades || [], tenant.capaciteit || 1)`.
Na het zetten van `el('bevestiging').innerHTML` in de submit-handler toevoegen:

```javascript
    el('bevestiging-mail').innerHTML =
      `<strong>Demo — bevestigingsmail:</strong><br>
      <strong>Aan:</strong> ${afspraak.email}<br>
      <strong>Onderwerp:</strong> Afspraakbevestiging — ${tenant.naam}<br><br>
      Beste ${afspraak.naam},<br><br>
      Uw afspraak bij ${tenant.naam} op ${datumLabel(afspraak.datum)} om ${afspraak.tijd}
      is bevestigd. 24 uur voor uw afspraak ontvangt u een herinnering per e-mail (gesimuleerd).<br>
      Wilt u de afspraak wijzigen of annuleren? Gebruik dan
      <a href="afspraak.html?id=${afspraak.id}">deze link</a>.`;
```

- [ ] **Step 3: Schrijf afspraak.html**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Uw afspraak</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    .tenant-kop { display: flex; align-items: center; gap: 1rem; padding: 1.25rem 0 0; }
    .tenant-kop img { width: 72px; height: 72px; border-radius: 10px; border: 1px solid var(--rand); }
    .tenant-kop h1 { margin: 0; font-size: 1.6rem; color: var(--paars-donker); }
    .keuze-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .keuze-grid .knop-secundair.gekozen { background: var(--paars); color: #fff; }
    .keuze-grid button:disabled { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }
  </style>
</head>
<body>
  <main class="container" id="afspraak-pagina">
    <div class="kaart verborgen" id="niet-beschikbaar">
      <h2>Deze pagina is niet beschikbaar</h2>
      <p>Controleer of de link klopt.</p>
    </div>
    <div id="inhoud" class="verborgen">
      <div class="tenant-kop">
        <img id="t-logo" alt="Logo">
        <div><h1 id="t-naam"></h1></div>
      </div>
      <div class="kaart" id="detail-kaart">
        <h2>Uw afspraak</h2>
        <p id="a-detail" role="status"></p>
        <div id="acties">
          <button class="knop" id="knop-verzetten">Verzetten</button>
          <button class="knop knop-gevaar" id="knop-annuleren">Annuleren</button>
        </div>
        <div class="melding melding-info verborgen" id="gefactureerd-melding" role="status"></div>
      </div>
      <div class="kaart verborgen" id="verzet-kaart">
        <h2>Kies een nieuw moment</h2>
        <div class="veld"><label>Kies een dag</label><div class="keuze-grid" id="dag-keuze"></div></div>
        <div class="veld verborgen" id="tijd-blok"><label>Kies een tijd</label><div class="keuze-grid" id="tijd-keuze"></div></div>
        <span class="fout" id="fout-verzet" aria-live="polite"></span>
      </div>
      <div class="kaart verborgen" id="klaar-kaart">
        <div class="melding melding-goed" id="klaar-melding" role="status"></div>
      </div>
    </div>
  </main>
  <footer class="site-footer">mogelijk gemaakt door OberPoes</footer>
  <script src="js/validatie.js"></script>
  <script src="js/agenda.js"></script>
  <script src="js/facturatie.js"></script>
  <script src="js/lijst.js"></script>
  <script src="js/db.js"></script>
  <script src="js/afspraak.js"></script>
</body>
</html>
```

- [ ] **Step 4: Schrijf js/afspraak.js**

```javascript
// Klantpagina voor één afspraak (?id=X): inzien, verzetten, annuleren.
(() => {
  if (!document.getElementById('afspraak-pagina')) return;
  const el = (id) => document.getElementById(id);

  const id = new URLSearchParams(location.search).get('id') || '';
  const afspraak = OberPoesDb.alleAfspraken().find((a) => a.id === id);
  const tenant = afspraak && OberPoesDb.vindTenant(afspraak.tenantCode);
  if (!afspraak || !tenant || tenant.status !== 'Actief') {
    el('niet-beschikbaar').classList.remove('verborgen');
    return;
  }

  const datumLabel = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    return `${Agenda.DAG_NAMEN[d.getDay()]} ${d.toLocaleDateString('nl-NL')}`;
  };

  el('t-logo').src = tenant.logo;
  el('t-naam').textContent = tenant.naam;
  document.title = `Uw afspraak — ${tenant.naam}`;
  el('inhoud').classList.remove('verborgen');

  function toonDetail() {
    el('a-detail').innerHTML =
      `<strong>${datumLabel(afspraak.datum)} om ${afspraak.tijd}</strong><br>`
      + `Locatie: ${tenant.straat} ${tenant.huisnummer}, ${tenant.plaats}<br>`
      + `Op naam van: ${afspraak.naam}`;
  }
  toonDetail();

  if (afspraak.factuurId) {
    el('acties').classList.add('verborgen');
    el('gefactureerd-melding').textContent =
      `Deze afspraak is al gefactureerd en kan online niet meer gewijzigd worden. `
      + `Neem contact op met ${tenant.naam} via ${tenant.email}.`;
    el('gefactureerd-melding').classList.remove('verborgen');
    return;
  }

  function klaar(tekst) {
    el('detail-kaart').classList.add('verborgen');
    el('verzet-kaart').classList.add('verborgen');
    el('klaar-melding').textContent = tekst;
    el('klaar-kaart').classList.remove('verborgen');
  }

  el('knop-annuleren').addEventListener('click', () => {
    if (OberPoesDb.annuleerAfspraak(afspraak.id)) {
      klaar('Uw afspraak is geannuleerd.');
    }
  });

  let gekozenDatum = null;

  function renderDagen() {
    const vandaag = new Date().toISOString().slice(0, 10);
    const dagen = Agenda.komendeOpenDagen(tenant.openingstijden, vandaag, 14);
    el('dag-keuze').innerHTML = dagen.map((iso) =>
      `<button type="button" class="knop knop-secundair${iso === gekozenDatum ? ' gekozen' : ''}" data-datum="${iso}">${datumLabel(iso)}</button>`
    ).join('');
    el('dag-keuze').querySelectorAll('button').forEach((k) => {
      k.addEventListener('click', () => {
        gekozenDatum = k.dataset.datum;
        renderDagen();
        renderTijden();
      });
    });
  }

  function renderTijden() {
    el('tijd-blok').classList.remove('verborgen');
    const sloten = Agenda.sloten(tenant.openingstijden, tenant.slotDuur || 30,
      gekozenDatum, OberPoesDb.afsprakenVoor(tenant.code).filter((a) => a.id !== afspraak.id),
      tenant.blokkades || [], tenant.capaciteit || 1);
    el('tijd-keuze').innerHTML = sloten.map((s) =>
      `<button type="button" class="knop knop-secundair" data-tijd="${s.tijd}" ${s.vrij ? '' : 'disabled'}>${s.tijd}</button>`
    ).join('') || '<em>Geen tijden beschikbaar op deze dag.</em>';
    el('tijd-keuze').querySelectorAll('button:not([disabled])').forEach((k) => {
      k.addEventListener('click', () => {
        const nieuw = OberPoesDb.verzetAfspraak(afspraak.id, gekozenDatum, k.dataset.tijd);
        if (!nieuw) {
          el('fout-verzet').textContent = 'Dit tijdstip is zojuist bezet geraakt. Kies een andere tijd.';
          renderTijden();
          return;
        }
        klaar(`Uw afspraak is verzet naar ${datumLabel(nieuw.datum)} om ${nieuw.tijd}.`);
      });
    });
  }

  el('knop-verzetten').addEventListener('click', () => {
    el('verzet-kaart').classList.remove('verborgen');
    renderDagen();
    el('verzet-kaart').scrollIntoView({ behavior: 'smooth' });
  });
})();
```

- [ ] **Step 5: Browserverificatie + commit**

Boeken op tenant.html → bevestigingsmail met beheerlink → afspraak.html: detail klopt → verzetten naar ander slot → melding; opnieuw openen → nieuwe datum → annuleren → melding; gefactureerde afspraak → contactmelding zonder knoppen; onbekend id → niet beschikbaar.

```bash
git add tenant.html js/tenant.js afspraak.html js/afspraak.js
git commit -m "feat: bevestigingsmail en klantpagina voor annuleren en verzetten"
```

---

### Task 5: Beheer — capaciteit, meerdaagse blokkade-UI, weekkalender

**Files:**
- Modify: `js/beheer.js`

**Interfaces:**
- Consumes: `Agenda.maandagVan`, `Agenda.sloten(..., capaciteit)`, `OberPoesDb.zetOpeningstijden(code, tijden, duur, capaciteit)`.

- [ ] **Step 1: Capaciteit in renderTijden**

Naast het slot-duur-veld:

```javascript
        <div class="veld" style="max-width: 220px;">
          <label for="capaciteit">Afspraken tegelijk per tijdslot</label>
          <select id="capaciteit">${[1, 2, 3, 4, 5].map((n) =>
            `<option ${n === (t.capaciteit || 1) ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </div>
```

en in de opslaan-handler: `OberPoesDb.zetOpeningstijden(code, nieuw, Number(el('slot-duur').value), Number(el('capaciteit').value));`

- [ ] **Step 2: Meerdaagse blokkade in renderTijden**

Ná het `blok-datum`-veld:

```javascript
          <div class="veld" id="blok-datum-tot-veld"><label for="blok-datum-tot">T/m (optioneel)</label>
            <input id="blok-datum-tot" type="date"></div>
```

Type-toggle verbergt ook dit veld bij wekelijks (`el('blok-datum-tot-veld').classList.toggle('verborgen', wekelijks);`).
Toevoegen-handler: na de datumvalidatie:

```javascript
      const datumTot = el('blok-datum-tot').value;
      if (type === 'eenmalig' && datumTot && datumTot < datum) {
        el('fout-blok').textContent = 'De t/m-datum moet op of na de startdatum liggen.';
        return;
      }
```

en bij eenmalig: `if (datumTot) blokkade.datumTot = datumTot;`.
Weergave in `blokRijen` (eenmalig-tak):

```javascript
          : new Date(b.datum + 'T12:00:00').toLocaleDateString('nl-NL')
            + (b.datumTot && b.datumTot !== b.datum
              ? ' t/m ' + new Date(b.datumTot + 'T12:00:00').toLocaleDateString('nl-NL') : '')
```

- [ ] **Step 3: Weekkalender in renderAgenda**

Bovenin het IIFE-bereik (naast `tenantsFilter`-achtige state):

```javascript
  let agendaWeergave = 'lijst';
  let weekStart = Agenda.maandagVan(new Date().toISOString().slice(0, 10));
  const datumPlus = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
```

`renderAgenda` begint met een toggle en delegeert:

```javascript
  function renderAgenda() {
    if (agendaWeergave === 'week') { renderWeek(); return; }
    renderAgendaLijst();
  }
```

(hernoem de bestaande implementatie naar `renderAgendaLijst` en zet bovenin de kaart-HTML een schakel:)

```javascript
        <p><button class="knop knop-secundair knop-klein" id="knop-naar-week">Weekweergave</button></p>
```

met handler `el('knop-naar-week').addEventListener('click', () => { agendaWeergave = 'week'; renderAgenda(); });`

Nieuwe functie `renderWeek`:

```javascript
  function renderWeek() {
    const t = huidigeTenant();
    const duur = t.slotDuur || 30;
    const dagen = Array.from({ length: 7 }, (_, i) => datumPlus(weekStart, i));
    const afspraken = OberPoesDb.afsprakenVoor(code);
    const perDag = {};
    dagen.forEach((iso) => {
      perDag[iso] = Agenda.sloten(t.openingstijden, duur, iso, [], t.blokkades || []);
    });
    const alleTijden = [...new Set(dagen.flatMap((iso) => perDag[iso].map((s) => s.tijd)))].sort();
    const kop = dagen.map((iso) => {
      const d = new Date(iso + 'T12:00:00');
      return `<th scope="col">${Agenda.DAG_NAMEN[d.getDay()].slice(0, 2)} ${d.getDate()}/${d.getMonth() + 1}</th>`;
    }).join('');
    const rijen = alleTijden.map((tijd) => `
      <tr><th scope="row">${tijd}</th>${dagen.map((iso) => {
        const slot = perDag[iso].find((s) => s.tijd === tijd);
        if (!slot) return '<td style="background:#f0eef8"></td>';
        if (!slot.vrij) return '<td style="background:#e3e0ef" title="geblokkeerd">✕</td>';
        const namen = afspraken.filter((a) => a.datum === iso && a.tijd === tijd).map((a) => a.naam);
        return `<td>${namen.join('<br>')}</td>`;
      }).join('')}</tr>`).join('');
    el('view-agenda').innerHTML = `
      <div class="kaart">
        <h2>Agenda — week van ${new Date(weekStart + 'T12:00:00').toLocaleDateString('nl-NL')}</h2>
        <p>
          <button class="knop knop-secundair knop-klein" id="knop-week-terug">← Vorige</button>
          <button class="knop knop-secundair knop-klein" id="knop-week-vandaag">Vandaag</button>
          <button class="knop knop-secundair knop-klein" id="knop-week-verder">Volgende →</button>
          <button class="knop knop-secundair knop-klein" id="knop-naar-lijst">Lijstweergave</button>
        </p>
        <table class="tabel">
          <thead><tr><th scope="col">Tijd</th>${kop}</tr></thead>
          <tbody>${rijen}</tbody>
        </table>
      </div>
      <div id="factuur-opbouw"></div>`;
    el('knop-week-terug').addEventListener('click', () => { weekStart = datumPlus(weekStart, -7); renderWeek(); });
    el('knop-week-verder').addEventListener('click', () => { weekStart = datumPlus(weekStart, 7); renderWeek(); });
    el('knop-week-vandaag').addEventListener('click', () => {
      weekStart = Agenda.maandagVan(new Date().toISOString().slice(0, 10));
      renderWeek();
    });
    el('knop-naar-lijst').addEventListener('click', () => { agendaWeergave = 'lijst'; renderAgenda(); });
  }
```

Opmerking: `Agenda.sloten` wordt hier bewust zonder afspraken en capaciteit aangeroepen — `vrij === false` betekent dan "geblokkeerd"; afspraken worden apart per cel opgezocht zodat namen (meerdere bij capaciteit > 1) getoond worden.

- [ ] **Step 4: Regressietests + browserverificatie + commit**

```bash
git add js/beheer.js
git commit -m "feat: weekkalender, capaciteit en meerdaagse blokkades in beheer"
```

---

### Task 6: Beheer — facturenacties, nummerreeks, zoeken/pagineren; betaalpagina-statussen

**Files:**
- Modify: `js/beheer.js`, `js/betaal.js`

**Interfaces:**
- Consumes: `OberPoesDb.crediteerFactuur/laatVervallen/zetFactuurReeks`, `Lijst.filterEnPagineer`.

- [ ] **Step 1: renderFacturen uitbreiden**

State: `let facturenZoek = ''; let facturenPagina = 1;` naast `facturenFilter`.
Filteropties: `['Alle', 'Open', 'Betaald', 'Gecrediteerd', 'Vervallen', 'Credit']`.
Badge-mapping:

```javascript
    const badgeKlasse = { Open: 'badge-aangevraagd', Betaald: 'badge-actief',
      Vervallen: 'badge-inactief', Gecrediteerd: 'badge-afgewezen', Credit: 'badge-inactief' };
    const statusBadge = (s) => `<span class="badge ${badgeKlasse[s]}">${s}</span>`;
```

Na het statusfilter: `const gefilterd = ...` door Lijst halen:

```javascript
    const basis = facturenFilter === 'Alle' ? alle : alle.filter((f) => f.status === facturenFilter);
    const pagina = Lijst.filterEnPagineer(basis, facturenZoek, ['nummer', 'klantNaam'], facturenPagina);
    facturenPagina = pagina.pagina;
    const lijst = pagina.items;
```

Zoekveld boven de tabel:

```javascript
        <div class="veld" style="max-width: 260px;">
          <label for="zoek-facturen">Zoeken (nummer of klant)</label>
          <input id="zoek-facturen" type="search" value="${facturenZoek}">
        </div>
```

Rij-acties (in de laatste kolom, naast de bestaande links):

```javascript
          ${['Open', 'Betaald'].includes(f.status)
            ? `<button class="knop knop-secundair knop-klein" data-crediteer="${f.id}">Crediteren</button>` : ''}
          ${f.status === 'Open'
            ? `<button class="knop knop-gevaar knop-klein" data-vervallen="${f.id}">Vervallen</button>` : ''}
```

en in de nummerkolom bij creditfacturen: `${f.creditVoor ? `<br><small>credit voor ${f.creditVoor}</small>` : ''}`.
Pagineerregel onder de tabel:

```javascript
        <p>
          <button class="knop knop-secundair knop-klein" id="facturen-vorige" ${pagina.pagina <= 1 ? 'disabled' : ''}>‹ Vorige</button>
          pagina ${pagina.pagina} van ${pagina.paginas} (${pagina.totaal} facturen)
          <button class="knop knop-secundair knop-klein" id="facturen-volgende" ${pagina.pagina >= pagina.paginas ? 'disabled' : ''}>Volgende ›</button>
        </p>
```

Handlers:

```javascript
    el('zoek-facturen').addEventListener('input', (e) => {
      facturenZoek = e.target.value;
      facturenPagina = 1;
      renderFacturen();
      el('zoek-facturen').focus();
      el('zoek-facturen').setSelectionRange(facturenZoek.length, facturenZoek.length);
    });
    el('facturen-vorige').addEventListener('click', () => { facturenPagina--; renderFacturen(); });
    el('facturen-volgende').addEventListener('click', () => { facturenPagina++; renderFacturen(); });
    el('view-facturen').querySelectorAll('button[data-crediteer]').forEach((k) =>
      k.addEventListener('click', () => { OberPoesDb.crediteerFactuur(k.dataset.crediteer); renderFacturen(); }));
    el('view-facturen').querySelectorAll('button[data-vervallen]').forEach((k) =>
      k.addEventListener('click', () => { OberPoesDb.laatVervallen(k.dataset.vervallen); renderFacturen(); }));
```

- [ ] **Step 2: Agenda-lijst zoeken/pagineren (renderAgendaLijst)**

State `let agendaZoek = ''; let agendaPagina = 1;`. In renderAgendaLijst:

```javascript
    const pagina = Lijst.filterEnPagineer(afspraken, agendaZoek, ['naam', 'datum'], agendaPagina);
    agendaPagina = pagina.pagina;
```

(`afspraken` = gesorteerde lijst; rijen uit `pagina.items`.) Zoekveld + pagineerregel + handlers zoals bij facturen (ids `zoek-agenda`, `agenda-vorige`, `agenda-volgende`).

- [ ] **Step 3: Nummerreeks op Profiel (renderProfiel)**

Na het Mollie-blok:

```javascript
        <div class="velden-rij" style="margin-top: 1rem;">
          <div class="veld"><label for="reeks-prefix">Factuurreeks — prefix</label>
            <input id="reeks-prefix" type="text" value="${(t.factuurReeks && t.factuurReeks.prefix) || new Date().getFullYear()}"></div>
          <div class="veld"><label for="reeks-volgende">Volgend nummer</label>
            <input id="reeks-volgende" type="number" min="1" value="${(t.factuurReeks && t.factuurReeks.volgende) || 1}"></div>
        </div>
        <span class="fout" id="fout-reeks" aria-live="polite"></span>
        <button class="knop" id="knop-reeks-opslaan">Reeks opslaan</button>
        <span class="melding melding-goed verborgen" id="reeks-opgeslagen" role="status">Opgeslagen.</span>
```

Handler:

```javascript
    el('knop-reeks-opslaan').addEventListener('click', () => {
      const prefix = el('reeks-prefix').value.trim();
      const volgende = parseInt(el('reeks-volgende').value, 10);
      if (!prefix || !Number.isInteger(volgende) || volgende < 1) {
        el('fout-reeks').textContent = 'Vul een prefix en een volgnummer van minimaal 1 in.';
        return;
      }
      OberPoesDb.zetFactuurReeks(code, prefix, volgende);
      el('reeks-opgeslagen').classList.remove('verborgen');
    });
```

- [ ] **Step 4: js/betaal.js — alleen Open betaalbaar**

Vervang `if (factuur.status === 'Betaald') toonBetaald();` door:

```javascript
  if (factuur.status === 'Betaald') {
    toonBetaald();
  } else if (factuur.status !== 'Open') {
    el('b-open').classList.add('verborgen');
    el('b-betaald').classList.remove('verborgen');
    el('b-betaald').querySelector('.melding').textContent =
      `Deze factuur heeft status ${factuur.status} en kan niet betaald worden.`;
  }
```

- [ ] **Step 5: Regressie + browserverificatie + commit**

```bash
git add js/beheer.js js/betaal.js
git commit -m "feat: facturenacties, nummerreeks en zoeken/pagineren in beheer"
```

---

### Task 7: Hoofdadmin — dashboard, notificaties, zoeken/pagineren tenants

**Files:**
- Modify: `admin.html` (menu + view), `js/admin.js`

- [ ] **Step 1: admin.html**

Menu: `<a href="#" id="menu-dashboard" class="actief">Dashboard</a>` vóór Aanvragen; `class="actief"` van Aanvragen weghalen. Views: `<div id="view-dashboard"></div>` vóór view-aanvragen; view-aanvragen krijgt `class="verborgen"`.

- [ ] **Step 2: js/admin.js**

`toonView`/menu-arrays: `['dashboard', 'aanvragen', 'tenants']`; `if (naam === 'dashboard') renderDashboard();`; `toonApp()` opent `'dashboard'`. In `toonView` ook de badge verversen:

```javascript
    const open = OberPoesDb.alleTenants().filter((t) => t.status === 'Aangevraagd').length;
    el('menu-aanvragen').textContent = open > 0 ? `Aanvragen (${open})` : 'Aanvragen';
```

Nieuwe functie:

```javascript
  function renderDashboard() {
    const tenants = OberPoesDb.alleTenants();
    const facturen = tenants.flatMap((t) => OberPoesDb.facturenVoor(t.code));
    const perStatus = (s) => tenants.filter((t) => t.status === s).length;
    const tegel = (label, waarde) =>
      `<div class="kaart" style="flex:1; text-align:center; margin:0;">
        <div style="font-size:2rem; font-weight:700; color:var(--paars-donker)">${waarde}</div>${label}</div>`;
    const aanvragen = tenants.filter((t) => t.status === 'Aangevraagd');
    el('view-dashboard').innerHTML = `
      <div class="kaart"><h2>Dashboard</h2>
        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          ${tegel('Aangevraagd', perStatus('Aangevraagd'))}
          ${tegel('Actief', perStatus('Actief'))}
          ${tegel('Inactief', perStatus('Inactief'))}
          ${tegel('Afgewezen', perStatus('Afgewezen'))}
          ${tegel('Afspraken', OberPoesDb.alleAfspraken().length)}
          ${tegel('Facturen (open/betaald)',
            `${facturen.filter((f) => f.status === 'Open').length}/${facturen.filter((f) => f.status === 'Betaald').length}`)}
        </div>
      </div>
      <div class="kaart"><h2>Postvak (gesimuleerd)</h2>
        ${aanvragen.length === 0 ? '<p>Geen nieuwe notificaties.</p>'
          : aanvragen.map((t) =>
            `<p role="status">📧 Nieuwe aanvraag van <strong>${t.naam}</strong> — ${new Date(t.aangevraagdOp).toLocaleDateString('nl-NL')}
             <a href="#" class="naar-aanvragen">bekijk</a></p>`).join('')}
      </div>`;
    el('view-dashboard').querySelectorAll('.naar-aanvragen').forEach((a) =>
      a.addEventListener('click', (e) => { e.preventDefault(); toonView('aanvragen'); }));
  }
```

Tenants-zoeken/pagineren in `renderTenants`: state `let tenantsZoek = ''; let tenantsPagina = 1;`;

```javascript
    const basis = tenantsFilter === 'Alle' ? alle : alle.filter((t) => t.status === tenantsFilter);
    const pagina = Lijst.filterEnPagineer(basis, tenantsZoek, ['naam', 'code', 'plaats'], tenantsPagina);
    tenantsPagina = pagina.pagina;
    const lijst = pagina.items;
```

Zoekveld (id `zoek-tenants`, label "Zoeken (naam, code of plaats)") naast het statusfilter, pagineerregel (ids `tenants-vorige`/`tenants-volgende`) en handlers identiek aan het facturenpatroon uit Task 6.

- [ ] **Step 3: Regressie + browserverificatie + commit**

```bash
git add admin.html js/admin.js
git commit -m "feat: hoofdadmin-dashboard met notificaties en doorzoekbare tenantlijst"
```

---

### Task 8: Toegankelijkheid + eindverificatie

**Files:**
- Modify: `css/style.css`, `index.html`, `over.html`, `tenant.html`, `beheer.html`, `admin.html`, `betaal.html`, `js/beheer.js`, `js/admin.js`, `README.md`

- [ ] **Step 1: css/style.css**

```css
/* Toegankelijkheid */
.knop:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; }
}
```

en `.site-footer { color: #5f5b76; }` (was `#8a86a0`). In `betaal.html`: `#888` → `#595566` en `#aaa` → `#6a6684`.

- [ ] **Step 2: aria-current**

Statische pagina's (`index.html`, `over.html`): actieve menulink krijgt `aria-current="page"`. In `js/beheer.js` en `js/admin.js` in `toonView` naast `classList.toggle('actief', ...)`:

```javascript
      el('menu-' + v).setAttribute('aria-current', v === naam ? 'page' : 'false');
```

- [ ] **Step 3: aria-live / role=status**

Alle statische `.fout`-spans in `index.html`, `tenant.html`, `beheer.html`, `admin.html` krijgen `aria-live="polite"`. Dynamische succes-/infomeldingen (`demo-codes`, `tijden-opgeslagen`, `mollie-opgeslagen`, `reeks-opgeslagen`, `gekopieerd`, `factuur-totaal`, mail-blokken) krijgen `role="status"` in de templates. `scope="col"` op alle `<th>` in de tabel-templates van `js/beheer.js` en `js/admin.js`.

- [ ] **Step 4: README bijwerken**

Tabelrij toevoegen: `| \`afspraak.html?id=X\` | Klantpagina: afspraak inzien, verzetten of annuleren |`

- [ ] **Step 5: Volledige eindverificatie + commit**

1. `node scripts/run-tests.mjs` → 58/58; browser `tests.html` idem.
2. E2E: boeken → bevestigingsmail → verzetten/annuleren via klantlink; capaciteit 2 → twee boekingen zelfde slot; weekweergave; vakantieblokkade meerdere dagen; crediteren → afspraak weer factureerbaar; vervallen; reeks instellen → volgend factuurnummer; zoeken/pagineren in drie lijsten; dashboard + badge; toetsenbordfocus zichtbaar.

```bash
git add -A
git commit -m "feat: toegankelijkheid en documentatie verbeterronde"
```
