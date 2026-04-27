// ============================================================
// SPRINT METRICS
// ============================================================
const EOS_SPRINT_WINDOW=7; // visible sprints before "show more"

function populateEOSSprints(){
  const cal=S.cfg.sprint_calendar||[];
  if(!cal.length) return;
  const today=new Date().toISOString().slice(0,10);
  const curIdx=cal.findIndex(s=>s.start<=today&&today<=s.end);
  // EOS reports on the sprint that just ended; default Current Sprint to prev, Future to active
  const defCur=curIdx>0?curIdx-1:(curIdx===0?0:cal.length-2>=0?cal.length-2:0);

  const selCur=document.getElementById('eos-cur');
  const selFut=document.getElementById('eos-fut');
  if(!selCur||!selFut) return;

  // Build a windowed subset: 3 before current + current + 3 after = 7, expandable
  const showAll=selCur.dataset.showAll==='1';
  const windowStart=showAll?0:Math.max(0,defCur-3);
  const windowEnd=showAll?cal.length:Math.min(cal.length,defCur+4);
  const visible=cal.slice(windowStart,windowEnd);
  const visibleOffset=windowStart;

  const buildOptions=(sel,defaultIdx,isExpanded)=>{
    const curVal=sel.value;
    sel.innerHTML=visible.map((s,j)=>{
      const i=j+visibleOffset;
      const label=`${s.sprint}  (${s.start} → ${s.end})`;
      const sel_=(i===defaultIdx&&!curVal)?'selected':'';
      return `<option value="${esc(s.sprint)}" ${sel_}>${esc(label)}</option>`;
    }).join('');
    // Restore previous selection if still in list
    if(curVal&&[...sel.options].some(o=>o.value===curVal)) sel.value=curVal;
  };

  buildOptions(selCur,defCur,showAll);
  // Default future = the active sprint (one after the just-ended sprint)
  const defFutIdx=Math.min(defCur+1,cal.length-1);
  buildOptions(selFut,defFutIdx,showAll);

  // "Show more" toggle link
  const moreEl=document.getElementById('eos-sprint-more');
  if(moreEl){
    if(!showAll&&cal.length>EOS_SPRINT_WINDOW){
      moreEl.style.display='inline';
      moreEl.textContent=`Show all ${cal.length} sprints`;
    } else if(showAll){
      moreEl.style.display='inline';
      moreEl.textContent='Show fewer';
    } else {
      moreEl.style.display='none';
    }
  }

  const showHint=(sel,hintId)=>{
    const s=cal.find(x=>x.sprint===sel.value);
    const el=document.getElementById(hintId);
    if(el) el.textContent=s?`${s.start} → ${s.end}`:'';
  };
  showHint(selCur,'eos-cur-dates');
  showHint(selFut,'eos-fut-dates');

  // When current sprint changes, auto-advance future to the one after
  selCur.onchange=()=>{
    const curVal=selCur.value;
    const idx=cal.findIndex(s=>s.sprint===curVal);
    const nextIdx=Math.min(idx+1,cal.length-1);
    if(idx>=0&&nextIdx!==idx){
      // Only auto-set future if it currently points to the old default
      const futIdx=cal.findIndex(s=>s.sprint===selFut.value);
      const wasDefault=(futIdx===defCur+1||futIdx===defCur);
      if(wasDefault||!selFut.value){
        const nextSprint=cal[nextIdx]?.sprint;
        if(nextSprint&&[...selFut.options].some(o=>o.value===nextSprint)){
          selFut.value=nextSprint;
        }
      }
    }
    showHint(selCur,'eos-cur-dates');
    showHint(selFut,'eos-fut-dates');
    updateParamSummary('eos-params-summary','eos-cur','eos-fut');
  };
  selFut.onchange=()=>{ showHint(selFut,'eos-fut-dates'); updateParamSummary('eos-params-summary','eos-cur','eos-fut'); };
}

