# Betaalwijze bij rekeningen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beheerder kiest bij het maken van een rekening een betaalwijze (Mollie/Pin/Contant); pin/contant zet de rekening meteen op Betaald met betalingsbevestiging, en het rekeningenoverzicht krijgt een betaalwijze-kolom die in CSV en filter zit.

**Architecture:** Statische HTML/JS met `localStorage` als database (module `OberPoesDb` in `js/db.js`). Kernlogica (`maakFactuur`, setters) is Node-testbaar via `scripts/run-tests.mjs`; UI zit in `js/beheer.js` en wordt in de browser geverifieerd. Betaalwijze wordt lowercase opgeslagen (`mollie|pin|contant`) en met een labelmap getoond.

**Tech Stack:** Vanilla JS (geen build), localStorage, Node-testharnas met shims (`scripts/run-tests.mjs`), browser-preview op poort 8321 (`.claude/launch.json` naam `oberpoes`).

## Global Constraints

- B1-Nederlands in alle zichtbare tekst.
- Term overal: **Betaalwijze**; waarden intern lowercase `'mollie' | 'pin' | 'contant'`, getoond als **Mollie / Pin / Contant**.
- Default betaalwijze = `'mollie'`.
- Terugwaarts compatibel: rekening zonder `betaalwijze` telt overal als `'mollie'` (`f.betaalwijze || 'mollie'`); geen opgeslagen records herschrijven.
- Interne identifiers/ids/query-params/methodenamen die al `factuur`/`facturen` heten NIET hernoemen (bijv. `maakFactuur`, `view-facturen`, `betaal.html?factuur=`).
- Bestaande 68 tests moeten groen blijven.
- Testcommando: `node scripts/run-tests.mjs`. Testbestand: `js/tests.js` (`test(naam, fn)` + `assert(voorwaarde, bericht?)`).

---

### Task 1: db.js — betaalwijze in `maakFactuur`, setter, credit erft betaalwijze

**Files:**
- Modify: `js/db.js` (`maakFactuur` ~177-197, `zetMollieApiId` ~176, `crediteerFactuur` ~220-231)
- Test: `js/tests.js` (nieuwe tests bij het facturen-blok, ~na regel 237)

**Interfaces:**
- Consumes: `OberPoesDb.voegToe`, `OberPoesDb.activeerTenant`/`maakAfspraak` (bestaand, gebruikt in bestaande tests), `OberPoesDb.wijzig`, `volgendNummer` (module-intern).
- Produces:
  - `OberPoesDb.maakFactuur({ tenantCode, afspraakId, regels, betaalwijze })` → factuurobject met velden `betaalwijze: 'mollie'|'pin'|'contant'` en `status: 'Open'` (mollie/leeg) of `'Betaald'` (pin/contant); ongeldige/ontbrekende `betaalwijze` → `'mollie'`.
  - `OberPoesDb.zetStandaardBetaalwijze(code, wijze)` → tenant met `standaardBetaalwijze` gezet (ongeldig → `'mollie'`).
  - `crediteerFactuur(id)` → creditobject dat `betaalwijze` van het origineel overneemt.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `js/tests.js` direct ná de bestaande test `'demo-data: actieve tenant heeft factuurregels en mollie-id'` (rond regel 238). Gebruik hetzelfde patroon als de bestaande facturen-tests (die maken een tenant met `voegToe`, een afspraak, en roepen `maakFactuur` aan). Bekijk vlak boven in het bestand een bestaande test als vorm-referentie.

