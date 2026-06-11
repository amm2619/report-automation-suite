/* App root — state, tabs, nav, toasts. All data auto-saves to this browser's
   local storage and is restored on refresh, until cleared from Settings. */

let _tid = 0;

const PERSIST_KEY = "vp.state.v1";
function loadSaved() { try { return JSON.parse(localStorage.getItem(PERSIST_KEY)) || {}; } catch (_) { return {}; } }
const SAVED = loadSaved();
// Capacity math reads leave off VP.LEAVE, so re-seed it from the saved snapshot
// before the first render.
if (Array.isArray(SAVED.leave)) { VP.LEAVE.length = 0; VP.LEAVE.push(...SAVED.leave); }

function App() {
  // ---- app state (hydrated from the saved snapshot when present) ----
  const [project, setProject] = useState(() => SAVED.project || "DX");
  const [view, setView] = useState("planner");
  // Normalize any prefixed sprint label on older tickets down to its number.
  const [tickets, setTickets] = useState(() => (SAVED.tickets || VP.TICKETS).map((x) => ({
    ...x, sprints: (x.sprints || []).map((s) => VP.parseSprintNumber(s) || s),
  })));
  const [people, setPeople] = useState(() => (SAVED.people || VP.PEOPLE).map((x) => ({ ...x })));
  // Shared sprint settings (the whole org runs one cadence; product tabs just
  // filter the view). pastSprintDays = length of a past sprint for the
  // points/day math; pastSprintCount = 0 means auto-detect from the data;
  // upcoming = the sprint we're planning (typed working days + date range).
  const [velCfg, setVelCfg] = useState(() => ({
    pastSprintDays: 10, pastSprintCount: 0,
    upcoming: { workingDays: 10, start: "", end: "" },
    future: [], // additional sprints being planned beyond the upcoming one
    ...(SAVED.velCfg || {}),
  }));
  const [descTicket, setDescTicket] = useState(null);
  const [toasts, setToasts] = useState([]);

  // settings
  const [jiraBase, setJiraBase] = useState(() => (SAVED.jiraBase != null ? SAVED.jiraBase : "https://jira.example.com"));
  const [doneRes, setDoneRes] = useState(() => SAVED.doneRes || [...VP.DONE_RESOLUTIONS]);
  const [customRes, setCustomRes] = useState(() => SAVED.customRes || []); // user-added resolution strings
  const [showImportHtml, setShowImportHtml] = useState(false);
  const [showImportTickets, setShowImportTickets] = useState(false);
  const [showImportIcal, setShowImportIcal] = useState(false);
  const [leaveOverlay, setLeaveOverlay] = useState(() => SAVED.leave || []); // imported iCal leave (mirrors VP.LEAVE)

  // ---- optional folder auto-save (File System Access API) ----
  const [folder, setFolder] = useState(null);          // { name } when connected
  const [folderReconnect, setFolderReconnect] = useState(false);
  const dirHandle = useRef(null);
  const writeTimer = useRef(null);
  const fsSupported = !!(window.FSStore && window.FSStore.supported());

  // ---- shared sprint calendar (the distinct sprint numbers seen on tickets) --
  // All products run the same cadence, so the calendar is just the sorted set
  // of completed sprint numbers across every ticket; the product tab filters
  // the view. The one upcoming sprint we're planning lives in velCfg, not here.
  const sprintsList = useMemo(() => {
    const nums = [];
    tickets.forEach((t) => (t.sprints || []).forEach((s) => nums.push(s)));
    return VP.buildSprintCalendar(nums, {});
  }, [tickets]);
  // Past = sprints that already have completed work; the upcoming sprint's
  // tickets aren't done, so it never lands here. Deriving the auto name from
  // completed sprints keeps it stable once you start pulling tickets in.
  const pastSprintNames = useMemo(() => {
    const done = new Set(doneRes.map((r) => String(r).toLowerCase()));
    const set = new Set();
    tickets.forEach((t) => {
      if (t.resolution && done.has(String(t.resolution).toLowerCase())) {
        (t.sprints || []).forEach((s) => { const n = VP.parseSprintNumber(s) || s; if (n) set.add(n); });
      }
    });
    return [...set].sort((a, b) => VP.sprintSortKey(a) - VP.sprintSortKey(b));
  }, [tickets, doneRes]);
  // The sprint we're planning: whatever you typed, else the next number after
  // the latest completed one.
  const upcomingName = (velCfg.upcoming && velCfg.upcoming.name && velCfg.upcoming.name.trim())
    || VP.nextSprintName(pastSprintNames);
  const currentSprintIdx = pastSprintNames.length;
  // Resolve the shared config the calc actually uses (auto-fill the past-sprint
  // count from the data when it isn't pinned in settings).
  const velCfgResolved = useMemo(() => ({
    pastSprintDays: velCfg.pastSprintDays || 10,
    pastSprintCount: velCfg.pastSprintCount > 0 ? velCfg.pastSprintCount : pastSprintNames.length,
    upcoming: { ...(velCfg.upcoming || { workingDays: 10, start: "", end: "" }), name: upcomingName },
    future: velCfg.future || [],
  }), [velCfg, pastSprintNames.length, upcomingName]);
  const onVelCfg = (patch) => setVelCfg((c) => ({ ...c, ...patch }));

  // Sprints we're actively planning (the upcoming one + any future ones queued
  // in Settings). Their points must not be folded into velocity history.
  const plannedSprintNames = useMemo(() => {
    const names = [];
    if (upcomingName) names.push(upcomingName);
    (velCfg.future || []).forEach((f) => { if (f && f.name && f.name.trim()) names.push(f.name.trim()); });
    return names;
  }, [upcomingName, velCfg.future]);

  const snapshot = () => ({ v: 1, people, tickets, velCfg, leave: leaveOverlay, jiraBase, doneRes, customRes, project });

  // ---- persistence: write the full data snapshot whenever it changes ----
  useEffect(() => {
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot())); } catch (_) {}
    // Mirror to the connected folder file (debounced).
    if (folder && dirHandle.current && window.FSStore) {
      clearTimeout(writeTimer.current);
      const snap = snapshot();
      writeTimer.current = setTimeout(() => { window.FSStore.write(dirHandle.current, snap).catch(() => {}); }, 500);
    }
  }, [people, tickets, velCfg, leaveOverlay, jiraBase, doneRes, customRes, project, folder]);

  // ---- on load: reconnect a previously chosen folder ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fsSupported) return;
      const h = await window.FSStore.stored();
      if (!h || cancelled) return;
      dirHandle.current = h;
      if ((await window.FSStore.permission(h, false)) === "granted") {
        const data = await window.FSStore.read(h);
        if (cancelled) return;
        if (data) applyData(data);
        setFolder({ name: h.name });
      } else if (!cancelled) {
        setFolder({ name: h.name });
        setFolderReconnect(true);   // needs a click to re-grant permission
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

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
  const onToggleExclude = (id) => setTickets((ts) => ts.map((x) => x.id === id ? { ...x, excludeFromVelocity: !x.excludeFromVelocity } : x));

  // ---- settings actions ----
  // Save the entire workspace (people, tickets, sprints, leave, settings) to a
  // JSON file you can keep in a folder and re-import later.
  const onExportData = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), people, tickets, velCfg, leave: leaveOverlay, jiraBase, doneRes, customRes, project };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `velocity-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Data exported");
  };
  // Apply a saved snapshot (from a file, folder, or import) into state.
  const applyData = (d) => {
    if (!d || typeof d !== "object") return;
    if (Array.isArray(d.people)) setPeople(d.people.map((p) => ({ ...p })));
    if (Array.isArray(d.tickets)) setTickets(d.tickets.map((t) => ({ ...t, sprints: (t.sprints || []).map((s) => VP.parseSprintNumber(s) || s) })));
    if (d.velCfg && typeof d.velCfg === "object") setVelCfg((c) => ({ ...c, ...d.velCfg }));
    const leave = Array.isArray(d.leave) ? d.leave : (Array.isArray(d.leaveOverlay) ? d.leaveOverlay : null);
    if (leave) { VP.LEAVE.length = 0; VP.LEAVE.push(...leave); setLeaveOverlay(leave); }
    if (typeof d.jiraBase === "string") setJiraBase(d.jiraBase);
    if (Array.isArray(d.doneRes)) setDoneRes(d.doneRes);
    if (Array.isArray(d.customRes)) setCustomRes(d.customRes);
    if (typeof d.project === "string") setProject(d.project);
  };
  const onImportData = (txt) => {
    try { applyData(JSON.parse(txt)); toast("Data imported"); }
    catch { toast("Invalid data file", "err"); }
  };
  // Wipe everything back to a fresh, empty workspace.
  const onClearData = () => {
    VP.LEAVE.length = 0;
    setPeople([]);
    setTickets([]);
    setVelCfg({ pastSprintDays: 10, pastSprintCount: 0, upcoming: { workingDays: 10, start: "", end: "", name: "" } });
    setLeaveOverlay([]);
    setJiraBase("https://jira.example.com");
    setDoneRes([...VP.DONE_RESOLUTIONS]);
    setCustomRes([]);
    setProject("DX");
    try { localStorage.removeItem(PERSIST_KEY); } catch (_) {}
    toast("All data cleared", "info");
  };

  // ---- folder auto-save actions ----
  const onConnectFolder = async () => {
    try {
      const h = await window.FSStore.connect();
      dirHandle.current = h;
      const existing = await window.FSStore.read(h);
      if (existing && (existing.people || existing.tickets || existing.velCfg)) {
        applyData(existing);
        toast(`Connected “${h.name}” · loaded its data`);
      } else {
        await window.FSStore.write(h, snapshot());
        toast(`Connected “${h.name}” · auto-saving here`);
      }
      setFolder({ name: h.name });
      setFolderReconnect(false);
    } catch (e) {
      if (e && e.name !== "AbortError") toast("Couldn't connect that folder", "err");
    }
  };
  const onReconnectFolder = async () => {
    try {
      const h = dirHandle.current || await window.FSStore.stored();
      if (!h) return;
      if ((await window.FSStore.permission(h, true)) !== "granted") { toast("Permission denied", "err"); return; }
      dirHandle.current = h;
      const data = await window.FSStore.read(h);
      if (data) applyData(data);
      setFolder({ name: h.name });
      setFolderReconnect(false);
      toast(`Reconnected “${h.name}”`);
    } catch (_) { toast("Couldn't reconnect the folder", "err"); }
  };
  const onDisconnectFolder = async () => {
    try { await window.FSStore.forget(); } catch (_) {}
    dirHandle.current = null;
    setFolder(null);
    setFolderReconnect(false);
    toast("Folder disconnected", "info");
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
  // people from the assignees (creating any that are new), then upserts the
  // tickets by key. The sprint calendar derives automatically from the sprint
  // numbers on the imported tickets.
  const onImportTickets = (html) => {
    const res = parseBoardHtml(html);
    if (!res.rowCount) { toast("No tickets found in that export", "err"); return res; }

    // People — match assignees to the roster by name/sid; create the rest,
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
        sid: "",   // user fills it in to match their iCal calendar
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
      (res.sprintsSeen.length ? ` · ${res.sprintsSeen.length} sprints` : ""), "ok");
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
    // Only drop iCal-imported records; manual entries the user added survive.
    const isImported = (e) => e && e.source === "ical";
    const dropKeys = new Set(leaveOverlay.filter(isImported).map((e) => e.sid + "|" + e.date));
    for (let i = VP.LEAVE.length - 1; i >= 0; i--) {
      const k = VP.LEAVE[i].sid + "|" + VP.LEAVE[i].date;
      if (dropKeys.has(k) && isImported(VP.LEAVE[i])) VP.LEAVE.splice(i, 1);
    }
    setLeaveOverlay((prev) => prev.filter((e) => !isImported(e)));
    toast("Cleared imported leave", "info");
  };
  // Manually add a leave day for a person. Dedupes against existing same
  // sid+date so duplicates can't accumulate.
  const onAddLeave = (sid, date, halfDay) => {
    if (!sid || !date) { toast("Pick a person and a date", "err"); return; }
    if (VP.LEAVE.some((e) => e.sid === sid && e.date === date)) {
      toast("That date is already on record for them", "info"); return;
    }
    const rec = { sid, date, frac: halfDay ? 0.5 : 1, source: "manual" };
    VP.LEAVE.push(rec);
    setLeaveOverlay((prev) => [...prev, rec]);
    const name = people.find((p) => p.sid === sid)?.name || sid;
    toast(`Added leave: ${name} · ${date}${halfDay ? " · half day" : ""}`);
  };
  const onRemoveLeave = (sid, date) => {
    for (let i = VP.LEAVE.length - 1; i >= 0; i--) {
      if (VP.LEAVE[i].sid === sid && VP.LEAVE[i].date === date) VP.LEAVE.splice(i, 1);
    }
    setLeaveOverlay((prev) => prev.filter((e) => !(e.sid === sid && e.date === date)));
    toast("Removed leave day", "info");
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

  // Velocity is derived live from completed tickets. Each person's effective
  // history = the derived series when there is completed work, else their stored
  // (imported) seed. The view components read velocity/capacity off this.
  const derivedDetail = useMemo(
    () => VP.deriveHistoryDetail(tickets, doneRes, sprintsList, { excludeSprints: plannedSprintNames }),
    [tickets, doneRes, sprintsList, plannedSprintNames]
  );
  const derivedHistory = useMemo(() => {
    const o = {};
    for (const [pid, arr] of Object.entries(derivedDetail)) o[pid] = arr.map((e) => e.points);
    return o;
  }, [derivedDetail]);
  const peopleV = useMemo(
    () => people.map((p) => (derivedHistory[p.id] && derivedHistory[p.id].length ? { ...p, history: derivedHistory[p.id] } : p)),
    [people, derivedHistory]
  );

  const NAV = [
    { id: "planner", label: "Planner", icon: "board" },
    { id: "team", label: "Team", icon: "users" },
    { id: "settings", label: "Settings", icon: "gear" },
    { id: "debug", label: "Debug", icon: "board" },
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
          <Planner project={project} tickets={tickets} people={peopleV}
            velCfg={velCfgResolved} jiraBase={jiraBase}
            onAssign={onAssign} onWfh={onWfh} onMove={onMove} onBacklog={onBacklog}
            onPoints={onPoints} onOpenDesc={setDescTicket}
            onOpenImportTickets={() => setShowImportTickets(true)} />
        )}
        {view === "team" && (
          <Team people={peopleV} projects={VP.PROJECTS} currentProject={project} sprints={sprintsList}
            currentIdx={currentSprintIdx} velCfg={velCfgResolved} historyDetail={derivedDetail}
            onAdd={onAddPerson} onEdit={onEditPerson} onRemove={onRemovePerson} />
        )}
        {view === "settings" && (
          <Settings jiraBase={jiraBase} setJiraBase={setJiraBase}
            doneRes={doneRes} setDoneRes={setDoneRes} customRes={customRes} setCustomRes={setCustomRes}
            sprints={sprintsList} people={people}
            leaveOverlay={leaveOverlay} onClearImportedLeave={onClearImportedLeave}
            onAddLeave={onAddLeave} onRemoveLeave={onRemoveLeave}
            velCfg={velCfg} velCfgResolved={velCfgResolved} onVelCfg={onVelCfg}
            toast={toast}
            onExportData={onExportData} onImportData={onImportData} onClearData={onClearData}
            fsSupported={fsSupported} folder={folder} folderReconnect={folderReconnect}
            onConnectFolder={onConnectFolder} onReconnectFolder={onReconnectFolder} onDisconnectFolder={onDisconnectFolder}
            onOpenImportHistory={() => setShowImportHtml(true)}
            onOpenImportTickets={() => setShowImportTickets(true)}
            onOpenImportIcal={() => setShowImportIcal(true)} />
        )}
        {view === "debug" && (
          <DebugView tickets={tickets} people={people} sprints={sprintsList}
            currentIdx={currentSprintIdx} doneRes={doneRes} project={project}
            plannedSprints={plannedSprintNames} onToggleExclude={onToggleExclude} />
        )}
      </main>

      {/* description panel */}
      {descTicket && (
        <DescPanel
          ticket={tickets.find((t) => t.id === descTicket.id) || descTicket}
          people={peopleV}
          sprints={sprintsList}
          currentIdx={currentSprintIdx}
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
