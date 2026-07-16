// Sjablonen voor klantberichten; per tenant aanpasbaar in het beheer.
const Berichten = {
  STANDAARD: {
    boeking: 'Beste {naam},\n\nUw afspraak staat vast. U komt op {datum} om {tijd} bij {tenant}. Een dag van tevoren sturen wij u een herinnering.\n\nMet vriendelijke groet,\n{tenant}',
    verzet: 'Beste {naam},\n\nUw afspraak is verzet. U komt nu op {datum} om {tijd} bij {tenant}.\n\nMet vriendelijke groet,\n{tenant}',
    factuur: 'Beste {naam},\n\nHierbij sturen wij u factuur {nummer}. Het bedrag is {bedrag}. U kunt makkelijk online betalen met de betaallink in dit bericht.\n\nMet vriendelijke groet,\n{tenant}',
    betaling: 'Beste {naam},\n\nWij hebben uw betaling van {bedrag} ontvangen voor factuur {nummer}. Bedankt!\n\nMet vriendelijke groet,\n{tenant}',
    uitnodiging: 'Beste {naam},\n\nMaak eenvoudig online een afspraak bij {tenant} via deze link: {link}\n\nTot ziens!\n{tenant}',
  },
  STANDAARD_FACTUURVOETTEKST:
    'Betaal dit bedrag graag binnen 14 dagen. Vermeld daarbij het factuurnummer.',
  render(sjabloon, data) {
    return String(sjabloon).replace(/\{(\w+)\}/g,
      (heel, sleutel) => (data[sleutel] !== undefined ? data[sleutel] : heel));
  },
  voor(tenant, type) {
    return (tenant.berichten && tenant.berichten[type]) || this.STANDAARD[type];
  },
  naarHtml(tekst) { return String(tekst).replace(/\n/g, '<br>'); },
};
