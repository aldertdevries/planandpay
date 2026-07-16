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

test('maakFactuur: pin en contant zetten status direct op Betaald', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Betaal BV' });
  const a1 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-01', tijd: '09:00', naam: 'K1', email: 'k1@x.nl' });
  const a2 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-01', tijd: '10:00', naam: 'K2', email: 'k2@x.nl' });
  const fPin = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a1.id, regels: [], betaalwijze: 'pin' });
  const fCon = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a2.id, regels: [], betaalwijze: 'contant' });
  assert(fPin.betaalwijze === 'pin' && fPin.status === 'Betaald', 'pin: ' + JSON.stringify(fPin));
  assert(fCon.betaalwijze === 'contant' && fCon.status === 'Betaald', 'contant: ' + JSON.stringify(fCon));
});

test('maakFactuur: mollie en zonder betaalwijze blijven Open (default mollie)', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Betaal BV' });
  const a1 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-02', tijd: '09:00', naam: 'K1', email: 'k1@x.nl' });
  const a2 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-02', tijd: '10:00', naam: 'K2', email: 'k2@x.nl' });
  const fMollie = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a1.id, regels: [], betaalwijze: 'mollie' });
  const fLeeg = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a2.id, regels: [] });
  assert(fMollie.betaalwijze === 'mollie' && fMollie.status === 'Open', 'mollie: ' + JSON.stringify(fMollie));
  assert(fLeeg.betaalwijze === 'mollie' && fLeeg.status === 'Open', 'leeg: ' + JSON.stringify(fLeeg));
});

test('zetStandaardBetaalwijze: opslaan en ongeldige waarde valt terug op mollie', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Betaal BV' });
  OberPoesDb.zetStandaardBetaalwijze(t.code, 'contant');
  assert(OberPoesDb.vindTenant(t.code).standaardBetaalwijze === 'contant', 'contant opgeslagen');
  OberPoesDb.zetStandaardBetaalwijze(t.code, 'onzin');
  assert(OberPoesDb.vindTenant(t.code).standaardBetaalwijze === 'mollie', 'ongeldig -> mollie');
});

test('crediteerFactuur: credit erft betaalwijze van origineel', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Betaal BV' });
  const a = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-08-03', tijd: '09:00', naam: 'K1', email: 'k1@x.nl' });
  const f = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id, regels: [{ naam: 'X', btw: 'hoog', bedragCent: 12100 }], betaalwijze: 'pin' });
  const credit = OberPoesDb.crediteerFactuur(f.id);
  assert(credit.betaalwijze === 'pin', 'credit betaalwijze: ' + JSON.stringify(credit));
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

// --- Verbeterronde: facturen ---
test('factuurReeks: default, doortellen en instelbaar', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Reeks BV' });
  const a1 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '09:00', naam: 'A', email: 'a@x.nl' });
  const a2 = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00', naam: 'B', email: 'b@x.nl' });
  const f1 = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a1.id, regels: [] });
  assert(f1.nummer.endsWith('-0001'), f1.nummer);
  OberPoesDb.zetFactuurReeks(t.code, 'BJ27', 100);
  const f2 = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a2.id, regels: [] });
  assert(f2.nummer === 'BJ27-0100', f2.nummer);
  assert(OberPoesDb.vindTenant(t.code).factuurReeks.volgende === 101);
});
test('crediteerFactuur: credit met negatieve regels, afspraak vrij', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Credit BV' });
  const a = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '09:00', naam: 'A', email: 'a@x.nl' });
  const f = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id,
    regels: [{ naam: 'Consult', btw: 'hoog', bedragCent: 5000 }] });
  const credit = OberPoesDb.crediteerFactuur(f.id);
  assert(credit.status === 'Credit' && credit.creditVoor === f.nummer);
  assert(credit.regels[0].bedragCent === -5000);
  assert(OberPoesDb.vindFactuur(f.id).status === 'Gecrediteerd');
  assert(OberPoesDb.afsprakenVoor(t.code)[0].factuurId === undefined, 'afspraak weer vrij');
  assert(OberPoesDb.crediteerFactuur(f.id) === null, 'niet nogmaals');
});
test('laatVervallen: alleen vanuit Open', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Verval BV' });
  const a = OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '09:00', naam: 'A', email: 'a@x.nl' });
  const f = OberPoesDb.maakFactuur({ tenantCode: t.code, afspraakId: a.id, regels: [] });
  assert(OberPoesDb.laatVervallen(f.id).status === 'Vervallen');
  assert(OberPoesDb.laatVervallen(f.id) === null, 'niet nogmaals');
});
test('totalen: negatieve bedragen (creditfactuur)', () => {
  const t = Facturatie.totalen([{ naam: 'C', btw: 'hoog', bedragCent: -12100 }]);
  assert(t.inclCent === -12100 && t.btwHoogCent === -2100 && t.exclCent === -10000);
});

