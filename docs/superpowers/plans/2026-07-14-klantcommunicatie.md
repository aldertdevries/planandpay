# Klantcommunicatie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ics-agendabijlagen, QR-code in het profiel, betalingsbevestiging, instelbare berichtteksten en een zakelijkere factuur met instelbare voettekst — daarna push naar GitHub.

**Architecture:** Twee nieuwe pure modules (`js/kalender.js` voor ics, `js/berichten.js` voor sjablonen), twee kleine db-setters, en integratie in de vier bestaande mail-simulaties (tenant/afspraak/beheer/betaal). Beheer krijgt een tabblad Berichten en het profiel krijgt QR + factuurtekst. `factuur.html`/`js/factuur.js` worden zakelijker vormgegeven.

**Tech Stack:** Bestaand vanilla HTML/CSS/JS; QR via `api.qrserver.com` (gratis, geen key).

## Global Constraints

- Placeholders exact: `{naam}` `{tenant}` `{datum}` `{tijd}` `{nummer}` `{bedrag}`; onbekende placeholders blijven letterlijk staan.
- ics: CRLF-regeleinden, lokale tijd `YYYYMMDDTHHMMSS`, eind = start + slotDuur, `UID:<afspraakId>@kassagenda`.
- Vervaldatum factuur = factuurdatum + 14 dagen; standaard factuurtekst: "Gelieve het bedrag binnen 14 dagen over te maken onder vermelding van het factuurnummer."
- Onderwerpregels en bijlage-links blijven vaste mail-onderdelen buiten de sjablonen.
- Script-laadvolgorde: pure modules vóór `db.js`, paginascript als laatste.

---

### Task 1: Modules kalender + berichten + db-setters (TDD)

**Files:**
- Create: `js/kalender.js`, `js/berichten.js`
- Modify: `js/db.js`, `js/tests.js`, `tests.html`, `scripts/run-tests.mjs`

**Interfaces:**
- Produces:
  - `Kalender.ics({titel, locatie, omschrijving, datum, tijd, duurMinuten, uid}) → string`
  - `Kalender.icsDataUrl(inhoud) → string`
  - `Berichten.STANDAARD` (sleutels `boeking`, `verzet`, `factuur`, `betaling`), `Berichten.STANDAARD_FACTUURVOETTEKST`
  - `Berichten.render(sjabloon, data) → string`, `Berichten.voor(tenant, type) → string`, `Berichten.naarHtml(tekst) → string`
  - `OberPoesDb.zetBerichten(code, berichten)`, `OberPoesDb.zetFactuurVoettekst(code, tekst)`

- [ ] **Step 1: Failende tests (js/tests.js, vóór afsluitende `OberPoesDb.wisAlles();`)**

```javascript
// --- Klantcommunicatie ---
test('ics: start, eind over uurgrens en verplichte velden', () => {
  const ics = Kalender.ics({ titel: 'Afspraak', locatie: 'Dam 1, Amsterdam',
    omschrijving: 'Knippen', datum: '2026-07-14', tijd: '16:45', duurMinuten: 30, uid: 'AB12' });
  assert(ics.includes('DTSTART:20260714T164500'));
  assert(ics.includes('DTEND:20260714T171500'), 'eind over uurgrens');
  assert(ics.includes('SUMMARY:Afspraak') && ics.includes('LOCATION:Dam 1, Amsterdam'));
  assert(ics.includes('UID:AB12@kassagenda'));
  assert(ics.startsWith('BEGIN:VCALENDAR') && ics.includes('END:VEVENT'));
  assert(ics.includes('\r\n'), 'CRLF');
});
test('berichten: render vervangt placeholders, onbekend blijft staan', () => {
  const uit = Berichten.render('Hoi {naam}, tot {datum}! {onbekend}', { naam: 'Jan', datum: 'morgen' });
  assert(uit === 'Hoi Jan, tot morgen! {onbekend}', 'kreeg: ' + uit);
});
test('berichten: tenant-tekst wint van standaard', () => {
  assert(Berichten.voor({}, 'boeking') === Berichten.STANDAARD.boeking);
  assert(Berichten.voor({ berichten: { boeking: 'Eigen tekst {naam}' } }, 'boeking') === 'Eigen tekst {naam}');
  assert(Berichten.voor({ berichten: { boeking: 'X' } }, 'factuur') === Berichten.STANDAARD.factuur);
});
test('zetBerichten en zetFactuurVoettekst', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Tekst BV' });
  OberPoesDb.zetBerichten(t.code, { boeking: 'Eigen' });
  OberPoesDb.zetFactuurVoettekst(t.code, 'Betaal snel.');
  const na = OberPoesDb.vindTenant(t.code);
  assert(na.berichten.boeking === 'Eigen' && na.factuurVoettekst === 'Betaal snel.');
});
```

