/* Sprints tab — dictate the shared sprint calendar. Saved to its own file,
   separate from the main workspace data. One number per sprint, shared across
   every product (DX/LX/RC); each sprint is Past or Future, with working days,
   a start date, and a calculated end date. Future sprints are the ones being
   planned and don't count toward velocity; the earliest future sprint is what
   the Planner schedules. */
function Sprints({ sprints, projects, onAdd, onUpdate, onRemove, onDetect, onExport, onImport }) {
  const fileRef = useRef(null);
  const sorted = useMemo(
    () => [...sprints].sort((a, b) => VP.sprintSortKey(a.num) - VP.sprintSortKey(b.num)),
    [sprints]
  );
  const pastCount = sorted.filter((s) => s.status !== "future").length;
  const futureCount = sorted.length - pastCount;

  function pickFile() { fileRef.current?.click(); }
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onImport(String(reader.result || ""));
    reader.readAsText(f);
    e.target.value = "";
  }

  return (
    <div className="wrap">
      <div className="team-head">
        <div>
          <h2>Sprints</h2>
          <div className="sub">
            The shared sprint calendar — one number per sprint across {projects.map((p) => p.id).join(" / ")},
            kept in its own save file. {sorted.length} sprint{sorted.length === 1 ? "" : "s"} · {pastCount} past · {futureCount} future.
          </div>
        </div>
        <div className="row-8">
          <button className="btn" onClick={pickFile}><Icon name="download" size={14} className="rot-180" /> Import</button>
          <button className="btn" onClick={onExport}><Icon name="download" size={14} /> Export</button>
          <button className="btn" onClick={onDetect}><Icon name="history" size={14} /> Detect from tickets</button>
          <button className="btn primary" onClick={onAdd}><Icon name="plus" size={14} /> Add sprint</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
        </div>
      </div>

      <div className="person-card settings-card">
        <div className="muted">
          Each sprint has a number (e.g. <span className="mono">26.3.6</span>), a <b>Past / Future</b> status, working days, and a
          start date — the end date is calculated. <b>Future</b> sprints are the ones you're planning; their points don't count
          toward velocity, and the earliest future sprint is what the Planner schedules.
        </div>

        {sorted.length === 0 ? (
          <div className="empty-state pad28">No sprints yet — add one, or “Detect from tickets”.</div>
        ) : (
          <div className="scroll-x">
            <div className="sprint-grid">
              <div className="sprint-head">Sprint #</div>
              <div className="sprint-head">Projects</div>
              <div className="sprint-head">Status</div>
              <div className="sprint-head">Working days</div>
              <div className="sprint-head">Start date</div>
              <div className="sprint-head">End · calc</div>
              <div className="sprint-head" />
              {sorted.map((s) => (
                <React.Fragment key={s.id}>
                  <input className="num-field" value={s.num || ""} placeholder="26.3.6"
                    onChange={(e) => onUpdate(s.id, { num: e.target.value })} />
                  <div className="sprint-labels mono">{projects.map((p) => `${p.id} ${s.num || "—"}`).join(" · ")}</div>
                  <div className="seg sprint-status">
                    <button data-on={s.status !== "future"} onClick={() => onUpdate(s.id, { status: "past" })}>Past</button>
                    <button data-on={s.status === "future"} onClick={() => onUpdate(s.id, { status: "future" })}>Future</button>
                  </div>
                  <input type="number" min={0} max={40} className="num-field" value={s.workingDays || 0}
                    onChange={(e) => onUpdate(s.id, { workingDays: Math.max(0, Math.min(40, Math.round(Number(e.target.value) || 0))) })} />
                  <DatePicker value={s.start || ""} onChange={(v) => onUpdate(s.id, { start: v })} placeholder="Pick start" />
                  <div className="ro-field" title="Calculated from the start date + working days">
                    <Icon name="cal" size={13} />
                    <span className="mono">{s.end ? fmtDate(s.end) : "—"}</span>
                  </div>
                  <button className="iconbtn" onClick={() => onRemove(s.id)} aria-label="Remove sprint" title="Remove"><Icon name="trash" size={14} /></button>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
window.Sprints = Sprints;
