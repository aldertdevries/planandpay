# Blokkades en factuuropbouw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tenants kunnen eenmalige of wekelijkse niet-boekbare perioden beheren die de agenda blokkeren, en het factuur-opbouwscherm werkt met een keuzelijst + bewerkbare velden + verwijderbare conceptlijst.

**Architecture:** Blokkade-logica komt als pure functies in `js/agenda.js` (nieuwe parameter op `sloten`, nieuwe helper `actieveBlokkades`), opslag via `zetBlokkades` in `js/db.js`, UI in het Openingstijden-tabblad van `js/beheer.js`; `js/tenant.js` geeft blokkades door aan de slotberekening. Het opbouwscherm in `js/beheer.js` wordt herschreven naar keuzelijst + conceptlijst.

**Tech Stack:** Bestaand: vanilla ES2020, localStorage, testharnas (`node scripts/run-tests.mjs` + `tests.html`).

## Global Constraints

- Geen build-stap, geen dependencies; Nederlands.
- Blokkade: `{id, type: 'eenmalig'|'wekelijks', datum (eenmalig), dag (wekelijks, Agenda.DAG_SLEUTELS), van, tot, omschrijving?}`; van < tot.
- Overlapregel: slot geblokkeerd als `slotStart < blokTot && slotStart + slotDuur > blokVan` (in minuten) én de blokkade op die datum van toepassing is.
- Verlopen eenmalige blokkades (datum < vandaag) niet tonen in beheer; wekelijkse altijd tonen.
- Factuuropbouw: aanpassing van een gekozen voorgedefinieerde regel raakt alleen de kopie voor deze factuur; conceptregels verwijderbaar tot "Factureren en mailen".
- Bestaande aanroepen van `Agenda.sloten` zonder blokkades-parameter blijven werken (default `[]`).

---

### Task 1: Blokkade-logica in agenda en database (TDD)

**Files:**
- Modify: `js/agenda.js`
- Modify: `js/db.js`
- Modify: `js/tests.js`

**Interfaces:**
- Produces:
  - `Agenda.sloten(openingstijden, slotDuur, datumIso, afspraken, blokkades = [])`
  - `Agenda.actieveBlokkades(blokkades, vanafIso) → blokkades[]`
  - `OberPoesDb.zetBlokkades(code, blokkades) → Tenant|null`
  - `activeerTenant` zet ook `blokkades: []`

- [ ] **Step 1: Schrijf de failende tests (js/tests.js, vóór afsluitende `OberPoesDb.wisAlles();`)**

```javascript
// --- Blokkades ---
test('sloten: eenmalige blokkade alleen op eigen datum', () => {
  const blok = [{ type: 'eenmalig', datum: '2026-07-13', van: '12:00', tot: '13:00' }];
  const ma = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-13', [], blok);
  const di = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-14', [], blok);
  assert(ma.find((s) => s.tijd === '12:00').vrij === false);
  assert(di.find((s) => s.tijd === '12:00').vrij === true);
});
test('sloten: overlap-randen bij blokkade 12:00-13:00', () => {
  const blok = [{ type: 'eenmalig', datum: '2026-07-13', van: '12:00', tot: '13:00' }];
  const s = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-13', [], blok);
  assert(s.find((x) => x.tijd === '11:30').vrij === true);
  assert(s.find((x) => x.tijd === '12:00').vrij === false);
  assert(s.find((x) => x.tijd === '12:30').vrij === false);
  assert(s.find((x) => x.tijd === '13:00').vrij === true);
});
test('sloten: wekelijkse blokkade elke week op die dag', () => {
  const blok = [{ type: 'wekelijks', dag: 'ma', van: '09:00', tot: '10:00' }];
  const dezeWeek = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-13', [], blok);
  const volgendeWeek = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-20', [], blok);
  const dinsdag = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-14', [], blok);
  assert(dezeWeek.find((s) => s.tijd === '09:00').vrij === false);
  assert(volgendeWeek.find((s) => s.tijd === '09:00').vrij === false);
  assert(dinsdag.find((s) => s.tijd === '09:00').vrij === true);
});
test('actieveBlokkades: verlopen eenmalige weg, rest blijft', () => {
  const blok = [
    { type: 'eenmalig', datum: '2026-07-10', van: '09:00', tot: '10:00' },
    { type: 'eenmalig', datum: '2026-07-20', van: '09:00', tot: '10:00' },
    { type: 'wekelijks', dag: 'ma', van: '12:00', tot: '13:00' },
  ];
  const actief = Agenda.actieveBlokkades(blok, '2026-07-13');
  assert(actief.length === 2);
  assert(!actief.some((b) => b.datum === '2026-07-10'));
});
test('zetBlokkades en activeerTenant-default', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Blok BV' });
  const na = OberPoesDb.activeerTenant(t.code);
  assert(Array.isArray(na.blokkades) && na.blokkades.length === 0);
  OberPoesDb.zetBlokkades(t.code, [{ id: 'B1', type: 'wekelijks', dag: 'ma', van: '12:00', tot: '13:00' }]);
  assert(OberPoesDb.vindTenant(t.code).blokkades.length === 1);
});
```