```js
test('maakFactuur: pin en contant zetten status direct op Betaald', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Betaal BV' });
  const a1 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-01', tijd: '09:00', naam: 'K1', email: 'k1@x.nl' });
  const a2 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-01', tijd: '10:00', naam: 'K2', email: 'k2@x.nl' });
  const fPin = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a1.id, regels: [], betaalwijze: 'pin' });
  const fCon = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a2.id, regels: [], betaalwijze: 'contant' });
  assert(fPin.betaalwijze === 'pin' && fPin.status === 'Betaald', 'pin: ' + JSON.stringify(fPin));
  assert(fCon.betaalwijze === 'contant' && fCon.status === 'Betaald', 'contant: ' + JSON.stringify(fCon));
});

test('maakFactuur: mollie en zonder betaalwijze blijven Open (default mollie)', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Betaal BV' });
  const a1 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-02', tijd: '09:00', naam: 'K1', email: 'k1@x.nl' });
  const a2 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-02', tijd: '10:00', naam: 'K2', email: 'k2@x.nl' });
  const fMollie = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a1.id, regels: [], betaalwijze: 'mollie' });
  const fLeeg = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a2.id, regels: [] });
  assert(fMollie.betaalwijze === 'mollie' && fMollie.status === 'Open', 'mollie: ' + JSON.stringify(fMollie));
  assert(fLeeg.betaalwijze === 'mollie' && fLeeg.status === 'Open', 'leeg: ' + JSON.stringify(fLeeg));
});

test('zetStandaardBetaalwijze: opslaan en ongeldige waarde valt terug op mollie', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Betaal BV' });
  OberPoesDb.zetStandaardBetaalwijze(t.code, 'contant');
  assert(OberPoesDb.vindTenant(t.code).standaardBetaalwijze === 'contant', 'contant opgeslagen');
  OberPoesDb.zetStandaardBetaalwijze(t.code, 'onzin');
  assert(OberPoesDb.vindTenant(t.code).standaardBetaalwijze === 'mollie', 'ongeldig -> mollie');
});

test('crediteerFactuur: credit erft betaalwijze van origineel', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Betaal BV' });
  const a = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-03', tijd: '09:00', naam: 'K1', email: 'k1@x.nl' });
  const f = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id, regels: [{ naam: 'X', btw: 'hoog', bedragCent: 12100 }], betaalwijze: 'pin' });
  const credit = OberPoesDb.crediteerFactuur(f.id);
  assert(credit.betaalwijze === 'pin', 'credit betaalwijze: ' + JSON.stringify(credit));
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `node scripts/run-tests.mjs`
Verwacht: de 4 nieuwe tests FALEN (o.a. `betaalwijze` is `undefined`, `status` bij pin nog `'Open'`, `zetStandaardBetaalwijze` bestaat niet). Bestaande 68 blijven groen.

- [ ] **Step 3: Pas `maakFactuur` aan**

In `js/db.js`, vervang de huidige `maakFactuur`:

```js
    maakFactuur({ tenantCode, afspraakId, regels }) {
      const db = lees();
      const afspraak = db.afspraken.find((a) => a.id === afspraakId);
      if (!afspraak || afspraak.factuurId) return null;
      const gemaaktOp = new Date().toISOString();
      const factuur = {
        id: this.genereerCode(),
        nummer: volgendNummer(db, afspraak.tenantCode),
        tenantCode: afspraak.tenantCode,
        afspraakId,
        klantNaam: afspraak.naam,
        klantEmail: afspraak.email,
        regels,
        status: 'Open',
        gemaaktOp,
      };
      db.facturen.push(factuur);
      afspraak.factuurId = factuur.id;
      schrijf(db);
      return factuur;
    },
```

door:

```js
    maakFactuur({ tenantCode, afspraakId, regels, betaalwijze }) {
      const db = lees();
      const afspraak = db.afspraken.find((a) => a.id === afspraakId);
      if (!afspraak || afspraak.factuurId) return null;
      const wijze = ['mollie', 'pin', 'contant'].includes(betaalwijze) ? betaalwijze : 'mollie';
      const gemaaktOp = new Date().toISOString();
      const factuur = {
        id: this.genereerCode(),
        nummer: volgendNummer(db, afspraak.tenantCode),
        tenantCode: afspraak.tenantCode,
        afspraakId,
        klantNaam: afspraak.naam,
        klantEmail: afspraak.email,
        regels,
        betaalwijze: wijze,
        status: wijze === 'mollie' ? 'Open' : 'Betaald',
        gemaaktOp,
      };
      db.facturen.push(factuur);
      afspraak.factuurId = factuur.id;
      schrijf(db);
      return factuur;
    },
