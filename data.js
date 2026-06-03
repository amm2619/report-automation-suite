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
  // history = points landed in recent past sprints (drives velocity average)
  const PEOPLE = [
    // DX
    { id: "p1", name: "Maya Okafor",    sid: "mokafor", type: "gov",        project: "DX", goal: 18, history: [16, 19, 17, 20] },
    { id: "p2", name: "Daniel Reyes",   sid: "dreyes",  type: "contractor", project: "DX", goal: 14, history: [12, 15, 13] },
    { id: "p3", name: "Priya Nair",     sid: "pnair",   type: "contractor", project: "DX", goal: 16, history: [15, 18, 14, 16] },
    { id: "p4", name: "Tom Becker",     sid: "tbecker", type: "gov",        project: "DX", goal: 10, history: [9, 11] },
    // LX
    { id: "p5", name: "Sofia Lindqvist",sid: "slindqv", type: "contractor", project: "LX", goal: 20, history: [22, 19, 21, 20] },
    { id: "p6", name: "Owen Wright",    sid: "owright", type: "gov",        project: "LX", goal: 12, history: [11, 13, 12] },
    { id: "p7", name: "Hannah Cole",    sid: "hcole",   type: "contractor", project: "LX", goal: 15, history: [14, 16] },
    { id: "p8", name: "Raj Patel",      sid: "rpatel",  type: "contractor", project: "LX", goal: 17, history: [18, 16, 17, 19] },
    // RC
    { id: "p9", name: "Lena Voss",      sid: "lvoss",   type: "gov",        project: "RC", goal: 13, history: [12, 14, 13, 15] },
    { id: "p10",name: "Marcus Hale",    sid: "mhale",   type: "contractor", project: "RC", goal: 19, history: [20, 18, 21] },
    { id: "p11",name: "Elena Duarte",   sid: "eduarte", type: "contractor", project: "RC", goal: 16, history: [15, 17, 16] },
    { id: "p12",name: "Kim Larsson",    sid: "klarsson",type: "contractor", project: "RC", goal: 8,  history: [] }, // new -> goal flagged
  ];

  // --- Leave (iCal-derived; one record per leave day, weekends already skipped)
  // person sid + ISO date + fraction (1 full / 0.5 half)
  const LEAVE = [
    { sid: "dreyes",  date: "2026-06-03", frac: 1 },
    { sid: "dreyes",  date: "2026-06-04", frac: 1 },
    { sid: "pnair",   date: "2026-06-10", frac: 0.5 },
    { sid: "slindqv", date: "2026-06-08", frac: 1 },
    { sid: "slindqv", date: "2026-06-09", frac: 1 },
    { sid: "slindqv", date: "2026-06-10", frac: 1 },
    { sid: "hcole",   date: "2026-06-11", frac: 0.5 },
    { sid: "mhale",   date: "2026-06-01", frac: 1 },
    { sid: "lvoss",   date: "2026-06-12", frac: 1 },
  ];

  // --- Tickets --------------------------------------------------------------
  // status notes:
  //   resolution set + sprints in past  -> historical (feeds velocity)
  //   no resolution, sprint = current   -> in this sprint
  //   no resolution, no sprint          -> backlog (assignment candidate)
  // assignee = person id or null
  let _t = 0;
  const T = (o) => Object.assign({ id: "t" + (++_t), resolution: "", epic: "", wfh: false, assignee: null, sprints: [] }, o);

  const TICKETS = [
    // ---- DX current sprint ----
    T({ key: "DX-20418", epic: "Query Engine", summary: "Parallelize column scan for wide tables", points: 8, assignee: "p1", sprints: ["26.2.7"],
        desc: "Wide tables (>200 cols) scan single-threaded today.\n\nSplit the scan across a worker pool keyed by column group. Must preserve ordering guarantees for downstream aggregation.\n\nAcceptance: p95 scan latency on the 'events_wide' fixture drops below 400ms." }),
    T({ key: "DX-20431", epic: "Query Engine", summary: "Cache compiled predicate trees between runs", points: 5, assignee: "p1", sprints: ["26.2.7"],
        desc: "Predicate compilation shows up hot in flame graphs for repeated dashboard queries.\n\nAdd an LRU keyed by the normalized predicate AST. Invalidate on schema version bump." }),
    T({ key: "DX-20455", epic: "Ingest", summary: "Backpressure when sink lags producer", points: 5, assignee: "p3", sprints: ["26.2.7"],
        desc: "Under burst load the in-memory buffer grows unbounded and the pod OOMs.\n\nApply a bounded queue with credit-based backpressure to the upstream connector." }),
    T({ key: "DX-20460", epic: "Ingest", summary: "Dead-letter malformed Avro records", points: 3, assignee: "p3", sprints: ["26.2.7"],
        desc: "Malformed records currently halt the whole batch. Route them to a DLQ topic with the original offset and error class attached." }),
    T({ key: "DX-20472", epic: "UI", summary: "Virtualize result grid past 10k rows", points: 8, assignee: "p2", sprints: ["26.2.7"],
        desc: "The result grid renders every row to the DOM. Above ~10k rows the tab freezes.\n\nWindow the rows; keep column resize and selection working." }),
    T({ key: "DX-20480", epic: "UI", summary: "Sticky aggregate footer on scroll", points: 2, assignee: "p4", sprints: ["26.2.7"],
        desc: "Keep the SUM/AVG footer pinned while the body scrolls." }),
    T({ key: "DX-20488", epic: "Reliability", summary: "Graceful drain on rolling deploy", points: 5, assignee: "p1", sprints: ["26.2.7"],
        desc: "In-flight queries are killed on deploy. Add a drain phase that lets queries under 30s finish before the pod exits." }),

    // ---- DX backlog (unassigned candidates) ----
    T({ key: "DX-20501", epic: "Query Engine", summary: "Push down LIMIT into the scan layer", points: 5,
        desc: "LIMIT is applied after the full scan. Push it down so we stop reading once satisfied." }),
    T({ key: "DX-20509", epic: "Observability", summary: "Per-query cost attribution in traces", points: 8,
        desc: "Attach estimated and actual cost units to each span so we can attribute spend per dashboard." }),
    T({ key: "DX-20517", epic: "UI", summary: "Keyboard-only navigation for the query builder", points: 3,
        desc: "Full keyboard path through the visual query builder for accessibility." }),
    // ---- DX historical (completed) ----
    T({ key: "DX-20120", epic: "Query Engine", summary: "Vectorize string comparison ops", points: 8, assignee: "p1", resolution: "Done", sprints: ["26.2.6"] }),
    T({ key: "DX-20144", epic: "Ingest",       summary: "Schema registry client retries",   points: 5, assignee: "p3", resolution: "Fixed", sprints: ["26.2.6"] }),
    T({ key: "DX-20151", epic: "UI",           summary: "Column pinning",                    points: 3, assignee: "p2", resolution: "Done", sprints: ["26.2.6"] }),

    // ---- LX current sprint ----
    T({ key: "LX-8841", epic: "Graph Core", summary: "Incremental edge index rebuild", points: 8, assignee: "p5", sprints: ["26.2.7"],
        desc: "Full edge-index rebuilds take 40 min and block writes.\n\nMake the rebuild incremental by tracking a dirty-partition set. Writes must stay available throughout." }),
    T({ key: "LX-8852", epic: "Graph Core", summary: "Bidirectional BFS for shortest path", points: 5, assignee: "p8", sprints: ["26.2.7"],
        desc: "Single-direction BFS blows up on dense neighborhoods. Meet-in-the-middle to cut the frontier." }),
    T({ key: "LX-8860", epic: "Resolver", summary: "Fuzzy entity match on transliterated names", points: 8, assignee: "p8", sprints: ["26.2.7"],
        desc: "Names arriving in multiple scripts fail exact match.\n\nAdd a transliteration-aware similarity score; tune the threshold against the 'names_multi' fixture to keep precision above 0.9." }),
    T({ key: "LX-8871", epic: "Resolver", summary: "Explain-why panel for a merge decision", points: 5, assignee: "p7", sprints: ["26.2.7"],
        desc: "Analysts can't see why two records merged. Surface the contributing features and their weights." }),
    T({ key: "LX-8884", epic: "API", summary: "Cursor pagination for the traversal endpoint", points: 3, assignee: "p6", sprints: ["26.2.7"],
        desc: "Offset pagination drifts as the graph mutates. Move to opaque cursors." }),
    T({ key: "LX-8890", epic: "API", summary: "Rate-limit by API key tier", points: 5, assignee: "p6", sprints: ["26.2.7"],
        desc: "Single global limit punishes small tenants. Bucket by key tier." }),

    // ---- LX backlog ----
    T({ key: "LX-8901", epic: "Graph Core", summary: "Compress adjacency lists with delta+varint", points: 5,
        desc: "Adjacency lists dominate memory. Delta-encode sorted neighbor ids and varint-pack." }),
    T({ key: "LX-8908", epic: "Resolver", summary: "Block on phonetic key before scoring", points: 3,
        desc: "Scoring every pair is O(n^2). Block by phonetic key first." }),

    // ---- LX historical ----
    T({ key: "LX-8702", epic: "Graph Core", summary: "Partitioned edge store", points: 8, assignee: "p5", resolution: "Done", sprints: ["26.2.6"] }),
    T({ key: "LX-8715", epic: "API",        summary: "GraphQL schema for traversals", points: 5, assignee: "p8", resolution: "Resolved", sprints: ["26.2.6"] }),
    T({ key: "LX-8722", epic: "Resolver",   summary: "Confidence calibration",       points: 5, assignee: "p7", resolution: "Done", sprints: ["26.2.6"] }),

    // ---- RC current sprint ----
    T({ key: "RCR-3310", epic: "Pipeline", summary: "Retry storms on transient 503s", points: 5, assignee: "p9", sprints: ["26.2.7"],
        desc: "Naive retries amplify outages. Add jittered exponential backoff with a circuit breaker per downstream." }),
    T({ key: "RCR-3318", epic: "Pipeline", summary: "Checkpoint offsets atomically with output", points: 8, assignee: "p10", sprints: ["26.2.7"],
        desc: "A crash between writing output and committing the offset double-processes records.\n\nCommit the offset in the same transaction as the sink write, or use idempotent keys." }),
    T({ key: "RCR-3325", epic: "Scheduler", summary: "Fair-share across tenant DAGs", points: 8, assignee: "p10", sprints: ["26.2.7"],
        desc: "One heavy tenant starves the rest. Weighted fair queueing across tenant DAGs." }),
    T({ key: "RCR-3331", epic: "Scheduler", summary: "Surface skipped runs in the timeline", points: 3, assignee: "p11", sprints: ["26.2.7"],
        desc: "Skipped runs vanish silently. Show them in the run timeline with the skip reason." }),
    T({ key: "RCR-3340", epic: "UI", summary: "Live log tail with backfill", points: 5, assignee: "p11", sprints: ["26.2.7"],
        desc: "Tail logs over websocket and backfill the last N lines on connect." }),
    T({ key: "RCR-3349", epic: "UI", summary: "Run-diff between two executions", points: 5, assignee: "p12", sprints: ["26.2.7"],
        desc: "Compare two runs of the same DAG: durations, inputs, and output row counts side by side." }),

    // ---- RC backlog ----
    T({ key: "RCR-3360", epic: "Pipeline", summary: "Spill large shuffles to disk", points: 8,
        desc: "Big shuffles OOM. Spill partitions to disk above a memory threshold." }),
    T({ key: "RCR-3367", epic: "Scheduler", summary: "Cron drift correction across DST", points: 3,
        desc: "DST transitions skip or double-fire schedules. Anchor to UTC and correct." }),

    // ---- RC historical ----
    T({ key: "RCR-3201", epic: "Pipeline",  summary: "Exactly-once sink for warehouse", points: 8, assignee: "p10", resolution: "Done", sprints: ["26.2.6"] }),
    T({ key: "RCR-3214", epic: "Scheduler", summary: "DAG cycle detection",            points: 3, assignee: "p9",  resolution: "Completed", sprints: ["26.2.6"] }),
    T({ key: "RCR-3220", epic: "UI",        summary: "Run timeline zoom",              points: 5, assignee: "p11", resolution: "Done", sprints: ["26.2.6"] }),
  ];

  const DONE_RESOLUTIONS = ["Done", "Fixed", "Resolved", "Completed", "Complete"];

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
    PROJECTS, SPRINTS, CURRENT_SPRINT_IDX, PEOPLE, TICKETS, LEAVE, DONE_RESOLUTIONS,
    projectForKey,
    // calc
    isUndated,
    sprintWorkDays, holidaysInRange, velocity, baseVelocity,
    leaveDaysInSprint, leaveRecords, wfhBudget, capacity,
    parseISO, fmtISO, eachDay,
  };
})();
