/* Planner view: single + multi sprint. */

function pct(n, d) { return d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0; }

/* ---- capacity card ---- */
function CapCard({ person, assigned, cap, wfhUsed, holidays }) {
  const color = PROJ_COLOR[person.project];
  const over = assigned > cap.adjusted;
  const wfhOver = cap.wfhPoints != null && wfhUsed > cap.wfhPoints;
  const officeUsed = Math.max(0, assigned - wfhUsed);
  const hol = holidays || 0;
  return (
    <div className="cap-card" data-over={over}>
      <div className="cap-head">
        <Avatar name={person.name} proj={person.project} />
        <div style={{ minWidth: 0 }}>
          <div className="cap-name">{person.name}</div>
          <div className="cap-meta">
            <span className={"tag " + (person.type === "gov" ? "gov" : "con")}>{person.type === "gov" ? "GOV" : "CTR"}</span>
            {cap.isGoal && <span className="tag goal" title="Based on goal points (under 2 sprints of history)">GOAL</span>}
          </div>
        </div>
      </div>

      <div className="cap-nums" title={`${assigned} points assigned · ${cap.adjusted} adjusted capacity (base ${Math.round(cap.baseVelocity)} − ${cap.leave}d leave${hol ? ` − ${hol}d hol` : ""})`}>
        <span className="big">{assigned}</span>
        <span className="slash">/</span>
        <span className="cap">{cap.adjusted}</span>
        <span className="unit">pts</span>
        {over && <span className="over-tag">+{assigned - cap.adjusted}</span>}
      </div>

      <div className={"bar" + (over ? " over" : "")}>
        <i style={{ width: pct(assigned, cap.adjusted) + "%", background: color }} />
      </div>

      {/* breakdown of assigned points + days context */}
      <div className="cap-foot">
        {wfhUsed > 0 && (
          <span className="chip split" title="Where the assigned points are happening">
            <span className="kx"><i className="dt office" />{officeUsed} office</span>
            <span className="kx"><i className="dt wfh" />{wfhUsed} wfh</span>
          </span>
        )}
        {cap.undated ? (
          <span className="chip" title={`No timeframe — capacity is base velocity (${Math.round(cap.baseVelocity)} pts${cap.isGoal ? ", from goal" : ""})`}>
            <Icon name="cal" size={12} />base {Math.round(cap.baseVelocity)}
          </span>
        ) : (
          <span className="chip" title={`${cap.available} working days available (${cap.workDays} total in this sprint after weekends + holidays)`}>
            <Icon name="cal" size={12} />{cap.available}d
          </span>
        )}
        {!cap.undated && hol > 0 && <span className="chip" style={{ color: "var(--rc)" }} title="Federal holidays in this sprint (already subtracted)">
          {hol}d hol
        </span>}
        {!cap.undated && cap.leave > 0 && <span className="chip" title="Personal leave in this sprint">
          <Icon name="plane" size={12} />{cap.leave}d leave
        </span>}
      </div>

      {cap.wfh && (
        <div className="wfh-mini">
          <span className="lbl">WFH</span>
          <div className={"bar" + (wfhOver ? " over" : "")} title={`${wfhUsed} / ${cap.wfhPoints} pts (${cap.wfh.days} days budget)`}>
            <i style={{ width: pct(wfhUsed, cap.wfhPoints) + "%", background: "var(--accent)" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: wfhOver ? "var(--danger)" : "var(--text-faint)" }}>{wfhUsed}/{cap.wfhPoints}</span>
        </div>
      )}
    </div>
  );
}

