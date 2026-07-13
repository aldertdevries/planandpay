// Openbaar gedeelte: inschrijfformulier, logo-schaling, PDOK-adreslookup.
(() => {
  const form = document.getElementById('inschrijfformulier');
  if (!form) return; // niet op deze pagina

  const el = (id) => document.getElementById(id);
  const zetFout = (id, tekst) => { el('fout-' + id).textContent = tekst || ''; };

  let logoDataUrl = null;   // 300×300 PNG na upload
  let adres = null;         // { straat, plaats } uit PDOK

  // --- Logo: schalen naar exact 300×300 (contain, gecentreerd, wit) ---
  function schaalLogo(bestand) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        const canvas = document.createElement('canvas');
        canvas.width = 300; canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 300, 300);
        const schaal = Math.min(300 / img.width, 300 / img.height);
        const w = img.width * schaal;
        const h = img.height * schaal;
        ctx.drawImage(img, (300 - w) / 2, (300 - h) / 2, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('ongeldig beeldbestand')); };
      img.src = URL.createObjectURL(bestand);
    });
  }

  el('logo').addEventListener('change', async () => {
    zetFout('logo', '');
    logoDataUrl = null;
    const bestand = el('logo').files[0];
    const preview = el('logo-preview');
    preview.classList.add('verborgen');
    if (!bestand) return;
    try {
      logoDataUrl = await schaalLogo(bestand);
      preview.src = logoDataUrl;
      preview.classList.remove('verborgen');
    } catch (e) {
      zetFout('logo', 'Dit bestand kan niet als afbeelding gelezen worden.');
    }
  });

  // --- Adres via PDOK Locatieserver ---
  async function zoekAdres(postcode, huisnummer) {
    const pc = postcode.replace(/\s/g, '').toUpperCase();
    const nr = parseInt(huisnummer, 10);
    const url = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'
      + `?q=postcode:${pc} and huisnummer:${nr}&fq=type:adres&rows=1`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('PDOK niet bereikbaar');
    const data = await resp.json();
    const doc = data.response.docs[0];
    if (!doc) return null;
    return { straat: doc.straatnaam, plaats: doc.woonplaatsnaam };
  }

  async function werkAdresBij() {
    const postcode = el('postcode').value;
    const huisnummer = el('huisnummer').value;
    adres = null;
    el('straat').value = '';
    el('plaats').value = '';
    zetFout('adres', '');
    if (!Validatie.postcode(postcode) || !Validatie.huisnummer(huisnummer)) return;
    try {
      const gevonden = await zoekAdres(postcode, huisnummer);
      if (!gevonden) {
        zetFout('adres', 'Geen adres gevonden bij deze postcode en dit huisnummer.');
        return;
      }
      adres = gevonden;
      el('straat').value = adres.straat;
      el('plaats').value = adres.plaats;
    } catch (e) {
      zetFout('adres', 'Adresservice is niet bereikbaar. Probeer het later opnieuw.');
    }
  }
  el('postcode').addEventListener('blur', werkAdresBij);
  el('huisnummer').addEventListener('blur', werkAdresBij);

  // --- Live veldvalidatie ---
  const veldRegels = {
    naam: [Validatie.naam, 'Vul de naam van uw organisatie in (minimaal 2 tekens).'],
    email: [Validatie.email, 'Vul een geldig e-mailadres in.'],
    postcode: [Validatie.postcode, 'Vul een geldige Nederlandse postcode in (1234 AB).'],
    huisnummer: [Validatie.huisnummer, 'Vul een geldig huisnummer in.'],
    kvk: [Validatie.kvk, 'Een KvK-nummer bestaat uit precies 8 cijfers.'],
    contactpersoon: [Validatie.naam, 'Vul de naam van de contactpersoon in.'],
    telefoon: [Validatie.telefoon, 'Vul een geldig Nederlands telefoonnummer in.'],
  };
  Object.entries(veldRegels).forEach(([id, [regel, melding]]) => {
    el(id).addEventListener('blur', () => {
      zetFout(id, el(id).value && !regel(el(id).value) ? melding : '');
    });
  });

  function valideerAlles() {
    let ok = true;
    Object.entries(veldRegels).forEach(([id, [regel, melding]]) => {
      const geldig = regel(el(id).value);
      zetFout(id, geldig ? '' : melding);
      if (!geldig) ok = false;
    });
    if (!logoDataUrl) { zetFout('logo', 'Upload een logo.'); ok = false; }
    if (!adres) {
      zetFout('adres', 'Het adres kon nog niet bepaald worden. Controleer postcode en huisnummer.');
      ok = false;
    }
    return ok;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!valideerAlles()) return;
    toonVerificatie();
  });

  // --- Verificatie (gesimuleerd): codes worden in de demo op het scherm getoond ---
  let emailCode = '';
  let telefoonCode = '';

  const maakCode = () => String(Math.floor(100000 + Math.random() * 900000));

  function leesFormulier() {
    return {
      naam: el('naam').value.trim(),
      logo: logoDataUrl,
      email: el('email').value.trim(),
      postcode: el('postcode').value.trim().toUpperCase(),
      huisnummer: el('huisnummer').value.trim(),
      straat: adres.straat,
      plaats: adres.plaats,
      kvk: el('kvk').value.trim(),
      contactpersoon: el('contactpersoon').value.trim(),
      telefoon: el('telefoon').value.trim(),
    };
  }

  function toonVerificatie() {
    emailCode = maakCode();
    telefoonCode = maakCode();
    el('demo-codes').innerHTML =
      '<strong>Demo:</strong> in een echte omgeving ontvangt u deze codes per e-mail en sms.<br>'
      + `E-mailcode: <span class="demo-code">${emailCode}</span> &nbsp; `
      + `Sms-code: <span class="demo-code">${telefoonCode}</span>`;
    el('stap-formulier').classList.add('verborgen');
    el('stap-verificatie').classList.remove('verborgen');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('knop-verifieer').addEventListener('click', () => {
    const emailOk = el('email-code').value.trim() === emailCode;
    const telefoonOk = el('telefoon-code').value.trim() === telefoonCode;
    zetFout('email-code', emailOk ? '' : 'Deze code klopt niet.');
    zetFout('telefoon-code', telefoonOk ? '' : 'Deze code klopt niet.');
    if (!emailOk || !telefoonOk) return;

    const tenant = OberPoesDb.voegToe({
      ...leesFormulier(),
      emailGeverifieerd: true,
      telefoonGeverifieerd: true,
    });
    el('tenant-code').textContent = tenant.code;
    el('stap-verificatie').classList.add('verborgen');
    el('stap-klaar').classList.remove('verborgen');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
