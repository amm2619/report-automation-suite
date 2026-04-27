// ============================================================
// SHARED HTML HELPERS
// ============================================================

// ── Report frame top bar ─────────────────────────────────────
// Builds the sticky rpt-bar for every report frame.
// opts: { icon, iconColor, title, subtitle, frameId, reportType,
//         primaryBtn: {label, icon, onclick, id?, extraHtml?} }
// The overflow menu no longer contains draft JSON or fullscreen — those are gone.
// Fullscreen is an inline icon button in the bar. extraHtml is injected after the primary button.
function buildRptBar(opts) {
  const { icon, iconColor, title, subtitle, frameId, reportType, primaryBtn } = opts;
  const pb = primaryBtn || {};
  const extraHtml = pb.extraHtml || '';
  const idAttr = pb.id ? ` id="${pb.id}"` : '';
  return `<div class="rpt-bar rpt-bar-sticky">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        <span class="mi" style="font-size:15px;color:${iconColor}">${icon}</span>
        <span style="font-weight:600;font-size:var(--fs-sm)">${title}</span>
        <span class="rpt-bar-fn">${subtitle}</span>
      </div>
      <div class="u-flex-6">
        <button class="btn btn-primary btn-sm"${idAttr} onclick="${pb.onclick}"><span class="mi" style="font-size:14px;margin-right:4px">${pb.icon||'content_copy'}</span>${pb.label}</button>
        ${extraHtml}
        <button class="btn btn-ghost btn-xs fs-btn" onclick="fullscreenReport('${frameId}')" title="Fullscreen (Esc to exit)"><span class="mi">open_in_full</span></button>
      </div>
    </div>`;
}

