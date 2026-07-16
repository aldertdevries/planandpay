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
  el('kop-naam').textContent = `${tenant.naam} — beheer`;

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
    Sessie.begin(SESSIE_SLEUTEL);
    toonApp();
  });
  el('login-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el('knop-verifieer').click();
  });
  el('menu-uitloggen').addEventListener('click', (e) => {
    e.preventDefault();
    Sessie.eind(SESSIE_SLEUTEL);
    location.reload();
  });
  Sessie.bewaak(SESSIE_SLEUTEL, () => location.reload());

  // --- Views ---
  function toonView(naam) {
    ['agenda', 'regels', 'facturen', 'tijden', 'berichten', 'klanten', 'profiel'].forEach((v) => {
      el('view-' + v).classList.toggle('verborgen', v !== naam);
      el('menu-' + v).classList.toggle('actief', v === naam);
      el('menu-' + v).setAttribute('aria-current', v === naam ? 'page' : 'false');
    });
    if (naam === 'agenda') renderAgenda();
    if (naam === 'regels') renderRegels();
    if (naam === 'facturen') renderFacturen();
    if (naam === 'tijden') renderTijden();
    if (naam === 'berichten') renderBerichten();
    if (naam === 'klanten') renderKlanten();
    if (naam === 'profiel') renderProfiel();
  }
  ['agenda', 'regels', 'facturen', 'tijden', 'berichten', 'klanten', 'profiel'].forEach((v) => {
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
        if (!slot) return '<td style="background:#EDF2F7"></td>';
        if (!slot.vrij) return '<td style="background:#E2E8F0" title="geblokkeerd">✕</td>';
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
        <div class="tabel-scroll"><table class="tabel">
          <thead><tr><th scope="col">Tijd</th>${kop}</tr></thead>
          <tbody>${rijen}</tbody>
        </table></div>
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
          ? `<a class="badge badge-actief" href="factuur.html?id=${a.factuurId}" target="_blank">Op rekening</a>`
          : `<button class="knop knop-klein" data-factureer="${a.id}">Rekening maken</button>
             <button class="knop knop-gevaar knop-klein" data-id="${a.id}">Annuleren</button>`}</td>
      </tr>`).join('');
    el('view-agenda').innerHTML = `
      <div class="kaart">
        <h2>Agenda</h2>
        <p>
          <button class="knop knop-secundair knop-klein" id="knop-naar-week">Weekweergave</button>
          <button class="knop knop-secundair knop-klein" id="knop-agenda-csv" ${alleAfspraken.length === 0 ? 'disabled' : ''}>Download CSV</button>
        </p>
        <div class="veld" style="max-width: 260px;">
          <label for="zoek-agenda">Zoeken (naam of datum)</label>
          <input id="zoek-agenda" type="search" value="${agendaZoek}">
        </div>
        ${afspraken.length === 0 ? '<p>Geen afspraken gevonden.</p>' : `
        <div class="tabel-scroll"><table class="tabel">
          <thead><tr><th scope="col">Wanneer</th><th scope="col">Klant</th><th scope="col">Adres</th><th scope="col">Contact</th><th scope="col"></th></tr></thead>
          <tbody>${rijen}</tbody>
        </table></div>`}
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
        if (!confirm('Weet u zeker dat u deze afspraak wilt annuleren?')) return;
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
    const agendaCsv = el('knop-agenda-csv');
    if (agendaCsv && !agendaCsv.disabled) agendaCsv.addEventListener('click', () => {
      const rijenCsv = alleAfspraken.map((a) => [a.datum, a.tijd, a.naam || '', a.email || '',
        a.telefoon || '', a.straat || '', a.huisnummer || '', a.postcode || '', a.plaats || '',
        a.extra || '', a.factuurId ? 'ja' : 'nee']);
      Csv.download(`afspraken-${code}.csv`, Csv.genereer(
        ['Datum', 'Tijd', 'Naam', 'E-mail', 'Telefoon', 'Straat', 'Huisnummer', 'Postcode', 'Plaats', 'Extra', 'Op rekening'],
        rijenCsv));
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
        <h2>Rekening voor ${afspraak.naam} — ${afspraak.datum} om ${afspraak.tijd}</h2>
        <div class="veld">
          <label for="regel-bron">Product kiezen of nieuw maken</label>
          <select id="regel-bron">
            <option value="">— nieuw product —</option>
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
        <label><input type="checkbox" id="opbouw-bewaar"> Ook bewaren als product</label>
        <span class="fout" id="fout-opbouw"></span><br>
        <button class="knop knop-secundair" id="knop-opbouw-toevoegen">Toevoegen aan rekening</button>
        <h3>Producten op deze rekening</h3>
        <div id="concept-lijst"></div>
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
      </div>`;
    el('factuur-opbouw').scrollIntoView({ behavior: 'smooth' });
    el('opbouw-betaalwijze').value = huidigeTenant().standaardBetaalwijze || 'mollie';

    function renderConcept() {
      el('concept-lijst').innerHTML = conceptRegels.length === 0
        ? '<p><em>Nog geen producten toegevoegd.</em></p>'
        : `<div class="tabel-scroll"><table class="tabel"><tbody>${conceptRegels.map((r, i) => `
            <tr>
              <td>${r.naam}</td>
              <td>${btwLabel(r.btw)}</td>
              <td>${Facturatie.euro(r.bedragCent)}</td>
              <td><button class="knop knop-gevaar knop-klein" data-concept-weg="${i}">Verwijderen</button></td>
            </tr>`).join('')}</tbody></table></div>`;
      el('concept-lijst').querySelectorAll('button[data-concept-weg]').forEach((k) => {
        k.addEventListener('click', () => {
          conceptRegels.splice(Number(k.dataset.conceptWeg), 1);
          renderConcept();
        });
      });
      if (conceptRegels.length === 0) {
        el('factuur-totaal').textContent = 'Nog geen producten toegevoegd.';
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
        el('fout-factuur').textContent = 'Voeg minimaal één product toe.';
        return;
      }
      const factuur = OberPoesDb.maakFactuur({
        tenantCode: code, afspraakId, regels: conceptRegels,
        betaalwijze: el('opbouw-betaalwijze').value,
      });
      if (!factuur) {
        el('fout-factuur').textContent = 'Deze afspraak staat al op een rekening.';
        return;
      }
      renderAgenda();
      toonMail(factuur);
    });
  }

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
        <h2>Producten</h2>
        ${regels.length === 0 ? '<p>Nog geen producten gedefinieerd.</p>' : `
        <div class="tabel-scroll"><table class="tabel">
          <thead><tr><th scope="col">Naam</th><th scope="col">Btw</th><th scope="col">Bedrag (incl. btw)</th><th scope="col"></th></tr></thead>
          <tbody>${rijen}</tbody>
        </table></div>`}
        <h3>Product toevoegen</h3>
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
  const BETAALWIJZE_LABELS = { mollie: 'Mollie', pin: 'Pin', contant: 'Contant' };
  const betaalwijzeLabel = (f) => BETAALWIJZE_LABELS[f.betaalwijze || 'mollie'];
  let facturenFilter = 'Alle';
  let facturenBetaalwijzeFilter = 'Alle';
  let facturenZoek = '';
  let facturenPagina = 1;

  function renderFacturen() {
    const alle = OberPoesDb.facturenVoor(code);
    const naStatus = facturenFilter === 'Alle' ? alle : alle.filter((f) => f.status === facturenFilter);
    const basis = facturenBetaalwijzeFilter === 'Alle'
      ? naStatus
      : naStatus.filter((f) => (f.betaalwijze || 'mollie') === facturenBetaalwijzeFilter);
    const pagina = Lijst.filterEnPagineer(basis, facturenZoek, ['nummer', 'klantNaam'], facturenPagina);
    facturenPagina = pagina.pagina;
    const lijst = pagina.items;
    const opties = ['Alle', 'Open', 'Betaald', 'Gecrediteerd', 'Vervallen', 'Credit']
      .map((s) => `<option ${s === facturenFilter ? 'selected' : ''}>${s}</option>`).join('');
    const wijzeOpties = ['Alle', 'Mollie', 'Pin', 'Contant']
      .map((s) => `<option value="${s === 'Alle' ? 'Alle' : s.toLowerCase()}" ${(s === 'Alle' ? 'Alle' : s.toLowerCase()) === facturenBetaalwijzeFilter ? 'selected' : ''}>${s}</option>`).join('');
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
        <td>${betaalwijzeLabel(f)}</td>
        <td>
          <a class="knop knop-secundair knop-klein" href="factuur.html?id=${f.id}" target="_blank">Rekening</a>
          <a class="knop knop-secundair knop-klein" href="betaal.html?factuur=${f.id}" target="_blank">Betaalpagina</a>
          ${['Open', 'Betaald'].includes(f.status)
            ? `<button class="knop knop-secundair knop-klein" data-crediteer="${f.id}">Crediteren</button>` : ''}
          ${f.status === 'Open'
            ? `<button class="knop knop-gevaar knop-klein" data-vervallen="${f.id}">Vervallen</button>` : ''}
        </td>
      </tr>`).join('');
    el('view-facturen').innerHTML = `
      <div class="kaart">
        <h2>Rekeningen</h2>
        <p><button class="knop knop-secundair knop-klein" id="knop-facturen-csv" ${alle.length === 0 ? 'disabled' : ''}>Download CSV</button></p>
        <div class="velden-rij" style="max-width: 520px;">
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
        </div>
        ${lijst.length === 0 ? '<p>Geen rekeningen gevonden.</p>' : `
        <div class="tabel-scroll"><table class="tabel">
          <thead><tr><th scope="col">Nummer</th><th scope="col">Datum</th><th scope="col">Klant</th><th scope="col">Bedrag</th><th scope="col">Status</th><th scope="col">Betaalwijze</th><th scope="col"></th></tr></thead>
          <tbody>${rijen}</tbody>
        </table></div>
        <p><small>De betaalstatus wordt (in de demo) afgeleid van de Mollie-betaalpagina.</small></p>`}
        <p>
          <button class="knop knop-secundair knop-klein" id="facturen-vorige" ${pagina.pagina <= 1 ? 'disabled' : ''}>‹ Vorige</button>
          pagina ${pagina.pagina} van ${pagina.paginas} (${pagina.totaal} rekeningen)
          <button class="knop knop-secundair knop-klein" id="facturen-volgende" ${pagina.pagina >= pagina.paginas ? 'disabled' : ''}>Volgende ›</button>
        </p>
      </div>`;
    el('filter-factuurstatus').addEventListener('change', (e) => {
      facturenFilter = e.target.value;
      facturenPagina = 1;
      renderFacturen();
    });
    el('filter-betaalwijze').addEventListener('change', (e) => {
      facturenBetaalwijzeFilter = e.target.value;
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
    const facturenCsv = el('knop-facturen-csv');
    if (facturenCsv && !facturenCsv.disabled) facturenCsv.addEventListener('click', () => {
      const rijenCsv = alle.map((f) => [f.nummer,
        new Date(f.gemaaktOp).toLocaleDateString('nl-NL'), f.klantNaam || '', f.klantEmail || '',
        Facturatie.euro(Facturatie.totalen(f.regels).inclCent), f.status, betaalwijzeLabel(f), f.creditVoor || '']);
      Csv.download(`rekeningen-${code}.csv`, Csv.genereer(
        ['Nummer', 'Datum', 'Klant', 'E-mail', 'Bedrag', 'Status', 'Betaalwijze', 'Credit voor'], rijenCsv));
    });
    el('facturen-vorige').addEventListener('click', () => { facturenPagina--; renderFacturen(); });
    el('facturen-volgende').addEventListener('click', () => { facturenPagina++; renderFacturen(); });
    el('view-facturen').querySelectorAll('button[data-crediteer]').forEach((k) =>
      k.addEventListener('click', () => {
        if (!confirm('Weet u zeker dat u deze rekening wilt crediteren? Er komt een creditrekening en de afspraak wordt weer vrijgegeven.')) return;
        OberPoesDb.crediteerFactuur(k.dataset.crediteer); renderFacturen();
      }));
    el('view-facturen').querySelectorAll('button[data-vervallen]').forEach((k) =>
      k.addEventListener('click', () => {
        if (!confirm('Weet u zeker dat u deze rekening wilt laten vervallen?')) return;
        OberPoesDb.laatVervallen(k.dataset.vervallen); renderFacturen();
      }));
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
        <div class="tabel-scroll"><table class="tabel">
          <thead><tr><th scope="col">Dag</th><th scope="col">Van</th><th scope="col">Tot</th></tr></thead>
          <tbody>${rijen}</tbody>
        </table></div>
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
        <span class="melding melding-goed verborgen" id="tijden-opgeslagen" role="status">Opgeslagen.</span>
      </div>
      <div class="kaart">
        <h2>Niet-boekbare perioden</h2>
        ${blokkades.length === 0 ? '<p>Geen niet-boekbare perioden.</p>' : `
        <div class="tabel-scroll"><table class="tabel">
          <thead><tr><th scope="col">Omschrijving</th><th scope="col">Wanneer</th><th scope="col"></th></tr></thead>
          <tbody>${blokRijen}</tbody>
        </table></div>`}
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

  // --- Berichten ---
  const BERICHT_TYPES = [
    { type: 'boeking', label: 'Boekingsbevestiging', velden: '{naam} {tenant} {datum} {tijd}' },
    { type: 'verzet', label: 'Verzetbevestiging', velden: '{naam} {tenant} {datum} {tijd}' },
    { type: 'factuur', label: 'Rekeningmail', velden: '{naam} {tenant} {nummer} {bedrag}' },
    { type: 'betaling', label: 'Betalingsbevestiging', velden: '{naam} {tenant} {nummer} {bedrag}' },
    { type: 'uitnodiging', label: 'Uitnodiging afspraak', velden: '{naam} {tenant} {link}' },
  ];

  function renderBerichten() {
    const t = huidigeTenant();
    const rijen = BERICHT_TYPES.map((b) => {
      const eigen = !!(t.berichten && t.berichten[b.type]);
      const eersteRegel = Berichten.voor(t, b.type).split('\n')[0];
      return `
      <tr class="klikbaar" data-bericht="${b.type}">
        <td><strong>${b.label}</strong></td>
        <td><span class="badge ${eigen ? 'badge-actief' : 'badge-inactief'}">${eigen ? 'Aangepast' : 'Standaard'}</span></td>
        <td>${eersteRegel}</td>
      </tr>`;
    }).join('');
    el('view-berichten').innerHTML = `
      <div class="kaart">
        <h2>Berichten aan klanten</h2>
        <div class="tabel-scroll"><table class="tabel">
          <thead><tr><th scope="col">Bericht</th><th scope="col">Tekst</th><th scope="col">Voorbeeld</th></tr></thead>
          <tbody>${rijen}</tbody>
        </table></div>
        <p><small>Klik op een rij om de tekst te bewerken.</small></p>
      </div>
      <div id="bericht-detail"></div>`;
    el('view-berichten').querySelectorAll('tr.klikbaar').forEach((rij) => {
      rij.addEventListener('click', () => renderBerichtDetail(rij.dataset.bericht));
    });
  }

  function renderBerichtDetail(type) {
    const info = BERICHT_TYPES.find((b) => b.type === type);
    el('bericht-detail').innerHTML = `
      <div class="kaart">
        <h2>${info.label}</h2>
        <p>Beschikbare invulvelden: <code>${info.velden}</code> — deze worden bij
        verzending vervangen door de echte gegevens.</p>
        <div class="veld">
          <label for="bewerk-bericht">Tekst</label>
          <textarea id="bewerk-bericht" rows="8">${Berichten.voor(huidigeTenant(), type)}</textarea>
        </div>
        <button class="knop" id="knop-bericht-opslaan">Opslaan</button>
        <button class="knop knop-secundair" id="knop-bericht-standaard">Herstel standaardtekst</button>
        <button class="knop knop-secundair" id="knop-bericht-sluit">Sluiten</button>
        <span class="melding melding-goed verborgen" id="bericht-opgeslagen" role="status">Opgeslagen.</span>
      </div>`;
    el('bericht-detail').scrollIntoView({ behavior: 'smooth' });

    function bijwerken(nieuweTekst) {
      const berichten = { ...(huidigeTenant().berichten || {}) };
      if (nieuweTekst === null) delete berichten[type];
      else berichten[type] = nieuweTekst;
      OberPoesDb.zetBerichten(code, berichten);
      renderBerichten();
      renderBerichtDetail(type);
      el('bericht-opgeslagen').classList.remove('verborgen');
    }
    el('knop-bericht-opslaan').addEventListener('click', () =>
      bijwerken(el('bewerk-bericht').value));
    el('knop-bericht-standaard').addEventListener('click', () => bijwerken(null));
    el('knop-bericht-sluit').addEventListener('click', () => {
      el('bericht-detail').innerHTML = '';
    });
  }

  // --- Klanten ---
  let klantenZoek = '';
  let klantenPagina = 1;
  let klantenSortVeld = 'laatste';
  let klantenSortOp = false; // false = aflopend, true = oplopend
  let klantenSelectie = new Set();

  const klantAdres = (k) => `${k.straat || ''} ${k.huisnummer || ''}`.trim()
    + (k.postcode || k.plaats ? `, ${k.postcode || ''} ${k.plaats || ''}`.trim() : '');

  function sorteerKlanten(lijst) {
    const num = klantenSortVeld === 'aantal';
    const richting = klantenSortOp ? 1 : -1;
    return lijst.slice().sort((a, b) => {
      let va = a[klantenSortVeld]; let vb = b[klantenSortVeld];
      if (klantenSortVeld === 'adres') { va = (a.plaats || '') + a.straat; vb = (b.plaats || '') + b.straat; }
      if (num) return (va - vb) * richting;
      return String(va || '').localeCompare(String(vb || ''), 'nl', { sensitivity: 'base' }) * richting;
    });
  }

  function renderKlanten() {
    const alle = OberPoesDb.klantenVoor(code);
    const gesorteerd = sorteerKlanten(alle);
    const pagina = Lijst.filterEnPagineer(gesorteerd, klantenZoek, ['naam', 'email', 'plaats'], klantenPagina);
    klantenPagina = pagina.pagina;
    const lijst = pagina.items;
    const gefilterd = klantenZoek ? sorteerKlanten(alle).filter((k) =>
      ['naam', 'email', 'plaats'].some((v) => String(k[v] || '').toLowerCase().includes(klantenZoek.toLowerCase())))
      : alle;
    const alleGeselecteerd = gefilterd.length > 0 && gefilterd.every((k) => klantenSelectie.has(k.email));
    const pijl = (veld) => klantenSortVeld === veld ? (klantenSortOp ? ' ▲' : ' ▼') : '';
    const kop = (veld, label) =>
      `<th scope="col" class="sorteerbaar" data-sort="${veld}" style="cursor:pointer">${label}${pijl(veld)}</th>`;
    const rijen = lijst.map((k) => `
      <tr>
        <td><input type="checkbox" class="klant-kies" data-email="${k.email}" ${klantenSelectie.has(k.email) ? 'checked' : ''}></td>
        <td><strong>${k.naam || ''}</strong></td>
        <td>${klantAdres(k)}</td>
        <td>${k.email}</td>
        <td>${k.telefoon || ''}</td>
        <td>${k.laatste ? new Date(k.laatste + 'T12:00:00').toLocaleDateString('nl-NL') : '—'}</td>
        <td>${k.aantal}</td>
      </tr>`).join('');
    el('view-klanten').innerHTML = `
      <div class="kaart">
        <h2>Klanten</h2>
        <p>
          <button class="knop knop-klein" id="knop-klant-toevoegen">Klant toevoegen</button>
          <button class="knop knop-klein" id="knop-uitnodigen" ${klantenSelectie.size === 0 ? 'disabled' : ''}>Uitnodiging sturen (${klantenSelectie.size})</button>
          <button class="knop knop-secundair knop-klein" id="knop-klanten-csv" ${alle.length === 0 ? 'disabled' : ''}>Download CSV</button>
        </p>
        <div id="klant-formulier"></div>
        <div class="veld" style="max-width: 260px;">
          <label for="zoek-klanten">Zoeken (naam, e-mail of plaats)</label>
          <input id="zoek-klanten" type="search" value="${klantenZoek}">
        </div>
        ${lijst.length === 0 ? '<p>Nog geen klanten.</p>' : `
        <div class="tabel-scroll"><table class="tabel">
          <thead><tr>
            <th scope="col"><input type="checkbox" id="kies-alle" ${alleGeselecteerd ? 'checked' : ''} title="Alles selecteren"></th>
            ${kop('naam', 'Naam')}${kop('adres', 'Adres')}${kop('email', 'E-mail')}${kop('telefoon', 'Telefoon')}${kop('laatste', 'Laatste afspraak')}${kop('aantal', 'Aantal')}
          </tr></thead>
          <tbody>${rijen}</tbody>
        </table></div>`}
        <p>
          <button class="knop knop-secundair knop-klein" id="klanten-vorige" ${pagina.pagina <= 1 ? 'disabled' : ''}>‹ Vorige</button>
          pagina ${pagina.pagina} van ${pagina.paginas} (${pagina.totaal} klanten)
          <button class="knop knop-secundair knop-klein" id="klanten-volgende" ${pagina.pagina >= pagina.paginas ? 'disabled' : ''}>Volgende ›</button>
        </p>
      </div>
      <div id="uitnodiging-mails"></div>`;
    el('view-klanten').querySelectorAll('th.sorteerbaar').forEach((th) => {
      th.addEventListener('click', () => {
        const veld = th.dataset.sort;
        if (klantenSortVeld === veld) klantenSortOp = !klantenSortOp;
        else { klantenSortVeld = veld; klantenSortOp = true; }
        renderKlanten();
      });
    });
    el('view-klanten').querySelectorAll('.klant-kies').forEach((c) => {
      c.addEventListener('change', () => {
        if (c.checked) klantenSelectie.add(c.dataset.email);
        else klantenSelectie.delete(c.dataset.email);
        renderKlanten();
      });
    });
    if (el('kies-alle')) el('kies-alle').addEventListener('change', (e) => {
      gefilterd.forEach((k) => {
        if (e.target.checked) klantenSelectie.add(k.email);
        else klantenSelectie.delete(k.email);
      });
      renderKlanten();
    });
    el('zoek-klanten').addEventListener('input', (e) => {
      klantenZoek = e.target.value;
      klantenPagina = 1;
      renderKlanten();
      const v = el('zoek-klanten');
      v.focus();
      v.setSelectionRange(klantenZoek.length, klantenZoek.length);
    });
    el('klanten-vorige').addEventListener('click', () => { klantenPagina--; renderKlanten(); });
    el('klanten-volgende').addEventListener('click', () => { klantenPagina++; renderKlanten(); });
    const csvKnop = el('knop-klanten-csv');
    if (csvKnop && !csvKnop.disabled) csvKnop.addEventListener('click', () => {
      const rijenCsv = gesorteerd.map((k) => [k.naam || '', k.straat || '', k.huisnummer || '',
        k.postcode || '', k.plaats || '', k.email, k.telefoon || '', k.laatste, k.aantal]);
      Csv.download(`klanten-${code}.csv`, Csv.genereer(
        ['Naam', 'Straat', 'Huisnummer', 'Postcode', 'Plaats', 'E-mail', 'Telefoon', 'Laatste afspraak', 'Aantal afspraken'],
        rijenCsv));
    });
    const uitnodigKnop = el('knop-uitnodigen');
    if (uitnodigKnop && !uitnodigKnop.disabled) uitnodigKnop.addEventListener('click', () => toonUitnodigingen(alle));
    el('knop-klant-toevoegen').addEventListener('click', renderKlantFormulier);
  }

  function renderKlantFormulier() {
    let adres = null;
    el('klant-formulier').innerHTML = `
      <div class="kaart">
        <h3>Nieuwe klant</h3>
        <div class="velden-rij">
          <div class="veld"><label for="nk-naam">Naam</label>
            <input id="nk-naam" type="text" autocomplete="name">
            <span class="fout" id="fout-nk-naam" aria-live="polite"></span></div>
          <div class="veld"><label for="nk-email">E-mailadres</label>
            <input id="nk-email" type="email" autocomplete="email">
            <span class="fout" id="fout-nk-email" aria-live="polite"></span></div>
        </div>
        <div class="velden-rij">
          <div class="veld"><label for="nk-telefoon">Telefoon (optioneel)</label>
            <input id="nk-telefoon" type="tel" autocomplete="tel"></div>
          <div class="veld"><label for="nk-postcode">Postcode</label>
            <input id="nk-postcode" type="text" placeholder="1234 AB"></div>
          <div class="veld"><label for="nk-huisnummer">Huisnummer</label>
            <input id="nk-huisnummer" type="text"></div>
        </div>
        <div class="velden-rij">
          <div class="veld"><label for="nk-straat">Straat</label>
            <input id="nk-straat" type="text" readonly placeholder="vullen wij automatisch in"></div>
          <div class="veld"><label for="nk-plaats">Plaats</label>
            <input id="nk-plaats" type="text" readonly placeholder="vullen wij automatisch in"></div>
        </div>
        <span class="fout" id="fout-nk-adres" aria-live="polite"></span>
        <button class="knop" id="knop-nk-opslaan">Opslaan</button>
        <button class="knop knop-secundair" id="knop-nk-annuleren">Annuleren</button>
      </div>`;
    el('klant-formulier').scrollIntoView({ behavior: 'smooth' });
    Adres.bind({
      postcodeEl: el('nk-postcode'), huisnummerEl: el('nk-huisnummer'),
      straatEl: el('nk-straat'), plaatsEl: el('nk-plaats'), foutEl: el('fout-nk-adres'),
      bijAdres: (a) => { adres = a; },
    });
    el('knop-nk-annuleren').addEventListener('click', () => { el('klant-formulier').innerHTML = ''; });
    el('knop-nk-opslaan').addEventListener('click', () => {
      const naam = el('nk-naam').value.trim();
      const email = el('nk-email').value.trim();
      el('fout-nk-naam').textContent = Validatie.naam(naam) ? '' : 'Vul een naam in (minimaal 2 tekens).';
      el('fout-nk-email').textContent = Validatie.email(email) ? '' : 'Vul een geldig e-mailadres in.';
      if (!Validatie.naam(naam) || !Validatie.email(email)) return;
      OberPoesDb.voegKlantToe({
        tenantCode: code, naam, email, telefoon: el('nk-telefoon').value.trim(),
        straat: adres ? adres.straat : '', plaats: adres ? adres.plaats : '',
        postcode: el('nk-postcode').value.trim().toUpperCase(), huisnummer: el('nk-huisnummer').value.trim(),
      });
      el('klant-formulier').innerHTML = '';
      renderKlanten();
    });
  }

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
      return `<div class="melding melding-info" role="status">
        <strong>Aan:</strong> ${k.email}<br>
        <strong>Onderwerp:</strong> Uitnodiging om een afspraak te maken — ${t.naam}<br><br>
        ${Berichten.naarHtml(tekst)}
      </div>`;
    }).join('');
    el('uitnodiging-mails').innerHTML = `
      <div class="kaart">
        <h2>Uitnodigingen verzonden (demo) — ${gekozen.length} klant(en)</h2>
        ${mails}
        <button class="knop knop-secundair" id="knop-uitnodiging-sluit">Sluiten</button>
      </div>`;
    el('uitnodiging-mails').scrollIntoView({ behavior: 'smooth' });
    el('knop-uitnodiging-sluit').addEventListener('click', () => { el('uitnodiging-mails').innerHTML = ''; });
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
        <span class="melding melding-goed verborgen" id="gekopieerd" role="status">Gekopieerd.</span>
        <div class="veld" style="margin-top: 1rem;">
          <label for="embed-code">Insluitcode voor uw website (plak dit in een pagina om klanten direct te laten boeken)</label>
          <textarea id="embed-code" readonly rows="4"></textarea>
        </div>
        <button class="knop knop-secundair" id="knop-embed-kopieer">Kopieer insluitcode</button>
        <span class="melding melding-goed verborgen" id="embed-gekopieerd" role="status">Gekopieerd.</span>
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
          <label for="factuur-voettekst">Rekeningtekst (onderaan elke rekening)</label>
          <textarea id="factuur-voettekst" rows="3">${t.factuurVoettekst || Berichten.STANDAARD_FACTUURVOETTEKST}</textarea>
        </div>
        <button class="knop" id="knop-voettekst-opslaan">Rekeningtekst opslaan</button>
        <span class="melding melding-goed verborgen" id="voettekst-opgeslagen" role="status">Opgeslagen.</span>
        <div class="veld" style="margin-top: 1rem;">
          <label for="mollie-id">Mollie API id (voor betaallinks)</label>
          <input id="mollie-id" type="text" value="${t.mollieApiId || ''}" placeholder="bijv. live_AbC123">
        </div>
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
        <div class="velden-rij" style="margin-top: 1rem; max-width: 480px;">
          <div class="veld"><label for="reeks-prefix">Rekeningreeks — prefix</label>
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

    const embedSnippet =
      `<iframe src="${boekLink}" title="Afspraak maken bij ${t.naam}"\n`
      + `  style="width:100%;max-width:480px;height:720px;border:1px solid #CBD5E1;border-radius:12px"\n`
      + `  loading="lazy"></iframe>`;
    el('embed-code').value = embedSnippet;
    el('knop-embed-kopieer').addEventListener('click', async () => {
      const veld = el('embed-code');
      veld.select();
      try { await navigator.clipboard.writeText(veld.value); }
      catch (e) { document.execCommand('copy'); }
      el('embed-gekopieerd').classList.remove('verborgen');
    });
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
    el('knop-mollie-opslaan').addEventListener('click', () => {
      OberPoesDb.zetMollieApiId(code, el('mollie-id').value.trim());
      el('mollie-opgeslagen').classList.remove('verborgen');
    });
    el('standaard-betaalwijze').value = t.standaardBetaalwijze || 'mollie';
    el('knop-betaalwijze-opslaan').addEventListener('click', () => {
      OberPoesDb.zetStandaardBetaalwijze(code, el('standaard-betaalwijze').value);
      el('betaalwijze-opgeslagen').classList.remove('verborgen');
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

  if (Sessie.actief(SESSIE_SLEUTEL)) toonApp();
  else el('login-kaart').classList.remove('verborgen');
})();