```

- [ ] **Step 4: Voeg de setter toe**

In `js/db.js`, direct ná de regel `zetMollieApiId(code, id) { return this.wijzig(code, { mollieApiId: id }); },` toevoegen:

```js
    zetStandaardBetaalwijze(code, wijze) {
      const w = ['mollie', 'pin', 'contant'].includes(wijze) ? wijze : 'mollie';
      return this.wijzig(code, { standaardBetaalwijze: w });
    },
```

- [ ] **Step 5: Laat credit de betaalwijze overnemen**

In `js/db.js`, in het `credit`-object binnen `crediteerFactuur`, ná de regel `regels: origineel.regels.map((r) => ({ ...r, bedragCent: -r.bedragCent })),` toevoegen:

```js
        betaalwijze: origineel.betaalwijze || 'mollie',
```

- [ ] **Step 6: Draai de tests en zie alles groen**

Run: `node scripts/run-tests.mjs`
Verwacht: 72/72 geslaagd (68 bestaand + 4 nieuw).

- [ ] **Step 7: Commit**

```bash
git add js/db.js js/tests.js
git commit -m "feat: betaalwijze op rekening in db (pin/contant -> Betaald) + setter"
```

---

### Task 2: beheer.js — betaalwijze kiezen in opbouwscherm + gesplitste demo-mail

**Files:**
- Modify: `js/beheer.js` (`renderFactuurOpbouw` ~228-341, `knop-factureer`-handler ~328-340, `toonMail` ~343-367)

**Interfaces:**
- Consumes: `OberPoesDb.maakFactuur({..., betaalwijze})` en `factuur.betaalwijze` (Task 1); `huidigeTenant()`, `Berichten`, `Facturatie` (bestaand).
- Produces: keuzeveld `#opbouw-betaalwijze`; `toonMail` toont bij mollie de betaallink-mail en bij pin/contant de betalingsbevestiging.

Dit is UI-code; verificatie gebeurt in de browser (Task 5), niet via het Node-harnas.

- [ ] **Step 1: Voeg het betaalwijze-keuzeveld toe aan het opbouwscherm**

In `js/beheer.js`, in de template-string van `renderFactuurOpbouw`, vervang het blok van de totaal-melding t/m de knoppen:

```js
        <div class="melding melding-info" id="factuur-totaal" role="status">Nog geen producten toegevoegd.</div>
        <span class="fout" id="fout-factuur"></span>
        <button class="knop" id="knop-factureer">Rekening maken en mailen</button>
        <button class="knop knop-secundair" id="knop-opbouw-sluit">Sluiten</button>
```

door (voegt het keuzeveld toe, voorgevuld met de tenant-standaard):

```js
        <div class="melding melding-info" id="factuur-totaal" role="status">Nog geen producten toegevoegd.</div>
        <div class="veld" style="max-width: 260px;">
          <label for="opbouw-betaalwijze">Betaalwijze</label>
          <select id="opbouw-betaalwijze">
            <option value="mollie">Mollie</option>
            <option value="pin">Pin</option>
            <option value="contant">Contant</option>
          </select>
        </div>
        <span class="fout" id="fout-factuur"></span>
        <button class="knop" id="knop-factureer">Rekening maken en mailen</button>
        <button class="knop knop-secundair" id="knop-opbouw-sluit">Sluiten</button>
```

- [ ] **Step 2: Vul het keuzeveld voor met de tenant-standaard**

In `js/beheer.js`, direct ná `el('factuur-opbouw').scrollIntoView({ behavior: 'smooth' });` (het einde van het toewijzen van de template, ~regel 264) toevoegen:

