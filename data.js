'use strict';

/* Data layer: CSV parsing, ticket normalization, velocity and capacity math. */
const DATA = (() => {

  // ─── Jira HTML export ───────────────────────────────────────────────────────
  /*
   * Parses the table produced by Jira's issue-navigator "Export → HTML"
   * (Server / Data Center). That export is a single <table id="issuetable">
   * whose <th> cells are the field names (e.g. "Summary", "Assignee",
   * "Custom field (Story Points)") and whose <tr class="issuerow"> body rows
   * are the tickets — Key + Summary + fields all on one row.
   *
   * We turn each row into a { header: value } object, so buildTicket /
   * resolveField / velocity all work off the column headers unchanged.
   * Reading cell text from real DOM nodes means multi-line descriptions
   * survive intact instead of being split across file lines.
   */

  // Cell → plain text, preserving line breaks for multi-line fields.
  function cellText(el) {
    const html = el.innerHTML
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n');
    const tmp = el.ownerDocument.createElement('div');
    tmp.innerHTML = html;
    let txt = tmp.textContent || '';
    // Icon-only cells (e.g. the issue-type column) carry their value in alt/title.
    if (!txt.trim() && el.querySelector) {
      const img = el.querySelector('img');
      if (img) txt = img.getAttribute('alt') || img.getAttribute('title') || '';
    }
    return txt
      .replace(/ /g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function parseHTML(text) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const tables = [...doc.querySelectorAll('table')];
    const table =
      doc.querySelector('table#issuetable') ||
      tables.find(t => t.querySelector('td.issuekey, tr[data-issuekey], th')) ||
      tables[0];
    if (!table) return [];

    // Header cells: prefer an explicit <thead>; otherwise the first row.
    let headerCells = [...table.querySelectorAll('thead th, thead td')];
    let bodyRows;
    if (headerCells.length) {
      bodyRows = [...table.querySelectorAll('tbody tr')];
      if (!bodyRows.length) bodyRows = [...table.querySelectorAll('tr')].filter(tr => !tr.querySelector('th'));
    } else {
      const all = [...table.querySelectorAll('tr')];
      headerCells = [...(all[0] ? all[0].children : [])];
      bodyRows = all.slice(1);
    }

    // Build header names, de-duping repeats exactly like the old CSV path.
    const seen = {};
    const headers = headerCells.map(th => {
      const k = cellText(th).trim();
      if (seen[k] === undefined) { seen[k] = 0; return k; }
      return `${k}.${++seen[k]}`;
    });

    const rows = [];
    for (const tr of bodyRows) {
      const cells = [...tr.children];
      if (!cells.length) continue;
      const row = {};
      headers.forEach((h, j) => { if (h) row[h] = cells[j] ? cellText(cells[j]) : ''; });
      // Fall back to the row's data-issuekey when there's no Key column.
      if (!row['Issue key'] && !row['Key'] && tr.getAttribute('data-issuekey')) {
        row['Issue key'] = tr.getAttribute('data-issuekey');
      }
      rows.push(row);
    }
    return rows;
  }

  function resolveField(row, name) {
    if (row[name] !== undefined) return row[name] || '';
    const tries = [
      `Custom field (${name})`,
      `customfield_${name}`,
      name.replace(/ /g, '_'),
      name.toLowerCase(),
    ];
    for (const t of tries) {
      if (row[t] !== undefined) return row[t] || '';
    }
    const lower = name.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().includes(lower)) return row[k] || '';
    }
    return '';
  }

  // "LX 26.3.1" or "[EXT]" blobs → "26.3.1"
  function normSprintName(raw) {
    if (!raw) return '';
    let s = raw.trim();
    const blob = s.match(/\bname=([^,\]]+)/i);
    if (blob) s = blob[1].trim();
    s = s.replace(/\s*\[EXT\](?:\[COMPLETED\])?/gi, '').trim();
    const num = s.match(/(\d{2,4}\.\d+\.\d+)/);
    return num ? num[1] : s;
  }

  function collectSprints(row) {
    const seen = new Set(), out = [];
    for (const [k, v] of Object.entries(row)) {
      if (!/^sprint(\.\d+)?$/i.test(k.trim()) || !v) continue;
      for (const part of String(v).split(/\s*\+\s*/)) {
        const n = normSprintName(part);
        if (n && !seen.has(n)) { seen.add(n); out.push(n); }
      }
    }
    return out;
  }

  const PROJECTS = ['DX', 'LX', 'RC'];

  function bucketProject(key) {
    const m = (key || '').match(/^([A-Z]+)/);
    if (!m) return '';
    return m[1] === 'RCR' ? 'RC' : m[1];
  }

  function parsePoints(row) {
    const raw = resolveField(row, 'Story Points') || resolveField(row, 'Story point estimate') || '0';
    return parseFloat(raw) || 0;
  }

  // Jira renders an empty assignee/resolution as the literal "Unassigned" /
  // "Unresolved" — treat those as blank.
  function normField(val, blankWord) {
    const s = (val || '').trim();
    return s.toLowerCase() === blankWord ? '' : s;
  }

  function buildTicket(row) {
    const key = (resolveField(row, 'Issue key') || resolveField(row, 'Key') || '').trim();
    return {
      key,
      project:     bucketProject(key),
      sprints:     collectSprints(row),
      points:      parsePoints(row),
      resolution:  normField(resolveField(row, 'Resolution'), 'unresolved'),
      status:      resolveField(row, 'Status').trim(),
      assignee:    normField(resolveField(row, 'Assignee'), 'unassigned'),
      summary:     resolveField(row, 'Summary').trim(),
      description: resolveField(row, 'Description').trim(),
      epicName:    (resolveField(row, 'Epic Name') || resolveField(row, 'Epic Link')).trim(),
      issueType:   resolveField(row, 'Issue Type').trim(),
      labels:      resolveField(row, 'Labels').trim(),
    };
  }

  // ─── Resolution ───────────────────────────────────────────────────────────

  const DEFAULT_RESOLUTIONS = ['Done', 'Fixed', 'Resolved', 'Completed', 'Complete'];

  function isDone(ticket, included) {
    const res  = (ticket.resolution || '').toLowerCase();
    const list = included && included.length ? included : DEFAULT_RESOLUTIONS;
    return list.some(r => r.toLowerCase() === res);
  }

  // ─── Sprint quarter parsing ───────────────────────────────────────────────

  // "26.3.1" → { year:26, quarter:3, sprint:1, quarterKey:"26.3" }
  function parseSprint(name) {
    const m = (name || '').match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m) return null;
    return { year: +m[1], quarter: +m[2], sprint: +m[3], quarterKey: `${m[1]}.${m[2]}` };
  }

  // ─── Velocity computation ─────────────────────────────────────────────────

  /*
   * Returns { [assignee]: { sprintPoints: { [sprintNum]: pts }, avg, sprintCount } }
   * Considers only completed tickets (per includedResolutions).
   * If personProject is provided, only counts sprints from that project.
   */
  function computeVelocity(tickets, includedResolutions, personProjectMap) {
    const byPerson = {};   // assignee → { [sprintNum]: pts }

    for (const t of tickets) {
      if (!t.assignee || !t.sprints.length) continue;
      if (!isDone(t, includedResolutions)) continue;
      if (t.points <= 0) continue;

      const name        = t.assignee;
      const personProj  = personProjectMap && personProjectMap[name];

      for (const s of t.sprints) {
        const sp = parseSprint(s);
        if (!sp) continue;

        // Filter sprints by person's project if set
        if (personProj && t.project && t.project !== personProj) continue;

        if (!byPerson[name]) byPerson[name] = {};
        // Use full sprint key so different quarters are separate
        const sKey = `${sp.year}.${sp.quarter}.${sp.sprint}`;
        byPerson[name][sKey] = (byPerson[name][sKey] || 0) + t.points;
      }
    }

    const result = {};
    for (const [name, sprintMap] of Object.entries(byPerson)) {
      const vals = Object.values(sprintMap);
      result[name] = {
        sprintPoints: sprintMap,
        avg:          vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
        sprintCount:  vals.length,
      };
    }
    return result;
  }

  // ─── Capacity computation ─────────────────────────────────────────────────

  /*
   * person: { name, sid, type, goalPoints }
   * sprintStart/End: ISO dates
   * leaveData: [{ sid, date, halfDay }]
   * velocity: output of computeVelocity
   *
   * Returns:
   *   totalWorkDays, leaveDays, availDays,
   *   baseVelocity, hasHistory, pointsPerDay, adjustedCapacity,
   *   wfhBudgetDays, wfhBudgetPts, wfhWeeks: [ { weekKey, budgetDays, budgetPts } ]
   */
  function computeCapacity(person, sprintStart, sprintEnd, leaveData, velocity) {
    const totalWorkDays = HOLIDAYS.workDays(sprintStart, sprintEnd);

    // Leave days this person has inside the sprint
    const sid      = (person.sid || '').toLowerCase();
    const myLeave  = leaveData.filter(l => l.sid === sid && l.date >= sprintStart && l.date <= sprintEnd);
    const leaveDays = myLeave.reduce((s, l) => s + (l.halfDay ? 0.5 : 1), 0);
    const availDays = Math.max(0, totalWorkDays - leaveDays);

    // Base velocity
    const hist = velocity && velocity[person.name];
    let baseVelocity, hasHistory;
    if (hist && hist.sprintCount >= 2) {
      baseVelocity = hist.avg;
      hasHistory   = true;
    } else {
      baseVelocity = person.goalPoints || 0;
      hasHistory   = false;
    }

    const pointsPerDay      = totalWorkDays > 0 ? baseVelocity / totalWorkDays : 0;
    const adjustedCapacity  = Math.round(pointsPerDay * availDays);

    // WFH budget (contractor: ≤2 days/week per calendar week that has ≥1 work day in sprint)
    const weeks = HOLIDAYS.sprintWeeks(sprintStart, sprintEnd);
    let wfhBudgetDays = 0;
    const wfhWeeks = [];
    if (person.type === 'contractor') {
      for (const wk of weeks) {
        // Work days in THIS sprint that fall in this week
        const wkEnd = new Date(wk + 'T00:00:00');
        wkEnd.setDate(wkEnd.getDate() + 4);           // Friday of that week
        const wkEndIso = wkEnd.toISOString().slice(0, 10);
        const effectiveEnd = wkEndIso < sprintEnd ? wkEndIso : sprintEnd;
        const effectiveStart = wk > sprintStart ? wk : sprintStart;
        const daysInWeek = HOLIDAYS.workDays(effectiveStart, effectiveEnd);
        const wkBudgetDays = Math.min(2, daysInWeek);
        const wkBudgetPts  = Math.round(pointsPerDay * wkBudgetDays);
        wfhBudgetDays += wkBudgetDays;
        wfhWeeks.push({ weekKey: wk, budgetDays: wkBudgetDays, budgetPts: wkBudgetPts });
      }
    }
    const wfhBudgetPts = Math.round(pointsPerDay * wfhBudgetDays);

    return {
      totalWorkDays,
      leaveDays,
      availDays,
      baseVelocity,
      hasHistory,
      pointsPerDay,
      adjustedCapacity,
      wfhBudgetDays,
      wfhBudgetPts,
      wfhWeeks,
      leaveDates: myLeave.map(l => l.date),
    };
  }

  // ─── Sprint schedule generation ───────────────────────────────────────────

  // Given a sprint start date and duration in days, generate N sprint records
  function generateSprints(startIso, durationDays, count) {
    const sprints = [];
    let cursor = new Date(startIso + 'T00:00:00');
    for (let i = 0; i < count; i++) {
      const s   = cursor.toISOString().slice(0, 10);
      const end = new Date(cursor);
      end.setDate(end.getDate() + durationDays - 1);
      const e   = end.toISOString().slice(0, 10);
      const holidays = HOLIDAYS.inRange(s, e);
      sprints.push({
        idx:          i,
        start:        s,
        end:          e,
        workDays:     HOLIDAYS.workDays(s, e),
        holidays,
      });
      cursor = new Date(end);
      cursor.setDate(cursor.getDate() + 1);   // next sprint starts day after
    }
    return sprints;
  }

  return {
    parseHTML, resolveField, buildTicket,
    isDone, parseSprint, normSprintName,
    computeVelocity, computeCapacity,
    generateSprints,
    PROJECTS, DEFAULT_RESOLUTIONS,
  };
})();