function eosToggleShowAll(){
  const sel=document.getElementById('eos-cur');
  if(!sel) return;
  sel.dataset.showAll=(sel.dataset.showAll==='1')?'0':'1';
  document.getElementById('eos-fut').dataset.showAll=sel.dataset.showAll;
  populateEOSSprints();
}

function runSprint(){
  const _sprintOut = document.getElementById('sprint-output');
  if(!S.allTickets.length){
    if(_sprintOut) _sprintOut.innerHTML = '<div class="card lr"><div class="card-title" style="color:var(--a5)">No Data</div><div>Load the Issues CSV first. Go back to Upload.</div></div>';
    else alert('Load jira_issues_master.csv first.');
    return;
  }
  S._unmatchedLookup={};  // clear stale entries from previous runs
  const cal=S.cfg.sprint_calendar;
  const today=new Date().toISOString().slice(0,10);
  let cur=cal.find(s=>s.start<=today&&today<=s.end)||cal[cal.length-1];
  const curIdx=cal.indexOf(cur);
  const prev=curIdx>0?cal[curIdx-1]:null;
  if(!prev){
    if(_sprintOut){_sprintOut.innerHTML='<div class="card lr"><div class="card-title" style="color:var(--a5)">No Sprint Calendar</div><div>Add at least 2 sprints in Settings → Sprint Calendar.</div></div>';return;}
    alert('Need at least 2 sprints in the sprint calendar.'); return;
  }
  const prevsprint=prev.sprint;
  const prevstart=prev.start;
  const prevend=prev.end;
  // Store sprint identity in wizParams so Recent Reports card can show it
  S._wizParams = Object.assign(S._wizParams||{}, { prevsprint, cursprint: cur.sprint });

  const PROJS=['DX','LX','RC','AFX'];
  const excl=new Set(S.cfg.excluded_assignees.map(a=>a.toLowerCase()));

  // Build ticket maps from allTickets using sprint matching
  // "Plan" = tickets in current sprint (what was planned)
  // "Report" = tickets in previous sprint (what was actually worked)
  const startTix={}, finalTix={};
  S.allTickets.forEach(t=>{
    if(!PROJS.includes(t.project_bucket)) return;
    if(excl.has((t.assignee||'').toLowerCase())) return;
    const tkt={
      key:t.issue_key, project:t.project_bucket,
      summary:t.summary, status:t.status,
      story_points:t.story_points,
      epic_name:t.epic_name,
      resolved_dt:t.resolved_dt
    };
    if(sprintMatches(t, cur.sprint)) startTix[t.issue_key]=tkt;
    if(sprintMatches(t, prevsprint)) finalTix[t.issue_key]=tkt;
  });

  // Plan metrics
  const planCount={Total:0},planPts={Total:0};
  PROJS.forEach(p=>{planCount[p]=0;planPts[p]=0;});
  Object.values(startTix).forEach(t=>{
    planCount[t.project]++;planPts[t.project]+=t.story_points;
    planCount.Total++;planPts.Total+=t.story_points;
  });

  // Report metrics — completed = resolved within prev sprint window
  const compCount={Total:0},compPts={Total:0};
  PROJS.forEach(p=>{compCount[p]=0;compPts[p]=0;});
  Object.values(finalTix).forEach(t=>{
    const res=t.resolved_dt;
    if(res){
      const rd=res.toISOString().slice(0,10);
      if(rd>=prevstart&&rd<=prev.end){
        compCount[t.project]++;compPts[t.project]+=t.story_points;
        compCount.Total++;compPts.Total+=t.story_points;
      }
    }
  });

  // Delta between cur and prev sprint
  const added=[], removed=[], changed=[];
  Object.entries(finalTix).forEach(([k,t])=>{
    if(!startTix[k]) added.push(t);
  });
  Object.entries(startTix).forEach(([k,t])=>{
    if(!finalTix[k]) removed.push(t);
  });

  const pct=(n,d)=>d===0?'—':`${((n/d)*100).toFixed(1)}%`;
  const fmt=v=>v===Math.floor(v)?v:v.toFixed(1);

  // ── Plan metrics table
  const planRows=[
    ['Planned Stories:',...PROJS.map(p=>planCount[p]),planCount.Total],
    ['Planned Story Points*:',...PROJS.map(p=>fmt(planPts[p])),fmt(planPts.Total)]
  ];
  // ── Report metrics table
  const repRows=[
    ['Planned stories',...PROJS.map(p=>planCount[p]),planCount.Total],
    ['Completed stories',...PROJS.map(p=>compCount[p]),compCount.Total],
    ['% stories completed',...PROJS.map(p=>pct(compCount[p],planCount[p])),pct(compCount.Total,planCount.Total)],
    ['Planned story points*',...PROJS.map(p=>fmt(planPts[p])),fmt(planPts.Total)],
    ['Completed story points*',...PROJS.map(p=>fmt(compPts[p])),fmt(compPts.Total)],
    ['% story points completed',...PROJS.map(p=>pct(compPts[p],planPts[p])),pct(compPts.Total,planPts.Total)],
    ['Award fee score','','','','','']
  ];
  const colHeader=['Metric',...PROJS,'Total'];

  // Stories tables
  const startStoriesHtml=sprintStoriesTable(Object.values(startTix),[]);
  const finalStoriesHtml=sprintStoriesTable(Object.values(finalTix),[...added.map(t=>t.key),...changed.map(t=>t.key)]);

  // Delta section inline in report
  const deltaHtml=buildDeltaHtml(added,removed,changed);

  // Cover HTML
  const coverHtml=metaTable([
    ['Sprint (Plan)',cur.sprint],['Sprint (Report)',prevsprint],
    ['Start Date',prevstart],['End Date',prev.end],
    ['Classification',S.cfg.classification],
    ['BT DO Line',S.cfg.bt_do_line],
    ['Report Number',S.cfg.report_number||'—'],
    ['Contract Number',S.cfg.contract_number||'—'],
    ['CDRL Number',S.cfg.cdrl_number||'—'],
  ]);

  const blurbs=S.cfg.schedule_blurbs||['TBD','TBD','TBD','TBD'];
  const infoHtml=metaTable(blurbs.map((b,i)=>[`${i+1}`,b||document.getElementById('sb'+(i+1))?.value||'TBD']));

  const rolesHtml=`<div class="tw"><table class="rt"><thead><tr><th>Role</th><th>Name</th><th>ID</th></tr></thead><tbody>${
    S.cfg.roles.map(r=>`<tr><td>${esc(r.role)}</td><td>${esc(r.name||'—')}</td><td>${esc(r.id||'—')}</td></tr>`).join('')
  }</tbody></table></div>`;

  const html=`
  <div class="rpt-frame" id="rptf3">
    ${buildRptBar({icon:'task_alt',iconColor:'var(--a3)',title:'Sprint Plan/Report',
      subtitle:prevsprint,
      frameId:'sprint-rpt-frame',reportType:'sprint',
      primaryBtn:{label:'Copy VBA',icon:'content_copy',onclick:'copySprintVBA()',
        extraHtml:'<button class="btn btn-ghost btn-sm" onclick="downloadSprintXlsx(\'plan\')"><span class="mi" style="font-size:14px;margin-right:4px">download</span>Download Plan XLSX</button><button class="btn btn-ghost btn-sm" onclick="downloadSprintXlsx(\'eos\')"><span class="mi" style="font-size:14px;margin-right:4px">table_chart</span>Download EOS XLSX</button><span class="copy-status" id="vba-copy-cst"></span>'}})}
    <div class="rpt-body"><div class="rpt-body-inner">
      <div class="rpt-hdr" style="border-left-color:var(--a4)">
        <div><h1>Agile Acquisition Sprint Package</h1><div class="rsub">Plan: ${esc(cur.sprint)} &nbsp;|&nbsp; Report: ${esc(prevsprint)}</div></div>
        <div class="row" style="gap:16px;align-items:center">
          <span class="u-muted-xs">Plan: ${planCount.Total} tickets &nbsp;·&nbsp; Report: ${Object.values(finalTix).length} tickets</span>
          <span class="badge" style="background:var(--a4d);color:var(--a4);border:1px solid var(--a4b)">Sprint Plan/Report</span>
        </div>
      </div>
      <div class="r-tabs r-tabs-sticky">
        <button class="r-tab active" onclick="switchRtab(this)">Sprint Plan</button>
        <button class="r-tab" onclick="switchRtab(this)">Sprint Report</button>
      </div>

      <!-- PLAN -->
      <div class="r-panel active">
        <div class="r-subtabs">
          <button class="r-subtab active" onclick="switchRstab(this)">Cover</button>
          <button class="r-subtab" onclick="switchRstab(this)">Information</button>
          <button class="r-subtab" onclick="switchRstab(this)">Sprint Plan</button>
          <button class="r-subtab" onclick="switchRstab(this)">User Stories</button>
          <button class="r-subtab" onclick="switchRstab(this)">Initial Incident</button>
          <button class="r-subtab" onclick="switchRstab(this)">Final Incident</button>
        </div>
        <div class="r-sub-panel active">${coverHtml}</div>
        <div class="r-sub-panel">${infoHtml}</div>
        <div class="r-sub-panel">${metricsTable(colHeader,planRows)}${rolesHtml}</div>
        <div class="r-sub-panel">${startStoriesHtml}</div>
        <div class="r-sub-panel">${incidentTable(false)}</div>
        <div class="r-sub-panel">${incidentTable(true)}</div>
      </div>

      <!-- REPORT -->
      <div class="r-panel">
        <div class="r-subtabs">
          <button class="r-subtab active" onclick="switchRstab(this)">Cover</button>
          <button class="r-subtab" onclick="switchRstab(this)">Information</button>
          <button class="r-subtab" onclick="switchRstab(this)">Sprint Report</button>
          <button class="r-subtab" onclick="switchRstab(this)">User Stories</button>
          <button class="r-subtab" onclick="switchRstab(this)">Initial Incident</button>
          <button class="r-subtab" onclick="switchRstab(this)">Final Incident</button>
        </div>
        <div class="r-sub-panel active">${coverHtml}</div>
        <div class="r-sub-panel">${infoHtml}</div>
        <div class="r-sub-panel">${metricsTable(colHeader,repRows)}${deltaHtml}</div>
        <div class="r-sub-panel">${finalStoriesHtml}</div>
        <div class="r-sub-panel">${incidentTable(false)}</div>
        <div class="r-sub-panel">${incidentTable(true)}</div>
      </div>
    </div>
  </div>`;

  const _out_sprint=document.getElementById('sprint-output');
  if(_out_sprint) _out_sprint.innerHTML=html; else console.warn('[ReportSuite] #sprint-output not in DOM - run from wizard');
  S.reportHtml.sprint=html;
  autoSaveDraft('sprint');
  const _sdg=document.getElementById('sprint-dl-group'); if(_sdg) _sdg.style.display='flex';
}

