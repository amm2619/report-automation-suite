/* Team / People management view + add/edit modal. */

function PersonCard({ person, onEdit, onRemove }) {
  const v = VP.velocity(person);
  const color = PROJ_COLOR[person.project];
  const max = Math.max(...(v.perSprint.length ? v.perSprint : [1]));
  return (
    <div className="person-card">
      <div className="pc-head">
        <Avatar name={person.name} proj={person.project} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="pc-name">{person.name}</div>
          <div className="pc-sid">{person.sid}</div>
        </div>
        <span className={"tag " + (person.type === "gov" ? "gov" : "con")}>{person.type === "gov" ? "GOV" : "CTR"}</span>
      </div>

      <div className="spark" title="Recent sprint points">
        {(v.perSprint.length ? v.perSprint : [0, 0, 0]).map((n, i) => (
          <i key={i} style={{ height: (8 + (n / max) * 22) + "px", background: n ? color : "var(--surface-3)" }} />
        ))}
      </div>

      <div className="pc-stats">
        <div className="pc-stat"><div className="v">{v.count ? v.average.toFixed(1) : "—"}</div><div className="k">Avg</div></div>
        <div className="pc-stat"><div className="v">{v.count}</div><div className="k">Sprints</div></div>
        <div className="pc-stat"><div className="v">{person.goal || "—"}</div><div className="k">Goal</div></div>
      </div>

      <div className="pc-actions">
        <button className="btn sm" onClick={() => onEdit(person)}><Icon name="edit" size={13} /> Edit</button>
        <button className="btn sm" onClick={() => onRemove(person)}><Icon name="trash" size={13} /> Remove</button>
      </div>
    </div>
  );
}

function PersonModal({ person, project, existingNames, projects, onSave, onClose }) {
  const editing = !!person;
  const [name, setName] = useState(person?.name || "");
  const [sid, setSid] = useState(person?.sid || "");
  const [type, setType] = useState(person?.type || "contractor");
  const [proj, setProj] = useState(person?.project || project);
  const [goal, setGoal] = useState(person?.goal || "");
  const [err, setErr] = useState("");

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    const nm = name.trim();
    if (!nm) { setErr("Name is required."); return; }
    const dupe = existingNames.some((n) => n.toLowerCase() === nm.toLowerCase() && (!editing || n.toLowerCase() !== person.name.toLowerCase()));
    if (dupe) { setErr("A person named “" + nm + "” already exists."); return; }
    onSave({ id: person?.id, name: nm, sid: sid.trim(), type, project: proj, goal: Number(goal) || 0 });
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{editing ? "Edit person" : "Add person"}</h3>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className={"field" + (err && !name.trim() ? " err" : "")}>
            <label>Name</label>
            <input value={name} autoFocus onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Jane Doe" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>SID (must match the program calendar)</label><input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="leave blank if you don't use one" style={{ fontFamily: "var(--font-mono)" }} /></div>
            <div className="field"><label>Goal points</label><input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="14" /></div>
          </div>
          <div className="field">
            <label>Type</label>
            <div className="seg">
              <button data-on={type === "contractor"} onClick={() => setType("contractor")}>Contractor</button>
              <button data-on={type === "gov"} onClick={() => setType("gov")}>Gov</button>
            </div>
          </div>
          <div className="field">
            <label>Primary project</label>
            <div className="seg">
              {projects.map((p) => (
                <button key={p.id} data-on={proj === p.id} onClick={() => setProj(p.id)} style={proj === p.id ? { color: PROJ_COLOR[p.id], borderColor: PROJ_COLOR[p.id], background: PROJ_DIM[p.id] } : {}}>{p.id}</button>
              ))}
            </div>
          </div>
          {err && <div className="msg" style={{ color: "var(--danger)", fontWeight: 600, fontSize: 12 }}>{err}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit}>{editing ? "Save changes" : "Add person"}</button>
        </div>
      </div>
    </div>
  );
}

function Team({ people, projects, currentProject, sprints, currentIdx, velCfg, historyDetail, onAdd, onEdit, onRemove }) {
  const [modal, setModal] = useState(null); // null | {person?}
  const [addProj, setAddProj] = useState(currentProject);
  const [tab, setTab] = useState("cards"); // 'cards' | 'velocity'
  const total = people.length;

  // One team in view at a time — scope to the active product tab.
  const shown = projects.filter((p) => p.id === currentProject);
  const scopedTotal = people.filter((p) => p.project === currentProject).length;

  return (
    <div className="wrap">
      <div className="team-head">
        <div>
          <h2>Team · {currentProject}</h2>
          <div className="sub">
            {scopedTotal} {scopedTotal === 1 ? "person" : "people"} ·{" "}
            {tab === "cards"
              ? "auto-created from ticket assignees on import"
              : "per-person velocity from completed historical tickets"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="mode-toggle" role="tablist" aria-label="Team view">
            <button data-active={tab === "cards"} onClick={() => setTab("cards")}>Cards</button>
            <button data-active={tab === "velocity"} onClick={() => setTab("velocity")}>Velocity</button>
          </div>
          <button className="btn primary" onClick={() => { setAddProj(currentProject); setModal({}); }}>
            <Icon name="plus" size={15} /> Add person
          </button>
        </div>
      </div>

      {shown.map((proj) => {
        const list = people.filter((p) => p.project === proj.id);
        const color = PROJ_COLOR[proj.id];
        const vrows = list.map((p) => ({ p, pv: VP.projectedVelocity(p, velCfg) }))
          .sort((a, b) => b.pv.velocity - a.pv.velocity);
        const teamVel = vrows.reduce((s, r) => s + r.pv.velocity, 0);

        return (
          <section className="team-section" key={proj.id}>
            <header className="team-section-head">
              <span className="dot" style={{ background: color }} />
              <h3>{proj.name}<span className="k">{proj.id}</span></h3>
              <span className="count">{list.length} {list.length === 1 ? "person" : "people"}</span>
              <div style={{ flex: 1 }} />
              {tab === "velocity" ? (
                <span className="chip" title="Projected team velocity for the upcoming sprint">
                  team velocity <b style={{ fontFamily: "var(--font-mono)", marginLeft: 4 }}>{teamVel || "—"}</b>
                </span>
              ) : (
                <button className="btn sm" onClick={() => { setAddProj(proj.id); setModal({ project: proj.id }); }}>
                  <Icon name="plus" size={12} /> Add
                </button>
              )}
            </header>

            {list.length === 0 ? (
              <div className="empty-state" style={{ padding: 28, fontSize: 13 }}>No people on {proj.id} yet.</div>
            ) : tab === "cards" ? (
              <div className="team-grid">
                {[...list].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                  <PersonCard key={p.id} person={p} onEdit={(pp) => setModal({ person: pp })} onRemove={onRemove} />
                ))}
              </div>
            ) : (
              <VelocityTable rows={vrows} historyDetail={historyDetail} />
            )}
          </section>
        );
      })}

      {modal && (
        <PersonModal
          person={modal.person} project={modal.project || addProj} projects={projects}
          existingNames={people.map((p) => p.name)}
          onClose={() => setModal(null)}
          onSave={(data) => { modal.person ? onEdit(data) : onAdd(data); setModal(null); }}
        />
      )}
    </div>
  );
}

