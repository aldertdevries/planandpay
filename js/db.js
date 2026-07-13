// "Database" bovenop localStorage. Eén sleutel, één JSON-object.
const OberPoesDb = (() => {
  const DB_SLEUTEL = 'oberpoes_db';
  // Zonder 0/O/1/I/L om verwarring te voorkomen.
  const CODE_TEKENS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function lees() {
    try {
      const data = JSON.parse(localStorage.getItem(DB_SLEUTEL));
      if (data && Array.isArray(data.tenants)) {
        if (!Array.isArray(data.afspraken)) data.afspraken = [];
        if (!Array.isArray(data.facturen)) data.facturen = [];
        return data;
      }
    } catch (e) { /* corrupte data → verse database */ }
    return { tenants: [], afspraken: [], facturen: [] };
  }
  function schrijf(db) {
    localStorage.setItem(DB_SLEUTEL, JSON.stringify(db));
  }
  function zoek(db, code) {
    const norm = String(code).toUpperCase();
    return db.tenants.find((t) => t.code.toUpperCase() === norm) || null;
  }

  return {
    alleTenants() { return lees().tenants; },
    vindTenant(code) { return zoek(lees(), code); },
    genereerCode() {
      const db = lees();
      let code;
      do {
        code = Array.from({ length: 6 },
          () => CODE_TEKENS[Math.floor(Math.random() * CODE_TEKENS.length)]).join('');
      } while (zoek(db, code));
      return code;
    },
    voegToe(velden) {
      const db = lees();
      const tenant = {
        ...velden,
        code: this.genereerCode(),
        status: 'Aangevraagd',
        aangevraagdOp: new Date().toISOString(),
      };
      db.tenants.push(tenant);
      schrijf(db);
      return tenant;
    },
    wijzig(code, velden) {
      const db = lees();
      const tenant = zoek(db, code);
      if (!tenant) return null;
      const { code: _genegeerd, ...rest } = velden;
      Object.assign(tenant, rest);
      schrijf(db);
      return tenant;
    },
    zetStatus(code, status) { return this.wijzig(code, { status }); },
    activeerTenant(code) {
      const bestaand = this.vindTenant(code);
      if (!bestaand) return null;
      return this.wijzig(code, {
        status: 'Actief',
        openingstijden: bestaand.openingstijden || Agenda.standaardOpeningstijden(),
        slotDuur: bestaand.slotDuur || 30,
        factuurRegels: bestaand.factuurRegels || [],
        mollieApiId: bestaand.mollieApiId || '',
        blokkades: bestaand.blokkades || [],
      });
    },
    alleAfspraken() { return lees().afspraken; },
    afsprakenVoor(tenantCode) {
      const norm = String(tenantCode).toUpperCase();
      return lees().afspraken.filter((a) => a.tenantCode.toUpperCase() === norm);
    },
    maakAfspraak(velden) {
      const db = lees();
      const norm = String(velden.tenantCode).toUpperCase();
      const bezet = db.afspraken.some((a) => a.tenantCode.toUpperCase() === norm
        && a.datum === velden.datum && a.tijd === velden.tijd);
      if (bezet) return null;
      const afspraak = { ...velden, id: this.genereerCode(), gemaaktOp: new Date().toISOString() };
      db.afspraken.push(afspraak);
      schrijf(db);
      return afspraak;
    },
    annuleerAfspraak(id) {
      const db = lees();
      const afspraak = db.afspraken.find((a) => a.id === id);
      if (!afspraak || afspraak.factuurId) return false;
      db.afspraken = db.afspraken.filter((a) => a.id !== id);
      schrijf(db);
      return true;
    },
    zetOpeningstijden(code, openingstijden, slotDuur) {
      return this.wijzig(code, { openingstijden, slotDuur });
    },
    zetBlokkades(code, blokkades) { return this.wijzig(code, { blokkades }); },
    zetFactuurRegels(code, regels) { return this.wijzig(code, { factuurRegels: regels }); },
    zetMollieApiId(code, id) { return this.wijzig(code, { mollieApiId: id }); },
    maakFactuur({ tenantCode, afspraakId, regels }) {
      const db = lees();
      const afspraak = db.afspraken.find((a) => a.id === afspraakId);
      if (!afspraak || afspraak.factuurId) return null;
      const norm = String(tenantCode).toUpperCase();
      const gemaaktOp = new Date().toISOString();
      const volgnummer = db.facturen.filter((f) => f.tenantCode.toUpperCase() === norm).length + 1;
      const factuur = {
        id: this.genereerCode(),
        nummer: `${gemaaktOp.slice(0, 4)}-${String(volgnummer).padStart(4, '0')}`,
        tenantCode: afspraak.tenantCode,
        afspraakId,
        klantNaam: afspraak.naam,
        klantEmail: afspraak.email,
        regels,
        status: 'Open',
        gemaaktOp,
      };
      db.facturen.push(factuur);
      afspraak.factuurId = factuur.id;
      schrijf(db);
      return factuur;
    },
    facturenVoor(tenantCode) {
      const norm = String(tenantCode).toUpperCase();
      return lees().facturen.filter((f) => f.tenantCode.toUpperCase() === norm);
    },
    vindFactuur(id) { return lees().facturen.find((f) => f.id === id) || null; },
    zetFactuurStatus(id, status) {
      const db = lees();
      const factuur = db.facturen.find((f) => f.id === id);
      if (!factuur) return null;
      factuur.status = status;
      schrijf(db);
      return factuur;
    },
    wisAlles() { localStorage.removeItem(DB_SLEUTEL); },
    laadDemoData() {
      const demoLogo = (letters, kleur) => {
        const c = document.createElement('canvas');
        c.width = 300; c.height = 300;
        const ctx = c.getContext('2d');
        ctx.fillStyle = kleur; ctx.fillRect(0, 0, 300, 300);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 120px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(letters, 150, 160);
        return c.toDataURL('image/png');
      };
      const basis = { emailGeverifieerd: true, telefoonGeverifieerd: true };
      this.voegToe({ ...basis, naam: 'Kattencafé De Spinnende Poes', logo: demoLogo('KP', '#5b4b8a'),
        email: 'info@spinnendepoes.nl', postcode: '1012 JS', huisnummer: '1',
        straat: 'Dam', plaats: 'Amsterdam', kvk: '12345678',
        contactpersoon: 'Mia Muis', telefoon: '0201234567' });
      this.voegToe({ ...basis, naam: 'Dierenpension Vier Voeters', logo: demoLogo('VV', '#1e8e4e'),
        email: 'contact@viervoeters.nl', postcode: '3511 CJ', huisnummer: '10',
        straat: 'Domplein', plaats: 'Utrecht', kvk: '87654321',
        contactpersoon: 'Rex de Groot', telefoon: '0307654321' });
      this.voegToe({ ...basis, naam: 'Poezenboetiek Fluweel', logo: demoLogo('PF', '#e8a33d'),
        email: 'hallo@fluweel.nl', postcode: '2511 CS', huisnummer: '20',
        straat: 'Plein', plaats: "'s-Gravenhage", kvk: '11223344',
        contactpersoon: 'Saartje Snor', telefoon: '0701122334' });
      // Variatie in status zodat filters iets tonen; actieve tenant met agenda
      const tenants = this.alleTenants();
      this.activeerTenant(tenants[1].code);
      this.zetFactuurRegels(tenants[1].code, [
        { id: this.genereerCode(), naam: 'Consult 30 minuten', btw: 'hoog', bedragCent: 4500 },
        { id: this.genereerCode(), naam: 'Verzorgingspakket', btw: 'laag', bedragCent: 1250 },
      ]);
      this.zetMollieApiId(tenants[1].code, 'demo_mollie_123');
      this.zetStatus(tenants[2].code, 'Inactief');
      const actief = this.vindTenant(tenants[1].code);
      const vandaag = new Date().toISOString().slice(0, 10);
      const dagen = Agenda.komendeOpenDagen(actief.openingstijden, vandaag, 14);
      this.maakAfspraak({ tenantCode: actief.code, datum: dagen[1], tijd: '10:00',
        naam: 'Jan Jansen', email: 'jan@voorbeeld.nl', postcode: '1012 JS', huisnummer: '1',
        straat: 'Dam', plaats: 'Amsterdam', extra: 'Eerste kennismaking', telefoon: '0611111111' });
      this.maakAfspraak({ tenantCode: actief.code, datum: dagen[1], tijd: '10:30',
        naam: 'Fatima el Idrissi', email: 'fatima@voorbeeld.nl', postcode: '3511 CJ', huisnummer: '10',
        straat: 'Domplein', plaats: 'Utrecht', extra: '', telefoon: '0622222222' });
    },
  };
})();