```js
    el('opbouw-betaalwijze').value = huidigeTenant().standaardBetaalwijze || 'mollie';
```

- [ ] **Step 3: Geef de gekozen betaalwijze mee aan `maakFactuur`**

In `js/beheer.js`, in de `knop-factureer`-handler, vervang:

```js
      const factuur = OberPoesDb.maakFactuur({ tenantCode: code, afspraakId, regels: conceptRegels });
```

door:

```js
      const factuur = OberPoesDb.maakFactuur({
        tenantCode: code, afspraakId, regels: conceptRegels,
        betaalwijze: el('opbouw-betaalwijze').value,
      });
```

- [ ] **Step 4: Splits `toonMail` op betaalwijze**

In `js/beheer.js`, vervang de volledige functie `toonMail`:

```js
  function toonMail(factuur) {
    const t = huidigeTenant();
    const totaal = Facturatie.totalen(factuur.regels);
    el('factuur-opbouw').innerHTML = `
      <div class="kaart">
        <h2>Mail verzonden (demo)</h2>
        <div class="melding melding-info">
          <strong>Aan:</strong> ${factuur.klantEmail}<br>
          <strong>Onderwerp:</strong> Rekening ${factuur.nummer} van ${t.naam}<br><br>
          ${Berichten.naarHtml(Berichten.render(Berichten.voor(t, 'factuur'), {
            naam: factuur.klantNaam,
            tenant: t.naam,
            nummer: factuur.nummer,
            bedrag: Facturatie.euro(totaal.inclCent),
          }))}<br><br>
          <strong>Betaallink:</strong>
          <a href="betaal.html?factuur=${factuur.id}" target="_blank">online betalen via Mollie</a><br>
          <strong>Bijlage:</strong>
          <a href="factuur.html?id=${factuur.id}" target="_blank">rekening-${factuur.nummer}.pdf</a>
        </div>
        <button class="knop knop-secundair" id="knop-mail-sluit">Sluiten</button>
      </div>`;
    el('factuur-opbouw').scrollIntoView({ behavior: 'smooth' });
    el('knop-mail-sluit').addEventListener('click', () => { el('factuur-opbouw').innerHTML = ''; });
  }
```

door:

```js
  function toonMail(factuur) {
    const t = huidigeTenant();
    const totaal = Facturatie.totalen(factuur.regels);
    const bedrag = Facturatie.euro(totaal.inclCent);
    const bijlage =
      `<strong>Bijlage:</strong>
       <a href="factuur.html?id=${factuur.id}" target="_blank">rekening-${factuur.nummer}.pdf</a>`;
    let inhoud;
    if (factuur.betaalwijze === 'pin' || factuur.betaalwijze === 'contant') {
      const wijzeLabel = factuur.betaalwijze === 'pin' ? 'pin' : 'contant';
      inhoud = `
        <strong>Aan:</strong> ${factuur.klantEmail}<br>
        <strong>Onderwerp:</strong> Betaling ontvangen — rekening ${factuur.nummer}<br><br>
        ${Berichten.naarHtml(Berichten.render(Berichten.voor(t, 'betaling'), {
          naam: factuur.klantNaam,
          tenant: t.naam,
          nummer: factuur.nummer,
          bedrag,
        }))}<br><br>
        Deze rekening is met ${wijzeLabel} voldaan en staat op Betaald.<br><br>
        ${bijlage}`;
    } else {
      inhoud = `
        <strong>Aan:</strong> ${factuur.klantEmail}<br>
        <strong>Onderwerp:</strong> Rekening ${factuur.nummer} van ${t.naam}<br><br>
        ${Berichten.naarHtml(Berichten.render(Berichten.voor(t, 'factuur'), {
          naam: factuur.klantNaam,
          tenant: t.naam,
          nummer: factuur.nummer,
          bedrag,
        }))}<br><br>
        <strong>Betaallink:</strong>
        <a href="betaal.html?factuur=${factuur.id}" target="_blank">online betalen via Mollie</a><br>
        ${bijlage}`;
    }
    el('factuur-opbouw').innerHTML = `
      <div class="kaart">
        <h2>Mail verzonden (demo)</h2>
        <div class="melding melding-info">${inhoud}</div>
        <button class="knop knop-secundair" id="knop-mail-sluit">Sluiten</button>
      </div>`;
    el('factuur-opbouw').scrollIntoView({ behavior: 'smooth' });
    el('knop-mail-sluit').addEventListener('click', () => { el('factuur-opbouw').innerHTML = ''; });
  }
```