- [ ] **Step 2: Tests draaien → 5 nieuwe FAILs**

Run: `node scripts/run-tests.mjs`

- [ ] **Step 3: Pas js/agenda.js aan**

Vervang de functie `sloten` door:

```javascript
    sloten(openingstijden, slotDuur, datumIso, afspraken, blokkades = []) {
      const dag = openingstijden[dagVan(datumIso)];
      if (!dag.open) return [];
      const bezet = new Set(afspraken.filter((a) => a.datum === datumIso).map((a) => a.tijd));
      const geblokkeerd = blokkades.filter((b) =>
        (b.type === 'eenmalig' && b.datum === datumIso)
        || (b.type === 'wekelijks' && b.dag === dagVan(datumIso)));
      const uit = [];
      for (let m = naarMinuten(dag.van); m + slotDuur <= naarMinuten(dag.tot); m += slotDuur) {
        const tijd = naarTijd(m);
        const inBlokkade = geblokkeerd.some((b) =>
          m < naarMinuten(b.tot) && m + slotDuur > naarMinuten(b.van));
        uit.push({ tijd, vrij: !bezet.has(tijd) && !inBlokkade });
      }
      return uit;
    },
    actieveBlokkades(blokkades, vanafIso) {
      return blokkades.filter((b) => b.type === 'wekelijks' || b.datum >= vanafIso);
    },
```

- [ ] **Step 4: Pas js/db.js aan**

In `activeerTenant`, in het `wijzig`-object: `blokkades: bestaand.blokkades || [],`.
Na `zetOpeningstijden`: `zetBlokkades(code, blokkades) { return this.wijzig(code, { blokkades }); },`

- [ ] **Step 5: Tests draaien → PASS (47/47)**

Run: `node scripts/run-tests.mjs`

- [ ] **Step 6: Commit**

```bash
git add js/agenda.js js/db.js js/tests.js
git commit -m "feat: niet-boekbare perioden in slotberekening en database"
```

---

### Task 2: Beheer-UI voor blokkades en doorgeven aan boekingspagina

**Files:**
- Modify: `js/beheer.js` (renderTijden uitbreiden)
- Modify: `js/tenant.js` (blokkades doorgeven)

**Interfaces:**
- Consumes: `Agenda.actieveBlokkades`, `Agenda.DAG_SLEUTELS/DAG_NAMEN`, `OberPoesDb.zetBlokkades` (Task 1).

- [ ] **Step 1: Breid renderTijden in js/beheer.js uit**

Direct vóór de afsluitende backtick + `;` van de `el('view-tijden').innerHTML = \`...\`;`-toewijzing (na de openingstijden-kaart) een tweede kaart toevoegen. Bereken bovenaan `renderTijden`:

```javascript
    const vandaag = new Date().toISOString().slice(0, 10);
    const blokkades = Agenda.actieveBlokkades(t.blokkades || [], vandaag);
    const dagOpties = Agenda.DAG_SLEUTELS
      .map((d, i) => `<option value="${d}">${Agenda.DAG_NAMEN[i]}</option>`).join('');
    const blokRijen = blokkades.map((b) => `
      <tr>
        <td>${b.omschrijving || '—'}</td>
        <td>${b.type === 'wekelijks'
          ? 'wekelijks ' + Agenda.DAG_NAMEN[Agenda.DAG_SLEUTELS.indexOf(b.dag)]
          : new Date(b.datum + 'T12:00:00').toLocaleDateString('nl-NL')} ${b.van}–${b.tot}</td>
        <td><button class="knop knop-gevaar knop-klein" data-blok-weg="${b.id}">Verwijderen</button></td>
      </tr>`).join('');
```

en in de innerHTML ná de bestaande kaart:

```javascript
      <div class="kaart">
        <h2>Niet-boekbare perioden</h2>
        ${blokkades.length === 0 ? '<p>Geen niet-boekbare perioden.</p>' : `
        <table class="tabel">
          <thead><tr><th>Omschrijving</th><th>Wanneer</th><th></th></tr></thead>
          <tbody>${blokRijen}</tbody>
        </table>`}
        <h3>Periode toevoegen</h3>
        <div class="velden-rij">
          <div class="veld"><label for="blok-type">Type</label>
            <select id="blok-type"><option value="eenmalig">Eenmalig</option><option value="wekelijks">Wekelijks</option></select></div>
          <div class="veld" id="blok-datum-veld"><label for="blok-datum">Datum</label>
            <input id="blok-datum" type="date"></div>
          <div class="veld verborgen" id="blok-dag-veld"><label for="blok-dag">Weekdag</label>
            <select id="blok-dag">${dagOpties}</select></div>
          <div class="veld"><label for="blok-van">Van</label><input id="blok-van" type="time" value="12:00"></div>
          <div class="veld"><label for="blok-tot">Tot</label><input id="blok-tot" type="time" value="13:00"></div>
        </div>
        <div class="veld"><label for="blok-omschrijving">Omschrijving (optioneel)</label>
          <input id="blok-omschrijving" type="text"></div>
        <span class="fout" id="fout-blok"></span>
        <button class="knop" id="knop-blok-toevoegen">Toevoegen</button>
      </div>
```

en registreer onderaan `renderTijden` de handlers:

```javascript
    el('blok-type').addEventListener('change', () => {
      const wekelijks = el('blok-type').value === 'wekelijks';
      el('blok-datum-veld').classList.toggle('verborgen', wekelijks);
      el('blok-dag-veld').classList.toggle('verborgen', !wekelijks);
    });
    el('view-tijden').querySelectorAll('button[data-blok-weg]').forEach((k) => {
      k.addEventListener('click', () => {
        OberPoesDb.zetBlokkades(code,
          (huidigeTenant().blokkades || []).filter((b) => b.id !== k.dataset.blokWeg));
        renderTijden();
      });
    });
    el('knop-blok-toevoegen').addEventListener('click', () => {
      const type = el('blok-type').value;
      const datum = el('blok-datum').value;
      const van = el('blok-van').value;
      const tot = el('blok-tot').value;
      if (!van || !tot || van >= tot) {
        el('fout-blok').textContent = 'Vul geldige tijden in (van moet vóór tot liggen).';
        return;
      }
      if (type === 'eenmalig' && !datum) {
        el('fout-blok').textContent = 'Kies een datum voor een eenmalige periode.';
        return;
      }
      const blokkade = {
        id: OberPoesDb.genereerCode(),
        type, van, tot,
        omschrijving: el('blok-omschrijving').value.trim(),
      };
      if (type === 'eenmalig') blokkade.datum = datum;
      else blokkade.dag = el('blok-dag').value;
      OberPoesDb.zetBlokkades(code, [...(huidigeTenant().blokkades || []), blokkade]);
      renderTijden();
    });
```

- [ ] **Step 2: Geef blokkades door in js/tenant.js**

In `renderTijden` van tenant.js, vervang:

```javascript
    const sloten = Agenda.sloten(tenant.openingstijden, tenant.slotDuur || 30,
      gekozenDatum, OberPoesDb.afsprakenVoor(tenant.code));
```

