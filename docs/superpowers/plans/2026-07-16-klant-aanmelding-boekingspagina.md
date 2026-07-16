# Klant-aanmelding boekingspagina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een terugkerende klant kan zich op de boekingspagina aanmelden met zijn e-mailadres of telefoonnummer plus een verificatiecode (demo op scherm); na een juiste code worden zijn gegevens alvast ingevuld.

**Architecture:** Statische HTML/JS met `localStorage` (`OberPoesDb` in `js/db.js`). Opzoeken gebeurt met een nieuwe, Node-testbare `zoekKlantOpContact(tenantCode, invoer)` boven op de bestaande samengevoegde `klantenVoor`-lijst. De bestaande uitnodigings-prefill in `js/tenant.js` wordt gerefactord naar een gedeelde `vulKlantIn(klant)`; het aanmeldblok volgt hetzelfde codestap-patroon als de beheer-login (`js/beheer.js:26-58`).

**Tech Stack:** Vanilla JS (geen build), localStorage, Node-testharnas (`node scripts/run-tests.mjs`), browser-preview op poort 8321 (launch-naam `oberpoes`).

## Global Constraints

- B1-Nederlands in alle zichtbare tekst.
- Foutteksten letterlijk: "Deze code klopt niet." en "Wij kennen dit e-mailadres nog niet. Vul uw gegevens gewoon hieronder in." (of "…dit telefoonnummer…" bij sms-invoer).
- Kanaalkeuze: invoer bevat `@` → e-mail, anders sms.
- Alleen deze paginaweergave; geen sessie of opslag van de aanmelding.
- De uitnodigingslink-prefill (`?klant=<id>`) blijft functioneel identiek (alleen intern verhuisd naar `vulKlantIn`).
- Validatie, PDOK-flow en het boekingsproces blijven ongewijzigd; niets hernoemen.
- Testcommando: `node scripts/run-tests.mjs` (vanuit C:\Projects\oberpoes). Huidige stand: 73/73; deze feature voegt 2 tests toe → 75/75.
- Testbestand: `js/tests.js` (`test(naam, fn)` + `assert(voorwaarde, bericht?)`).

---

### Task 1: db.js — `zoekKlantOpContact(tenantCode, invoer)`

**Files:**
- Modify: `js/db.js` (direct ná `vindKlant`, ~regel 107)
- Test: `js/tests.js` (ná de laatste test `'vindKlant: vindt op id en geeft null bij onbekend'`, aan het eind van het bestand)

**Interfaces:**
- Consumes: `this.klantenVoor(tenantCode)` (bestaand; samengevoegde lijst met `naam`, `email`, `telefoon`, `straat`, `huisnummer`, `postcode`, `plaats`).
- Produces: `OberPoesDb.zoekKlantOpContact(tenantCode, invoer)` → klantobject of `null`. Task 3 roept exact deze naam aan.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `js/tests.js`, direct ná de test `'vindKlant: vindt op id en geeft null bij onbekend'` (de laatste test in het bestand):

```js
test('zoekKlantOpContact: vindt op e-mail, hoofdletterongevoelig', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Contact BV' });
  OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Piet', email: 'Piet@Voorbeeld.nl', telefoon: '0612345678' });
  assert(OberPoesDb.zoekKlantOpContact(t.code, ' piet@voorbeeld.NL ').naam === 'Piet', 'e-mail match');
  assert(OberPoesDb.zoekKlantOpContact(t.code, 'onbekend@x.nl') === null, 'onbekende e-mail -> null');
});

test('zoekKlantOpContact: vindt op telefoon met spaties/streepjes, null bij onbekend', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Contact BV' });
  OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Piet', email: 'piet@x.nl', telefoon: '06-12 34 56 78' });
  assert(OberPoesDb.zoekKlantOpContact(t.code, '0612345678').naam === 'Piet', 'telefoon match');
  assert(OberPoesDb.zoekKlantOpContact(t.code, '0687654321') === null, 'onbekend nummer -> null');
  assert(OberPoesDb.zoekKlantOpContact(t.code, '') === null, 'lege invoer -> null');
});
```

- [ ] **Step 2: Draai de tests en zie de nieuwe tests falen**

Run: `node scripts/run-tests.mjs`
Verwacht: de 2 nieuwe tests FALEN (`zoekKlantOpContact is not a function`); de bestaande 73 blijven groen.

- [ ] **Step 3: Implementeer `zoekKlantOpContact`**

In `js/db.js`, direct ná de regel `vindKlant(id) { return lees().klanten.find((k) => k.id === id) || null; },` toevoegen:

