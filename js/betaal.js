// Demo-betaalpagina (?factuur=X) — bootst een Mollie-checkout na.
(() => {
  if (!document.getElementById('checkout')) return;
  const el = (id) => document.getElementById(id);

  const factuur = OberPoesDb.vindFactuur(new URLSearchParams(location.search).get('factuur') || '');
  const tenant = factuur && OberPoesDb.vindTenant(factuur.tenantCode);
  if (!factuur || !tenant) {
    el('niet-beschikbaar').classList.remove('verborgen');
    return;
  }

  el('b-tenant').textContent = tenant.naam;
  el('b-omschrijving').textContent = `Factuur ${factuur.nummer}`;
  el('b-bedrag').textContent = Facturatie.euro(Facturatie.totalen(factuur.regels).inclCent);
  el('b-mollie').textContent = tenant.mollieApiId
    ? `Verwerkt via Mollie (${tenant.mollieApiId}) — demo, er wordt niets afgeschreven.`
    : 'Demo — er wordt niets afgeschreven.';
  el('checkout').classList.remove('verborgen');

  function toonBetaald() {
    el('b-open').classList.add('verborgen');
    el('b-betaald').classList.remove('verborgen');
  }
  if (factuur.status === 'Betaald') toonBetaald();

  el('knop-betaal').addEventListener('click', () => {
    OberPoesDb.zetFactuurStatus(factuur.id, 'Betaald');
    toonBetaald();
  });
})();
