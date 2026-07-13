// Pure facturatiefuncties — btw en totalen in centen. Bedragen zijn incl. btw.
const Facturatie = (() => {
  const BTW = { hoog: 21, laag: 9 };

  const btwDeel = (bedragCent, tarief) =>
    Math.round(bedragCent * BTW[tarief] / (100 + BTW[tarief]));

  return {
    BTW,
    totalen(regels) {
      let inclCent = 0;
      let btwHoogCent = 0;
      let btwLaagCent = 0;
      regels.forEach((r) => {
        inclCent += r.bedragCent;
        if (r.btw === 'hoog') btwHoogCent += btwDeel(r.bedragCent, 'hoog');
        else btwLaagCent += btwDeel(r.bedragCent, 'laag');
      });
      return { inclCent, btwHoogCent, btwLaagCent, exclCent: inclCent - btwHoogCent - btwLaagCent };
    },
    euro(cent) {
      return '€ ' + (cent / 100).toLocaleString('nl-NL',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
  };
})();
