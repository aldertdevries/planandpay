# Uitnodigings-prefill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De uitnodigingsmail krijgt per klant een persoonlijke boekingslink (`tenant.html?code=X&klant=<id>`) waarmee de boekingspagina naam, e-mail, telefoon en adres alvast invult — aanpasbaar, met stille terugval bij een onbekend token.

**Architecture:** Statische HTML/JS met `localStorage` als database (module `OberPoesDb` in `js/db.js`). Klantrecords krijgen al een willekeurige `id` via `voegKlantToe` (upsert op e-mail); die id is het opake token in de link. De boekingspagina (`js/tenant.js`) leest de `klant`-parameter, zoekt het record op via een nieuwe `vindKlant(id)`, en vult de velden plus de interne `adres`-variabele.

**Tech Stack:** Vanilla JS (geen build), localStorage, Node-testharnas (`node scripts/run-tests.mjs`), browser-preview op poort 8321 (`.claude/launch.json` naam `oberpoes`).

## Global Constraints

- B1-Nederlands in alle zichtbare tekst.
- Géén persoonsgegevens in de URL — alleen de opake klant-id als `klant`-parameter.
- Prefill-melding, letterlijk: "Uw gegevens zijn alvast ingevuld — klopt alles nog?"
- Stille terugval: onbekende id of andere tenant → normaal leeg formulier, geen foutmelding.
- Alleen niet-lege waarden voorinvullen; `adres` alleen zetten als straat én plaats beide gevuld zijn.
- Validatie, PDOK-flow (`Adres.bind`) en het boekingsproces blijven ongewijzigd.
- Interne identifiers/ids/query-params NIET hernoemen.
- Testcommando: `node scripts/run-tests.mjs` (vanuit C:\Projects\oberpoes). Huidige stand: 72/72; deze feature voegt 1 test toe → 73/73.
- Testbestand: `js/tests.js` (`test(naam, fn)` + `assert(voorwaarde, bericht?)`).

---

### Task 1: db.js — `vindKlant(id)`

**Files:**
- Modify: `js/db.js` (direct ná `voegKlantToe`, ~regel 107)
- Test: `js/tests.js` (ná de laatste test `'klantenVoor: handmatige klant met aantal 0, en samenvoegen met afspraak'`, aan het eind van het bestand)

**Interfaces:**
- Consumes: `OberPoesDb.voegKlantToe({tenantCode, naam, email, ...})` → klantrecord met `id` (bestaand); `lees()` (module-intern).
- Produces: `OberPoesDb.vindKlant(id)` → klantrecord (met o.a. `id`, `tenantCode`, `naam`, `email`, `telefoon`, `straat`, `huisnummer`, `postcode`, `plaats`) of `null` bij onbekende id. Task 3 gebruikt exact deze naam.

- [ ] **Step 1: Schrijf de falende test**

Voeg toe aan `js/tests.js`, direct ná de test `'klantenVoor: handmatige klant met aantal 0, en samenvoegen met afspraak'` (de laatste test in het bestand):

```js
test('vindKlant: vindt op id en geeft null bij onbekend', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Klant BV' });
  const klant = OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Piet', email: 'piet@x.nl' });
  assert(OberPoesDb.vindKlant(klant.id).email === 'piet@x.nl', 'vindt op id');
  assert(OberPoesDb.vindKlant('BESTAATNIET') === null, 'onbekend -> null');
});
```

- [ ] **Step 2: Draai de tests en zie de nieuwe test falen**

Run: `node scripts/run-tests.mjs`
Verwacht: de nieuwe test FAALT (`vindKlant is not a function`); de bestaande 72 blijven groen.

- [ ] **Step 3: Implementeer `vindKlant`**

In `js/db.js`, direct ná de sluitregel van `voegKlantToe` (`},` na `return klant;`), toevoegen:

```js
    vindKlant(id) { return lees().klanten.find((k) => k.id === id) || null; },
```

- [ ] **Step 4: Draai de tests en zie alles groen**

Run: `node scripts/run-tests.mjs`
Verwacht: 73/73 geslaagd.

