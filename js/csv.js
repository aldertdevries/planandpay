// CSV-hulp voor exports. Puntkomma-gescheiden (Nederlands Excel), waarden
// met ; " of nieuwe regel worden tussen dubbele quotes gezet.
const Csv = (() => {
  function veld(waarde) {
    const s = String(waarde === undefined || waarde === null ? '' : waarde);
    if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function genereer(kolommen, rijen) {
    const regels = [kolommen.map(veld).join(';')];
    rijen.forEach((rij) => regels.push(rij.map(veld).join(';')));
    return regels.join('\r\n');
  }
  function download(bestandsnaam, inhoud) {
    const blob = new Blob(['﻿' + inhoud], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = bestandsnaam;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return { genereer, download };
})();