// --- Verbeterronde: lijst ---
test('filterEnPagineer: zoekt, pagineert en klemt', () => {
  const items = Array.from({ length: 25 }, (_, i) =>
    ({ naam: 'Item ' + (i + 1), plaats: i < 5 ? 'Amsterdam' : 'Utrecht' }));
  const p1 = Lijst.filterEnPagineer(items, '', ['naam'], 1);
  assert(p1.items.length === 10 && p1.paginas === 3 && p1.totaal === 25);
  assert(Lijst.filterEnPagineer(items, '', ['naam'], 3).items.length === 5);
  assert(Lijst.filterEnPagineer(items, 'amster', ['naam', 'plaats'], 1).totaal === 5);
  assert(Lijst.filterEnPagineer(items, '', ['naam'], 99).pagina === 3, 'pagina geklemd');
});

// --- Klantcommunicatie ---
test('ics: start, eind over uurgrens en verplichte velden', () => {
  const ics = Kalender.ics({ titel: 'Afspraak', locatie: 'Dam 1, Amsterdam',
    omschrijving: 'Knippen', datum: '2026-07-14', tijd: '16:45', duurMinuten: 30, uid: 'AB12' });
  assert(ics.includes('DTSTART:20260714T164500'));
  assert(ics.includes('DTEND:20260714T171500'), 'eind over uurgrens');
  assert(ics.includes('SUMMARY:Afspraak') && ics.includes('LOCATION:Dam 1, Amsterdam'));
  assert(ics.includes('UID:AB12@planandpay'));
  assert(ics.startsWith('BEGIN:VCALENDAR') && ics.includes('END:VEVENT'));
  assert(ics.includes('\r\n'), 'CRLF');
});
test('berichten: render vervangt placeholders, onbekend blijft staan', () => {
  const uit = Berichten.render('Hoi {naam}, tot {datum}! {onbekend}', { naam: 'Jan', datum: 'morgen' });
  assert(uit === 'Hoi Jan, tot morgen! {onbekend}', 'kreeg: ' + uit);
});
test('berichten: tenant-tekst wint van standaard', () => {
  assert(Berichten.voor({}, 'boeking') === Berichten.STANDAARD.boeking);
  assert(Berichten.voor({ berichten: { boeking: 'Eigen tekst {naam}' } }, 'boeking') === 'Eigen tekst {naam}');
  assert(Berichten.voor({ berichten: { boeking: 'X' } }, 'factuur') === Berichten.STANDAARD.factuur);
});
test('zetBerichten en zetFactuurVoettekst', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Tekst BV' });
  OberPoesDb.zetBerichten(t.code, { boeking: 'Eigen' });
  OberPoesDb.zetFactuurVoettekst(t.code, 'Betaal snel.');
  const na = OberPoesDb.vindTenant(t.code);
  assert(na.berichten.boeking === 'Eigen' && na.factuurVoettekst === 'Betaal snel.');
});

// --- CSV ---
test('Csv.genereer: kopregel, escaping en CRLF', () => {
  const uit = Csv.genereer(['Naam', 'Opmerking'], [
    ['Jan', 'gewoon'],
    ['Piet; Klaas', 'met "quote"'],
    ['Kees', 'regel1\nregel2'],
  ]);
  const regels = uit.split('\r\n');
  assert(regels[0] === 'Naam;Opmerking', 'kop: ' + regels[0]);
  assert(regels[1] === 'Jan;gewoon');
  assert(regels[2] === '"Piet; Klaas";"met ""quote"""', 'kreeg: ' + regels[2]);
  assert(uit.includes('"regel1\nregel2"'));
});
test('Csv.genereer: lege lijst geeft alleen kop', () => {
  assert(Csv.genereer(['A', 'B'], []) === 'A;B');
});

test('berichten: uitnodiging met {link}', () => {
  assert(Berichten.STANDAARD.uitnodiging.includes('{link}'));
  const uit = Berichten.render(Berichten.voor({}, 'uitnodiging'),
    { naam: 'Jan', tenant: 'Kapper', link: 'https://x/boek' });
  assert(uit.includes('Jan') && uit.includes('Kapper') && uit.includes('https://x/boek'));
});

