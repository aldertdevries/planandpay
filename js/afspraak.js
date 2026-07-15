// Klantpagina voor één afspraak (?id=X): inzien, verzetten, annuleren.
(() => {
  if (!document.getElementById('afspraak-pagina')) return;
  const el = (id) => document.getElementById(id);

  const id = new URLSearchParams(location.search).get('id') || '';
  const afspraak = OberPoesDb.alleAfspraken().find((a) => a.id === id);
  const tenant = afspraak && OberPoesDb.vindTenant(afspraak.tenantCode);
  if (!afspraak || !tenant || tenant.status !== 'Actief') {
    el('niet-beschikbaar').classList.remove('verborgen');
    return;
  }

  const datumLabel = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    return `${Agenda.DAG_NAMEN[d.getDay()]} ${d.toLocaleDateString('nl-NL')}`;
  };

  el('t-logo').src = tenant.logo;
  el('t-naam').textContent = tenant.naam;
  document.title = `Uw afspraak — ${tenant.naam}`;
  el('inhoud').classList.remove('verborgen');

  el('a-detail').innerHTML =
    `<strong>${datumLabel(afspraak.datum)} om ${afspraak.tijd}</strong><br>`
    + `Locatie: ${tenant.straat} ${tenant.huisnummer}, ${tenant.plaats}<br>`
    + `Op naam van: ${afspraak.naam}`;

  if (afspraak.factuurId) {
    el('acties').classList.add('verborgen');
    el('gefactureerd-melding').textContent =
      `U heeft al een factuur voor deze afspraak gekregen. `
      + `Daarom kunt u de afspraak hier niet meer wijzigen. `
      + `Neem contact op met ${tenant.naam} via ${tenant.email}.`;
    el('gefactureerd-melding').classList.remove('verborgen');
    return;
  }

  function klaar(tekst) {
    el('detail-kaart').classList.add('verborgen');
    el('verzet-kaart').classList.add('verborgen');
    el('klaar-melding').textContent = tekst;
    el('klaar-kaart').classList.remove('verborgen');
  }

  el('knop-annuleren').addEventListener('click', () => {
    if (!confirm('Weet u zeker dat u uw afspraak wilt annuleren?')) return;
    if (OberPoesDb.annuleerAfspraak(afspraak.id)) {
      klaar('Uw afspraak is geannuleerd.');
    }
  });

  let gekozenDatum = null;

  function renderDagen() {
    const vandaag = new Date().toISOString().slice(0, 10);
    const dagen = Agenda.komendeOpenDagen(tenant.openingstijden, vandaag, 14);
    el('dag-keuze').innerHTML = dagen.map((iso) =>
      `<button type="button" class="knop knop-secundair${iso === gekozenDatum ? ' gekozen' : ''}" data-datum="${iso}">${datumLabel(iso)}</button>`
    ).join('');
    el('dag-keuze').querySelectorAll('button').forEach((k) => {
      k.addEventListener('click', () => {
        gekozenDatum = k.dataset.datum;
        renderDagen();
        renderTijden();
      });
    });
  }

  function renderTijden() {
    el('tijd-blok').classList.remove('verborgen');
    const sloten = Agenda.sloten(tenant.openingstijden, tenant.slotDuur || 30,
      gekozenDatum, OberPoesDb.afsprakenVoor(tenant.code).filter((a) => a.id !== afspraak.id),
      tenant.blokkades || [], tenant.capaciteit || 1);
    el('tijd-keuze').innerHTML = sloten.map((s) =>
      `<button type="button" class="knop knop-secundair" data-tijd="${s.tijd}" ${s.vrij ? '' : 'disabled'}>${s.tijd}</button>`
    ).join('') || '<em>Op deze dag zijn geen tijden vrij.</em>';
    el('tijd-keuze').querySelectorAll('button:not([disabled])').forEach((k) => {
      k.addEventListener('click', () => {
        const nieuw = OberPoesDb.verzetAfspraak(afspraak.id, gekozenDatum, k.dataset.tijd);
        if (!nieuw) {
          el('fout-verzet').textContent = 'Deze tijd is net bezet. Kies een andere tijd.';
          renderTijden();
          return;
        }
        klaar(`Uw afspraak is verzet naar ${datumLabel(nieuw.datum)} om ${nieuw.tijd}.`);
        const mailTekst = Berichten.render(Berichten.voor(tenant, 'verzet'), {
          naam: afspraak.naam,
          tenant: tenant.naam,
          datum: datumLabel(nieuw.datum),
          tijd: nieuw.tijd,
        });
        const ics = Kalender.ics({
          titel: `Afspraak bij ${tenant.naam}`,
          locatie: `${tenant.straat} ${tenant.huisnummer}, ${tenant.plaats}`,
          omschrijving: nieuw.extra || 'Afspraak',
          datum: nieuw.datum,
          tijd: nieuw.tijd,
          duurMinuten: tenant.slotDuur || 30,
          uid: nieuw.id,
        });
        el('verzet-mail').innerHTML =
          `<strong>Demo — bevestigingsmail:</strong><br>
          <strong>Aan:</strong> ${afspraak.email}<br>
          <strong>Onderwerp:</strong> Afspraak verzet — ${tenant.naam}<br><br>
          ${Berichten.naarHtml(mailTekst)}<br><br>
          <strong>Bijlage:</strong>
          <a download="afspraak.ics" href="${Kalender.icsDataUrl(ics)}">📅 afspraak.ics</a>`;
        el('verzet-mail').classList.remove('verborgen');
      });
    });
  }

  el('knop-verzetten').addEventListener('click', () => {
    el('verzet-kaart').classList.remove('verborgen');
    renderDagen();
    el('verzet-kaart').scrollIntoView({ behavior: 'smooth' });
  });
})();
