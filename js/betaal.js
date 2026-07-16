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
  el('b-omschrijving').textContent = `Rekening ${factuur.nummer}`;
  el('b-bedrag').textContent = Facturatie.euro(Facturatie.totalen(factuur.regels).inclCent);
  el('b-mollie').textContent = tenant.mollieApiId
    ? `Betaling via Mollie (${tenant.mollieApiId}). Dit is een demo: er gaat geen echt geld van uw rekening.`
    : 'Dit is een demo: er gaat geen echt geld van uw rekening.';
  el('checkout').classList.remove('verborgen');

  function toonBetaald() {
    el('b-open').classList.add('verborgen');
    el('b-betaald').classList.remove('verborgen');
  }
  if (factuur.status === 'Betaald') {
    toonBetaald();
  } else if (factuur.status !== 'Open') {
    el('b-open').classList.add('verborgen');
    el('b-betaald').classList.remove('verborgen');
    el('b-betaald').querySelector('.melding').textContent =
      `U kunt deze rekening niet betalen. De status is: ${factuur.status}.`;
  }

  el('knop-betaal').addEventListener('click', () => {
    OberPoesDb.zetFactuurStatus(factuur.id, 'Betaald');
    toonBetaald();
    const bedrag = Facturatie.euro(Facturatie.totalen(factuur.regels).inclCent);
    const mailTekst = Berichten.render(Berichten.voor(tenant, 'betaling'), {
      naam: factuur.klantNaam,
      tenant: tenant.naam,
      nummer: factuur.nummer,
      bedrag,
    });
    el('betaal-mail-inhoud').innerHTML =
      `<strong>Aan:</strong> ${factuur.klantEmail}<br>
      <strong>Onderwerp:</strong> Betaling ontvangen — rekening ${factuur.nummer}<br><br>
      ${Berichten.naarHtml(mailTekst)}`;
    el('betaal-mail').classList.remove('verborgen');
  });
})();
