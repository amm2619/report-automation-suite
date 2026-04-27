// ============================================================
// PMR REPORT
// ============================================================
function slideSlug(h){ return 'pmr-slide-'+h.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function runPMR(){
  if(!S.allTickets.length){
    const _po=document.getElementById('pmr-output');
    if(_po){_po.innerHTML='<div class="card lr"><div class="card-title" style="color:var(--a5)">No Data</div><div>Load the Issues CSV first.</div></div>';return;}
    alert('Load jira_issues_master.csv first.'); return;
  }
  S._unmatchedLookup={};  // clear stale entries from previous runs
  const p = S._wizParams || {};
  const startStr = p.pmrStart || '';
  const endStr   = p.pmrEnd   || '';
  if(!startStr||!endStr){ alert('Set start and end dates.'); return; }
  const startDt=new Date(startStr+'T00:00:00Z');
  const endDt=new Date(endStr+'T23:59:59Z');
  const label=`${fmtDate(startDt)} – ${fmtDate(endDt)}`;
  const base=S.cfg.jira_url||'';
  const today=new Date();

  // Non-future sprints: calendar entries whose start date <= today
  // We check if a ticket's sprint NAME *contains* the sprint number (handles "DX 26.2.6" matching "26.2.6")
  const cal=S.cfg.sprint_calendar||[];
  const nonFutureNums=cal
    .filter(s=>new Date(s.start+'T00:00:00Z')<=today)
    .map(s=>s.sprint.toLowerCase().trim());

  function sprintIsNonFuture(sprintName){
    if(!sprintName) return false;
    const sn=sprintName.toLowerCase().trim();
    return nonFutureNums.some(num=>sn===num||sn.endsWith(' '+num)||sn.endsWith('-'+num)||sn.includes(num));
  }

  // Sprints whose calendar dates overlap the selected month
  const sprintsInMonth = new Set(
    cal.filter(sc => {
      const spStart = new Date(sc.start+'T00:00:00Z');
      const spEnd   = new Date(sc.end  +'T23:59:59Z');
      return spStart<=endDt && spEnd>=startDt;
    }).map(sc=>sc.sprint.toLowerCase().trim())
  );

  const scoped=S.allTickets.filter(t=>{
    // Must be updated OR resolved within the month
    const u=t.updated_dt, r=t.resolved_dt;
    const dateInMonth=(u&&u>=startDt&&u<=endDt)||(r&&r>=startDt&&r<=endDt);
    if(!dateInMonth) return false;
    // If no calendar, date match is enough
    if(!sprintsInMonth.size) return true;
    // Ticket's sprint must overlap the month (prevents old-sprint edits sneaking in)
    const ticketSprints=t.sprints||[t.sprint||''];
    return ticketSprints.some(s=>{
      const sn=(s||'').toLowerCase().trim();
      return [...sprintsInMonth].some(ms=>sn===ms||sn.endsWith(' '+ms)||sn.includes(ms));
    });
  });

  const topicMap={};
  S.topics.forEach(t=>topicMap[t.topic_id]=[]);
  const allTraces=[];
  const unmatched=[];

  scoped.forEach(ticket=>{
    const {best,traces}=findBestMatch(ticket,S.topics);
    allTraces.push({ticket,traces});
    if(!best){ unmatched.push(ticket); return; }
    if(!topicMap[best.topic_id]) topicMap[best.topic_id]=[];
    topicMap[best.topic_id].push(ticket);
  });

  // Groups
  const groups=S.cfg.pmr_groups||[];
  const groupIds=new Set(groups.flatMap(g=>g.topic_ids));
  const topicById=Object.fromEntries(S.topics.map(t=>[t.topic_id,t]));
  const groupById=Object.fromEntries(groups.map(g=>[g.group_id,g]));
  // O(1) lookup: topic_id -> group_id (avoids groups.find inside the per-topic loop)
  const topicToGroupId={};
  groups.forEach(g=>g.topic_ids.forEach(tid=>{ topicToGroupId[tid]=g.group_id; }));

  // Single pass: build agenda items and slide html together to avoid two identical O(n) loops
  const seenGroups=new Set();
  let agendaItems='', slidesHtml='';

  // ── Integrated Milestone Roadmap insertion planning ───────────────────
  // Build the roadmap agenda + slide HTML up front. Then decide where to
  // splice it in:
  //   1. Before the first "T1" topic, detected by tier_rank in [1..4] OR
  //      by the header matching /tier\s*1/i. Tolerates customized topic
  //      lists where tier_rank isn't set.
  //   2. If no T1 topic exists, prepend (right after agenda) so the slide
  //      still has predictable leading placement.
  //   3. If the feature is disabled or there are no slides, skip entirely.
  const rm = S.cfg.pmr_roadmap;
  const roadmapParts = { agendaHtml: '', slidesHtml: '' };
  if (rm && rm.enabled && Array.isArray(rm.slides) && rm.slides.length) {
    rm.slides.forEach(slide => {
      const title = slide.title || 'Integrated Milestone Roadmap';
      const sid = slideSlug(title);
      roadmapParts.agendaHtml += '<li class="has"><a href="#'+sid+'" style="color:inherit;text-decoration:none">'+esc(title)+'</a></li>';
      // Snapshot the slide config + selected milestones. URI-encoded so the
      // JSON survives HTML attribute quoting.
      const payload = { slide, milestones: pmrRoadmapMilestonesForSlide(slide) };
      const encoded = encodeURIComponent(JSON.stringify(payload));
      const previewSvg = (typeof pmrRoadmapRenderPreviewSvg === 'function')
        ? pmrRoadmapRenderPreviewSvg(slide, 1200, 520) : '';
      roadmapParts.slidesHtml += '<div class="slide" id="'+sid+'" data-pmr-layout="integrated_roadmap">'
        + '<h2>(U) '+esc(title)+'</h2>'
        + '<div class="pmr-roadmap-wrap" data-roadmap="'+encoded+'">'
        +   previewSvg
        + '</div></div>';
    });
  }
  const hasRoadmap = !!(roadmapParts.slidesHtml);

  // Detect "first T1 topic" using tier_rank primarily and header regex as
  // a fallback. Same predicate used whether the topic belongs to a group
  // or is standalone.
  const isT1Topic = (t) => {
    if (!t) return false;
    if (typeof t.tier_rank === 'number' && t.tier_rank >= 1 && t.tier_rank <= 4) return true;
    return /\btier\s*1\b/i.test(t.header || '');
  };

  let roadmapEmitted = false;
  const emitIntegratedRoadmap = () => {
    if (roadmapEmitted || !hasRoadmap) return;
    roadmapEmitted = true;
    agendaItems += roadmapParts.agendaHtml;
    slidesHtml += roadmapParts.slidesHtml;
  };

  S.topics.forEach(t=>{
    // First T1 topic seen → inject the roadmap slide(s) right before it
    if (isT1Topic(t)) emitIntegratedRoadmap();
    const gid=topicToGroupId[t.topic_id];
    if(gid){
      if(seenGroups.has(gid)) return;
      seenGroups.add(gid);
      const g=groupById[gid];
      const has=g.topic_ids.some(tid=>(topicMap[tid]||[]).length>0);
      const gLink=has?'<a href="#'+slideSlug(g.header)+'" style="color:inherit;text-decoration:none">'+esc(g.header)+'</a>':esc(g.header)+' — NSTR';
      agendaItems+='<li class="'+(has?'has':'nstr')+'">'+gLink+'</li>';
      // Slide
      const subheaders=g.topic_ids.map(tid=>({header:topicById[tid]?.header||tid,tickets:topicMap[tid]||[]}));
      const allTix=subheaders.flatMap(s=>s.tickets);
      if(allTix.length){
        const layout=S.cfg.pmr_layouts[gid]||'simple_list';
        slidesHtml+=renderSlide(g.header,subheaders,layout,base,true);
      }
    } else {
      if(groupIds.has(t.topic_id)) return;
      const tix=topicMap[t.topic_id]||[];
      const has=tix.length>0;
      const tLink=has?'<a href="#'+slideSlug(t.header)+'" style="color:inherit;text-decoration:none">'+esc(t.header)+'</a>':esc(t.header)+' — NSTR';
      agendaItems+='<li class="'+(has?'has':'nstr')+'">'+tLink+'</li>';
      if(has){
        const layout=S.cfg.pmr_layouts[t.topic_id]||t.slide_type||'simple_list';
        slidesHtml+=renderSlide(t.header,[{header:t.header,tickets:tix}],layout,base,false);
      }
    }
  });
  // Safety net: if no T1 topic was encountered, the roadmap would otherwise
  // be silently dropped. Prepend it to agenda + slides so it lands at the
  // start of the deck rather than the end — leading placement matches user
  // expectation when tier anchoring fails.
  if (hasRoadmap && !roadmapEmitted) {
    agendaItems = roadmapParts.agendaHtml + agendaItems;
    slidesHtml  = roadmapParts.slidesHtml  + slidesHtml;
    roadmapEmitted = true;
  }
  const agendaHtml='<ul class="agenda-list">'+agendaItems+'</ul>';

  const total=scoped.length;
  const matched=total-unmatched.length;

  const reportHtml=`
  <div class="slide"><h2>Agenda</h2>${agendaHtml}</div>
  ${slidesHtml}`;

  const dbgHtml=eosDebugTable(allTraces,'pdbg');
  const umHtml=unmatchedPanel(unmatched,'PMR','um-pmr');

  // Inline roadmap editor panel — collapsible, lives inside the Report tab
  const roadmapEnabled = S.cfg.pmr_roadmap && S.cfg.pmr_roadmap.enabled;
  const roadmapPanel = `<details class="r-card" style="margin-top:16px;border-left:3px solid var(--a4);cursor:default"${roadmapEnabled ? '' : ' open'}>
    <summary style="cursor:pointer;font-weight:700;font-size:var(--fs-sm);color:var(--a4);user-select:none;display:flex;align-items:center;gap:8px;padding:4px 0">
      <span class="mi" style="font-size:16px">route</span>
      Integrated Milestone Roadmap
      <span style="flex:1"></span>
      <span style="font-size:var(--fs-xs);font-weight:400;color:var(--mu)">${roadmapEnabled ? 'Enabled' : 'Disabled'} &mdash; click to expand editor</span>
    </summary>
    <div style="margin-top:10px">
      <div class="row" style="gap:6px;margin-bottom:10px">
        <button class="btn btn-ghost btn-xs" onclick="exportPmrRoadmap()" title="Download roadmap milestones as JSON"><span class="mi" style="font-size:13px;margin-right:2px">download</span>Export Roadmap</button>
        <button class="btn btn-ghost btn-xs" onclick="document.getElementById('pmr-roadmap-import-file').click()" title="Import roadmap milestones from JSON"><span class="mi" style="font-size:13px;margin-right:2px">upload</span>Import Roadmap</button>
        <input type="file" id="pmr-roadmap-import-file" accept=".json" style="display:none" onchange="importPmrRoadmap(this)">
      </div>
      <div id="pmr-roadmap-editor-inline"></div>
    </div>
  </details>`;

  const html=`
  <div class="rpt-frame" id="rptf2">
    ${buildRptBar({icon:'bar_chart',iconColor:'var(--a4)',title:'PMR',
      subtitle:label,
      frameId:'rptf2',reportType:'pmr',
      primaryBtn:{label:'Copy Narrative',icon:'content_copy',onclick:'copyPmrNarrative()',extraHtml:'<span class="copy-status" id="pmr-narrative-cst"></span><button class="btn btn-ghost btn-sm" onclick="downloadPmrPptx()" title="Download PPTX directly in browser"><span class="mi" style="font-size:14px;margin-right:4px">slideshow</span>Download PPTX</button>'}})}
    <div class="rpt-body"><div class="rpt-body-inner">
      <div class="rpt-hdr" style="border-left-color:var(--a3)">
        <div><h1>${esc(S.cfg.pmr_title)}</h1><div class="rsub">${esc(label)}</div></div>
        <div class="row" style="gap:16px;align-items:center">
          <span class="u-muted-xs">${total} tickets &nbsp;·&nbsp; ${matched} matched &nbsp;·&nbsp; ${unmatched.length} unmatched</span>
          <span class="badge" style="background:var(--a3d);color:var(--a3);border:1px solid var(--a3b)">PMR</span>
        </div>
      </div>
      <div class="r-tabs r-tabs-sticky">
        <button class="r-tab active" onclick="switchRtab(this)">Report</button>
        <button class="r-tab" onclick="switchRtab(this)">Debug</button>
        <button class="r-tab" onclick="switchRtab(this)">Unmatched (${unmatched.length})</button>
      </div>
      <div class="r-panel active">${reportHtml}${roadmapPanel}</div>
      <div class="r-panel">${dbgHtml}</div>
      <div class="r-panel">${umHtml}</div>
    </div>
  </div>`;

  const _out_pmr=document.getElementById('pmr-output'); if(_out_pmr) _out_pmr.innerHTML=html;
  S.reportHtml.pmr=html;
  autoSaveDraft('pmr');
  checkDraftAndRestore('pmr');
  // Populate the inline roadmap editor (reuses the same render function
  // as the Settings page, but targets a different container ID).
  const inlineRoadmapEl = document.getElementById('pmr-roadmap-editor-inline');
  if (inlineRoadmapEl) {
    renderPmrRoadmapEditorInto(inlineRoadmapEl);
  }
  const _pdg=document.getElementById('pmr-dl-group'); if(_pdg) _pdg.style.display='flex';
}

// Render the roadmap editor into a specific container element (for inline
// use in the PMR report, separate from the Settings page instance).
function renderPmrRoadmapEditorInto(el) {
  if (!el) return;
  // Temporarily swap the target element ID so renderPmrRoadmapEditor
  // writes into our container instead of the settings one.
  const origId = 'pmr-roadmap-editor';
  el.id = origId;
  renderPmrRoadmapEditor();
  el.id = 'pmr-roadmap-editor-inline';
}

// Export the entire pmr_roadmap config as a JSON file.
function exportPmrRoadmap() {
  const data = S.cfg.pmr_roadmap;
  if (!data) { alert('No roadmap data to export.'); return; }
  const json = JSON.stringify(data, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  const d = new Date().toISOString().slice(0,10).replace(/-/g,'');
  a.download = 'pmr_roadmap_' + d + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Import a previously exported roadmap JSON. Merges milestones: imported
// items overwrite by ID, new IDs are appended, existing IDs not in the
// import are kept. Slide configs are replaced entirely.
function importPmrRoadmap(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported || typeof imported !== 'object') { alert('Invalid roadmap JSON.'); return; }
      const roadmap = S.cfg.pmr_roadmap;
      if (!roadmap) { alert('No roadmap config — run the PMR first.'); return; }
      // Replace slide definitions
      if (Array.isArray(imported.slides) && imported.slides.length) {
        roadmap.slides = imported.slides;
      }
      // Merge milestones: imported wins on ID match, new IDs appended
      if (Array.isArray(imported.milestones)) {
        const byId = {};
        (roadmap.milestones || []).forEach(m => { byId[m.id] = m; });
        imported.milestones.forEach(m => {
          if (byId[m.id]) {
            Object.assign(byId[m.id], m);
          } else {
            roadmap.milestones.push(m);
          }
        });
      }
      // Copy scalar fields
      if (typeof imported.enabled === 'boolean') roadmap.enabled = imported.enabled;
      if (typeof imported.seedVersion === 'number') roadmap.seedVersion = imported.seedVersion;
      autoSaveCfg();
      // Re-render both editor instances if they exist
      renderPmrRoadmapEditor();
      const inlineEl = document.getElementById('pmr-roadmap-editor-inline');
      if (inlineEl) renderPmrRoadmapEditorInto(inlineEl);
      alert('Roadmap imported: ' + (imported.milestones || []).length + ' milestones, ' + (imported.slides || []).length + ' slide(s).');
    } catch(err) {
      alert('Failed to parse roadmap JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function renderSlide(header,subheaders,layout,base,isGroup){
  const sid=slideSlug(header);
  const ctx=sid.replace(/^pmr-slide-/,''); // stable slug derived from slide header; passed down explicitly
  // blufBox hoisted here — single definition shared by all layout branches
  const blufBox=(slug)=>`<div class="bluf-field pmr-bluf" id="pmrbluf-${slug}" contenteditable="true" data-pmr-bluf="${slug}" data-placeholder="Enter narrative..." style="margin:4px 0 10px"></div>`;
  let html=`<div class="slide" id="${sid}" data-pmr-layout="${esc(layout||'simple_list')}"><h2>(U) ${esc(header)}</h2>`;
  // Top-level narrative box always present — appears below the slide title
  html+=blufBox(ctx);
  // feature_improvement_bug and mission_support_other layouts: always pool tickets,
  // never show per-topic sub-headers (DX4/DX Improvements or LX5/LX Improvements collapse into one list)
  const poolLayouts=['feature_improvement_bug','mission_support_other'];
  if(isGroup&&subheaders.length>1&&!poolLayouts.includes(layout)){
    subheaders.forEach(sh=>{
      if(!sh.tickets.length) return;
      const short=sh.header.split(':').pop().trim();
      html+=`<h3>${esc(short)}</h3>`;
      html+=renderSlideLayout(sh.tickets,layout,base,ctx,blufBox);
    });
  } else {
    html+=renderSlideLayout(subheaders.flatMap(s=>s.tickets),layout,base,ctx,blufBox);
  }
  return html+'</div>';
}
function renderSlideLayout(tickets,layout,base,ctx,blufBox){
  if(layout==='feature_improvement_bug'){
    const ftypes=S.cfg.pmr_feature_types||['story','user request','new feature'];
    const btypes=S.cfg.pmr_bug_types||['bug','defect'];
    const b={features:[],improvements:[],bugs:[]};
    tickets.forEach(t=>{
      const it=t.issue_type.toLowerCase();
      if(ftypes.some(f=>it.includes(f))) b.features.push(t);
      else if(btypes.some(f=>it.includes(f))) b.bugs.push(t);
      else b.improvements.push(t);
    });
    let h='';
    if(b.features.length){ h+=`<h4>New Features</h4>${blufBox(ctx+'-features')}${ticketList(b.features,base)}`; }
    if(b.improvements.length){ h+=`<h4>Improvements</h4>${blufBox(ctx+'-improvements')}${ticketList(b.improvements,base)}`; }
    if(b.bugs.length){ h+=`<h4>Bug Fixes</h4>${blufBox(ctx+'-bugs')}${ticketList(b.bugs,base)}`; }
    return h||'<div class="nstr">NSTR</div>';
  }
  if(layout==='project_split_3'){
    const b={DX:[],LX:[],RC:[]};
    tickets.forEach(t=>{ if(b[t.project_bucket]) b[t.project_bucket].push(t); });
    const names={DX:'DataXplorer',LX:'LinkXplorer',RC:'Rollercoaster'};
    let h='';
    Object.entries(b).forEach(([p,tix])=>{ if(tix.length){ h+=`<h4>${names[p]}</h4>${blufBox(ctx+'-'+p.toLowerCase())}${ticketList(tix,base)}`; } });
    return h||'<div class="nstr">NSTR</div>';
  }
  if(layout==='project_split_2'){
    const b={DX:[],RC:[]};
    tickets.forEach(t=>{ if(b[t.project_bucket]) b[t.project_bucket].push(t); });
    const names={DX:'DataXplorer',RC:'Rollercoaster'};
    let h='';
    Object.entries(b).forEach(([p,tix])=>{ if(tix.length){ h+=`<h4>${names[p]}</h4>${blufBox(ctx+'-'+p.toLowerCase())}${ticketList(tix,base)}`; } });
    return h||'<div class="nstr">NSTR</div>';
  }
  if(layout==='mission_support_other'){
    const b={ms:[],other:[]};
    tickets.forEach(t=>{ const bl=t.match_blob.toLowerCase(); if(['mission support','support','sustainment'].some(x=>bl.includes(x))) b.ms.push(t); else b.other.push(t); });
    let h='';
    if(b.ms.length){ h+=`<h4>Mission Support</h4>${blufBox(ctx+'-ms')}${ticketList(b.ms,base)}`; }
    if(b.other.length){ h+=`<h4>Other</h4>${blufBox(ctx+'-other')}${ticketList(b.other,base)}`; }
    return h||'<div class="nstr">NSTR</div>';
  }
  // simple_list — top-level blufBox is added by renderSlide; just render tickets here
  return ticketList(tickets,base);
}

