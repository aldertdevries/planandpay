// Printbare factuurweergave (?id=X) — vervangt de PDF-bijlage in de demo.
(() => {
  if (!document.getElementById('factuur')) return;
  const el = (id) => document.getElementById(id);

  const factuur = OberPoesDb.vindFactuur(new URLSearchParams(location.search).get('id') || '');
  const tenant = factuur && OberPoesDb.vindTenant(factuur.tenantCode);
  if (!factuur || !tenant) {
    el('niet-beschikbaar').classList.remove('verborgen');
    return;
  }
  const afspraak = OberPoesDb.alleAfspraken().find((a) => a.id === factuur.afspraakId);

  document.title = `Rekening ${factuur.nummer} — ${tenant.naam}`;
  el('f-logo').src = tenant.logo;
  el('f-tenant').textContent = tenant.naam;
  el('f-tenant-adres').textContent =
    `${tenant.straat} ${tenant.huisnummer}, ${tenant.postcode} ${tenant.plaats} · KvK ${tenant.kvk}`;
  el('f-nummer').textContent = factuur.nummer;
  el('f-datum').textContent = new Date(factuur.gemaaktOp).toLocaleDateString('nl-NL');
  el('f-kenmerk').textContent = factuur.nummer;
  if (factuur.creditVoor) {
    el('f-soort').textContent = 'CREDITREKENING';
    el('f-credit').textContent = `Creditrekening voor rekening ${factuur.creditVoor}.`;
    el('f-credit').classList.remove('verborgen');
  }
  el('f-voettekst').textContent = tenant.factuurVoettekst || Berichten.STANDAARD_FACTUURVOETTEKST;
  el('f-klant').textContent = `${factuur.klantNaam} (${factuur.klantEmail})`;
  el('f-klant-adres').innerHTML = afspraak && afspraak.straat
    ? `${afspraak.straat} ${afspraak.huisnummer}<br>${afspraak.postcode} ${afspraak.plaats}<br>`
    : '';
  el('f-afspraak').textContent = afspraak ? `${afspraak.datum} om ${afspraak.tijd}` : 'onbekend';

  el('f-regels').innerHTML = factuur.regels.map((r) => `
    <tr>
      <td>${r.naam}</td>
      <td>${r.btw === 'hoog' ? '21%' : '9%'}</td>
      <td style="text-align:right">${Facturatie.euro(r.bedragCent)}</td>
    </tr>`).join('');

  const t = Facturatie.totalen(factuur.regels);
  el('f-totalen').innerHTML = `
    <tr><td>Totaal excl. btw</td><td style="text-align:right">${Facturatie.euro(t.exclCent)}</td></tr>
    <tr><td>Btw 9% (laag)</td><td style="text-align:right">${Facturatie.euro(t.btwLaagCent)}</td></tr>
    <tr><td>Btw 21% (hoog)</td><td style="text-align:right">${Facturatie.euro(t.btwHoogCent)}</td></tr>
    <tr><td>Totaal incl. btw</td><td style="text-align:right">${Facturatie.euro(t.inclCent)}</td></tr>`;

  el('factuur').classList.remove('verborgen');
})();