- [ ] **Step 5: Regressie-check tests (mag niet breken)**

Run: `node scripts/run-tests.mjs`
Verwacht: 72/72 geslaagd (UI-wijziging raakt de logica niet).

- [ ] **Step 6: Commit**

```bash
git add js/beheer.js
git commit -m "feat: betaalwijze kiezen bij rekening maken + gesplitste demo-mail"
```

---

### Task 3: beheer.js — kolom, filter en CSV voor betaalwijze in het rekeningenoverzicht

**Files:**
- Modify: `js/beheer.js` (`renderFacturen` ~429-520, statevars ~430-432)

**Interfaces:**
- Consumes: `f.betaalwijze` (Task 1), `Lijst.filterEnPagineer`, `Csv` (bestaand).
- Produces: labelmap `BETAALWIJZE_LABELS`; extra kolom/filter/CSV in het rekeningenoverzicht.

UI-code; verificatie in de browser (Task 5).

- [ ] **Step 1: Voeg de labelmap en filter-state toe**

In `js/beheer.js`, vervang het blok:

```js
  // --- Facturen ---
  let facturenFilter = 'Alle';
  let facturenZoek = '';
  let facturenPagina = 1;
```

door:

```js
  // --- Facturen ---
  const BETAALWIJZE_LABELS = { mollie: 'Mollie', pin: 'Pin', contant: 'Contant' };
  const betaalwijzeLabel = (f) => BETAALWIJZE_LABELS[f.betaalwijze || 'mollie'];
  let facturenFilter = 'Alle';
  let facturenBetaalwijzeFilter = 'Alle';
  let facturenZoek = '';
  let facturenPagina = 1;
```

- [ ] **Step 2: Pas de betaalwijze-filter toe op de basislijst**

In `js/beheer.js`, in `renderFacturen`, vervang:

```js
    const alle = OberPoesDb.facturenVoor(code);
    const basis = facturenFilter === 'Alle' ? alle : alle.filter((f) => f.status === facturenFilter);
    const pagina = Lijst.filterEnPagineer(basis, facturenZoek, ['nummer', 'klantNaam'], facturenPagina);
```

door:

```js
    const alle = OberPoesDb.facturenVoor(code);
    const naStatus = facturenFilter === 'Alle' ? alle : alle.filter((f) => f.status === facturenFilter);
    const basis = facturenBetaalwijzeFilter === 'Alle'
      ? naStatus
      : naStatus.filter((f) => (f.betaalwijze || 'mollie') === facturenBetaalwijzeFilter);
    const pagina = Lijst.filterEnPagineer(basis, facturenZoek, ['nummer', 'klantNaam'], facturenPagina);
```

- [ ] **Step 3: Bouw de betaalwijze-filteropties**

In `js/beheer.js`, direct ná de regel die `opties` maakt (`const opties = ['Alle', 'Open', ...].map(...).join('');`) toevoegen:

```js
    const wijzeOpties = ['Alle', 'Mollie', 'Pin', 'Contant']
      .map((s) => `<option value="${s === 'Alle' ? 'Alle' : s.toLowerCase()}" ${(s === 'Alle' ? 'Alle' : s.toLowerCase()) === facturenBetaalwijzeFilter ? 'selected' : ''}>${s}</option>`).join('');
```

