# Markeer-betaald + agenda-status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een open Mollie-rekening kan in het rekeningenoverzicht als betaald (pin of contant) worden gemarkeerd — met mee-veranderende betaalwijze en een demo-betalingsbevestiging — en de agenda-badge toont "Betaald" zodra de gekoppelde rekening betaald is.

**Architecture:** Statische HTML/JS met `localStorage` (`OberPoesDb` in `js/db.js`). De statuswijziging zit in een nieuwe, Node-testbare `markeerBetaald(id, betaalwijze)`. De UI-wijzigingen zitten volledig in `js/beheer.js`: twee actieknoppen + mailkaart in `renderFacturen`, en een badge-helper in `renderAgendaLijst` die via `vindFactuur` naar de rekeningstatus kijkt.

**Tech Stack:** Vanilla JS (geen build), localStorage, Node-testharnas (`node scripts/run-tests.mjs`), browser-preview op poort 8321 (launch-naam `oberpoes`).

## Global Constraints

- B1-Nederlands in alle zichtbare tekst.
- Bevestigingsvraag letterlijk: "Weet u zeker dat u deze rekening als betaald (pin) wilt markeren?" resp. "(contant)".
- `markeerBetaald` accepteert alleen `'pin'` of `'contant'`; andere waarden → `null`. Alleen rekeningen met status `'Open'`; anders `null`.
- De knoppen verschijnen alleen bij status `'Open'` én betaalwijze mollie (`(f.betaalwijze || 'mollie') === 'mollie'`).
- Agenda-badge: rekening `'Betaald'` → badge "Betaald" (`badge-actief`); anders "Op rekening" (`badge-aangevraagd`, was `badge-actief`). Blijft een link naar `factuur.html?id=...`.
- Crediteren/vervallen, betaalpagina, `zetFactuurStatus` en de afspraken-CSV blijven ongewijzigd; niets hernoemen.
- Testcommando: `node scripts/run-tests.mjs` (vanuit C:\Projects\oberpoes). Huidige stand: 75/75; deze feature voegt 2 tests toe → 77/77.
- Testbestand: `js/tests.js` (`test(naam, fn)` + `assert(voorwaarde, bericht?)`).

---

### Task 1: db.js — `markeerBetaald(id, betaalwijze)`

**Files:**
- Modify: `js/db.js` (direct ná `zetFactuurStatus`, ~regel 229)
- Test: `js/tests.js` (ná de laatste test `'zoekKlantOpContact: vindt op telefoon met spaties/streepjes, null bij onbekend'`, aan het eind van het bestand)

**Interfaces:**
- Consumes: `lees()`/`schrijf()` (module-intern); bestaande testhelpers `OberPoesDb.wisAlles/voegToe/maakAfspraak/maakFactuur`.
- Produces: `OberPoesDb.markeerBetaald(id, betaalwijze)` → bijgewerkte rekening (status `'Betaald'`, betaalwijze `'pin'|'contant'`) of `null`. Task 2 roept exact deze naam aan.

- [ ] **Step 1: Schrijf de falende tests**

Voeg toe aan `js/tests.js`, direct ná de test `'zoekKlantOpContact: vindt op telefoon met spaties/streepjes, null bij onbekend'` (de laatste test in het bestand):

```js
test('markeerBetaald: open mollie-rekening wordt Betaald met pin of contant', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Markeer BV' });
  const a1 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-09-01', tijd: '09:00', naam: 'K1', email: 'k1@x.nl' });
  const a2 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-09-01', tijd: '10:00', naam: 'K2', email: 'k2@x.nl' });
  const f1 = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a1.id, regels: [], betaalwijze: 'mollie' });
  const f2 = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a2.id, regels: [], betaalwijze: 'mollie' });
  const naPin = OberPoesDb.markeerBetaald(f1.id, 'pin');
  assert(naPin.status === 'Betaald' && naPin.betaalwijze === 'pin', 'pin: ' + JSON.stringify(naPin));
  const naContant = OberPoesDb.markeerBetaald(f2.id, 'contant');
  assert(naContant.status === 'Betaald' && naContant.betaalwijze === 'contant', 'contant: ' + JSON.stringify(naContant));
  assert(OberPoesDb.vindFactuur(f1.id).betaalwijze === 'pin', 'opgeslagen');
});

test('markeerBetaald: weigert niet-open rekening en ongeldige wijze', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Markeer BV' });
  const a = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-09-02', tijd: '09:00', naam: 'K1', email: 'k1@x.nl' });
  const f = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id, regels: [], betaalwijze: 'mollie' });
  assert(OberPoesDb.markeerBetaald(f.id, 'mollie') === null, 'mollie is geen geldige wijze');
  assert(OberPoesDb.markeerBetaald(f.id, 'onzin') === null, 'onzin -> null');
  assert(OberPoesDb.vindFactuur(f.id).status === 'Open', 'status onveranderd na ongeldige wijze');
  OberPoesDb.zetFactuurStatus(f.id, 'Betaald');
  assert(OberPoesDb.markeerBetaald(f.id, 'pin') === null, 'al Betaald -> null');
  assert(OberPoesDb.markeerBetaald('BESTAATNIET', 'pin') === null, 'onbekende id -> null');
});
```

