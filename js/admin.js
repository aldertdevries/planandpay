// Afgesloten beheergedeelte: login, Aanvragen en Tenants.
(() => {
  if (!document.getElementById('admin-app')) return;

  const SESSIE_SLEUTEL = 'oberpoes_admin';
  const GEBRUIKER = 'oberpoes';
  const WACHTWOORD = 'miauw2026'; // hardcoded — puur demo, nooit veilig op een statische site

  const el = (id) => document.getElementById(id);
  const badge = (status) =>
    `<span class="badge badge-${status.toLowerCase()}">${status}</span>`;
  const datum = (iso) => new Date(iso).toLocaleDateString('nl-NL');

  // --- Login ---
  function isIngelogd() { return sessionStorage.getItem(SESSIE_SLEUTEL) === 'ja'; }

  function toonApp() {
    el('login-kaart').classList.add('verborgen');
    el('admin-app').classList.remove('verborgen');
    el('admin-menu').classList.remove('verborgen');
    toonView('aanvragen');
  }

  el('knop-login').addEventListener('click', () => {
    const ok = el('gebruikersnaam').value.trim() === GEBRUIKER
      && el('wachtwoord').value === WACHTWOORD;
    if (!ok) {
      el('fout-login').textContent = 'Onjuiste gebruikersnaam of wachtwoord.';
      return;
    }
    sessionStorage.setItem(SESSIE_SLEUTEL, 'ja');
    toonApp();
  });
  el('wachtwoord').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el('knop-login').click();
  });

  el('menu-uitloggen').addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem(SESSIE_SLEUTEL);
    location.reload();
  });

  // --- Views ---
  function toonView(naam) {
    el('view-aanvragen').classList.toggle('verborgen', naam !== 'aanvragen');
    el('view-tenants').classList.toggle('verborgen', naam !== 'tenants');
    el('menu-aanvragen').classList.toggle('actief', naam === 'aanvragen');
    el('menu-tenants').classList.toggle('actief', naam === 'tenants');
    if (naam === 'aanvragen') renderAanvragen();
    if (naam === 'tenants') renderTenants();
  }
  el('menu-aanvragen').addEventListener('click', (e) => { e.preventDefault(); toonView('aanvragen'); });
  el('menu-tenants').addEventListener('click', (e) => { e.preventDefault(); toonView('tenants'); });

  // --- Aanvragen ---
  function renderAanvragen() {
    const aanvragen = OberPoesDb.alleTenants().filter((t) => t.status === 'Aangevraagd');
    const rijen = aanvragen.map((t) => `
      <tr>
        <td><img src="${t.logo}" alt=""></td>
        <td><strong>${t.naam}</strong><br><small>${t.straat} ${t.huisnummer}, ${t.plaats}</small></td>
        <td class="demo-code">${t.code}</td>
        <td>${t.contactpersoon}<br><small>${t.email} · ${t.telefoon}</small></td>
        <td>${datum(t.aangevraagdOp)}</td>
        <td>
          <button class="knop knop-goed knop-klein" data-actie="goedkeuren" data-code="${t.code}">Goedkeuren</button>
          <button class="knop knop-gevaar knop-klein" data-actie="afkeuren" data-code="${t.code}">Afkeuren</button>
        </td>
      </tr>`).join('');
    el('view-aanvragen').innerHTML = `
      <div class="kaart">
        <h2>Aanvragen</h2>
        ${aanvragen.length === 0
          ? `<p>Er zijn geen openstaande aanvragen.</p>
             <button class="knop knop-secundair" id="knop-demo">Demo-data laden</button>`
          : `<table class="tabel">
               <thead><tr><th>Logo</th><th>Organisatie</th><th>Code</th><th>Contact</th><th>Datum</th><th></th></tr></thead>
               <tbody>${rijen}</tbody>
             </table>`}
      </div>`;
    el('view-aanvragen').querySelectorAll('button[data-actie]').forEach((knop) => {
      knop.addEventListener('click', () => {
        if (knop.dataset.actie === 'goedkeuren') OberPoesDb.activeerTenant(knop.dataset.code);
        else OberPoesDb.zetStatus(knop.dataset.code, 'Afgewezen');
        renderAanvragen();
      });
    });
    const demoKnop = el('view-aanvragen').querySelector('#knop-demo');
    if (demoKnop) demoKnop.addEventListener('click', () => {
      OberPoesDb.laadDemoData();
      renderAanvragen();
    });
  }

  // --- Tenants ---
  let tenantsFilter = 'Alle';

  function renderTenants() {
    const alle = OberPoesDb.alleTenants();
    const lijst = tenantsFilter === 'Alle'
      ? alle : alle.filter((t) => t.status === tenantsFilter);
    const opties = ['Alle', 'Aangevraagd', 'Afgewezen', 'Actief', 'Inactief']
      .map((s) => `<option ${s === tenantsFilter ? 'selected' : ''}>${s}</option>`).join('');
    const rijen = lijst.map((t) => `
      <tr class="klikbaar" data-code="${t.code}">
        <td><img src="${t.logo}" alt=""></td>
        <td><strong>${t.naam}</strong></td>
        <td class="demo-code">${t.code}</td>
        <td>${badge(t.status)}</td>
        <td>${t.plaats}</td>
        <td>${datum(t.aangevraagdOp)}</td>
      </tr>`).join('');
    el('view-tenants').innerHTML = `
      <div class="kaart">
        <h2>Tenants</h2>
        <div class="veld" style="max-width: 220px;">
          <label for="filter-status">Filter op status</label>
          <select id="filter-status">${opties}</select>
        </div>
        ${lijst.length === 0 ? '<p>Geen tenants gevonden.</p>' : `
        <table class="tabel">
          <thead><tr><th>Logo</th><th>Organisatie</th><th>Code</th><th>Status</th><th>Plaats</th><th>Aangevraagd</th></tr></thead>
          <tbody>${rijen}</tbody>
        </table>
        <p><small>Klik op een rij om de gegevens in te zien of te wijzigen.</small></p>`}
      </div>
      <div id="tenant-detail"></div>`;
    el('filter-status').addEventListener('change', (e) => {
      tenantsFilter = e.target.value;
      renderTenants();
    });
    el('view-tenants').querySelectorAll('tr.klikbaar').forEach((rij) => {
      rij.addEventListener('click', () => renderTenantDetail(rij.dataset.code));
    });
  }

  function renderTenantDetail(code) {
    const t = OberPoesDb.vindTenant(code);
    if (!t) return;
    const veld = (id, label, waarde, extra = '') => `
      <div class="veld">
        <label for="bewerk-${id}">${label}</label>
        <input id="bewerk-${id}" type="text" value="${waarde}" ${extra}>
        <span class="fout" id="fout-bewerk-${id}"></span>
      </div>`;
    const statusOpties = ['Aangevraagd', 'Afgewezen', 'Actief', 'Inactief']
      .map((s) => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('');
    el('tenant-detail').innerHTML = `
      <div class="kaart">
        <h2>${t.naam} <span class="demo-code">${t.code}</span></h2>
        ${t.status === 'Actief' ? `
        <div class="melding melding-info">
          <strong>Portalen</strong><br>
          Boekingspagina: <a href="tenant.html?code=${t.code}" target="_blank">tenant.html?code=${t.code}</a><br>
          Beheer: <a href="beheer.html?code=${t.code}" target="_blank">beheer.html?code=${t.code}</a><br>
          Beheerwachtwoord: <span class="demo-code">${t.beheerWachtwoord}</span>
        </div>` : ''}
        <div class="velden-rij">
          <img src="${t.logo}" alt="Logo" class="logo-preview">
          <div style="flex:1">
            ${veld('naam', 'Naam organisatie', t.naam)}
            <div class="veld">
              <label for="bewerk-status">Status</label>
              <select id="bewerk-status">${statusOpties}</select>
            </div>
          </div>
        </div>
        ${veld('email', 'E-mailadres', t.email)}
        <div class="velden-rij">
          ${veld('postcode', 'Postcode', t.postcode)}
          ${veld('huisnummer', 'Huisnummer', t.huisnummer)}
        </div>
        <div class="velden-rij">
          ${veld('straat', 'Straat', t.straat)}
          ${veld('plaats', 'Plaats', t.plaats)}
        </div>
        ${veld('kvk', 'KvK-nummer', t.kvk)}
        ${veld('contactpersoon', 'Contactpersoon', t.contactpersoon)}
        ${veld('telefoon', 'Telefoonnummer', t.telefoon)}
        <span class="fout" id="fout-bewerk-algemeen"></span>
        <button class="knop" id="knop-bewaar">Opslaan</button>
        <button class="knop knop-secundair" id="knop-sluit">Sluiten</button>
      </div>`;
    el('tenant-detail').scrollIntoView({ behavior: 'smooth' });

    el('knop-sluit').addEventListener('click', () => { el('tenant-detail').innerHTML = ''; });
    el('knop-bewaar').addEventListener('click', () => {
      const regels = {
        naam: Validatie.naam, email: Validatie.email, postcode: Validatie.postcode,
        huisnummer: Validatie.huisnummer, kvk: Validatie.kvk,
        contactpersoon: Validatie.naam, telefoon: Validatie.telefoon,
      };
      let ok = true;
      Object.entries(regels).forEach(([id, regel]) => {
        const geldig = regel(el('bewerk-' + id).value);
        el('fout-bewerk-' + id).textContent = geldig ? '' : 'Ongeldige waarde.';
        if (!geldig) ok = false;
      });
      if (!ok) return;
      OberPoesDb.wijzig(t.code, {
        naam: el('bewerk-naam').value.trim(),
        email: el('bewerk-email').value.trim(),
        postcode: el('bewerk-postcode').value.trim().toUpperCase(),
        huisnummer: el('bewerk-huisnummer').value.trim(),
        straat: el('bewerk-straat').value.trim(),
        plaats: el('bewerk-plaats').value.trim(),
        kvk: el('bewerk-kvk').value.trim(),
        contactpersoon: el('bewerk-contactpersoon').value.trim(),
        telefoon: el('bewerk-telefoon').value.trim(),
        status: el('bewerk-status').value,
      });
      if (el('bewerk-status').value === 'Actief') OberPoesDb.activeerTenant(t.code);
      el('tenant-detail').innerHTML = '';
      renderTenants();
    });
  }

  if (isIngelogd()) toonApp();
})();