// --- Klanten samenvatten ---
test('klantenVoor: groepeert op e-mail, laatste gegevens en aantal', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Klant BV' });
  OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-14', tijd: '10:00',
    naam: 'Jan Jansen', email: 'JAN@x.nl', telefoon: '0611111111', straat: 'Dam', huisnummer: '1', postcode: '1012 JS', plaats: 'Amsterdam' });
  OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-20', tijd: '09:00',
    naam: 'Jan J. Jansen', email: 'jan@x.nl', telefoon: '0622222222', straat: 'Plein', huisnummer: '5', postcode: '3511 CJ', plaats: 'Utrecht' });
  OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-16', tijd: '11:00',
    naam: 'Fatima', email: 'fatima@x.nl', telefoon: '0633333333', straat: 'Markt', huisnummer: '2', postcode: '5038 EA', plaats: 'Tilburg' });
  OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-17', tijd: '12:00',
    naam: 'Zonder mail', email: '', telefoon: '0644444444' });
  const klanten = OberPoesDb.klantenVoor(t.code);
  assert(klanten.length === 2, 'twee klanten (mail-loze overgeslagen): ' + klanten.length);
  const jan = klanten.find((k) => k.email === 'jan@x.nl');
  assert(jan.aantal === 2, 'aantal: ' + jan.aantal);
  assert(jan.naam === 'Jan J. Jansen' && jan.telefoon === '0622222222', 'laatste gegevens');
  assert(jan.straat === 'Plein' && jan.plaats === 'Utrecht' && jan.laatste === '2026-07-20');
  // Sortering: recentste klant (Jan, 20-7) vóór Fatima (16-7)
  assert(klanten[0].email === 'jan@x.nl');
});

// --- Handmatige klanten ---
test('voegKlantToe: opslaan en upsert op e-mail (case-insensitief)', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Klant BV' });
  OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Nieuwe Klant', email: 'Nieuw@x.nl', telefoon: '0611111111' });
  OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Nieuwe Klant Bijgewerkt', email: 'nieuw@x.nl', telefoon: '0622222222' });
  const handmatig = OberPoesDb.handmatigeKlantenVoor(t.code);
  assert(handmatig.length === 1, 'upsert: geen duplicaat, kreeg ' + handmatig.length);
  assert(handmatig[0].naam === 'Nieuwe Klant Bijgewerkt' && handmatig[0].telefoon === '0622222222');
});
test('klantenVoor: handmatige klant met aantal 0, en samenvoegen met afspraak', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Klant BV' });
  OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Alleen Handmatig', email: 'hand@x.nl', telefoon: '0600000000' });
  const klanten1 = OberPoesDb.klantenVoor(t.code);
  const hand = klanten1.find((k) => k.email === 'hand@x.nl');
  assert(hand && hand.aantal === 0 && hand.laatste === '', 'handmatig: aantal 0, lege datum');
  // Afspraak op zelfde e-mail → samenvoegen, recentste gegevens winnen
  OberPoesDb.maakAfspraak({ tenantCode: t.code, datum: '2026-07-20', tijd: '10:00',
    naam: 'Via Afspraak', email: 'HAND@x.nl', telefoon: '0699999999' });
  const klanten2 = OberPoesDb.klantenVoor(t.code);
  assert(klanten2.length === 1, 'één samengevoegde klant');
  assert(klanten2[0].aantal === 1 && klanten2[0].naam === 'Via Afspraak' && klanten2[0].laatste === '2026-07-20');
});

test('vindKlant: vindt op id en geeft null bij onbekend', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Klant BV' });
  const klant = OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Piet', email: 'piet@x.nl' });
  assert(OberPoesDb.vindKlant(klant.id).email === 'piet@x.nl', 'vindt op id');
  assert(OberPoesDb.vindKlant('BESTAATNIET') === null, 'onbekend -> null');
});

test('zoekKlantOpContact: vindt op e-mail, hoofdletterongevoelig', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Contact BV' });
  OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Piet', email: 'Piet@Voorbeeld.nl', telefoon: '0612345678' });
  assert(OberPoesDb.zoekKlantOpContact(t.code, ' piet@voorbeeld.NL ').naam === 'Piet', 'e-mail match');
  assert(OberPoesDb.zoekKlantOpContact(t.code, 'onbekend@x.nl') === null, 'onbekende e-mail -> null');
});

test('zoekKlantOpContact: vindt op telefoon met spaties/streepjes, null bij onbekend', () => {
  OberPoesDb.wisAlles();
  const t = OberPoesDb.voegToe({ naam: 'Contact BV' });
  OberPoesDb.voegKlantToe({ tenantCode: t.code, naam: 'Piet', email: 'piet@x.nl', telefoon: '06-12 34 56 78' });
  assert(OberPoesDb.zoekKlantOpContact(t.code, '0612345678').naam === 'Piet', 'telefoon match');
  assert(OberPoesDb.zoekKlantOpContact(t.code, '0687654321') === null, 'onbekend nummer -> null');
  assert(OberPoesDb.zoekKlantOpContact(t.code, '') === null, 'lege invoer -> null');
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
