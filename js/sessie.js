// Glijdende sessie: blijft geldig tot 1 uur na het laatste gebruik en
// overleeft het sluiten van een tab (localStorage). Gebruikt door de admin-
// en tenantbeheer-pagina's.
const Sessie = (() => {
  const MAX = 3600000; // 1 uur in ms

  function actief(sleutel) {
    const ts = parseInt(localStorage.getItem(sleutel), 10);
    if (ts && Date.now() - ts < MAX) {
      localStorage.setItem(sleutel, String(Date.now())); // glijdend vernieuwen
      return true;
    }
    localStorage.removeItem(sleutel);
    return false;
  }

  function begin(sleutel) { localStorage.setItem(sleutel, String(Date.now())); }
  function eind(sleutel) { localStorage.removeItem(sleutel); }

  function bewaak(sleutel, opVerlopen) {
    let laatst = 0;
    const vernieuw = () => {
      const nu = Date.now();
      if (localStorage.getItem(sleutel) && nu - laatst > 30000) {
        laatst = nu;
        localStorage.setItem(sleutel, String(nu));
      }
    };
    ['click', 'keydown', 'touchstart'].forEach((e) =>
      document.addEventListener(e, vernieuw, { passive: true }));
    setInterval(() => {
      const ts = parseInt(localStorage.getItem(sleutel), 10);
      if (!ts || Date.now() - ts >= MAX) opVerlopen();
    }, 60000);
  }

  return { MAX, actief, begin, eind, bewaak };
})();
