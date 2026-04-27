// ============================================================
// EOS REPORT
// ============================================================
function runEOS(){
  if(!S.allTickets.length){
    const _eo=document.getElementById('eos-output');
    if(_eo){_eo.innerHTML='<div class="card lr"><div class="card-title" style="color:var(--a5)">No Data</div><div>Load the Issues CSV first.</div></div>';return;}
    alert('Load jira_issues_master.csv first.'); return;
  }
  S._unmatchedLookup={};  // clear stale entries from previous runs
  const p = S._wizParams || {};
  const cur = p.eosCur || '';
  const fut = p.eosFut || '';
  if(!cur||!fut){
    const _out=document.getElementById('eos-output');
    if(_out) _out.innerHTML='<div class="card lr"><div class="card-title">End of Sprint</div><div>No sprints selected. Set sprints in the batch params.</div></div>';
    else alert('Select current and future sprints.');
    return;
  }
  const base=S.cfg.jira_url||'';

  S.eosConfluenceTexts={};
  S.eosConfParams={};   // stored so Confluence text can be regenerated at copy time
  S._eosTopicResults={}; // stored so AI prompt can look up tickets per topic
  let segBtns='', projGroups='';
  let renderedCount=0;
  const projColors={DX:'a1',LX:'a2',RC:'a3',RCR:'a3'};

  Object.entries(S.cfg.eos_projects).forEach(([proj,meta])=>{
    const topics=S.topics.filter(t=>t.projects.includes(proj));
    const projTickets=S.allTickets.filter(t=>t.project_bucket===proj);

    // Use full ticket object for sprint matching so all sprint columns are checked
    const scoped=projTickets.filter(t=>sprintMatches(t,cur)||sprintMatches(t,fut));

    // Skip projects with no tickets in either sprint
    if(!scoped.length) return;

    const blocked=scoped.filter(t=>t.status==='Blocked');
    const nonBlocked=scoped.filter(t=>t.status!=='Blocked');
    const results={};
    topics.forEach(t=>results[t.header]={current:[],future:[]});
    const unmatched=[], allTraces=[];

    nonBlocked.forEach(ticket=>{
      const {best,traces}=findBestMatch(ticket,topics);
      allTraces.push({ticket,traces});
      if(!best){ unmatched.push(ticket); return; }
      // current = in cur sprint; future = only in fut sprint
      const slot=sprintMatches(ticket,cur)?'current':'future';
      results[best.header][slot].push(ticket);
    });
    blocked.forEach(ticket=>{ const traces=topics.map(t=>topicTrace(ticket,t)); allTraces.push({ticket,traces}); });

    const countCur=projTickets.filter(t=>sprintMatches(t,cur)).length;
    const countFut=projTickets.filter(t=>sprintMatches(t,fut)).length;
    const spfx={DX:'DX',LX:'LX',RCR:'RC',RC:'RC'}[proj]||proj;
    const isFirst=renderedCount===0;

    // ── Report panel
    const eosBlufId=`bluf-eos-${proj.toLowerCase()}`;
    let rp=`<div style="font-size:var(--fs-lg);font-weight:600;color:var(--tx);margin-bottom:10px">${esc(meta.report_title)}</div>
    <div style="margin-bottom:12px"><div class="bluf-label">BLUF</div><div class="bluf-field" id="${eosBlufId}" contenteditable="true" data-placeholder="Enter BLUF summary..."></div></div>
    <div class="stats-row">
      <div class="stat"><div class="sv">${countCur}</div><div class="sl">${spfx} ${cur}</div></div>
      <div class="stat"><div class="sv">${countFut}</div><div class="sl">${spfx} ${fut}</div></div>
      <div class="stat"><div class="sv">${blocked.length}</div><div class="sl">Blocked</div></div>
      <div class="stat"><div class="sv">${unmatched.length}</div><div class="sl">Unmatched</div></div>
    </div>`;
    rp+=`<div class="r-card lw"><h3 style="color:var(--a4)">Blocked Work</h3>${ticketTable(blocked,base)}</div>`;
    rp+=`<div class="muted" style="font-size:var(--fs-sm);margin-bottom:14px"><strong style="color:var(--tx)">MTL story points available:</strong> ${esc(meta.mtl_points)}</div>`;
    topics.forEach((topic,tidx)=>{
      const curr=results[topic.header].current;
      const futt=results[topic.header].future;
      const topicSlug=`bluf-eos-${proj.toLowerCase()}-${tidx}`;
      const aiBtn = (S.cfg.eos_ai_prompt_enabled !== false && (curr.length || futt.length))
        ? `<button class="btn btn-ghost btn-xs" style="margin-left:auto;flex-shrink:0" onclick="copyEosAiPrompt('${esc(proj)}',${tidx})" title="Copy AI prompt + tickets to clipboard"><span class="mi" style="font-size:13px;margin-right:2px">auto_awesome</span>AI</button>`
        : '';
      rp+=`<div class="r-card l2"><div style="display:flex;align-items:center;gap:6px"><h3 style="text-transform:none;font-size:var(--fs-sm);color:var(--a2);margin:0">(U) ${esc(topic.header)}</h3>${aiBtn}</div>`;
      if(!curr.length&&!futt.length){ rp+=`<div class="nstr">NSTR for this period.</div>`; }
      else {
        rp+=`<div style="margin-bottom:10px"><div class="bluf-label">Summary</div><div class="bluf-field" id="${topicSlug}" contenteditable="true" data-placeholder="Enter topic summary..."></div></div>`;
        if(curr.length) rp+=`<h4 style="font-size:var(--fs-xs);color:var(--a1);margin:8px 0 4px">(U) Current Sprint</h4>${ticketTable(curr,base)}`;
        if(futt.length) rp+=`<h4 style="font-size:var(--fs-xs);color:var(--a1);margin:8px 0 4px">(U) Future Sprint</h4>${ticketTable(futt,base)}`;
      }
      rp+=`</div>`;
    });

    // ── Prioritization / Upcoming (interactive section per project)
    rp += buildEOSPrioritizationHtml(proj, cur, fut);

    // ── Additional sections: Deployments, User Engagement, Demonstrations
    // Each has a contenteditable text area. If empty, Confluence output
    // shows italicized "NSTR for this period." Auto-saved via the EOS
    // frame-level input listener (debounced).
    const addlSections = ['Deployments', 'User Engagement and New Requirements', 'Demonstrations'];
    addlSections.forEach(label => {
      const slug = `eos-addl-${proj.toLowerCase()}-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
      rp += `<div class="r-card l2" style="margin-top:10px">
        <h3 style="text-transform:none;font-size:var(--fs-sm);color:var(--a1)">(U) ${esc(label)}</h3>
        <div class="bluf-field" id="${slug}" contenteditable="true" data-placeholder="NSTR for this period." data-eos-addl="${esc(label)}" data-eos-proj="${esc(proj)}"></div>
      </div>`;
    });

    // ── Confluence — build an initial snapshot; the text is regenerated live
    // from the DOM in openEOSConfluencePicker / refreshEOSConfluenceTab so
    // user-typed summaries are always included.
    S._eosTopicResults[proj]={topics,results,cur,fut};
    S.eosConfParams[proj]={meta,proj,topics,results,blocked,projTickets,cur,fut,spfx};
    const confText=buildEOSConfluence(meta,proj,topics,results,blocked,projTickets,cur,fut,spfx);
    S.eosConfluenceTexts[proj]=confText;
    const confId=`conf-${proj.toLowerCase()}`;
    const confPanel=`<div class="r-card">
      <p class="muted" style="font-size:var(--fs-xs);margin-bottom:8px">Use <strong>Copy for Confluence</strong> in the report bar to copy markup for any project. The text below is for reference.</p>
      <pre class="conf-pre" id="${confId}">${esc(confText)}</pre>
    </div>`;

    // ── Debug + Unmatched
    const dbgPanel=eosDebugTable(allTraces,`edbg-${proj}`);
    const umPanel=unmatchedPanel(unmatched,proj,`um-${proj}`);

    // ── Unified bar: segment button + project group with 4 view panels
    const pColor=projColors[proj]||'a1';
    segBtns+=`<button class="${isFirst?'active':''}" data-eos-proj="${proj}" data-eos-color="${pColor}" onclick="switchEosProject(this)">${proj}</button>`;
    projGroups+=`<div class="eos-proj-group${isFirst?' active':''}" data-eos-proj-panel="${proj}">
      <div class="eos-view-panel active">${rp}</div>
      <div class="eos-view-panel">${confPanel}</div>
      <div class="eos-view-panel">${umPanel}</div>
      <div class="eos-view-panel">${dbgPanel}</div>
    </div>`;

    renderedCount++;
  });

  if(!renderedCount){
    const _eos_out=document.getElementById('eos-output'); if(_eos_out) _eos_out.innerHTML=`<div class="card lr"><div class="card-title">No tickets found</div><div class="muted">No tickets in any project match sprint ${esc(cur)} or ${esc(fut)}. Check your sprint names and field mappings.</div></div>`;
    return;
  }

  // Determine first project for initial badge state
  const firstProj = Object.keys(S.eosConfParams)[0] || 'DX';
  const firstColor = projColors[firstProj] || 'a1';

  const html=`
  <div class="rpt-frame" id="rptf1">
    ${buildRptBar({icon:'flag',iconColor:'var(--a2)',title:'End of Sprint',
      subtitle:`${cur} / ${fut}`,
      frameId:'rptf1',reportType:'eos',
      primaryBtn:{label:'Copy for Confluence',icon:'content_copy',onclick:'openEOSConfluencePicker()'}})}
    <div class="rpt-body"><div class="rpt-body-inner">
      <div class="rpt-hdr" style="border-left-color:var(--a2)">
        <div><h1>End of Sprint Review</h1><div class="rsub">Current: ${esc(cur)} &nbsp;/&nbsp; Future: ${esc(fut)}</div></div>
        <span class="badge" style="background:var(--a2d);color:var(--a2);border:1px solid var(--a2b)">EOS &nbsp;·&nbsp; ${renderedCount} project${renderedCount!==1?'s':''}</span>
      </div>
      <div class="eos-bar">
        <div class="eos-badge" data-color="${firstColor}">${esc(firstProj)}</div>
        <div class="eos-views">
          <button class="active" onclick="switchEosView(this)">Report</button>
          <button onclick="switchEosView(this)">Confluence</button>
          <button onclick="switchEosView(this)">Unmatched</button>
          <button onclick="switchEosView(this)">Debug</button>
        </div>
        <div class="eos-seg">${segBtns}</div>
      </div>
      ${projGroups}
    </div>
  </div>`;

  const _out_eos=document.getElementById('eos-output'); if(_out_eos) _out_eos.innerHTML=html;
  S.reportHtml.eos=html;
  autoSaveDraft('eos');
  checkDraftAndRestore('eos');
  // Auto-save whenever the user edits a BLUF / summary contenteditable field,
  // so typed text survives page reloads and wizard navigation. Debounced to
  // avoid hammering localStorage on every keystroke.
  const eosFrame = document.getElementById('rptf1');
  if (eosFrame) {
    let eosSaveTimer = null;
    eosFrame.addEventListener('input', function(e) {
      if (!e.target || !e.target.isContentEditable) return;
      if (eosSaveTimer) clearTimeout(eosSaveTimer);
      eosSaveTimer = setTimeout(function(){ autoSaveDraft('eos'); }, 800);
    });
  }
  // Wire prioritization interactive controls for each rendered project
  Object.keys(S.eosConfParams).forEach(proj => wireEOSPrioritizationListeners(proj));
  const _edg=document.getElementById('eos-dl-group'); if(_edg) _edg.style.display='flex';
}

function buildEOSConfluence(meta,proj,topics,results,blocked,projTickets,cur,fut,spfx){
  const count=spn=>projTickets.filter(t=>sprintMatches(t,spn)).length;
  // Emit live Jira Issues macros (rendered as tables in Confluence) so the
  // page stays up to date as new tickets land. Three forms:
  //   tableFromEpics — topic sections: filter by "Epic Link" + sprint so new
  //     tickets added to those epics in that sprint appear automatically.
  //   tableFromBlocked — status=Blocked in either sprint.
  //   tableFromKeys — key-only fallback for time-based sections (Prio 'created').
  const COLS = 'key,summary,type,status,priority';
  const ORDER = 'ORDER BY "Epic Link" ASC, Rank DESC';
  const tableFromKeys = tickets => {
    if (!tickets.length) return '_NSTR for this period_';
    const keys = [...tickets].map(t=>t.issue_key).sort().join(',');
    return `{jira:jqlQuery=key in (${keys}) ${ORDER}|columns=${COLS}|maximumIssues=${tickets.length}}`;
  };
  const tableFromEpics = (tickets, sprintName) => {
    if (!tickets.length) return '_NSTR for this period_';
    const epics = [...new Set(tickets.map(t => t.epic_link).filter(Boolean))];
    const orphans = tickets.filter(t => !t.epic_link).map(t => t.issue_key);
    const sprint = `"${spfx} ${sprintName}"`;
    let clause;
    if (epics.length && orphans.length) {
      clause = `("Epic Link" in (${epics.join(',')}) OR key in (${orphans.join(',')})) AND Sprint=${sprint}`;
    } else if (epics.length) {
      clause = `"Epic Link" in (${epics.join(',')}) AND Sprint=${sprint}`;
    } else {
      clause = `key in (${orphans.join(',')})`;
    }
    return `{jira:jqlQuery=${clause} ${ORDER}|columns=${COLS}|maximumIssues=50}`;
  };
  const tableFromBlocked = () => {
    if (!blocked.length) return '_NSTR for this period_';
    return `{jira:jqlQuery=status=Blocked AND Sprint in ("${spfx} ${cur}","${spfx} ${fut}") ${ORDER}|columns=${COLS}|maximumIssues=50}`;
  };
  // Build JQL links for the sprint ticket counts
  const jiraBase = (S.cfg.jira_url || '').replace(/\/+$/, '');
  const sprintJql = spn => {
    const jql = encodeURIComponent(`Sprint="${spfx} ${spn}"`);
    return jiraBase ? `[${count(spn)}|${jiraBase}/issues/?jql=${jql}]` : String(count(spn));
  };
  let lines=[`h1. ${meta.report_title}`,''];
  // Project-level BLUF (reads the current DOM so user-typed text is included)
  const blufId=`bluf-eos-${proj.toLowerCase()}`;
  const blufEl=document.getElementById(blufId);
  const blufTxt=(blufEl&&blufEl.innerText.trim())||'';
  if(blufTxt) lines.push(`(U) BLUF: ${blufTxt}`,'');
  lines.push('h2. (U) Sprint Tickets',
    `|${spfx} ${cur}| ${sprintJql(cur)}|`,`|${spfx} ${fut}| ${sprintJql(fut)}|`,'',
    `h2. (U) Story Points Available for MTLs to add: ${meta.mtl_points}`,'',
    'h2. (U) Blocked Work','', tableFromBlocked(),'');
  topics.forEach((topic,tidx)=>{
    const curr=results[topic.header].current;
    const futt=results[topic.header].future;
    const isEmpty = !curr.length && !futt.length;
    // Skip NSTR topics entirely when the user has toggled them off
    if (isEmpty && S.cfg.eos_hide_empty_topics) return;
    lines.push(`h2. (U) ${topic.header}`);
    if (isEmpty) { lines.push('_NSTR for this period_',''); return; }
    const topicSlug=`bluf-eos-${proj.toLowerCase()}-${tidx}`;
    const summaryEl=document.getElementById(topicSlug);
    const summaryTxt=(summaryEl&&summaryEl.innerText.trim())||'';
    if (summaryTxt) lines.push(`(U) Summary: ${summaryTxt}`,'');
    if(curr.length) lines.push('h3. (U) Current Sprint Tickets','', tableFromEpics(curr,cur),'');
    if(futt.length) lines.push('h3. (U) Future Sprint Tickets','', tableFromEpics(futt,fut),'');
  });

  // Prioritization / Upcoming section
  const pst = (S.cfg.eos_prioritization && S.cfg.eos_prioritization[proj]) || null;
  if (pst) {
    // Only emit the section if there's actual content — skip entirely when
    // the user hasn't selected epics, no tickets match, and no JQL is typed.
    const prioTickets = (pst.mode !== 'jql') ? _eosPrioFilterTickets(proj, cur, fut) : [];
    const hasJql = pst.mode === 'jql' && pst.jql && pst.jql.trim();
    const hasTickets = prioTickets.length > 0;

    if (hasJql || hasTickets) {
      lines.push('', 'h2. (U) Prioritization / Upcoming');
      if (hasJql) {
        // Emit a Jira Issues macro that Confluence will render as a live table
        const jql = pst.jql.trim();
        lines.push(`{jira:jqlQuery=${jql}|columns=${COLS}|maximumIssues=20}`);
      } else if (pst.mode === 'epic') {
        // Live query by selected epics — new backlog tickets added to these
        // epics will appear automatically. Exclude done and (unless opted in)
        // the current/future sprint tickets, mirroring _eosPrioFilterTickets.
        const epicKeys = (pst.epicKeys || []).filter(Boolean);
        if (epicKeys.length) {
          const sprintExcl = pst.includeInSprint
            ? ''
            : ` AND Sprint not in ("${spfx} ${cur}","${spfx} ${fut}")`;
          const clause = `"Epic Link" in (${epicKeys.join(',')}) AND status not in (Done,Closed,Resolved)${sprintExcl}`;
          lines.push('_(Backlog tickets from selected epics)_','');
          lines.push(`{jira:jqlQuery=${clause} ${ORDER}|columns=${COLS}|maximumIssues=20}`);
        } else {
          lines.push(tableFromKeys(prioTickets));
        }
      } else {
        // 'created' mode — time-based snapshot, key-based.
        lines.push(`_(Tickets created in the last ${pst.days || 14} days)_`,'');
        lines.push(tableFromKeys(prioTickets));
      }
      lines.push('');
    }
  }

  // Additional sections: Deployments, User Engagement, Demonstrations
  // Use childNodes.length to detect real content — innerText picks up the
  // CSS ::before placeholder text on empty contenteditable divs, which
  // would leak "NSTR for this period." as if the user typed it.
  const addlSections = ['Deployments', 'User Engagement and New Requirements', 'Demonstrations'];
  addlSections.forEach(label => {
    const slug = `eos-addl-${proj.toLowerCase()}-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
    const el = document.getElementById(slug);
    const hasContent = el && el.childNodes.length > 0 && (el.textContent || '').trim().length > 0;
    lines.push('', `h3. (U) ${label}`, '');
    if (hasContent) {
      const txt = (el.innerText || el.textContent || '').trim();
      const items = txt.split('\n').filter(Boolean);
      items.forEach((line, i) => {
        lines.push(`* (U) ${line}`);
        if (i < items.length - 1) lines.push('');
      });
    } else {
      lines.push('* (U) _NSTR for this period._');
    }
  });
  lines.push('');

  return lines.join('\n').trim();
}

// Regenerate all EOS Confluence texts from the current DOM. Called before
// copying or when switching to the Confluence tab so user-typed BLUF /
// summary fields are always up to date.
// Copy the AI prompt + ticket list for a specific EOS topic to clipboard.
// Called from the AI button on each topic section.
async function copyEosAiPrompt(proj, tidx) {
  const data = S._eosTopicResults && S._eosTopicResults[proj];
  if (!data) { alert('Run the EOS report first.'); return; }
  const topic = data.topics[tidx];
  if (!topic) return;
  const res = data.results[topic.header];
  if (!res) return;
  const prompt = S.cfg.eos_ai_prompt || '';
  const lines = [`Topic: ${topic.header}`, ''];
  if (res.current.length) {
    lines.push(`Current Sprint (${data.cur}) — completed work:`);
    res.current.forEach(t => lines.push(`- ${t.issue_key}: ${t.summary}`));
    lines.push('');
  }
  if (res.future.length) {
    lines.push(`Future Sprint (${data.fut}) — planned work:`);
    res.future.forEach(t => lines.push(`- ${t.issue_key}: ${t.summary}`));
    lines.push('');
  }
  const text = prompt + '\n\n' + lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    // Brief visual feedback on the button
    const btn = event && event.target.closest('button');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="mi" style="font-size:13px;margin-right:2px">check</span>Copied';
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    }
  } catch(e) {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function refreshEOSConfluenceTexts(){
  const params = S.eosConfParams || {};
  Object.entries(params).forEach(([proj, p]) => {
    S.eosConfluenceTexts[proj] = buildEOSConfluence(p.meta, p.proj, p.topics, p.results, p.blocked, p.projTickets, p.cur, p.fut, p.spfx);
    // Also refresh the Confluence tab <pre> if it's in the DOM
    const pre = document.getElementById('conf-'+proj.toLowerCase());
    if(pre) pre.textContent = S.eosConfluenceTexts[proj];
  });
}

// ── EOS Prioritization / Upcoming section ──────────────────────────────
// Per-project interactive section at the bottom of each EOS Report tab.
// Three modes:
//   1. By Epic — filter loaded CSV for backlog tickets in specific epics
//   2. Recently Created — tickets created within the last N days
//   3. Custom JQL — user-typed JQL string (not executed; included in
//      Confluence output so the Jira macro can run it there)
// State lives on S.cfg.eos_prioritization[proj] so it persists to
// localStorage via autoSaveCfg(). Results come from S.allTickets.

function _eosPrioState(proj) {
  if (!S.cfg.eos_prioritization) S.cfg.eos_prioritization = {};
  if (!S.cfg.eos_prioritization[proj]) {
    S.cfg.eos_prioritization[proj] = {
      mode: 'epic',        // 'epic' | 'created' | 'jql'
      epicKeys: [],        // selected epic_link values
      days: 14,            // "created in the last N days"
      jql: '',             // raw JQL text
      includeInSprint: false // if true, also show tickets already in cur/fut sprint
    };
  }
  return S.cfg.eos_prioritization[proj];
}

// Collect unique epics for a project from the loaded tickets.
function _eosPrioAvailableEpics(proj) {
  const seen = {};
  (S.allTickets || []).forEach(t => {
    if (t.project_bucket !== proj) return;
    if (!t.epic_link) return;
    if (!seen[t.epic_link]) seen[t.epic_link] = t.epic_name || t.epic_link;
  });
  // Also pull from S.epicMap for any epics that match the project prefix
  const prefixes = { DX:'DX-', LX:'LX-', RC:'RCR-' };
  const pfx = prefixes[proj] || (proj + '-');
  Object.entries(S.epicMap || {}).forEach(([k, name]) => {
    if (k.startsWith(pfx) && !seen[k]) seen[k] = name;
  });
  return Object.entries(seen)
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Filter tickets for the prioritization results based on current mode.
function _eosPrioFilterTickets(proj, cur, fut) {
  const st = _eosPrioState(proj);
  const all = (S.allTickets || []).filter(t => t.project_bucket === proj);
  // Exclude tickets in the current/future sprint unless the user opts in
  const pool = st.includeInSprint ? all : all.filter(t => !sprintMatches(t, cur) && !sprintMatches(t, fut));
  // Exclude done/closed tickets
  const open = pool.filter(t => !['done','closed','resolved'].includes((t.status||'').toLowerCase()));

  if (st.mode === 'epic') {
    if (!st.epicKeys.length) return [];
    const keySet = new Set(st.epicKeys);
    return open.filter(t => keySet.has(t.epic_link));
  }
  if (st.mode === 'created') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (st.days || 14));
    return open.filter(t => t.created_dt && t.created_dt >= cutoff);
  }
  // 'jql' mode — no CSV filtering; the JQL is for Confluence
  return [];
}

// Render the prioritization section HTML for a single project.
function buildEOSPrioritizationHtml(proj, cur, fut) {
  const st = _eosPrioState(proj);
  const pl = proj.toLowerCase();
  const epics = _eosPrioAvailableEpics(proj);
  const results = _eosPrioFilterTickets(proj, cur, fut);

  // Mode pills
  const modes = [
    { id:'epic',    label:'By Epic' },
    { id:'created', label:'Recently Created' },
    { id:'jql',     label:'Custom JQL' }
  ];
  const pills = modes.map(m =>
    `<button class="r-subtab eos-prio-mode${st.mode===m.id?' active':''}" data-prio-proj="${esc(proj)}" data-prio-mode="${m.id}" style="font-size:var(--fs-xs)">${m.label}</button>`
  ).join('');

  // Controls per mode
  let controls = '';
  if (st.mode === 'epic') {
    const opts = epics.map(e => {
      const sel = st.epicKeys.includes(e.key) ? ' selected' : '';
      return `<option value="${esc(e.key)}"${sel}>${esc(e.name)} (${esc(e.key)})</option>`;
    }).join('');
    controls = `<div style="margin:8px 0">
      <label style="font-size:var(--fs-xs);color:var(--mu)">Select epics to show backlog tickets for:</label>
      <select id="eos-prio-epics-${pl}" multiple size="${Math.min(6, Math.max(3, epics.length))}" style="width:100%;font-size:var(--fs-xs);margin-top:4px" data-prio-proj="${esc(proj)}" data-prio-field="epicKeys">${opts}</select>
      <div class="u-muted-xs" style="margin-top:2px">${epics.length} epic${epics.length !== 1 ? 's' : ''} available · Hold Ctrl/Cmd to select multiple</div>
    </div>`;
  } else if (st.mode === 'created') {
    controls = `<div style="margin:8px 0" class="row" style="gap:8px;align-items:center">
      <label style="font-size:var(--fs-xs);color:var(--mu)">Tickets created in the last</label>
      <input type="number" id="eos-prio-days-${pl}" value="${st.days}" min="1" max="365" style="width:60px;font-size:var(--fs-xs)" data-prio-proj="${esc(proj)}" data-prio-field="days">
      <span style="font-size:var(--fs-xs);color:var(--mu)">days</span>
    </div>`;
  } else {
    // JQL
    controls = `<div style="margin:8px 0">
      <label style="font-size:var(--fs-xs);color:var(--mu)">Paste JQL below. This text is included in the Confluence output — Confluence's Jira macro will execute it.</label>
      <textarea id="eos-prio-jql-${pl}" rows="3" style="width:100%;font-size:var(--fs-xs);font-family:var(--mono);margin-top:4px;resize:vertical" data-prio-proj="${esc(proj)}" data-prio-field="jql" placeholder="project = ${proj === 'RC' ? 'RCR' : proj} AND created >= -14d ORDER BY created DESC">${esc(st.jql)}</textarea>
    </div>`;
  }

  // Include-in-sprint toggle
  const inSprintChk = st.mode !== 'jql'
    ? `<label class="row" style="gap:4px;align-items:center;font-size:var(--fs-xs);color:var(--mu);margin:4px 0"><input type="checkbox" data-prio-proj="${esc(proj)}" data-prio-field="includeInSprint" ${st.includeInSprint?'checked':''}> Include tickets already in ${esc(cur)} / ${esc(fut)}</label>`
    : '';

  // Results table
  let resultsHtml = '';
  if (st.mode === 'jql') {
    resultsHtml = st.jql
      ? `<div class="u-muted-xs" style="padding:6px;background:var(--s2);border:1px solid var(--bd);border-radius:4px;margin-top:8px"><span class="mi" style="font-size:13px;vertical-align:middle;margin-right:4px">info</span>JQL will be executed by Confluence when pasted — no preview available here.</div>`
      : '';
  } else if (results.length) {
    // Sort by epic then issue key (same pattern as ticketList)
    const sorted = [...results].sort((a, b) => {
      const ea = (a.epic_name || '').toLowerCase(), eb = (b.epic_name || '').toLowerCase();
      if (ea !== eb) return ea.localeCompare(eb);
      return a.issue_key.localeCompare(b.issue_key);
    });
    const rows = sorted.map(t =>
      `<tr><td style="white-space:nowrap">${jiraLink(t.issue_key)}</td><td style="font-size:var(--fs-xs)">${esc(t.epic_name)}</td><td>${esc(t.summary)}</td><td style="white-space:nowrap">${statusBadge(t.status)}</td><td style="text-align:right">${t.story_points}</td></tr>`
    ).join('');
    resultsHtml = `<div class="tw" style="max-height:300px;overflow:auto;margin-top:8px"><table class="rt"><thead><tr><th>Key</th><th>Epic</th><th>Summary</th><th>Status</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    resultsHtml += `<div class="u-muted-xs" style="margin-top:4px">${results.length} ticket${results.length !== 1 ? 's' : ''} · ${results.reduce((s, t) => s + (t.story_points || 0), 0)} pts</div>`;
  } else if (st.mode === 'epic' && !st.epicKeys.length) {
    resultsHtml = '<div class="u-muted-xs" style="padding:6px">Select one or more epics above.</div>';
  } else {
    resultsHtml = '<div class="u-muted-xs" style="padding:6px">No matching tickets found.</div>';
  }

  return `<div class="r-card l2" id="eos-prio-${pl}" data-prio-proj="${esc(proj)}" data-prio-cur="${esc(cur)}" data-prio-fut="${esc(fut)}">
    <h3 style="text-transform:none;font-size:var(--fs-sm);color:var(--a4)">Prioritization / Upcoming</h3>
    <div class="r-subtabs" style="margin-bottom:6px">${pills}</div>
    ${controls}
    ${inSprintChk}
    <div id="eos-prio-results-${pl}">${resultsHtml}</div>
  </div>`;
}

// Re-render just the prioritization section for a project without nuking
// the rest of the EOS report. Reads cur/fut from data attributes.
function refreshEOSPrioritization(proj) {
  const pl = proj.toLowerCase();
  const wrap = document.getElementById('eos-prio-' + pl);
  if (!wrap) return;
  const cur = wrap.dataset.prioCur || '';
  const fut = wrap.dataset.prioFut || '';
  const fresh = buildEOSPrioritizationHtml(proj, cur, fut);
  wrap.outerHTML = fresh;
  wireEOSPrioritizationListeners(proj);
}

// Wire interactive listeners for the prioritization controls.
function wireEOSPrioritizationListeners(proj) {
  const pl = proj.toLowerCase();
  const wrap = document.getElementById('eos-prio-' + pl);
  if (!wrap) return;
  const st = _eosPrioState(proj);

  // Mode pills
  wrap.querySelectorAll('.eos-prio-mode').forEach(btn => {
    btn.addEventListener('click', function() {
      st.mode = this.dataset.prioMode;
      autoSaveCfg();
      refreshEOSPrioritization(proj);
    });
  });

  // Epic multi-select
  const epicSel = document.getElementById('eos-prio-epics-' + pl);
  if (epicSel) {
    epicSel.addEventListener('change', function() {
      st.epicKeys = Array.from(this.selectedOptions).map(o => o.value);
      autoSaveCfg();
      refreshEOSPrioritization(proj);
    });
  }

  // Days input
  const daysIn = document.getElementById('eos-prio-days-' + pl);
  if (daysIn) {
    daysIn.addEventListener('change', function() {
      st.days = parseInt(this.value, 10) || 14;
      autoSaveCfg();
      refreshEOSPrioritization(proj);
    });
  }

  // JQL textarea — debounced save so localStorage isn't hammered on each keystroke
  const jqlIn = document.getElementById('eos-prio-jql-' + pl);
  if (jqlIn) {
    let jqlTimer = null;
    jqlIn.addEventListener('input', function() {
      st.jql = this.value;
      if (jqlTimer) clearTimeout(jqlTimer);
      jqlTimer = setTimeout(function(){ autoSaveCfg(); }, 800);
    });
  }

  // Include-in-sprint checkbox
  wrap.querySelectorAll('[data-prio-field="includeInSprint"]').forEach(chk => {
    chk.addEventListener('change', function() {
      st.includeInSprint = this.checked;
      autoSaveCfg();
      refreshEOSPrioritization(proj);
    });
  });
}