- [ ] **Step 2: Laadlijsten bijwerken en tests draaien → FAIL**

`scripts/run-tests.mjs`: lijst wordt `['js/validatie.js', 'js/agenda.js', 'js/facturatie.js', 'js/lijst.js', 'js/kalender.js', 'js/berichten.js', 'js/db.js', 'js/tests.js']`. `tests.html`: dezelfde twee scripts vóór `db.js`.

- [ ] **Step 3: Schrijf js/kalender.js**

```javascript
// Pure agenda-uitwisseling: ics-bestanden voor afspraakbevestigingen.
const Kalender = (() => {
  const twee = (n) => String(n).padStart(2, '0');
  const stempel = (d) =>
    `${d.getFullYear()}${twee(d.getMonth() + 1)}${twee(d.getDate())}T${twee(d.getHours())}${twee(d.getMinutes())}00`;
  return {
    ics({ titel, locatie, omschrijving, datum, tijd, duurMinuten, uid }) {
      const start = new Date(`${datum}T${tijd}:00`);
      const eind = new Date(start.getTime() + duurMinuten * 60000);
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//KassaGenda//NL',
        'BEGIN:VEVENT',
        `UID:${uid}@kassagenda`,
        `DTSTART:${stempel(start)}`,
        `DTEND:${stempel(eind)}`,
        `SUMMARY:${titel}`,
        `LOCATION:${locatie}`,
        `DESCRIPTION:${omschrijving}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
    },
    icsDataUrl(inhoud) {
      return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(inhoud);
    },
  };
})();
```

- [ ] **Step 4: Schrijf js/berichten.js**

```javascript
// Sjablonen voor klantberichten; per tenant aanpasbaar in het beheer.
const Berichten = {
  STANDAARD: {
    boeking: 'Beste {naam},\n\nUw afspraak bij {tenant} op {datum} om {tijd} is bevestigd. 24 uur voor uw afspraak ontvangt u een herinnering per e-mail.\n\nMet vriendelijke groet,\n{tenant}',
    verzet: 'Beste {naam},\n\nUw afspraak bij {tenant} is verzet naar {datum} om {tijd}.\n\nMet vriendelijke groet,\n{tenant}',
    factuur: 'Beste {naam},\n\nHierbij ontvangt u factuur {nummer} ({bedrag}) voor uw afspraak. U kunt eenvoudig online betalen via de betaallink in dit bericht.\n\nMet vriendelijke groet,\n{tenant}',
    betaling: 'Beste {naam},\n\nWij hebben uw betaling van {bedrag} voor factuur {nummer} in goede orde ontvangen. Hartelijk dank!\n\nMet vriendelijke groet,\n{tenant}',
  },
  STANDAARD_FACTUURVOETTEKST:
    'Gelieve het bedrag binnen 14 dagen over te maken onder vermelding van het factuurnummer.',
  render(sjabloon, data) {
    return String(sjabloon).replace(/\{(\w+)\}/g,
      (heel, sleutel) => (data[sleutel] !== undefined ? data[sleutel] : heel));
  },
  voor(tenant, type) {
    return (tenant.berichten && tenant.berichten[type]) || this.STANDAARD[type];
  },
  naarHtml(tekst) { return String(tekst).replace(/\n/g, '<br>'); },
};
```

- [ ] **Step 5: db-setters in js/db.js (na `zetFactuurReeks`)**

```javascript
    zetBerichten(code, berichten) { return this.wijzig(code, { berichten }); },
    zetFactuurVoettekst(code, tekst) { return this.wijzig(code, { factuurVoettekst: tekst }); },
