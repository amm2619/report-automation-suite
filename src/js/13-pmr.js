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

  // Find future sprint tickets — these auto-populate the near-future panel.
  // "Future" = sprints in the month AFTER the selected PMR month.
  const nextMonthStart = new Date(endDt);
  nextMonthStart.setUTCDate(1);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  const nextMonthEnd = new Date(nextMonthStart);
  nextMonthEnd.setUTCMonth(nextMonthEnd.getUTCMonth() + 1);
  nextMonthEnd.setUTCDate(0); // last day of next month
  const futureSprintsInNextMonth = new Set(
    cal.filter(sc => {
      const spStart = new Date(sc.start+'T00:00:00Z');
      const spEnd   = new Date(sc.end  +'T23:59:59Z');
      return spStart <= nextMonthEnd && spEnd >= nextMonthStart;
    }).map(sc => sc.sprint.toLowerCase().trim())
  );
  const futureTickets = S.allTickets.filter(t => {
    if (!t.epic_link) return false;
    const ticketSprints = t.sprints || [t.sprint || ''];
    return ticketSprints.some(s => {
      const sn = (s || '').toLowerCase().trim();
      return [...futureSprintsInNextMonth].some(fs => sn === fs || sn.endsWith(' ' + fs) || sn.includes(fs));
    });
  });
  // Group future tickets by topic for near-future panel content
  S._pmrFutureByTopic = {};
  futureTickets.forEach(t => {
    const {best} = findBestMatch(t, S.topics);
    if (best) {
      const key = best.topic_id;
      if (!S._pmrFutureByTopic[key]) S._pmrFutureByTopic[key] = [];
      S._pmrFutureByTopic[key].push(t);
    }
  });

  const topicMap={};
  S.topics.forEach(t=>topicMap[t.topic_id]=[]);
  const allTraces=[];
  const unmatched=[];
  const unmappedEpic=[]; // tickets with no epic — excluded from slides

  scoped.forEach(ticket=>{
    // Tickets with no epic link are excluded from PMR slides entirely —
    // they go into a separate "unmapped" bucket for the SE to triage.
    if (!ticket.epic_link) {
      unmappedEpic.push(ticket);
      return;
    }
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
        slidesHtml+=renderSlide(g.header,subheaders,layout,base,true,gid);
      }
    } else {
      if(groupIds.has(t.topic_id)) return;
      const tix=topicMap[t.topic_id]||[];
      const has=tix.length>0;
      const tLink=has?'<a href="#'+slideSlug(t.header)+'" style="color:inherit;text-decoration:none">'+esc(t.header)+'</a>':esc(t.header)+' — NSTR';
      agendaItems+='<li class="'+(has?'has':'nstr')+'">'+tLink+'</li>';
      if(has){
        const layout=S.cfg.pmr_layouts[t.topic_id]||t.slide_type||'simple_list';
        slidesHtml+=renderSlide(t.header,[{header:t.header,tickets:tix}],layout,base,false,t.topic_id);
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
  const matched=total-unmatched.length-unmappedEpic.length;

  const reportHtml=`
  <div class="slide"><h2>Agenda</h2>${agendaHtml}</div>
  ${slidesHtml}`;

  const dbgHtml=eosDebugTable(allTraces,'pdbg');
  // Build the unmatched panel with per-project sections + copy buttons.
  // Includes both topic-unmatched and epic-unmapped tickets.
  const allUnmapped = [...unmatched, ...unmappedEpic];
  const umHtml = buildPmrUnmatchedPanel(unmatched, unmappedEpic);

  const roadmapEnabled = S.cfg.pmr_roadmap && S.cfg.pmr_roadmap.enabled;

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
          <span class="u-muted-xs">${total} tickets &nbsp;·&nbsp; ${matched} matched &nbsp;·&nbsp; ${unmatched.length} unmatched &nbsp;·&nbsp; ${unmappedEpic.length} no epic</span>
          <span class="badge" style="background:var(--a3d);color:var(--a3);border:1px solid var(--a3b)">PMR</span>
        </div>
      </div>
      <div class="r-tabs r-tabs-sticky">
        <button class="r-tab active" onclick="switchRtab(this)">Report</button>
        <button class="r-tab" onclick="switchRtab(this)">Debug</button>
        <button class="r-tab" onclick="switchRtab(this)">Unmatched (${unmatched.length + unmappedEpic.length})</button>
      </div>
      <div class="r-panel active">${reportHtml}</div>
      <div class="r-panel">${dbgHtml}</div>
      <div class="r-panel">${umHtml}</div>
    </div>
  </div>`;

  const _out_pmr=document.getElementById('pmr-output'); if(_out_pmr) _out_pmr.innerHTML=html;
  S.reportHtml.pmr=html;
  autoSaveDraft('pmr');
  checkDraftAndRestore('pmr');
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

// Open the roadmap editor as a standalone overlay (from Tools on home screen).
function openRoadmapEditor() {
  let overlay = document.getElementById('roadmap-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'roadmap-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);width:min(1000px,96vw);max-height:93vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--bd);flex-shrink:0">
          <span style="font-weight:700;color:var(--tx);font-size:var(--fs-lg)"><span class="mi" style="font-size:18px;margin-right:8px;vertical-align:middle">route</span>Integrated Milestone Roadmap</span>
          <div class="row" style="gap:6px">
            <button class="btn btn-ghost btn-xs" onclick="exportPmrRoadmap()" title="Export"><span class="mi" style="font-size:13px;margin-right:2px">download</span>Export</button>
            <button class="btn btn-ghost btn-xs" onclick="document.getElementById('roadmap-import-tool').click()" title="Import"><span class="mi" style="font-size:13px;margin-right:2px">upload</span>Import</button>
            <input type="file" id="roadmap-import-tool" accept=".json" style="display:none" onchange="importPmrRoadmap(this)">
            <button onclick="document.getElementById('roadmap-overlay').remove()" style="background:none;border:none;color:var(--mu);font-size:18px;cursor:pointer;padding:2px 8px;border-radius:var(--r2)">✕</button>
          </div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:20px" id="roadmap-editor-tool"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  } else {
    overlay.style.display = 'flex';
  }
  const el = document.getElementById('roadmap-editor-tool');
  if (el) renderPmrRoadmapEditorInto(el);
}

function renderSlide(header,subheaders,layout,base,isGroup,layoutKey){
  const sid=slideSlug(header);
  const ctx=sid.replace(/^pmr-slide-/,''); // stable slug derived from slide header; passed down explicitly
  // blufBox hoisted here — single definition shared by all layout branches
  const blufBox=(slug)=>`<div class="bluf-field pmr-bluf" id="pmrbluf-${slug}" contenteditable="true" data-pmr-bluf="${slug}" data-placeholder="Enter narrative..." style="margin:4px 0 10px"></div>`;
  // AI prompt buttons — one per project so the SE for each project gets
  // their own scoped prompt. Store tickets grouped by project.
  const allTix = subheaders.flatMap(s => s.tickets);
  if (!S._pmrSlideTickets) S._pmrSlideTickets = {};
  S._pmrSlideTickets[sid] = allTix;
  let aiBtns = '';
  if (S.cfg.pmr_ai_prompt_enabled !== false && allTix.length) {
    const projsInSlide = [...new Set(allTix.map(t => t.project_bucket).filter(Boolean))].sort();
    if (projsInSlide.length <= 1) {
      aiBtns = `<button class="btn btn-ghost btn-xs" style="flex-shrink:0" onclick="copyPmrAiPrompt('${esc(sid)}')" title="Copy AI prompt + tickets to clipboard"><span class="mi" style="font-size:13px;margin-right:2px">auto_awesome</span>AI</button>`;
    } else {
      aiBtns = projsInSlide.map(p =>
        `<button class="btn btn-ghost btn-xs" style="flex-shrink:0" onclick="copyPmrAiPrompt('${esc(sid)}','${esc(p)}')" title="Copy AI prompt for ${esc(p)} tickets"><span class="mi" style="font-size:13px;margin-right:2px">auto_awesome</span>${esc(p)}</button>`
      ).join('');
    }
  }
  // Layout picker dropdown — lets the user switch slide type without going to Settings
  const layoutOpts = ['simple_list','feature_improvement_bug','project_split_3','project_split_2','mission_support_other'];
  const layoutLabels = {simple_list:'Simple List',feature_improvement_bug:'Feature/Improvement/Bug',project_split_3:'Project Split (3)',project_split_2:'Project Split (2)',mission_support_other:'Mission Support Grid'};
  const layoutSel = layoutKey
    ? `<select class="pmr-layout-sel" style="font-size:10px;padding:2px 6px;background:var(--s3);border:1px solid var(--bd);color:var(--mu);border-radius:3px;cursor:pointer;flex-shrink:0" onchange="pmrSwitchLayout('${esc(layoutKey)}',this.value)" title="Change slide layout">${layoutOpts.map(o=>'<option value="'+o+'"'+(o===layout?' selected':'')+'>'+layoutLabels[o]+'</option>').join('')}</select>`
    : '';
  let html=`<div class="slide" id="${sid}" data-pmr-layout="${esc(layout||'simple_list')}"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><h2 style="margin:0">(U) ${esc(header)}</h2><span style="flex:1"></span>${layoutSel}${aiBtns}</div>`;
  // Near-Future Tasks — computed now but rendered AFTER the content sections
  let nfTickets = [];
  if (S._pmrFutureByTopic) {
    if (layoutKey && S._pmrFutureByTopic[layoutKey]) {
      nfTickets = S._pmrFutureByTopic[layoutKey];
    }
    const grp = (S.cfg.pmr_groups || []).find(g => g.group_id === layoutKey);
    if (grp) {
      nfTickets = (grp.topic_ids || []).flatMap(tid => S._pmrFutureByTopic[tid] || []);
    }
    if (project) nfTickets = nfTickets.filter(t => t.project_bucket === project);
  }
  const nfAutoText = nfTickets.length ? nfTickets.map(t => t.summary).join('\n') : '';
  if (!S._pmrNearFutureTickets) S._pmrNearFutureTickets = {};
  S._pmrNearFutureTickets[sid] = nfTickets;
  const nfAiBtn = (S.cfg.pmr_ai_prompt_enabled !== false && nfTickets.length)
    ? `<button class="btn btn-ghost btn-xs" onclick="copyPmrNearFutureAiPrompt('${esc(sid)}')" title="Copy AI prompt for near-future tasks"><span class="mi" style="font-size:13px;margin-right:2px">auto_awesome</span>AI</button>`
    : '';
  // Content sections first
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
  // Near-Future Tasks at the bottom
  html+=`<div style="margin:12px 0 6px"><div class="bluf-label" style="color:var(--a4);display:flex;align-items:center;gap:6px">Near-Future Tasks ${nfAiBtn}</div>${blufBox(ctx+'-nearfuture')}</div>`;
  if (nfAutoText) {
    setTimeout(() => {
      const el = document.getElementById('pmrbluf-' + ctx + '-nearfuture');
      if (el && !el.textContent.trim()) el.textContent = nfAutoText;
    }, 100);
  }
  return html+'</div>';
}
// ── Slide Template Editor ─────────────────────────────────
// Opens as an overlay from Tools. Lets users tweak the geometry
// values that drive PPTX rendering, export/import as JSON.
function openSlideTemplateEditor() {
  let overlay = document.getElementById('slide-tpl-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'slide-tpl-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
  const tpl = S.cfg.pmr_slide_templates || {};
  const sections = [
    { key: 'feature_improvement_bug', label: 'Feature / Improvement / Bug' },
    { key: 'project_split',           label: 'Project Split (DX/LX/RC)' },
    { key: 'mission_support',         label: 'Mission Support Grid' },
    { key: 'simple_list',             label: 'Simple List' },
    { key: 'near_future',             label: 'Near-Future Panel' },
    { key: 'global',                  label: 'Global Defaults' },
  ];
  const labels = {
    leftWidthPct:'Left card width %', rightGap:'Right gap (in)', cardBorder:'Border (pt)',
    narFontSize:'Narrative font', labelFontSize:'Label font', tagW:'Tag width (in)',
    tagGap:'Tag gap (in)', rowGap:'Row gap (in)', codeFontSize:'Code font', nameFontSize:'Name font',
    colGap:'Column gap (in)', headerH:'Header height (in)', headerFontSize:'Header font',
    panelW:'Panel width (in)', panelGap:'Panel gap (in)', titleFontSize:'Title font',
    bodyFontSize:'Body font', bulletGap:'Bullet gap (in)', headerFontSize:'Header font',
    bodyBg:'Background color', cardBg:'Card color'
  };
  let html = sections.map(sec => {
    const vals = tpl[sec.key] || {};
    const fields = Object.entries(vals).map(([k, v]) => {
      const isColor = typeof v === 'string' && /^[0-9A-Fa-f]{6}$/.test(v);
      const input = isColor
        ? `<input type="text" value="${esc(v)}" data-tpl-section="${sec.key}" data-tpl-field="${k}" style="width:80px;font-size:var(--fs-xs);font-family:var(--mono)">`
        : `<input type="number" value="${v}" step="0.01" data-tpl-section="${sec.key}" data-tpl-field="${k}" style="width:80px;font-size:var(--fs-xs);font-family:var(--mono)">`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><span style="font-size:var(--fs-xs);color:var(--mu);min-width:130px">${labels[k]||k}</span>${input}</div>`;
    }).join('');
    return `<div style="margin-bottom:14px"><div style="font-weight:600;font-size:var(--fs-sm);color:var(--a1);margin-bottom:6px;border-bottom:1px solid var(--bd);padding-bottom:4px">${sec.label}</div>${fields}</div>`;
  }).join('');

  overlay.innerHTML = `
    <div style="background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);width:min(600px,96vw);max-height:93vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--bd);flex-shrink:0">
        <span style="font-weight:700;color:var(--tx);font-size:var(--fs-lg)"><span class="mi" style="font-size:18px;margin-right:8px;vertical-align:middle">slideshow</span>Slide Templates</span>
        <div class="row" style="gap:6px">
          <button class="btn btn-ghost btn-xs" onclick="exportSlideTemplates()"><span class="mi" style="font-size:13px;margin-right:2px">download</span>Export</button>
          <button class="btn btn-ghost btn-xs" onclick="document.getElementById('slide-tpl-import').click()"><span class="mi" style="font-size:13px;margin-right:2px">upload</span>Import</button>
          <input type="file" id="slide-tpl-import" accept=".json" style="display:none" onchange="importSlideTemplates(this)">
          <button class="btn btn-ghost btn-xs" onclick="resetSlideTemplates()"><span class="mi" style="font-size:13px;margin-right:2px">restart_alt</span>Reset</button>
          <button onclick="document.getElementById('slide-tpl-overlay').remove()" style="background:none;border:none;color:var(--mu);font-size:18px;cursor:pointer;padding:2px 8px">✕</button>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:20px" id="slide-tpl-body">${html}</div>
      <div style="padding:12px 20px;border-top:1px solid var(--bd);display:flex;justify-content:flex-end;gap:8px">
        <span id="slide-tpl-status" style="flex:1;font-size:var(--fs-xs);color:var(--a3)"></span>
        <button class="btn btn-primary btn-sm" onclick="saveSlideTemplates()">Save</button>
      </div>
    </div>`;
  overlay.style.display = 'flex';
}

