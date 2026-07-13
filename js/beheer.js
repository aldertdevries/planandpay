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
  function renderAgenda() {
    const afspraken = OberPoesDb.afsprakenVoor(code)
      .slice()
      .sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd));
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
        ${afspraken.length === 0 ? '<p>Er zijn nog geen afspraken.</p>' : `
        <table class="tabel">
          <thead><tr><th>Wanneer</th><th>Klant</th><th>Adres</th><th>Contact</th><th></th></tr></thead>
          <tbody>${rijen}</tbody>
        </table>`}
      </div>
      <div id="factuur-opbouw"></div>`;
    el('view-agenda').querySelectorAll('button[data-id]').forEach((k) => {
      k.addEventListener('click', () => {
        OberPoesDb.annuleerAfspraak(k.dataset.id);
        renderAgenda();
      });
    });
    el('view-agenda').querySelectorAll('button[data-factureer]').forEach((k) => {
      k.addEventListener('click', () => renderFactuurOpbouw(k.dataset.factureer));
    });
  }

  // --- Factureren van een afspraak ---
  function renderFactuurOpbouw(afspraakId) {
    const t = huidigeTenant();
    const afspraak = OberPoesDb.afsprakenVoor(code).find((a) => a.id === afspraakId);
    if (!afspraak) return;
    const losseRegels = [];

    const voorgedefinieerd = (t.factuurRegels || []).map((r) => `
      <label style="display:block">
        <input type="checkbox" class="regel-keuze" data-regel-id="${r.id}">
        ${r.naam} — ${btwLabel(r.btw)} — ${Facturatie.euro(r.bedragCent)}
      </label>`).join('') || '<p><em>Nog geen voorgedefinieerde regels (zie tabblad Factuurregels).</em></p>';

    el('factuur-opbouw').innerHTML = `
      <div class="kaart">
        <h2>Factuur voor ${afspraak.naam} — ${afspraak.datum} om ${afspraak.tijd}</h2>
        <div class="veld"><label>Voorgedefinieerde regels</label>${voorgedefinieerd}</div>
        <div class="veld">
          <label>Nieuwe regel</label>
          <div class="velden-rij">
            <input id="nieuw-naam" type="text" placeholder="Omschrijving">
            <select id="nieuw-btw"><option value="hoog">21% (hoog)</option><option value="laag">9% (laag)</option></select>
            <input id="nieuw-bedrag" type="number" step="0.01" min="0" placeholder="Bedrag incl. btw (€)">
            <button type="button" class="knop knop-secundair" id="knop-nieuw-bij">Toevoegen</button>
          </div>
          <label><input type="checkbox" id="nieuw-bewaar"> Ook bewaren als voorgedefinieerde regel</label>
          <span class="fout" id="fout-nieuw"></span>
        </div>
        <div id="losse-lijst"></div>
        <div class="melding melding-info" id="factuur-totaal">Nog geen regels gekozen.</div>
        <span class="fout" id="fout-factuur"></span>
        <button class="knop" id="knop-factureer">Factureren en mailen</button>
        <button class="knop knop-secundair" id="knop-opbouw-sluit">Sluiten</button>
      </div>`;
    el('factuur-opbouw').scrollIntoView({ behavior: 'smooth' });

    function gekozenRegels() {
      const vaste = [...el('factuur-opbouw').querySelectorAll('.regel-keuze:checked')]
        .map((c) => (huidigeTenant().factuurRegels || []).find((r) => r.id === c.dataset.regelId))
        .filter(Boolean)
        .map(({ naam, btw, bedragCent }) => ({ naam, btw, bedragCent }));
      return [...vaste, ...losseRegels];
    }
    function werkTotaalBij() {
      const regels = gekozenRegels();
      if (regels.length === 0) {
        el('factuur-totaal').textContent = 'Nog geen regels gekozen.';
        return;
      }
      const tot = Facturatie.totalen(regels);
      el('factuur-totaal').innerHTML =
        `Totaal: <strong>${Facturatie.euro(tot.inclCent)}</strong> incl. btw `
        + `(excl. ${Facturatie.euro(tot.exclCent)}, btw 21%: ${Facturatie.euro(tot.btwHoogCent)}, `
        + `btw 9%: ${Facturatie.euro(tot.btwLaagCent)})`;
    }
    el('factuur-opbouw').querySelectorAll('.regel-keuze').forEach((c) =>
      c.addEventListener('change', werkTotaalBij));

    el('knop-nieuw-bij').addEventListener('click', () => {
      const naam = el('nieuw-naam').value.trim();
      const bedragCent = bedragNaarCent(el('nieuw-bedrag').value);
      if (naam.length < 2 || bedragCent === null) {
        el('fout-nieuw').textContent = 'Vul een omschrijving en een bedrag groter dan 0 in.';
        return;
      }
      el('fout-nieuw').textContent = '';
      const regel = { naam, btw: el('nieuw-btw').value, bedragCent };
      losseRegels.push(regel);
      if (el('nieuw-bewaar').checked) {
        OberPoesDb.zetFactuurRegels(code, [
          ...(huidigeTenant().factuurRegels || []),
          { id: OberPoesDb.genereerCode(), ...regel },
        ]);
      }
      el('nieuw-naam').value = '';
      el('nieuw-bedrag').value = '';
      el('losse-lijst').innerHTML = losseRegels.map((r) =>
        `<p>+ ${r.naam} — ${btwLabel(r.btw)} — ${Facturatie.euro(r.bedragCent)}</p>`).join('');
      werkTotaalBij();
    });

    el('knop-opbouw-sluit').addEventListener('click', () => { el('factuur-opbouw').innerHTML = ''; });

    el('knop-factureer').addEventListener('click', () => {
      const regels = gekozenRegels();
      if (regels.length === 0) {
        el('fout-factuur').textContent = 'Kies of maak minimaal één factuurregel.';
        return;
      }
      const factuur = OberPoesDb.maakFactuur({ tenantCode: code, afspraakId, regels });
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

  function renderFacturen() {
    const alle = OberPoesDb.facturenVoor(code);
    const lijst = facturenFilter === 'Alle' ? alle : alle.filter((f) => f.status === facturenFilter);
    const opties = ['Alle', 'Open', 'Betaald']
      .map((s) => `<option ${s === facturenFilter ? 'selected' : ''}>${s}</option>`).join('');
    const statusBadge = (s) =>
      `<span class="badge ${s === 'Betaald' ? 'badge-actief' : 'badge-aangevraagd'}">${s}</span>`;
    const rijen = lijst.map((f) => `
      <tr>
        <td><strong>${f.nummer}</strong></td>
        <td>${new Date(f.gemaaktOp).toLocaleDateString('nl-NL')}</td>
        <td>${f.klantNaam}</td>
        <td>${Facturatie.euro(Facturatie.totalen(f.regels).inclCent)}</td>
        <td>${statusBadge(f.status)}</td>
        <td>
          <a class="knop knop-secundair knop-klein" href="factuur.html?id=${f.id}" target="_blank">Factuur</a>
          <a class="knop knop-secundair knop-klein" href="betaal.html?factuur=${f.id}" target="_blank">Betaalpagina</a>
        </td>
      </tr>`).join('');
    el('view-facturen').innerHTML = `
      <div class="kaart">
        <h2>Facturen</h2>
        <div class="veld" style="max-width: 220px;">
          <label for="filter-factuurstatus">Filter op status</label>
          <select id="filter-factuurstatus">${opties}</select>
        </div>
        ${lijst.length === 0 ? '<p>Geen facturen gevonden.</p>' : `
        <table class="tabel">
          <thead><tr><th>Nummer</th><th>Datum</th><th>Klant</th><th>Bedrag</th><th>Status</th><th></th></tr></thead>
          <tbody>${rijen}</tbody>
        </table>
        <p><small>De betaalstatus wordt (in de demo) afgeleid van de Mollie-betaalpagina.</small></p>`}
      </div>`;
    el('filter-factuurstatus').addEventListener('change', (e) => {
      facturenFilter = e.target.value;
      renderFacturen();
    });
  }

  // --- Openingstijden ---
  function renderTijden() {
    const t = huidigeTenant();
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
        <div class="veld" style="max-width: 220px; margin-top: 1rem;">
          <label for="slot-duur">Duur per afspraak</label>
          <select id="slot-duur">${duurOpties}</select>
        </div>
        <button class="knop" id="knop-tijden-opslaan">Opslaan</button>
        <span class="melding melding-goed verborgen" id="tijden-opgeslagen">Opgeslagen.</span>
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
      OberPoesDb.zetOpeningstijden(code, nieuw, Number(el('slot-duur').value));
      el('tijden-opgeslagen').classList.remove('verborgen');
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
        <span class="melding melding-goed verborgen" id="mollie-opgeslagen">Opgeslagen.</span>
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
  }

  if (sessionStorage.getItem(SESSIE_SLEUTEL) === 'ja') toonApp();
  else el('login-kaart').classList.remove('verborgen');
})();
