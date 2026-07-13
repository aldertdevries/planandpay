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

// --- Facturatie: database ---
test('maakFactuur: nummering per tenant en koppeling afspraak', () => {
  OberPoesDb.wisAlles();
  const t1 = OberPoesDb.voegToe({ naam: 'Facturant BV' });
  const t2 = OberPoesDb.voegToe({ naam: 'Ander BV' });
  const a1 = OberPoesDb.maakAfspraak({ tenantCode: t1.code, datum: '2026-07-14', tijd: '10:00', naam: 'Jan', email: 'jan@x.nl' });
  const a2 = OberPoesDb.maakAfspraak({ tenantCode: t1.code, datum: '2026-07-14', tijd: '11:00', naam: 'Piet', email: 'piet@x.nl' });
  const a3 = OberPoesDb.maakAfspraak({ tenantCode: t2.code, datum: '2026-07-14', tijd: '10:00', naam: 'Kees', email: 'kees@x.nl' });
  const regels = [{ naam: 'Consult', btw: 'hoog', bedragCent: 5000 }];
  const f1 = OberPoesDb.maakFactuur({ tenantCode: t1.code, afspraakId: a1.id, regels });
  const f2 = OberPoesDb.maakFactuur({ tenantCode: t1.code, afspraakId: a2.id, regels });
  const f3 = OberPoesDb.maakFactuur({ tenantCode: t2.code, afspraakId: a3.id, regels });
  const jaar = f1.gemaaktOp.slice(0, 4);
  assert(f1.nummer === jaar + '-0001' && f2.nummer === jaar + '-0002', f1.nummer + '/' + f2.nummer);
  assert(f3.nummer === jaar + '-0001', 'nummering per tenant');
  assert(f1.klantNaam === 'Jan' && f1.klantEmail === 'jan@x.nl' && f1.status === 'Open');
  assert(OberPoesDb.afsprakenVoor(t1.code)[0].factuurId === f1.id);
});
test('maakFactuur: dubbel factureren geeft null', () => {
  const t1 = OberPoesDb.alleTenants()[0];
  const a = OberPoesDb.afsprakenVoor(t1.code)[0];
  assert(OberPoesDb.maakFactuur({ tenantCode: t1.code, afspraakId: a.id, regels: [] }) === null);
});
test('annuleerAfspraak: gefactureerde afspraak weigert', () => {
  const t1 = OberPoesDb.alleTenants()[0];
  const a = OberPoesDb.afsprakenVoor(t1.code)[0];
  assert(OberPoesDb.annuleerAfspraak(a.id) === false);
  assert(OberPoesDb.afsprakenVoor(t1.code).some((x) => x.id === a.id), 'afspraak blijft bestaan');
});
test('facturenVoor: alleen eigen tenant; status wijzigbaar', () => {
  const [t1, t2] = OberPoesDb.alleTenants();
  assert(OberPoesDb.facturenVoor(t1.code.toLowerCase()).length === 2);
  assert(OberPoesDb.facturenVoor(t2.code).length === 1);
  const f = OberPoesDb.facturenVoor(t2.code)[0];
  assert(OberPoesDb.zetFactuurStatus(f.id, 'Betaald').status === 'Betaald');
  assert(OberPoesDb.vindFactuur(f.id).status === 'Betaald');
});
test('factuurregels en mollie-id instelbaar', () => {
  const t = OberPoesDb.alleTenants()[0];
  OberPoesDb.zetFactuurRegels(t.code, [{ id: 'R1', naam: 'Consult', btw: 'hoog', bedragCent: 4500 }]);
  OberPoesDb.zetMollieApiId(t.code, 'test_123');
  const na = OberPoesDb.vindTenant(t.code);
  assert(na.factuurRegels.length === 1 && na.mollieApiId === 'test_123');
});
test('migratie: database zonder facturen-veld werkt', () => {
  localStorage.setItem('oberpoes_db', JSON.stringify({ tenants: [], afspraken: [] }));
  assert(Array.isArray(OberPoesDb.facturenVoor('X')));
});
test('demo-data: actieve tenant heeft factuurregels en mollie-id', () => {
  OberPoesDb.wisAlles();
  OberPoesDb.laadDemoData();
  const actief = OberPoesDb.alleTenants().find((t) => t.status === 'Actief');
  assert(actief.factuurRegels.length === 2 && actief.mollieApiId === 'demo_mollie_123');
});