- [ ] **Step 2: Draai de tests en zie de nieuwe tests falen**

Run: `node scripts/run-tests.mjs`
Verwacht: de 2 nieuwe tests FALEN (`markeerBetaald is not a function`); de bestaande 75 blijven groen.

- [ ] **Step 3: Implementeer `markeerBetaald`**

In `js/db.js`, direct ná het blok van `zetFactuurStatus` (dat eindigt met `return factuur;` gevolgd door `},`), toevoegen:

```js
    markeerBetaald(id, betaalwijze) {
      if (!['pin', 'contant'].includes(betaalwijze)) return null;
      const db = lees();
      const factuur = db.facturen.find((f) => f.id === id);
      if (!factuur || factuur.status !== 'Open') return null;
      factuur.status = 'Betaald';
      factuur.betaalwijze = betaalwijze;
      schrijf(db);
      return factuur;
    },
```

- [ ] **Step 4: Draai de tests en zie alles groen**

Run: `node scripts/run-tests.mjs`
Verwacht: 77/77 geslaagd.

- [ ] **Step 5: Commit**

```bash
git add js/db.js js/tests.js
git commit -m "feat: markeerBetaald(id, betaalwijze) voor open rekeningen"
```

---

### Task 2: beheer.js — knoppen "Betaald (pin/contant)" + demo-bevestiging in het rekeningenoverzicht

**Files:**
- Modify: `js/beheer.js` (statevars ~regel 463-466, `renderFacturen` rijen ~484-500, view-template ~501-530, handlers ~559-568)

**Interfaces:**
- Consumes: `OberPoesDb.markeerBetaald(id, wijze)` (Task 1); `huidigeTenant()`, `Berichten`, `Facturatie` (bestaand).
- Produces: knoppen met `data-betaald`/`data-wijze`; module-variabele `facturenMailHtml` gerenderd boven de lijst.

UI-code; verificatie in de browser (Task 4).

- [ ] **Step 1: Voeg de mail-state toe**

In `js/beheer.js`, vervang:

```js
  let facturenFilter = 'Alle';
  let facturenBetaalwijzeFilter = 'Alle';
  let facturenZoek = '';
  let facturenPagina = 1;
```

door:

```js
  let facturenFilter = 'Alle';
  let facturenBetaalwijzeFilter = 'Alle';
  let facturenZoek = '';
  let facturenPagina = 1;
  let facturenMailHtml = '';
```

- [ ] **Step 2: Voeg de knoppen toe aan de rijen**

In `js/beheer.js`, in de `rijen`-template van `renderFacturen`, vervang:

```js
          <a class="knop knop-secundair knop-klein" href="betaal.html?factuur=${f.id}" target="_blank">Betaalpagina</a>
          ${['Open', 'Betaald'].includes(f.status)
```

door:

```js
          <a class="knop knop-secundair knop-klein" href="betaal.html?factuur=${f.id}" target="_blank">Betaalpagina</a>
          ${f.status === 'Open' && (f.betaalwijze || 'mollie') === 'mollie'
            ? `<button class="knop knop-secundair knop-klein" data-betaald="${f.id}" data-wijze="pin">Betaald (pin)</button>
               <button class="knop knop-secundair knop-klein" data-betaald="${f.id}" data-wijze="contant">Betaald (contant)</button>` : ''}
          ${['Open', 'Betaald'].includes(f.status)
```

- [ ] **Step 3: Render de mailkaart boven de lijst**

In `js/beheer.js`, in de `view-facturen`-template, vervang:

```js
      <div class="kaart">
        <h2>Rekeningen</h2>
        <p><button class="knop knop-secundair knop-klein" id="knop-facturen-csv" ${alle.length === 0 ? 'disabled' : ''}>Download CSV</button></p>
```

