'use strict';

/* US Federal Holiday rules.
 * Observed dates: Saturday → Friday, Sunday → Monday.
 */
const HOLIDAYS = (() => {
  const iso = d => d.toISOString().slice(0, 10);

  function observed(year, month, day) {
    const d   = new Date(year, month, day);
    const dow = d.getDay();
    if (dow === 6) return new Date(year, month, day - 1);
    if (dow === 0) return new Date(year, month, day + 1);
    return d;
  }

  // nth weekday of a month; nth = -1 means last
  function nthWeekday(year, month, weekday, nth) {
    if (nth > 0) {
      const d     = new Date(year, month, 1);
      const first = (weekday - d.getDay() + 7) % 7;
      return new Date(year, month, 1 + first + (nth - 1) * 7);
    }
    const last = new Date(year, month + 1, 0);
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month + 1, 0 - diff);
  }

  function forYear(year) {
    return [
      { name: "New Year's Day",     date: observed(year, 0, 1) },
      { name: 'MLK Jr. Day',        date: nthWeekday(year, 0, 1, 3)  },
      { name: "Presidents' Day",    date: nthWeekday(year, 1, 1, 3)  },
      { name: 'Memorial Day',       date: nthWeekday(year, 4, 1, -1) },
      { name: 'Juneteenth',         date: observed(year, 5, 19)       },
      { name: 'Independence Day',   date: observed(year, 6, 4)        },
      { name: 'Labor Day',          date: nthWeekday(year, 8, 1, 1)  },
      { name: 'Columbus Day',       date: nthWeekday(year, 9, 1, 2)  },
      { name: 'Veterans Day',       date: observed(year, 10, 11)      },
      { name: 'Thanksgiving',       date: nthWeekday(year, 10, 4, 4) },
      { name: 'Christmas Day',      date: observed(year, 11, 25)      },
    ].map(h => ({ ...h, iso: iso(h.date) }));
  }

  const _cache = {};
  function get(year) {
    return _cache[year] || (_cache[year] = forYear(year));
  }

  function isHoliday(isoDate) {
    const year = +isoDate.slice(0, 4);
    return get(year).some(h => h.iso === isoDate);
  }

  function holidayName(isoDate) {
    const year = +isoDate.slice(0, 4);
    return (get(year).find(h => h.iso === isoDate) || {}).name || null;
  }

  // Business days between two ISO dates (inclusive), excluding weekends + holidays
  function workDays(startIso, endIso) {
    const end = new Date(endIso + 'T00:00:00');
    let count = 0;
    const cur = new Date(startIso + 'T00:00:00');
    while (cur <= end) {
      const dow = cur.getDay();
      const d   = cur.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !isHoliday(d)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  // Return ISO strings of holidays between two dates (inclusive)
  function inRange(startIso, endIso) {
    const years = new Set();
    for (let y = +startIso.slice(0, 4); y <= +endIso.slice(0, 4); y++) years.add(y);
    return [...years]
      .flatMap(y => get(y))
      .filter(h => h.iso >= startIso && h.iso <= endIso);
  }

  // Monday-key of the calendar week containing an ISO date
  function weekKey(isoDate) {
    const d   = new Date(isoDate + 'T00:00:00');
    const dow = d.getDay();                          // 0=Sun
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((dow + 6) % 7));     // roll back to Monday
    return mon.toISOString().slice(0, 10);
  }

  // Calendar weeks (Mon keys) that overlap a sprint range (only weeks with ≥1 work day)
  function sprintWeeks(startIso, endIso) {
    const weeks = new Set();
    const end   = new Date(endIso + 'T00:00:00');
    const cur   = new Date(startIso + 'T00:00:00');
    while (cur <= end) {
      const dow = cur.getDay();
      const d   = cur.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !isHoliday(d)) weeks.add(weekKey(d));
      cur.setDate(cur.getDate() + 1);
    }
    return [...weeks].sort();
  }

  return { forYear, get, isHoliday, holidayName, workDays, inRange, sprintWeeks, weekKey };
})();