function saveSlideTemplates() {
  const tpl = S.cfg.pmr_slide_templates || {};
  document.querySelectorAll('[data-tpl-section]').forEach(inp => {
    const sec = inp.dataset.tplSection;
    const fld = inp.dataset.tplField;
    if (!tpl[sec]) tpl[sec] = {};
    const v = inp.value.trim();
    tpl[sec][fld] = isNaN(Number(v)) ? v : Number(v);
  });
  S.cfg.pmr_slide_templates = tpl;
  autoSaveCfg();
  const st = document.getElementById('slide-tpl-status');
  if (st) { st.textContent = 'Saved'; setTimeout(() => { st.textContent = ''; }, 2000); }
}

function exportSlideTemplates() {
  const json = JSON.stringify(S.cfg.pmr_slide_templates || {}, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.download = 'pmr_slide_templates.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function importSlideTemplates(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      S.cfg.pmr_slide_templates = imported;
      autoSaveCfg();
      document.getElementById('slide-tpl-overlay')?.remove();
      openSlideTemplateEditor();
    } catch(err) { alert('Invalid JSON: ' + err.message); }
  };
  reader.readAsText(file);
}

function resetSlideTemplates() {
  if (!confirm('Reset all slide templates to defaults?')) return;
  delete S.cfg.pmr_slide_templates;
  autoSaveCfg();
  document.getElementById('slide-tpl-overlay')?.remove();
  openSlideTemplateEditor();
}

