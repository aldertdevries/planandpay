# Actiemenu rekeningenoverzicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De actieknoppen per rekening worden één klein uitklapmenu (☰) per rij, zodat de actiekolom smal wordt en de andere kolommen netjes in beeld komen.

**Architecture:** Natief `<details class="actie-menu">` met `<summary>☰</summary>` per rij (in-flow, dus geen clipping in de horizontaal scrollende `.tabel-scroll`-container). Menu-items behouden hun huidige tags en `data-*`-attributen, dus alle bestaande handlers en zichtbaarheidsregels blijven ongewijzigd. Klein beetje JS: één open menu tegelijk, klik buiten sluit. Styling in `css/style.css`.

**Tech Stack:** Vanilla HTML/CSS/JS (geen build), Node-testharnas (`node scripts/run-tests.mjs`), browser-preview op poort 8321 (launch-naam `oberpoes`).

## Global Constraints

- B1-Nederlands; linklabel wordt "Rekening bekijken" (was "Rekening"); overige labels ongewijzigd.
- Zichtbaarheidsregels per item exact zoals nu: Betaald (pin)/(contant) alleen bij `f.status === 'Open' && (f.betaalwijze || 'mollie') === 'mollie'`; Crediteren bij `['Open', 'Betaald']`; Vervallen bij `'Open'` (rood, als laatste item).
- Alle bestaande `data-*`-attributen, handlers, bevestigingsvragen en de mailkaart blijven ongewijzigd; niets hernoemen.
- Alleen het rekeningenoverzicht; agenda-acties en andere views blijven zoals ze zijn. Geen db-wijzigingen.
- Regressie: `node scripts/run-tests.mjs` (vanuit C:\Projects\oberpoes) → 77/77 (geen nieuwe tests).

---

### Task 1: Actiemenu — rij-template, menugedrag en CSS

**Files:**
- Modify: `js/beheer.js` (rij-template `renderFacturen` ~regel 499-509; menugedrag-JS ná de `knop-facturen-mail-sluit`-handler ~regel 600-604)
- Modify: `css/style.css` (nieuw blok `.actie-menu` aan het eind van het bestand)

**Interfaces:**
- Consumes: bestaande handlers in `renderFacturen` die via `el('view-facturen').querySelectorAll('button[data-...]')` items vinden (blijven werken omdat de items dezelfde attributen houden).
- Produces: n.v.t. (eindpunt).

- [ ] **Step 1: Vervang de actiecel door het menu**

In `js/beheer.js`, in de `rijen`-template van `renderFacturen`, vervang:

```js
        <td>
          <a class="knop knop-secundair knop-klein" href="factuur.html?id=${f.id}" target="_blank">Rekening</a>
          <a class="knop knop-secundair knop-klein" href="betaal.html?factuur=${f.id}" target="_blank">Betaalpagina</a>
          ${f.status === 'Open' && (f.betaalwijze || 'mollie') === 'mollie'
            ? `<button class="knop knop-secundair knop-klein" data-betaald="${f.id}" data-wijze="pin">Betaald (pin)</button>
               <button class="knop knop-secundair knop-klein" data-betaald="${f.id}" data-wijze="contant">Betaald (contant)</button>` : ''}
          ${['Open', 'Betaald'].includes(f.status)
            ? `<button class="knop knop-secundair knop-klein" data-crediteer="${f.id}">Crediteren</button>` : ''}
          ${f.status === 'Open'
            ? `<button class="knop knop-gevaar knop-klein" data-vervallen="${f.id}">Vervallen</button>` : ''}
        </td>
```

door:

```js
        <td>
          <details class="actie-menu">
            <summary aria-label="Acties">☰</summary>
            <div class="actie-menu-lijst">
              <a href="factuur.html?id=${f.id}" target="_blank">Rekening bekijken</a>
              <a href="betaal.html?factuur=${f.id}" target="_blank">Betaalpagina</a>
              ${f.status === 'Open' && (f.betaalwijze || 'mollie') === 'mollie'
                ? `<button data-betaald="${f.id}" data-wijze="pin">Betaald (pin)</button>
                   <button data-betaald="${f.id}" data-wijze="contant">Betaald (contant)</button>` : ''}
              ${['Open', 'Betaald'].includes(f.status)
                ? `<button data-crediteer="${f.id}">Crediteren</button>` : ''}
              ${f.status === 'Open'
                ? `<button class="gevaar" data-vervallen="${f.id}">Vervallen</button>` : ''}
            </div>
          </details>
        </td>
```

- [ ] **Step 2: Voeg het menugedrag toe**

In `js/beheer.js`, direct ná het `knop-facturen-mail-sluit`-blok:

```js
    const facturenMailSluit = el('knop-facturen-mail-sluit');
    if (facturenMailSluit) facturenMailSluit.addEventListener('click', () => {
      facturenMailHtml = '';
      renderFacturen();
    });
```

toevoegen (nog binnen `renderFacturen`, vóór de sluitaccolade `}` van de functie):