- [ ] **Step 4: Voeg de kolom toe aan de rijen**

In `js/beheer.js`, in de `rijen`-template, vervang:

```js
        <td>${statusBadge(f.status)}</td>
        <td>
          <a class="knop knop-secundair knop-klein" href="factuur.html?id=${f.id}" target="_blank">Rekening</a>
```

door:

```js
        <td>${statusBadge(f.status)}</td>
        <td>${betaalwijzeLabel(f)}</td>
        <td>
          <a class="knop knop-secundair knop-klein" href="factuur.html?id=${f.id}" target="_blank">Rekening</a>
```

- [ ] **Step 5: Voeg de filter-dropdown en de kolomkop toe**

In `js/beheer.js`, in de `view-facturen`-template, vervang het status-filterblok:

```js
          <div class="veld">
            <label for="filter-factuurstatus">Filter op status</label>
            <select id="filter-factuurstatus">${opties}</select>
          </div>
          <div class="veld">
            <label for="zoek-facturen">Zoeken (nummer of klant)</label>
            <input id="zoek-facturen" type="search" value="${facturenZoek}">
          </div>
```

door:

```js
          <div class="veld">
            <label for="filter-factuurstatus">Filter op status</label>
            <select id="filter-factuurstatus">${opties}</select>
          </div>
          <div class="veld">
            <label for="filter-betaalwijze">Filter op betaalwijze</label>
            <select id="filter-betaalwijze">${wijzeOpties}</select>
          </div>
          <div class="veld">
            <label for="zoek-facturen">Zoeken (nummer of klant)</label>
            <input id="zoek-facturen" type="search" value="${facturenZoek}">
          </div>
```

En vervang de tabelkop:

```js
          <thead><tr><th scope="col">Nummer</th><th scope="col">Datum</th><th scope="col">Klant</th><th scope="col">Bedrag</th><th scope="col">Status</th><th scope="col"></th></tr></thead>
```

door:

```js
          <thead><tr><th scope="col">Nummer</th><th scope="col">Datum</th><th scope="col">Klant</th><th scope="col">Bedrag</th><th scope="col">Status</th><th scope="col">Betaalwijze</th><th scope="col"></th></tr></thead>
```

- [ ] **Step 6: Koppel de filter-listener**

In `js/beheer.js`, direct ná de bestaande `el('filter-factuurstatus').addEventListener('change', ...)`-handler toevoegen:

```js
    el('filter-betaalwijze').addEventListener('change', (e) => {
      facturenBetaalwijzeFilter = e.target.value;
      facturenPagina = 1;
      renderFacturen();
    });
```

- [ ] **Step 7: Voeg de betaalwijze-kolom toe aan de CSV**

In `js/beheer.js`, in de `knop-facturen-csv`-handler, vervang:

```js
      const rijenCsv = alle.map((f) => [f.nummer,
        new Date(f.gemaaktOp).toLocaleDateString('nl-NL'), f.klantNaam || '', f.klantEmail || '',
        Facturatie.euro(Facturatie.totalen(f.regels).inclCent), f.status, f.creditVoor || '']);
      Csv.download(`rekeningen-${code}.csv`, Csv.genereer(
        ['Nummer', 'Datum', 'Klant', 'E-mail', 'Bedrag', 'Status', 'Credit voor'], rijenCsv));
```

door:

```js
      const rijenCsv = alle.map((f) => [f.nummer,
        new Date(f.gemaaktOp).toLocaleDateString('nl-NL'), f.klantNaam || '', f.klantEmail || '',
        Facturatie.euro(Facturatie.totalen(f.regels).inclCent), f.status, betaalwijzeLabel(f), f.creditVoor || '']);
      Csv.download(`rekeningen-${code}.csv`, Csv.genereer(
        ['Nummer', 'Datum', 'Klant', 'E-mail', 'Bedrag', 'Status', 'Betaalwijze', 'Credit voor'], rijenCsv));
```