door:

```javascript
    const sloten = Agenda.sloten(tenant.openingstijden, tenant.slotDuur || 30,
      gekozenDatum, OberPoesDb.afsprakenVoor(tenant.code), tenant.blokkades || []);
```

- [ ] **Step 3: Regressietests + browserverificatie**

`node scripts/run-tests.mjs` → PASS. Browser: beheer → Openingstijden → wekelijkse blokkade "lunchpauze" ma–vr? (één dag kiezen) toevoegen → zichtbaar in lijst → boekingspagina: sloten in dat tijdvak uitgegrijsd op die weekdag; eenmalige blokkade op een datum → alleen die dag; eenmalige blokkade met datum in het verleden (via console) → niet in de beheerlijst; verwijderen werkt.

- [ ] **Step 4: Commit**

```bash
git add js/beheer.js js/tenant.js
git commit -m "feat: beheer van niet-boekbare perioden met doorwerking in agenda"
```

---

### Task 3: Factuuropbouw — keuzelijst, bewerkvelden en verwijderbare conceptlijst

**Files:**
- Modify: `js/beheer.js` (renderFactuurOpbouw herschrijven)

**Interfaces:**
- Consumes: `bedragNaarCent`, `btwLabel`, `Facturatie.totalen/euro`, `OberPoesDb.maakFactuur/zetFactuurRegels`.
- Produces: opbouwscherm met `#regel-bron`-select, bewerkvelden, conceptlijst met verwijderknoppen; `toonMail` ongewijzigd.

- [ ] **Step 1: Vervang de volledige functie renderFactuurOpbouw in js/beheer.js**