// Switch a slide's layout and re-run the PMR report.
function pmrSwitchLayout(layoutKey, newLayout) {
  if (!layoutKey || !newLayout) return;
  S.cfg.pmr_layouts[layoutKey] = newLayout;
  autoSaveCfg();
  if (typeof runPMR === 'function') runPMR();
}

// Ticket list with a move-to dropdown for feature_improvement_bug slides.
function pmrTicketListWithMove(tickets, base, currentSection) {
  if (!tickets.length) return '<div class="nstr">NSTR</div>';
  const sorted = [...tickets].sort((a,b) => {
    const ea = (a.epic_name||'').toLowerCase(), eb = (b.epic_name||'').toLowerCase();
    if (ea !== eb) return ea.localeCompare(eb);
    return a.issue_key.localeCompare(b.issue_key);
  });
  const sections = ['improvements','features','bugs'];
  const labels = {improvements:'Improv', features:'Feature', bugs:'Bug'};
  return `<ul class="tl">${sorted.map(t => {
    const link = jiraLink(t.issue_key, 'tk');
    const opts = sections.filter(s => s !== currentSection)
      .map(s => `<option value="${s}">${labels[s]}</option>`).join('');
    const sel = `<select class="pmr-move-sel" onchange="pmrMoveTicket('${esc(t.issue_key)}',this.value)" title="Move to different section"><option value="">▸</option>${opts}</select>`;
    return `<li class="pmr-tl-row">${link}<span class="ts">${esc(t.summary)}</span>${sel}</li>`;
  }).join('')}</ul>`;
}

