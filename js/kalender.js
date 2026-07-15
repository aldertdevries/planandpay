// Pure agenda-uitwisseling: ics-bestanden voor afspraakbevestigingen.
const Kalender = (() => {
  const twee = (n) => String(n).padStart(2, '0');
  const stempel = (d) =>
    `${d.getFullYear()}${twee(d.getMonth() + 1)}${twee(d.getDate())}T${twee(d.getHours())}${twee(d.getMinutes())}00`;
  return {
    ics({ titel, locatie, omschrijving, datum, tijd, duurMinuten, uid }) {
      const start = new Date(`${datum}T${tijd}:00`);
      const eind = new Date(start.getTime() + duurMinuten * 60000);
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//PlanAndPay//NL',
        'BEGIN:VEVENT',
        `UID:${uid}@planandpay`,
        `DTSTART:${stempel(start)}`,
        `DTEND:${stempel(eind)}`,
        `SUMMARY:${titel}`,
        `LOCATION:${locatie}`,
        `DESCRIPTION:${omschrijving}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
    },
    icsDataUrl(inhoud) {
      return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(inhoud);
    },
  };
})();