```js
    zoekKlantOpContact(tenantCode, invoer) {
      const tekst = String(invoer).trim();
      if (!tekst) return null;
      const klanten = this.klantenVoor(tenantCode);
      if (tekst.includes('@')) {
        const email = tekst.toLowerCase();
        return klanten.find((k) => (k.email || '').trim().toLowerCase() === email) || null;
      }
      const cijfers = tekst.replace(/\D/g, '');
      if (!cijfers) return null;
      return klanten.find((k) => String(k.telefoon || '').replace(/\D/g, '') === cijfers) || null;
    },
```

- [ ] **Step 4: Draai de tests en zie alles groen**

Run: `node scripts/run-tests.mjs`
Verwacht: 75/75 geslaagd.

- [ ] **Step 5: Commit**

```bash
git add js/db.js js/tests.js
git commit -m "feat: zoekKlantOpContact voor klant-aanmelding op de boekingspagina"
```

---

### Task 2: tenant.js — refactor uitnodigings-prefill naar `vulKlantIn(klant)`

**Files:**
- Modify: `js/tenant.js:78-92` (het bestaande uitnodigings-prefill-blok)

**Interfaces:**
- Consumes: bestaande `el`-hulpje en `let adres`-variabele in tenant.js; `OberPoesDb.vindKlant(id)` (bestaand).
- Produces: functie `vulKlantIn(klant)` (module-lokaal in de tenant.js-IIFE) — vult velden met niet-lege waarden, zet straat/plaats + `adres` alleen als beide gevuld, toont `#prefill-melding`. Task 3 roept exact deze naam aan.

- [ ] **Step 1: Vervang het prefill-blok door de functie + aanroep**

In `js/tenant.js`, vervang:

```js
  // Uitnodigings-prefill: ?klant=<id> vult bekende gegevens alvast in.
  const klantId = new URLSearchParams(location.search).get('klant') || '';
  const bekendeKlant = klantId ? OberPoesDb.vindKlant(klantId) : null;
  if (bekendeKlant
      && String(bekendeKlant.tenantCode).toUpperCase() === tenant.code.toUpperCase()) {
    ['naam', 'email', 'telefoon', 'postcode', 'huisnummer'].forEach((veld) => {
      if (bekendeKlant[veld]) el(veld).value = bekendeKlant[veld];
    });
    if (bekendeKlant.straat && bekendeKlant.plaats) {
      el('straat').value = bekendeKlant.straat;
      el('plaats').value = bekendeKlant.plaats;
      adres = { straat: bekendeKlant.straat, plaats: bekendeKlant.plaats };
    }
    el('prefill-melding').classList.remove('verborgen');
  }
```

door:

```js
  // Vult bekende klantgegevens in (uitnodigingslink en klant-aanmelding).
  function vulKlantIn(klant) {
    ['naam', 'email', 'telefoon', 'postcode', 'huisnummer'].forEach((veld) => {
      if (klant[veld]) el(veld).value = klant[veld];
    });
    if (klant.straat && klant.plaats) {
      el('straat').value = klant.straat;
      el('plaats').value = klant.plaats;
      adres = { straat: klant.straat, plaats: klant.plaats };
    }
    el('prefill-melding').classList.remove('verborgen');
  }

  // Uitnodigings-prefill: ?klant=<id> vult bekende gegevens alvast in.
  const klantId = new URLSearchParams(location.search).get('klant') || '';
  const bekendeKlant = klantId ? OberPoesDb.vindKlant(klantId) : null;
  if (bekendeKlant
      && String(bekendeKlant.tenantCode).toUpperCase() === tenant.code.toUpperCase()) {
    vulKlantIn(bekendeKlant);
  }
```

- [ ] **Step 2: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 75/75 geslaagd.

- [ ] **Step 3: Commit**

```bash
git add js/tenant.js
git commit -m "refactor: prefill-logica naar gedeelde vulKlantIn"
```

---

### Task 3: tenant.html + tenant.js — aanmeldblok met verificatiecode

**Files:**
- Modify: `tenant.html` (in `#stap-gegevens`, direct ná `#prefill-melding`, vóór `<form id="afspraakformulier">`)
- Modify: `js/tenant.js` (direct ná het uitnodigings-prefill-blok uit Task 2)