```

- [ ] **Step 6: Tests → PASS (62/62). Commit**

```bash
git add js/kalender.js js/berichten.js js/db.js js/tests.js tests.html scripts/run-tests.mjs
git commit -m "feat: kalender- en berichtenmodule met tenant-instelbare teksten"
```

---

### Task 2: Klantflows — boekingsmail, verzetmail, betalingsmail

**Files:**
- Modify: `tenant.html` (scripts), `js/tenant.js`, `afspraak.html` (scripts + mail-div), `js/afspraak.js`, `betaal.html` (scripts + mail-div), `js/betaal.js`

**Interfaces:**
- Consumes: `Kalender.ics/icsDataUrl`, `Berichten.voor/render/naarHtml` (Task 1).

- [ ] **Step 1: Scripts toevoegen**

`tenant.html`, `afspraak.html`, `betaal.html`: `<script src="js/kalender.js"></script>` en `<script src="js/berichten.js"></script>` direct vóór `js/db.js` (betaal.html alleen berichten.js; kalender is daar niet nodig).

- [ ] **Step 2: Boekingsmail in js/tenant.js**

Vervang de volledige `el('bevestiging-mail').innerHTML = ...;`-toewijzing door:

```javascript
    const mailTekst = Berichten.render(Berichten.voor(tenant, 'boeking'), {
      naam: afspraak.naam,
      tenant: tenant.naam,
      datum: datumLabel(afspraak.datum),
      tijd: afspraak.tijd,
    });
    const ics = Kalender.ics({
      titel: `Afspraak bij ${tenant.naam}`,
      locatie: `${tenant.straat} ${tenant.huisnummer}, ${tenant.plaats}`,
      omschrijving: afspraak.extra || 'Afspraak',
      datum: afspraak.datum,
      tijd: afspraak.tijd,
      duurMinuten: tenant.slotDuur || 30,
      uid: afspraak.id,
    });
    el('bevestiging-mail').innerHTML =
      `<strong>Demo — bevestigingsmail:</strong><br>
      <strong>Aan:</strong> ${afspraak.email}<br>
      <strong>Onderwerp:</strong> Afspraakbevestiging — ${tenant.naam}<br><br>
      ${Berichten.naarHtml(mailTekst)}<br><br>
      Wilt u de afspraak wijzigen of annuleren? Gebruik dan
      <a href="afspraak.html?id=${afspraak.id}">deze link</a>.<br>
      <strong>Bijlage:</strong>
      <a download="afspraak.ics" href="${Kalender.icsDataUrl(ics)}">📅 afspraak.ics</a>`;
```

- [ ] **Step 3: Verzetmail in afspraak.html + js/afspraak.js**

In `afspraak.html`, binnen `#klaar-kaart` ná `#klaar-melding`:

```html
        <div class="melding melding-info verborgen" id="verzet-mail" role="status"></div>
```

In `js/afspraak.js`, vervang in de verzet-handler de regel
`klaar(\`Uw afspraak is verzet naar ${datumLabel(nieuw.datum)} om ${nieuw.tijd}.\`);` door:

```javascript
        klaar(`Uw afspraak is verzet naar ${datumLabel(nieuw.datum)} om ${nieuw.tijd}.`);
        const mailTekst = Berichten.render(Berichten.voor(tenant, 'verzet'), {
          naam: afspraak.naam,
          tenant: tenant.naam,
          datum: datumLabel(nieuw.datum),
          tijd: nieuw.tijd,
        });
        const ics = Kalender.ics({
          titel: `Afspraak bij ${tenant.naam}`,
          locatie: `${tenant.straat} ${tenant.huisnummer}, ${tenant.plaats}`,
          omschrijving: nieuw.extra || 'Afspraak',
          datum: nieuw.datum,
          tijd: nieuw.tijd,
          duurMinuten: tenant.slotDuur || 30,
          uid: nieuw.id,
        });
        el('verzet-mail').innerHTML =
          `<strong>Demo — bevestigingsmail:</strong><br>
          <strong>Aan:</strong> ${afspraak.email}<br>
          <strong>Onderwerp:</strong> Afspraak verzet — ${tenant.naam}<br><br>
          ${Berichten.naarHtml(mailTekst)}<br><br>
          <strong>Bijlage:</strong>
          <a download="afspraak.ics" href="${Kalender.icsDataUrl(ics)}">📅 afspraak.ics</a>`;
        el('verzet-mail').classList.remove('verborgen');
```

- [ ] **Step 4: Betalingsmail in betaal.html + js/betaal.js**

In `betaal.html`, ná de checkout-kaart (binnen `<main>`):

```html
    <div class="kaart verborgen" id="betaal-mail" style="max-width: 420px; margin: 0 auto;">
      <h2>Mail verzonden (demo)</h2>
      <div class="melding melding-info" id="betaal-mail-inhoud" role="status"></div>
    </div>
```

In `js/betaal.js`, in de klik-handler van `knop-betaal`, ná `toonBetaald();`:

```javascript
    const bedrag = Facturatie.euro(Facturatie.totalen(factuur.regels).inclCent);
    const mailTekst = Berichten.render(Berichten.voor(tenant, 'betaling'), {
      naam: factuur.klantNaam,
      tenant: tenant.naam,
      nummer: factuur.nummer,
      bedrag,
    });
    el('betaal-mail-inhoud').innerHTML =
      `<strong>Aan:</strong> ${factuur.klantEmail}<br>
      <strong>Onderwerp:</strong> Betaling ontvangen — factuur ${factuur.nummer}<br><br>
      ${Berichten.naarHtml(mailTekst)}`;
    el('betaal-mail').classList.remove('verborgen');
```

- [ ] **Step 5: Regressie + browserverificatie + commit**

```bash
git add tenant.html js/tenant.js afspraak.html js/afspraak.js betaal.html js/betaal.js
git commit -m "feat: sjabloonmails met ics-bijlage en betalingsbevestiging"
```

---

### Task 3: Beheer — tabblad Berichten, QR en factuurtekst in profiel

**Files:**
- Modify: `beheer.html` (menu, view, scripts), `js/beheer.js`, `css/style.css` (textarea)

**Interfaces:**
- Consumes: `Berichten.*`, `OberPoesDb.zetBerichten/zetFactuurVoettekst`; factuurmail in `toonMail` gebruikt het `factuur`-sjabloon.

- [ ] **Step 1: beheer.html**

Menu: `<a href="#" id="menu-berichten">Berichten</a>` tussen Openingstijden en Profiel. Views: `<div id="view-berichten" class="verborgen"></div>` tussen view-tijden en view-profiel. Scripts: `kalender.js` + `berichten.js` vóór `db.js`.

- [ ] **Step 2: css/style.css — textarea zoals input (na de `.veld input, .veld select`-regel)**

```css
.veld textarea {
  width: 100%; padding: 0.55rem 0.7rem; border: 1px solid var(--rand);
  border-radius: 10px; font-size: 1rem; background: #fff; font-family: var(--font-body);
}
.veld textarea:focus { outline: 2px solid var(--charcoal); border-color: var(--charcoal); }
```

