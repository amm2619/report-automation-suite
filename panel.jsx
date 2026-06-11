/* Description panel — slides in from the LEFT.
   Inline-editable: points · assignee · sprint. */

function MetaPicker({ label, value, options, renderValue, renderOption, onPick, align = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div className="metric meta-edit" ref={ref}>
      <span className="k">{label}</span>
      <button className="meta-trigger" onClick={() => setOpen((o) => !o)}>
        {renderValue(value)}
        <span className="caret"><Icon name="chev" size={12} /></span>
      </button>
      {open && (
        <div className="pop meta-pop" data-align={align}>
          {options.map((o) => (
            <button key={o.key} className="pop-item" data-active={o.active} onClick={() => { onPick(o.value); setOpen(false); }}>
              {renderOption ? renderOption(o) : <span>{o.label}</span>}
              {o.meta && <span className="meta">{o.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DescPanel({ ticket, people, sprints, currentIdx, hidePast, jiraBase, onClose, onAssign, onMove, onBacklog, onPoints }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!ticket) return null;
  const proj = VP.projectForKey(ticket.key);
  const color = PROJ_COLOR[proj];
  const assignee = people.find((p) => p.id === ticket.assignee);
  const href = jiraBase ? jiraBase.replace(/\/$/, "") + "/browse/" + ticket.key : null;
  const desc = ticket.desc || "No description was provided for this ticket.";
  const currentSprint = ticket.sprints[0] || null;
  const projPeople = people.filter((p) => p.project === proj);

  // assignee picker options (people on this project + unassigned)
  const assigneeOpts = [
    { key: "_none", label: "Unassigned", value: null, active: !ticket.assignee },
    ...projPeople.map((p) => ({
      key: p.id, value: p.id, active: ticket.assignee === p.id,
      label: p.name, person: p,
    })),
  ];
  // sprint picker options (all sprints + backlog) — past sprints hidden when toggle is on
  const sprintOpts = [
    ...sprints.map((s, i) => ({ key: s.id, value: s.name, active: currentSprint === s.name, label: s.name, meta: fmtDate(s.start), past: i < currentIdx }))
      .filter((o) => !(hidePast && o.past)),
    { key: "_backlog", value: "__BACKLOG__", active: !currentSprint, label: "Backlog (no sprint)", meta: "" },
  ];

  function handleSprint(v) {
    if (v === "__BACKLOG__") onBacklog(ticket);
    else onMove(ticket, v);
  }

  return (
    <React.Fragment>
      <div className="scrim" onClick={onClose} />
      <aside className="desc-panel" role="dialog" aria-label={"Ticket " + ticket.key}>
        <div className="desc-top">
          <div className="desc-top-main">
            {href ? (
              <a className="tkey" href={href} target="_blank" rel="noopener" style={{ "--tkey-color": color }}>
                {ticket.key} <span className="ext ext-on"><Icon name="ext" size={12} /></span>
              </a>
            ) : (
              <span className="tkey" style={{ "--tkey-color": color }}>{ticket.key}</span>
            )}
            <h2 className="desc-title">{ticket.summary}</h2>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>

        <div className="desc-meta">
          <div className="metric meta-edit">
            <span className="k">Points</span>
            <InlineNumber value={ticket.points} onChange={(n) => onPoints(ticket, n)} className="big" />
          </div>

          {ticket.epic && (
            <div className="metric">
              <span className="k">Epic</span>
              <span className="v epic-val">{ticket.epic}</span>
            </div>
          )}

          <MetaPicker
            label="Assignee"
            value={ticket.assignee}
            options={assigneeOpts}
            renderValue={() => assignee
              ? (<><Avatar name={assignee.name} proj={assignee.project} className="av" /><span>{assignee.name}</span></>)
              : (<span className="muted">Unassigned</span>)}
            renderOption={(o) => o.person
              ? (<><Avatar name={o.person.name} proj={o.person.project} className="av" /><span>{o.label}</span></>)
              : (<><span className="av avatar empty">—</span><span>{o.label}</span></>)}
            onPick={(pid) => onAssign(ticket, pid, currentSprint)} />

          <MetaPicker
            label="Sprint"
            value={currentSprint}
            options={sprintOpts}
            renderValue={() => currentSprint
              ? <span className="mono-700">{currentSprint}</span>
              : <span className="muted">Backlog</span>}
            renderOption={(o) => <span className={"sprint-opt" + (o.key === "_backlog" ? " sans" : "")}>{o.label}</span>}
            onPick={handleSprint}
            align="right" />
        </div>

        <div className="desc-body">{desc}</div>
      </aside>
    </React.Fragment>
  );
}
window.DescPanel = DescPanel;