// base param kept for call-site backward compat but unused — jiraLink() reads S.cfg.jira_url directly
function ticketList(tickets, base){ // eslint-disable-line no-unused-vars
  if(!tickets.length) return '<div class="nstr">NSTR for this period.</div>';
  // Sort by epic name first (groups related tickets), then by issue key
  const sorted=[...tickets].sort((a,b)=>{
    const ea=(a.epic_name||'').toLowerCase(), eb=(b.epic_name||'').toLowerCase();
    if(ea!==eb) return ea.localeCompare(eb);
    return a.issue_key.localeCompare(b.issue_key);
  });
  return `<ul class="tl">${sorted.map(t=>{
    const link=jiraLink(t.issue_key,'tk');
    return `<li>${link}<span class="ts">${esc(t.summary)}</span></li>`;
  }).join('')}</ul>`;
}
// base param unused — see ticketList note above
// Sort contract: callers are responsible for pre-sorting tickets before passing in.
// (ticketList sorts internally by issue_key; ticketTable does NOT — respects caller order)
function ticketTable(tickets, base){ // base unused — see ticketList note above
  if(!tickets.length) return '<div class="nstr">NSTR</div>';
  const rows=tickets.map(t=>{
    return `<tr><td style="width:20%">${esc(t.epic_name)}</td><td style="white-space:nowrap">${issueTypeBadge(t.issue_type)}${jiraLink(t.issue_key)}</td><td>${esc(t.summary)}</td><td style="white-space:nowrap">${statusBadge(t.status)}</td></tr>`;
  }).join('');
  return `<div class="tw"><table class="rt"><thead><tr><th style="width:20%">Epic</th><th style="width:11%">Key</th><th>Summary</th><th style="width:13%">Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function debugTable(rows, tableId){
  // Read the user-facing list at render time so the tooltip reflects current settings
  const ufList = (S.cfg && S.cfg.weekly && S.cfg.weekly.user_facing_components) || [];
  const chip = v => `<code style="font-size:var(--fs-xs);background:var(--s3);padding:1px 5px;border-radius:3px">${esc(v)}</code>`;
  const trs=rows.map(r=>{
    const res = r.result==='match'
      ? `<span class="r-match">✓ match</span>`
      : r.result==='excluded'
        ? `<span class="r-exc">⊘ excluded</span>`
        : `<span class="r-nm">— no match</span>`;

    // Build the decision line from the parsed reason
    const reasonRaw = r.reason||r.result;
    const colonIdx = reasonRaw.indexOf(':');
    const rtype = colonIdx>=0 ? reasonRaw.slice(0,colonIdx) : reasonRaw;
    const payload = colonIdx>=0 ? reasonRaw.slice(colonIdx+1) : '';
    let decisionLine = '';
    switch(rtype){
      case 'always_include_label':
        decisionLine = `${chip(payload)} → matched always-include keyword list`;
        break;
      case 'backend_component':
        decisionLine = `component ${chip(payload)} → excluded by backend list`;
        break;
      case 'keyword': {
        const [kw, src] = payload.split('|');
        decisionLine = `keyword ${chip(kw)}${src?` in ${esc(src)}`:''} → excluded by keyword list`;
        break;
      }
      case 'epic':
        decisionLine = `epic ${chip(payload)} → excluded by epic list`;
        break;
      case 'user_facing_component':
        decisionLine = `component ${chip(payload)} → matched user-facing list`;
        break;
      case 'not_user_facing': {
        const tip = ufList.length ? `user-facing list: ${ufList.join(', ')}` : 'user-facing list is empty';
        decisionLine = `<span title="${esc(tip)}" style="border-bottom:1px dotted var(--mu);cursor:help">no component in user-facing list</span>`;
        break;
      }
      default:
        decisionLine = esc(reasonRaw);
    }

    // Ticket context line: what's actually on the ticket (components + labels)
    const compsArr = Array.isArray(r.components) ? r.components : (r.components ? [r.components] : []);
    const compsStr = compsArr.length ? compsArr.join(', ') : '(none)';
    const labelsStr = (r.labels && String(r.labels).trim()) ? r.labels : '(none)';
    const ctxLine = `<div class="u-muted-xs" style="font-size:var(--fs-xs);margin-top:2px;opacity:.75">C: ${esc(compsStr)} · L: ${esc(labelsStr)}</div>`;

    // Include override button for excluded and no_match tickets
    const includeBtn = (r.result==='excluded' || r.result==='no_match')
      ? `<button id="dbg-inc-btn-${esc(r.issue_key)}" class="btn btn-ghost btn-xs" style="margin-left:8px" onclick="weeklyIncludeOverride('${esc(r.issue_key)}','${esc(r.reason||'')}')">+ Include</button>`
      : '';
    const reasonDisplay = `<div>${decisionLine}${includeBtn}</div>${ctxLine}`;
    return `<tr id="dbgrow-${esc(r.issue_key)}"><td class="tk-c">${jiraLink(r.issue_key)}</td><td>${esc(r.project_bucket)}</td><td class="r-rule">${reasonDisplay}</td><td>${res}</td></tr>`;
  }).join('');
  return `<div class="r-card"><div class="dbg-bar"><input class="dbg-in" oninput="filterDbg(this,'${tableId}')" placeholder="Filter by ticket key..."></div><div class="tw"><table class="rt" id="${tableId}"><thead><tr><th>Ticket</th><th>Project</th><th>Routing reason</th><th>Result</th></tr></thead><tbody>${trs}</tbody></table></div></div>`;
}
function eosDebugTable(allTraces, tableId){
  // Group by ticket — one summary row per ticket, winner prominent, rest collapsible
  const rows=allTraces.map(({ticket,traces},idx)=>{
    const winner=traces.find(tr=>tr.result==='match'&&
      traces.filter(t=>t.result==='match').every(t=>t.tier_rank>=tr.tier_rank));
    const matchCount=traces.filter(t=>t.result==='match').length;
    const winnerHtml=winner
      ? `<span class="r-match">✓ ${esc(winner.header)}</span> <span class="r-rule" style="font-size:var(--fs-xs)">${esc(winner.matched_rule||'')}</span>`
      : `<span class="r-nm">— no match</span>`;
    const detailId=`${tableId}-d${idx}`;
    const detailRows=traces.map(tr=>{
      const res=tr.result==='match'
        ? `<span class="r-match">✓ match</span>`
        : tr.result==='excluded'
          ? `<span class="r-exc">⊘ excluded</span>`
          : `<span class="r-nm">— no match</span>`;
      const rule=tr.matched_rule||tr.excluded_by||tr.fail_reason||'';
      const isWin=winner&&tr===winner;
      return `<tr style="${isWin?'background:rgba(62,207,142,.06)':''}">
        <td style="font-size:var(--fs-xs);padding-left:20px;color:var(--mu)">${esc(tr.header)}</td>
        <td class="u-muted-xs">${tr.tier_rank}</td>
        <td>${res}</td>
        <td class="r-rule">${esc(rule)}</td>
      </tr>`;
    }).join('');
    return `<tr>
      <td class="tk-c" style="white-space:nowrap">${jiraLink(ticket.issue_key)}</td>
      <td style="font-size:var(--fs-xs)">${winnerHtml}</td>
      <td style="text-align:right;white-space:nowrap">
        ${matchCount>0?`<button class="btn btn-ghost btn-xs" onclick="toggleDbgDetail('${detailId}')"><span class="mi" style="font-size:13px;margin-right:2px">chevron_right</span>${matchCount} match${matchCount!==1?'es':''}</button>`:'<span class="u-dim-xs">0 matches</span>'}
      </td>
    </tr>
    <tr id="${detailId}" style="display:none"><td colspan="3" style="padding:0">
      <table class="rt" style="margin:0;border-top:1px solid var(--bd)">
        <thead><tr><th>Topic</th><th>Tier</th><th>Result</th><th>Rule</th></tr></thead>
        <tbody>${detailRows}</tbody>
      </table>
    </td></tr>`;
  }).join('');

  return `<div class="r-card">
    <p class="muted mb8" style="font-size:var(--fs-xs)">One row per ticket — winner shown inline. Click "<span class="mi" style="font-size:13px">chevron_right</span>N matches" to see all evaluations for that ticket.</p>
    <div class="dbg-bar"><input class="dbg-in" oninput="filterDbg(this,'${tableId}')" placeholder="Filter by ticket key..."></div>
    <div class="tw"><table class="rt" id="${tableId}">
      <thead><tr><th>Ticket</th><th>Winner</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}