// Move a ticket to a different section (features/improvements/bugs) and re-run PMR.
function pmrMoveTicket(issueKey, targetSection) {
  if (!targetSection) return;
  if (!S._pmrSectionOverrides) S._pmrSectionOverrides = {};
  S._pmrSectionOverrides[issueKey] = targetSection;
  // Re-run PMR to reflect the change
  if (typeof runPMR === 'function') runPMR();
}

// Copy AI prompt for the near-future tasks panel — titles only
async function copyPmrNearFutureAiPrompt(slideId) {
  const tickets = S._pmrNearFutureTickets && S._pmrNearFutureTickets[slideId];
  if (!tickets || !tickets.length) return;
  const slideEl = document.getElementById(slideId);
  const header = slideEl ? (slideEl.querySelector('h2')?.textContent || '').replace(/^\(U\)\s*/i, '').trim() : slideId;
  const prompt = S.cfg.pmr_ai_prompt || '';
  const nfPrompt = prompt.replace(/completed/gi, 'planned').replace(/past tense/gi, 'future tense').replace('"the team..."', '"the team plans to..."');
  const lines = [`Topic: ${header} — Near-Future / Planned Work`, ''];
  lines.push('Planned tickets for next sprint:');
  tickets.forEach(t => lines.push(`- ${t.summary}`));
  const text = nfPrompt + '\n\n' + lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    const btn = event && event.target.closest('button');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="mi" style="font-size:13px;margin-right:2px">check</span>Copied';
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    }
  } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function renderSlideLayout(tickets,layout,base,ctx,blufBox){
  if(layout==='feature_improvement_bug'){
    const ftypes=S.cfg.pmr_feature_types||['story','user request','new feature'];
    const btypes=S.cfg.pmr_bug_types||['bug','defect'];
    // Check overrides first (user manually moved a ticket to a different section)
    if (!S._pmrSectionOverrides) S._pmrSectionOverrides = {};
    const b={features:[],improvements:[],bugs:[]};
    tickets.forEach(t=>{
      const override = S._pmrSectionOverrides[t.issue_key];
      if (override === 'features') { b.features.push(t); return; }
      if (override === 'bugs') { b.bugs.push(t); return; }
      if (override === 'improvements') { b.improvements.push(t); return; }
      const it=t.issue_type.toLowerCase();
      if(ftypes.some(f=>it.includes(f))) b.features.push(t);
      else if(btypes.some(f=>it.includes(f))) b.bugs.push(t);
      else b.improvements.push(t);
    });
    let h='';
    // Improvements first, then New Features (per user request — swapped)
    if(b.improvements.length){ h+=`<h4>Improvements</h4>${blufBox(ctx+'-improvements')}${pmrTicketListWithMove(b.improvements,base,'improvements')}`; }
    if(b.features.length){ h+=`<h4>New Features</h4>${blufBox(ctx+'-features')}${pmrTicketListWithMove(b.features,base,'features')}`; }
    if(b.bugs.length){ h+=`<h4>Bug Fixes</h4>${blufBox(ctx+'-bugs')}${pmrTicketListWithMove(b.bugs,base,'bugs')}`; }
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

// Per-project unmatched panel for PMR. Shows topic-unmatched and
// epic-unmapped tickets in separate sections by project, each with a
// copy button that builds a list of Jira links for emailing to the SE.
function buildPmrUnmatchedPanel(unmatched, unmappedEpic) {
  const jiraBase = (S.cfg.jira_url || '').replace(/\/+$/, '');
  const projects = [...new Set(
    [...unmatched, ...unmappedEpic].map(t => t.project_bucket).filter(Boolean)
  )].sort();

  if (!unmatched.length && !unmappedEpic.length) {
    return '<p style="color:var(--a3);font-size:var(--fs-base)">All tickets matched a topic and have an epic.</p>';
  }

  const byProj = {};
  projects.forEach(p => { byProj[p] = { unmatched: [], unmapped: [] }; });
  unmatched.forEach(t => { if (byProj[t.project_bucket]) byProj[t.project_bucket].unmatched.push(t); });
  unmappedEpic.forEach(t => { if (byProj[t.project_bucket]) byProj[t.project_bucket].unmapped.push(t); });

  function ticketRow(t) {
    const safeId = 'um_' + t.issue_key.replace(/[^a-zA-Z0-9]/g, '_');
    S._unmatchedLookup[safeId] = t;
    return `<div class="um-item">
      <div class="um-header">
        <span class="um-key">${jiraLink(t.issue_key, 'um-key')}</span>
        <button class="btn btn-purple btn-xs" onclick="openOverrideModal('${safeId}')">+ Create Rule</button>
      </div>
      <div class="um-summary">${esc(t.summary)}</div>
      <div class="um-meta">
        Epic: ${esc(t.epic_name || t.epic_link || '— none —')} · Labels: ${esc(t.labels || '—')} · Components: ${esc((t.components || []).join(', ') || '—')}
      </div>
    </div>`;
  }

  function copyList(tickets, label) {
    const lines = tickets.map(t => {
      const url = jiraBase ? jiraBase + '/browse/' + t.issue_key : t.issue_key;
      return `${t.issue_key} — ${t.summary}\n  ${url}`;
    });
    return lines.join('\n\n');
  }

  let html = '';
  projects.forEach(proj => {
    const bucket = byProj[proj];
    const total = bucket.unmatched.length + bucket.unmapped.length;
    if (!total) return;

    // Store the copy text on a global so the onclick can reference it
    const copyId = 'pmr-um-copy-' + proj.toLowerCase();
    const allTickets = [...bucket.unmapped, ...bucket.unmatched];
    const copyText = `${proj} — ${total} ticket${total !== 1 ? 's' : ''} need attention:\n\n` +
      (bucket.unmapped.length ? `NO EPIC (${bucket.unmapped.length}):\n` + copyList(bucket.unmapped) + '\n\n' : '') +
      (bucket.unmatched.length ? `UNMATCHED TOPIC (${bucket.unmatched.length}):\n` + copyList(bucket.unmatched) : '');

    html += `<div class="r-card" style="margin-bottom:12px;border-left:3px solid var(--a5)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-weight:700;font-size:var(--fs-sm);color:var(--tx)">${esc(proj)}</span>
        <span class="badge" style="background:var(--a5d);color:var(--a5);border:1px solid var(--a5b)">${total}</span>
        <span style="flex:1"></span>
        <button class="btn btn-ghost btn-xs" id="${copyId}" onclick="copyPmrUnmatched('${esc(proj)}')"><span class="mi" style="font-size:13px;margin-right:2px">content_copy</span>Copy for SE</button>
      </div>`;

    if (bucket.unmapped.length) {
      html += `<div style="font-size:var(--fs-xs);font-weight:600;color:var(--a4);margin:8px 0 4px">No Epic Assigned (${bucket.unmapped.length})</div>`;
      bucket.unmapped.forEach(t => { html += ticketRow(t); });
    }
    if (bucket.unmatched.length) {
      html += `<div style="font-size:var(--fs-xs);font-weight:600;color:var(--a2);margin:8px 0 4px">No Topic Match (${bucket.unmatched.length})</div>`;
      bucket.unmatched.forEach(t => { html += ticketRow(t); });
    }
    html += '</div>';

    // Store copy text for the button
    if (!S._pmrUnmatchedCopy) S._pmrUnmatchedCopy = {};
    S._pmrUnmatchedCopy[proj] = copyText;
  });

  return html;
}

async function copyPmrUnmatched(proj) {
  const text = S._pmrUnmatchedCopy && S._pmrUnmatchedCopy[proj];
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('pmr-um-copy-' + proj.toLowerCase());
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="mi" style="font-size:13px;margin-right:2px">check</span>Copied';
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    }
  } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

// Copy the AI prompt + ticket list for a PMR topic slide to clipboard.
// Optional project filter scopes to a single project's tickets.
async function copyPmrAiPrompt(slideId, project) {
  let tickets = S._pmrSlideTickets && S._pmrSlideTickets[slideId];
  if (!tickets || !tickets.length) return;
  if (project) tickets = tickets.filter(t => t.project_bucket === project);
  if (!tickets.length) return;
  const prompt = S.cfg.pmr_ai_prompt || '';
  const slideEl = document.getElementById(slideId);
  const header = slideEl ? (slideEl.querySelector('h2')?.textContent || '').replace(/^\(U\)\s*/i, '').trim() : slideId;
  const scope = project ? ` (${project})` : '';

  // Bucket tickets the same way the slide does — titles only, no keys/status/points
  const ftypes = S.cfg.pmr_feature_types || ['story','user request','new feature'];
  const btypes = S.cfg.pmr_bug_types || ['bug','defect'];
  if (!S._pmrSectionOverrides) S._pmrSectionOverrides = {};
  const b = { improvements:[], features:[], bugs:[] };
  tickets.forEach(t => {
    const override = S._pmrSectionOverrides[t.issue_key];
    if (override) { b[override]?.push(t); return; }
    const it = t.issue_type.toLowerCase();
    if (ftypes.some(f => it.includes(f))) b.features.push(t);
    else if (btypes.some(f => it.includes(f))) b.bugs.push(t);
    else b.improvements.push(t);
  });

  const lines = [`Topic: ${header}${scope}`, ''];
  if (b.improvements.length) {
    lines.push('Improvements:');
    b.improvements.forEach(t => lines.push(`- ${t.summary}`));
    lines.push('');
  }
  if (b.features.length) {
    lines.push('New Features:');
    b.features.forEach(t => lines.push(`- ${t.summary}`));
    lines.push('');
  }
  if (b.bugs.length) {
    lines.push('Bug Fixes:');
    b.bugs.forEach(t => lines.push(`- ${t.summary}`));
    lines.push('');
  }
  const text = prompt + '\n\n' + lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    const btn = event && event.target.closest('button');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="mi" style="font-size:13px;margin-right:2px">check</span>Copied';
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    }
  } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

