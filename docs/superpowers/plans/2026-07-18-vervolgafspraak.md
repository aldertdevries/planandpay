# Vervolgafspraak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na het maken van een rekening kan de beheerder direct een vervolgafspraak inplannen: termijn (getal + dagen/weken/maanden, per klant onthouden), open dagen rond de doeldatum met eerder/later-navigatie (nooit eerder dan morgen), dag + tijd kiezen, afspraak vastleggen en de klant een boekingsbevestiging (demo) sturen.

**Architecture:** Statische HTML/JS met `localStorage` (`OberPoesDb`). Datumrekenwerk als pure, Node-testbare functies in `js/agenda.js` (`datumPlus`, `vensterStart`); termijnopslag als setter in `js/db.js` (`zetKlantVervolgTermijn`, klantrecord via het bestaande upsert-patroon `voegKlantToe`); de UI als vervolgblok onder de mailkaart in `toonMail` (`js/beheer.js`), hergebruik van `Agenda.komendeOpenDagen`/`Agenda.sloten`/`Kalender.ics` (kalender.js is al geladen in beheer.html).

**Tech Stack:** Vanilla JS (geen build), localStorage, Node-testharnas (`node scripts/run-tests.mjs`), browser-preview op poort 8321 (launch-naam `oberpoes`).

## Global Constraints

- B1-Nederlands in alle zichtbare tekst.
- De vervolgafspraak kan nooit vandaag zijn: het dagvenster begint op z'n vroegst **morgen** (`vensterStart` = max(morgen, doeldatum − 3 dagen)).
- Termijn: één geheel getal ≥ 1 + eenheid `dagen|weken|maanden`; leeg/ongeldig → foutmelding "Vul een termijn in (getal van minimaal 1)." en geen dagstap.
- Doeldatum = datum van de gefactureerde afspraak + termijn (`Agenda.datumPlus`); maanden via `setMonth` (natuurlijke JS-overloop).
- Termijn wordt per klant opgeslagen (`vervolgTermijn = { aantal, eenheid }`) en de volgende keer voorgevuld; klant zo nodig eerst upserten via `voegKlantToe`.
- Mail: bestaand sjabloon `boeking` met ics-bijlage en verzet/annuleer-link (zoals tenant.js).
- Bestaande flows (rekening maken, mailkaart, agenda-views, boekingspagina) ongewijzigd behalve: de sluitknop van de mailkaart roept voortaan `renderAgenda()` aan (ververst de lijst én maakt `factuur-opbouw` leeg omdat de agenda-template een lege `factuur-opbouw` bevat). Niets hernoemen.
- Testcommando: `node scripts/run-tests.mjs` (vanuit C:\Projects\oberpoes). Huidige stand: 77/77; deze feature voegt 3 tests toe → 80/80.
- Testbestand: `js/tests.js` (`test(naam, fn)` + `assert(voorwaarde, bericht?)`).

---

### Task 1: agenda.js — `datumPlus` en `vensterStart` (TDD)

**Files:**
- Modify: `js/agenda.js` (direct ná `komendeOpenDagen`, ~regel 33)
- Test: `js/tests.js` (ná de laatste test `'markeerBetaald: weigert niet-open rekening en ongeldige wijze'`, aan het eind van het bestand)

**Interfaces:**
- Consumes: niets nieuws (module-interne datumconventie `T12:00:00`).
- Produces: `Agenda.datumPlus(datumIso, aantal, eenheid)` → ISO-datum; `Agenda.vensterStart(doeldatumIso, vandaagIso)` → ISO-datum (max(morgen, doeldatum − 3 dagen)). Task 3 roept exact deze namen aan.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `js/tests.js`, direct ná de test `'markeerBetaald: weigert niet-open rekening en ongeldige wijze'` (de laatste test in het bestand):