/* ---- Velocity table (per-team) — mirrors the by-hand calc, column by column:
   avg/sprint → points/day → upcoming available days → projected velocity. ---- */
function VelocityTable({ rows, historyDetail }) {
  // Click a person's name to expand a breakdown of the sprints that fed their
  // velocity, with points per sprint.
  const [expanded, setExpanded] = useState({});
  const detail = historyDetail || {};
  return (
    <div className="tickets v-table" style={{ overflowX: "auto" }}>
      <div className="v-grid" style={{ gridTemplateColumns: `1fr 80px 84px 92px 96px`, minWidth: 520 }}>
        <div className="v-head">Person</div>
        <div className="v-head align-r" title="Total completed points ÷ number of past sprints (empty sprints count as 0)">Avg / sprint</div>
        <div className="v-head align-r" title="Avg ÷ past sprint length">Points / day</div>
        <div className="v-head align-r" title="Upcoming working days − holidays − leave">Avail days</div>
        <div className="v-head align-r" title="Points/day × available days — projected velocity for the upcoming sprint">Velocity</div>

        {rows.map(({ p, pv }, ri) => {
          const availTip = `${pv.gross} working days − ${pv.holidays} holiday${pv.holidays === 1 ? "" : "s"} − ${pv.leave} leave = ${pv.available}`;
          const avgTip = `${pv.totalPts} pts ÷ ${pv.sprintCount} sprints = ${pv.avgPerSprint.toFixed(2)}`;
          const ppdTip = `${pv.avgPerSprint.toFixed(2)} ÷ ${pv.pastDays} days = ${pv.pointsPerDay.toFixed(2)}`;
          const series = detail[p.id] || [];
          const isOpen = !!expanded[p.id];
          const toggle = () => setExpanded((m) => ({ ...m, [p.id]: !m[p.id] }));
          return (
            <React.Fragment key={p.id}>
              <div className="v-cell person-cell expandable" data-row={ri} data-open={isOpen} onClick={toggle} role="button" tabIndex={0} title="Show sprint-by-sprint breakdown">
                <span className="collapse-caret" aria-label={isOpen ? "Collapse" : "Expand"} style={{ display: "inline-flex" }}>
                  <Icon name="chev" size={13} />
                </span>
                <Avatar name={p.name} proj={p.project} className="av" />
                <div className="who">
                  <div className="nm">{p.name}</div>
                  <div className="sid">{p.sid}</div>
                </div>
              </div>
              <div className="v-cell align-r num" data-row={ri} title={avgTip} onClick={toggle}>{pv.totalPts ? pv.avgPerSprint.toFixed(1) : "—"}</div>
              <div className="v-cell align-r num dim" data-row={ri} title={ppdTip} onClick={toggle}>{pv.totalPts ? pv.pointsPerDay.toFixed(2) : "—"}</div>
              <div className="v-cell align-r num dim" data-row={ri} title={availTip} onClick={toggle}>{pv.available}</div>
              <div className="v-cell align-r num strong" data-row={ri} onClick={toggle}>{pv.totalPts ? pv.velocity : "—"}</div>

              {isOpen && (
                <div className="v-expand" data-row={ri} style={{ gridColumn: "1 / -1" }}>
                  {series.length ? (
                    <div className="v-expand-inner">
                      <div className="v-expand-head">Previous sprints · points per sprint</div>
                      <div className="v-spark-rows">
                        {series.map((s) => (
                          <div className="v-spark-row" key={s.name}>
                            <span className="sp-name">{s.name}</span>
                            <span className="sp-bar"><i style={{ width: pctOf(s.points, series) + "%", background: PROJ_COLOR[p.project] }} /></span>
                            <span className="sp-pts">{s.points}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="v-expand-inner muted" style={{ fontSize: 12 }}>No completed sprints feeding velocity yet — using {p.goal ? `goal (${p.goal})` : "no data"}.</div>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
function pctOf(n, series) {
  const max = Math.max(1, ...series.map((s) => s.points));
  return Math.max(4, Math.round((n / max) * 100));
}

window.Team = Team;
