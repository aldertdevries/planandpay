// Tests voor validatie.js en db.js. Draait in de browser (tests.html)
// en in Node (scripts/run-tests.mjs) met localStorage/canvas-shims.
const resultaten = [];
function test(naam, fn) {
  try { fn(); resultaten.push({ naam, ok: true }); }
  catch (e) { resultaten.push({ naam, ok: false, fout: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion faalt'); }

// Schone lei: tests draaien op de echte localStorage van deze pagina
OberPoesDb.wisAlles();

// --- Validatie ---
test('email: geldig', () => assert(Validatie.email('a@b.nl')));
test('email: ongeldig', () => assert(!Validatie.email('geen-email')));
test('postcode: geldig met en zonder spatie', () =>
  assert(Validatie.postcode('1234 AB') && Validatie.postcode('1234ab')));
test('postcode: ongeldig', () =>
  assert(!Validatie.postcode('0123 AB') && !Validatie.postcode('12345')));
test('telefoon: geldig 06 / +31 / vast', () =>
  assert(Validatie.telefoon('0612345678') && Validatie.telefoon('+31612345678')
    && Validatie.telefoon('020-1234567')));
test('telefoon: ongeldig', () =>
  assert(!Validatie.telefoon('12345') && !Validatie.telefoon('0012345678')));
test('kvk: precies 8 cijfers', () =>
  assert(Validatie.kvk('12345678') && !Validatie.kvk('1234567') && !Validatie.kvk('1234567a')));
test('huisnummer: 12, 12a, 12-2 geldig; abc ongeldig', () =>
  assert(Validatie.huisnummer('12') && Validatie.huisnummer('12a')
    && Validatie.huisnummer('12-2') && !Validatie.huisnummer('abc')));

// --- Database ---
test('lege database geeft lege lijst', () =>
  assert(OberPoesDb.alleTenants().length === 0));
test('corrupte data → verse database', () => {
  localStorage.setItem('oberpoes_db', '{kapot');
  assert(OberPoesDb.alleTenants().length === 0);
});
test('genereerCode: 6 tekens, geen verwarrende tekens', () => {
  for (let i = 0; i < 50; i++) {
    const code = OberPoesDb.genereerCode();
    assert(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code), 'kreeg: ' + code);
  }
});
test('voegToe: zet code, status Aangevraagd en datum', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Test BV' });
  assert(t.code.length === 6 && t.status === 'Aangevraagd' && !!t.aangevraagdOp);
  assert(OberPoesDb.alleTenants().length === 1);
});
test('vindTenant: case-insensitive', () => {
  const t = OberPoesDb.alleTenants()[0];
  assert(OberPoesDb.vindTenant(t.code.toLowerCase()) !== null);
});
test('wijzig: past velden aan maar nooit de code', () => {
  const t = OberPoesDb.alleTenants()[0];
  const na = OberPoesDb.wijzig(t.code, { naam: 'Nieuw BV', code: 'HACKED' });
  assert(na.naam === 'Nieuw BV' && na.code === t.code);
});
test('zetStatus: wijzigt status', () => {
  const t = OberPoesDb.alleTenants()[0];
  assert(OberPoesDb.zetStatus(t.code, 'Actief').status === 'Actief');
});
test('wijzig van onbekende code geeft null', () =>
  assert(OberPoesDb.wijzig('XXXXXX', { naam: 'x' }) === null));
test('demo-data: 3 tenants met gevarieerde status', () => {
  OberPoesDb.wisAlles();
  OberPoesDb.laadDemoData();
  const alle = OberPoesDb.alleTenants();
  assert(alle.length === 3);
  assert(alle.some((t) => t.status === 'Aangevraagd')
    && alle.some((t) => t.status === 'Actief')
    && alle.some((t) => t.status === 'Inactief'));
});

// --- Agenda ---
test('standaardOpeningstijden: ma-vr open, za/zo dicht', () => {
  const t = Agenda.standaardOpeningstijden();
  assert(t.ma.open && t.vr.open && !t.za.open && !t.zo.open);
  assert(t.ma.van === '09:00' && t.ma.tot === '17:00');
});
test('komendeOpenDagen: week vanaf maandag geeft 5 werkdagen', () => {
  const dagen = Agenda.komendeOpenDagen(Agenda.standaardOpeningstijden(), '2026-07-13', 7);
  assert(dagen.length === 5, 'kreeg ' + dagen.length);
  assert(dagen[0] === '2026-07-13' && dagen[4] === '2026-07-17');
});
test('sloten: 9-17 met 30 min geeft 16 sloten', () => {
  const s = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-13', []);
  assert(s.length === 16 && s[0].tijd === '09:00' && s[15].tijd === '16:30');
  assert(s.every((x) => x.vrij));
});
test('sloten: geboekt slot is niet vrij', () => {
  const s = Agenda.sloten(Agenda.standaardOpeningstijden(), 30,
    '2026-07-13', [{ datum: '2026-07-13', tijd: '10:00' }]);
  assert(s.find((x) => x.tijd === '10:00').vrij === false);
  assert(s.find((x) => x.tijd === '10:30').vrij === true);
});
test('sloten: dichte dag geeft lege lijst', () => {
  assert(Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-12', []).length === 0);
});
test('sloten: 60 min duur geeft 8 sloten', () => {
  assert(Agenda.sloten(Agenda.standaardOpeningstijden(), 60, '2026-07-13', []).length === 8);
});

// --- Afspraken en activering ---
test('migratie: oude database zonder afspraken-veld werkt', () => {
  localStorage.setItem('oberpoes_db', JSON.stringify({ tenants: [] }));
  assert(Array.isArray(OberPoesDb.alleAfspraken()));
});
test('activeerTenant: zet status en defaults, geen wachtwoord', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Activeer BV' });
  const na = OberPoesDb.activeerTenant(t.code);
  assert(na.status === 'Actief');
  assert(na.beheerWachtwoord === undefined, 'wachtwoordloos: geen beheerWachtwoord');
  assert(na.openingstijden.ma.open === true && na.slotDuur === 30);
});
test('maakAfspraak: slaat op en weigert dubbelboeking', () => {
  const t = OberPoesDb.alleTenants()[0];
  const a = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'Jan' });
  assert(a && a.id && a.gemaaktOp);
  const dubbel = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'Piet' });
  assert(dubbel === null);
});
test('afsprakenVoor: alleen eigen tenant, case-insensitive', () => {
  const t1 = OberPoesDb.alleTenants()[0];
  const t2 = OberPoesDb.voegToe({ naam: 'Andere BV' });
  OberPoesDb.maakAfspraak({ tenantCode: t2.code, datum: '2026-07-14', tijd: '10:00', naam: 'Ander' });
  assert(OberPoesDb.afsprakenVoor(t1.code.toLowerCase()).length === 1);
  assert(OberPoesDb.afsprakenVoor(t2.code).length === 1);
  assert(OberPoesDb.afsprakenVoor(t1.code)[0].naam === 'Jan');
});
test('annuleerAfspraak: verwijdert en geeft slot vrij', () => {
  const t = OberPoesDb.alleTenants()[0];
  const a = OberPoesDb.afsprakenVoor(t.code)[0];
  assert(OberPoesDb.annuleerAfspraak(a.id) === true);
  assert(OberPoesDb.annuleerAfspraak(a.id) === false, 'tweede keer false');
  const opnieuw = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'Weer' });
  assert(opnieuw !== null, 'slot moet weer vrij zijn');
});
test('zetOpeningstijden: wijzigt tijden en slotduur', () => {
  const t = OberPoesDb.alleTenants()[0];
  const tijden = Agenda.standaardOpeningstijden();
  tijden.za = { open: true, van: '10:00', tot: '14:00' };
  const na = OberPoesDb.zetOpeningstijden(t.code, tijden, 60);
  assert(na.openingstijden.za.open === true && na.slotDuur === 60);
});
test('demo-data: actieve tenant heeft openingstijden en afspraken', () => {
  OberPoesDb.wisAlles();
  OberPoesDb.laadDemoData();
  const actief = OberPoesDb.alleTenants().find((t) => t.status === 'Actief');
  assert(!!actief.openingstijden && actief.slotDuur === 30);
  assert(OberPoesDb.afsprakenVoor(actief.code).length === 2);
});