- [ ] **Step 8: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 72/72 geslaagd.

- [ ] **Step 9: Commit**

```bash
git add js/beheer.js
git commit -m "feat: betaalwijze-kolom, -filter en CSV in rekeningenoverzicht"
```

---

### Task 4: beheer.js — standaard betaalwijze als instelling

**Files:**
- Modify: `js/beheer.js` (profiel/Instellingen-template ~969-984, opslaan-handlers ~1040-1043)

**Interfaces:**
- Consumes: `OberPoesDb.zetStandaardBetaalwijze` (Task 1), `t.standaardBetaalwijze`.
- Produces: keuzeveld `#standaard-betaalwijze` + knop `#knop-betaalwijze-opslaan` + melding `#betaalwijze-opgeslagen`.

UI-code; verificatie in de browser (Task 5).

- [ ] **Step 1: Voeg het instelvelden-blok toe**

In `js/beheer.js`, in de profiel-template, ná het Mollie-blok — vervang:

```js
        <button class="knop" id="knop-mollie-opslaan">Mollie-id opslaan</button>
        <span class="melding melding-goed verborgen" id="mollie-opgeslagen" role="status">Opgeslagen.</span>
```

door:

```js
        <button class="knop" id="knop-mollie-opslaan">Mollie-id opslaan</button>
        <span class="melding melding-goed verborgen" id="mollie-opgeslagen" role="status">Opgeslagen.</span>
        <div class="veld" style="margin-top: 1rem; max-width: 260px;">
          <label for="standaard-betaalwijze">Standaard betaalwijze</label>
          <select id="standaard-betaalwijze">
            <option value="mollie">Mollie</option>
            <option value="pin">Pin</option>
            <option value="contant">Contant</option>
          </select>
        </div>
        <button class="knop" id="knop-betaalwijze-opslaan">Standaard betaalwijze opslaan</button>
        <span class="melding melding-goed verborgen" id="betaalwijze-opgeslagen" role="status">Opgeslagen.</span>
```

- [ ] **Step 2: Vul het keuzeveld voor en koppel de opslaan-handler**

In `js/beheer.js`, direct ná de `knop-mollie-opslaan`-handler:

```js
    el('knop-mollie-opslaan').addEventListener('click', () => {
      OberPoesDb.zetMollieApiId(code, el('mollie-id').value.trim());
      el('mollie-opgeslagen').classList.remove('verborgen');
    });
```

toevoegen:

```js
    el('standaard-betaalwijze').value = t.standaardBetaalwijze || 'mollie';
    el('knop-betaalwijze-opslaan').addEventListener('click', () => {
      OberPoesDb.zetStandaardBetaalwijze(code, el('standaard-betaalwijze').value);
      el('betaalwijze-opgeslagen').classList.remove('verborgen');
    });
```

Let op: `t` is in deze functie al gedefinieerd (gebruikt door o.a. `t.factuurVoettekst`, `t.mollieApiId`); gebruik dezelfde `t`.

- [ ] **Step 3: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 72/72 geslaagd.

- [ ] **Step 4: Commit**

```bash
git add js/beheer.js
git commit -m "feat: standaard betaalwijze als instelling in het beheer"
```

---

### Task 5: Browserverificatie end-to-end, README en push

**Files:**
- Modify: `README.md` (regel over `betaal.html`/beheer, als er iets over betaalwijze vermeld moet worden — optioneel; alleen als er een relevante beschrijving is)

**Interfaces:**
- Consumes: alles uit Task 1-4.

- [ ] **Step 1: Start de preview-server**

Gebruik de browser-preview (`preview_start` met naam `oberpoes`, poort 8321). Niet via Bash starten.

- [ ] **Step 2: Laad demo-data en pak de actieve tenantcode**