```js
test('datumPlus: dagen, weken, maanden en maand-overloop', () => {
  assert(Agenda.datumPlus('2026-07-17', 10, 'dagen') === '2026-07-27', 'dagen');
  assert(Agenda.datumPlus('2026-07-17', 6, 'weken') === '2026-08-28', 'weken');
  assert(Agenda.datumPlus('2026-11-15', 3, 'maanden') === '2027-02-15', 'maanden over jaargrens');
  assert(Agenda.datumPlus('2026-01-31', 1, 'maanden') === '2026-03-03', 'maand-overloop (feb 2026 heeft 28 dagen)');
});

test('vensterStart: nooit eerder dan morgen', () => {
  assert(Agenda.vensterStart('2026-09-01', '2026-07-17') === '2026-08-29', 'ver vooruit: doeldatum - 3 dagen');
  assert(Agenda.vensterStart('2026-07-10', '2026-07-17') === '2026-07-18', 'doeldatum in verleden -> morgen');
  assert(Agenda.vensterStart('2026-07-17', '2026-07-17') === '2026-07-18', 'doeldatum vandaag -> morgen');
  assert(Agenda.vensterStart('2026-07-19', '2026-07-17') === '2026-07-18', 'doeldatum overmorgen -> morgen');
});
```

- [ ] **Step 2: Draai de tests en zie de nieuwe tests falen**

Run: `node scripts/run-tests.mjs`
Verwacht: de 2 nieuwe tests FALEN (`datumPlus is not a function`); de bestaande 77 blijven groen.

- [ ] **Step 3: Implementeer beide functies**

In `js/agenda.js`, direct ná de sluitregel van `komendeOpenDagen` (`},` na `return dagen;`), toevoegen:

```js
    datumPlus(datumIso, aantal, eenheid) {
      const d = new Date(datumIso + 'T12:00:00');
      if (eenheid === 'weken') d.setDate(d.getDate() + aantal * 7);
      else if (eenheid === 'maanden') d.setMonth(d.getMonth() + aantal);
      else d.setDate(d.getDate() + aantal);
      return d.toISOString().slice(0, 10);
    },
    vensterStart(doeldatumIso, vandaagIso) {
      const morgen = new Date(vandaagIso + 'T12:00:00');
      morgen.setDate(morgen.getDate() + 1);
      const morgenIso = morgen.toISOString().slice(0, 10);
      const start = new Date(doeldatumIso + 'T12:00:00');
      start.setDate(start.getDate() - 3);
      const startIso = start.toISOString().slice(0, 10);
      return startIso > morgenIso ? startIso : morgenIso;
    },
```

- [ ] **Step 4: Draai de tests en zie alles groen**

Run: `node scripts/run-tests.mjs`
Verwacht: 79/79 geslaagd.

- [ ] **Step 5: Commit**

```bash
git add js/agenda.js js/tests.js
git commit -m "feat: datumPlus en vensterStart voor de vervolgafspraak"
```

---

### Task 2: db.js — `zetKlantVervolgTermijn` (TDD)

**Files:**
- Modify: `js/db.js` (direct ná `zoekKlantOpContact`, ~regel 119)
- Test: `js/tests.js` (ná de test `'vensterStart: nooit eerder dan morgen'` uit Task 1)

**Interfaces:**
- Consumes: `lees()`/`schrijf()` (module-intern); `voegKlantToe`/`vindKlant` (bestaand, in tests).
- Produces: `OberPoesDb.zetKlantVervolgTermijn(klantId, termijn)` → bijgewerkt klantrecord met `vervolgTermijn = { aantal, eenheid }`, of `null` bij ongeldige termijn (aantal geen geheel getal ≥ 1, eenheid niet `dagen|weken|maanden`) of onbekende id. Task 3 roept exact deze naam aan.

- [ ] **Step 1: Schrijf de falende test**

Voeg toe aan `js/tests.js`, direct ná de test `'vensterStart: nooit eerder dan morgen'`:

```js
test('zetKlantVervolgTermijn: opslaan, ongeldig geweigerd', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Vervolg BV' });
  const k = OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Piet', email: 'piet@x.nl' });
  const na = OberPoesDb.zetKlantVervolgTermijn(k.id, { aantal: 6, eenheid: 'weken' });
  assert(na.vervolgTermijn.aantal === 6 && na.vervolgTermijn.eenheid === 'weken', 'opgeslagen');
  assert(OberPoesDb.vindKlant(k.id).vervolgTermijn.eenheid === 'weken', 'teruglezen');
  assert(OberPoesDb.zetKlantVervolgTermijn(k.id, { aantal: 0, eenheid: 'weken' }) === null, 'aantal 0 -> null');
  assert(OberPoesDb.zetKlantVervolgTermijn(k.id, { aantal: 2, eenheid: 'jaren' }) === null, 'onbekende eenheid -> null');
  assert(OberPoesDb.vindKlant(k.id).vervolgTermijn.aantal === 6, 'onveranderd na ongeldige poging');
  assert(OberPoesDb.zetKlantVervolgTermijn('BESTAATNIET', { aantal: 2, eenheid: 'weken' }) === null, 'onbekende klant -> null');
});
```