// ── Weekly: Include override from debug tab ──────────────────────────────
function weeklyIncludeOverride(issueKey, reason){
  const t = S.allTickets.find(tk=>tk.issue_key===issueKey);
  if(!t){ alert('Ticket not found in loaded data.'); return; }
  const proj = t.project_bucket;
  const copyDst = document.getElementById('w-copy-src');
  if(!copyDst){ alert('Re-run the Weekly report first.'); return; }
  const projNames = {DX:'DataXplorer',LX:'LinkXplorer',RC:'Rollercoaster'};

  // Find the project card
  let projCard = null;
  copyDst.querySelectorAll('.r-card h3').forEach(h=>{
    if(h.textContent===projNames[proj]) projCard=h.closest('.r-card');
  });
  if(!projCard){ alert('Project card not found. Re-run the report.'); return; }

  // Find or create the override section with a proper table
  let overrideSection = document.getElementById('w-override-'+proj.toLowerCase());
  if(!overrideSection){
    const sec = document.createElement('div');
    sec.id = 'w-override-'+proj.toLowerCase();
    sec.innerHTML = `<h3 style="font-size:var(--fs-xs);margin:12px 0 6px;color:var(--a4);text-transform:uppercase;letter-spacing:.5px">Included (override)</h3>`+
      `<div class="tw"><table class="rt"><thead><tr>`+
      `<th style="width:20%">Epic</th><th style="width:11%">Key</th><th>Summary</th><th style="width:13%">Status</th>`+
      `</tr></thead><tbody id="w-override-tbody-${proj.toLowerCase()}"></tbody></table></div>`;
    projCard.appendChild(sec);
    overrideSection = sec;
  }

  // Append row into the existing table tbody — same structure as ticketTable rows
  const tbody = document.getElementById('w-override-tbody-'+proj.toLowerCase());
  if(!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td style="width:20%">${esc(t.epic_name)}</td>`+
    `<td style="white-space:nowrap">${jiraLink(issueKey)}</td>`+
    `<td>${esc(t.summary)}</td>`+
    `<td style="white-space:nowrap">${statusBadge(t.status)}</td>`;
  tbody.appendChild(tr);

  // Update debug row
  const dbgRow = document.getElementById('dbgrow-'+issueKey);
  if(dbgRow){
    const lastCell = dbgRow.querySelector('td:last-child');
    if(lastCell) lastCell.innerHTML = '<span class="r-match">✓ included (override)</span>';
  }
  // Disable the include button
  const btn = document.getElementById('dbg-inc-btn-' + issueKey);
  if(btn){ btn.disabled=true; btn.textContent='✓ included'; }
}


function toggleDbgDetail(id){
  const el=document.getElementById(id); if(!el) return;
  const open=el.style.display==='none';
  el.style.display=open?'table-row':'none';
  const btn=el.previousElementSibling?.querySelector('button');
  if(btn){ const mi=btn.querySelector('.mi'); if(mi) mi.textContent=open?'expand_more':'chevron_right'; }
}
function filterDbg(input, tableId){
  const key=input.value.toLowerCase().trim();
  const table=document.getElementById(tableId);
  const tbody=table?table.querySelector('tbody'):null;
  if(!tbody) return;
  let lastSummary=null;
  tbody.querySelectorAll('tr').forEach(r=>{
    // Detail rows have no tk-c cell — skip them (leave display as-is)
    const keyCell=r.querySelector('.tk-c');
    if(!keyCell){ return; } // detail row — don't touch
    const match=!key||keyCell.textContent.toLowerCase().includes(key);
    r.style.display=match?'':'none';
    lastSummary=r;
  });
}

