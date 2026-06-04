/* ============================================================================
   Sprint Planner — sample data + calculation helpers (prototype)
   All values are fabricated. Exposed on window.VP for the React app.
   ========================================================================== */
(function () {
  "use strict";

  // --- Projects -------------------------------------------------------------
  const PROJECTS = [
    { id: "DX", name: "DataXplorer", key: "DX" },
    { id: "LX", name: "LinkXplorer", key: "LX" },
    { id: "RC", name: "ROLLERCOASTER", key: "RCR" },
  ];

  // map a ticket key prefix -> project id
  function projectForKey(key) {
    if (!key) return null;
    if (key.startsWith("RCR")) return "RC";
    if (key.startsWith("DX")) return "DX";
    if (key.startsWith("LX")) return "LX";
    return null;
  }

  // --- Sprints (locked) -----------------------------------------------------
  // Dates are ISO (local). "current" = the sprint containing 2026-06-01.
  const SPRINTS = [
    { id: "s1", name: "26.2.3", start: "2026-04-06", end: "2026-04-17" },
    { id: "s2", name: "26.2.4", start: "2026-04-20", end: "2026-05-01" },
    { id: "s3", name: "26.2.5", start: "2026-05-04", end: "2026-05-15" },
    { id: "s4", name: "26.2.6", start: "2026-05-18", end: "2026-05-29" },
    { id: "s5", name: "26.2.7", start: "2026-06-01", end: "2026-06-12" }, // current
    { id: "s6", name: "26.3.1", start: "2026-06-15", end: "2026-06-26" },
    { id: "s7", name: "26.3.2", start: "2026-06-29", end: "2026-07-10" },
  ];
  const CURRENT_SPRINT_IDX = 4;

  // --- People ---------------------------------------------------------------
  // { id, name, sid, type: "gov"|"contractor", project, goal, history:Number[] }
  // history = points landed in recent past sprints (drives the velocity average).
  // Add people in the Team tab; seed their history via the Jira HTML import.
  const PEOPLE = [];

  // --- Leave ----------------------------------------------------------------
  // { sid, date:ISO, frac: 1 (full) | 0.5 (half) } — import via Settings → iCal.
  const LEAVE = [];

  // --- Tickets --------------------------------------------------------------
  // { id, key, epic, summary, points, resolution, wfh, assignee, sprints:[], desc }
  // Status is derived:
  //   resolution set + past sprint  -> historical (feeds velocity)
  //   no resolution, current sprint -> in this sprint
  //   no resolution, no sprint      -> backlog (assignment candidate)
  const TICKETS = [];

  const DONE_RESOLUTIONS = ["Done", "Fixed", "Resolved", "Completed", "Complete"];

  // Jira custom-field IDs for the columns the board parser needs. Match the
  // values inside `class="...customfield_NNNNN..."` on your Jira HTML export.
  // (Hover a column header in Jira → view source → find the `customfield_…`
  // class on the <th>.) Text-based detection ("Story Points", "Sprint", "Epic")
  // is used as a fallback when a class match isn't found.
  const JIRA_CUSTOM_FIELDS = {
    epic:   "customfield_11840",
    points: "customfield_10023",
    sprint: "customfield_11240",
  };

  // ========================================================================
  //  Calculation helpers
  // ========================================================================

  // ---- dates ----
  function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function fmtISO(dt) { return dt.toISOString().slice(0, 10); }
  function eachDay(startISO, endISO) {
    const out = []; const d = parseISO(startISO); const end = parseISO(endISO);
    while (d <= end) { out.push(fmtISO(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function isWeekend(iso) { const g = parseISO(iso).getDay(); return g === 0 || g === 6; }

  // ---- US federal holidays (observed) for the years we care about ----
  // nth weekday helper
  function nthWeekday(year, month, weekday, n) {
    const first = new Date(year, month, 1);
    let day = 1 + ((7 + weekday - first.getDay()) % 7) + (n - 1) * 7;
    return new Date(year, month, day);
  }
  function lastWeekday(year, month, weekday) {
    const last = new Date(year, month + 1, 0);
    let day = last.getDate() - ((7 + last.getDay() - weekday) % 7);
    return new Date(year, month, day);
  }
  function observed(dt) {
    const g = dt.getDay();
    if (g === 6) return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() - 1); // Sat -> Fri
    if (g === 0) return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1); // Sun -> Mon
    return dt;
  }
  function federalHolidays(year) {
    const list = [
      new Date(year, 0, 1),                 // New Year's
      nthWeekday(year, 0, 1, 3),            // MLK (3rd Mon Jan)
      nthWeekday(year, 1, 1, 3),            // Presidents (3rd Mon Feb)
      lastWeekday(year, 4, 1),             // Memorial (last Mon May)
      new Date(year, 5, 19),               // Juneteenth
      new Date(year, 6, 4),                // Independence
      nthWeekday(year, 8, 1, 1),           // Labor (1st Mon Sep)
      nthWeekday(year, 9, 1, 2),           // Columbus (2nd Mon Oct)
      new Date(year, 10, 11),              // Veterans
      nthWeekday(year, 10, 4, 4),          // Thanksgiving (4th Thu Nov)
      new Date(year, 11, 25),              // Christmas
    ];
    return list.map(observed).map(fmtISO);
  }
  function holidaysInRange(startISO, endISO) {
    if (!startISO || !endISO) return [];
    const y0 = parseISO(startISO).getFullYear(), y1 = parseISO(endISO).getFullYear();
    let hs = [];
    for (let y = y0; y <= y1; y++) hs = hs.concat(federalHolidays(y));
    const set = new Set(hs);
    return eachDay(startISO, endISO).filter((d) => set.has(d) && !isWeekend(d));
  }

  // ---- undated sprints: a planning bucket with no committed timeframe ----
  function isUndated(sprint) { return !sprint || !sprint.start || !sprint.end; }

  // ---- work days in a sprint ----
  function sprintWorkDays(sprint) {
    if (isUndated(sprint)) return [];
    const hol = new Set(holidaysInRange(sprint.start, sprint.end));
    return eachDay(sprint.start, sprint.end).filter((d) => !isWeekend(d) && !hol.has(d));
  }

  // ---- velocity ----
  function velocity(person) {
    const h = person.history || [];
    const count = h.length;
    const avg = count ? h.reduce((a, b) => a + b, 0) / count : 0;
    return { perSprint: h, average: avg, count };
  }
  function baseVelocity(person) {
    const v = velocity(person);
    if (v.count >= 2) return { value: v.average, isGoal: false };
    return { value: person.goal || 0, isGoal: true };
  }

  // Continuously derive each person's velocity history from completed tickets:
  // points on done tickets (resolution in `doneResolutions`) summed per past,
  // dated sprint — i.e. sprints before the current one. Returns
  // { [personId]: number[] } ordered chronologically; one entry per such sprint
  // the person landed work in. This replaces the static seed at runtime whenever
  // the board has completed work; otherwise the person's stored history is used.
  function deriveHistory(tickets, doneResolutions, sprints, currentIdx) {
    const done = new Set((doneResolutions || []).map((r) => r.toLowerCase()));
    const idxByName = {};
    (sprints || []).forEach((s, i) => { idxByName[s.name] = i; });
    const acc = {}; // personId -> { sprintName: points }
    for (const t of tickets || []) {
      if (!t.assignee) continue;
      if (!t.resolution || !done.has(t.resolution.toLowerCase())) continue;
      const pts = Number(t.points) || 0;
      if (pts <= 0) continue;
      for (const sn of (t.sprints || [])) {
        const i = idxByName[sn];
        if (i === undefined || i >= currentIdx) continue; // only past, dated sprints
        (acc[t.assignee] = acc[t.assignee] || {});
        acc[t.assignee][sn] = (acc[t.assignee][sn] || 0) + pts;
      }
    }
    const out = {};
    for (const [pid, bySprint] of Object.entries(acc)) {
      const names = Object.keys(bySprint).sort((a, b) => idxByName[a] - idxByName[b]);
      out[pid] = names.map((n) => bySprint[n]);
    }
    return out;
  }

  // ---- leave for a person within a sprint window ----
  function leaveDaysInSprint(sid, sprint) {
    const work = new Set(sprintWorkDays(sprint));
    return LEAVE.filter((l) => l.sid === sid && work.has(l.date))
      .reduce((sum, l) => sum + (l.frac || 1), 0);
  }
  function leaveRecords(sid, sprint) {
    const work = new Set(sprintWorkDays(sprint));
    return LEAVE.filter((l) => l.sid === sid && work.has(l.date));
  }

  // ---- contractor WFH budget: <=2 days per calendar week with >=1 work day --
  function wfhBudget(person, sprint) {
    if (person.type !== "contractor") return null;
    const work = sprintWorkDays(sprint);
    // group work days by ISO week (year-week)
    const weeks = {};
    work.forEach((iso) => {
      const dt = parseISO(iso);
      const onejan = new Date(dt.getFullYear(), 0, 1);
      const wk = dt.getFullYear() + "-" + Math.ceil(((dt - onejan) / 86400000 + onejan.getDay() + 1) / 7);
      weeks[wk] = (weeks[wk] || 0) + 1;
    });
    const numWeeks = Object.keys(weeks).length;
    const days = numWeeks * 2; // up to 2/week
    return { weeks: numWeeks, days };
  }

  // ---- full capacity for a person in a sprint ----
  function capacity(person, sprint) {
    // Undated sprint: no calendar to subtract from, so capacity is the person's
    // full base velocity (history average, or goal if too little history).
    if (isUndated(sprint)) {
      const base = baseVelocity(person);
      return {
        undated: true,
        workDays: 0, leave: 0, available: 0,
        baseVelocity: base.value, isGoal: base.isGoal,
        pointsPerDay: 0, adjusted: Math.round(base.value),
        wfh: null, wfhPoints: null,
      };
    }
    const workDays = sprintWorkDays(sprint).length;
    const leave = leaveDaysInSprint(person.sid, sprint);
    const available = Math.max(0, workDays - leave);
    const base = baseVelocity(person);
    const pointsPerDay = workDays ? base.value / workDays : 0;
    const adjusted = Math.round(pointsPerDay * available);
    const wfh = wfhBudget(person, sprint);
    return {
      workDays, leave, available,
      baseVelocity: base.value, isGoal: base.isGoal,
      pointsPerDay, adjusted,
      wfh, // {weeks, days} or null
      wfhPoints: wfh ? Math.round(pointsPerDay * wfh.days) : null,
    };
  }

  window.VP = {
    PROJECTS, SPRINTS, CURRENT_SPRINT_IDX, PEOPLE, TICKETS, LEAVE, DONE_RESOLUTIONS, JIRA_CUSTOM_FIELDS,
    projectForKey,
    // calc
    isUndated,
    sprintWorkDays, holidaysInRange, velocity, baseVelocity, deriveHistory,
    leaveDaysInSprint, leaveRecords, wfhBudget, capacity,
    parseISO, fmtISO, eachDay,
  };
})();