- [ ] **Step 3: js/beheer.js — view registreren + renderBerichten**

Beide arrays `['agenda', 'regels', 'facturen', 'tijden', 'profiel']` worden
`['agenda', 'regels', 'facturen', 'tijden', 'berichten', 'profiel']`; in `toonView`: `if (naam === 'berichten') renderBerichten();`.

Nieuwe functie (na renderTijden):

```javascript
  // --- Berichten ---
  const BERICHT_TYPES = [
    { type: 'boeking', label: 'Boekingsbevestiging', velden: '{naam} {tenant} {datum} {tijd}' },
    { type: 'verzet', label: 'Verzetbevestiging', velden: '{naam} {tenant} {datum} {tijd}' },
    { type: 'factuur', label: 'Factuurmail', velden: '{naam} {tenant} {nummer} {bedrag}' },
    { type: 'betaling', label: 'Betalingsbevestiging', velden: '{naam} {tenant} {nummer} {bedrag}' },
  ];

  function renderBerichten() {
    const t = huidigeTenant();
    el('view-berichten').innerHTML = `
      <div class="kaart">
        <h2>Berichten aan klanten</h2>
        <p>Pas de teksten van de automatische berichten aan. De invulvelden tussen
        accolades worden bij verzending vervangen door de echte gegevens.</p>
        ${BERICHT_TYPES.map((b) => `
        <div class="veld">
          <label for="bericht-${b.type}">${b.label} <small>(beschikbaar: ${b.velden})</small></label>
          <textarea id="bericht-${b.type}" rows="6">${Berichten.voor(t, b.type)}</textarea>
        </div>`).join('')}
        <button class="knop" id="knop-berichten-opslaan">Opslaan</button>
        <button class="knop knop-secundair" id="knop-berichten-standaard">Herstel standaardteksten</button>
        <span class="melding melding-goed verborgen" id="berichten-opgeslagen" role="status">Opgeslagen.</span>
      </div>`;
    el('knop-berichten-opslaan').addEventListener('click', () => {
      const berichten = {};
      BERICHT_TYPES.forEach((b) => { berichten[b.type] = el('bericht-' + b.type).value; });
      OberPoesDb.zetBerichten(code, berichten);
      el('berichten-opgeslagen').classList.remove('verborgen');
    });
    el('knop-berichten-standaard').addEventListener('click', () => {
      OberPoesDb.zetBerichten(code, {});
      renderBerichten();
    });
  }
```

- [ ] **Step 4: Factuurmail via sjabloon (toonMail)**

Vervang in `toonMail` het vaste tekstdeel
`Beste ${factuur.klantNaam},<br><br> Hierbij ontvangt u factuur ... groet,<br>${t.naam}<br><br>` door:

```javascript
          ${Berichten.naarHtml(Berichten.render(Berichten.voor(t, 'factuur'), {
            naam: factuur.klantNaam,
            tenant: t.naam,
            nummer: factuur.nummer,
            bedrag: Facturatie.euro(totaal.inclCent),
          }))}<br><br>
```

(De regels "U kunt ... betalen via deze Mollie-betaallink" en de bijlage-link blijven als vaste onderdelen ná het sjabloon staan; de betaallink-zin verhuist uit het sjabloon.)

- [ ] **Step 5: QR + factuurtekst in renderProfiel**

Ná het `boek-link`-veld en de kopieerknop:

