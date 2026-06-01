'use strict';

/* Minimal iCalendar parser targeting Confluence leave calendars.
 * Extracts VEVENT blocks, reads DTSTART/DTEND (DATE and DATETIME),
 * and pulls the SID from the ORGANIZER or first ATTENDEE mailto.
 */
const ICAL_PARSER = (() => {

  function unfold(text) {
    // RFC 5545 line folding: CRLF + whitespace → nothing
    return text.replace(/\r?\n[ \t]/g, '');
  }

  function parseISODate(val) {
    // DATE: 20260605  →  2026-06-05
    // DATETIME: 20260605T080000Z  →  2026-06-05
    const m = val.match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }

  function extractSID(str) {
    // "mailto:jsmith@agency.gov" or "CN=Jane Smith:mailto:jsmith@agency.gov"
    const m = str.match(/mailto:([^@\s]+)@/i);
    return m ? m[1].toLowerCase() : null;
  }

  // Return the value portion of a property line, stripping param segments
  function propValue(line) {
    return line.replace(/^[^:]+:/, '').trim();
  }

  function parse(text) {
    const src    = unfold(text);
    const events = [];
    const re     = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
    let m;

    while ((m = re.exec(src)) !== null) {
      const block = m[1];

      const getLine = key => {
        const rx = new RegExp(`^${key}(?:;[^:]*)?:[^\\r\\n]*`, 'im');
        const lm = block.match(rx);
        return lm ? lm[0] : '';
      };

      const dtStartLine = getLine('DTSTART');
      const dtEndLine   = getLine('DTEND');
      const dtStart     = parseISODate(propValue(dtStartLine));
      if (!dtStart) continue;

      // All-day events have DTEND exclusive → subtract one day
      let dtEnd = parseISODate(propValue(dtEndLine)) || dtStart;
      const isAllDay = dtEndLine && !dtEndLine.includes('T');
      if (isAllDay && dtEnd > dtStart) {
        const d = new Date(dtEnd + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        dtEnd = d.toISOString().slice(0, 10);
      }

      // SID from ORGANIZER, then first ATTENDEE
      let sid = null;
      const orgLine = block.match(/^ORGANIZER(?:;[^:]*)?:[^\r\n]*/im);
      if (orgLine) sid = extractSID(orgLine[0]);
      if (!sid) {
        const attLine = block.match(/^ATTENDEE(?:;[^:]*)?:[^\r\n]*/im);
        if (attLine) sid = extractSID(attLine[0]);
      }

      const summary = propValue(getLine('SUMMARY'));

      events.push({ dtStart, dtEnd, sid, summary });
    }

    return events;
  }

  // Expand events to individual leave-date records, skipping weekends
  function toLeaveDates(events, halfDay = false) {
    const out = [];
    for (const ev of events) {
      if (!ev.sid) continue;
      const end = new Date(ev.dtEnd + 'T00:00:00');
      const cur = new Date(ev.dtStart + 'T00:00:00');
      while (cur <= end) {
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6) {
          out.push({
            sid:     ev.sid,
            date:    cur.toISOString().slice(0, 10),
            halfDay,
            summary: ev.summary,
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    return out;
  }

  return { parse, toLeaveDates };
})();