function buildDeltaHtml(added,removed,changed){
  if(!added.length&&!removed.length&&!changed.length) return '<div class="nstr" style="margin-top:12px">No changes detected between start and final snapshots.</div>';
  let h=`<div class="card lw" style="margin-top:14px"><div class="card-title">Sprint Changes</div>`;
  const projColor={DX:'delta-dx',LX:'delta-lx',RC:'delta-rc',AFX:''};
  if(added.length){
    h+=`<h3 style="font-size:var(--fs-xs);color:var(--a3);margin:8px 0 5px"><span class="mi" style="font-size:13px;margin-right:3px">arrow_upward</span>Added Mid-Sprint (${added.length})</h3>`;
    added.sort((a,b)=>a.key.localeCompare(b.key)).forEach(t=>{
      h+=`<div class="delta-row"><span class="badge bd-added">+added</span><span class="delta-key ${projColor[t.project]||''}">${jiraLink(t.key,'delta-key '+( projColor[t.project]||''))}</span><span class="delta-summary">${esc(t.summary)}</span><span class="delta-pts">${t.story_points}pt</span></div>`;
    });
  }
  if(removed.length){
    h+=`<h3 style="font-size:var(--fs-xs);color:var(--a5);margin:10px 0 5px"><span class="mi" style="font-size:13px;margin-right:3px">arrow_downward</span>Removed Mid-Sprint (${removed.length})</h3>`;
    removed.sort((a,b)=>a.key.localeCompare(b.key)).forEach(t=>{
      h+=`<div class="delta-row"><span class="badge bd-removed">−removed</span><span class="delta-key ${projColor[t.project]||''}">${jiraLink(t.key,'delta-key '+( projColor[t.project]||''))}</span><span class="delta-summary">${esc(t.summary)}</span><span class="delta-pts">${t.story_points}pt</span></div>`;
    });
  }
  if(changed.length){
    h+=`<h3 style="font-size:var(--fs-xs);color:var(--a4);margin:10px 0 5px">~ Changed Mid-Sprint (${changed.length})</h3>`;
    changed.sort((a,b)=>a.key.localeCompare(b.key)).forEach(t=>{
      h+=`<div class="delta-row"><span class="badge bd-changed">~changed</span><span class="delta-key ${projColor[t.project]||''}">${jiraLink(t.key,'delta-key '+( projColor[t.project]||''))}</span><span class="delta-summary">${esc(t.summary)}<br><span class="u-muted-xs">${(t.diffs||[]).join(' · ')}</span></span></div>`;
    });
  }
  return h+'</div>';
}