- [ ] **Step 2: Draai de tests en zie de nieuwe test falen**

Run: `node scripts/run-tests.mjs`
Verwacht: de nieuwe test FAALT (`zetKlantVervolgTermijn is not a function`); 79 bestaande groen.

- [ ] **Step 3: Implementeer de setter**

In `js/db.js`, direct ná de sluitregel van `zoekKlantOpContact` (`},`), toevoegen:

```js
    zetKlantVervolgTermijn(klantId, termijn) {
      const geldig = termijn && Number.isInteger(termijn.aantal) && termijn.aantal >= 1
        && ['dagen', 'weken', 'maanden'].includes(termijn.eenheid);
      if (!geldig) return null;
      const db = lees();
      const klant = db.klanten.find((k) => k.id === klantId);
      if (!klant) return null;
      klant.vervolgTermijn = { aantal: termijn.aantal, eenheid: termijn.eenheid };
      schrijf(db);
      return klant;
    },
```

- [ ] **Step 4: Draai de tests en zie alles groen**

Run: `node scripts/run-tests.mjs`
Verwacht: 80/80 geslaagd.

- [ ] **Step 5: Commit**

```bash
git add js/db.js js/tests.js
git commit -m "feat: vervolgtermijn per klant opslaan"
```

---

### Task 3: beheer.js — vervolgblok onder de mailkaart

**Files:**
- Modify: `js/beheer.js` (`toonMail` ~regel 361-404 + nieuwe functie `bindVervolg` direct erna)

**Interfaces:**
- Consumes: `Agenda.datumPlus(datumIso, aantal, eenheid)` en `Agenda.vensterStart(doeldatumIso, vandaagIso)` (Task 1); `OberPoesDb.zetKlantVervolgTermijn(klantId, termijn)` (Task 2); bestaand: `voegKlantToe`, `afsprakenVoor`, `maakAfspraak`, `Agenda.komendeOpenDagen/sloten/DAG_NAMEN`, `Kalender.ics/icsDataUrl`, `Berichten`, `renderAgenda`, `huidigeTenant`, `el`, `code`.
- Produces: n.v.t. (eindpunt).

- [ ] **Step 1: Breid de `toonMail`-template uit en verwissel de sluitknop-actie**

In `js/beheer.js`, vervang het slot van `toonMail`:

```js
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

door:

```js
    el('factuur-opbouw').innerHTML = `
      <div class="kaart">
        <h2>Mail verzonden (demo)</h2>
        <div class="melding melding-info">${inhoud}</div>
        <button class="knop knop-secundair" id="knop-mail-sluit">Sluiten</button>
      </div>
      <div class="kaart" id="vervolg-blok">
        <h3>Vervolgafspraak inplannen</h3>
        <div class="velden-rij" style="max-width: 360px;">
          <div class="veld"><label for="vervolg-aantal">Over</label>
            <input id="vervolg-aantal" type="number" min="1"></div>
          <div class="veld"><label for="vervolg-eenheid">Eenheid</label>
            <select id="vervolg-eenheid">
              <option value="dagen">dagen</option>
              <option value="weken">weken</option>
              <option value="maanden">maanden</option>
            </select></div>
        </div>
        <span class="fout" id="fout-vervolg" aria-live="polite"></span><br>
        <button class="knop knop-secundair" id="knop-vervolg-zoek">Zoek dagen</button>
        <div id="vervolg-dagen"></div>
        <div id="vervolg-tijden"></div>
        <div id="vervolg-klaar"></div>
      </div>`;
    el('factuur-opbouw').scrollIntoView({ behavior: 'smooth' });
    el('knop-mail-sluit').addEventListener('click', () => { renderAgenda(); });
    bindVervolg(factuur, t);
  }
