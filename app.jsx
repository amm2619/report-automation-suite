/* App root — state, tabs, nav, toasts. */

let _tid = 0;

function App() {
  // ---- app state ----
  const [project, setProject] = useState(() => localStorage.getItem("vp.project") || "DX");
  const [view, setView] = useState("planner");
  const [sprintIdx, setSprintIdx] = useState(VP.CURRENT_SPRINT_IDX);
  const [mode, setMode] = useState("single");
  const [hidePast, setHidePast] = useState(() => localStorage.getItem("vp.hidePast") === "1");
  const [tickets, setTickets] = useState(() => VP.TICKETS.map((x) => ({ ...x, sprints: [...x.sprints] })));
  const [people, setPeople] = useState(() => VP.PEOPLE.map((x) => ({ ...x })));
  const [sprintsList, setSprintsList] = useState(() => VP.SPRINTS.map((s) => ({ ...s })));
  const [currentSprintIdx, setCurrentSprintIdx] = useState(VP.CURRENT_SPRINT_IDX);
  const [descTicket, setDescTicket] = useState(null);
  const [toasts, setToasts] = useState([]);

  // settings
  const [jiraBase, setJiraBase] = useState("https://jira.example.com");
  const [doneRes, setDoneRes] = useState([...VP.DONE_RESOLUTIONS]);
  const [customRes, setCustomRes] = useState([]); // user-added resolution strings
  const [showImportHtml, setShowImportHtml] = useState(false);
  const [showImportTickets, setShowImportTickets] = useState(false);
  const [showImportIcal, setShowImportIcal] = useState(false);
  const [leaveOverlay, setLeaveOverlay] = useState([]); // imported iCal leave (adds to VP.LEAVE)

  useEffect(() => { localStorage.setItem("vp.project", project); }, [project]);
  useEffect(() => { localStorage.setItem("vp.hidePast", hidePast ? "1" : "0"); }, [hidePast]);

  // ---- toasts ----
  const toast = useCallback((text, kind = "ok") => {
    const id = ++_tid;
    setToasts((ts) => [...ts, { id, text, kind }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3200);
  }, []);

  // ---- ticket actions ----
  const patchTicket = (id, patch) => setTickets((ts) => ts.map((x) => x.id === id ? { ...x, ...patch } : x));

  const onAssign = (ticket, personId, addSprint) => {
    const patch = { assignee: personId };
    if (personId && addSprint && !ticket.sprints.includes(addSprint)) patch.sprints = [...ticket.sprints, addSprint];
    if (!personId) patch.wfh = false;
    patchTicket(ticket.id, patch);
    const p = people.find((x) => x.id === personId);
    toast(personId ? `${ticket.key} → ${p.name}` : `${ticket.key} unassigned`, personId ? "ok" : "info");
  };
  const onWfh = (ticket) => { patchTicket(ticket.id, { wfh: !ticket.wfh }); };
  const onMove = (ticket, sprintName) => { patchTicket(ticket.id, { sprints: [sprintName] }); toast(`${ticket.key} moved to ${sprintName}`, "info"); };
  const onBacklog = (ticket) => { patchTicket(ticket.id, { sprints: [] }); toast(`${ticket.key} returned to backlog`, "info"); };
  const onPoints = (ticket, pts) => { patchTicket(ticket.id, { points: Math.max(0, Math.min(99, Math.round(Number(pts) || 0))) }); };

  // ---- sprint actions ----
  // Sort dated sprints chronologically; undated sprints (no timeframe) always last.
  const bySprintOrder = (a, b) => {
    if (!a.start && !b.start) return 0;
    if (!a.start) return 1;
    if (!b.start) return -1;
    return a.start.localeCompare(b.start);
  };
  const onAddSprint = (s) => {
    setSprintsList((arr) => {
      const next = [...arr, { ...s, id: "s" + Date.now() }].sort(bySprintOrder);
      // keep currentSprintIdx pointing at the same sprint id
      return next;
    });
    toast(`Added sprint ${s.name}`);
  };
  const onEditSprint = (id, patch) => {
    setSprintsList((arr) => arr.map((s) => s.id === id ? { ...s, ...patch } : s).sort(bySprintOrder));
  };
  const onRemoveSprint = (id) => {
    setSprintsList((arr) => arr.filter((s) => s.id !== id));
    toast("Sprint removed", "info");
  };
  const onSetCurrent = (idx) => { setCurrentSprintIdx(idx); toast(`Current sprint set to ${sprintsList[idx]?.name}`); };

  // ---- settings actions ----
  const onExportSettings = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), jiraBase, doneRes, customRes, project, sprintsList, currentSprintIdx, leaveOverlay };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `velocity-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Settings exported");
  };
  const onImportSettings = (txt) => {
    try {
      const d = JSON.parse(txt);
      if (typeof d.jiraBase === "string") setJiraBase(d.jiraBase);
      if (Array.isArray(d.doneRes)) setDoneRes(d.doneRes);
      if (Array.isArray(d.customRes)) setCustomRes(d.customRes);
      if (Array.isArray(d.sprintsList)) setSprintsList(d.sprintsList);
      if (Number.isInteger(d.currentSprintIdx)) setCurrentSprintIdx(d.currentSprintIdx);
      if (Array.isArray(d.leaveOverlay)) setLeaveOverlay(d.leaveOverlay);
      toast("Settings imported");
    } catch { toast("Invalid settings file", "err"); }
  };
  const onImportHistoricalHtml = (html) => {
    const result = parseHistoricalHtml(html, people, doneRes);
    if (!result.ticketCount) { toast("No matching velocity rows found in that file", "err"); return result; }
    setPeople((ps) => ps.map((p) => result.byPerson[p.id] ? { ...p, history: result.byPerson[p.id] } : p));
    const peopleN = Object.keys(result.byPerson).length;
    toast(`Seeded velocity from ${result.ticketCount} tickets across ${peopleN} people`, "ok");
    return result;
  };
  // Import the backlog + in-sprint board from a Jira HTML export. Populates
  // people from the assignees (creating any that are new), creates any sprints
  // the export references but the calendar doesn't have yet, then upserts the
  // tickets by key.
  const onImportTickets = (html) => {
    const res = parseBoardHtml(html);
    if (!res.rowCount) { toast("No tickets found in that export", "err"); return res; }

    // 1) Sprints — add an undated sprint for any referenced sprint we don't have.
    const knownSprintNames = new Set(sprintsList.map((s) => s.name));
    const newSprintNames = res.sprintsSeen.filter((n) => !knownSprintNames.has(n));
    let nextSprints = sprintsList;
    if (newSprintNames.length) {
      nextSprints = [...sprintsList, ...newSprintNames.map((n) => ({ id: "s" + (++_tid), name: n, start: null, end: null }))];
      setSprintsList(nextSprints);
    }

    // 2) People — match assignees to the roster by name/sid; create the rest,
    //    inferring each new person's project from the tickets they own.
    const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p]));
    const bySid = new Map(people.filter((p) => p.sid).map((p) => [p.sid.toLowerCase(), p]));
    const resolve = (name) => {
      const k = (name || "").trim().toLowerCase();
      return k ? (byName.get(k) || bySid.get(k) || null) : null;
    };
    const projTally = {};
    res.rows.forEach((r) => {
      if (!r.assigneeName || !r.project) return;
      const k = r.assigneeName.trim().toLowerCase();
      (projTally[k] = projTally[k] || {})[r.project] = (projTally[k][r.project] || 0) + 1;
    });
    const newPeople = [];
    res.assignees.forEach((name) => {
      const k = name.trim().toLowerCase();
      if (resolve(name)) return;
      const proj = Object.entries(projTally[k] || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || project;
      const np = {
        id: "np" + (++_tid), name: name.trim(),
        sid: name.trim().toLowerCase().replace(/\s+/g, "").slice(0, 8),
        type: "contractor", project: proj, goal: 0, history: [],
      };
      newPeople.push(np);
      byName.set(k, np);
    });
    if (newPeople.length) setPeople([...people, ...newPeople]);

    // 3) Tickets — upsert by key (Jira is the source of truth for these fields).
    const imported = res.rows.map((r) => {
      const person = resolve(r.assigneeName);
      return {
        id: "k:" + r.key, key: r.key, epic: r.epic || "", summary: r.summary || r.key,
        points: r.points || 0, resolution: r.resolution || "", wfh: false,
        assignee: person ? person.id : null,
        sprints: r.sprintName ? [r.sprintName] : [],
        desc: r.desc || "",
      };
    });
    setTickets((prev) => {
      const map = new Map(prev.map((t) => [t.key, t]));
      imported.forEach((t) => map.set(t.key, { ...(map.get(t.key) || {}), ...t }));
      return [...map.values()];
    });

    toast(`Imported ${imported.length} tickets · ${res.inSprint} in a sprint, ${res.backlog} backlog` +
      (newPeople.length ? ` · +${newPeople.length} people` : "") +
      (newSprintNames.length ? ` · +${newSprintNames.length} sprints` : ""), "ok");
    return res;
  };
  const onImportIcal = (text) => {
    const result = parseIcal(text, people);
    if (!result.eventCount) { toast("No leave events found in that file", "err"); return result; }
    // Dedupe against existing leave (built-in + previously imported), then push so VP.capacity sees them.
    const seen = new Set(VP.LEAVE.map((e) => e.sid + "|" + e.date));
    const fresh = result.records.filter((e) => !seen.has(e.sid + "|" + e.date));
    VP.LEAVE.push(...fresh);
    setLeaveOverlay((prev) => [...prev, ...fresh]);
    toast(`Imported ${fresh.length} leave day${fresh.length === 1 ? "" : "s"} for ${result.peopleHit} people`);
    return { ...result, eventCount: fresh.length };
  };
  const onClearImportedLeave = () => {
    const keys = new Set(leaveOverlay.map((e) => e.sid + "|" + e.date));
    for (let i = VP.LEAVE.length - 1; i >= 0; i--) {
      if (keys.has(VP.LEAVE[i].sid + "|" + VP.LEAVE[i].date)) VP.LEAVE.splice(i, 1);
    }
    setLeaveOverlay([]);
    toast("Cleared imported leave", "info");
  };

  // ---- team actions ----
  const onAddPerson = (data) => { setPeople((ps) => [...ps, { ...data, id: "np" + (++_tid), history: [] }]); toast(`${data.name} added to ${data.project}`); };
  const onEditPerson = (data) => { setPeople((ps) => ps.map((p) => p.id === data.id ? { ...p, ...data } : p)); toast(`${data.name} updated`); };
  const onRemovePerson = (person) => {
    setPeople((ps) => ps.filter((p) => p.id !== person.id));
    setTickets((ts) => ts.map((x) => x.assignee === person.id ? { ...x, assignee: null, wfh: false } : x));
    toast(`${person.name} removed`, "info");
  };

  // backlog counts per project (unassigned, not done)
  const counts = useMemo(() => {
    const c = { DX: 0, LX: 0, RC: 0 };
    tickets.forEach((t) => {
      const pr = VP.projectForKey(t.key);
      const done = t.resolution && doneRes.includes(t.resolution);
      if (pr && !done && t.sprints.length === 0) c[pr]++;
    });
    return c;
  }, [tickets, doneRes]);

  const NAV = [
    { id: "planner", label: "Planner", icon: "board" },
    { id: "team", label: "Team", icon: "users" },
    { id: "settings", label: "Settings", icon: "gear" },
  ];

  return (
    <div className="app">
      {/* top bar */}
      <header className="topbar">
        <div className="brand"><span className="glyph" /><span>Velocity<small> · sprint planner</small></span></div>

        <div className="proj-tabs">
          {VP.PROJECTS.map((p) => (
            <button key={p.id} className="proj-tab" data-active={project === p.id} data-proj={p.id} onClick={() => setProject(p.id)}>
              <span className="dot" style={{ background: PROJ_COLOR[p.id] }} />
              {p.id}
              <span className="cnt">{counts[p.id]}</span>
            </button>
          ))}
        </div>

        <div className="spacer" />
        <button className="btn primary" onClick={() => setShowImportTickets(true)}><Icon name="download" size={15} /> Import tickets</button>
        <button className="btn" onClick={() => setShowImportHtml(true)}><Icon name="download" size={15} /> Import history</button>
        <button className="iconbtn" onClick={() => setView("settings")} aria-label="Settings"><Gear /></button>
      </header>

      {/* nav row */}
      <nav className="navrow">
        <div className="viewtabs">
          {NAV.map((n) => (
            <button key={n.id} className="viewtab" data-active={view === n.id} onClick={() => setView(n.id)}>{n.label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 7 }}>
          <span className="dot" style={{ width: 8, height: 8, borderRadius: "50%", background: PROJ_COLOR[project], display: "inline-block" }} />
          {VP.PROJECTS.find((p) => p.id === project)?.name}
        </div>
      </nav>

      {/* content */}
      <main className="content">
        {view === "planner" && (
          <Planner project={project} tickets={tickets} people={people} sprints={sprintsList}
            sprintIdx={sprintIdx} setSprintIdx={setSprintIdx} mode={mode} setMode={setMode}
            hidePast={hidePast}
            jiraBase={jiraBase} currentIdx={currentSprintIdx}
            onAssign={onAssign} onWfh={onWfh} onMove={onMove} onBacklog={onBacklog}
            onPoints={onPoints} onOpenDesc={setDescTicket}
            onOpenImportTickets={() => setShowImportTickets(true)} />
        )}
        {view === "team" && (
          <Team people={people} projects={VP.PROJECTS} currentProject={project} sprints={sprintsList}
            onAdd={onAddPerson} onEdit={onEditPerson} onRemove={onRemovePerson} />
        )}
        {view === "settings" && (
          <Settings jiraBase={jiraBase} setJiraBase={setJiraBase}
            doneRes={doneRes} setDoneRes={setDoneRes} customRes={customRes} setCustomRes={setCustomRes}
            sprints={sprintsList} currentIdx={currentSprintIdx} people={people}
            hidePast={hidePast} setHidePast={setHidePast}
            leaveOverlay={leaveOverlay} onClearImportedLeave={onClearImportedLeave}
            onAddSprint={onAddSprint} onEditSprint={onEditSprint} onRemoveSprint={onRemoveSprint} onSetCurrent={onSetCurrent}
            toast={toast}
            onExportSettings={onExportSettings} onImportSettings={onImportSettings}
            onOpenImportHistory={() => setShowImportHtml(true)}
            onOpenImportTickets={() => setShowImportTickets(true)}
            onOpenImportIcal={() => setShowImportIcal(true)} />
        )}
      </main>

      {/* description panel */}
      {descTicket && (
        <DescPanel
          ticket={tickets.find((t) => t.id === descTicket.id) || descTicket}
          people={people}
          sprints={sprintsList}
          currentIdx={currentSprintIdx}
          hidePast={hidePast}
          jiraBase={jiraBase}
          onClose={() => setDescTicket(null)}
          onAssign={onAssign}
          onMove={onMove}
          onBacklog={onBacklog}
          onPoints={onPoints} />
      )}

      {/* backlog + in-sprint tickets import */}
      {showImportTickets && (
        <ImportTicketsModal
          people={people}
          sprints={sprintsList}
          onClose={() => setShowImportTickets(false)}
          onImport={onImportTickets} />
      )}

      {/* historical HTML import */}
      {showImportHtml && (
        <ImportHistoryModal
          people={people}
          doneRes={doneRes}
          onClose={() => setShowImportHtml(false)}
          onImport={onImportHistoricalHtml} />
      )}

      {/* iCal leave import */}
      {showImportIcal && (
        <ImportIcalModal
          people={people}
          onClose={() => setShowImportIcal(false)}
          onImport={onImportIcal} />
      )}

      {/* toasts */}
      <div className="toasts">
        {toasts.map((to) => (
          <div key={to.id} className={"toast " + to.kind}><span className="dotc" />{to.text}</div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