Navigeer naar `beheer.html`, draai in de console `OberPoesDb.laadDemoData()` en pak de code van de tenant met `status === 'Actief'`. Zet de sessievlag zodat het beheer opent (`sessionStorage.setItem('oberpoes_tenant_<CODE>', String(Date.now()+3600000))`).

- [ ] **Step 3: Verifieer de instelling**

Open Instellingen. Zet "Standaard betaalwijze" op **Contant**, sla op, herlaad en controleer dat het keuzeveld weer **Contant** toont.

- [ ] **Step 4: Verifieer pin/contant-flow**

Open Afspraken → "Rekening maken" bij een afspraak. Controleer dat het keuzeveld **Betaalwijze** voorstaat op de standaard (Contant). Voeg een product toe, kies **Pin**, klik "Rekening maken en mailen". Verwacht: demo-mail met onderwerp "Betaling ontvangen — rekening …", géén Mollie-betaallink, wél rekening-pdf-bijlage, en de tekst dat de rekening met pin is voldaan.

- [ ] **Step 5: Verifieer overzicht, filter en Betaald-status**

Open Rekeningen. Controleer: kolom **Betaalwijze** toont de juiste waarde; de zojuist gemaakte pin-rekening staat op **Betaald**; "Filter op betaalwijze" = Pin toont alleen pin-rekeningen; "Filter op betaalwijze" = Mollie toont de bestaande demo-rekening. Test dat status- en betaalwijzefilter samen werken.

- [ ] **Step 6: Verifieer mollie-flow (regressie)**

Maak bij een andere afspraak een rekening met **Mollie**. Verwacht: demo-mail mét Mollie-betaallink; rekening staat op **Open**.

- [ ] **Step 7: Verifieer CSV**

Klik "Download CSV" en controleer via de netwerk/console of de gedownloade inhoud een kolom **Betaalwijze** bevat. (Alternatief: roep in de console dezelfde `Csv.genereer`-aanroep na om de kopregel te inspecteren.)

- [ ] **Step 8: Draai de volledige testset nog één keer**

Run: `node scripts/run-tests.mjs`
Verwacht: 72/72 geslaagd.

- [ ] **Step 9: Werk README bij indien nodig en commit + push**

Als `README.md` een relevante omschrijving heeft van de rekening-/betaalflow, voeg één zin toe over de keuze Mollie/Pin/Contant. Daarna:

```bash
git add -A
git commit -m "docs: betaalwijze in README + eindverificatie"
git push origin master
```

(Als README geen aanpassing nodig heeft, sla de README-wijziging over en push de bestaande commits met `git push origin master`.)

---

## Self-Review

**Spec coverage:**
- Keuze 3 betaalwijzen in "rekening maken" → Task 2 (Step 1-3).
- Standaard betaalwijze als instelling, default Mollie → Task 1 (setter, default), Task 4 (UI).
- Pin/Contant → meteen Betaald, geen Mollie-link, betalingsbevestiging → Task 1 (status), Task 2 (toonMail-split).
- Extra kolom Betaalwijze in overzicht → Task 3 (Step 4-5).
- In CSV → Task 3 (Step 7).
- Filterbaar → Task 3 (Step 1-3, 6).
- Terugwaartse compatibiliteit → Task 1 (default), Task 3 (`f.betaalwijze || 'mollie'`).
- betaal.html/js ongewijzigd → bevestigd (geen taak).

**Placeholder scan:** Geen TBD/TODO; alle code-stappen bevatten volledige code. README-stap is expliciet voorwaardelijk gemaakt (met fallback), geen open einde.

**Type consistency:** `betaalwijze` overal lowercase `'mollie'|'pin'|'contant'`; labelmap `BETAALWIJZE_LABELS` en `betaalwijzeLabel(f)` consistent gebruikt in kolom en CSV; `zetStandaardBetaalwijze(code, wijze)` en `standaardBetaalwijze` consistent tussen Task 1 en Task 4; `maakFactuur`-signatuur met `betaalwijze` consistent tussen Task 1 en Task 2.
