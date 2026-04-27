// ============================================================
// SPRINT DELTA
// ============================================================
function parseSprintReportText(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const added = [];    // ★ mid-sprint additions
  const removed = [];  // under "Issues Removed From Sprint"
  const all = [];      // everything seen
  let inRemoved = false;
  const ticketRe = /^([A-Z]+-\d+)\s+(.+?)(\s+★\s*)?$/;
  for(const line of lines){
    if(/issues removed from sprint/i.test(line)){ inRemoved=true; continue; }
    const m = ticketRe.exec(line);
    if(!m) continue;
    const key = m[1], summary = m[2].trim(), isMidSprint = !!m[3];
    if(inRemoved){ removed.push({key,summary}); }
    else {
      all.push({key,summary,isMidSprint});
      if(isMidSprint) added.push({key,summary});
    }
  }
  return {added,removed,all};
}

function runSprintDelta(){
  const ta = document.getElementById('sd-paste');
  const out = document.getElementById('sd-output');
  const msg = document.getElementById('sd-parse-msg');
  if(!ta||!out) return;
  const text = ta.value.trim();
  if(!text){ if(msg) msg.textContent='Paste sprint report text first.'; return; }
  const {added,removed,all} = parseSprintReportText(text);
  if(!all.length){ if(msg) msg.textContent='No tickets found — check the format.'; return; }
  if(msg) msg.textContent=`${all.length} tickets parsed · ${added.length} added mid-sprint · ${removed.length} removed`;

  // Cross-reference against loaded issues
  const ticketMap = {};
  S.allTickets.forEach(t=>{ ticketMap[t.issue_key]=t; });
  const excluded = new Set((S.cfg.excluded_assignees||[]).map(a=>a.toLowerCase()));

  function enrichRow(item, isMid=false, isRemoved=false){
    const t = ticketMap[item.key];
    const badge = isMid ? `<span style="color:var(--a4);font-weight:700">★ added mid-sprint</span>`
                : isRemoved ? `<span style="color:var(--a5)">removed</span>` : '';
    const assignee = t ? esc(t.assignee) : '<span style="color:var(--di)">not in CSV</span>';
    const isExcl = t && excluded.has((t.assignee||'').toLowerCase());
    const exclBadge = isExcl ? ` <span style="background:var(--a5d);color:var(--a5);font-size:var(--fs-xs);padding:1px 5px;border-radius:3px;border:1px solid var(--a5b)">excluded assignee</span>` : '';
    return `<tr><td class="tk-c">${jiraLink(item.key)}</td><td>${esc(item.summary)}</td>`+
      `<td>${assignee}${exclBadge}</td><td>${badge}</td></tr>`;
  }

  // Group by project
  const byProj = {};
  function processItems(items, isMid, isRemoved){
    items.forEach(item=>{
      const proj = item.key.replace(/-\d+$/,'');
      const bucket = proj==='RCR'?'RC':proj;
      if(!byProj[bucket]) byProj[bucket]={added:[],removed:[],regular:[]};
      if(isRemoved) byProj[bucket].removed.push(enrichRow(item,false,true));
      else if(isMid) byProj[bucket].added.push(enrichRow(item,true,false));
      else byProj[bucket].regular.push(enrichRow(item,false,false));
    });
  }
  processItems(all.filter(item=>item.isMidSprint),  true,  false);
  processItems(all.filter(item=>!item.isMidSprint), false, false);
  processItems(removed,                             false, true);

  const thead = `<tr><th>Key</th><th>Summary</th><th>Assignee</th><th>Note</th></tr>`;
  let html = '';
  Object.entries(byProj).sort().forEach(([proj,data])=>{
    const allRows = [...data.added,...data.regular,...data.removed];
    if(!allRows.length) return;
    html += `<div class="r-card l1" style="margin-bottom:12px">
      <div style="font-weight:700;font-size:var(--fs-base);margin-bottom:8px">${esc(proj)}</div>
      <div class="tw"><table class="rt"><thead>${thead}</thead><tbody>${allRows.join('')}</tbody></table></div>
    </div>`;
  });
  out.innerHTML = html || '<div class="nstr">No tickets found.</div>';
}

function clearSprintDelta(){
  const ta=document.getElementById('sd-paste');
  const out=document.getElementById('sd-output');
  const msg=document.getElementById('sd-parse-msg');
  if(ta) ta.value='';
  if(out) out.innerHTML='';
  if(msg) msg.textContent='';
}

// saveOverrideRule — active alias for applyOverride() used by inline onclick handlers
// in standalone HTML exports (buildStandaloneHtml). Do not remove.
function saveOverrideRule(){ applyOverride(); }