/* ---- assignee popover ---- */
function AssignPop({ ticket, people, onPick, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  return (
    <div className="pop" ref={ref} style={{ right: 0, top: "calc(100% + 6px)" }}>
      <div className="pop-label">Assign to</div>
      <button className="pop-item" data-active={!ticket.assignee} onClick={() => onPick(null)}>
        <span className="av avatar" style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>—</span>
        <span>Unassigned</span>
      </button>
      <div className="pop-sep" />
      {people.map((p) => {
        const v = VP.velocity(p);
        return (
          <button key={p.id} className="pop-item" data-active={ticket.assignee === p.id} onClick={() => onPick(p.id)}>
            <Avatar name={p.name} proj={p.project} className="av" />
            <span>{p.name}</span>
            <span className="meta">{v.count ? "~" + v.average.toFixed(0) : "goal " + p.goal}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---- move-to-sprint popover ---- */
function MovePop({ ticket, sprints, curName, currentIdx, hidePast, onMove, onBacklog, onClose }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);
  return (
    <div className="pop" ref={ref} style={{ right: 0, top: "calc(100% + 6px)", minWidth: 200 }}>
      <div className="pop-label">Move to sprint</div>
      {sprints.map((s, i) => {
        if (hidePast && i < currentIdx) return null;
        return (
          <button key={s.id} className="pop-item" data-active={ticket.sprints.includes(s.name)} onClick={() => onMove(s.name)}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>{s.name}</span>
            <span className="meta">{fmtDate(s.start)}</span>
          </button>
        );
      })}
      <div className="pop-sep" />
      <button className="pop-item" onClick={onBacklog} style={{ color: "var(--text-dim)" }}>
        <Icon name="history" size={14} /> <span>Return to backlog</span>
      </button>
    </div>
  );
}

/* ---- ticket row ---- */
function TicketRow({ ticket, people, jiraBase, sprints, curName, currentIdx, hidePast, openPop, setOpenPop, onAssign, onWfh, onMove, onBacklog, onPoints, onOpenDesc, variant = "sprint" }) {
  const proj = VP.projectForKey(ticket.key);
  const color = PROJ_COLOR[proj];
  const assignee = people.find((p) => p.id === ticket.assignee);
  const href = jiraBase ? jiraBase.replace(/\/$/, "") + "/browse/" + ticket.key : null;
  const popA = openPop && openPop.id === ticket.id && openPop.type === "assign";
  const popM = openPop && openPop.id === ticket.id && openPop.type === "move";

  return (
    <div className={"trow trow-" + variant}>
      <div>
        {href ? (
          <a className="tkey" href={href} target="_blank" rel="noopener" style={{ color }} onClick={(e) => e.stopPropagation()}>
            {ticket.key}<span className="ext"><Icon name="ext" size={11} /></span>
          </a>
        ) : <span className="tkey" style={{ color }}>{ticket.key}</span>}
      </div>

      <div className="tsum">
        <span className="s" onClick={() => onOpenDesc(ticket)}>{ticket.summary}</span>
      </div>

      <div className="epic-pill" title="Epic">{ticket.epic || "—"}</div>

      <div className="pts">
        <InlineNumber value={ticket.points} onChange={(n) => onPoints(ticket, n)} />
        <span className="pu"> pt</span>
      </div>

      <div className="assign">
        <button className={"assign-btn" + (assignee ? "" : " empty")} onClick={() => setOpenPop(popA ? null : { id: ticket.id, type: "assign" })}>
          {assignee ? <Avatar name={assignee.name} proj={assignee.project} className="av" /> : null}
          <span className="nm">{assignee ? assignee.name : "Assign"}</span>
          <span className="caret"><Icon name="chev" size={13} /></span>
        </button>
        {popA && <AssignPop ticket={ticket} people={people} onClose={() => setOpenPop(null)} onPick={(pid) => { onAssign(ticket, pid); setOpenPop(null); }} />}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {assignee && (
          <button className="wfh-toggle" data-on={ticket.wfh} onClick={() => onWfh(ticket)} title="Work from home">
            <Icon name="home" size={12} /> WFH
          </button>
        )}
        <div className="rowmenu">
          <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => setOpenPop(popM ? null : { id: ticket.id, type: "move" })} aria-label="Move ticket">
            <Icon name="dots" size={16} />
          </button>
          {popM && <MovePop ticket={ticket} sprints={sprints} curName={curName} currentIdx={currentIdx} hidePast={hidePast} onClose={() => setOpenPop(null)}
            onMove={(nm) => { onMove(ticket, nm); setOpenPop(null); }} onBacklog={() => { onBacklog(ticket); setOpenPop(null); }} />}
        </div>
      </div>
    </div>
  );
}

/* group tickets by epic (used for backlog) */
function byEpic(list) {
  const groups = {};
  list.forEach((t) => { (groups[t.epic || "—"] = groups[t.epic || "—"] || []).push(t); });
  return Object.entries(groups);
}

/* group tickets by assignee (used for in-sprint planning view).
   Returns ordered groups: assigned people sorted by name, then Unassigned. */
function byAssignee(list, people) {
  const groups = new Map();
  list.forEach((t) => {
    const k = t.assignee || "_unassigned";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  });
  const out = [];
  // Person groups in alphabetical name order, with unassigned last.
  const peopleIds = [...groups.keys()].filter((k) => k !== "_unassigned");
  peopleIds
    .map((id) => ({ id, person: people.find((p) => p.id === id) }))
    .sort((a, b) => (a.person?.name || "").localeCompare(b.person?.name || ""))
    .forEach(({ id, person }) => {
      const tickets = groups.get(id);
      out.push({
        key: id,
        person,
        tickets,
        points: tickets.reduce((s, t) => s + t.points, 0),
      });
    });
  if (groups.has("_unassigned")) {
    const tickets = groups.get("_unassigned");
    out.push({ key: "_unassigned", person: null, tickets, points: tickets.reduce((s, t) => s + t.points, 0) });
  }
  return out;
}

function Planner({ project, tickets, people, sprints, sprintIdx, setSprintIdx, mode, setMode, hidePast, jiraBase, onAssign, onWfh, onMove, onBacklog, onPoints, onOpenDesc, currentIdx, onOpenImportTickets }) {
  const [openPop, setOpenPop] = useState(null);
  const [userCollapse, setUserCollapse] = useState({}); // {pid: bool} — explicit user overrides
  // If hide-past flips on while viewing a past sprint, jump to current.
  useEffect(() => {
    if (hidePast && sprintIdx < currentIdx) setSprintIdx(currentIdx);
  }, [hidePast, sprintIdx, currentIdx, setSprintIdx]);
  const sprint = sprints[sprintIdx];
  const sprintName = sprint.name;

  const projPeople = useMemo(() => people.filter((p) => p.project === project), [people, project]);
  const isDone = (t) => t.resolution && VP.DONE_RESOLUTIONS.includes(t.resolution);

  // tickets in this project + sprint (active work)
  const inSprint = useMemo(() => tickets.filter((t) => VP.projectForKey(t.key) === project && !isDone(t) && t.sprints.includes(sprintName)), [tickets, project, sprintName]);
  // unassigned backlog candidates for this project
  const backlog = useMemo(() => tickets.filter((t) => VP.projectForKey(t.key) === project && !isDone(t) && t.sprints.length === 0), [tickets, project]);

  // assigned points per person this sprint
  const assignedBy = useMemo(() => {
    const m = {}, w = {};
    inSprint.forEach((t) => {
      if (t.assignee) { m[t.assignee] = (m[t.assignee] || 0) + t.points; if (t.wfh) w[t.assignee] = (w[t.assignee] || 0) + t.points; }
    });
    return { pts: m, wfh: w };
  }, [inSprint]);

  const caps = useMemo(() => projPeople.map((p) => ({ p, cap: VP.capacity(p, sprint) })), [projPeople, sprint]);
  const undated = VP.isUndated(sprint);
  const workDays = VP.sprintWorkDays(sprint).length;
  const holidays = VP.holidaysInRange(sprint.start, sprint.end);
  const totalAssigned = Object.values(assignedBy.pts).reduce((a, b) => a + b, 0);
  const totalCap = caps.reduce((a, c) => a + c.cap.adjusted, 0);

  return (
    <div className="wrap">
      {/* sprint selector bar */}
      <div className="sprint-bar">
        <div className="sprint-tabs">
          {sprints.map((s, i) => {
            const isPast = i < currentIdx;
            if (hidePast && isPast) return null;
            return (
              <button key={s.id} className="sprint-tab" data-active={i === sprintIdx} data-current={i === currentIdx} data-past={isPast} data-undated={VP.isUndated(s)} onClick={() => setSprintIdx(i)}>
                {s.name}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div className="mode-toggle">
          <button data-active={mode === "single"} onClick={() => setMode("single")}>Single</button>
          <button data-active={mode === "multi"} onClick={() => setMode("multi")}>Multi</button>
        </div>
      </div>

      {mode === "single" ? (
        <React.Fragment>
          {/* sprint header */}
          <div className="sprint-head">
            <div>
              <h2>Sprint {sprintName}</h2>
              <div className="sub">{fmtRange(sprint.start, sprint.end)}</div>
            </div>
            <div className="div" />
            <div className="metric"><span className="k">Work days</span><span className="v">{undated ? "—" : workDays}</span></div>
            <div className="metric"><span className="k">Holidays</span><span className="v">{undated ? "—" : holidays.length}</span></div>
            <div className="metric"><span className="k">Assigned</span><span className="v">{totalAssigned}</span></div>
            <div className="metric"><span className="k">{undated ? "Base cap" : "Capacity"}</span><span className="v">{totalCap}</span></div>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={onOpenImportTickets}><Icon name="download" size={15} /> Import tickets</button>
          </div>

          {/* capacity cards */}
          <div style={{ marginBottom: 20 }}>
            <div className="section-label">Team capacity · {projPeople.length} people</div>
            <div className="cap-row">
              {caps.map(({ p, cap }) => (
                <CapCard key={p.id} person={p} cap={cap} assigned={assignedBy.pts[p.id] || 0} wfhUsed={assignedBy.wfh[p.id] || 0} holidays={holidays.length} />
              ))}
            </div>
          </div>

          {/* ticket list — grouped by assignee */}
          <div className="section-label">In this sprint · {inSprint.length} tickets · {inSprint.reduce((a, t) => a + t.points, 0)} pts</div>
          <div className="tickets" style={{ marginBottom: 20 }}>
            {inSprint.length === 0 && <div className="empty-state">No tickets assigned to this sprint yet.</div>}
            {byAssignee(inSprint, people).map(({ key, person, tickets: list, points }) => {
              const cap = person ? caps.find((c) => c.p.id === person.id)?.cap : null;
              const over = cap && points > cap.adjusted;
              const atOrOver = cap && points >= cap.adjusted;
              // Auto-collapse when person is at or over capacity, unless the user has explicitly toggled.
              const collapsed = (key in userCollapse) ? userCollapse[key] : !!atOrOver;
              const toggle = () => setUserCollapse((m) => ({ ...m, [key]: !collapsed }));
              return (
                <div className="epic-group" key={key} data-collapsed={collapsed}>
                  <div className="epic-head person-head" data-over={over} data-collapsed={collapsed} onClick={toggle} role="button" tabIndex={0}>
                    <span className="collapse-caret" aria-label={collapsed ? "Expand" : "Collapse"}>
                      <Icon name="chev" size={14} />
                    </span>
                    {person ? (
                      <React.Fragment>
                        <Avatar name={person.name} proj={person.project} className="av" style={{ width: 22, height: 22, borderRadius: 7, fontSize: 10 }} />
                        <span className="nm">{person.name}</span>
                        <span className="ec">{list.length}</span>
                        <div style={{ flex: 1 }} />
                        <span className="pts-sum" title={cap ? `${points} of ${cap.adjusted} adjusted capacity` : `${points} points`}>
                          <span className="big">{points}</span>
                          {cap && <span className="of">/ {cap.adjusted}</span>}
                          <span className="u">pts</span>
                        </span>
                        {over && <span className="over-tag mini">+{points - cap.adjusted}</span>}
                        {atOrOver && !over && <span className="full-tag mini">FULL</span>}
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        <span className="av avatar" style={{ width: 22, height: 22, borderRadius: 7, fontSize: 10, background: "var(--surface-3)", color: "var(--text-faint)" }}>—</span>
                        <span className="nm">Unassigned</span>
                        <span className="ec">{list.length}</span>
                        <div style={{ flex: 1 }} />
                        <span className="pts-sum"><span className="big">{points}</span><span className="u">pts</span></span>
                      </React.Fragment>
                    )}
                  </div>
                  {!collapsed && list.map((t) => (
                    <TicketRow key={t.id} ticket={t} people={projPeople} jiraBase={jiraBase} sprints={sprints} curName={sprintName} currentIdx={currentIdx} hidePast={hidePast}
                      openPop={openPop} setOpenPop={setOpenPop} onAssign={onAssign} onWfh={onWfh}
                      onMove={(tk, nm) => onMove(tk, nm)} onBacklog={onBacklog} onPoints={onPoints} onOpenDesc={onOpenDesc} />
                  ))}
                </div>
              );
            })}
          </div>

          {/* backlog candidates */}
          {backlog.length > 0 && (
            <React.Fragment>
              <div className="section-label">Backlog · assignment candidates · {backlog.length}</div>
              <div className="tickets">
                {backlog.map((t) => (
                  <TicketRow key={t.id} ticket={t} people={projPeople} jiraBase={jiraBase} sprints={sprints} curName={sprintName} currentIdx={currentIdx} hidePast={hidePast}
                    openPop={openPop} setOpenPop={setOpenPop}
                    onAssign={(tk, pid) => onAssign(tk, pid, sprintName)} onWfh={onWfh}
                    onMove={(tk, nm) => onMove(tk, nm)} onBacklog={onBacklog} onPoints={onPoints} onOpenDesc={onOpenDesc}
                    variant="backlog" />
                ))}
              </div>
            </React.Fragment>
          )}
        </React.Fragment>
      ) : (
        <MultiView project={project} tickets={tickets} people={people} sprints={sprints} currentIdx={currentIdx} hidePast={hidePast} jiraBase={jiraBase} onOpenDesc={onOpenDesc} />
      )}
    </div>
  );
}

/* ---- multi sprint columns ---- */
function MultiView({ project, tickets, people, sprints, currentIdx, hidePast, onOpenDesc }) {
  const isDone = (t) => t.resolution && VP.DONE_RESOLUTIONS.includes(t.resolution);
  const projPeople = people.filter((p) => p.project === project);
  return (
    <div className="multi-cols">
      {sprints.map((s, i) => {
        if (hidePast && i < currentIdx) return null;
        const list = tickets.filter((t) => VP.projectForKey(t.key) === project && !isDone(t) && t.sprints.includes(s.name) && t.assignee);
        const assigned = list.reduce((a, t) => a + t.points, 0);
        const cap = projPeople.reduce((a, p) => a + VP.capacity(p, s).adjusted, 0);
        const over = assigned > cap;
        return (
          <div className="mcol" key={s.id}>
            <div className="mcol-head">
              <div className="nm">{s.name}</div>
              <div className="dt">{fmtRange(s.start, s.end)}</div>
              <div className="bar" style={{ marginTop: 8 }}>
                <i style={{ width: pct(assigned, cap) + "%", background: over ? "var(--danger)" : PROJ_COLOR[project] }} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 5, color: over ? "var(--danger)" : "var(--text-faint)" }}>{assigned} / {cap} pts</div>
            </div>
            <div className="mcol-body">
              {list.length === 0 && <div className="muted" style={{ padding: 14, fontSize: 12, textAlign: "center" }}>No tickets</div>}
              {list.map((t) => {
                const a = people.find((p) => p.id === t.assignee);
                return (
                  <div className="mini-tk" key={t.id} onClick={() => onOpenDesc(t)} style={{ cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="k" style={{ color: PROJ_COLOR[project] }}>{t.key}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 12 }}>{t.points}</span>
                    </div>
                    <div className="s">{t.summary}</div>
                    {a && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}><Avatar name={a.name} proj={a.project} className="av" style={{ width: 18, height: 18 }} /><span style={{ fontSize: 11, color: "var(--text-faint)" }}>{a.name}</span></div>}
                  </div>
                );
              })}            </div>
          </div>
        );
      })}
    </div>
  );
}

window.Planner = Planner;
