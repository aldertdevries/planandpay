// Pure agendafuncties — geen DOM, geen opslag.
const Agenda = (() => {
  const DAG_SLEUTELS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const DAG_NAMEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

  const naarMinuten = (hhmm) => {
    const [u, m] = hhmm.split(':').map(Number);
    return u * 60 + m;
  };
  const naarTijd = (minuten) =>
    String(Math.floor(minuten / 60)).padStart(2, '0') + ':' + String(minuten % 60).padStart(2, '0');
  const dagVan = (datumIso) => DAG_SLEUTELS[new Date(datumIso + 'T12:00:00').getDay()];

  return {
    DAG_SLEUTELS,
    DAG_NAMEN,
    standaardOpeningstijden() {
      const tijden = {};
      DAG_SLEUTELS.forEach((dag) => {
        tijden[dag] = { open: !['za', 'zo'].includes(dag), van: '09:00', tot: '17:00' };
      });
      return tijden;
    },
    komendeOpenDagen(openingstijden, vanafIso, aantal) {
      const dagen = [];
      const d = new Date(vanafIso + 'T12:00:00');
      for (let i = 0; i < aantal; i++) {
        const iso = d.toISOString().slice(0, 10);
        if (openingstijden[dagVan(iso)].open) dagen.push(iso);
        d.setDate(d.getDate() + 1);
      }
      return dagen;
    },
    sloten(openingstijden, slotDuur, datumIso, afspraken, blokkades = []) {
      const dag = openingstijden[dagVan(datumIso)];
      if (!dag.open) return [];
      const bezet = new Set(afspraken.filter((a) => a.datum === datumIso).map((a) => a.tijd));
      const geblokkeerd = blokkades.filter((b) =>
        (b.type === 'eenmalig' && b.datum === datumIso)
        || (b.type === 'wekelijks' && b.dag === dagVan(datumIso)));
      const uit = [];
      for (let m = naarMinuten(dag.van); m + slotDuur <= naarMinuten(dag.tot); m += slotDuur) {
        const tijd = naarTijd(m);
        const inBlokkade = geblokkeerd.some((b) =>
          m < naarMinuten(b.tot) && m + slotDuur > naarMinuten(b.van));
        uit.push({ tijd, vrij: !bezet.has(tijd) && !inBlokkade });
      }
      return uit;
    },
    actieveBlokkades(blokkades, vanafIso) {
      return blokkades.filter((b) => b.type === 'wekelijks' || b.datum >= vanafIso);
    },
  };
})();
