/* Shared UI helpers — icons, avatar, color utils. Exports to window. */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const PROJ_COLOR = { DX: "var(--dx)", LX: "var(--lx)", RC: "var(--rc)" };
const PROJ_DIM = { DX: "var(--dx-dim)", LX: "var(--lx-dim)", RC: "var(--rc-dim)" };

function initials(name) {
  const p = (name || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

function Avatar({ name, proj, className, style }) {
  const c = PROJ_COLOR[proj] || "var(--accent)";
  return (
    <span className={"avatar " + (className || "")}
      style={{ background: "var(--surface-3)", color: c, border: "1px solid " + c, ...style }}>
      {initials(name)}
    </span>
  );
}

/* tiny icon set */
const ICONS = {
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V19a2 2 0 11-4 0v-.1A1.6 1.6 0 005 17.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 002.3 12 1.6 1.6 0 001 10.6H1a2 2 0 110-4h.1A1.6 1.6 0 002.3 4 1.6 1.6 0 002 2.2L1.9 2A2 2 0 114.7-.7l.1.1A1.6 1.6 0 007 .3 1.6 1.6 0 008.4-1V-1a2 2 0 114 0v.1A1.6 1.6 0 0014 .3a1.6 1.6 0 001.8-.3l.1-.1A2 2 0 1118.7 2.7l-.1.1A1.6 1.6 0 0019.7 5",
  download: "M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2",
  plus: "M12 5v14M5 12h14",
  x: "M18 6L6 18M6 6l12 12",
  ext: "M14 4h6m0 0v6m0-6L10 14M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5",
  plane: "M2 12l20-8-5 18-4-7-7-3z",
  home: "M3 11l9-8 9 8M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9",
  chev: "M6 9l6 6 6-6",
  dots: "M12 6h.01M12 12h.01M12 18h.01",
  cal: "M8 2v3M16 2v3M3 8h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  board: "M3 4h18v16H3zM9 4v16M3 10h6",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  check: "M20 6L9 17l-5-5",
  history: "M3 3v5h5M3.05 13A9 9 0 106 5.3L3 8M12 7v5l3 3",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z",
  "eye-off": "M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a19.86 19.86 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a19.86 19.86 0 01-2.42 3.32M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22",
  calplus: "M8 2v4M16 2v4M3 9h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z M12 13v6M9 16h6",
};
function Icon({ name, size = 16, stroke = 2, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={ICONS[name]} />
    </svg>
  );
}

/* gear icon above is gnarly; use a clean one */
function Gear({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H22a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

/* click-outside hook */
function useClickOutside(ref, onClose) {
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtRange(a, b) { return (!a || !b) ? "No fixed dates" : fmtDate(a) + " – " + fmtDate(b); }

/* ---------- Sprint date math ---------- */
/* Walks forward from startISO, counting non-weekend, non-holiday days,
   and returns the ISO of the Nth such day (inclusive of start). */
function endDateFromWorkDays(startISO, workDays) {
  if (!startISO || !workDays || workDays < 1) return "";
  // Build a generous holiday set spanning the expected window.
  const probe = new Date(...startISO.split("-").map((v, i) => i === 1 ? +v - 1 : +v));
  probe.setDate(probe.getDate() + workDays * 3 + 21);
  const endProbe = probe.toISOString().slice(0, 10);
  const hols = new Set(VP.holidaysInRange(startISO, endProbe));
  const dt = new Date(...startISO.split("-").map((v, i) => i === 1 ? +v - 1 : +v));
  let count = 0;
  // up to ~365 iterations
  for (let i = 0; i < 365; i++) {
    const iso = dt.toISOString().slice(0, 10);
    const g = dt.getDay();
    const off = (g === 0 || g === 6) || hols.has(iso);
    if (!off) count++;
    if (count >= workDays) return iso;
    dt.setDate(dt.getDate() + 1);
  }
  return "";
}

/* ---------- Themed date picker (popover) ---------- */
function DatePicker({ value, onChange, placeholder = "Pick a date" }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = value ? new Date(value + "T00:00") : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  useEffect(() => {
    if (value) {
      const d = new Date(value + "T00:00");
      setView({ y: d.getFullYear(), m: d.getMonth() });
    }
  }, [value, open]);

  const monthLabel = new Date(view.y, view.m, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const grid = [];
  const start = new Date(view.y, view.m, 1 - firstDow);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    grid.push(d);
  }
  const todayISO = new Date().toISOString().slice(0, 10);
  // Build holiday set for displayed month range
  const monthStart = new Date(view.y, view.m, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(view.y, view.m + 1, 0).toISOString().slice(0, 10);
  const hols = new Set(VP.holidaysInRange(monthStart, monthEnd));

  function prev() { setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }); }
  function next() { setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }); }

  return (
    <div className="date-pick" ref={ref}>
      <button type="button" className="date-trigger" data-empty={!value} onClick={() => setOpen((o) => !o)}>
        <Icon name="cal" size={13} />
        <span>{value ? new Date(value + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : placeholder}</span>
        <span className="caret"><Icon name="chev" size={12} /></span>
      </button>
      {open && (
        <div className="date-pop" role="dialog">
          <div className="date-nav">
            <button type="button" onClick={prev} aria-label="Previous month"><Icon name="chev" size={15} style={{ transform: "rotate(90deg)" }} /></button>
            <div className="date-month">{monthLabel}</div>
            <button type="button" onClick={next} aria-label="Next month"><Icon name="chev" size={15} style={{ transform: "rotate(-90deg)" }} /></button>
          </div>
          <div className="date-dow">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="date-grid">
            {grid.map((d) => {
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const inMonth = d.getMonth() === view.m;
              const we = d.getDay() === 0 || d.getDay() === 6;
              const hol = hols.has(iso);
              return (
                <button
                  type="button" key={iso}
                  className="date-cell"
                  data-other={!inMonth}
                  data-today={iso === todayISO}
                  data-sel={iso === value}
                  data-we={we}
                  data-hol={hol}
                  title={hol ? "Federal holiday (observed)" : ""}
                  onClick={() => { onChange(iso); setOpen(false); }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="date-legend">
            <span><i className="dot today" /> today</span>
            <span><i className="dot hol" /> holiday</span>
            <span className="muted">weekends dimmed</span>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  React, useState, useEffect, useRef, useMemo, useCallback,
  PROJ_COLOR, PROJ_DIM, initials, Avatar, Icon, Gear, useClickOutside, fmtDate, fmtRange,
  InlineNumber, parseHistoricalHtml, parseBoardHtml, parseIcal,
  DatePicker, endDateFromWorkDays,
});

/* ---------- Inline-edit primitives ---------- */
/* Click value -> shows compact input. Enter / blur commits, Esc cancels. */
function InlineNumber({ value, onChange, min = 0, max = 99, className = "", suffix = "" }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  const ref = useRef(null);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  useEffect(() => { if (!editing) setV(String(value)); }, [value, editing]);
  function commit() {
    const n = Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
    if (n !== value) onChange(n);
    setEditing(false);
  }
  if (editing) {
    return (
      <input
        ref={ref}
        className={"inline-num " + className}
        type="number"
        inputMode="numeric"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { e.preventDefault(); setV(String(value)); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  return (
    <button className={"inline-val " + className} onClick={(e) => { e.stopPropagation(); setEditing(true); }} title="Click to edit">
      {value}{suffix && <span className="pu">{suffix}</span>}
    </button>
  );
}

/* ---------- Jira board HTML parser (backlog + in-sprint tickets) ---------- */
/* Parses a Jira issue-navigator HTML export table into ticket records, reading
   each field off its column header (Key, Summary, Assignee, Sprint, Epic,
   "Custom field (Story Points)", Resolution, Description). Cell text is pulled
   from real DOM nodes so multi-line descriptions survive intact. Returns raw
   rows + aggregate counts; the app wires assignees to people (creating any that
   are missing) and creates any sprints it hasn't seen. */
function parseBoardHtml(html) {
  const empty = { rowCount: 0, rows: [], sprintsSeen: [], inSprint: 0, backlog: 0, projects: { DX: 0, LX: 0, RC: 0 }, assignees: [] };
  if (!html || !html.trim()) return empty;
  let doc;
  try { doc = new DOMParser().parseFromString(html, "text/html"); } catch { return empty; }

  const tables = [...doc.querySelectorAll("table")];
  const table = doc.querySelector("table#issuetable")
    || tables.find((t) => t.querySelector("td.issuekey, tr[data-issuekey], th"))
    || tables[0];
  if (!table) return empty;

  // Cell -> plain text, preserving line breaks for multi-line fields.
  function cellText(el) {
    const h = el.innerHTML
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n");
    const tmp = el.ownerDocument.createElement("div");
    tmp.innerHTML = h;
    let txt = tmp.textContent || "";
    if (!txt.trim() && el.querySelector) {
      const img = el.querySelector("img");
      if (img) txt = img.getAttribute("alt") || img.getAttribute("title") || "";
    }
    return txt.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // Header row: prefer <thead>; else the first row.
  let headerCells = [...table.querySelectorAll("thead th, thead td")];
  let bodyRows;
  if (headerCells.length) {
    bodyRows = [...table.querySelectorAll("tbody tr")];
    if (!bodyRows.length) bodyRows = [...table.querySelectorAll("tr")].filter((tr) => !tr.querySelector("th"));
  } else {
    const all = [...table.querySelectorAll("tr")];
    headerCells = [...(all[0] ? all[0].children : [])];
    bodyRows = all.slice(1);
  }
  // Header text + class for each column. Jira exports include class names like
  // "headerrow-customfield_10023" / "headerrow-summary" — those are stable
  // across renames/translations, so we match by class first then fall back to
  // the human-readable header text.
  const headers = headerCells.map((th) => cellText(th).toLowerCase());
  const headerClasses = headerCells.map((th) => String(th.className || "").toLowerCase());
  const CF = VP.JIRA_CUSTOM_FIELDS || {};
  const byClass = (needle) => needle ? headerClasses.findIndex((c) => c.includes(String(needle).toLowerCase())) : -1;
  const byText = (pred) => headers.findIndex(pred);
  const pick = (cls, pred) => { const i = byClass(cls); return i >= 0 ? i : byText(pred); };

  const idxKey = pick("issuekey", (h) => h === "key" || h === "issuekey" || h.includes("issue key"));
  const idxSum = pick("summary", (h) => h.includes("summary"));
  const idxAss = pick("assignee", (h) => h.includes("assignee"));
  const idxEpic = pick(CF.epic, (h) => h.includes("epic"));
  const idxPts = pick(CF.points, (h) => h.includes("story point"));
  const idxRes = pick("resolution", (h) => h.includes("resolution"));
  const idxDesc = pick("description", (h) => h.includes("description"));
  // Sprint can appear under its custom-field class OR a plain "Sprint" header
  // (sometimes more than once). Take both.
  const sprintCols = [];
  headerClasses.forEach((c, i) => { if (CF.sprint && c.includes(CF.sprint.toLowerCase())) sprintCols.push(i); });
  headers.forEach((h, i) => { if ((h === "sprint" || h.startsWith("sprint")) && !sprintCols.includes(i)) sprintCols.push(i); });

  // Keep the FULL sprint label including any team prefix, so "LX 26.3.6" stays
  // distinct from "DX 26.3.6" instead of both collapsing to "26.3.6". Captures
  // optional leading words before the NN.N.N number.
  const sprintRe = /(?:[A-Za-z][\w-]*\s+)*\d{2,4}\.\d+\.\d+/g;
  // Jira renders an empty assignee/resolution as "Unassigned"/"Unresolved".
  const norm = (s, blank) => { const v = (s || "").trim(); return v.toLowerCase() === blank ? "" : v; };

  const rows = [];
  const projects = { DX: 0, LX: 0, RC: 0 };
  const sprintsSeen = new Set();
  const assignees = new Set();
  let inSprint = 0, backlog = 0;

  for (const tr of bodyRows) {
    const cells = [...tr.children];
    if (!cells.length) continue;
    const get = (i) => (i >= 0 && cells[i] ? cellText(cells[i]) : "");
    let key = get(idxKey) || tr.getAttribute("data-issuekey") || "";
    key = key.trim();
    const project = VP.projectForKey(key);
    if (!project) continue; // skip header/footer/non-issue rows

    // Sprint: gather all sprint labels across sprint columns; the last is current.
    const matches = sprintCols.map((i) => get(i)).join(" , ").match(sprintRe) || [];
    const sprintName = matches.length ? matches[matches.length - 1].trim() : "";
    const assigneeName = norm(get(idxAss), "unassigned");

    rows.push({
      key, project,
      summary: get(idxSum) || key,
      epic: get(idxEpic),
      points: Math.max(0, Math.round(parseFloat(get(idxPts)) || 0)),
      resolution: norm(get(idxRes), "unresolved"),
      desc: get(idxDesc),
      assigneeName,
      sprintName,
    });
    projects[project]++;
    if (assigneeName) assignees.add(assigneeName);
    if (sprintName) { sprintsSeen.add(sprintName); inSprint++; } else backlog++;
  }

  return { rowCount: rows.length, rows, sprintsSeen: [...sprintsSeen].sort(), inSprint, backlog, projects, assignees: [...assignees] };
}

/* ---------- Historical Jira HTML parser ---------- */
/* Best-effort parse of Jira issue-navigator HTML exports. Walks every <tr>
   that looks like an issue row, pulls out (sprint, points, assignee), and
   builds per-person history (one entry per past sprint, chronological). */
function parseHistoricalHtml(html, people, doneResolutions) {
  if (!html || !people?.length) return { byPerson: {}, ticketCount: 0, sprints: [] };
  let doc;
  try { doc = new DOMParser().parseFromString(html, "text/html"); }
  catch { return { byPerson: {}, ticketCount: 0, sprints: [] }; }

  const sprintRe = /\b\d{2}\.\d+\.\d+\b/;          // matches "26.2.6" etc.
  const doneSet = new Set((doneResolutions || []).map((r) => r.toLowerCase()));
  const sprintPersonPts = {};                       // { sprint: { pid: pts } }
  let ticketCount = 0;

  doc.querySelectorAll("tr, .issue-row, .issuerow").forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll("td, .cell, span, div"))
      .map((c) => (c.textContent || "").trim())
      .filter(Boolean);
    if (cells.length < 2) return;
    const joined = cells.join(" | ");
    if (joined.length > 1500) return; // skip huge wrapper rows
    const sprintMatch = joined.match(sprintRe);
    if (!sprintMatch) return;
    const sprint = sprintMatch[0];
    // points: smallest reasonable integer in the row (1..40)
    const pts = cells
      .map((c) => parseFloat(c))
      .filter((n) => !isNaN(n) && n > 0 && n <= 40 && Number.isFinite(n))
      .sort((a, b) => a - b)[0];
    if (!pts) return;
    // only count rows that look "done"
    if (doneSet.size) {
      const isDone = [...doneSet].some((r) => joined.toLowerCase().includes(r));
      if (!isDone) return;
    }
    // assignee: try sid first, then name fragments
    const lc = joined.toLowerCase();
    const person =
      people.find((p) => p.sid && lc.includes(p.sid.toLowerCase())) ||
      people.find((p) => p.name && lc.includes(p.name.toLowerCase())) ||
      people.find((p) => p.name && lc.includes(p.name.split(" ")[0].toLowerCase()));
    if (!person) return;
    sprintPersonPts[sprint] = sprintPersonPts[sprint] || {};
    sprintPersonPts[sprint][person.id] = (sprintPersonPts[sprint][person.id] || 0) + pts;
    ticketCount++;
  });

  const sprintNames = Object.keys(sprintPersonPts).sort(); // ISO-like sortable
  const byPerson = {};
  sprintNames.forEach((sn) => {
    Object.entries(sprintPersonPts[sn]).forEach(([pid, pts]) => {
      byPerson[pid] = byPerson[pid] || [];
      byPerson[pid].push(pts);
    });
  });
  return { byPerson, ticketCount, sprints: sprintNames };
}

/* ---------- Minimal iCal (.ics) parser for leave events ---------- */
/* Walks VEVENT blocks and pulls DTSTART/DTEND/SUMMARY/ATTENDEE/ORGANIZER.
   Matches each event to a person via SUMMARY text (e.g. "Maya OOO") or
   ATTENDEE CN= / mailto: against name or sid. Expands multi-day events into
   one record per work day. */
function parseIcal(text, people) {
  if (!text || !people?.length) return { records: [], eventCount: 0, peopleHit: 0 };

  // unfold lines per RFC 5545 (lines starting with space/tab continue prior)
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const unfolded = [];
  for (const ln of lines) {
    if (/^[ \t]/.test(ln) && unfolded.length) unfolded[unfolded.length - 1] += ln.slice(1);
    else unfolded.push(ln);
  }

  function findPerson(haystacks) {
    const lc = haystacks.map((h) => (h || "").toLowerCase()).join(" | ");
    if (!lc.trim()) return null;
    return (
      people.find((p) => p.sid && lc.includes(p.sid.toLowerCase())) ||
      people.find((p) => p.name && lc.includes(p.name.toLowerCase())) ||
      people.find((p) => p.name && lc.includes(p.name.split(" ")[0].toLowerCase())) ||
      null
    );
  }
  function parseDate(v) {
    if (!v) return null;
    // DTSTART;VALUE=DATE:20260603 or DTSTART:20260603T170000Z
    const m = v.match(/(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  function eachDay(a, b) {
    if (!a) return [];
    const out = [];
    const [y, m, d] = a.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const end = b ? (() => { const [yy, mm, dd] = b.split("-").map(Number); return new Date(yy, mm - 1, dd); })() : new Date(y, m - 1, d);
    while (dt <= end) {
      const g = dt.getDay();
      if (g !== 0 && g !== 6) out.push(dt.toISOString().slice(0, 10));
      dt.setDate(dt.getDate() + 1);
    }
    return out;
  }

  const records = [];
  let cur = null;
  for (const raw of unfolded) {
    const ln = raw.trim();
    if (ln === "BEGIN:VEVENT") cur = { attendees: [] };
    else if (ln === "END:VEVENT") {
      if (cur) {
        const start = parseDate(cur.start);
        const end = parseDate(cur.end) || start;
        const summary = cur.summary || "";
        const looksLikeLeave = /\b(ooo|out of office|pto|leave|vacation|holiday|sick)\b/i.test(summary);
        // Program calendars list WFH days too — those are working days, not
        // leave, so skip them outright.
        const looksLikeWfh = /\b(wfh|work\s*from\s*home|telework|telecommut)/i.test(summary);
        // Try ATTENDEEs first, then SUMMARY
        let matched = null;
        for (const a of cur.attendees) { matched = findPerson([a]); if (matched) break; }
        if (!matched) matched = findPerson([summary, cur.organizer]);
        if (matched && start && !looksLikeWfh && (looksLikeLeave || cur.attendees.length)) {
          const days = eachDay(start, end);
          // Many calendars store DTEND as exclusive — if end == start+1 and event is single-day, the day list may be off by one.
          // Heuristic: if event spans only one weekday and the end matches the next day, that's fine because eachDay already includes start.
          for (const date of days) records.push({ sid: matched.sid, date, frac: 1, source: "ical" });
        }
      }
      cur = null;
    } else if (cur) {
      const [keyRaw, ...rest] = ln.split(":");
      const val = rest.join(":");
      const key = keyRaw.split(";")[0].toUpperCase();
      if (key === "DTSTART") cur.start = ln;
      else if (key === "DTEND") cur.end = ln;
      else if (key === "SUMMARY") cur.summary = val;
      else if (key === "ORGANIZER") cur.organizer = ln;
      else if (key === "ATTENDEE") cur.attendees.push(ln);
    }
  }

  const peopleHit = new Set(records.map((r) => r.sid)).size;
  return { records, eventCount: records.length, peopleHit };
}

