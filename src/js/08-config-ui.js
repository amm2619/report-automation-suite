// ============================================================
// CONFIG UI RENDER
// ============================================================

function populateClassificationPane() {
  renderTagBox('tags-portion-marking', 'portion_markings');
  renderTagBox('tags-hdr-footer',      'hdr_footer_classifications');
  renderTagBox('tags-class-highest',   'classification_presets');
  clsSelectorRefreshAll();
}


// ============================================================
// CLASSIFICATION SELECTOR — type-ahead picker
// clsSelector(containerId, listKey, cfgKey, placeholder)
//   containerId: element to render into
//   listKey:     S.cfg key holding the available values array
//   cfgKey:      S.cfg key to read/write the selected single value
//   placeholder: input placeholder text
// ============================================================
function clsSelector(containerId, listKey, cfgKey, placeholder) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const current  = S.cfg[cfgKey] || '';
  const allVals  = S.cfg[listKey] || [];

  let focusedIdx = -1;

  function getFiltered(q) {
    const lq = q.toLowerCase();
    return allVals.filter(v => v.toLowerCase().includes(lq));
  }

  function commit(val) {
    cfgSet(cfgKey, val);
    autoSaveCfg();
    clsSelectorRefreshAll(); // re-render all selectors
  }

  function clear() {
    cfgSet(cfgKey, '');
    autoSaveCfg();
    clsSelectorRefreshAll();
  }

  // Remove any existing dropdown portal and stale scroll listener for this container
  var existingPortal = document.getElementById('cls-drop-' + containerId);
  if (existingPortal) existingPortal.remove();
  if (wrap._clsScrollHandler) {
    document.removeEventListener('scroll', wrap._clsScrollHandler, true);
    wrap._clsScrollHandler = null;
  }

  wrap.innerHTML = '';

  // If a value is already selected, show as chip
  if (current) {
    const chip = document.createElement('div');
    chip.className = 'cls-selector-chip';
    chip.innerHTML = '<span>' + esc(current) + '</span><button title="Clear" onclick="(function(){cfgSet(\'' + cfgKey + '\',\'\');autoSaveCfg();clsSelectorRefreshAll();})()"><span class="mi">close</span></button>';
    wrap.appendChild(chip);
    return; // chip shown, no input needed until cleared
  }

  // No value selected — show type-ahead input
  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'cls-selector-input';
  inputEl.placeholder = placeholder || 'Type to filter...';
  wrap.appendChild(inputEl);

  const dropEl = document.createElement('div');
  dropEl.className = 'cls-dropdown';
  dropEl.id = 'cls-drop-' + containerId;
  document.body.appendChild(dropEl);  // portal: appended to body to escape overflow clipping

  function positionDrop() {
    const rect = inputEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropH = Math.min(180, dropEl.scrollHeight || 180);
    dropEl.style.width = rect.width + 'px';
    dropEl.style.left  = rect.left + 'px';
    if (spaceBelow >= dropH || spaceBelow >= spaceAbove) {
      dropEl.style.top    = (rect.bottom + 3) + 'px';
      dropEl.style.bottom = '';
    } else {
      dropEl.style.bottom = (window.innerHeight - rect.top + 3) + 'px';
      dropEl.style.top    = '';
    }
  }

  function renderDrop(q) {
    const matches = getFiltered(q);
    focusedIdx = -1;
    if (!matches.length) {
      dropEl.innerHTML = '<div class="cls-dropdown-empty">No matches — press Enter to add "' + esc(q) + '"</div>';
    } else {
      dropEl.innerHTML = matches.map((v, i) =>
        '<div class="cls-dropdown-item' + (v === current ? ' active' : '') + '" data-idx="' + i + '" data-val="' + esc(v) + '">' + esc(v) + '</div>'
      ).join('');
      dropEl.querySelectorAll('.cls-dropdown-item').forEach(function(el) {
        el.addEventListener('mousedown', function(e) {
          e.preventDefault();
          commit(el.dataset.val);
        });
      });
    }
    const shouldOpen = q.length > 0 || document.activeElement === inputEl;
    if (shouldOpen) positionDrop();
    dropEl.classList.toggle('open', shouldOpen);
  }

  inputEl.addEventListener('input', function() { renderDrop(inputEl.value); });

  inputEl.addEventListener('focus', function() {
    renderDrop(inputEl.value || '');
    positionDrop();
    dropEl.classList.add('open');
  });

  // Reposition on scroll so the fixed dropdown tracks the input.
  // Store on wrap so clsSelector can remove it before remounting.
  var _scrollHandler = function() { if (dropEl.classList.contains('open')) positionDrop(); };
  wrap._clsScrollHandler = _scrollHandler;
  document.addEventListener('scroll', _scrollHandler, true);

  inputEl.addEventListener('blur', function() {
    setTimeout(function() {
      dropEl.classList.remove('open');
      document.removeEventListener('scroll', _scrollHandler, true);
      wrap._clsScrollHandler = null;
    }, 150);
  });

  inputEl.addEventListener('keydown', function(e) {
    const items = dropEl.querySelectorAll('.cls-dropdown-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIdx = Math.min(focusedIdx + 1, items.length - 1);
      items.forEach(function(el, i) { el.classList.toggle('focused', i === focusedIdx); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIdx = Math.max(focusedIdx - 1, 0);
      items.forEach(function(el, i) { el.classList.toggle('focused', i === focusedIdx); });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIdx >= 0 && items[focusedIdx]) {
        commit(items[focusedIdx].dataset.val);
      } else if (inputEl.value.trim()) {
        // Add to the list if not already there, then select
        const v = inputEl.value.trim();
        if (!allVals.includes(v)) {
          if (!S.cfg[listKey]) S.cfg[listKey] = [];
          S.cfg[listKey].push(v);
        }
        commit(v);
      }
    } else if (e.key === 'Escape') {
      dropEl.classList.remove('open');
    }
  });

  // Show all on click if empty
  inputEl.addEventListener('click', function() {
    if (!dropEl.classList.contains('open')) renderDrop(inputEl.value || '');
  });
}

// Config key → listKey + label mapping for each selector instance
const CLS_SELECTORS = [
  // [containerId,           listKey,                   cfgKey,                   placeholder]
  ['cls-sel-portion',        'portion_markings',        'portion_marking_active', 'Type to filter portion markings...'],
  ['cls-sel-hdrf',           'hdr_footer_classifications','classification',        'Type to filter header/footer values...'],
  ['cls-sel-high',           'classification_presets',  'classification_highest', 'Type to filter classification levels...'],
  ['cls-sel-high-sprint',    'classification_presets',  'classification_highest', 'Type to filter...'],
  ['cls-sel-hdrf-sprint',    'hdr_footer_classifications','classification',        'Type to filter...'],
  ['cls-sel-portion-sprint', 'portion_markings',        'portion_marking_active', 'Type to filter...'],
  ['cls-sel-high-pmr',       'classification_presets',  'classification_highest', 'Type to filter...'],
  ['cls-sel-hdrf-pmr',       'hdr_footer_classifications','classification',        'Type to filter...'],
];

function clsSelectorRefreshAll() {
  CLS_SELECTORS.forEach(function(def) {
    clsSelector(def[0], def[1], def[2], def[3]);
  });
}