function sprintStoriesTable(tickets, highlightKeys){
  const hl=new Set(highlightKeys);
  const sorted=[...tickets].sort((a,b)=>a.key.localeCompare(b.key));
  if(!sorted.length) return '<div class="nstr">No stories found.</div>';
  const rows=sorted.map(t=>{
    const cls=hl.has(t.key)?'style="background:rgba(245,167,65,.05)"':'';
    const chg=hl.has(t.key)?'<span class="badge bd-changed" style="margin-left:6px">changed</span>':'';
    return `<tr ${cls}><td class="tk-c">${jiraLink(t.key)}${chg}</td><td>${esc(t.project)}</td><td style="font-size:var(--fs-xs)">${esc(t.epic_name)}</td><td>${esc(t.summary)}</td><td style="text-align:right">${t.story_points}</td></tr>`;
  }).join('');
  return `<div class="tw"><table class="rt"><thead><tr><th>Key</th><th>Proj</th><th>Epic</th><th>Summary</th><th style="text-align:right">Pts</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function metricsTable(headers,rows){
  const ths=headers.map(h=>`<th>${esc(h)}</th>`).join('');
  const trs=rows.map(r=>{
    const isPct=String(r[0]).startsWith('%');
    return `<tr>${r.map((v,i)=>{
      const style=isPct&&i>0?'style="color:var(--a3);text-align:right;font-variant-numeric:tabular-nums"':'';
      return `<td ${style}>${esc(String(v))}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<div class="tw"><table class="rt"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}
function metaTable(rows){
  return `<div class="tw"><table class="rt"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>`;
}
function incidentTable(final){
  const headers=['Incident ID','Classification','Project','Description','Impacted Story ID','Impacted Stories','Impacted Points*','Projected Duration'];
  if(final) headers.push('Disposition');
  return `<div class="tw"><table class="rt"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody><tr><td colspan="${headers.length}" style="color:var(--di);font-style:italic;text-align:center">No entries</td></tr></tbody></table></div>`;
}