```javascript
        <div class="veld" style="margin-top: 1rem;">
          <label>QR-code naar uw boekingspagina (voor posters, balie of website)</label><br>
          <img id="qr-code" alt="QR-code naar uw boekingspagina" width="220" height="220"
            crossorigin="anonymous"
            src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(boekLink)}"
            style="border: 1px solid var(--rand); border-radius: 12px; background: #fff;">
          <p class="fout verborgen" id="qr-fout">QR-service niet bereikbaar — gebruik de boekingslink hierboven.</p>
        </div>
        <button class="knop knop-secundair" id="knop-qr-kopieer">Kopieer QR</button>
        <button class="knop knop-secundair" id="knop-qr-download">Download QR</button>
        <span class="melding melding-goed verborgen" id="qr-gekopieerd" role="status">QR gekopieerd.</span>
        <span class="fout" id="qr-melding" aria-live="polite"></span>
        <div class="veld" style="margin-top: 1rem;">
          <label for="factuur-voettekst">Factuurtekst (onderaan elke factuur)</label>
          <textarea id="factuur-voettekst" rows="3">${t.factuurVoettekst || Berichten.STANDAARD_FACTUURVOETTEKST}</textarea>
        </div>
        <button class="knop" id="knop-voettekst-opslaan">Factuurtekst opslaan</button>
        <span class="melding melding-goed verborgen" id="voettekst-opgeslagen" role="status">Opgeslagen.</span>
```

Handlers (in renderProfiel):

```javascript
    el('qr-code').addEventListener('error', () => {
      el('qr-code').classList.add('verborgen');
      el('qr-fout').classList.remove('verborgen');
    });
    const qrCanvas = () => {
      const img = el('qr-code');
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 220;
      c.height = img.naturalHeight || 220;
      c.getContext('2d').drawImage(img, 0, 0);
      return c;
    };
    el('knop-qr-kopieer').addEventListener('click', async () => {
      try {
        const blob = await new Promise((r) => qrCanvas().toBlob(r, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        el('qr-gekopieerd').classList.remove('verborgen');
      } catch (e) {
        el('qr-melding').textContent = 'Kopiëren niet gelukt — probeer Download QR.';
      }
    });
    el('knop-qr-download').addEventListener('click', () => {
      try {
        const a = document.createElement('a');
        a.download = 'boekingslink-qr.png';
        a.href = qrCanvas().toDataURL('image/png');
        a.click();
      } catch (e) {
        el('qr-melding').textContent = 'Downloaden niet gelukt — de QR-service staat dit mogelijk niet toe.';
      }
    });
    el('knop-voettekst-opslaan').addEventListener('click', () => {
      OberPoesDb.zetFactuurVoettekst(code, el('factuur-voettekst').value.trim());
      el('voettekst-opgeslagen').classList.remove('verborgen');
    });
```

- [ ] **Step 6: Regressie + browserverificatie + commit**

```bash
git add beheer.html js/beheer.js css/style.css
git commit -m "feat: berichtenbeheer, qr-code en factuurtekst in tenantbeheer"
```

---

### Task 4: Zakelijke factuur, eindverificatie en push

**Files:**
- Modify: `factuur.html`, `js/factuur.js`

- [ ] **Step 1: factuur.html — zakelijke layout**

Vervang het `<style>`-blok en de factuurkaart-inhoud door:

```html
  <style>
    .factuur-kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; }
    .factuur-kop img { width: 56px; height: 56px; border-radius: 8px; border: 1px solid var(--rand); }
    .f-afzender h1 { margin: 0; font-size: 1.25rem; }
    .f-afzender p { margin: 0; color: var(--grijstekst); font-size: 0.9rem; }
    .f-titel { text-align: right; }
    .f-titel h2 { margin: 0 0 0.5rem; font-size: 1.6rem; letter-spacing: 3px; }
    .f-meta { font-size: 0.9rem; border-collapse: collapse; margin-left: auto; }
    .f-meta td { padding: 0.1rem 0 0.1rem 1.5rem; }
    .f-meta td:first-child { color: var(--grijstekst); padding-left: 0; text-align: left; }
    .f-aan { margin: 1.5rem 0; }
    .f-aan h3 { margin: 0 0 0.25rem; font-size: 0.8rem; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--grijstekst); }
    .totalen td { border-bottom: none; }
    .totalen tr:last-child td { font-weight: 700; border-top: 2px solid var(--charcoal); }
    .f-voettekst { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--rand);
      color: var(--grijstekst); font-size: 0.9rem; }
    @media print {
      .geen-print, .site-footer { display: none !important; }
      body { background: #fff; }
      .kaart { box-shadow: none; border-radius: 0; }
    }
  </style>
```

