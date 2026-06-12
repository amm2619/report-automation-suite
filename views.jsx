/* Settings view + Sprint cadence + import modals + Debug. */

/* ============================================================================
   Settings
   ========================================================================== */
function Settings({
  jiraBase, setJiraBase,
  doneRes, setDoneRes, customRes, setCustomRes,
  sprints, people,
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
    <div className="wrap narrow">
      <div className="team-head">
        <div><h2>Settings</h2><div className="sub">Project-agnostic · applies across {VP.PROJECTS.map((p) => p.id).join(" / ")}</div></div>
        <div className="row-8">
          <button className="btn" onClick={pickFile}><Icon name="download" size={14} className="rot-180" /> Import data</button>
          <button className="btn primary" onClick={onExportData}><Icon name="download" size={14} /> Export data</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFileChosen} className="hidden" />
        </div>
      </div>

      <div className="person-card settings-card">
        <div className="row-12">
          <div className="grow">
            <div className="section-label m0">Tickets · Jira HTML import</div>
            <div className="muted">
              Import the backlog and in-sprint tickets from a Jira issue-navigator <b>Export · HTML</b>.
              People are created from the assignees, and any sprint the export references is added to the calendar.
              Use <b>Velocity history</b> to seed each person's rolling average from completed tickets.
            </div>
          </div>
          <button className="btn" onClick={onOpenImportHistory}><Icon name="download" size={14} /> Velocity history</button>
          <button className="btn primary" onClick={onOpenImportTickets}><Icon name="download" size={14} /> Import tickets</button>
        </div>
      </div>

      <div className="person-card settings-card">
        <div className="section-label m0">Jira base URL</div>
        <div className="muted">Makes ticket keys clickable <span className="mono">…/browse/KEY</span> links.</div>
        <input value={jiraBase} onChange={(e) => setJiraBase(e.target.value)} placeholder="https://jira.example.com"
          className="text-input mono" />
      </div>

      <div className="person-card settings-card">
        <div className="section-label m0">Done resolutions</div>
        <div className="muted">Which resolutions count as completed when computing velocity. Add custom strings to match your Jira instance.</div>
        <div className="row-wrap-8">
          {allRes.map((r) => {
            const on = doneRes.includes(r);
            const custom = customRes.includes(r);
            return (
              <span key={r} className="res-chip" data-on={on}>
                <button className="chip-toggle" onClick={() => setDoneRes(on ? doneRes.filter((x) => x !== r) : [...doneRes, r])}>
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
      <div className="person-card settings-card">
        <div className="row-12">
          <div className="grow">
            <div className="section-label m0">Leave calendar · iCal import</div>
            <div className="muted">
              Drop a .ics export from your team calendar — OOO / PTO / leave events get matched to people and subtracted from sprint capacity.
              {importedLeaveCount > 0 && <> · <b className="good">{importedLeaveCount} day{importedLeaveCount === 1 ? "" : "s"} loaded</b></>}
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
      />

      {/* Data — auto-save, folder sync, clear */}
      <div className="person-card settings-card mt16">
        <div className="row-12">
          <div className="grow">
            <div className="section-label m0">Data</div>
            <div className="muted">
              Everything you import or edit is saved automatically in this browser and restored on refresh.
              Use <b>Export data</b> (top right) to keep a one-off copy. Clearing wipes the workspace back to empty.
            </div>
          </div>
          <button className="btn danger-outline" onClick={() => setConfirmClear(true)}>
            <Icon name="trash" size={14} /> Clear all data
          </button>
        </div>

        {/* Folder auto-save */}
        <div className="opt-row static">
          <span>
            <div className="opt-title">Auto-save to a folder</div>
            {!fsSupported ? (
              <div className="muted">
                Needs Chrome/Edge served over <span className="mono">http://localhost</span> (run <span className="mono">npm start</span>). Export/Import still works everywhere.
              </div>
            ) : folder ? (
              folderReconnect ? (
                <div className="muted">
                  Linked to <b>{folder.name}</b> — reconnect to resume writing <span className="mono">velocity-data.json</span>.
                </div>
              ) : (
                <div className="muted">
                  Auto-saving to <b>{folder.name}</b><span className="mono">/velocity-data.json</span>.
                </div>
              )
            ) : (
              <div className="muted">
                Pick a folder once; the app keeps <span className="mono">velocity-data.json</span> there in sync.
              </div>
            )}
          </span>
          {fsSupported && (
            folder ? (
              <span className="row-8">
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
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Clear all data?</h3></div>
            <div className="modal-body">
              <div className="muted">
                This removes all people, tickets, leave, and resets the sprint calendar and settings.
                Export first if you want to keep a copy. This can't be undone.
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button className="btn danger-fill"
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
    <div className="person-card settings-card">
      <div className="section-label m0">Manual leave</div>
      <div className="muted">
        Add ad-hoc leave days for anyone with a SID set in the Team tab. These are kept separate from iCal-imported leave and survive Clear.
      </div>

      <div className="manual-grid">
        <div className="field">
          <label>Person</label>
          <select className="twk-field select-field" value={sid} onChange={(e) => setSid(e.target.value)}>
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
        <label className="opt-row half-day">
          <span className="opt-title">Half day</span>
          <span className="switch" data-on={half} onClick={(e) => { e.stopPropagation(); setHalf(!half); }} role="switch" aria-checked={half}>
            <span className="knob" />
          </span>
        </label>
        <button className="btn primary h38" onClick={commit} disabled={!sid || !date}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>

      {withSid.length === 0 && (
        <div className="muted">
          Nobody has a SID yet — open the Team tab, edit a person, and fill in their SID.
        </div>
      )}

      {grouped.length > 0 && (
        <div className="col-10 mt6">
          {grouped.map(({ sid: s, person, records: list }) => (
            <div key={s} className="row-10-top">
              <div className="leave-person">
                <div className="bold">{person ? person.name : s}</div>
                <div className="muted mono">{s}</div>
              </div>
              <div className="row-wrap-6 grow">
                {list.map((r) => (
                  <span key={r.sid + "|" + r.date} className="res-chip" data-on="true" title={r.frac === 0.5 ? "Half day" : "Full day"}>
                    <span className="mono">{r.date}</span>
                    {r.frac === 0.5 && <span className="half-tag">·½</span>}
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
function SprintSettingsCard({ sprints, velCfg, velCfgResolved, onVelCfg }) {
  const cfg = velCfg || {};
  const usedCount = velCfgResolved ? velCfgResolved.pastSprintCount : sprints.length;
  const upName = (velCfgResolved && velCfgResolved.upcoming && velCfgResolved.upcoming.name) || "";
  const pastCount = sprints.filter((s) => s.name !== upName).length;

  return (
    <div className="person-card settings-card">
      <div className="section-label m0">Velocity basis</div>
      <div className="muted">
        Velocity per person = <b>(avg points per past sprint ÷ past-sprint length)</b> × <b>(upcoming working
        days − federal holidays − that person's leave)</b>. Holidays and leave are pulled automatically. The sprint
        calendar itself — which sprints are past or future, and their dates — is now defined in the <b>Sprints</b> tab.
      </div>

      <div className="section-label sub-label">Past sprints (history basis)</div>
      <div className="grid-2">
        <div className="field">
          <label>Past sprint length (working days)</label>
          <input type="number" min={1} max={40} value={cfg.pastSprintDays || 10}
            onChange={(e) => onVelCfg({ pastSprintDays: Math.max(1, Math.min(40, Math.round(Number(e.target.value) || 10))) })}
            className="num-field" />
          <div className="muted mt4">Divides the average to get points/day. Past sprints were 2-week = 10.</div>
        </div>
        <div className="field">
          <label>Sprints to average over</label>
          <input type="number" min={0} max={60} value={cfg.pastSprintCount || 0}
            onChange={(e) => onVelCfg({ pastSprintCount: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            className="num-field" />
          <div className="muted mt4">
            0 = auto. Using <b>{usedCount || "—"}</b> ({pastCount} past sprint{pastCount === 1 ? "" : "s"} defined). Empty sprints count as 0.
          </div>
        </div>
      </div>
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
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Seed velocity from Jira HTML export</h3>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="muted mt-neg4">
            In Jira, run an issue-navigator query for completed tickets across the sprints you want to seed, then choose <b>Export · HTML</b>.
            Drop the file here (or paste its contents) — we'll bucket points per assignee per sprint and store them as starting velocity.
          </div>

          <div className="drop-zone" onClick={chooseFile} role="button" tabIndex={0}>
            <Icon name="download" size={18} />
            <div>
              <div className="bold">{fileName ? fileName : "Choose an HTML export…"}</div>
              <div className="muted">or paste the HTML below</div>
            </div>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" onChange={onFile} className="hidden" />
          </div>

          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<html>…paste Jira export here…</html>"
            spellCheck={false}
            className="paste-area" />

          {preview && (
            <div className="preview-strip" data-empty={!preview.ticketCount}>
              {preview.ticketCount ? (
                <React.Fragment>
                  <div className="metric"><span className="k">Tickets</span><span className="v">{preview.ticketCount}</span></div>
                  <div className="metric"><span className="k">People matched</span><span className="v">{peopleHit}</span></div>
                  <div className="metric"><span className="k">Sprints</span><span className="v">{preview.sprints.length}</span></div>
                  <div className="spacer" />
                  <div className="muted mono">{preview.sprints.slice(0, 6).join(" · ")}</div>
                </React.Fragment>
              ) : (
                <div className="muted">No matching rows yet — make sure the export contains assignee, points, and a sprint label.</div>
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
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Import leave calendar (.ics)</h3>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="muted mt-neg4">
            Export your team's leave calendar as iCalendar (.ics) — typically from Google Calendar (<i>Settings → Export</i>) or your HRIS.
            We match events to people by attendee or summary text, then subtract those days from sprint capacity.
          </div>

          <div className="drop-zone" onClick={chooseFile} role="button" tabIndex={0}>
            <Icon name="cal" size={18} />
            <div>
              <div className="bold">{fileName ? fileName : "Choose a .ics file…"}</div>
              <div className="muted">or paste the calendar contents below</div>
            </div>
            <input ref={fileRef} type="file" accept=".ics,text/calendar" onChange={onFile} className="hidden" />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="BEGIN:VCALENDAR…END:VCALENDAR"
            spellCheck={false}
            className="paste-area" />

          {preview && (
            <div className="preview-strip" data-empty={!preview.eventCount}>
              {preview.eventCount ? (
                <React.Fragment>
                  <div className="metric"><span className="k">Leave days</span><span className="v">{preview.eventCount}</span></div>
                  <div className="metric"><span className="k">People matched</span><span className="v">{preview.peopleHit}</span></div>
                  <div className="spacer" />
                  <div className="muted">Weekends are skipped automatically.</div>
                </React.Fragment>
              ) : (
                <div className="muted">No matching events — names in attendees or event titles need to match a team member.</div>
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
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Import backlog &amp; sprint tickets</h3>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="muted mt-neg4">
            In Jira, run an issue-navigator query for the tickets you want on the board, then choose <b>Export · HTML</b>.
            Drop the file here (or paste it) — we read Key, Summary, Assignee, Sprint, Epic, Story Points, and Description.
            Tickets with a sprint land in that sprint; the rest go to the backlog. <b>People are created from the assignees.</b>
          </div>

          <div className="drop-zone" onClick={chooseFile} role="button" tabIndex={0}>
            <Icon name="download" size={18} />
            <div>
              <div className="bold">{fileName ? fileName : "Choose an HTML export…"}</div>
              <div className="muted">or paste the HTML below</div>
            </div>
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" onChange={onFile} className="hidden" />
          </div>

          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<html>…paste Jira export here…</html>"
            spellCheck={false}
            className="paste-area" />

          {preview && (
            <div className="preview-strip" data-empty={!preview.rowCount}>
              {preview.rowCount ? (
                <React.Fragment>
                  <div className="metric"><span className="k">Tickets</span><span className="v">{preview.rowCount}</span></div>
                  <div className="metric"><span className="k">In sprint</span><span className="v">{preview.inSprint}</span></div>
                  <div className="metric"><span className="k">Backlog</span><span className="v">{preview.backlog}</span></div>
                  <div className="metric"><span className="k">New people</span><span className="v">{known.newPeople}</span></div>
                  <div className="metric"><span className="k">New sprints</span><span className="v">{known.newSprints}</span></div>
                  <div className="spacer" />
                  <div className="muted mono">
                    {["DX", "LX", "RC"].filter((p) => preview.projects[p]).map((p) => `${p} ${preview.projects[p]}`).join(" · ")}
                  </div>
                </React.Fragment>
              ) : (
                <div className="muted">No tickets found — the export needs a table with a Key column (DX-…, LX-…, RCR-…).</div>
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
function DebugView({ tickets, people, sprints, currentIdx, doneRes, project, plannedSprints, onVelocityOverride }) {
  const [q, setQ] = useState("");
  // Row sort, shared across every person's table. Click a column header to sort.
  const [sort, setSort] = useState({ key: "ticket", dir: 1 });
  // Person-group order: alphabetical by name, or by projected velocity.
  const [groupSort, setGroupSort] = useState("person");
  const doneSet = new Set((doneRes || []).map((r) => r.toLowerCase()));
  const plannedSet = new Set((plannedSprints || []).map((s) => String(s)));
  const personById = (id) => people.find((p) => p.id === id);
  const isDone = (t) => !!(t.resolution && doneSet.has(t.resolution.toLowerCase()));

  // Only the active project's tickets — Debug follows the top-bar project tab.
  const scoped = useMemo(
    () => (tickets || []).filter((t) => VP.projectForKey(t.key) === project),
    [tickets, project]
  );

  // Why a ticket does / doesn't feed velocity, mirroring deriveHistoryDetail.
  function contribution(t) {
    const ov = VP.velocityOverride(t); // null | "include" | "exclude"
    if (!t.assignee) return { ok: false, why: "no assignee" };
    if (ov === "exclude") return { ok: false, why: "excluded from velocity" };
    const pts = Number(t.points) || 0;
    const sps = (t.sprints || []).filter(Boolean);
    if (ov === "include") {
      if (pts <= 0) return { ok: false, why: "force-added, but points ≤ 0" };
      if (!sps.length) return { ok: false, why: "force-added, but no sprint to attribute" };
      return { ok: true, why: `force-added in ${sps.join(", ")}`, pts };
    }
    if (!isDone(t)) return { ok: false, why: t.resolution ? `resolution "${t.resolution}" not in Done list` : "no resolution" };
    if (pts <= 0) return { ok: false, why: "points ≤ 0" };
    if (!sps.length) return { ok: false, why: "no sprint (backlog)" };
    const counted = sps.filter((s) => !plannedSet.has(String(s)));
    if (!counted.length) return { ok: false, why: `sprint ${sps.join(", ")} still being planned` };
    return { ok: true, why: `counts in ${counted.join(", ")}`, pts };
  }

  const derived = VP.deriveHistory(tickets, doneRes, sprints, currentIdx, { excludeSprints: plannedSprints });

  // Group the scoped tickets by assignee (people first, then Unassigned).
  const groups = new Map();
  for (const t of scoped) {
    const k = t.assignee || "_none";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const velocityFor = (id) => {
    const series = id !== "_none" ? (derived[id] || []) : [];
    return series.length ? series.reduce((a, b) => a + b, 0) / series.length : 0;
  };
  const ordered = [...groups.entries()]
    .map(([id, ts]) => ({ id, person: id === "_none" ? null : personById(id), tickets: ts }))
    .sort((a, b) => {
      if (a.id === "_none") return 1;
      if (b.id === "_none") return -1;
      if (groupSort === "velocity") return velocityFor(b.id) - velocityFor(a.id);
      return (a.person?.name || a.id).localeCompare(b.person?.name || b.id);
    });

  // Row comparator for the chosen column.
  const sprintKey = (t) => (t.sprints || []).map((s) => VP.sprintSortKey(s)).sort((x, y) => x - y)[0] ?? Infinity;
  function compareRows(a, b) {
    let r = 0;
    if (sort.key === "ticket") r = a.key.localeCompare(b.key);
    else if (sort.key === "pts") r = (Number(a.points) || 0) - (Number(b.points) || 0);
    else if (sort.key === "sprints") r = sprintKey(a) - sprintKey(b) || (a.sprints || []).join().localeCompare((b.sprints || []).join());
    if (r === 0) r = a.key.localeCompare(b.key);
    return r * sort.dir;
  }
  const toggleSort = (key) => setSort((s) => s.key === key ? { key, dir: -s.dir } : { key, dir: 1 });
  const arrow = (key) => sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "";

  const ql = q.trim().toLowerCase();
  const match = (g) => !ql || (g.person?.name || "unassigned").toLowerCase().includes(ql) || (g.person?.sid || "").toLowerCase().includes(ql);

  return (
    <div className="wrap">
      <div className="team-head">
        <div>
          <h2>Debug · {project}</h2>
          <div className="sub">How each <b>{project}</b> ticket is parsed and what feeds velocity. Velocity counts <b>Done</b> tickets with <b>points &gt; 0</b> assigned to a person, in a sprint that isn't being planned and isn't excluded.</div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter by name / sid…"
          className="text-input min200" />
      </div>

      {/* Sprint calendar overview */}
      <div className="person-card settings-card">
        <div className="section-label m0">Sprints in the calendar ({sprints.length}) · current = index {currentIdx}</div>
        <div className="row-wrap-6">
          {sprints.map((s, i) => {
            const planned = plannedSet.has(String(s.name));
            const rel = planned ? "planning" : i === currentIdx ? "current" : i < currentIdx ? "past" : "future";
            const color = planned ? "var(--rc)" : rel === "current" ? "var(--good)" : rel === "past" ? "var(--text-faint)" : "var(--accent)";
            return (
              <span key={s.id} className="res-chip tinted" title={`index ${i} · ${rel}${VP.isUndated(s) ? " · undated" : ""}`}
                style={{ "--chip-color": color }}>
                <span className="mono">{i}: {s.name || "(unnamed)"}</span>
              </span>
            );
          })}
        </div>
        <div className="muted">Velocity counts a person's completed (Done, points&gt;0) work in every past sprint — sprints still being planned (in <b className="rc-text">red</b>) and tickets marked excluded never count.</div>
      </div>

      {/* Group ordering control */}
      <div className="row-8 mb12">
        <span className="muted bold">Order people by</span>
        <div className="mode-toggle" role="tablist" aria-label="Order people">
          <button data-active={groupSort === "person"} onClick={() => setGroupSort("person")}>Person</button>
          <button data-active={groupSort === "velocity"} onClick={() => setGroupSort("velocity")}>Velocity</button>
        </div>
        <span className="muted">Click a column header below to sort rows by ticket, pts, or sprints.</span>
      </div>

      {/* Per-assignee breakdown */}
      {ordered.filter(match).map((g) => {
        const series = g.id !== "_none" ? (derived[g.id] || []) : [];
        const sum = series.reduce((a, b) => a + b, 0);
        const avg = series.length ? sum / series.length : 0;
        const usesGoal = series.length < 2;
        const totalPts = g.tickets.reduce((a, t) => a + (Number(t.points) || 0), 0);
        const sorted = [...g.tickets].sort(compareRows);
        return (
          <div className="person-card mb14" key={g.id}>
            <div className="pc-head spread">
              <div>
                <div className="pc-name">{g.person ? g.person.name : "Unassigned"}</div>
                <div className="pc-sid">{g.person ? `${g.person.project} · ${g.person.type} · sid: ${g.person.sid || "—"} · goal ${g.person.goal || 0}` : "no person"}</div>
              </div>
              <div className="dbg-vel-sum">
                <div><b>{g.id !== "_none" ? (usesGoal ? (g.person?.goal || 0) : Math.round(avg)) : "—"}</b> velocity {g.id !== "_none" && usesGoal ? "(goal)" : ""}</div>
                <div className="muted">series [{series.join(", ")}] · {g.tickets.length} tickets · {totalPts} pts total</div>
              </div>
            </div>
            <div className="scroll-x mt8">
              <table className="dbg-table">
                <thead><tr>
                  <th className="sortable" data-active={sort.key === "ticket"} onClick={() => toggleSort("ticket")}>Key{arrow("ticket")}</th>
                  <th className="sortable" data-active={sort.key === "pts"} onClick={() => toggleSort("pts")}>Pts{arrow("pts")}</th>
                  <th className="sortable" data-active={sort.key === "sprints"} onClick={() => toggleSort("sprints")}>Sprint(s){arrow("sprints")}</th>
                  <th>Resolution</th><th>Feeds velocity?</th>
                  <th className="ta-c">Velocity</th>
                  <th className="wrap-normal">Summary</th>
                </tr></thead>
                <tbody>
                  {sorted.map((t) => {
                    const c = contribution(t);
                    const ov = VP.velocityOverride(t);
                    return (
                      <tr key={t.id} data-excluded={ov === "exclude"}>
                        <td className="key" style={{ "--key-color": PROJ_COLOR[VP.projectForKey(t.key)] || "var(--text)" }}>{t.key}</td>
                        <td className="mono ta-r">{t.points}</td>
                        <td className="mono">{(t.sprints || []).join(", ") || "—"}</td>
                        <td>{t.resolution || "—"}</td>
                        <td className="feeds" data-ok={c.ok}>{c.ok ? `✓ ${c.why}` : `✗ ${c.why}`}</td>
                        <td className="ta-c">
                          <div className="seg vel-seg" onClick={(e) => e.stopPropagation()}>
                            <button data-on={!ov} onClick={() => onVelocityOverride(t.id, null)} title="Follow the automatic rules">Auto</button>
                            <button data-on={ov === "include"} onClick={() => onVelocityOverride(t.id, "include")} title="Always count this ticket toward velocity">Add</button>
                            <button data-on={ov === "exclude"} onClick={() => onVelocityOverride(t.id, "exclude")} title="Never count this ticket toward velocity">Excl</button>
                          </div>
                        </td>
                        <td className="summary">{t.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {ordered.filter(match).length === 0 && (
        <div className="empty-state pad28">No {project} tickets to show.</div>
      )}
    </div>
  );
}

Object.assign(window, { Settings, ImportHistoryModal, ImportTicketsModal, ImportIcalModal, DebugView });