**Interfaces:**
- Consumes: `OberPoesDb.zoekKlantOpContact(tenantCode, invoer)` (Task 1); `vulKlantIn(klant)` (Task 2); bestaande `el`-hulpje en `tenant`-variabele; css-klassen `verborgen`, `fout`, `melding melding-info`, `demo-code`, `knop knop-secundair` (alle bestaand, zelfde gebruik als de login-kaart in beheer.html).
- Produces: n.v.t. (eindpunt van de flow).

- [ ] **Step 1: Voeg het aanmeldblok toe aan tenant.html**

In `tenant.html`, vervang:

```html
        <p class="melding melding-info verborgen" id="prefill-melding" role="status">Uw gegevens zijn alvast ingevuld — klopt alles nog?</p>
        <form id="afspraakformulier" novalidate>
```

door:

```html
        <p class="melding melding-info verborgen" id="prefill-melding" role="status">Uw gegevens zijn alvast ingevuld — klopt alles nog?</p>
        <div id="aanmeld-blok">
          <p>Al eerder een afspraak gemaakt?
            <a href="#" id="aanmeld-open">Haal uw gegevens op.</a></p>
          <div class="verborgen" id="aanmeld-stap-contact">
            <div class="veld">
              <label for="aanmeld-contact">E-mailadres of telefoonnummer</label>
              <input id="aanmeld-contact" type="text">
            </div>
            <span class="fout" aria-live="polite" id="fout-aanmeld-contact"></span><br>
            <button type="button" class="knop knop-secundair" id="knop-aanmeld-code">Stuur code</button>
          </div>
          <div class="verborgen" id="aanmeld-stap-code">
            <p class="melding melding-info" id="aanmeld-demo-code"></p>
            <div class="veld">
              <label for="aanmeld-code">Vul de code in</label>
              <input id="aanmeld-code" type="text" inputmode="numeric" autocomplete="one-time-code">
            </div>
            <span class="fout" aria-live="polite" id="fout-aanmeld-code"></span><br>
            <button type="button" class="knop knop-secundair" id="knop-aanmeld-verifieer">Bevestig</button>
            <a href="#" id="aanmeld-andere-invoer">Andere invoer</a>
          </div>
        </div>
        <form id="afspraakformulier" novalidate>
```

- [ ] **Step 2: Voeg de aanmeld-handlers toe aan tenant.js**

In `js/tenant.js`, direct ná het uitnodigings-prefill-blok (het `if (bekendeKlant ...) { vulKlantIn(bekendeKlant); }`-blok uit Task 2), toevoegen:

```js
  // Klant-aanmelding: bekend contact -> verificatiecode -> gegevens invullen.
  let aanmeldCode = '';
  let aanmeldKlant = null;
  el('aanmeld-open').addEventListener('click', (e) => {
    e.preventDefault();
    el('aanmeld-stap-contact').classList.remove('verborgen');
    el('aanmeld-contact').focus();
  });
  el('knop-aanmeld-code').addEventListener('click', () => {
    const invoer = el('aanmeld-contact').value.trim();
    const kanaal = invoer.includes('@') ? 'e-mail' : 'sms';
    aanmeldKlant = invoer ? OberPoesDb.zoekKlantOpContact(tenant.code, invoer) : null;
    if (!aanmeldKlant) {
      el('fout-aanmeld-contact').textContent = invoer.includes('@')
        ? 'Wij kennen dit e-mailadres nog niet. Vul uw gegevens gewoon hieronder in.'
        : 'Wij kennen dit telefoonnummer nog niet. Vul uw gegevens gewoon hieronder in.';
      return;
    }
    el('fout-aanmeld-contact').textContent = '';
    aanmeldCode = String(Math.floor(100000 + Math.random() * 900000));
    el('aanmeld-demo-code').innerHTML =
      `<strong>Demo:</strong> in een echte omgeving ontvangt u deze code per ${kanaal}.<br>`
      + `Code: <span class="demo-code">${aanmeldCode}</span>`;
    el('aanmeld-code').value = '';
    el('fout-aanmeld-code').textContent = '';
    el('aanmeld-stap-contact').classList.add('verborgen');
    el('aanmeld-stap-code').classList.remove('verborgen');
  });
  el('aanmeld-andere-invoer').addEventListener('click', (e) => {
    e.preventDefault();
    aanmeldCode = '';
    aanmeldKlant = null;
    el('aanmeld-stap-code').classList.add('verborgen');
    el('aanmeld-stap-contact').classList.remove('verborgen');
  });
  el('knop-aanmeld-verifieer').addEventListener('click', () => {
    if (!aanmeldCode || el('aanmeld-code').value.trim() !== aanmeldCode) {
      el('fout-aanmeld-code').textContent = 'Deze code klopt niet.';
      return;
    }
    vulKlantIn(aanmeldKlant);
    el('aanmeld-blok').classList.add('verborgen');
  });
  el('aanmeld-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el('knop-aanmeld-verifieer').click(); }
  });
```