door:

```js
      <div class="kaart">
        <h2>Rekeningen</h2>
        ${facturenMailHtml}
        <p><button class="knop knop-secundair knop-klein" id="knop-facturen-csv" ${alle.length === 0 ? 'disabled' : ''}>Download CSV</button></p>
```

- [ ] **Step 4: Voeg de handlers toe**

In `js/beheer.js`, direct ná het bestaande `data-vervallen`-handlersblok:

```js
    el('view-facturen').querySelectorAll('button[data-vervallen]').forEach((k) =>
      k.addEventListener('click', () => {
        if (!confirm('Weet u zeker dat u deze rekening wilt laten vervallen?')) return;
        OberPoesDb.laatVervallen(k.dataset.vervallen); renderFacturen();
      }));
```

toevoegen:

```js
    el('view-facturen').querySelectorAll('button[data-betaald]').forEach((k) =>
      k.addEventListener('click', () => {
        const wijze = k.dataset.wijze;
        if (!confirm(`Weet u zeker dat u deze rekening als betaald (${wijze}) wilt markeren?`)) return;
        const f = OberPoesDb.markeerBetaald(k.dataset.betaald, wijze);
        if (!f) return;
        const t = huidigeTenant();
        const bedrag = Facturatie.euro(Facturatie.totalen(f.regels).inclCent);
        facturenMailHtml = `
          <div class="melding melding-info">
            <strong>Mail verzonden (demo)</strong><br>
            <strong>Aan:</strong> ${f.klantEmail}<br>
            <strong>Onderwerp:</strong> Betaling ontvangen — rekening ${f.nummer}<br><br>
            ${Berichten.naarHtml(Berichten.render(Berichten.voor(t, 'betaling'), {
              naam: f.klantNaam, tenant: t.naam, nummer: f.nummer, bedrag,
            }))}<br><br>
            <button class="knop knop-secundair knop-klein" id="knop-facturen-mail-sluit">Sluiten</button>
          </div>`;
        renderFacturen();
      }));
    const facturenMailSluit = el('knop-facturen-mail-sluit');
    if (facturenMailSluit) facturenMailSluit.addEventListener('click', () => {
      facturenMailHtml = '';
      renderFacturen();
    });
```

- [ ] **Step 5: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 77/77 geslaagd.

- [ ] **Step 6: Commit**

```bash
git add js/beheer.js
git commit -m "feat: open Mollie-rekening als betaald (pin/contant) markeren"
```

---

### Task 3: beheer.js — agenda-badge toont Betaald

**Files:**
- Modify: `js/beheer.js` (`renderAgendaLijst`, rijen-template ~regel 158-168)

**Interfaces:**
- Consumes: `OberPoesDb.vindFactuur(id)` (bestaand).
- Produces: n.v.t. (eindpunt).

UI-code; verificatie in de browser (Task 4).

- [ ] **Step 1: Voeg de badge-helper toe en gebruik hem in de rij**

In `js/beheer.js`, in `renderAgendaLijst`, vervang:

```js
    const rijen = afspraken.map((a) => `
      <tr>
        <td><strong>${a.datum}</strong><br>${a.tijd}</td>
        <td>${a.naam}${a.extra ? `<br><small>${a.extra}</small>` : ''}</td>
        <td>${a.straat} ${a.huisnummer}<br><small>${a.postcode} ${a.plaats}</small></td>
        <td>${a.email}<br><small>${a.telefoon}</small></td>
        <td>${a.factuurId
          ? `<a class="badge badge-actief" href="factuur.html?id=${a.factuurId}" target="_blank">Op rekening</a>`
          : `<button class="knop knop-klein" data-factureer="${a.id}">Rekening maken</button>
             <button class="knop knop-gevaar knop-klein" data-id="${a.id}">Annuleren</button>`}</td>
      </tr>`).join('');
```

door:

```js
    const factuurBadge = (a) => {
      const f = OberPoesDb.vindFactuur(a.factuurId);
      const betaald = f && f.status === 'Betaald';
      return `<a class="badge ${betaald ? 'badge-actief' : 'badge-aangevraagd'}" `
        + `href="factuur.html?id=${a.factuurId}" target="_blank">${betaald ? 'Betaald' : 'Op rekening'}</a>`;
    };
    const rijen = afspraken.map((a) => `
      <tr>
        <td><strong>${a.datum}</strong><br>${a.tijd}</td>
        <td>${a.naam}${a.extra ? `<br><small>${a.extra}</small>` : ''}</td>
        <td>${a.straat} ${a.huisnummer}<br><small>${a.postcode} ${a.plaats}</small></td>
        <td>${a.email}<br><small>${a.telefoon}</small></td>
        <td>${a.factuurId
          ? factuurBadge(a)
          : `<button class="knop knop-klein" data-factureer="${a.id}">Rekening maken</button>
             <button class="knop knop-gevaar knop-klein" data-id="${a.id}">Annuleren</button>`}</td>
      </tr>`).join('');
```

- [ ] **Step 2: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 77/77 geslaagd.

- [ ] **Step 3: Commit**

```bash
git add js/beheer.js
git commit -m "feat: agenda-badge toont Betaald bij betaalde rekening"
```

---

### Task 4: Browserverificatie end-to-end en push

**Files:** geen codewijziging verwacht (alleen als verificatie een fout blootlegt).

**Interfaces:**
- Consumes: alles uit Task 1-3.

- [ ] **Step 1: Start de preview-server**

Gebruik de browser-preview (`preview_start` met naam `oberpoes`, poort 8321). Niet via Bash starten.

- [ ] **Step 2: Beheersessie en testdata**

Navigeer naar `beheer.html`; zo nodig `OberPoesDb.laadDemoData()` en de actieve tenantcode pakken; sessie zetten met `localStorage.setItem('oberpoes_tenant_<CODE>', String(Date.now()))` en herladen naar `beheer.html?code=<CODE>`. Maak via Afspraken → "Rekening maken" een rekening met betaalwijze **Mollie** (status Open) als die er nog niet is.

- [ ] **Step 3: Controleer de agenda-badge vóór betaling**

In het afsprakenoverzicht: de gefactureerde afspraak toont badge **"Op rekening"** (klasse `badge-aangevraagd`).

- [ ] **Step 4: Markeer als betaald (pin)**

Open Rekeningen. Bij de open Mollie-rij staan "Betaald (pin)" en "Betaald (contant)". Klik "Betaald (pin)" → bevestigingsvraag → daarna: mailkaart boven de lijst ("Betaling ontvangen — rekening …", sjabloon betaling), rij toont **Betaald + Pin**. De knoppen zijn bij die rij verdwenen. Sluitknop verbergt de mailkaart.

- [ ] **Step 5: Filter en agenda-badge ná betaling**

Filter op betaalwijze **Pin** vindt de gemarkeerde rekening. Ga naar Afspraken: de badge van de gekoppelde afspraak toont nu **"Betaald"** (klasse `badge-actief`).

- [ ] **Step 6: Randgevallen**

Een rekening die bij aanmaken al **Pin** was (maak er zo nodig één): geen "Betaald (…)"-knoppen (staat al op Betaald). Annuleren in de bevestigingsvraag wijzigt niets.

- [ ] **Step 7: Draai de volledige testset nog één keer**

Run: `node scripts/run-tests.mjs`
Verwacht: 77/77 geslaagd.

- [ ] **Step 8: Push**

```bash
git push origin master
```

---

## Self-Review

**Spec coverage:**
- `markeerBetaald` (alleen Open, alleen pin/contant, status+betaalwijze) → Task 1.
- Twee knoppen bij Open+mollie, bevestigingsvraag, demo-betalingsbevestiging boven de lijst met sluitknop → Task 2.
- Agenda-badge Betaald/Op rekening met kleuren `badge-actief`/`badge-aangevraagd`, link blijft → Task 3.
- Kolom/filter/CSV kloppen automatisch (betaalwijze wijzigt echt) → geverifieerd in Task 4 Step 5.
- Wat niet verandert (crediteren/vervallen/betaalpagina/afspraken-CSV) → geen taak raakt die code aan.

**Placeholder scan:** geen TBD/TODO; alle codestappen bevatten volledige code; verificatiestappen hebben verwachte uitkomsten.

**Type consistency:** `markeerBetaald(id, betaalwijze)` (Task 1) ↔ aanroep met `k.dataset.betaald, wijze` (Task 2); `facturenMailHtml` gedeclareerd in Step 1 en gebruikt in Step 3/4 van Task 2; `factuurBadge(a)` alleen binnen Task 3 gedefinieerd en gebruikt; element-id `knop-facturen-mail-sluit` consistent tussen template en handler.
