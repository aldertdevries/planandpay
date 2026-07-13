// Openbare boekingspagina van één tenant (?code=XXXXXX).
(() => {
  if (!document.getElementById('boeking')) return;

  const el = (id) => document.getElementById(id);
  const zetFout = (id, tekst) => { el('fout-' + id).textContent = tekst || ''; };

  const code = new URLSearchParams(location.search).get('code') || '';
  const tenant = OberPoesDb.vindTenant(code);
  if (!tenant || tenant.status !== 'Actief') {
    el('niet-beschikbaar').classList.remove('verborgen');
    return;
  }

  el('t-logo').src = tenant.logo;
  el('t-naam').textContent = tenant.naam;
  el('t-adres').textContent = `${tenant.straat} ${tenant.huisnummer}, ${tenant.plaats}`;
  document.title = `Afspraak maken — ${tenant.naam}`;
  el('boeking').classList.remove('verborgen');

  let gekozenDatum = null;
  let gekozenTijd = null;
  let adres = null;

  const datumLabel = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    return `${Agenda.DAG_NAMEN[d.getDay()].slice(0, 2)} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  function renderDagen() {
    const vandaag = new Date().toISOString().slice(0, 10);
    const dagen = Agenda.komendeOpenDagen(tenant.openingstijden, vandaag, 14);
    el('dag-keuze').innerHTML = dagen.map((iso) =>
      `<button type="button" class="knop knop-secundair${iso === gekozenDatum ? ' gekozen' : ''}" data-datum="${iso}">${datumLabel(iso)}</button>`
    ).join('');
    el('dag-keuze').querySelectorAll('button').forEach((k) => {
      k.addEventListener('click', () => {
        gekozenDatum = k.dataset.datum;
        gekozenTijd = null;
        el('stap-gegevens').classList.add('verborgen');
        renderDagen();
        renderTijden();
      });
    });
  }

  function renderTijden() {
    el('tijd-blok').classList.remove('verborgen');
    const sloten = Agenda.sloten(tenant.openingstijden, tenant.slotDuur || 30,
      gekozenDatum, OberPoesDb.afsprakenVoor(tenant.code));
    el('tijd-keuze').innerHTML = sloten.map((s) =>
      `<button type="button" class="knop knop-secundair${s.tijd === gekozenTijd ? ' gekozen' : ''}" data-tijd="${s.tijd}" ${s.vrij ? '' : 'disabled'}>${s.tijd}</button>`
    ).join('') || '<em>Geen tijden beschikbaar op deze dag.</em>';
    el('tijd-keuze').querySelectorAll('button:not([disabled])').forEach((k) => {
      k.addEventListener('click', () => {
        gekozenTijd = k.dataset.tijd;
        renderTijden();
        el('gekozen-slot').textContent =
          `Gekozen: ${datumLabel(gekozenDatum)} om ${gekozenTijd}`;
        el('stap-gegevens').classList.remove('verborgen');
        el('stap-gegevens').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  renderDagen();

  Adres.bind({
    postcodeEl: el('postcode'),
    huisnummerEl: el('huisnummer'),
    straatEl: el('straat'),
    plaatsEl: el('plaats'),
    foutEl: el('fout-adres'),
    bijAdres: (a) => { adres = a; },
  });

  const veldRegels = {
    naam: [Validatie.naam, 'Vul uw naam in (minimaal 2 tekens).'],
    email: [Validatie.email, 'Vul een geldig e-mailadres in.'],
    postcode: [Validatie.postcode, 'Vul een geldige Nederlandse postcode in (1234 AB).'],
    huisnummer: [Validatie.huisnummer, 'Vul een geldig huisnummer in.'],
    telefoon: [Validatie.telefoon, 'Vul een geldig Nederlands telefoonnummer in.'],
  };
  Object.entries(veldRegels).forEach(([id, [regel, melding]]) => {
    el(id).addEventListener('blur', () => {
      zetFout(id, el(id).value && !regel(el(id).value) ? melding : '');
    });
  });

  el('afspraakformulier').addEventListener('submit', (e) => {
    e.preventDefault();
    zetFout('boeking', '');
    if (!gekozenDatum || !gekozenTijd) {
      zetFout('boeking', 'Kies eerst een dag en tijd.');
      return;
    }
    let ok = true;
    Object.entries(veldRegels).forEach(([id, [regel, melding]]) => {
      const geldig = regel(el(id).value);
      zetFout(id, geldig ? '' : melding);
      if (!geldig) ok = false;
    });
    if (!adres) {
      zetFout('adres', 'Het adres kon nog niet bepaald worden. Controleer postcode en huisnummer.');
      ok = false;
    }
    if (!ok) return;

    const afspraak = OberPoesDb.maakAfspraak({
      tenantCode: tenant.code,
      datum: gekozenDatum,
      tijd: gekozenTijd,
      naam: el('naam').value.trim(),
      email: el('email').value.trim(),
      postcode: el('postcode').value.trim().toUpperCase(),
      huisnummer: el('huisnummer').value.trim(),
      straat: adres.straat,
      plaats: adres.plaats,
      extra: el('extra').value.trim(),
      telefoon: el('telefoon').value.trim(),
    });
    if (!afspraak) {
      zetFout('boeking', 'Dit tijdstip is zojuist bezet geraakt. Kies een andere tijd.');
      renderTijden();
      return;
    }
    el('bevestiging').innerHTML =
      `Uw afspraak bij <strong>${tenant.naam}</strong> op <strong>${datumLabel(afspraak.datum)}</strong> `
      + `om <strong>${afspraak.tijd}</strong> is bevestigd.<br>`
      + `Locatie: ${tenant.straat} ${tenant.huisnummer}, ${tenant.plaats}.`;
    el('stap-slot').classList.add('verborgen');
    el('stap-gegevens').classList.add('verborgen');
    el('stap-klaar').classList.remove('verborgen');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