```

(De agenda-template bevat zelf een lege `<div id="factuur-opbouw"></div>`, dus `renderAgenda()` ruimt de kaarten op én toont de eventueel nieuwe afspraak in de lijst.)

- [ ] **Step 2: Voeg `bindVervolg` toe**

In `js/beheer.js`, direct ná de sluitaccolade van `toonMail`, toevoegen:

```js
  // Vervolgafspraak: termijn per klant onthouden, dag rond de doeldatum kiezen.
  function bindVervolg(factuur, t) {
    const bronAfspraak = OberPoesDb.afsprakenVoor(code).find((a) => a.id === factuur.afspraakId);
    if (!bronAfspraak) { el('vervolg-blok').classList.add('verborgen'); return; }
    const klant = OberPoesDb.voegKlantToe({
      tenantCode: t.code, naam: bronAfspraak.naam, email: bronAfspraak.email,
      telefoon: bronAfspraak.telefoon, straat: bronAfspraak.straat,
      huisnummer: bronAfspraak.huisnummer, postcode: bronAfspraak.postcode,
      plaats: bronAfspraak.plaats,
    });
    if (klant.vervolgTermijn) {
      el('vervolg-aantal').value = klant.vervolgTermijn.aantal;
      el('vervolg-eenheid').value = klant.vervolgTermijn.eenheid;
    }

    let vensterVan = null;
    let gekozenDatum = null;

    const datumLabel = (iso) => {
      const d = new Date(iso + 'T12:00:00');
      return `${Agenda.DAG_NAMEN[d.getDay()].slice(0, 2)} ${d.getDate()}/${d.getMonth() + 1}`;
    };
    const morgen = () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    const schuifVenster = (dagen) => {
      const d = new Date(vensterVan + 'T12:00:00');
      d.setDate(d.getDate() + dagen);
      vensterVan = d.toISOString().slice(0, 10);
      if (vensterVan < morgen()) vensterVan = morgen();
    };

    function renderVervolgDagen(doeldatum) {
      const dagen = Agenda.komendeOpenDagen(t.openingstijden, vensterVan, 14);
      el('vervolg-dagen').innerHTML = `
        <p>Rond <strong>${doeldatum}</strong> — kies een dag:</p>
        <div class="keuze-grid">${dagen.map((iso) =>
          `<button type="button" class="knop knop-secundair${iso === gekozenDatum ? ' gekozen' : ''}" data-vervolg-dag="${iso}">${datumLabel(iso)}</button>`).join('')
          || '<em>Geen open dagen in deze periode.</em>'}</div>
        <p>
          <button type="button" class="knop knop-secundair knop-klein" id="vervolg-eerder" ${vensterVan <= morgen() ? 'disabled' : ''}>‹ eerder</button>
          <button type="button" class="knop knop-secundair knop-klein" id="vervolg-later">later ›</button>
        </p>`;
      el('vervolg-dagen').querySelectorAll('button[data-vervolg-dag]').forEach((k) => {
        k.addEventListener('click', () => {
          gekozenDatum = k.dataset.vervolgDag;
          renderVervolgDagen(doeldatum);
          renderVervolgTijden();
        });
      });
      el('vervolg-eerder').addEventListener('click', () => {
        schuifVenster(-14);
        gekozenDatum = null;
        el('vervolg-tijden').innerHTML = '';
        renderVervolgDagen(doeldatum);
      });
      el('vervolg-later').addEventListener('click', () => {
        schuifVenster(14);
        gekozenDatum = null;
        el('vervolg-tijden').innerHTML = '';
        renderVervolgDagen(doeldatum);
      });
    }

    function renderVervolgTijden() {
      const sloten = Agenda.sloten(t.openingstijden, t.slotDuur || 30, gekozenDatum,
        OberPoesDb.afsprakenVoor(t.code), t.blokkades || [], t.capaciteit || 1);
      el('vervolg-tijden').innerHTML = `
        <p>Kies een tijd op ${datumLabel(gekozenDatum)}:</p>
        <div class="keuze-grid">${sloten.map((s) =>
          `<button type="button" class="knop knop-secundair" data-vervolg-tijd="${s.tijd}" ${s.vrij ? '' : 'disabled'}>${s.tijd}</button>`).join('')
          || '<em>Op deze dag zijn geen tijden vrij.</em>'}</div>
        <span class="fout" id="fout-vervolg-tijd" aria-live="polite"></span>`;
      el('vervolg-tijden').querySelectorAll('button[data-vervolg-tijd]:not([disabled])').forEach((k) => {
        k.addEventListener('click', () => legVervolgVast(k.dataset.vervolgTijd));
      });
    }

    function legVervolgVast(tijd) {
      const nieuw = OberPoesDb.maakAfspraak({
        tenantCode: t.code, datum: gekozenDatum, tijd,
        naam: bronAfspraak.naam, email: bronAfspraak.email,
        postcode: bronAfspraak.postcode, huisnummer: bronAfspraak.huisnummer,
        straat: bronAfspraak.straat, plaats: bronAfspraak.plaats,
        extra: '', telefoon: bronAfspraak.telefoon,
      });
      if (!nieuw) {
        el('fout-vervolg-tijd').textContent = 'Deze tijd is net bezet. Kies een andere tijd.';
        renderVervolgTijden();
        return;
      }
      OberPoesDb.zetKlantVervolgTermijn(klant.id, {
        aantal: parseInt(el('vervolg-aantal').value, 10),
        eenheid: el('vervolg-eenheid').value,
      });
      const mailTekst = Berichten.render(Berichten.voor(t, 'boeking'), {
        naam: nieuw.naam, tenant: t.naam,
        datum: datumLabel(nieuw.datum), tijd: nieuw.tijd,
      });
      const ics = Kalender.ics({
        titel: `Afspraak bij ${t.naam}`,
        locatie: `${t.straat} ${t.huisnummer}, ${t.plaats}`,
        omschrijving: 'Vervolgafspraak',
        datum: nieuw.datum, tijd: nieuw.tijd,
        duurMinuten: t.slotDuur || 30, uid: nieuw.id,
      });
      el('vervolg-dagen').innerHTML = '';
      el('vervolg-tijden').innerHTML = '';
      el('vervolg-klaar').innerHTML = `
        <div class="melding melding-goed" role="status">
          Vervolgafspraak vastgelegd: <strong>${datumLabel(nieuw.datum)} om ${nieuw.tijd}</strong>.
        </div>
        <div class="melding melding-info">
          <strong>Demo — bevestigingsmail:</strong><br>
          <strong>Aan:</strong> ${nieuw.email}<br>
          <strong>Onderwerp:</strong> Afspraakbevestiging — ${t.naam}<br><br>
          ${Berichten.naarHtml(mailTekst)}<br><br>
          Wilt u de afspraak wijzigen of annuleren? Gebruik dan
          <a href="afspraak.html?id=${nieuw.id}" target="_blank">deze link</a>.<br>
          <strong>Bijlage:</strong>
          <a download="afspraak.ics" href="${Kalender.icsDataUrl(ics)}">📅 afspraak.ics</a>
        </div>`;
    }

    el('knop-vervolg-zoek').addEventListener('click', () => {
      const aantal = parseInt(el('vervolg-aantal').value, 10);
      const eenheid = el('vervolg-eenheid').value;
      if (!Number.isInteger(aantal) || aantal < 1) {
        el('fout-vervolg').textContent = 'Vul een termijn in (getal van minimaal 1).';
        return;
      }
      el('fout-vervolg').textContent = '';
      const doeldatum = Agenda.datumPlus(bronAfspraak.datum, aantal, eenheid);
      vensterVan = Agenda.vensterStart(doeldatum, new Date().toISOString().slice(0, 10));
      gekozenDatum = null;
      el('vervolg-tijden').innerHTML = '';
      el('vervolg-klaar').innerHTML = '';
      renderVervolgDagen(doeldatum);
    });
  }