// --- Maskering ---
test('maskeer: e-mail en telefoon', () => {
  assert(Maskeer.email('contact@viervoeters.nl') === 'c····@viervoeters.nl',
    'kreeg: ' + Maskeer.email('contact@viervoeters.nl'));
  assert(Maskeer.telefoon('0307654321') === '03······21',
    'kreeg: ' + Maskeer.telefoon('0307654321'));
  assert(Maskeer.telefoon('06-1234 5678') === '06······78');
});

// --- Facturatie: rekenwerk ---
test('totalen: alleen hoog', () => {
  const t = Facturatie.totalen([{ naam: 'A', btw: 'hoog', bedragCent: 12100 }]);
  assert(t.inclCent === 12100 && t.btwHoogCent === 2100 && t.btwLaagCent === 0 && t.exclCent === 10000);
});
test('totalen: alleen laag', () => {
  const t = Facturatie.totalen([{ naam: 'B', btw: 'laag', bedragCent: 10900 }]);
  assert(t.inclCent === 10900 && t.btwLaagCent === 900 && t.btwHoogCent === 0 && t.exclCent === 10000);
});
test('totalen: gemengd met afronding per regel', () => {
  const t = Facturatie.totalen([
    { naam: 'A', btw: 'hoog', bedragCent: 999 },
    { naam: 'B', btw: 'laag', bedragCent: 555 },
  ]);
  assert(t.inclCent === 1554 && t.btwHoogCent === 173 && t.btwLaagCent === 46);
  assert(t.exclCent === 1554 - 173 - 46);
});
test('euro-notatie', () => {
  assert(Facturatie.euro(1234) === '€ 12,34', 'kreeg: ' + Facturatie.euro(1234));
});

OberPoesDb.wisAlles();

const geslaagd = resultaten.filter((r) => r.ok).length;
if (typeof document !== 'undefined' && document.getElementById('resultaten')) {
  document.getElementById('resultaten').innerHTML = resultaten.map((r) =>
    `<div class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✔' : '✘'} ${r.naam}${r.fout ? ' — ' + r.fout : ''}</div>`
  ).join('') + `<p>${geslaagd}/${resultaten.length} geslaagd</p>`;
} else if (typeof console !== 'undefined') {
  resultaten.forEach((r) =>
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.naam}${r.fout ? ' — ' + r.fout : ''}`));
  console.log(`${geslaagd}/${resultaten.length} geslaagd`);
  if (typeof process !== 'undefined' && geslaagd !== resultaten.length) process.exitCode = 1;
}