en de kaart:

```html
    <div class="kaart verborgen" id="factuur">
      <div class="factuur-kop">
        <div class="f-afzender" style="display:flex; align-items:center; gap:1rem;">
          <img id="f-logo" alt="Logo">
          <div>
            <h1 id="f-tenant"></h1>
            <p id="f-tenant-adres"></p>
          </div>
        </div>
        <div class="f-titel">
          <h2 id="f-soort">FACTUUR</h2>
          <table class="f-meta"><tbody>
            <tr><td>Factuurnummer</td><td id="f-nummer"></td></tr>
            <tr><td>Factuurdatum</td><td id="f-datum"></td></tr>
            <tr><td>Vervaldatum</td><td id="f-vervaldatum"></td></tr>
            <tr><td>Betalingskenmerk</td><td id="f-kenmerk"></td></tr>
            <tr><td>Status</td><td id="f-status"></td></tr>
          </tbody></table>
        </div>
      </div>
      <div class="f-aan">
        <h3>Factuur aan</h3>
        <span id="f-klant"></span><br>
        <span id="f-afspraak-regel">Betreft: afspraak op <span id="f-afspraak"></span></span>
      </div>
      <p class="melding melding-info verborgen" id="f-credit" role="status"></p>
      <table class="tabel" id="f-regels-tabel">
        <thead><tr><th scope="col">Omschrijving</th><th scope="col">Btw</th><th scope="col" style="text-align:right">Bedrag (incl.)</th></tr></thead>
        <tbody id="f-regels"></tbody>
      </table>
      <table class="tabel totalen" style="max-width: 320px; margin-left: auto; margin-top: 1rem;">
        <tbody id="f-totalen"></tbody>
      </table>
      <p class="f-voettekst" id="f-voettekst"></p>
      <p class="geen-print" style="margin-top: 1.5rem;">
        <button class="knop" onclick="window.print()">Opslaan als PDF (afdrukken)</button>
      </p>
    </div>
```

Scripts: `berichten.js` toevoegen vóór `db.js`.

- [ ] **Step 2: js/factuur.js aanvullen**

Na het zetten van `f-datum`:

```javascript
  const verval = new Date(factuur.gemaaktOp);
  verval.setDate(verval.getDate() + 14);
  el('f-vervaldatum').textContent = verval.toLocaleDateString('nl-NL');
  el('f-kenmerk').textContent = factuur.nummer;
  if (factuur.creditVoor) {
    el('f-soort').textContent = 'CREDITFACTUUR';
    el('f-credit').textContent = `Creditfactuur voor factuur ${factuur.creditVoor}.`;
    el('f-credit').classList.remove('verborgen');
  }
  el('f-voettekst').textContent = tenant.factuurVoettekst || Berichten.STANDAARD_FACTUURVOETTEKST;
```

- [ ] **Step 3: Volledige verificatie**

`node scripts/run-tests.mjs` → 62/62. Browser: boeken → mail met eigen sjabloon + ics-download-link (href begint met `data:text/calendar`); verzetten → verzetmail + ics; betalen → betalingsmail; Berichten-tab: tekst wijzigen → mails tonen eigen tekst → herstel standaard; profiel: QR zichtbaar + knoppen; factuur: FACTUUR-blok met vervaldatum, kenmerk, voettekst; credit → CREDITFACTUUR.

- [ ] **Step 4: Commit + push**

```bash
git add factuur.html js/factuur.js
git commit -m "feat: zakelijke factuurlayout met instelbare factuurtekst"
git push
```