```js
    const actieMenus = el('view-facturen').querySelectorAll('details.actie-menu');
    actieMenus.forEach((menu) => menu.addEventListener('toggle', () => {
      if (menu.open) actieMenus.forEach((ander) => { if (ander !== menu) ander.open = false; });
    }));
    if (!el('view-facturen').dataset.menuSluiter) {
      el('view-facturen').dataset.menuSluiter = 'ja';
      el('view-facturen').addEventListener('click', (e) => {
        if (e.target.closest('details.actie-menu')) return;
        el('view-facturen').querySelectorAll('details.actie-menu[open]')
          .forEach((menu) => { menu.open = false; });
      });
    }
```

(Let op: de klik-listener eenmalig binden — `#view-facturen` blijft bestaan tussen re-renders, dus een onvoorwaardelijke `addEventListener` zou zich opstapelen. De handler bevraagt de menu's live op klikmoment.)

- [ ] **Step 3: Voeg de menu-styling toe**

Aan het eind van `css/style.css` toevoegen:

```css
/* Actiemenu per rij (rekeningenoverzicht) */
.actie-menu { position: relative; display: inline-block; }
.actie-menu summary {
  list-style: none;
  cursor: pointer;
  display: inline-block;
  padding: 2px 10px;
  border: 1px solid var(--rand);
  border-radius: 8px;
  background: #fff;
  color: var(--charcoal);
  font-size: 0.95rem;
  line-height: 1.4;
}
.actie-menu summary::-webkit-details-marker { display: none; }
.actie-menu[open] summary { background: #F8FAFC; }
.actie-menu-lijst {
  margin-top: 4px;
  width: max-content;
  min-width: 160px;
  border: 1px solid var(--rand);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}
.actie-menu-lijst a,
.actie-menu-lijst button {
  display: block;
  width: 100%;
  padding: 7px 12px;
  border: none;
  border-bottom: 1px solid #F1F5F9;
  background: none;
  color: var(--charcoal);
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.actie-menu-lijst a:last-child,
.actie-menu-lijst button:last-child { border-bottom: none; }
.actie-menu-lijst a:hover,
.actie-menu-lijst button:hover { background: #F8FAFC; }
.actie-menu-lijst .gevaar { color: #DC2626; }
```

- [ ] **Step 4: Regressie-check tests**

Run: `node scripts/run-tests.mjs`
Verwacht: 77/77 geslaagd.

- [ ] **Step 5: Commit**

```bash
git add js/beheer.js css/style.css
git commit -m "feat: acties per rekening in een klein uitklapmenu"
```

---

### Task 2: Browserverificatie end-to-end en push

**Files:** geen codewijziging verwacht (alleen als verificatie een fout blootlegt).

**Interfaces:**
- Consumes: Task 1.

- [ ] **Step 1: Start de preview-server**

Gebruik de browser-preview (`preview_start` met naam `oberpoes`, poort 8321). Niet via Bash starten.

- [ ] **Step 2: Beheersessie en testdata**

Navigeer naar `beheer.html`; zo nodig demo-data laden en sessie zetten (`localStorage.setItem('oberpoes_tenant_<CODE>', String(Date.now()))`). Zorg voor minstens één Open+Mollie-rekening en één Betaalde rekening (maak ze via Afspraken → "Rekening maken" als ze ontbreken).

- [ ] **Step 3: Menu-inhoud per status**

Open Rekeningen. Bij de Open+Mollie-rij: menu openen → 6 items in volgorde (Rekening bekijken, Betaalpagina, Betaald (pin), Betaald (contant), Crediteren, Vervallen — laatste in rood). Bij een Betaalde rij: 3 items (Rekening bekijken, Betaalpagina, Crediteren).

- [ ] **Step 4: Menugedrag**

Tweede menu openen sluit het eerste; klik buiten de menu's sluit het open menu.

- [ ] **Step 5: Acties via het menu**

"Betaald (pin)" via het menu → bevestigingsvraag → rij Betaald+Pin + mailkaart (bestaand gedrag). "Rekening bekijken" heeft een geldige `factuur.html?id=...`-href. "Vervallen" op een andere Open rekening → status Vervallen. (Crediteren-handler is identiek gebonden; steekproef mag.)

- [ ] **Step 6: Kolombreedte**

Controleer dat de actiekolom aanzienlijk smaller is dan voorheen (alleen het ☰-knopje in gesloten toestand).

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
- `<details>`-menu met alle acties, label "Rekening bekijken", zichtbaarheidsregels intact, Vervallen rood en laatste → Task 1 Step 1.
- Eén menu tegelijk + klik-buiten-sluit → Task 1 Step 2.
- CSS-blok `.actie-menu` (summary-knopje zonder marker, kaartje, items, hover, gevaar) → Task 1 Step 3.
- Geen wijziging aan handlers/agenda/db → geen taak raakt die code; e2e bevestigt (Task 2 Step 5).
- Regressie + browserverificatie → Task 1 Step 4, Task 2.

**Placeholder scan:** geen TBD/TODO; alle codestappen bevatten volledige code.

**Type consistency:** klasse-namen `actie-menu`/`actie-menu-lijst`/`gevaar` consistent tussen Task 1 Step 1 (HTML), Step 2 (selector `details.actie-menu`) en Step 3 (CSS); `data-*`-attributen ongewijzigd t.o.v. de bestaande handlers.