function renderCalendarPane(){
  // Dedicated render for the Sprint Calendar settings pane.
  // Seeds defaults only when calendar is completely empty, then renders cal + prefixes.
  if(S.cfg.sprint_calendar.length===0){
    S.cfg.sprint_calendar=DEFAULT_SPRINT_CALENDAR.map(s=>({...s}));
  }
  renderSprintCal();
  renderSprintPrefixRows();
}

function renderConfigUI(){
  populateConfigFields();

  // EOS projects
  const ep=document.getElementById('eos-proj-fields');
  if(ep){
    ep.innerHTML='';
    Object.entries(S.cfg.eos_projects||{}).forEach(([proj,meta])=>{
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;padding:9px 16px;border-bottom:1px solid var(--bd);gap:0';

      const label=document.createElement('span');
      label.style.cssText='font-family:var(--mono);font-weight:700;font-size:var(--fs-xs);color:var(--tx);width:56px;flex-shrink:0';
      label.textContent=proj;

      const titleWrap=document.createElement('div');
      titleWrap.style.cssText='flex:1;padding-right:12px';
      const titleIn=document.createElement('input');
      titleIn.type='text'; titleIn.value=meta.report_title||'';
      titleIn.style.cssText='width:100%;box-sizing:border-box';
      titleIn.addEventListener('change',function(){ S.cfg.eos_projects[proj].report_title=this.value; autoSaveCfg(); });
      titleWrap.appendChild(titleIn);

      const mtlWrap=document.createElement('div');
      mtlWrap.style.cssText='width:120px;flex-shrink:0';
      const mtlIn=document.createElement('input');
      mtlIn.type='text'; mtlIn.value=meta.mtl_points||'';
      mtlIn.style.cssText='width:100%;box-sizing:border-box;font-family:var(--mono)';
      mtlIn.addEventListener('change',function(){ S.cfg.eos_projects[proj].mtl_points=this.value; autoSaveCfg(); });
      mtlWrap.appendChild(mtlIn);

      row.appendChild(label); row.appendChild(titleWrap); row.appendChild(mtlWrap);
      ep.appendChild(row);
    });
  }

  renderPmrGroups();
  renderPmrLayouts();
  renderSpinHistoryList();
  renderFieldMapRows();
  renderClassPresets();
}

function renderTagBox(containerId, cfgKey) {
  const box=document.getElementById(containerId);
  if(!box) return;
  const arr=S.cfg.weekly&&S.cfg.weekly[cfgKey]!==undefined?S.cfg.weekly:S.cfg;
  const tags=arr[cfgKey]||[];
  const input=box.querySelector('.tag-in');
  // remove old tags
  box.querySelectorAll('.tag').forEach(t=>t.remove());
  tags.forEach(t=>{
    const el=document.createElement('span');
    el.className='tag';
    el.dataset.val=t; el.dataset.key=cfgKey;
    el.innerHTML=`${esc(t)}<span class="tag-x" onclick="removeTag(this.closest('.tag').dataset.key,this.closest('.tag').dataset.val,this)">×</span>`;
    box.insertBefore(el,input);
  });
}
function removeTag(cfgKey,val,el){
  const arr=S.cfg.weekly&&S.cfg.weekly[cfgKey]!==undefined?S.cfg.weekly:S.cfg;
  arr[cfgKey]=arr[cfgKey].filter(v=>v!==val);
  el.closest('.tag').remove();
  autoSaveCfg();
}
function tagKeydown(e,input,cfgKey){
  if(e.key!=='Enter'&&e.key!==','&&e.key!=='Tab') return;
  if(e.key==='Tab'&&!input.value.trim()) return;
  e.preventDefault();
  const val=input.value.trim();
  if(!val) return;
  // Support S.cfg.weekly[key] and top-level S.cfg[key]
  const arr=(S.cfg.weekly&&S.cfg.weekly[cfgKey]!==undefined)?S.cfg.weekly:S.cfg;
  if(!Array.isArray(arr[cfgKey])) arr[cfgKey]=[];
  // Case-insensitive duplicate check
  if(arr[cfgKey].some(function(v){ return v.toLowerCase()===val.toLowerCase(); })){
    // Flash the input to signal duplicate
    input.style.outline='2px solid var(--a4)';
    input.title='Already in list: '+val;
    setTimeout(function(){input.style.outline='';input.title='';},1200);
    input.value='';
    return;
  }
  arr[cfgKey].push(val);
  const tag=document.createElement('span');
  tag.className='tag';
  tag.dataset.val=val; tag.dataset.key=cfgKey;
  tag.innerHTML=`${esc(val)}<span class="tag-x" onclick="removeTag(this.closest('.tag').dataset.key,this.closest('.tag').dataset.val,this)">×</span>`;
  input.before(tag);
  autoSaveCfg();
  input.value='';
}function focusTagIn(box){ box.querySelector('.tag-in').focus(); }

function renderPmrGroups(){
  const el=document.getElementById('pmr-groups-editor'); if(!el) return;
  el.innerHTML=S.cfg.pmr_groups.map(function(g,i){
    return '<div class="card" style="margin-bottom:8px" data-gi="'+i+'">'
      +'<div class="row" style="margin-bottom:8px">'
      +'<input type="text" class="pmrg-header" data-gi="'+i+'" value="'+esc(g.header)+'" style="flex:1">'
      +'<button class="btn btn-red btn-xs pmrg-del" data-gi="'+i+'">✕</button>'
      +'</div>'
      +'<div class="fl" style="font-size:var(--fs-xs);margin-bottom:4px">Topic IDs (comma separated)</div>'
      +'<input type="text" class="pmrg-topics" data-gi="'+i+'" value="'+esc(g.topic_ids.join(', '))+'"></div>';
  }).join('');
  // Delegated listeners — index read from data-gi at event time, never stale
  el.querySelectorAll('.pmrg-header').forEach(function(inp){
    inp.addEventListener('change', function(){ S.cfg.pmr_groups[+this.dataset.gi].header=this.value; autoSaveCfg(); });
  });
  el.querySelectorAll('.pmrg-topics').forEach(function(inp){
    inp.addEventListener('change', function(){ S.cfg.pmr_groups[+this.dataset.gi].topic_ids=this.value.split(',').map(function(x){return x.trim();}).filter(Boolean); autoSaveCfg(); });
  });
  el.querySelectorAll('.pmrg-del').forEach(function(btn){
    btn.addEventListener('click', function(){ S.cfg.pmr_groups.splice(+this.dataset.gi,1); renderPmrGroups(); autoSaveCfg(); });
  });
}
function addPmrGroup(){
  S.cfg.pmr_groups.push({group_id:'new_group_'+Date.now(),header:'New Group',topic_ids:[]});
  renderPmrGroups();
}
function renderPmrLayouts(){
  const el=document.getElementById('pmr-layouts-editor'); if(!el) return;
  const options=['simple_list','feature_improvement_bug','project_split_3','project_split_2','mission_support_other'];
  const items=[...S.topics.map(t=>({id:t.topic_id,label:t.header})),...S.cfg.pmr_groups.map(g=>({id:g.group_id,label:g.header}))];
  el.innerHTML=`<div class="tw"><table class="rt"><thead><tr><th>Topic / Group</th><th>Layout</th></tr></thead><tbody>${
    items.map(it=>`<tr><td style="font-size:var(--fs-xs)">${esc(it.label)}</td><td>
      <select data-layout-id="${esc(it.id)}" style="width:100%;font-size:var(--fs-xs);padding:4px 6px">
        ${options.map(o=>`<option value="${o}"${(S.cfg.pmr_layouts[it.id]||'simple_list')===o?' selected':''}>${o}</option>`).join('')}
      </select></td></tr>`).join('')
  }</tbody></table></div>`;
  // Delegated listener — safe regardless of id content (no inline handler with raw string key)
  el.querySelectorAll('select[data-layout-id]').forEach(function(sel){
    sel.addEventListener('change', function(){ S.cfg.pmr_layouts[this.dataset.layoutId]=this.value; });
  });
}