```

- [ ] **Step 3: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 80/80 geslaagd.

- [ ] **Step 4: Commit**

```bash
git add js/beheer.js
git commit -m "feat: vervolgafspraak inplannen na het maken van een rekening"
```

---

### Task 4: Browserverificatie end-to-end en push

**Files:** geen codewijziging verwacht (alleen als verificatie een fout blootlegt).

**Interfaces:**
- Consumes: alles uit Task 1-3.

- [ ] **Step 1: Start de preview-server**

Gebruik de browser-preview (`preview_start` met naam `oberpoes`, poort 8321). Niet via Bash starten.

- [ ] **Step 2: Beheersessie en testdata**

Navigeer naar `beheer.html`; zo nodig demo-data laden, sessie zetten (`localStorage.setItem('oberpoes_tenant_<CODE>', String(Date.now()))`) en herladen. Zorg voor een afspraak zonder rekening (zo nodig via de boekingspagina een nieuwe afspraak maken).

- [ ] **Step 3: Vervolgblok na rekening maken**

Afspraken → "Rekening maken" → product toevoegen → "Rekening maken en mailen". Verwacht: onder de mailkaart het blok "Vervolgafspraak inplannen" met leeg termijnveld (eerste keer).

- [ ] **Step 4: Termijn en dagvenster**

Vul 6 weken in → "Zoek dagen". Verwacht: doeldatum = afspraakdatum + 42 dagen; open dagen rond die datum; "later ›" schuift verder; "‹ eerder" schuift terug en is disabled zodra het venster op morgen begint. Leeg veld of 0 → foutmelding.

- [ ] **Step 5: Vastleggen en mail**

Kies een dag en een vrije tijd. Verwacht: melding "Vervolgafspraak vastgelegd", demo-boekingsmail met ics-bijlage en verzetlink; de afspraak bestaat in de db (`OberPoesDb.afsprakenVoor(...)`) op de gekozen dag/tijd met de klantgegevens van de originele afspraak. "Sluiten" op de mailkaart ververst de agenda-lijst en de nieuwe afspraak staat erin.

- [ ] **Step 6: Termijn onthouden**

Maak bij een andere (of de nieuwe) afspraak van dezelfde klant een rekening. Verwacht: het termijnveld staat voorgevuld met 6 weken.

- [ ] **Step 7: Nooit vandaag**

Kies bij een verse rekening een termijn van 1 dag bij een afspraak van vandaag of eerder (demo-afspraken liggen vaak op vandaag): verwacht dat het dagvenster op z'n vroegst morgen begint (geen knop voor vandaag).

- [ ] **Step 8: Draai de volledige testset nog één keer**

Run: `node scripts/run-tests.mjs`
Verwacht: 80/80 geslaagd.

- [ ] **Step 9: Push**

```bash
git push origin master
```

---

## Self-Review

**Spec coverage:**
- `datumPlus` + `vensterStart` (incl. nooit-vóór-morgen) → Task 1.
- `zetKlantVervolgTermijn` (validatie, opslag) → Task 2.
- Vervolgblok: termijnstap met voorvullen (upsert), dagstap rond doeldatum met eerder/later en morgen-grens, tijdstap met capaciteit/blokkades, vastleggen + termijn opslaan + boekingsmail met ics/verzetlink, slot-bezet-melding, lege-termijn-foutmelding, "geen open dagen"-melding → Task 3.
- Sluitknop ververst agenda (nieuwe afspraak zichtbaar) → Task 3 Step 1.
- Tests 80/80 + browser-e2e (incl. termijn onthouden en nooit-vandaag) → Task 1/2/4.

**Placeholder scan:** geen TBD/TODO; alle codestappen volledig.

**Type consistency:** `datumPlus(datumIso, aantal, eenheid)` en `vensterStart(doeldatumIso, vandaagIso)` (Task 1) ↔ aanroepen in Task 3; `zetKlantVervolgTermijn(klantId, {aantal, eenheid})` (Task 2) ↔ aanroep in Task 3; element-ids (`vervolg-aantal`, `vervolg-eenheid`, `fout-vervolg`, `knop-vervolg-zoek`, `vervolg-dagen`, `vervolg-tijden`, `vervolg-klaar`, `vervolg-eerder`, `vervolg-later`, `fout-vervolg-tijd`, `vervolg-blok`) consistent binnen Task 3; `bindVervolg(factuur, t)` gedefinieerd en aangeroepen in Task 3.