- [ ] **Step 5: Commit**

```bash
git add js/db.js js/tests.js
git commit -m "feat: vindKlant(id) in db voor uitnodigings-prefill"
```

---

### Task 2: beheer.js — persoonlijke uitnodigingslink

**Files:**
- Modify: `js/beheer.js` (functie `toonUitnodigingen`, ~regel 898-921)

**Interfaces:**
- Consumes: `OberPoesDb.voegKlantToe({tenantCode, naam, email, telefoon, straat, huisnummer, postcode, plaats})` → klantrecord met `id` (bestaand, upsert op e-mail).
- Produces: de link in de uitnodigingsmail heeft de vorm `tenant.html?code=<CODE>&klant=<id>` — Task 3 leest die `klant`-parameter.

- [ ] **Step 1: Maak de link per klant persoonlijk**

In `js/beheer.js`, in `toonUitnodigingen`, vervang:

```js
  function toonUitnodigingen(alleKlanten) {
    const t = huidigeTenant();
    const boekLink = new URL(`tenant.html?code=${t.code}`, location.href).href;
    const gekozen = alleKlanten.filter((k) => klantenSelectie.has(k.email));
    const mails = gekozen.map((k) => {
      const tekst = Berichten.render(Berichten.voor(t, 'uitnodiging'), {
        naam: k.naam || 'klant', tenant: t.naam,
        link: `<a href="${boekLink}" target="_blank">${boekLink}</a>`,
      });
```

door:

```js
  function toonUitnodigingen(alleKlanten) {
    const t = huidigeTenant();
    const gekozen = alleKlanten.filter((k) => klantenSelectie.has(k.email));
    const mails = gekozen.map((k) => {
      const klant = OberPoesDb.voegKlantToe({
        tenantCode: t.code, naam: k.naam, email: k.email, telefoon: k.telefoon,
        straat: k.straat, huisnummer: k.huisnummer, postcode: k.postcode, plaats: k.plaats,
      });
      const boekLink = new URL(`tenant.html?code=${t.code}&klant=${klant.id}`, location.href).href;
      const tekst = Berichten.render(Berichten.voor(t, 'uitnodiging'), {
        naam: k.naam || 'klant', tenant: t.naam,
        link: `<a href="${boekLink}" target="_blank">${boekLink}</a>`,
      });
```

(De rest van de functie — het mails-blok, de kaart-template en de sluitknop — blijft ongewijzigd.)

- [ ] **Step 2: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 73/73 geslaagd.

- [ ] **Step 3: Commit**

```bash
git add js/beheer.js
git commit -m "feat: persoonlijke uitnodigingslink met klant-id"
```

---

### Task 3: tenant.html + tenant.js — prefill op de boekingspagina

**Files:**
- Modify: `tenant.html` (in `#stap-gegevens`, ~regel 52)
- Modify: `js/tenant.js` (ná de `Adres.bind`-aanroep, ~regel 76)

**Interfaces:**
- Consumes: `OberPoesDb.vindKlant(id)` (Task 1); de `klant`-URL-parameter (Task 2); bestaande variabelen in tenant.js: `el`, `tenant`, `adres` (let-variabele, regel 23), `Adres.bind` (regel 69-76).
- Produces: n.v.t. (eindpunt van de flow).

- [ ] **Step 1: Voeg het meldingselement toe aan tenant.html**

In `tenant.html`, vervang:

```html
      <div class="kaart verborgen" id="stap-gegevens">
        <h2>Uw gegevens</h2>
        <p class="melding melding-info" id="gekozen-slot"></p>
```

door:

```html
      <div class="kaart verborgen" id="stap-gegevens">
        <h2>Uw gegevens</h2>
        <p class="melding melding-info" id="gekozen-slot"></p>
        <p class="melding melding-info verborgen" id="prefill-melding" role="status">Uw gegevens zijn alvast ingevuld — klopt alles nog?</p>
```

- [ ] **Step 2: Voeg de prefill-logica toe aan tenant.js**