// ── Integrated Milestone Roadmap editor ──────────────────────────────────
// Renders into #pmr-roadmap-editor. Shows slide config controls, the
// milestone table, and an inline SVG preview that updates live.
// Status/product color + letter mapping stay in sync with the PPTX helper
// via the PMR_ROADMAP_STATUS / PMR_ROADMAP_PRODUCT constants below.
const PMR_ROADMAP_STATUS = {
  complete:    { color:'#0060B0', label:'Completed'    },
  in_progress: { color:'#0A7A4A', label:'In Progress'  },
  not_started: { color:'#8899BB', label:'Not Started'  },
  blocked:     { color:'#C0392B', label:'Blocked'      }
};
const PMR_ROADMAP_PRODUCT = {
  DX: { letter:'D', color:'#2952A3', name:'DataXplorer'  },
  LX: { letter:'L', color:'#0071A4', name:'LinkXplorer'  },
  RC: { letter:'R', color:'#6030A0', name:'Rollercoaster'},
  X:  { letter:'×', color:'#5A6070', name:'Cross-product'}
};

// Editor-local UI state (search, in-range filter, status banner text).
// Lives on the session state object, not in S.cfg — these are transient.
function pmrRoadmapUiState(){
  if (!S._pmrRoadmapUi) S._pmrRoadmapUi = { search:'', inRangeOnly:false, statusMsg:'', statusTs:0 };
  return S._pmrRoadmapUi;
}

function renderPmrRoadmapEditor(){
  const el=document.getElementById('pmr-roadmap-editor'); if(!el) return;
  const roadmap=S.cfg.pmr_roadmap;
  if(!roadmap){ el.innerHTML='<div class="u-muted-xs">Roadmap config missing.</div>'; return; }
  const ui = pmrRoadmapUiState();

  const hasSpin = !!(S.spin && Array.isArray(S.spin.issues) && S.spin.issues.length);
  const seedBtn = hasSpin
    ? '<button class="btn btn-ghost btn-xs" onclick="pmrRoadmapUiReseed()"><span class="mi" style="font-size:13px;margin-right:2px">refresh</span>Re-seed from Spin Plan</button>'
    : '<button class="btn btn-ghost btn-xs" disabled title="Load the spin plan / roadmap CSV on the Files page first"><span class="mi" style="font-size:13px;margin-right:2px">refresh</span>Re-seed from Spin Plan</button>';

  const enabledChk = '<label class="row" style="gap:6px;align-items:center;margin-bottom:10px">'
    + '<input type="checkbox" id="pmr-roadmap-enabled" '+(roadmap.enabled?'checked':'')+'>'
    + '<span>Include integrated roadmap in PMR</span></label>';

  // Slide config controls (1 or 2 slides)
  const slidesHtml = (roadmap.slides||[]).map((slide, i) => pmrRoadmapRenderSlideControls(slide, i)).join('');
  const addSlideBtn = (roadmap.slides||[]).length < 2
    ? '<button class="btn btn-ghost btn-xs" style="margin-top:4px" onclick="pmrRoadmapUiAddSlide()"><span class="mi" style="font-size:13px;margin-right:2px">add</span>Add Zoomed Slide</button>'
    : '';

  // Status banner — ephemeral; auto-hides ~4s after the UI op that set it
  const now = Date.now();
  const showStatus = ui.statusMsg && (now - (ui.statusTs||0) < 4500);
  const statusBanner = showStatus
    ? '<div id="pmr-roadmap-status" style="margin:8px 0;padding:6px 10px;border-radius:4px;background:#E6F4FF;border:1px solid #99C8EB;color:#1A1E28;font-size:var(--fs-xs)">'+esc(ui.statusMsg)+'</div>'
    : '';

  // Milestone table (with search + in-range filters)
  const tableHtml = pmrRoadmapRenderMilestoneTable(roadmap);

  // Preview SVG (shows the first slide)
  const previewSvg = (roadmap.slides && roadmap.slides[0])
    ? pmrRoadmapRenderPreviewSvg(roadmap.slides[0], 900, 320)
    : '';

  el.innerHTML = enabledChk
    + '<div style="margin-bottom:10px">'+slidesHtml+addSlideBtn+'</div>'
    + statusBanner
    + '<div class="row" style="justify-content:space-between;align-items:center;margin:14px 0 6px;gap:8px;flex-wrap:wrap">'
    +   '<div style="font-weight:600">Milestones <span class="u-muted-xs">('+(roadmap.milestones||[]).length+')</span></div>'
    +   '<div class="row" style="gap:6px;flex-wrap:wrap">'
    +     '<input type="text" id="pmr-roadmap-search" placeholder="Search label or ticket…" value="'+esc(ui.search||'')+'" style="font-size:var(--fs-xs);padding:4px 8px;width:200px">'
    +     '<label class="row" style="gap:4px;align-items:center;font-size:var(--fs-xs);color:var(--mu)"><input type="checkbox" id="pmr-roadmap-inrange" '+(ui.inRangeOnly?'checked':'')+'> In-range only</label>'
    +     seedBtn
    +     '<button class="btn btn-ghost btn-xs" onclick="pmrRoadmapUiAddManual()"><span class="mi" style="font-size:13px;margin-right:2px">add</span>Manual</button>'
    +   '</div>'
    + '</div>'
    + tableHtml
    + '<div style="font-weight:600;margin:14px 0 6px">Preview</div>'
    + '<div style="background:#F7F5F1;border:1px solid #D4CFC8;border-radius:4px;padding:8px;overflow:auto">'+previewSvg+'</div>';

  // Wire listeners
  const enBx = document.getElementById('pmr-roadmap-enabled');
  if (enBx) enBx.addEventListener('change', function(){ roadmap.enabled = this.checked; autoSaveCfg(); });

  // Filter controls — live re-render without autoSave (transient UI state)
  const searchBox = document.getElementById('pmr-roadmap-search');
  if (searchBox) {
    searchBox.addEventListener('input', function(){
      ui.search = this.value;
      // Re-render just the table + count without nuking the search focus
      pmrRoadmapRerenderTableOnly();
    });
  }
  const inRangeBx = document.getElementById('pmr-roadmap-inrange');
  if (inRangeBx) {
    inRangeBx.addEventListener('change', function(){
      ui.inRangeOnly = this.checked;
      renderPmrRoadmapEditor();
    });
  }

  el.querySelectorAll('[data-slide-field]').forEach(function(inp){
    inp.addEventListener('change', function(){
      const si = +this.dataset.slideIdx;
      const fld = this.dataset.slideField;
      const slide = roadmap.slides[si]; if(!slide) return;
      if (fld === 'tiers') {
        const t = this.value;
        if (!Array.isArray(slide.tiers)) slide.tiers = [];
        const ix = slide.tiers.indexOf(t);
        if (this.checked && ix<0) slide.tiers.push(t);
        if (!this.checked && ix>=0) slide.tiers.splice(ix,1);
      } else {
        slide[fld] = this.value;
        // Keep the slide.year in sync with rangeStart so the header label is correct
        if (fld === 'rangeStart') {
          const m = String(this.value).match(/^(\d{4})/);
          if (m) slide.year = parseInt(m[1], 10);
        }
      }
      autoSaveCfg();
      renderPmrRoadmapEditor();
    });
  });
  el.querySelectorAll('[data-ms-toggle]').forEach(function(bx){
    bx.addEventListener('change', function(){
      pmrRoadmapToggleSelected(this.dataset.msToggle, this.dataset.slideId);
      renderPmrRoadmapEditor();
    });
  });
  el.querySelectorAll('[data-ms-field]').forEach(function(inp){
    inp.addEventListener('change', function(){
      const mid = this.dataset.msId, fld = this.dataset.msField;
      const m = (roadmap.milestones||[]).find(x=>x.id===mid); if(!m) return;
      m[fld] = this.value;
      if (fld === 'label') m.labelFull = this.value;
      // Mark field as user-edited so re-seeds don't clobber it
      if (!m._userEdited) m._userEdited = {};
      m._userEdited[fld] = true;
      autoSaveCfg();
      renderPmrRoadmapEditor();
    });
  });
  el.querySelectorAll('[data-ms-delete]').forEach(function(btn){
    btn.addEventListener('click', function(){
      pmrRoadmapDeleteMilestone(this.dataset.msDelete);
      renderPmrRoadmapEditor();
    });
  });
  el.querySelectorAll('[data-slide-remove]').forEach(function(btn){
    btn.addEventListener('click', function(){
      const si = +this.dataset.slideRemove;
      roadmap.slides.splice(si, 1);
      autoSaveCfg();
      renderPmrRoadmapEditor();
    });
  });
}

