// Beheergedeelte van één tenant (?code=XXXXXX): agenda, openingstijden, profiel.
(() => {
  if (!document.getElementById('beheer-app')) return;

  const el = (id) => document.getElementById(id);
  const code = new URLSearchParams(location.search).get('code') || '';
  const SESSIE_SLEUTEL = 'oberpoes_tenant_' + code.toUpperCase();

  function huidigeTenant() { return OberPoesDb.vindTenant(code); }

  const tenant = huidigeTenant();
  if (!tenant || tenant.status !== 'Actief') {
    el('niet-beschikbaar').classList.remove('verborgen');
    return;
  }
  el('kop-naam').textContent = `🐾 ${tenant.naam} — beheer`;

  // --- Login: wachtwoordloos via verificatie van e-mail of telefoon ---
  function toonApp() {
    el('login-kaart').classList.add('verborgen');
    el('beheer-app').classList.remove('verborgen');
    el('beheer-menu').classList.remove('verborgen');
    toonView('agenda');
  }

  let verwachteCode = '';
  el('masker-email').textContent = Maskeer.email(tenant.email);
  el('masker-telefoon').textContent = Maskeer.telefoon(tenant.telefoon);

  function stuurCode(kanaal) {
    verwachteCode = String(Math.floor(100000 + Math.random() * 900000));
    el('demo-login-code').innerHTML =
      `<strong>Demo:</strong> in een echte omgeving ontvangt u deze code per ${kanaal}.<br>`
      + `Code: <span class="demo-code">${verwachteCode}</span>`;
    el('login-code').value = '';
    el('fout-login').textContent = '';
    el('methode-keuze').classList.add('verborgen');
    el('code-stap').classList.remove('verborgen');
  }
  el('knop-email').addEventListener('click', () => stuurCode('e-mail'));
  el('knop-sms').addEventListener('click', () => stuurCode('sms'));
  el('andere-methode').addEventListener('click', (e) => {
    e.preventDefault();
    verwachteCode = '';
    el('code-stap').classList.add('verborgen');
    el('methode-keuze').classList.remove('verborgen');
  });
  el('knop-verifieer').addEventListener('click', () => {
    if (!verwachteCode || el('login-code').value.trim() !== verwachteCode) {
      el('fout-login').textContent = 'Deze code klopt niet.';
      return;
    }
    sessionStorage.setItem(SESSIE_SLEUTEL, 'ja');
    toonApp();
  });
  el('login-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el('knop-verifieer').click();
  });
  el('menu-uitloggen').addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem(SESSIE_SLEUTEL);
    location.reload();
  });

  // --- Views ---
  function toonView(naam) {
    ['agenda', 'regels', 'facturen', 'tijden', 'profiel'].forEach((v) => {
      el('view-' + v).classList.toggle('verborgen', v !== naam);
      el('menu-' + v).classList.toggle('actief', v === naam);
    });
    if (naam === 'agenda') renderAgenda();
    if (naam === 'regels') renderRegels();
    if (naam === 'facturen') renderFacturen();
    if (naam === 'tijden') renderTijden();
    if (naam === 'profiel') renderProfiel();
  }
  ['agenda', 'regels', 'facturen', 'tijden', 'profiel'].forEach((v) => {
    el('menu-' + v).addEventListener('click', (e) => { e.preventDefault(); toonView(v); });
  });

  // --- Agenda ---
  let agendaWeergave = 'lijst';
  let weekStart = Agenda.maandagVan(new Date().toISOString().slice(0, 10));
  const datumPlus = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  function renderAgenda() {
    if (agendaWeergave === 'week') {
      renderWeek();
      return;
    }
    renderAgendaLijst();
  }

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

  let agendaZoek = '';
  let agendaPagina = 1;

  function renderAgendaLijst() {
    const alleAfspraken = OberPoesDb.afsprakenVoor(code)
      .slice()
      .sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd));
    const pagina = Lijst.filterEnPagineer(alleAfspraken, agendaZoek, ['naam', 'datum'], agendaPagina);
    agendaPagina = pagina.pagina;
    const afspraken = pagina.items;
    const rijen = afspraken.map((a) => `
      <tr>
        <td><strong>${a.datum}</strong><br>${a.tijd}</td>
        <td>${a.naam}${a.extra ? `<br><small>${a.extra}</small>` : ''}</td>
        <td>${a.straat} ${a.huisnummer}<br><small>${a.postcode} ${a.plaats}</small></td>
        <td>${a.email}<br><small>${a.telefoon}</small></td>
        <td>${a.factuurId
          ? `<a class="badge badge-actief" href="factuur.html?id=${a.factuurId}" target="_blank">Gefactureerd</a>`
          : `<button class="knop knop-klein" data-factureer="${a.id}">Factureren</button>
             <button class="knop knop-gevaar knop-klein" data-id="${a.id}">Annuleren</button>`}</td>
      </tr>`).join('');
    el('view-agenda').innerHTML = `
      <div class="kaart">
        <h2>Agenda</h2>
        <p><button class="knop knop-secundair knop-klein" id="knop-naar-week">Weekweergave</button></p>
        <div class="veld" style="max-width: 260px;">
          <label for="zoek-agenda">Zoeken (naam of datum)</label>
          <input id="zoek-agenda" type="search" value="${agendaZoek}">
        </div>
        ${afspraken.length === 0 ? '<p>Geen afspraken gevonden.</p>' : `
        <table class="tabel">
          <thead><tr><th scope="col">Wanneer</th><th scope="col">Klant</th><th scope="col">Adres</th><th scope="col">Contact</th><th scope="col"></th></tr></thead>
          <tbody>${rijen}</tbody>
        </table>`}
        <p>
          <button class="knop knop-secundair knop-klein" id="agenda-vorige" ${pagina.pagina <= 1 ? 'disabled' : ''}>‹ Vorige</button>
          pagina ${pagina.pagina} van ${pagina.paginas} (${pagina.totaal} afspraken)
          <button class="knop knop-secundair knop-klein" id="agenda-volgende" ${pagina.pagina >= pagina.paginas ? 'disabled' : ''}>Volgende ›</button>
        </p>
      </div>
      <div id="factuur-opbouw"></div>`;
    el('zoek-agenda').addEventListener('input', (e) => {
      agendaZoek = e.target.value;
      agendaPagina = 1;
      renderAgendaLijst();
      const veld = el('zoek-agenda');
      veld.focus();
      veld.setSelectionRange(agendaZoek.length, agendaZoek.length);
    });
    el('agenda-vorige').addEventListener('click', () => { agendaPagina--; renderAgendaLijst(); });
    el('agenda-volgende').addEventListener('click', () => { agendaPagina++; renderAgendaLijst(); });
    el('view-agenda').querySelectorAll('button[data-id]').forEach((k) => {
      k.addEventListener('click', () => {
        OberPoesDb.annuleerAfspraak(k.dataset.id);
        renderAgenda();
      });
    });
    el('view-agenda').querySelectorAll('button[data-factureer]').forEach((k) => {
      k.addEventListener('click', () => renderFactuurOpbouw(k.dataset.factureer));
    });
    el('knop-naar-week').addEventListener('click', () => {
      agendaWeergave = 'week';
      renderAgenda();
    });
  }

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

  function toonMail(factuur) {
    const t = huidigeTenant();
    const totaal = Facturatie.totalen(factuur.regels);
    el('factuur-opbouw').innerHTML = `
      <div class="kaart">
        <h2>Mail verzonden (demo)</h2>
        <div class="melding melding-info">
          <strong>Aan:</strong> ${factuur.klantEmail}<br>
          <strong>Onderwerp:</strong> Factuur ${factuur.nummer} van ${t.naam}<br><br>
          Beste ${factuur.klantNaam},<br><br>
          Hierbij ontvangt u factuur ${factuur.nummer} (${Facturatie.euro(totaal.inclCent)})
          voor uw afspraak. U kunt eenvoudig online betalen via
          <a href="betaal.html?factuur=${factuur.id}" target="_blank">deze Mollie-betaallink</a>.<br><br>
          Met vriendelijke groet,<br>${t.naam}<br><br>
          <strong>Bijlage:</strong>
          <a href="factuur.html?id=${factuur.id}" target="_blank">factuur-${factuur.nummer}.pdf</a>
        </div>
        <button class="knop knop-secundair" id="knop-mail-sluit">Sluiten</button>
      </div>`;
    el('factuur-opbouw').scrollIntoView({ behavior: 'smooth' });
    el('knop-mail-sluit').addEventListener('click', () => { el('factuur-opbouw').innerHTML = ''; });
  }

  // --- Factuurregels ---
  function bedragNaarCent(invoer) {
    const bedrag = parseFloat(String(invoer).replace(',', '.'));
    if (!isFinite(bedrag) || bedrag <= 0) return null;
    return Math.round(bedrag * 100);
  }
  const btwLabel = (btw) => (btw === 'hoog' ? '21% (hoog)' : '9% (laag)');

  function renderRegels() {
    const t = huidigeTenant();
    const regels = t.factuurRegels || [];
    const rijen = regels.map((r) => `
      <tr>
        <td>${r.naam}</td>
        <td>${btwLabel(r.btw)}</td>
        <td>${Facturatie.euro(r.bedragCent)}</td>
        <td><button class="knop knop-gevaar knop-klein" data-verwijder="${r.id}">Verwijderen</button></td>
      </tr>`).join('');
    el('view-regels').innerHTML = `
      <div class="kaart">
        <h2>Factuurregels</h2>
        ${regels.length === 0 ? '<p>Nog geen factuurregels gedefinieerd.</p>' : `
        <table class="tabel">
          <thead><tr><th>Naam</th><th>Btw</th><th>Bedrag (incl. btw)</th><th></th></tr></thead>
          <tbody>${rijen}</tbody>
        </table>`}
        <h3>Regel toevoegen</h3>
        <div class="velden-rij">
          <div class="veld"><label for="regel-naam">Naam</label>
            <input id="regel-naam" type="text"></div>
          <div class="veld"><label for="regel-btw">Btw</label>
            <select id="regel-btw"><option value="hoog">21% (hoog)</option><option value="laag">9% (laag)</option></select></div>
          <div class="veld"><label for="regel-bedrag">Bedrag incl. btw (€)</label>
            <input id="regel-bedrag" type="number" step="0.01" min="0"></div>
        </div>
        <span class="fout" id="fout-regel"></span>
        <button class="knop" id="knop-regel-opslaan">Toevoegen</button>
      </div>`;
    el('view-regels').querySelectorAll('button[data-verwijder]').forEach((k) => {
      k.addEventListener('click', () => {
        OberPoesDb.zetFactuurRegels(code,
          (huidigeTenant().factuurRegels || []).filter((r) => r.id !== k.dataset.verwijder));
        renderRegels();
      });
    });
    el('knop-regel-opslaan').addEventListener('click', () => {
      const naam = el('regel-naam').value.trim();
      const bedragCent = bedragNaarCent(el('regel-bedrag').value);
      if (naam.length < 2 || bedragCent === null) {
        el('fout-regel').textContent = 'Vul een naam (minimaal 2 tekens) en een bedrag groter dan 0 in.';
        return;
      }
      OberPoesDb.zetFactuurRegels(code, [
        ...(huidigeTenant().factuurRegels || []),
        { id: OberPoesDb.genereerCode(), naam, btw: el('regel-btw').value, bedragCent },
      ]);
      renderRegels();
    });
  }

  // --- Facturen ---
  let facturenFilter = 'Alle';
  let facturenZoek = '';
  let facturenPagina = 1;

  function renderFacturen() {
    const alle = OberPoesDb.facturenVoor(code);
    const basis = facturenFilter === 'Alle' ? alle : alle.filter((f) => f.status === facturenFilter);
    const pagina = Lijst.filterEnPagineer(basis, facturenZoek, ['nummer', 'klantNaam'], facturenPagina);
    facturenPagina = pagina.pagina;
    const lijst = pagina.items;
    const opties = ['Alle', 'Open', 'Betaald', 'Gecrediteerd', 'Vervallen', 'Credit']
      .map((s) => `<option ${s === facturenFilter ? 'selected' : ''}>${s}</option>`).join('');
    const badgeKlasse = { Open: 'badge-aangevraagd', Betaald: 'badge-actief',
      Vervallen: 'badge-inactief', Gecrediteerd: 'badge-afgewezen', Credit: 'badge-inactief' };
    const statusBadge = (s) => `<span class="badge ${badgeKlasse[s]}">${s}</span>`;
    const rijen = lijst.map((f) => `
      <tr>
        <td><strong>${f.nummer}</strong>${f.creditVoor ? `<br><small>credit voor ${f.creditVoor}</small>` : ''}</td>
        <td>${new Date(f.gemaaktOp).toLocaleDateString('nl-NL')}</td>
        <td>${f.klantNaam}</td>
        <td>${Facturatie.euro(Facturatie.totalen(f.regels).inclCent)}</td>
        <td>${statusBadge(f.status)}</td>
        <td>
          <a class="knop knop-secundair knop-klein" href="factuur.html?id=${f.id}" target="_blank">Factuur</a>
          <a class="knop knop-secundair knop-klein" href="betaal.html?factuur=${f.id}" target="_blank">Betaalpagina</a>
          ${['Open', 'Betaald'].includes(f.status)
            ? `<button class="knop knop-secundair knop-klein" data-crediteer="${f.id}">Crediteren</button>` : ''}
          ${f.status === 'Open'
            ? `<button class="knop knop-gevaar knop-klein" data-vervallen="${f.id}">Vervallen</button>` : ''}
        </td>
      </tr>`).join('');
    el('view-facturen').innerHTML = `
      <div class="kaart">
        <h2>Facturen</h2>
        <div class="velden-rij" style="max-width: 520px;">
          <div class="veld">
            <label for="filter-factuurstatus">Filter op status</label>
            <select id="filter-factuurstatus">${opties}</select>
          </div>
          <div class="veld">
            <label for="zoek-facturen">Zoeken (nummer of klant)</label>
            <input id="zoek-facturen" type="search" value="${facturenZoek}">
          </div>
        </div>
        ${lijst.length === 0 ? '<p>Geen facturen gevonden.</p>' : `
        <table class="tabel">
          <thead><tr><th scope="col">Nummer</th><th scope="col">Datum</th><th scope="col">Klant</th><th scope="col">Bedrag</th><th scope="col">Status</th><th scope="col"></th></tr></thead>
          <tbody>${rijen}</tbody>
        </table>
        <p><small>De betaalstatus wordt (in de demo) afgeleid van de Mollie-betaalpagina.</small></p>`}
        <p>
          <button class="knop knop-secundair knop-klein" id="facturen-vorige" ${pagina.pagina <= 1 ? 'disabled' : ''}>‹ Vorige</button>
          pagina ${pagina.pagina} van ${pagina.paginas} (${pagina.totaal} facturen)
          <button class="knop knop-secundair knop-klein" id="facturen-volgende" ${pagina.pagina >= pagina.paginas ? 'disabled' : ''}>Volgende ›</button>
        </p>
      </div>`;
    el('filter-factuurstatus').addEventListener('change', (e) => {
      facturenFilter = e.target.value;
      facturenPagina = 1;
      renderFacturen();
    });
    el('zoek-facturen').addEventListener('input', (e) => {
      facturenZoek = e.target.value;
      facturenPagina = 1;
      renderFacturen();
      const veld = el('zoek-facturen');
      veld.focus();
      veld.setSelectionRange(facturenZoek.length, facturenZoek.length);
    });
    el('facturen-vorige').addEventListener('click', () => { facturenPagina--; renderFacturen(); });
    el('facturen-volgende').addEventListener('click', () => { facturenPagina++; renderFacturen(); });
    el('view-facturen').querySelectorAll('button[data-crediteer]').forEach((k) =>
      k.addEventListener('click', () => { OberPoesDb.crediteerFactuur(k.dataset.crediteer); renderFacturen(); }));
    el('view-facturen').querySelectorAll('button[data-vervallen]').forEach((k) =>
      k.addEventListener('click', () => { OberPoesDb.laatVervallen(k.dataset.vervallen); renderFacturen(); }));
  }

  // --- Openingstijden ---
  function renderTijden() {
    const t = huidigeTenant();
    const vandaag = new Date().toISOString().slice(0, 10);
    const blokkades = Agenda.actieveBlokkades(t.blokkades || [], vandaag);
    const dagOpties = Agenda.DAG_SLEUTELS
      .map((d, i) => `<option value="${d}">${Agenda.DAG_NAMEN[i]}</option>`).join('');
    const blokRijen = blokkades.map((b) => `
      <tr>
        <td>${b.omschrijving || '—'}</td>
        <td>${b.type === 'wekelijks'
          ? 'wekelijks ' + Agenda.DAG_NAMEN[Agenda.DAG_SLEUTELS.indexOf(b.dag)]
          : new Date(b.datum + 'T12:00:00').toLocaleDateString('nl-NL')
            + (b.datumTot && b.datumTot !== b.datum
              ? ' t/m ' + new Date(b.datumTot + 'T12:00:00').toLocaleDateString('nl-NL') : '')} ${b.van}–${b.tot}</td>
        <td><button class="knop knop-gevaar knop-klein" data-blok-weg="${b.id}">Verwijderen</button></td>
      </tr>`).join('');
    const rijen = Agenda.DAG_SLEUTELS.map((dag, i) => {
      const d = t.openingstijden[dag];
      return `
      <tr>
        <td><label><input type="checkbox" id="open-${dag}" ${d.open ? 'checked' : ''}> ${Agenda.DAG_NAMEN[i]}</label></td>
        <td><input type="time" id="van-${dag}" value="${d.van}"></td>
        <td><input type="time" id="tot-${dag}" value="${d.tot}"></td>
      </tr>`;
    }).join('');
    const duurOpties = [15, 30, 60].map((m) =>
      `<option value="${m}" ${m === (t.slotDuur || 30) ? 'selected' : ''}>${m} minuten</option>`).join('');
    el('view-tijden').innerHTML = `
      <div class="kaart">
        <h2>Openingstijden</h2>
        <table class="tabel">
          <thead><tr><th>Dag</th><th>Van</th><th>Tot</th></tr></thead>
          <tbody>${rijen}</tbody>
        </table>
        <div class="velden-rij" style="max-width: 480px; margin-top: 1rem;">
          <div class="veld">
            <label for="slot-duur">Duur per afspraak</label>
            <select id="slot-duur">${duurOpties}</select>
          </div>
          <div class="veld">
            <label for="capaciteit">Afspraken tegelijk per tijdslot</label>
            <select id="capaciteit">${[1, 2, 3, 4, 5].map((n) =>
              `<option ${n === (t.capaciteit || 1) ? 'selected' : ''}>${n}</option>`).join('')}</select>
          </div>
        </div>
        <button class="knop" id="knop-tijden-opslaan">Opslaan</button>
        <span class="melding melding-goed verborgen" id="tijden-opgeslagen">Opgeslagen.</span>
      </div>
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
          <div class="veld" id="blok-datum-tot-veld"><label for="blok-datum-tot">T/m (optioneel)</label>
            <input id="blok-datum-tot" type="date"></div>
          <div class="veld verborgen" id="blok-dag-veld"><label for="blok-dag">Weekdag</label>
            <select id="blok-dag">${dagOpties}</select></div>
          <div class="veld"><label for="blok-van">Van</label><input id="blok-van" type="time" value="12:00"></div>
          <div class="veld"><label for="blok-tot">Tot</label><input id="blok-tot" type="time" value="13:00"></div>
        </div>
        <div class="veld"><label for="blok-omschrijving">Omschrijving (optioneel)</label>
          <input id="blok-omschrijving" type="text"></div>
        <span class="fout" id="fout-blok"></span>
        <button class="knop" id="knop-blok-toevoegen">Toevoegen</button>
      </div>`;
    el('knop-tijden-opslaan').addEventListener('click', () => {
      const nieuw = {};
      Agenda.DAG_SLEUTELS.forEach((dag) => {
        nieuw[dag] = {
          open: el('open-' + dag).checked,
          van: el('van-' + dag).value || '09:00',
          tot: el('tot-' + dag).value || '17:00',
        };
      });
      OberPoesDb.zetOpeningstijden(code, nieuw, Number(el('slot-duur').value),
        Number(el('capaciteit').value));
      el('tijden-opgeslagen').classList.remove('verborgen');
    });
    el('blok-type').addEventListener('change', () => {
      const wekelijks = el('blok-type').value === 'wekelijks';
      el('blok-datum-veld').classList.toggle('verborgen', wekelijks);
      el('blok-datum-tot-veld').classList.toggle('verborgen', wekelijks);
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
      const datumTot = el('blok-datum-tot').value;
      if (type === 'eenmalig' && datumTot && datumTot < datum) {
        el('fout-blok').textContent = 'De t/m-datum moet op of na de startdatum liggen.';
        return;
      }
      const blokkade = {
        id: OberPoesDb.genereerCode(),
        type, van, tot,
        omschrijving: el('blok-omschrijving').value.trim(),
      };
      if (type === 'eenmalig') {
        blokkade.datum = datum;
        if (datumTot) blokkade.datumTot = datumTot;
      } else {
        blokkade.dag = el('blok-dag').value;
      }
      OberPoesDb.zetBlokkades(code, [...(huidigeTenant().blokkades || []), blokkade]);
      renderTijden();
    });
  }

  // --- Profiel ---
  function renderProfiel() {
    const t = huidigeTenant();
    const boekLink = new URL(`tenant.html?code=${t.code}`, location.href).href;
    el('view-profiel').innerHTML = `
      <div class="kaart">
        <h2>Profiel</h2>
        <div class="velden-rij">
          <img src="${t.logo}" alt="Logo" class="logo-preview">
          <div style="flex:1">
            <p><strong>${t.naam}</strong> <span class="demo-code">${t.code}</span><br>
            ${t.straat} ${t.huisnummer}, ${t.postcode} ${t.plaats}<br>
            ${t.contactpersoon} · ${t.email} · ${t.telefoon}<br>
            KvK: ${t.kvk}</p>
          </div>
        </div>
        <div class="veld">
          <label for="boek-link">Uw openbare boekingslink (deel via e-mail of frame in uw website)</label>
          <input id="boek-link" type="text" readonly value="${boekLink}">
        </div>
        <button class="knop knop-secundair" id="knop-kopieer">Kopieer link</button>
        <span class="melding melding-goed verborgen" id="gekopieerd">Gekopieerd.</span>
        <div class="veld" style="margin-top: 1rem;">
          <label for="mollie-id">Mollie API id (voor betaallinks)</label>
          <input id="mollie-id" type="text" value="${t.mollieApiId || ''}" placeholder="bijv. live_AbC123">
        </div>
        <button class="knop" id="knop-mollie-opslaan">Mollie-id opslaan</button>
        <span class="melding melding-goed verborgen" id="mollie-opgeslagen" role="status">Opgeslagen.</span>
        <div class="velden-rij" style="margin-top: 1rem; max-width: 480px;">
          <div class="veld"><label for="reeks-prefix">Factuurreeks — prefix</label>
            <input id="reeks-prefix" type="text" value="${(t.factuurReeks && t.factuurReeks.prefix) || new Date().getFullYear()}"></div>
          <div class="veld"><label for="reeks-volgende">Volgend nummer</label>
            <input id="reeks-volgende" type="number" min="1" value="${(t.factuurReeks && t.factuurReeks.volgende) || 1}"></div>
        </div>
        <span class="fout" id="fout-reeks" aria-live="polite"></span>
        <button class="knop" id="knop-reeks-opslaan">Reeks opslaan</button>
        <span class="melding melding-goed verborgen" id="reeks-opgeslagen" role="status">Opgeslagen.</span>
      </div>`;
    el('knop-kopieer').addEventListener('click', async () => {
      const veld = el('boek-link');
      veld.select();
      try { await navigator.clipboard.writeText(veld.value); }
      catch (e) { document.execCommand('copy'); }
      el('gekopieerd').classList.remove('verborgen');
    });
    el('knop-mollie-opslaan').addEventListener('click', () => {
      OberPoesDb.zetMollieApiId(code, el('mollie-id').value.trim());
      el('mollie-opgeslagen').classList.remove('verborgen');
    });
    el('knop-reeks-opslaan').addEventListener('click', () => {
      const prefix = el('reeks-prefix').value.trim();
      const volgende = parseInt(el('reeks-volgende').value, 10);
      if (!prefix || !Number.isInteger(volgende) || volgende < 1) {
        el('fout-reeks').textContent = 'Vul een prefix en een volgnummer van minimaal 1 in.';
        return;
      }
      el('fout-reeks').textContent = '';
      OberPoesDb.zetFactuurReeks(code, prefix, volgende);
      el('reeks-opgeslagen').classList.remove('verborgen');
    });
  }

  if (sessionStorage.getItem(SESSIE_SLEUTEL) === 'ja') toonApp();
  else el('login-kaart').classList.remove('verborgen');
})();
