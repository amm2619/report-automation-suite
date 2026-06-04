/* Settings view + ImportHistoryModal + ImportIcalModal + SprintEditor. */

/* ============================================================================
   Settings
   ========================================================================== */
function Settings({
  jiraBase, setJiraBase,
  doneRes, setDoneRes, customRes, setCustomRes,
  sprints, currentIdx, people,
  hidePast, setHidePast,
  leaveOverlay, onClearImportedLeave, onAddLeave, onRemoveLeave,
  onAddSprint, onEditSprint, onRemoveSprint, onSetCurrent,
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

      {/* Sprint calendar */}
      <SprintCalendarCard
        sprints={sprints}
        currentIdx={currentIdx}
        hidePast={hidePast}
        setHidePast={setHidePast}
        onAddSprint={onAddSprint}
        onEditSprint={onEditSprint}
        onRemoveSprint={onRemoveSprint}
        onSetCurrent={onSetCurrent}
        toast={toast}
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
   Sprint calendar card — add / edit / remove sprints inline
   ========================================================================== */
function SprintCalendarCard({ sprints, currentIdx, hidePast, setHidePast, onAddSprint, onEditSprint, onRemoveSprint, onSetCurrent, toast }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmRm, setConfirmRm] = useState(null);

  // suggest a next sprint name + dates based on the last DATED one
  const last = [...sprints].reverse().find((s) => s.start && s.end) || sprints[sprints.length - 1];
  function nextSuggested() {
    if (!last || !last.end) return { name: "", start: "", end: "" };
    // bump last segment
    const parts = last.name.split(".");
    const tail = parseInt(parts[parts.length - 1], 10);
    const name = isNaN(tail) ? last.name + ".1" : [...parts.slice(0, -1), tail + 1].join(".");
    // start = day after last.end, skip weekends
    const [y, m, d] = last.end.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + 1);
    while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
    const start = dt.toISOString().slice(0, 10);
    dt.setDate(dt.getDate() + 11);
    const end = dt.toISOString().slice(0, 10);
    return { name, start, end };
  }

  return (
    <div className="person-card settings-card">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="section-label" style={{ margin: 0 }}>Sprint calendar · {sprints.length} sprint{sprints.length === 1 ? "" : "s"}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>Add, edit, or remove sprints. Click <Icon name="check" size={11} /> to set a sprint as <i>current</i>.</div>
        </div>
        <button className="btn primary" onClick={() => { setAddOpen(true); setEditingId(null); }}>
          <Icon name="calplus" size={14} /> Add sprint
        </button>
      </div>

      {/* Hide past sprints toggle */}
      <label className="opt-row">
        <span>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Hide past sprints</div>
          <div className="muted" style={{ fontSize: 12 }}>Excludes past sprints everywhere — nav, planner tabs, assignee, and move-to dropdowns. Tickets can't be assigned to a hidden sprint.</div>
        </span>
        <span className="switch" data-on={hidePast} onClick={() => setHidePast(!hidePast)} role="switch" aria-checked={hidePast}>
          <span className="knob" />
        </span>
      </label>

      <div className="sprint-list">
        {sprints.map((s, i) => {
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx;
          const isUndated = !s.start || !s.end;
          if (editingId === s.id) {
            return (
              <SprintEditor
                key={s.id}
                initial={s}
                title="Edit sprint"
                onCancel={() => setEditingId(null)}
                onSave={(patch) => { onEditSprint(s.id, patch); setEditingId(null); toast(`Updated ${patch.name || s.name}`); }}
              />
            );
          }
          return (
            <div key={s.id} className="sprint-row" data-when={isUndated ? "undated" : isCurrent ? "current" : isPast ? "past" : "future"}>
              <span className={"sprint-badge " + (isUndated ? "open" : isCurrent ? "now" : isPast ? "past" : "future")} title={isUndated ? "No fixed dates" : isCurrent ? "Current sprint" : isPast ? "Past" : "Upcoming"}>
                {isUndated ? "OPEN" : isCurrent ? "NOW" : isPast ? "PAST" : "NEXT"}
              </span>
              <span className="sprint-name">{s.name}</span>
              <span className="muted sprint-dates">{isUndated ? "No fixed dates" : fmtRange(s.start, s.end)}</span>
              <div style={{ flex: 1 }} />
              {!isCurrent && !isUndated && (
                <button className="iconbtn" title="Set as current" style={{ width: 28, height: 28 }} onClick={() => onSetCurrent(i)}>
                  <Icon name="check" size={13} />
                </button>
              )}
              <button className="iconbtn" title="Edit" style={{ width: 28, height: 28 }} onClick={() => { setEditingId(s.id); setAddOpen(false); }}>
                <Icon name="edit" size={13} />
              </button>
              <button className="iconbtn" title="Remove" style={{ width: 28, height: 28 }} onClick={() => setConfirmRm(s)} disabled={isCurrent}>
                <Icon name="trash" size={13} />
              </button>
            </div>
          );
        })}

        {addOpen && (
          <SprintEditor
            initial={nextSuggested()}
            title="New sprint"
            onCancel={() => setAddOpen(false)}
            onSave={(s) => { onAddSprint(s); setAddOpen(false); }}
          />
        )}
      </div>

      {confirmRm && (
        <div className="modal-scrim" onClick={() => setConfirmRm(null)}>
          <div className="modal" style={{ width: "min(380px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Remove sprint {confirmRm.name}?</h3></div>
            <div className="modal-body">
              <div className="muted" style={{ fontSize: 13 }}>Tickets assigned to this sprint will fall back to the backlog. This can't be undone.</div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirmRm(null)}>Cancel</button>
              <button className="btn" style={{ background: "color-mix(in oklch, var(--danger) 18%, var(--surface-2))", borderColor: "var(--danger)", color: "var(--text)" }}
                onClick={() => { onRemoveSprint(confirmRm.id); setConfirmRm(null); }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Inline editor for add / edit sprint — Start + working-days -> auto end */
function SprintEditor({ initial, title, onCancel, onSave }) {
  const [name, setName] = useState(initial.name || "");
  const [start, setStart] = useState(initial.start || "");
  // "Undated" sprint = a planning bucket with no committed timeframe.
  // Default on when editing a sprint that already has no dates.
  const [undated, setUndated] = useState(!!initial.name && !initial.start);
  // derive starting day-count from initial range (if editing), else 10
  const initialDays = useMemo(() => {
    if (initial.start && initial.end) {
      return VP.sprintWorkDays({ start: initial.start, end: initial.end }).length || 10;
    }
    return 10;
  }, [initial.start, initial.end]);
  const [days, setDays] = useState(initialDays);
  const [err, setErr] = useState("");

  const end = useMemo(() => endDateFromWorkDays(start, Number(days) || 0), [start, days]);
  const holidayCount = useMemo(() => {
    if (!start || !end) return 0;
    return VP.holidaysInRange(start, end).length;
  }, [start, end]);

  function commit() {
    if (!name.trim()) return setErr("Name is required");
    if (undated) { onSave({ name: name.trim(), start: null, end: null }); return; }
    if (!start) return setErr("Pick a start date");
    if (!days || days < 1) return setErr("Sprint length must be at least 1 day");
    if (!end) return setErr("Couldn't compute end date — try a different start");
    onSave({ name: name.trim(), start, end });
  }

  return (
    <div className="sprint-editor">
      <div className="se-title">{title}</div>
      <div className={"se-fields" + (undated ? " undated" : "")}>
        <div className="field">
          <label>Sprint name</label>
          <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="26.3.3" autoFocus
            style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }} />
        </div>
        {!undated && (
          <React.Fragment>
            <div className="field">
              <label>Start date</label>
              <DatePicker value={start} onChange={(v) => { setStart(v); setErr(""); }} placeholder="Pick start" />
            </div>
            <div className="field">
              <label>Working days</label>
              <input type="number" min={1} max={60} value={days}
                onChange={(e) => { setDays(e.target.value); setErr(""); }}
                style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }} />
            </div>
          </React.Fragment>
        )}
      </div>

      {/* No-fixed-dates toggle */}
      <label className="se-undated">
        <span className="switch" data-on={undated} onClick={() => { setUndated((u) => !u); setErr(""); }} role="switch" aria-checked={undated}>
          <span className="knob" />
        </span>
        <span>
          <span className="lbl">No fixed dates</span>
          <span className="hint">A planning bucket — capacity falls back to each person's base velocity until you commit a timeframe.</span>
        </span>
      </label>

      {!undated && (
        <div className="se-end">
          <span className="lbl">End date (calculated)</span>
          <span className="val">{end ? new Date(end + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
          {holidayCount > 0 && <span className="hol-note"><Icon name="cal" size={11} /> skipped {holidayCount} federal holiday{holidayCount === 1 ? "" : "s"}</span>}
        </div>
      )}
      {err && <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 600, marginTop: 4 }}>{err}</div>}
      <div className="se-foot">
        <div style={{ flex: 1 }} />
        <button className="btn sm" onClick={onCancel}>Cancel</button>
        <button className="btn primary sm" onClick={commit}>Save sprint</button>
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

Object.assign(window, { Settings, ImportHistoryModal, ImportTicketsModal, ImportIcalModal });