// Re-renders only the milestone table region, preserving input focus in the
// search box. Used for live search-as-you-type.
function pmrRoadmapRerenderTableOnly(){
  const roadmap = S.cfg.pmr_roadmap; if(!roadmap) return;
  const el = document.getElementById('pmr-roadmap-editor'); if(!el) return;
  const wrap = el.querySelector('.pmr-roadmap-table-wrap');
  if (!wrap) { renderPmrRoadmapEditor(); return; }
  wrap.outerHTML = pmrRoadmapRenderMilestoneTable(roadmap);
  // Rewire ms-toggle / ms-field / ms-delete listeners for the new DOM
  const fresh = el.querySelector('.pmr-roadmap-table-wrap');
  if (!fresh) return;
  fresh.querySelectorAll('[data-ms-toggle]').forEach(function(bx){
    bx.addEventListener('change', function(){
      pmrRoadmapToggleSelected(this.dataset.msToggle, this.dataset.slideId);
      renderPmrRoadmapEditor();
    });
  });
  fresh.querySelectorAll('[data-ms-field]').forEach(function(inp){
    inp.addEventListener('change', function(){
      const mid = this.dataset.msId, fld = this.dataset.msField;
      const m = (roadmap.milestones||[]).find(x=>x.id===mid); if(!m) return;
      m[fld] = this.value;
      if (fld === 'label') m.labelFull = this.value;
      if (!m._userEdited) m._userEdited = {};
      m._userEdited[fld] = true;
      autoSaveCfg();
      renderPmrRoadmapEditor();
    });
  });
  fresh.querySelectorAll('[data-ms-delete]').forEach(function(btn){
    btn.addEventListener('click', function(){
      pmrRoadmapDeleteMilestone(this.dataset.msDelete);
      renderPmrRoadmapEditor();
    });
  });
}

function pmrRoadmapRenderSlideControls(slide, idx){
  const tierChks = ['T0','T1','T2','T3'].map(t =>
    '<label class="row" style="gap:4px;align-items:center;margin-right:10px"><input type="checkbox" data-slide-idx="'+idx+'" data-slide-field="tiers" value="'+t+'"'
    + ((slide.tiers||[]).indexOf(t)>=0?' checked':'')+'> '+t+'</label>'
  ).join('');
  const monthOpts = [];
  for (let y=2025; y<=2027; y++) {
    for (let m=1; m<=12; m++) {
      const key = y+'-'+String(m).padStart(2,'0');
      const label = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+' '+y;
      monthOpts.push('<option value="'+key+'">'+label+'</option>');
    }
  }
  const startSel = monthOpts.join('').replace('value="'+slide.rangeStart+'"','value="'+slide.rangeStart+'" selected');
  const endSel = monthOpts.join('').replace('value="'+slide.rangeEnd+'"','value="'+slide.rangeEnd+'" selected');
  const tierEmphOpts = ['T0','T1','T2','T3'].map(t =>
    '<option value="'+t+'"'+(slide.emphasizeTier===t?' selected':'')+'>'+t+'</option>'
  ).join('');
  const removeBtn = idx>0
    ? '<button class="btn btn-red btn-xs" data-slide-remove="'+idx+'" style="margin-left:auto">✕</button>'
    : '';

  return '<div class="card" style="margin-bottom:8px;padding:10px">'
    + '<div class="row" style="align-items:center;margin-bottom:6px">'
    +   '<span style="font-weight:600;font-size:var(--fs-sm)">'+(idx===0?'Slide 1 — Overview':'Slide 2 — Zoomed')+'</span>'
    +   removeBtn
    + '</div>'
    + '<div class="row" style="gap:8px;margin-bottom:6px;flex-wrap:wrap">'
    +   '<label class="row" style="gap:4px"><span style="font-size:var(--fs-xs);color:var(--mu);min-width:40px">Title</span>'
    +     '<input type="text" data-slide-idx="'+idx+'" data-slide-field="title" value="'+esc(slide.title||'')+'" style="width:280px"></label>'
    + '</div>'
    + '<div class="row" style="gap:8px;margin-bottom:6px;flex-wrap:wrap">'
    +   '<label class="row" style="gap:4px"><span style="font-size:var(--fs-xs);color:var(--mu);min-width:40px">From</span>'
    +     '<select data-slide-idx="'+idx+'" data-slide-field="rangeStart">'+startSel+'</select></label>'
    +   '<label class="row" style="gap:4px"><span style="font-size:var(--fs-xs);color:var(--mu)">to</span>'
    +     '<select data-slide-idx="'+idx+'" data-slide-field="rangeEnd">'+endSel+'</select></label>'
    +   '<label class="row" style="gap:4px"><span style="font-size:var(--fs-xs);color:var(--mu);margin-left:8px">Emphasize</span>'
    +     '<select data-slide-idx="'+idx+'" data-slide-field="emphasizeTier">'+tierEmphOpts+'</select></label>'
    + '</div>'
    + '<div class="row" style="gap:4px"><span style="font-size:var(--fs-xs);color:var(--mu);min-width:40px">Tiers</span>'+tierChks+'</div>'
    + '</div>';
}