// --- Blokkades ---
test('sloten: eenmalige blokkade alleen op eigen datum', () => {
  const blok = [{ type: 'eenmalig', datum: '2026-07-13', van: '12:00', tot: '13:00' }];
  const ma = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-13', [], blok);
  const di = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-14', [], blok);
  assert(ma.find((s) => s.tijd === '12:00').vrij === false);
  assert(di.find((s) => s.tijd === '12:00').vrij === true);
});
test('sloten: overlap-randen bij blokkade 12:00-13:00', () => {
  const blok = [{ type: 'eenmalig', datum: '2026-07-13', van: '12:00', tot: '13:00' }];
  const s = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-13', [], blok);
  assert(s.find((x) => x.tijd === '11:30').vrij === true);
  assert(s.find((x) => x.tijd === '12:00').vrij === false);
  assert(s.find((x) => x.tijd === '12:30').vrij === false);
  assert(s.find((x) => x.tijd === '13:00').vrij === true);
});
test('sloten: wekelijkse blokkade elke week op die dag', () => {
  const blok = [{ type: 'wekelijks', dag: 'ma', van: '09:00', tot: '10:00' }];
  const dezeWeek = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-13', [], blok);
  const volgendeWeek = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-20', [], blok);
  const dinsdag = Agenda.sloten(Agenda.standaardOpeningstijden(), 30, '2026-07-14', [], blok);
  assert(dezeWeek.find((s) => s.tijd === '09:00').vrij === false);
  assert(volgendeWeek.find((s) => s.tijd === '09:00').vrij === false);
  assert(dinsdag.find((s) => s.tijd === '09:00').vrij === true);
});
test('actieveBlokkades: verlopen eenmalige weg, rest blijft', () => {
  const blok = [
    { type: 'eenmalig', datum: '2026-07-10', van: '09:00', tot: '10:00' },
    { type: 'eenmalig', datum: '2026-07-20', van: '09:00', tot: '10:00' },
    { type: 'wekelijks', dag: 'ma', van: '12:00', tot: '13:00' },
  ];
  const actief = Agenda.actieveBlokkades(blok, '2026-07-13');
  assert(actief.length === 2);
  assert(!actief.some((b) => b.datum === '2026-07-10'));
});
test('zetBlokkades en activeerTenant-default', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Blok BV' });
  const na = OberPoesDb.activeerTenant(t.code);
  assert(Array.isArray(na.blokkades) && na.blokkades.length === 0);
  OberPoesDb.zetBlokkades(t.code, [{ id: 'B1', type: 'wekelijks', dag: 'ma', van: '12:00', tot: '13:00' }]);
  assert(OberPoesDb.vindTenant(t.code).blokkades.length === 1);
});

// --- Verbeterronde: agenda ---
test('maandagVan: geeft maandag van de week', () => {
  assert(Agenda.maandagVan('2026-07-15') === '2026-07-13');
  assert(Agenda.maandagVan('2026-07-13') === '2026-07-13');
  assert(Agenda.maandagVan('2026-07-19') === '2026-07-13');
});
test('sloten: capaciteit 2 laat twee afspraken per slot toe', () => {
  const een = [{ datum: '2026-07-13', tijd: '10:00' }];
  const twee = [...een, { datum: '2026-07-13', tijd: '10:00' }];
  const t = Agenda.standaardOpeningstijden();
  assert(Agenda.sloten(t, 30, '2026-07-13', een, [], 2).find((s) => s.tijd === '10:00').vrij === true);
  assert(Agenda.sloten(t, 30, '2026-07-13', twee, [], 2).find((s) => s.tijd === '10:00').vrij === false);
});
test('sloten: meerdaagse blokkade blokkeert hele periode', () => {
  const blok = [{ type: 'eenmalig', datum: '2026-07-14', datumTot: '2026-07-16', van: '09:00', tot: '17:00' }];
  const t = Agenda.standaardOpeningstijden();
  assert(Agenda.sloten(t, 30, '2026-07-14', [], blok).every((s) => !s.vrij));
  assert(Agenda.sloten(t, 30, '2026-07-16', [], blok).every((s) => !s.vrij));
  assert(Agenda.sloten(t, 30, '2026-07-13', [], blok).every((s) => s.vrij));
  assert(Agenda.sloten(t, 30, '2026-07-17', [], blok).every((s) => s.vrij));
});
test('actieveBlokkades: meerdaags verloopt op t/m-datum', () => {
  const blok = [
    { type: 'eenmalig', datum: '2026-07-01', datumTot: '2026-07-12', van: '09:00', tot: '17:00' },
    { type: 'eenmalig', datum: '2026-07-01', datumTot: '2026-07-14', van: '09:00', tot: '17:00' },
  ];
  const actief = Agenda.actieveBlokkades(blok, '2026-07-13');
  assert(actief.length === 1 && actief[0].datumTot === '2026-07-14');
});
// --- Verbeterronde: database ---
test('maakAfspraak: respecteert capaciteit van de tenant', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Cap BV' });
  OberPoesDb.activeerTenant(t.code);
  OberPoesDb.zetOpeningstijden(t.code, Agenda.standaardOpeningstijden(), 30, 2);
  assert(OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'A' }) !== null);
  assert(OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'B' }) !== null);
  assert(OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'C' }) === null);
});
test('verzetAfspraak: verzet, weigert vol slot en gefactureerd', () => {
  const t = OberPoesDb.alleTenants()[0]; // Cap BV, capaciteit 2
  const a = OberPoesDb.afsprakenVoor(t.code)[0];
  const verzet = OberPoesDb.verzetAfspraak(a.id, '2026-07-15', '11:00');
  assert(verzet && verzet.datum === '2026-07-15' && verzet.tijd === '11:00');
  OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'D' });
  assert(OberPoesDb.verzetAfspraak(a.id, '2026-07-14', '10:00') === null, 'vol slot');
  OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id, regels: [] });
  assert(OberPoesDb.verzetAfspraak(a.id, '2026-07-16', '09:00') === null, 'gefactureerd');
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
