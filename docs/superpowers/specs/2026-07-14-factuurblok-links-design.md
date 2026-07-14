# KassaGenda — factuurblok links onder logo (ontwerp)

Datum: 2026-07-14
Status: door gebruiker gespecificeerd

- Het factuurblok (kop "FACTUUR"/"CREDITFACTUUR" + gegevens) staat links
  ónder het logo-/afzenderblok in plaats van rechtsboven.
- De regels **Vervaldatum** en **Status** vervallen; blijven over:
  Factuurnummer, Factuurdatum, Betalingskenmerk.
- In het blok **Factuur aan** staat onder de klantnaam het adres van de
  klant (straat + huisnummer, postcode + plaats, uit de gekoppelde
  afspraak; leeg indien de afspraak niet meer bestaat).

Bestanden: `factuur.html` (layout + CSS), `js/factuur.js` (vervaldatum/
status weg, klantadres vullen).
