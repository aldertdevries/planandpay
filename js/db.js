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
        if (!Array.isArray(data.klanten)) data.klanten = [];
        return data;
      }
    } catch (e) { /* corrupte data → verse database */ }
    return { tenants: [], afspraken: [], facturen: [], klanten: [] };
  }
  function schrijf(db) {
    localStorage.setItem(DB_SLEUTEL, JSON.stringify(db));
  }
  function zoek(db, code) {
    const norm = String(code).toUpperCase();
    return db.tenants.find((t) => t.code.toUpperCase() === norm) || null;
  }
  function volgendNummer(db, tenantCode) {
    const norm = String(tenantCode).toUpperCase();
    const tenant = zoek(db, norm);
    const reeks = (tenant && tenant.factuurReeks) || {
      prefix: new Date().toISOString().slice(0, 4),
      volgende: db.facturen.filter((f) => f.tenantCode.toUpperCase() === norm).length + 1,
    };
    const nummer = `${reeks.prefix}-${String(reeks.volgende).padStart(4, '0')}`;
    if (tenant) tenant.factuurReeks = { prefix: reeks.prefix, volgende: reeks.volgende + 1 };
    return nummer;
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
        capaciteit: bestaand.capaciteit || 1,
      });
    },
    alleAfspraken() { return lees().afspraken; },
    afsprakenVoor(tenantCode) {
      const norm = String(tenantCode).toUpperCase();
      return lees().afspraken.filter((a) => a.tenantCode.toUpperCase() === norm);
    },
    handmatigeKlantenVoor(tenantCode) {
      const norm = String(tenantCode).toUpperCase();
      return lees().klanten.filter((k) => k.tenantCode.toUpperCase() === norm);
    },
    voegKlantToe({ tenantCode, naam, email, telefoon, straat, huisnummer, postcode, plaats }) {
      const db = lees();
      const norm = String(tenantCode).toUpperCase();
      const emailNorm = String(email).trim().toLowerCase();
      let klant = db.klanten.find((k) => k.tenantCode.toUpperCase() === norm
        && k.email.trim().toLowerCase() === emailNorm);
      if (!klant) {
        klant = { id: this.genereerCode(), tenantCode, email, aangemaaktOp: new Date().toISOString() };
        db.klanten.push(klant);
      }
      Object.assign(klant, { naam, email, telefoon, straat, huisnummer, postcode, plaats });
      schrijf(db);
      return klant;
    },
    vindKlant(id) { return lees().klanten.find((k) => k.id === id) || null; },
    zoekKlantOpContact(tenantCode, invoer) {
      const tekst = String(invoer).trim();
      if (!tekst) return null;
      const klanten = this.klantenVoor(tenantCode);
      if (tekst.includes('@')) {
        const email = tekst.toLowerCase();
        return klanten.find((k) => (k.email || '').trim().toLowerCase() === email) || null;
      }
      const cijfers = tekst.replace(/\D/g, '');
      if (!cijfers) return null;
      return klanten.find((k) => String(k.telefoon || '').replace(/\D/g, '') === cijfers) || null;
    },
    klantenVoor(tenantCode) {
      const perEmail = {};
      // 1. Handmatig toegevoegde klanten als basis (aantal 0, geen datum)
      this.handmatigeKlantenVoor(tenantCode).forEach((k) => {
        const email = k.email.trim().toLowerCase();
        perEmail[email] = { email, aantal: 0, laatste: '',
          naam: k.naam, telefoon: k.telefoon, straat: k.straat,
          huisnummer: k.huisnummer, postcode: k.postcode, plaats: k.plaats };
      });
      // 2. Afspraken (oud → nieuw): laatste gegevens winnen, aantal telt op
      this.afsprakenVoor(tenantCode)
        .filter((a) => a.email && a.email.trim())
        .slice()
        .sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd))
        .forEach((a) => {
          const email = a.email.trim().toLowerCase();
          const k = perEmail[email] || (perEmail[email] = { email, aantal: 0, laatste: '' });
          k.naam = a.naam; k.telefoon = a.telefoon;
          k.straat = a.straat; k.huisnummer = a.huisnummer;
          k.postcode = a.postcode; k.plaats = a.plaats;
          k.laatste = a.datum;
          k.aantal += 1;
        });
      return Object.values(perEmail).sort((a, b) => (b.laatste || '').localeCompare(a.laatste || ''));
    },
    maakAfspraak(velden) {
      const db = lees();
      const norm = String(velden.tenantCode).toUpperCase();
      const tenant = zoek(db, norm);
      const capaciteit = (tenant && tenant.capaciteit) || 1;
      const aantal = db.afspraken.filter((a) => a.tenantCode.toUpperCase() === norm
        && a.datum === velden.datum && a.tijd === velden.tijd).length;
      if (aantal >= capaciteit) return null;
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
    zetOpeningstijden(code, openingstijden, slotDuur, capaciteit) {
      const velden = { openingstijden, slotDuur };
      if (capaciteit !== undefined) velden.capaciteit = capaciteit;
      return this.wijzig(code, velden);
    },
    verzetAfspraak(id, datum, tijd) {
      const db = lees();
      const afspraak = db.afspraken.find((a) => a.id === id);
      if (!afspraak || afspraak.factuurId) return null;
      const norm = afspraak.tenantCode.toUpperCase();
      const tenant = zoek(db, norm);
      const capaciteit = (tenant && tenant.capaciteit) || 1;
      const aantal = db.afspraken.filter((a) => a.id !== id
        && a.tenantCode.toUpperCase() === norm && a.datum === datum && a.tijd === tijd).length;
      if (aantal >= capaciteit) return null;
      afspraak.datum = datum;
      afspraak.tijd = tijd;
      schrijf(db);
      return afspraak;
    },
    zetBlokkades(code, blokkades) { return this.wijzig(code, { blokkades }); },
    zetFactuurRegels(code, regels) { return this.wijzig(code, { factuurRegels: regels }); },
    zetMollieApiId(code, id) { return this.wijzig(code, { mollieApiId: id }); },
    zetStandaardBetaalwijze(code, wijze) {
      const w = ['mollie', 'pin', 'contant'].includes(wijze) ? wijze : 'mollie';
      return this.wijzig(code, { standaardBetaalwijze: w });
    },
    maakFactuur({ tenantCode, afspraakId, regels, betaalwijze }) {
      const db = lees();
      const afspraak = db.afspraken.find((a) => a.id === afspraakId);
      if (!afspraak || afspraak.factuurId) return null;
      const wijze = ['mollie', 'pin', 'contant'].includes(betaalwijze) ? betaalwijze : 'mollie';
      const gemaaktOp = new Date().toISOString();
      const factuur = {
        id: this.genereerCode(),
        nummer: volgendNummer(db, afspraak.tenantCode),
        tenantCode: afspraak.tenantCode,
        afspraakId,
        klantNaam: afspraak.naam,
        klantEmail: afspraak.email,
        regels,
        betaalwijze: wijze,
        status: wijze === 'mollie' ? 'Open' : 'Betaald',
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
    markeerBetaald(id, betaalwijze) {
      if (!['pin', 'contant'].includes(betaalwijze)) return null;
      const db = lees();
      const factuur = db.facturen.find((f) => f.id === id);
      if (!factuur || factuur.status !== 'Open') return null;
      factuur.status = 'Betaald';
      factuur.betaalwijze = betaalwijze;
      schrijf(db);
      return factuur;
    },
    zetFactuurReeks(code, prefix, volgende) {
      return this.wijzig(code, { factuurReeks: { prefix, volgende } });
    },
    zetBerichten(code, berichten) { return this.wijzig(code, { berichten }); },
    zetFactuurVoettekst(code, tekst) { return this.wijzig(code, { factuurVoettekst: tekst }); },
    crediteerFactuur(id) {
      const db = lees();
      const origineel = db.facturen.find((f) => f.id === id);
      if (!origineel || !['Open', 'Betaald'].includes(origineel.status)) return null;
      const credit = {
        id: this.genereerCode(),
        nummer: volgendNummer(db, origineel.tenantCode),
        tenantCode: origineel.tenantCode,
        afspraakId: origineel.afspraakId,
        klantNaam: origineel.klantNaam,
        klantEmail: origineel.klantEmail,
        regels: origineel.regels.map((r) => ({ ...r, bedragCent: -r.bedragCent })),
        betaalwijze: origineel.betaalwijze || 'mollie',
        status: 'Credit',
        creditVoor: origineel.nummer,
        gemaaktOp: new Date().toISOString(),
      };
      origineel.status = 'Gecrediteerd';
      const afspraak = db.afspraken.find((a) => a.id === origineel.afspraakId);
      if (afspraak) delete afspraak.factuurId;
      db.facturen.push(credit);
      schrijf(db);
      return credit;
    },
    laatVervallen(id) {
      const db = lees();
      const factuur = db.facturen.find((f) => f.id === id);
      if (!factuur || factuur.status !== 'Open') return null;
      factuur.status = 'Vervallen';
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