- [ ] **Step 3: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 75/75 geslaagd.

- [ ] **Step 4: Commit**

```bash
git add tenant.html js/tenant.js
git commit -m "feat: klant-aanmelding met e-mail/sms-verificatie op de boekingspagina"
```

---

### Task 4: Browserverificatie end-to-end en push

**Files:** geen codewijziging verwacht (alleen als verificatie een fout blootlegt).

**Interfaces:**
- Consumes: alles uit Task 1-3.

- [ ] **Step 1: Start de preview-server**

Gebruik de browser-preview (`preview_start` met naam `oberpoes`, poort 8321). Niet via Bash starten.

- [ ] **Step 2: Zorg voor demo-data met een bekende klant**

Navigeer naar `tenant.html?code=<ACTIEVE_CODE>`. Als er geen actieve tenant is: `OberPoesDb.laadDemoData()` in de console en de actieve code opzoeken. Controleer in de console dat er een klant is met e-mail én telefoon (`OberPoesDb.klantenVoor('<CODE>')`).

- [ ] **Step 3: Aanmelden via e-mail**

Kies een dag en tijd. Klik "Haal uw gegevens op.", vul het bekende e-mailadres in, klik "Stuur code". Verwacht: demo-code zichtbaar met "per e-mail". Vul eerst een foute code in → "Deze code klopt niet." Vul dan de juiste code in → velden gevuld, prefill-melding zichtbaar, aanmeldblok verdwenen.

- [ ] **Step 4: Rond de boeking af zonder de adresvelden aan te raken**

Klik "Afspraak bevestigen". Verwacht: boeking lukt (interne `adres` gezet, geen PDOK-aanroep nodig).

- [ ] **Step 5: Aanmelden via telefoonnummer**

Herlaad de pagina, kies dag en tijd, "Haal uw gegevens op.", vul het bekende telefoonnummer in (mét spaties of streepjes) → demo-code met "per sms" → juiste code → velden gevuld.

- [ ] **Step 6: Onbekend contact**

Herlaad, vul een onbekend e-mailadres in → melding "Wij kennen dit e-mailadres nog niet. Vul uw gegevens gewoon hieronder in.", géén codestap. Idem met een onbekend nummer → "…dit telefoonnummer…".

- [ ] **Step 7: Regressie uitnodigingslink**

Open `tenant.html?code=<CODE>&klant=<bekende id>` (id via `OberPoesDb.handmatigeKlantenVoor('<CODE>')` of een uitnodiging). Verwacht: prefill werkt nog zoals voorheen (via de gerefactorde `vulKlantIn`).

- [ ] **Step 8: Draai de volledige testset nog één keer**

Run: `node scripts/run-tests.mjs`
Verwacht: 75/75 geslaagd.

- [ ] **Step 9: Push**

```bash
git push origin master
```

---

## Self-Review

**Spec coverage:**
- `zoekKlantOpContact` (e-mail case-insensitief, telefoon op cijfers, null-gevallen) → Task 1.
- Refactor naar gedeelde `vulKlantIn` met identiek gedrag → Task 2.
- Aanmeldblok (regel + contactstap + codestap, kanaal via `@`, exacte foutteksten, democode-patroon als beheer-login, blok sluit na succes) → Task 3.
- Geen sessie/opslag → nergens opslag toegevoegd (Task 3 gebruikt alleen lokale variabelen).
- Tests 75/75 + browser-e2e incl. regressie uitnodigingslink → Task 1 en Task 4.

**Placeholder scan:** geen TBD/TODO; alle codestappen bevatten volledige code; verificatiestappen hebben verwachte uitkomsten.

**Type consistency:** `zoekKlantOpContact(tenantCode, invoer)` (Task 1) ↔ aanroep in Task 3; `vulKlantIn(klant)` (Task 2) ↔ aanroep in Task 3; element-ids in Task 3-HTML ↔ Task 3-JS (`aanmeld-open`, `aanmeld-stap-contact`, `aanmeld-contact`, `fout-aanmeld-contact`, `knop-aanmeld-code`, `aanmeld-stap-code`, `aanmeld-demo-code`, `aanmeld-code`, `fout-aanmeld-code`, `knop-aanmeld-verifieer`, `aanmeld-andere-invoer`, `aanmeld-blok`).
