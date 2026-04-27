// ============================================================
// WEEKLY REPORT
// ============================================================
function runWeekly(){
  if(!S.allTickets.length){
    const _wo=document.getElementById('weekly-output');
    if(_wo){_wo.innerHTML='<div class="card lr"><div class="card-title" style="color:var(--a5)">No Data</div><div>Load the Issues CSV first.</div></div>';return;}
    alert('Load jira_issues_master.csv first.'); return;
  }
  S._unmatchedLookup={};  // clear stale entries from previous runs
  // Params come from S._wizParams (set before step 2 re-render) or directly from DOM
  const p = S._wizParams || {};
  const startStr = p.wStart || '';
  const endStr   = p.wEnd   || '';
  if(!startStr||!endStr){
    const _out=document.getElementById('weekly-output');
    if(_out) _out.innerHTML='<div class="card lr"><div class="card-title">Weekly Digest</div><div>No date range selected. Set a date range in the batch params.</div></div>';
    else alert('Set start and end dates.');
    return;
  }
  const startDt=new Date(startStr+'T00:00:00Z');
  const endDt=new Date(endStr+'T23:59:59Z');
  const cfg=S.cfg;
  // Excluded assignees only apply to Sprint Metrics — all other reports show all tickets
  const sections={DX:{from_dxs:[],user_facing:[]},LX:{from_dxs:[],user_facing:[]},RC:{from_dxs:[],user_facing:[]}};
  const debugRows=[];
  const alwaysLabels=(cfg.weekly.always_include_labels||['dxs','gats']).map(l=>l.toLowerCase());

  S.allTickets.forEach(t=>{
    if(!sections[t.project_bucket]) return;
    if(!t.updated_dt||t.updated_dt<startDt||t.updated_dt>endDt) return;
    // Must also be in a sprint that overlaps the selected date range
    const cal=S.cfg.sprint_calendar||[];
    if(cal.length){
      const ticketSprints=t.sprints||[t.sprint||''];
      const inRange=ticketSprints.some(sprintName=>{
        const calEntry=cal.find(sc=>{
          const sn=(sc.sprint||'').toLowerCase().trim();
          const tsn=(sprintName||'').toLowerCase().trim();
          return tsn===sn||tsn.endsWith(' '+sn)||tsn.includes(sn);
        });
        if(!calEntry) return false;
        const spStart=new Date(calEntry.start+'T00:00:00Z');
        const spEnd=new Date(calEntry.end+'T23:59:59Z');
        return spStart<=endDt&&spEnd>=startDt;
      });
      if(!inRange) return;
    }
    const blob=normLower(t.match_blob);
    const labelsLower=(t.labels||'').toLowerCase();

    // Always-include keywords (dxs, gats) bypass all exclusion checks and route to FROM_DXS.
    // Matches the label field as a whole token OR any substring of the match_blob (summary/epic/labels/components).
    const alwaysLabel=alwaysLabels.find(l=>labelsLower.split(/[\s,;]+/).includes(l)||blob.includes(l));
    if(alwaysLabel){
      sections[t.project_bucket].from_dxs.push(t);
      debugRows.push({...t,result:'match',reason:`always_include_label:${alwaysLabel}`});
      return;
    }

    // Exclusions — only apply when no always-include label matched
    const matchedComp = cfg.weekly.backend_components.find(comp=>t.components.includes(comp));
    if(matchedComp){ debugRows.push({...t,result:'excluded',reason:`backend_component:${matchedComp}`}); return; }
    const exKw=cfg.weekly.excluded_summary_keywords.find(k=>blob.includes(k.toLowerCase()));
    if(exKw){
      // Detect which field the keyword was found in so the debug tab can show a source hint
      const kwLower=exKw.toLowerCase();
      const src=((t.summary||'').toLowerCase().includes(kwLower) && 'summary')
        || ((t.epic_name||'').toLowerCase().includes(kwLower) && 'epic name')
        || (((t.labels||'').toLowerCase()).includes(kwLower) && 'labels')
        || ((t.components||[]).some(c=>(c||'').toLowerCase().includes(kwLower)) && 'components')
        || '';
      debugRows.push({...t,result:'excluded',reason:`keyword:${exKw}|${src}`}); return;
    }
    if(cfg.weekly.excluded_epic_keys&&cfg.weekly.excluded_epic_keys.includes(t.epic_link)){ debugRows.push({...t,result:'excluded',reason:`epic:${t.epic_link}`}); return; }

    // Route by component
    const matchedUfComp=cfg.weekly.user_facing_components.find(c=>t.components.includes(c));
    if(matchedUfComp){ sections[t.project_bucket].user_facing.push(t); debugRows.push({...t,result:'match',reason:`user_facing_component:${matchedUfComp}`}); }
    else { debugRows.push({...t,result:'no_match',reason:'not_user_facing'}); }
  });

  const so=cfg.weekly.status_order||[];
  const sortT=tickets=>tickets.sort((a,b)=>{
    const ai=so.indexOf(a.status),bi=so.indexOf(b.status);
    return (ai<0?99:ai)-(bi<0?99:bi)||a.issue_key.localeCompare(b.issue_key);
  });
  const totalShown=Object.values(sections).reduce((s,b)=>s+b.from_dxs.length+b.user_facing.length,0);
  const totalDXS=Object.values(sections).reduce((s,b)=>s+b.from_dxs.length,0);
  const totalUF=Object.values(sections).reduce((s,b)=>s+b.user_facing.length,0);
  const base=cfg.jira_url||'';
  const dateRange=`${fmtDate(startDt)} – ${fmtDate(endDt)}`;

  let reportHtml=``;

  const projNames={DX:'DataXplorer',LX:'LinkXplorer',RC:'Rollercoaster'};
  ['DX','LX','RC'].forEach(pk=>{
    const bkt=sections[pk];
    const uid='bluf-'+pk.toLowerCase();
    reportHtml+=`<div class="r-card l1" style="margin-bottom:16px"><h3>${esc(projNames[pk])}</h3>`;
    if(!bkt.from_dxs.length&&!bkt.user_facing.length){
      reportHtml+=`<div class="nstr">NSTR for this period.</div></div>`;
      return;
    }
    reportHtml+=`<div style="margin-bottom:12px"><div class="bluf-label">BLUF</div><div class="bluf-field" id="${uid}" contenteditable="true" data-placeholder="Enter BLUF summary..."></div></div>`;
    if(bkt.from_dxs.length){
      reportHtml+=`<h3 style="font-size:var(--fs-xs);margin-bottom:6px">FROM_DXS</h3>${ticketTable(sortT(bkt.from_dxs),base)}`;
    }
    if(bkt.user_facing.length){
      reportHtml+=`<h3 style="font-size:var(--fs-xs);margin:12px 0 6px">Other User-Facing</h3>${ticketTable(sortT(bkt.user_facing),base)}`;
    }
    reportHtml+=`</div>`;
  });

  // Debug
  const dbgHtml=debugTable(debugRows,'wdbg');

  const html=`
  <div class="rpt-frame" id="rptf0">
    ${buildRptBar({icon:'newspaper',iconColor:'var(--a1)',title:'Weekly Digest',
      subtitle:S.fileNames?.issues ? esc(S.fileNames.issues) : '',
      frameId:'rptf0',reportType:'weekly',
      primaryBtn:{label:'Copy for Email',icon:'mail',onclick:'copyWeeklyForEmail()',id:'w-copy-btn',
        extraHtml:'<span class="copy-status" id="w-cst"></span><button class="btn btn-ghost btn-sm" onclick="openWeeklyConfluencePicker()"><span class="mi" style="font-size:14px;margin-right:4px">content_copy</span>Copy for Confluence</button>'}})}
    <div class="rpt-body"><div class="rpt-body-inner">
      <div class="rpt-hdr" style="border-left-color:var(--a1)">
        <div><h1>Weekly Digest</h1><div class="rsub">${esc(dateRange)}</div></div>
        <div class="row" style="gap:16px;align-items:center">
          <span class="u-muted-xs">${totalShown} tickets &nbsp;·&nbsp; ${totalDXS} FROM_DXS &nbsp;·&nbsp; ${totalUF} user-facing</span>
          <span class="badge" style="background:var(--a1d);color:var(--a1);border:1px solid var(--a1b)">Weekly</span>
        </div>
      </div>
      <div class="r-tabs r-tabs-sticky">
        <button class="r-tab active" onclick="switchRtab(this)">Report</button>
        <button class="r-tab" onclick="switchRtab(this)">Debug</button>
      </div>
      <div class="r-panel active"><div id="w-copy-src">${reportHtml}</div></div>
      <div class="r-panel">${dbgHtml}</div>
    </div>
  </div>`;

  const _out_weekly=document.getElementById('weekly-output'); if(_out_weekly) _out_weekly.innerHTML=html;
  S.reportHtml.weekly=html;
  autoSaveDraft('weekly');
  checkDraftAndRestore('weekly');
  const _wdg=document.getElementById('w-dl-group'); if(_wdg) _wdg.style.display='flex';
}