function pmrRoadmapRenderMilestoneTable(roadmap){
  const ui = pmrRoadmapUiState();
  const allMs = (roadmap.milestones||[]).slice().sort((a,b)=>{
    if (a.tier !== b.tier) return (a.tier||'').localeCompare(b.tier||'');
    return (a.date||'').localeCompare(b.date||'');
  });
  const total = allMs.length;

  // Apply search + in-range filters
  const needle = (ui.search||'').toLowerCase().trim();
  // Build a set of in-range month keys across ALL slides, so "in-range only"
  // keeps items that appear on any slide (not just the first).
  const slideRangeKeys = {};
  if (ui.inRangeOnly) {
    (roadmap.slides||[]).forEach(slide => {
      const months = pmrRoadmapMonthsForSlide(slide);
      months.forEach(m => { slideRangeKeys[m.key] = true; });
    });
  }
  const ms = allMs.filter(m => {
    if (needle) {
      const hay = ((m.label||'') + ' ' + (m.labelFull||'') + ' ' + (m.ticketKey||'')).toLowerCase();
      if (hay.indexOf(needle) < 0) return false;
    }
    if (ui.inRangeOnly) {
      const mk = pmrRoadmapMonthKey(m.date);
      if (!mk || !slideRangeKeys[mk]) return false;
    }
    return true;
  });

  if (!total) {
    return '<div class="pmr-roadmap-table-wrap"><div class="u-muted-xs" style="padding:8px;background:var(--bg2);border:1px dashed var(--bd);border-radius:4px">No milestones yet. Click <b>Re-seed from Spin Plan</b> to import from the loaded roadmap CSV, or <b>Manual</b> to add one by hand.</div></div>';
  }
  if (!ms.length) {
    return '<div class="pmr-roadmap-table-wrap"><div class="u-muted-xs" style="padding:8px;background:var(--bg2);border:1px dashed var(--bd);border-radius:4px">'
      +(total+' milestone'+(total===1?'':'s')+' total, but none match the current filters.')
      +'</div></div>';
  }
  const slideIds = (roadmap.slides||[]).map(s=>s.id);
  const slideHdrs = slideIds.map((id,i)=>'<th style="width:38px" title="'+esc((roadmap.slides[i]&&roadmap.slides[i].title)||id)+'">S'+(i+1)+'</th>').join('');
  const statusOpts = ['not_started','in_progress','complete','blocked']
    .map(s=>'<option value="'+s+'">'+s.replace('_',' ')+'</option>').join('');
  const tierOpts = ['T0','T1','T2','T3'].map(t=>'<option value="'+t+'">'+t+'</option>').join('');
  const prodOpts = ['DX','LX','RC','X'].map(p=>'<option value="'+p+'">'+p+'</option>').join('');

  const editedBadge = fld => '<span class="pmr-ms-edited" title="User-edited — re-seed won\'t overwrite" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#B87800;margin-left:4px;vertical-align:middle"></span>';

  const rows = ms.map(m => {
    const edited = m._userEdited || {};
    const toggles = slideIds.map(sid =>
      '<td style="text-align:center"><input type="checkbox" data-ms-toggle="'+esc(m.id)+'" data-slide-id="'+esc(sid)+'"'
      + ((m.slideIds||[]).indexOf(sid)>=0?' checked':'')+'></td>'
    ).join('');
    const tierSel = tierOpts.replace('value="'+m.tier+'"','value="'+m.tier+'" selected');
    const prodSel = prodOpts.replace('value="'+m.product+'"','value="'+m.product+'" selected');
    const statusSel = statusOpts.replace('value="'+m.status+'"','value="'+m.status+'" selected');
    const tk = m.ticketKey ? '<span class="tk-c">'+esc(m.ticketKey)+'</span>' : '<span class="u-muted-xs">manual</span>';
    return '<tr>'
      + toggles
      + '<td><select data-ms-id="'+esc(m.id)+'" data-ms-field="tier" style="font-size:var(--fs-xs)">'+tierSel+'</select>'+(edited.tier?editedBadge('tier'):'')+'</td>'
      + '<td><select data-ms-id="'+esc(m.id)+'" data-ms-field="product" style="font-size:var(--fs-xs)">'+prodSel+'</select>'+(edited.product?editedBadge('product'):'')+'</td>'
      + '<td><input type="date" data-ms-id="'+esc(m.id)+'" data-ms-field="date" value="'+esc(m.date||'')+'" style="font-size:var(--fs-xs)">'+(edited.date?editedBadge('date'):'')+'</td>'
      + '<td style="font-size:var(--fs-xs);white-space:nowrap">'+tk+'</td>'
      + '<td><input type="text" data-ms-id="'+esc(m.id)+'" data-ms-field="label" value="'+esc(m.label||'')+'" style="width:100%;font-size:var(--fs-xs)" title="'+esc(m.labelFull||m.label||'')+'">'+(edited.label?editedBadge('label'):'')+'</td>'
      + '<td><select data-ms-id="'+esc(m.id)+'" data-ms-field="status" style="font-size:var(--fs-xs)">'+statusSel+'</select>'+(edited.status?editedBadge('status'):'')+'</td>'
      + '<td><button class="btn btn-red btn-xs" data-ms-delete="'+esc(m.id)+'">✕</button></td>'
      + '</tr>';
  }).join('');

  const counter = ms.length === total
    ? ('<div class="u-muted-xs" style="margin-bottom:4px">'+total+' milestone'+(total===1?'':'s')+'</div>')
    : ('<div class="u-muted-xs" style="margin-bottom:4px">'+ms.length+' of '+total+' milestones shown</div>');

  return '<div class="pmr-roadmap-table-wrap">' + counter
    + '<div class="tw" style="max-height:320px;overflow:auto"><table class="rt"><thead><tr>'
    + slideHdrs + '<th>Tier</th><th>Prd</th><th>Date</th><th>Ticket</th><th>Label</th><th>Status</th><th></th>'
    + '</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}

// Show an ephemeral status banner inside the editor. Auto-hides after ~4s.
function pmrRoadmapSetStatus(msg){
  const ui = pmrRoadmapUiState();
  ui.statusMsg = msg || '';
  ui.statusTs = Date.now();
}

// Thin UI wrappers that surface results via the inline banner and re-render.
function pmrRoadmapUiReseed(){
  const r = pmrRoadmapSeedFromSpin();
  if (r.reason) {
    pmrRoadmapSetStatus('Re-seed failed: ' + r.reason);
    renderPmrRoadmapEditor();
    return;
  }
  let msg = 'Re-seeded from spin plan: +'+r.added+' added · '+r.refreshed+' refreshed';
  if (r.skipped) msg += ' · '+r.skipped+' sticky-preserved';
  if (r.manual)  msg += ' · '+r.manual+' manual';
  if (!r.totalCandidates) {
    msg += '. No Epic/Program rows with Target end date found — check the spin plan CSV.';
  }
  pmrRoadmapSetStatus(msg);
  renderPmrRoadmapEditor();
}
function pmrRoadmapUiAddManual(){
  pmrRoadmapAddManual();
  pmrRoadmapSetStatus('New manual milestone added. Fill in the label, date, tier and status.');
  renderPmrRoadmapEditor();
}
function pmrRoadmapUiAddSlide(){
  const roadmap = S.cfg.pmr_roadmap; if(!roadmap) return;
  if ((roadmap.slides||[]).length >= 2) return;
  const base = roadmap.slides[0] || {};
  const y = (base.year || new Date().getFullYear());
  // Default the zoomed slide to a Q2-ish window in the current year
  roadmap.slides.push({
    id: 'zoomed',
    title: 'Integrated Roadmap — Zoomed',
    mode: base.mode || 'months',
    year: y,
    rangeStart: base.rangeStart || (y + '-03'),
    rangeEnd: y + '-07',
    tiers: (base.tiers||['T0','T1','T2','T3']).slice(),
    emphasizeTier: base.emphasizeTier || 'T1'
  });
  autoSaveCfg();
  pmrRoadmapSetStatus('Zoomed slide added. Adjust its range in the slide controls above.');
  renderPmrRoadmapEditor();
}

// Inline SVG preview of a roadmap slide. Shares the lane-packing and month
// helpers with the PPTX renderer so they stay visually in sync.
// Honors: cluster-badge overflow, year-break markers, and 2-line labels for
// the emphasized tier.
function pmrRoadmapRenderPreviewSvg(slide, pxW, pxH){
  const months = pmrRoadmapMonthsForSlide(slide);
  if (!months.length) {
    return '<div class="u-muted-xs" style="padding:8px">Invalid or inverted month range — adjust the slide\'s From/To above.</div>';
  }
  const mils = pmrRoadmapMilestonesForSlide(slide);

  // If the range crosses a year boundary, reserve space for a year strip
  const hasYearBreak = months.some((m, i) => i > 0 && m.yearBreak);
  const yearStripH = hasYearBreak ? 14 : 0;

  const padL = 60, padR = 180, padT = 42 + yearStripH, padB = 34;
  const innerW = pxW - padL - padR;
  const innerH = pxH - padT - padB;
  const tiers = (slide.tiers && slide.tiers.length ? slide.tiers : ['T0','T1','T2','T3']);
  const emph = slide.emphasizeTier || 'T1';
  const totalWeight = tiers.reduce((s,t)=> s + (t===emph ? 2.5 : 1), 0);
  const rowH = {};
  let cursor = padT;
  const tierYs = {};
  tiers.forEach(t => {
    const h = innerH * ((t===emph ? 2.5 : 1) / totalWeight);
    rowH[t] = h;
    tierYs[t] = cursor;
    cursor += h;
  });

  const colW = innerW / months.length;
  const monthX = {};
  months.forEach((m, i) => { monthX[m.key] = padL + (colW * i) + (colW / 2); });

  // Group milestones per tier for lane packing
  const byTier = {};
  tiers.forEach(t => byTier[t] = []);
  mils.forEach(m => {
    if (!byTier[m.tier]) return;
    const x = monthX[pmrRoadmapMonthKey(m.date)];
    if (x === undefined) return;
    byTier[m.tier].push({ m, x });
  });

  let svg = '<svg viewBox="0 0 '+pxW+' '+pxH+'" width="100%" style="max-width:'+pxW+'px;display:block" xmlns="http://www.w3.org/2000/svg">';
  // Background
  svg += '<rect x="0" y="0" width="'+pxW+'" height="'+pxH+'" fill="#F7F5F1"/>';
  // Header strip
  svg += '<rect x="0" y="0" width="'+pxW+'" height="32" fill="#1E2736"/>';
  svg += '<text x="12" y="21" fill="#FFFFFF" font-family="Cambria,Georgia,serif" font-weight="700" font-size="14">(U) '+esc(slide.title||'Integrated Milestone Roadmap')+'</text>';
  // Year label (top right) — only meaningful when the range is single-year
  if (!hasYearBreak) {
    svg += '<text x="'+(pxW-12)+'" y="21" fill="#FFFFFF" font-family="Cambria,Georgia,serif" font-weight="700" font-size="12" text-anchor="end">'+(slide.year||months[0].year||'')+'</text>';
  }

  // Multi-year strip: shows contiguous year bands above the month labels
  if (hasYearBreak) {
    let bandStart = 0;
    for (let i = 0; i <= months.length; i++) {
      const atEnd = (i === months.length);
      const breakHere = atEnd || (i > bandStart && months[i].year !== months[bandStart].year);
      if (breakHere) {
        const x0 = padL + (colW * bandStart);
        const w  = colW * (i - bandStart);
        svg += '<rect x="'+x0+'" y="'+(32+4)+'" width="'+w+'" height="'+(yearStripH-4)+'" fill="#EFECE6" stroke="#D4CFC8"/>';
        svg += '<text x="'+(x0 + w/2)+'" y="'+(32 + yearStripH - 2)+'" fill="#1A1E28" font-family="Cambria,Georgia,serif" font-weight="700" font-size="9" text-anchor="middle">'+months[bandStart].year+'</text>';
        bandStart = i;
      }
    }
  }

  // Month header row
  months.forEach((m, i) => {
    const x = padL + (colW * i);
    const isYearBreak = m.yearBreak;
    svg += '<line x1="'+(x)+'" y1="'+padT+'" x2="'+(x)+'" y2="'+(padT+innerH)+'" stroke="'+(isYearBreak?'#1A1E28':'#D4CFC8')+'" stroke-width="'+(isYearBreak?'1.5':'1')+'"/>';
    svg += '<text x="'+(x+colW/2)+'" y="'+(padT-6)+'" fill="#5A6070" font-family="Cambria,Georgia,serif" font-weight="700" font-size="10" text-anchor="middle">'+m.label+'</text>';
  });
  svg += '<line x1="'+(padL+innerW)+'" y1="'+padT+'" x2="'+(padL+innerW)+'" y2="'+(padT+innerH)+'" stroke="#D4CFC8" stroke-width="1"/>';

  // Tier rows + tier labels + diamonds
  tiers.forEach(t => {
    const y0 = tierYs[t];
    const h = rowH[t];
    const isEmph = (t === emph);
    // Row background
    svg += '<rect x="'+padL+'" y="'+y0+'" width="'+innerW+'" height="'+h+'" fill="#FFFFFF" stroke="#D4CFC8"/>';
    // Tier label
    svg += '<text x="'+(padL-8)+'" y="'+(y0 + h/2 + 4)+'" fill="#1A1E28" font-family="Cambria,Georgia,serif" font-weight="700" font-size="12" text-anchor="end">'+t+'</text>';
    // Lane packing within the row
    const items = byTier[t] || [];
    if (!items.length) return;
    // Compute max lanes that fit — diamondSize(18) + labelBand(isEmph?20:12) + pad(4)
    const laneUnitPx = 18 + (isEmph ? 20 : 12) + 4;
    const maxLanes = Math.max(1, Math.floor((h - 4) / laneUnitPx));
    const packed = pmrRoadmapAssignLanes(
      items.map(it => ({ x: it.x, width: 60 })), 64,
      { maxLanes: maxLanes, minClusterGap: 30 }
    );
    const laneCount = packed.laneCount;
    const totalUsed = laneCount * laneUnitPx;
    const startY = y0 + Math.max(2, (h - totalUsed) / 2);
    items.forEach((it, idx) => {
      const lane = packed.laneOf[idx];
      if (lane < 0) return; // absorbed into a cluster
      const laneTop = startY + (lane * laneUnitPx);
      const cy = laneTop + 9; // center of 18px diamond
      const sz = 9;
      const st = PMR_ROADMAP_STATUS[it.m.status] || PMR_ROADMAP_STATUS.not_started;
      const prod = PMR_ROADMAP_PRODUCT[it.m.product] || PMR_ROADMAP_PRODUCT.X;
      // Blocked milestones render as an octagon (stop sign), others as diamond
      if (it.m.status === 'blocked') {
        // SVG octagon: 8 points inscribed in a circle of radius sz
        const octPts = [];
        for (let a = 0; a < 8; a++) {
          const angle = (Math.PI / 8) + (a * Math.PI / 4);
          octPts.push((it.x + sz * Math.cos(angle)).toFixed(1) + ',' + (cy + sz * Math.sin(angle)).toFixed(1));
        }
        svg += '<polygon points="'+octPts.join(' ')+'" fill="'+st.color+'" stroke="#1A1E28" stroke-width="0.75"/>';
      } else {
        svg += '<polygon points="'+it.x+','+(cy-sz)+' '+(it.x+sz)+','+cy+' '+it.x+','+(cy+sz)+' '+(it.x-sz)+','+cy+'" fill="'+st.color+'" stroke="#1A1E28" stroke-width="0.75"/>';
      }
      svg += '<text x="'+it.x+'" y="'+(cy+3)+'" fill="#FFFFFF" font-family="Cambria,Georgia,serif" font-weight="700" font-size="9" text-anchor="middle">'+prod.letter+'</text>';
      // Multi-line label for emphasized tier, single-line otherwise
      const labMax = isEmph ? 16 : 14;
      const labLines = pmrRoadmapTruncLabel(it.m.label || '', labMax, isEmph ? 2 : 1);
      labLines.forEach((ln, li) => {
        const ly = cy + sz + 8 + (li * 9);
        svg += '<text x="'+it.x+'" y="'+ly+'" fill="#1A1E28" font-family="Cambria,Georgia,serif" font-size="8" text-anchor="middle">'+esc(ln)+'</text>';
      });
    });
    // Cluster badges
    (packed.clusters || []).forEach(cl => {
      const laneTop = startY + (cl.laneIdx * laneUnitPx);
      const cy = laneTop + 9;
      svg += '<circle cx="'+cl.x+'" cy="'+cy+'" r="9" fill="#B87800" stroke="#1A1E28" stroke-width="0.75"/>';
      svg += '<text x="'+cl.x+'" y="'+(cy+3)+'" fill="#FFFFFF" font-family="Cambria,Georgia,serif" font-weight="700" font-size="9" text-anchor="middle">+'+cl.count+'</text>';
    });
  });

  // Next Steps panel on the right
  const panelX = padL + innerW + 10;
  const panelW = pxW - panelX - 10;
  svg += '<rect x="'+panelX+'" y="'+padT+'" width="'+panelW+'" height="'+innerH+'" fill="#FFFFFF" stroke="#D4CFC8"/>';
  svg += '<rect x="'+panelX+'" y="'+padT+'" width="'+panelW+'" height="18" fill="#1E2736"/>';
  svg += '<text x="'+(panelX+6)+'" y="'+(padT+13)+'" fill="#FFFFFF" font-family="Cambria,Georgia,serif" font-weight="700" font-size="10">NEXT STEPS</text>';
  const sorted = mils.slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const maxRows = Math.floor((innerH - 22) / 14);
  sorted.slice(0, maxRows).forEach((m, i) => {
    const ly = padT + 32 + (i*14);
    const st = PMR_ROADMAP_STATUS[m.status] || PMR_ROADMAP_STATUS.not_started;
    svg += '<circle cx="'+(panelX+8)+'" cy="'+(ly-3)+'" r="3" fill="'+st.color+'"/>';
    const dateLbl = (m.date||'').slice(5); // MM-DD
    svg += '<text x="'+(panelX+16)+'" y="'+ly+'" fill="#1A1E28" font-family="Cambria,Georgia,serif" font-size="9" font-weight="700">'+esc(dateLbl)+'</text>';
    const labShort = pmrRoadmapTruncLabel(m.label || '', 28, 1)[0] || '';
    svg += '<text x="'+(panelX+46)+'" y="'+ly+'" fill="#1A1E28" font-family="Cambria,Georgia,serif" font-size="9">'+esc(labShort)+'</text>';
  });
  if (sorted.length > maxRows) {
    svg += '<text x="'+(panelX+8)+'" y="'+(padT + innerH - 6)+'" fill="#5A6070" font-family="Cambria,Georgia,serif" font-size="8" font-style="italic">+'+(sorted.length - maxRows)+' more…</text>';
  }

  // Legend strip at bottom
  const legY = padT + innerH + 14;
  const legItems = [
    { c:PMR_ROADMAP_STATUS.complete.color,    l:'Completed'   },
    { c:PMR_ROADMAP_STATUS.in_progress.color, l:'In Progress' },
    { c:PMR_ROADMAP_STATUS.not_started.color, l:'Not Started' },
    { c:PMR_ROADMAP_STATUS.blocked.color,     l:'Blocked'     }
  ];
  let lx = padL;
  legItems.forEach(it => {
    svg += '<circle cx="'+(lx+5)+'" cy="'+(legY-4)+'" r="4" fill="'+it.c+'"/>';
    svg += '<text x="'+(lx+13)+'" y="'+legY+'" fill="#1A1E28" font-family="Cambria,Georgia,serif" font-size="9">'+it.l+'</text>';
    lx += 78;
  });

  svg += '</svg>';
  return svg;
}
// Pre-computed sprint calendar: FY26 Q2 remainder through FY27 Q2
// Format: YY.Q.S — 2-week sprints, US Federal FY (Q1=Oct-Dec, Q2=Jan-Mar, Q3=Apr-Jun, Q4=Jul-Sep)
const DEFAULT_SPRINT_CALENDAR = (function(){
  const sprints = [];
  // FY26 Q2 (remaining — already passed but include for reference)
  const q2_26 = [
    {sprint:'26.2.5',start:'2026-03-04',end:'2026-03-17'},
    {sprint:'26.2.6',start:'2026-03-18',end:'2026-03-31'},
  ];
  // FY26 Q3 (Apr 1 – Jun 30, 2026) — 6 sprints of 2 weeks each
  const q3_26_dates = ['2026-04-01','2026-04-15','2026-04-29','2026-05-13','2026-05-27','2026-06-10'];
  const q3_26 = q3_26_dates.map((s,i)=>({sprint:`26.3.${i+1}`,start:s,end:addDays(s,13)}));
  // FY26 Q4 (Jul 1 – Sep 30, 2026) — 6 sprints
  const q4_26_dates = ['2026-07-01','2026-07-15','2026-07-29','2026-08-12','2026-08-26','2026-09-09'];
  const q4_26 = q4_26_dates.map((s,i)=>({sprint:`26.4.${i+1}`,start:s,end:addDays(s,13)}));
  // FY27 Q1 (Oct 1 – Dec 31, 2026) — 6 sprints
  const q1_27_dates = ['2026-10-01','2026-10-15','2026-10-29','2026-11-12','2026-11-26','2026-12-10'];
  const q1_27 = q1_27_dates.map((s,i)=>({sprint:`27.1.${i+1}`,start:s,end:addDays(s,13)}));
  // FY27 Q2 (Jan 1 – Mar 31, 2027) — 6 sprints
  const q2_27_dates = ['2027-01-06','2027-01-20','2027-02-03','2027-02-17','2027-03-03','2027-03-17'];
  const q2_27 = q2_27_dates.map((s,i)=>({sprint:`27.2.${i+1}`,start:s,end:addDays(s,13)}));
  return [...q2_26,...q3_26,...q4_26,...q1_27,...q2_27];
})();

function addDays(dateStr, days){
  const d=new Date(dateStr+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}

function getSprintQuarterLabel(sprintId){
  const m=sprintId.match(/^(\d{2})\.(\d)\.(\d+)$/);
  if(!m) return 'Other';
  const fy='FY'+m[1], q='Q'+m[2];
  const qNames={Q1:'Q1 (Oct–Dec)',Q2:'Q2 (Jan–Mar)',Q3:'Q3 (Apr–Jun)',Q4:'Q4 (Jul–Sep)'};
  return `${fy} ${qNames[q]||q} — SPIN ${m[2]}`;
}

function renderSprintCal(){
  const el=document.getElementById('sprint-cal-rows'); if(!el) return;
  const cal=S.cfg.sprint_calendar;
  if(!cal.length){ el.innerHTML='<div class="nstr">No sprints configured. Click + Add Sprint or the pre-populated defaults will load.</div>'; return; }

  // Normalize a date string to YYYY-MM-DD so lexicographic comparison is safe
  // even if user typed a non-padded value like "2026-4-1"
  function normDate(s){
    if(!s) return '';
    const p=s.trim().split('-');
    if(p.length!==3) return s;
    return p[0]+'-'+p[1].padStart(2,'0')+'-'+p[2].padStart(2,'0');
  }

  // Group by quarter label
  const groups={};
  const order=[];
  cal.forEach((s,i)=>{
    const lbl=getSprintQuarterLabel(s.sprint);
    if(!groups[lbl]){groups[lbl]=[];order.push(lbl);}
    groups[lbl].push({s,i});
  });

  const today=new Date().toISOString().slice(0,10);

  el.innerHTML=order.map((lbl,gi)=>{
    const items=groups[lbl];
    const hasCurrent=items.some(({s})=>normDate(s.start)<=today&&today<=normDate(s.end));
    const rows=items.map(({s,i})=>{
      const isCur=normDate(s.start)<=today&&today<=normDate(s.end);
      return `<div class="row" style="margin-bottom:5px;${isCur?'background:var(--a4d);border-radius:var(--r2);padding:4px 6px':''}">
        ${isCur?'<span style="font-size:var(--fs-xs);color:var(--a4);font-weight:700;white-space:nowrap"><span class="mi" style="font-size:11px;margin-right:2px">play_arrow</span>NOW</span>':''}
        <input type="text" value="${esc(s.sprint)}" placeholder="Sprint ID" onchange="S.cfg.sprint_calendar[${i}].sprint=this.value;renderSprintCal();autoSaveCfg()" style="width:90px;font-family:var(--mono);font-size:var(--fs-xs)">
        <input type="date" value="${s.start}" onchange="S.cfg.sprint_calendar[${i}].start=this.value;autoSaveCfg()" style="width:140px">
        <span class="u-muted-xs">→</span>
        <input type="date" value="${s.end}" onchange="S.cfg.sprint_calendar[${i}].end=this.value;autoSaveCfg()" style="width:140px">
        <button class="btn btn-red btn-xs" onclick="S.cfg.sprint_calendar.splice(${i},1);renderSprintCal();autoSaveCfg()">✕</button>
      </div>`;
    }).join('');

    const qid=`sq-${gi}`;
    return `<div style="margin-bottom:8px;border:1px solid var(--bd);border-radius:var(--r2);overflow:hidden">
      <div onclick="toggleSprintQuarter('${qid}')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--s3);cursor:pointer;user-select:none">
        <span id="${qid}-chev" style="font-size:13px;transition:transform .15s"><span class="mi">chevron_right</span></span>
        <span style="font-size:var(--fs-sm);font-weight:600;color:${hasCurrent?'var(--a4)':'var(--tx)'};">${esc(lbl)}</span>
        ${hasCurrent?'<span style="font-size:var(--fs-xs);color:var(--a4);font-weight:700">● CURRENT SPIN</span>':''}
        <span style="font-size:var(--fs-xs);color:var(--mu);margin-left:auto">${items.length} sprint${items.length!==1?'s':''}</span>
      </div>
      <div id="${qid}-body" style="display:none;padding:10px 12px">${rows}</div>
    </div>`;
  }).join('');

  // Auto-expand the quarter containing today
  order.forEach((lbl,gi)=>{
    const items=groups[lbl];
    if(items.some(({s})=>normDate(s.start)<=today&&today<=normDate(s.end))){
      const qid=`sq-${gi}`;
      const body=document.getElementById(qid+'-body');
      const chev=document.getElementById(qid+'-chev');
      if(body) body.style.display='block';
      if(chev) chev.style.transform='rotate(90deg)';
    }
  });
}

function toggleSprintQuarter(qid){
  const body=document.getElementById(qid+'-body');
  const chev=document.getElementById(qid+'-chev');
  if(!body) return;
  const open=body.style.display==='none'||!body.style.display;
  body.style.display=open?'block':'none';
  if(chev) chev.style.transform=open?'rotate(90deg)':'';
}
function _setAllSprintQuarters(open){
  document.querySelectorAll('[id$="-body"]').forEach(el=>{if(el.id.startsWith('sq-'))el.style.display=open?'block':'none';});
  document.querySelectorAll('[id$="-chev"]').forEach(el=>{if(el.id.startsWith('sq-'))el.style.transform=open?'rotate(90deg)':'';});
}
function expandAllSprintQuarters(){ _setAllSprintQuarters(true); }
function collapseAllSprintQuarters(){ _setAllSprintQuarters(false); }
function addSprintRow(){
  S.cfg.sprint_calendar.push({sprint:'',start:'',end:''});
  renderSprintCal();
}

// ── Spin History management (Settings → Spin Plan) ──────────
function renderSpinHistoryList() {
  const el = document.getElementById('spin-history-list');
  if (!el) return;
  const history = S.cfg.spin_history || [];
  if (!history.length) {
    el.innerHTML = '<div class="u-muted-xs">No saved spins. Load a spin plan CSV and click Save Current Spin.</div>';
    return;
  }
  el.innerHTML = history.map((h, i) => {
    const d = h.ts ? new Date(h.ts).toLocaleDateString() : '';
    return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--bd);align-items:center;gap:8px">
      <span style="font-weight:600;font-size:var(--fs-sm);color:var(--tx);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(h.label)}</span>
      <span class="u-muted-xs" style="flex-shrink:0">${h.count} rows · ${d}</span>
      <button class="btn btn-ghost btn-xs" onclick="spinSettingsLoadFromHistory('${esc(h.id)}')" title="Load this spin"><span class="mi" style="font-size:13px">play_arrow</span></button>
      <button class="btn btn-red btn-xs" onclick="spinSettingsDeleteFromHistory('${esc(h.id)}',${i})" title="Delete"><span class="mi" style="font-size:13px">delete</span></button>
    </div>`;
  }).join('');
}

function spinSettingsSaveToHistory() {
  const label = prompt('Label for this spin (e.g., "Spin 2 — Q2 FY26"):');
  if (!label) return;
  const id = saveSpinToHistory(label);
  if (id) {
    renderSpinHistoryList();
    alert('Saved: ' + label);
  }
}

function spinSettingsLoadFromHistory(id) {
  switchToHistoricalSpin(id);
  alert('Loaded. Go to Spin Plan to see the data.');
}

function spinSettingsDeleteFromHistory(id, idx) {
  const h = (S.cfg.spin_history || [])[idx];
  if (!h) return;
  if (!confirm('Delete "' + h.label + '"?')) return;
  deleteSpinFromHistory(id);
  renderSpinHistoryList();
}


