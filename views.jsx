/* Settings view + Sprint cadence + import modals + Debug. */

/* ============================================================================
   Settings
   ========================================================================== */
function Settings({
  jiraBase, setJiraBase,
  doneRes, setDoneRes, customRes, setCustomRes,
  sprints, currentIdx, people,
  hidePast, setHidePast,
  leaveOverlay, onClearImportedLeave, onAddLeave, onRemoveLeave,
  velCfg, velCfgResolved, onVelCfg,
  toast, onExportData, onImportData, onClearData,
  fsSupported, folder, folderReconnect, onConnectFolder, onReconnectFolder, onDisconnectFolder,
  onOpenImportHistory, onOpenImportTickets, onOpenImportIcal,
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const presetRes = ["Done", "Fixed", "Resolved", "Completed", "Complete", "Closed", "Shipped"];
  const allRes = useMemo(() => [...new Set([...presetRes, ...customRes])], [customRes]);
  const [newRes, setNewRes] = useState("");
  const fileRef = useRef(null);

  function addCustom() {
    const v = newRes.trim();
    if (!v) return;
    if (allRes.some((r) => r.toLowerCase() === v.toLowerCase())) { toast(`“${v}” already in the list`, "info"); setNewRes(""); return; }
    setCustomRes([...customRes, v]);
    setDoneRes([...doneRes, v]);
    setNewRes("");
    toast(`Added resolution “${v}”`);
  }
  function removeCustom(r) {
    setCustomRes(customRes.filter((x) => x !== r));
    setDoneRes(doneRes.filter((x) => x !== r));
  }

  function pickFile() { fileRef.current?.click(); }
  function onFileChosen(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onImportData(String(reader.result || ""));
    reader.readAsText(f);
    e.target.value = "";
  }

  const importedLeaveCount = (leaveOverlay || []).filter((e) => e.source === "ical").length;
  const manualLeave = (leaveOverlay || []).filter((e) => e.source !== "ical");

  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <div className="team-head">
        <div><h2>Settings</h2><div className="sub">Project-agnostic · applies across {VP.PROJECTS.map((p) => p.id).join(" / ")}</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={pickFile}><Icon name="download" size={14} style={{ transform: "rotate(180deg)" }} /> Import data</button>
          <button className="btn primary" onClick={onExportData}><Icon name="download" size={14} /> Export data</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFileChosen} style={{ display: "none" }} />
        </div>
      </div>

      <div className="person-card settings-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="section-label" style={{ margin: 0 }}>Tickets · Jira HTML import</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Import the backlog and in-sprint tickets from a Jira issue-navigator <b>Export · HTML</b>.
              People are created from the assignees, and any sprint the export references is added to the calendar.
              Use <b>Velocity history</b> to seed each person's rolling average from completed tickets.
            </div>
          </div>
          <button className="btn" onClick={onOpenImportHistory}><Icon name="download" size={14} /> Velocity history</button>
          <button className="btn primary" onClick={onOpenImportTickets}><Icon name="download" size={14} /> Import tickets</button>
        </div>
      </div>

      <div className="person-card settings-card" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ margin: 0 }}>Jira base URL</div>
        <div className="muted" style={{ fontSize: 12.5 }}>Makes ticket keys clickable <span style={{ fontFamily: "var(--font-mono)" }}>…/browse/KEY</span> links.</div>
        <input value={jiraBase} onChange={(e) => setJiraBase(e.target.value)} placeholder="https://jira.example.com"
          style={{ fontFamily: "var(--font-mono)", fontSize: 13, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }} />
      </div>

      <div className="person-card settings-card" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ margin: 0 }}>Done resolutions</div>
        <div className="muted" style={{ fontSize: 12.5 }}>Which resolutions count as completed when computing velocity. Add custom strings to match your Jira instance.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allRes.map((r) => {
            const on = doneRes.includes(r);
            const custom = customRes.includes(r);
            return (
              <span key={r} className="res-chip" data-on={on}>
                <button onClick={() => setDoneRes(on ? doneRes.filter((x) => x !== r) : [...doneRes, r])}
                  style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {on && <Icon name="check" size={12} />} {r}
                </button>
                {custom && (
                  <button className="x" onClick={() => removeCustom(r)} title="Remove custom resolution" aria-label="Remove">
                    <Icon name="x" size={11} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <div className="add-res">
          <input value={newRes} placeholder="e.g. Won't Fix, Delivered…"
            onChange={(e) => setNewRes(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }} />
          <button className="btn" onClick={addCustom} disabled={!newRes.trim()}>
            <Icon name="plus" size={13} /> Add resolution
          </button>
        </div>
      </div>

      {/* Leave / iCal */}
      <div className="person-card settings-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="section-label" style={{ margin: 0 }}>Leave calendar · iCal import</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Drop a .ics export from your team calendar — OOO / PTO / leave events get matched to people and subtracted from sprint capacity.
              {importedLeaveCount > 0 && <> · <b style={{ color: "var(--good)" }}>{importedLeaveCount} day{importedLeaveCount === 1 ? "" : "s"} loaded</b></>}
            </div>
          </div>
          {importedLeaveCount > 0 && (
            <button className="btn sm" onClick={onClearImportedLeave}>Clear</button>
          )}
          <button className="btn primary" onClick={onOpenImportIcal}><Icon name="cal" size={14} /> Import iCal</button>
        </div>
      </div>

      {/* Manual leave entry */}
      <ManualLeaveCard
        people={people}
        records={manualLeave}
        onAdd={onAddLeave}
        onRemove={onRemoveLeave}
      />

      {/* Sprint & velocity settings (shared across all products) */}
      <SprintSettingsCard
        sprints={sprints}
        velCfg={velCfg}
        velCfgResolved={velCfgResolved}
        onVelCfg={onVelCfg}
        hidePast={hidePast}
        setHidePast={setHidePast}
      />

      {/* Data — auto-save, folder sync, clear */}
      <div className="person-card settings-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="section-label" style={{ margin: 0 }}>Data</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Everything you import or edit is saved automatically in this browser and restored on refresh.
              Use <b>Export data</b> (top right) to keep a one-off copy. Clearing wipes the workspace back to empty.
            </div>
          </div>
          <button className="btn" onClick={() => setConfirmClear(true)}
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
            <Icon name="trash" size={14} /> Clear all data
          </button>
        </div>

        {/* Folder auto-save */}
        <div className="opt-row" style={{ cursor: "default", alignItems: "center" }}>
          <span>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Auto-save to a folder</div>
            {!fsSupported ? (
              <div className="muted" style={{ fontSize: 12 }}>
                Needs Chrome/Edge served over <span style={{ fontFamily: "var(--font-mono)" }}>http://localhost</span> (run <span style={{ fontFamily: "var(--font-mono)" }}>npm start</span>). Export/Import still works everywhere.
              </div>
            ) : folder ? (
              folderReconnect ? (
                <div className="muted" style={{ fontSize: 12 }}>
                  Linked to <b>{folder.name}</b> — reconnect to resume writing <span style={{ fontFamily: "var(--font-mono)" }}>velocity-data.json</span>.
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>
                  Auto-saving to <b>{folder.name}</b><span style={{ fontFamily: "var(--font-mono)" }}>/velocity-data.json</span>.
                </div>
              )
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                Pick a folder once; the app keeps <span style={{ fontFamily: "var(--font-mono)" }}>velocity-data.json</span> there in sync.
              </div>
            )}
          </span>
          {fsSupported && (
            folder ? (
              <span style={{ display: "flex", gap: 8 }}>
                {folderReconnect && <button className="btn sm primary" onClick={onReconnectFolder}>Reconnect</button>}
                <button className="btn sm" onClick={onDisconnectFolder}>Disconnect</button>
              </span>
            ) : (
              <button className="btn sm primary" onClick={onConnectFolder}><Icon name="download" size={13} /> Connect folder</button>
            )
          )}
        </div>
      </div>

      {confirmClear && (
        <div className="modal-scrim" onClick={() => setConfirmClear(false)}>
          <div className="modal" style={{ width: "min(400px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Clear all data?</h3></div>
            <div className="modal-body">
              <div className="muted" style={{ fontSize: 13 }}>
                This removes all people, tickets, leave, and resets the sprint calendar and settings.
                Export first if you want to keep a copy. This can't be undone.
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button className="btn" style={{ background: "color-mix(in oklch, var(--danger) 18%, var(--surface-2))", borderColor: "var(--danger)", color: "var(--text)" }}
                onClick={() => { onClearData(); setConfirmClear(false); }}>Clear everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Manual leave entry — add ad-hoc leave days for any person with a SID
   ========================================================================== */
function ManualLeaveCard({ people, records, onAdd, onRemove }) {
  // Only people with a SID can have leave records (capacity is matched by SID).
  const withSid = useMemo(() => people.filter((p) => p.sid), [people]);
  const [sid, setSid] = useState("");
  const [date, setDate] = useState("");
  const [half, setHalf] = useState(false);

  function commit() {
    if (!sid || !date) return;
    onAdd(sid, date, half);
    setDate(""); setHalf(false);
  }

  // Group records by person for display.
  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of records) {
      if (!m.has(r.sid)) m.set(r.sid, []);
      m.get(r.sid).push(r);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
    return [...m.entries()].map(([s, arr]) => ({
      sid: s,
      person: people.find((p) => p.sid === s) || null,
      records: arr,
    })).sort((a, b) => (a.person?.name || a.sid).localeCompare(b.person?.name || b.sid));
  }, [records, people]);

  return (
    <div className="person-card settings-card" style={{ marginBottom: 16 }}>
      <div className="section-label" style={{ margin: 0 }}>Manual leave</div>
      <div className="muted" style={{ fontSize: 12.5 }}>
        Add ad-hoc leave days for anyone with a SID set in the Team tab. These are kept separate from iCal-imported leave and survive Clear.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 10, alignItems: "end" }}>
        <div className="field">
          <label>Person</label>
          <select className="twk-field" value={sid} onChange={(e) => setSid(e.target.value)}
            style={{ fontFamily: "inherit", height: 38, padding: "0 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}>
            <option value="">— Pick a person —</option>
            {withSid.map((p) => (
              <option key={p.id} value={p.sid}>{p.name} ({p.sid})</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
        </div>
        <label className="opt-row" style={{ cursor: "pointer", padding: "10px 11px", alignSelf: "end" }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Half day</span>
          <span className="switch" data-on={half} onClick={(e) => { e.stopPropagation(); setHalf(!half); }} role="switch" aria-checked={half}>
            <span className="knob" />
          </span>
        </label>
        <button className="btn primary" onClick={commit} disabled={!sid || !date} style={{ height: 38 }}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>

      {withSid.length === 0 && (
        <div className="muted" style={{ fontSize: 12 }}>
          Nobody has a SID yet — open the Team tab, edit a person, and fill in their SID.
        </div>
      )}

      {grouped.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {grouped.map(({ sid: s, person, records: list }) => (
            <div key={s} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 140, fontSize: 13 }}>
                <div style={{ fontWeight: 700 }}>{person ? person.name : s}</div>
                <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{s}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
                {list.map((r) => (
                  <span key={r.sid + "|" + r.date} className="res-chip" data-on="true" title={r.frac === 0.5 ? "Half day" : "Full day"}>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{r.date}</span>
                    {r.frac === 0.5 && <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.7 }}>·½</span>}
                    <button className="x" onClick={() => onRemove(r.sid, r.date)} title="Remove" aria-label="Remove">
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Sprint & velocity settings — shared across every product (one cadence)
   ========================================================================== */
function SprintSettingsCard({ sprints, velCfg, velCfgResolved, onVelCfg, hidePast, setHidePast }) {
  const cfg = velCfg || {};
  const up = cfg.upcoming || {};
  const detected = sprints.length;
  const usedCount = velCfgResolved ? velCfgResolved.pastSprintCount : detected;
  const numStyle = { fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", boxSizing: "border-box" };

  const setUp = (patch) => onVelCfg({ upcoming: { ...up, ...patch } });
  const holidays = (up.start && up.end) ? VP.holidaysInRange(up.start, up.end) : [];

  return (
    <div className="person-card settings-card">
      <div className="section-label" style={{ margin: 0 }}>Sprint &amp; velocity</div>
      <div className="muted" style={{ fontSize: 12.5 }}>
        One cadence for the whole team — these settings are shared across every product; the product tabs just filter
        the view. Velocity per person = <b>(avg points per past sprint ÷ past-sprint length)</b> × <b>(upcoming working
        days − federal holidays − that person's leave)</b>. Holidays and each person's leave are pulled automatically.
      </div>

      {/* Past sprints → points/day basis */}
      <div className="section-label" style={{ marginTop: 14, marginBottom: 6, fontSize: 11.5 }}>Past sprints (history basis)</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label>Past sprint length (working days)</label>
          <input type="number" min={1} max={40} value={cfg.pastSprintDays || 10}
            onChange={(e) => onVelCfg({ pastSprintDays: Math.max(1, Math.min(40, Math.round(Number(e.target.value) || 10))) })}
            style={numStyle} />
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Divides the average to get points/day. Past sprints were 2-week = 10.</div>
        </div>
        <div className="field">
          <label>Sprints to average over</label>
          <input type="number" min={0} max={60} value={cfg.pastSprintCount || 0}
            onChange={(e) => onVelCfg({ pastSprintCount: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            style={numStyle} />
          <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
            0 = auto. Using <b>{usedCount || "—"}</b> ({detected} detected from your tickets). Empty sprints count as 0.
          </div>
        </div>
      </div>

      {/* Upcoming sprint → available days */}
      <div className="section-label" style={{ marginTop: 16, marginBottom: 6, fontSize: 11.5 }}>Upcoming sprint (the one you're planning)</div>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 10 }}>
        <div className="field">
          <label>Working days</label>
          <input type="number" min={0} max={40} value={up.workingDays || 0}
            onChange={(e) => setUp({ workingDays: Math.max(0, Math.min(40, Math.round(Number(e.target.value) || 0))) })}
            style={numStyle} />
        </div>
        <div className="field">
          <label>Start date</label>
          <DatePicker value={up.start || ""} onChange={(v) => setUp({ start: v })} placeholder="Pick start" />
        </div>
        <div className="field">
          <label>End date</label>
          <DatePicker value={up.end || ""} onChange={(v) => setUp({ end: v })} placeholder="Pick end" />
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {up.start && up.end ? (
          holidays.length
            ? <span>{holidays.length} federal holiday{holidays.length > 1 ? "s" : ""} in range ({holidays.map(fmtDate).join(", ")}) — subtracted for everyone. Leave is subtracted per person.</span>
            : <span>No federal holidays in range. Leave is subtracted per person from the leave calendar.</span>
        ) : <span>Pick the start and end dates so holidays and leave can be detected.</span>}
      </div>

      {/* Hide past sprints toggle */}
      <label className="opt-row" style={{ marginTop: 12 }}>
        <span>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Hide past sprints</div>
          <div className="muted" style={{ fontSize: 12 }}>Excludes earlier sprints from the planner tabs and the move-to menus.</div>
        </span>
        <span className="switch" data-on={hidePast} onClick={() => setHidePast(!hidePast)} role="switch" aria-checked={hidePast}>
          <span className="knob" />
        </span>
      </label>
    </div>
  );
}

/* ============================================================================
   ImportHistoryModal — paste / upload Jira issue-navigator HTML export
   ========================================================================== */
function ImportHistoryModal({ people, doneRes, onClose, onImport }) {
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!html.trim()) { setPreview(null); return; }
    setPreview(parseHistoricalHtml(html, people, doneRes));
  }, [html, people, doneRes]);

  function chooseFile() { fileRef.current?.click(); }
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setHtml(String(reader.result || ""));
    reader.readAsText(f);
    e.target.value = "";
  }
  function commit() {
    const r = onImport(html);
    if (r && r.ticketCount) onClose();
  }

  const peopleHit = preview ? Object.keys(preview.byPerson).length : 0;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ width: "min(640px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Seed velocity from Jira HTML export</h3>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>
            In Jira, run an issue-navigator query for completed tickets across the sprints you want to seed, then choose <b>Export · HTML</b>.
            Drop the file here (or paste its contents) — we'll bucket points per assignee per sprint and store them as starting velocity.
          </div>

          <div className="drop-zone" onClick={chooseFile} role="button" tabIndex={0}>
            <Icon name="download" size={18} />
            <div>
              <div style={{ fontWeight: 700 }}>{fileName ? fileName : "Choose an HTML export…"}</div>
              <div className="muted" style={{ fontSize: 12 }}>or paste the HTML below</div>
            </div>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" onChange={onFile} style={{ display: "none" }} />
          </div>

          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<html>…paste Jira export here…</html>"
            spellCheck={false}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 12, padding: 11, borderRadius: 9, minHeight: 140,
              border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", resize: "vertical",
            }} />

          {preview && (
            <div className="preview-strip" data-empty={!preview.ticketCount}>
              {preview.ticketCount ? (
                <React.Fragment>
                  <div className="metric"><span className="k">Tickets</span><span className="v">{preview.ticketCount}</span></div>
                  <div className="metric"><span className="k">People matched</span><span className="v">{peopleHit}</span></div>
                  <div className="metric"><span className="k">Sprints</span><span className="v">{preview.sprints.length}</span></div>
                  <div style={{ flex: 1 }} />
                  <div className="muted" style={{ fontSize: 11.5, fontFamily: "var(--font-mono)" }}>{preview.sprints.slice(0, 6).join(" · ")}</div>
                </React.Fragment>
              ) : (
                <div className="muted" style={{ fontSize: 12.5 }}>No matching rows yet — make sure the export contains assignee, points, and a sprint label.</div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!preview || !preview.ticketCount} onClick={commit}>
            Seed velocity {preview?.ticketCount ? `(${peopleHit} people)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   ImportIcalModal — drop a .ics, preview events, import as leave
   ========================================================================== */
function ImportIcalModal({ people, onClose, onImport }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!text.trim()) { setPreview(null); return; }
    setPreview(parseIcal(text, people));
  }, [text, people]);

  function chooseFile() { fileRef.current?.click(); }
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(f);
    e.target.value = "";
  }
  function commit() {
    const r = onImport(text);
    if (r && r.eventCount) onClose();
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ width: "min(640px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Import leave calendar (.ics)</h3>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>
            Export your team's leave calendar as iCalendar (.ics) — typically from Google Calendar (<i>Settings → Export</i>) or your HRIS.
            We match events to people by attendee or summary text, then subtract those days from sprint capacity.
          </div>

          <div className="drop-zone" onClick={chooseFile} role="button" tabIndex={0}>
            <Icon name="cal" size={18} />
            <div>
              <div style={{ fontWeight: 700 }}>{fileName ? fileName : "Choose a .ics file…"}</div>
              <div className="muted" style={{ fontSize: 12 }}>or paste the calendar contents below</div>
            </div>
            <input ref={fileRef} type="file" accept=".ics,text/calendar" onChange={onFile} style={{ display: "none" }} />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="BEGIN:VCALENDAR…END:VCALENDAR"
            spellCheck={false}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 12, padding: 11, borderRadius: 9, minHeight: 140,
              border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", resize: "vertical",
            }} />

          {preview && (
            <div className="preview-strip" data-empty={!preview.eventCount}>
              {preview.eventCount ? (
                <React.Fragment>
                  <div className="metric"><span className="k">Leave days</span><span className="v">{preview.eventCount}</span></div>
                  <div className="metric"><span className="k">People matched</span><span className="v">{preview.peopleHit}</span></div>
                  <div style={{ flex: 1 }} />
                  <div className="muted" style={{ fontSize: 11.5 }}>Weekends are skipped automatically.</div>
                </React.Fragment>
              ) : (
                <div className="muted" style={{ fontSize: 12.5 }}>No matching events — names in attendees or event titles need to match a team member.</div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!preview || !preview.eventCount} onClick={commit}>
            Import {preview?.eventCount ? `${preview.eventCount} day${preview.eventCount === 1 ? "" : "s"}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   ImportTicketsModal — paste / upload a Jira HTML export of backlog +
   in-sprint tickets. Populates the board, creates people from assignees,
   and adds any referenced sprints.
   ========================================================================== */
function ImportTicketsModal({ people, sprints, onClose, onImport }) {
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!html.trim()) { setPreview(null); return; }
    setPreview(parseBoardHtml(html));
  }, [html]);

  function chooseFile() { fileRef.current?.click(); }
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setHtml(String(reader.result || ""));
    reader.readAsText(f);
    e.target.value = "";
  }
  function commit() {
    const r = onImport(html);
    if (r && r.rowCount) onClose();
  }

  // New people / sprints this import would add (diffed against current state).
  const known = preview ? (() => {
    const byName = new Set(people.map((p) => p.name.trim().toLowerCase()));
    const bySid = new Set(people.filter((p) => p.sid).map((p) => p.sid.toLowerCase()));
    const newPeople = preview.assignees.filter((n) => {
      const k = n.trim().toLowerCase();
      return !byName.has(k) && !bySid.has(k);
    }).length;
    const have = new Set(sprints.map((s) => s.name));
    const newSprints = preview.sprintsSeen.filter((n) => !have.has(n)).length;
    return { newPeople, newSprints };
  })() : { newPeople: 0, newSprints: 0 };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ width: "min(640px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Import backlog &amp; sprint tickets</h3>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>
            In Jira, run an issue-navigator query for the tickets you want on the board, then choose <b>Export · HTML</b>.
            Drop the file here (or paste it) — we read Key, Summary, Assignee, Sprint, Epic, Story Points, and Description.
            Tickets with a sprint land in that sprint; the rest go to the backlog. <b>People are created from the assignees.</b>
          </div>

          <div className="drop-zone" onClick={chooseFile} role="button" tabIndex={0}>
            <Icon name="download" size={18} />
            <div>
              <div style={{ fontWeight: 700 }}>{fileName ? fileName : "Choose an HTML export…"}</div>
              <div className="muted" style={{ fontSize: 12 }}>or paste the HTML below</div>
            </div>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" onChange={onFile} style={{ display: "none" }} />
          </div>

          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<html>…paste Jira export here…</html>"
            spellCheck={false}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 12, padding: 11, borderRadius: 9, minHeight: 140,
              border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", resize: "vertical",
            }} />

          {preview && (
            <div className="preview-strip" data-empty={!preview.rowCount}>
              {preview.rowCount ? (
                <React.Fragment>
                  <div className="metric"><span className="k">Tickets</span><span className="v">{preview.rowCount}</span></div>
                  <div className="metric"><span className="k">In sprint</span><span className="v">{preview.inSprint}</span></div>
                  <div className="metric"><span className="k">Backlog</span><span className="v">{preview.backlog}</span></div>
                  <div className="metric"><span className="k">New people</span><span className="v">{known.newPeople}</span></div>
                  <div className="metric"><span className="k">New sprints</span><span className="v">{known.newSprints}</span></div>
                  <div style={{ flex: 1 }} />
                  <div className="muted" style={{ fontSize: 11.5, fontFamily: "var(--font-mono)" }}>
                    {["DX", "LX", "RC"].filter((p) => preview.projects[p]).map((p) => `${p} ${preview.projects[p]}`).join(" · ")}
                  </div>
                </React.Fragment>
              ) : (
                <div className="muted" style={{ fontSize: 12.5 }}>No tickets found — the export needs a table with a Key column (DX-…, LX-…, RCR-…).</div>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!preview || !preview.rowCount} onClick={commit}>
            Import {preview?.rowCount ? `${preview.rowCount} ticket${preview.rowCount === 1 ? "" : "s"}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Debug — shows exactly how every ticket is read and what feeds velocity.
   ========================================================================== */
function DebugView({ tickets, people, sprints, currentIdx, doneRes }) {
  const [q, setQ] = useState("");
  const doneSet = new Set((doneRes || []).map((r) => r.toLowerCase()));
  const idxByName = {}; sprints.forEach((s, i) => { idxByName[s.name] = i; });
  const personById = (id) => people.find((p) => p.id === id);
  const isDone = (t) => !!(t.resolution && doneSet.has(t.resolution.toLowerCase()));

  // Why a ticket does / doesn't feed velocity, mirroring deriveHistory exactly.
  function contribution(t) {
    if (!t.assignee) return { ok: false, why: "no assignee" };
    if (!isDone(t)) return { ok: false, why: t.resolution ? `resolution "${t.resolution}" not in Done list` : "no resolution" };
    const pts = Number(t.points) || 0;
    if (pts <= 0) return { ok: false, why: "points ≤ 0" };
    const sps = (t.sprints || []).filter(Boolean);
    if (!sps.length) return { ok: false, why: "no sprint (backlog)" };
    return { ok: true, why: `counts in ${sps.join(", ")}`, pts };
  }

  const derived = VP.deriveHistory(tickets, doneRes, sprints, currentIdx);

  // Group tickets by assignee (people first, then an Unassigned bucket).
  const groups = new Map();
  for (const t of tickets) {
    const k = t.assignee || "_none";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const ordered = [...groups.entries()]
    .map(([id, ts]) => ({ id, person: id === "_none" ? null : personById(id), tickets: ts }))
    .sort((a, b) => (a.id === "_none" ? 1 : b.id === "_none" ? -1 : (a.person?.name || a.id).localeCompare(b.person?.name || b.id)));

  const ql = q.trim().toLowerCase();
  const match = (g) => !ql || (g.person?.name || "unassigned").toLowerCase().includes(ql) || (g.person?.sid || "").toLowerCase().includes(ql);

  const cell = { padding: "4px 8px", borderBottom: "1px solid var(--border)", fontSize: 12, whiteSpace: "nowrap" };
  const head = { ...cell, color: "var(--text-faint)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, position: "sticky", top: 0, background: "var(--surface-2)" };

  return (
    <div className="wrap">
      <div className="team-head">
        <div>
          <h2>Debug</h2>
          <div className="sub">How each ticket is parsed and what feeds velocity. Velocity counts <b>Done</b> tickets with <b>points &gt; 0</b> assigned to a person, in a sprint <b>before the current one</b>.</div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter by name / sid…"
          style={{ fontSize: 13, padding: "8px 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", minWidth: 200 }} />
      </div>

      {/* Sprint calendar overview */}
      <div className="person-card settings-card" style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ margin: 0 }}>Sprints in the calendar ({sprints.length}) · current = index {currentIdx}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sprints.map((s, i) => {
            const rel = i === currentIdx ? "current" : i < currentIdx ? "past" : "future";
            const color = rel === "current" ? "var(--good)" : rel === "past" ? "var(--text-faint)" : "var(--accent)";
            return (
              <span key={s.id} className="res-chip" title={`index ${i} · ${rel}${VP.isUndated(s) ? " · undated" : ""}`}
                style={{ borderColor: color, color }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>{i}: {s.name || "(unnamed)"}</span>
              </span>
            );
          })}
        </div>
        <div className="muted" style={{ fontSize: 11.5 }}>Velocity counts a person's completed (Done, points&gt;0) work in <b>every</b> sprint listed here — duplicate / merged names here are the thing to watch for.</div>
      </div>

      {/* Per-assignee breakdown */}
      {ordered.filter(match).map((g) => {
        const series = g.id !== "_none" ? (derived[g.id] || []) : [];
        const sum = series.reduce((a, b) => a + b, 0);
        const avg = series.length ? sum / series.length : 0;
        const usesGoal = series.length < 2;
        const totalPts = g.tickets.reduce((a, t) => a + (Number(t.points) || 0), 0);
        const sorted = [...g.tickets].sort((a, b) => a.key.localeCompare(b.key));
        return (
          <div className="person-card" key={g.id} style={{ marginBottom: 14 }}>
            <div className="pc-head" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="pc-name">{g.person ? g.person.name : "Unassigned"}</div>
                <div className="pc-sid">{g.person ? `${g.person.project} · ${g.person.type} · sid: ${g.person.sid || "—"} · goal ${g.person.goal || 0}` : "no person"}</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                <div><b style={{ fontSize: 16 }}>{g.id !== "_none" ? (usesGoal ? (g.person?.goal || 0) : Math.round(avg)) : "—"}</b> velocity {g.id !== "_none" && usesGoal ? "(goal)" : ""}</div>
                <div className="muted">series [{series.join(", ")}] · {g.tickets.length} tickets · {totalPts} pts total</div>
              </div>
            </div>
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr>
                  <th style={head}>Key</th><th style={head}>Pts</th><th style={head}>Sprint(s)</th>
                  <th style={head}>Resolution</th><th style={head}>Feeds velocity?</th>
                  <th style={{ ...head, whiteSpace: "normal" }}>Summary</th>
                </tr></thead>
                <tbody>
                  {sorted.map((t) => {
                    const c = contribution(t);
                    return (
                      <tr key={t.id}>
                        <td style={{ ...cell, fontFamily: "var(--font-mono)", color: PROJ_COLOR[VP.projectForKey(t.key)] || "var(--text)" }}>{t.key}</td>
                        <td style={{ ...cell, fontFamily: "var(--font-mono)", textAlign: "right", fontWeight: 700 }}>{t.points}</td>
                        <td style={{ ...cell, fontFamily: "var(--font-mono)" }}>{(t.sprints || []).join(", ") || "—"}</td>
                        <td style={cell}>{t.resolution || "—"}</td>
                        <td style={{ ...cell, color: c.ok ? "var(--good)" : "var(--text-faint)" }}>{c.ok ? `✓ ${c.why}` : `✗ ${c.why}`}</td>
                        <td style={{ ...cell, whiteSpace: "normal", color: "var(--text-dim)", maxWidth: 360 }}>{t.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { Settings, ImportHistoryModal, ImportTicketsModal, ImportIcalModal, DebugView });