```javascript
  // --- Factureren van een afspraak ---
  function renderFactuurOpbouw(afspraakId) {
    const afspraak = OberPoesDb.afsprakenVoor(code).find((a) => a.id === afspraakId);
    if (!afspraak) return;
    const conceptRegels = [];

    const bronOpties = (huidigeTenant().factuurRegels || []).map((r) =>
      `<option value="${r.id}">${r.naam} (${btwLabel(r.btw)}, ${Facturatie.euro(r.bedragCent)})</option>`).join('');

    el('factuur-opbouw').innerHTML = `
      <div class="kaart">
        <h2>Factuur voor ${afspraak.naam} — ${afspraak.datum} om ${afspraak.tijd}</h2>
        <div class="veld">
          <label for="regel-bron">Regel kiezen of nieuw maken</label>
          <select id="regel-bron">
            <option value="">— nieuwe regel —</option>
            ${bronOpties}
          </select>
        </div>
        <div class="velden-rij">
          <div class="veld"><label for="opbouw-naam">Omschrijving</label>
            <input id="opbouw-naam" type="text"></div>
          <div class="veld"><label for="opbouw-btw">Btw</label>
            <select id="opbouw-btw"><option value="hoog">21% (hoog)</option><option value="laag">9% (laag)</option></select></div>
          <div class="veld"><label for="opbouw-bedrag">Bedrag incl. btw (€)</label>
            <input id="opbouw-bedrag" type="number" step="0.01" min="0"></div>
        </div>
        <label><input type="checkbox" id="opbouw-bewaar"> Ook bewaren als voorgedefinieerde regel</label>
        <span class="fout" id="fout-opbouw"></span><br>
        <button class="knop knop-secundair" id="knop-opbouw-toevoegen">Toevoegen aan factuur</button>
        <h3>Factuurregels op deze factuur</h3>
        <div id="concept-lijst"></div>
        <div class="melding melding-info" id="factuur-totaal">Nog geen regels toegevoegd.</div>
        <span class="fout" id="fout-factuur"></span>
        <button class="knop" id="knop-factureer">Factureren en mailen</button>
        <button class="knop knop-secundair" id="knop-opbouw-sluit">Sluiten</button>
      </div>`;
    el('factuur-opbouw').scrollIntoView({ behavior: 'smooth' });

    function renderConcept() {
      el('concept-lijst').innerHTML = conceptRegels.length === 0
        ? '<p><em>Nog geen regels toegevoegd.</em></p>'
        : `<table class="tabel"><tbody>${conceptRegels.map((r, i) => `
            <tr>
              <td>${r.naam}</td>
              <td>${btwLabel(r.btw)}</td>
              <td>${Facturatie.euro(r.bedragCent)}</td>
              <td><button class="knop knop-gevaar knop-klein" data-concept-weg="${i}">Verwijderen</button></td>
            </tr>`).join('')}</tbody></table>`;
      el('concept-lijst').querySelectorAll('button[data-concept-weg]').forEach((k) => {
        k.addEventListener('click', () => {
          conceptRegels.splice(Number(k.dataset.conceptWeg), 1);
          renderConcept();
        });
      });
      if (conceptRegels.length === 0) {
        el('factuur-totaal').textContent = 'Nog geen regels toegevoegd.';
      } else {
        const tot = Facturatie.totalen(conceptRegels);
        el('factuur-totaal').innerHTML =
          `Totaal: <strong>${Facturatie.euro(tot.inclCent)}</strong> incl. btw `
          + `(excl. ${Facturatie.euro(tot.exclCent)}, btw 21%: ${Facturatie.euro(tot.btwHoogCent)}, `
          + `btw 9%: ${Facturatie.euro(tot.btwLaagCent)})`;
      }
    }
    renderConcept();

    el('regel-bron').addEventListener('change', () => {
      const gekozen = (huidigeTenant().factuurRegels || [])
        .find((r) => r.id === el('regel-bron').value);
      el('opbouw-naam').value = gekozen ? gekozen.naam : '';
      el('opbouw-btw').value = gekozen ? gekozen.btw : 'hoog';
      el('opbouw-bedrag').value = gekozen ? (gekozen.bedragCent / 100).toFixed(2) : '';
      el('fout-opbouw').textContent = '';
    });

    el('knop-opbouw-toevoegen').addEventListener('click', () => {
      const naam = el('opbouw-naam').value.trim();
      const bedragCent = bedragNaarCent(el('opbouw-bedrag').value);
      if (naam.length < 2 || bedragCent === null) {
        el('fout-opbouw').textContent = 'Vul een omschrijving en een bedrag groter dan 0 in.';
        return;
      }
      el('fout-opbouw').textContent = '';
      const regel = { naam, btw: el('opbouw-btw').value, bedragCent };
      conceptRegels.push(regel);
      if (el('opbouw-bewaar').checked) {
        OberPoesDb.zetFactuurRegels(code, [
          ...(huidigeTenant().factuurRegels || []),
          { id: OberPoesDb.genereerCode(), ...regel },
        ]);
        el('opbouw-bewaar').checked = false;
      }
      el('regel-bron').value = '';
      el('opbouw-naam').value = '';
      el('opbouw-bedrag').value = '';
      renderConcept();
    });

    el('knop-opbouw-sluit').addEventListener('click', () => { el('factuur-opbouw').innerHTML = ''; });

    el('knop-factureer').addEventListener('click', () => {
      if (conceptRegels.length === 0) {
        el('fout-factuur').textContent = 'Voeg minimaal één factuurregel toe.';
        return;
      }
      const factuur = OberPoesDb.maakFactuur({ tenantCode: code, afspraakId, regels: conceptRegels });
      if (!factuur) {
        el('fout-factuur').textContent = 'Deze afspraak is al gefactureerd.';
        return;
      }
      renderAgenda();
      toonMail(factuur);
    });
  }
```

- [ ] **Step 2: Regressietests + browserverificatie**

`node scripts/run-tests.mjs` → PASS. Browser: Factureren → voorgedefinieerde regel kiezen → velden gevuld → bedrag aanpassen → Toevoegen → conceptlijst toont aangepaste kopie; voorgedefinieerd lijstje ongewijzigd; nieuwe regel toevoegen; één regel verwijderen → totaal past aan; factureren met conceptlijst → factuur bevat exact die regels.

- [ ] **Step 3: Commit**

```bash
git add js/beheer.js
git commit -m "feat: factuuropbouw met keuzelijst, bewerkbare velden en conceptlijst"
```
