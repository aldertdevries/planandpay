# Ontwerp: Actiemenu per rekening in het rekeningenoverzicht

Datum: 2026-07-17
Status: goedgekeurd (variant A gekozen via visuele mockups)

## Doel

De actieknoppen per rekening (tot zes stuks: Rekening, Betaalpagina, Betaald
(pin), Betaald (contant), Crediteren, Vervallen) nemen veel horizontale ruimte
in, waardoor de andere kolommen lelijk in beeld komen. Alle acties gaan daarom
in één klein uitklapmenu (☰) per rij — gekozen variant **A**: ook "Rekening
bekijken" zit in het menu; de actiekolom toont alleen het menuknopje.

## Techniekkeuze

Natief `<details>`-element met `<summary>☰</summary>`. Het menu klapt in de
rij open (in-flow). Bewust géén zwevend/absoluut gepositioneerd menu: de tabel
staat in de horizontaal scrollende `.tabel-scroll`-container en zou een
zwevend menu afknippen. `<details>` is bovendien standaard toegankelijk en
vraagt nauwelijks JavaScript.

## Wijzigingen per bestand

### js/beheer.js — `renderFacturen`, rij-template

De huidige actiecel:

```
Rekening | Betaalpagina | [Betaald (pin) | Betaald (contant)] | [Crediteren] | [Vervallen]
```

wordt één menu per rij:

```html
<details class="actie-menu">
  <summary aria-label="Acties">☰</summary>
  <div class="actie-menu-lijst">
    <a href="factuur.html?id=..." target="_blank">Rekening bekijken</a>
    <a href="betaal.html?factuur=..." target="_blank">Betaalpagina</a>
    <!-- alleen bij Open + mollie: -->
    <button data-betaald="..." data-wijze="pin">Betaald (pin)</button>
    <button data-betaald="..." data-wijze="contant">Betaald (contant)</button>
    <!-- alleen bij Open of Betaald: -->
    <button data-crediteer="...">Crediteren</button>
    <!-- alleen bij Open, rood, als laatste: -->
    <button data-vervallen="..." class="gevaar">Vervallen</button>
  </div>
</details>
```

- Zichtbaarheidsregels per item exact zoals nu (Betaald-knoppen alleen bij
  `f.status === 'Open' && (f.betaalwijze || 'mollie') === 'mollie'`,
  Crediteren bij Open/Betaald, Vervallen bij Open).
- Alle bestaande `data-*`-attributen en handlers blijven ongewijzigd; de
  handlers zoeken via `el('view-facturen').querySelectorAll(...)` en vinden de
  items ook binnen het menu.
- Linklabel "Rekening" wordt "Rekening bekijken" (duidelijker als menu-item).

### js/beheer.js — menugedrag (klein, in `renderFacturen` ná het renderen)

- Bij het openen van een menu sluiten andere open menu's: `toggle`-listener op
  elke `details.actie-menu`; bij `open` alle andere `details.actie-menu[open]`
  sluiten.
- Eén klik-listener op `el('view-facturen')` die open menu's sluit wanneer er
  buiten een `.actie-menu` geklikt wordt.
- Na een actie (markeer betaald/crediteren/vervallen) rendert de lijst
  opnieuw; menu's zijn dan vanzelf dicht.

### css/style.css

Nieuw blok `.actie-menu`:

- `summary`: klein knopje in de bestaande secundaire-knopstijl (rand
  `--rand`-kleur, afronding, padding ~2px 10px), zonder standaard
  driehoek-marker (`list-style: none` + `::-webkit-details-marker { display:
  none; }`), cursor pointer.
- `.actie-menu-lijst`: kaartje met witte achtergrond, 1px rand, 8px afronding,
  subtiele schaduw, kleine bovenmarge, breedte ~max-content.
- Items (`a` en `button`): volle breedte, links uitgelijnd, zelfde padding en
  lettergrootte, geen eigen randen/achtergrond, hover-achtergrond (`#F8FAFC`),
  onderlinge scheidingslijntjes; `.gevaar`-item in rood (`#DC2626`).

## Wat bewust NIET verandert

- De agenda-acties ("Rekening maken"/"Annuleren") en alle andere views.
- Alle handlers, zichtbaarheidsregels, bevestigingsvragen en de mailkaart.
- Geen db-wijzigingen.

## Tests

- Geen nieuwe unit-tests (puur UI); regressie `node scripts/run-tests.mjs` →
  77/77.
- Browser-e2e: menu opent en toont per status de juiste items (Open+Mollie:
  6 items; Betaald: alleen bekijken/betaalpagina/crediteren); tweede menu
  openen sluit het eerste; klik buiten sluit; elk actietype werkt één keer
  via het menu (bekijken-link, markeer betaald pin, crediteren, vervallen);
  de actiekolom is aanzienlijk smaller.