In `js/tenant.js`, direct ná het `Adres.bind({ ... });`-blok (dat eindigt met `bijAdres: (a) => { adres = a; },` gevolgd door `});`), toevoegen:

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

Let op: dit gebruikt de bestaande `let adres`-variabele en het bestaande `el`-hulpje; niets hernoemen. De veldnamen op het klantrecord zijn gelijk aan de element-ids (`naam`, `email`, `telefoon`, `postcode`, `huisnummer`).

- [ ] **Step 3: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 73/73 geslaagd.

- [ ] **Step 4: Commit**

```bash
git add tenant.html js/tenant.js
git commit -m "feat: boekingspagina vult klantgegevens in via uitnodigingslink"
```

---

### Task 4: Browserverificatie end-to-end en push

**Files:** geen codewijziging verwacht (alleen als verificatie een fout blootlegt).

**Interfaces:**
- Consumes: alles uit Task 1-3.

- [ ] **Step 1: Start de preview-server**

Gebruik de browser-preview (`preview_start` met naam `oberpoes`, poort 8321). Niet via Bash starten.

- [ ] **Step 2: Demo-data en beheersessie**

Navigeer naar `beheer.html`; als er geen actieve tenant is: `OberPoesDb.laadDemoData()` in de console. Pak de code van de tenant met `status === 'Actief'` en zet de sessie: `localStorage.setItem('oberpoes_tenant_<CODE>', String(Date.now()))`, herlaad `beheer.html?code=<CODE>`.

- [ ] **Step 3: Verstuur een uitnodiging en pak de persoonlijke link**

Open de Klanten-tab, selecteer één klant (checkbox) en klik de uitnodigingsknop. Controleer in de getoonde demo-mail dat de link de vorm `tenant.html?code=<CODE>&klant=<id>` heeft. Controleer via de console dat `OberPoesDb.vindKlant('<id>')` het juiste e-mailadres geeft.

- [ ] **Step 4: Volg de link en controleer de prefill**

Navigeer naar de persoonlijke link. Kies een dag en tijd. Controleer in `#stap-gegevens`: naam, e-mail, telefoon, postcode en huisnummer gevuld met de klantgegevens; straat en plaats gevuld; de melding "Uw gegevens zijn alvast ingevuld — klopt alles nog?" zichtbaar.

- [ ] **Step 5: Rond de boeking af zonder de adresvelden aan te raken**

Klik "Afspraak bevestigen" zonder postcode/huisnummer te wijzigen. Verwacht: boeking lukt (bewijst dat de interne `adres`-variabele gezet is, zonder PDOK-lookup) en de bevestiging toont de juiste naam.

- [ ] **Step 6: Stille terugval bij onzin-token**

Navigeer naar `tenant.html?code=<CODE>&klant=BESTAATNIET`. Verwacht: normaal leeg formulier, geen prefill-melding, geen foutmelding.

- [ ] **Step 7: Draai de volledige testset nog één keer**

Run: `node scripts/run-tests.mjs`
Verwacht: 73/73 geslaagd.

- [ ] **Step 8: Push**

```bash
git push origin master
```

---

## Self-Review

**Spec coverage:**
- `vindKlant(id)` in db.js → Task 1.
- Upsert + persoonlijke link in `toonUitnodigingen` → Task 2.
- Prefill (alleen niet-lege waarden), `adres` alleen bij straat+plaats, melding, stille terugval, meldingselement in tenant.html → Task 3.
- Tests (vindKlant-unit-test + browserverificatie incl. onzin-token) → Task 1 en Task 4.
- Geen persoonsgegevens in URL → Task 2 gebruikt alleen `klant.id`.

**Placeholder scan:** geen TBD/TODO; alle codestappen bevatten volledige code; Task 4-stappen zijn concrete verificaties met verwachte uitkomsten.

**Type consistency:** `vindKlant(id)` (Task 1) ↔ aanroep in Task 3; `klant`-parameter (Task 2) ↔ uitlezen in Task 3; veldnamen `naam/email/telefoon/straat/huisnummer/postcode/plaats` consistent met `voegKlantToe` in db.js.
