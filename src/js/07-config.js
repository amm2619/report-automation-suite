// ============================================================
// CONFIG PERSISTENCE (localStorage + JSON export/import)
// ============================================================
const LS_KEY='jira_reportsuite_cfg_v1';

let _cfgDirty=false;
let _cfgLastSaved=null;

function markDirty(){
  _cfgDirty=true;
  const dot=document.getElementById('cfg-dirty-dot');
  const msg=document.getElementById('cfg-save-msg');
  const btn=document.getElementById('cfg-save-btn');
  if(dot) dot.style.background='var(--a4)';
  if(msg){ msg.textContent='Unsaved changes'; msg.style.color='var(--a4)'; }
  if(btn){ btn.style.outline='2px solid var(--a4)'; btn.style.outlineOffset='1px'; }
}

function _applySaved(){
  _cfgDirty=false;
  _cfgLastSaved=new Date();
  const dot=document.getElementById('cfg-dirty-dot');
  const msg=document.getElementById('cfg-save-msg');
  const btn=document.getElementById('cfg-save-btn');
  if(dot) dot.style.background='var(--a3)';
  if(msg){
    const t=_cfgLastSaved.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    msg.textContent=`Saved at ${t}`; msg.style.color='var(--a3)';
  }
  if(btn){ btn.style.outline=''; btn.style.outlineOffset=''; }
  // Fade dot back to neutral after 6s
  setTimeout(()=>{
    const d=document.getElementById('cfg-dirty-dot');
    if(d&&!_cfgDirty) d.style.background='var(--di)';
  },6000);
}

// Shared write — called by both autoSaveCfg (debounced) and manualSaveCfg (immediate)
function _persistCfg(){
  localStorage.setItem(LS_KEY, JSON.stringify(S.cfg));
  localStorage.setItem('jira_reportsuite_topics_v1', JSON.stringify(S.topics));
}
function _persistCfgErrorMsg(){
  const msg=document.getElementById('cfg-save-msg');
  if(msg){ msg.textContent='⚠ localStorage unavailable — use Export to save'; msg.style.color='var(--a5)'; }
}

function autoSaveCfg(){
  // Mark dirty first so the user sees something changed, then debounce the actual write
  markDirty();
  clearTimeout(autoSaveCfg._t);
  autoSaveCfg._t=setTimeout(()=>{
    try{ _persistCfg(); _applySaved(); }catch(e){ _persistCfgErrorMsg(); }
  },800);
}

function manualSaveCfg(){
  clearTimeout(autoSaveCfg._t);
  try{
    _persistCfg();
    _applySaved();
    // Flash the button green briefly for clear confirmation
    const btn=document.getElementById('cfg-save-btn');
    if(btn){
      const prev=btn.textContent;
      btn.textContent='✓ Saved';
      btn.style.background='var(--a3)'; btn.style.color='#0a0d16';
      setTimeout(()=>{ btn.textContent=prev; btn.style.background=''; btn.style.color=''; },1600);
    }
  }catch(e){ _persistCfgErrorMsg(); }
}


// ── Epics CSV persistence ──────────────────────────────────
// Only stores the 4 columns needed: Issue key, Status, Project key, Epic Name
const EPICS_LS_KEY      = 'jira_reportsuite_epics_v1';
const EPICS_LS_META_KEY = 'jira_reportsuite_epics_meta_v1';
const SPIN_LS_KEY       = 'jira_reportsuite_spin_v1';
const SPIN_LS_META_KEY  = 'jira_reportsuite_spin_meta_v1';

function saveEpicsToStorage(rows, filename) {
  try {
    // Only keep the 4 columns we need
    const slim = rows.map(r => ({
      k: r['Issue key'] || r['Key'] || '',
      s: r['Status'] || '',
      p: r['Project key'] || r['Project'] || '',
      n: r['Custom field (Epic Name)'] || r['Epic Name'] || r['Summary'] || ''
    })).filter(r => r.k);
    localStorage.setItem(EPICS_LS_KEY, JSON.stringify(slim));
    localStorage.setItem(EPICS_LS_META_KEY, JSON.stringify({ filename, ts: new Date().toISOString(), count: slim.length }));
    return slim.length;
  } catch(e) { console.warn('Could not save epics to localStorage:', e); return 0; }
}

function loadEpicsFromStorage() {
  try {
    const raw = localStorage.getItem(EPICS_LS_KEY);
    const meta = JSON.parse(localStorage.getItem(EPICS_LS_META_KEY) || '{}');
    if (!raw) return null;
    const slim = JSON.parse(raw);
    // Reconstruct as full row objects for rebuildTickets compatibility
    const rows = slim.map(r => ({
      'Issue key': r.k, 'Status': r.s, 'Project key': r.p,
      'Custom field (Epic Name)': r.n, 'Epic Name': r.n, 'Summary': r.n
    }));
    return { rows, filename: meta.filename || 'epics (cached)', count: slim.length };
  } catch(e) { return null; }
}
// ── Spin plan localStorage persistence (mirrors epics pattern) ──
function saveSpinToStorage(rows, filename) {
  try {
    // Slim to only the columns normSpinCsvIssue needs
    const slim = rows.map(r => {
      const o = {};
      const keep = ['Issue key','Key','Issue Type','Hierarchy','Title','Summary','Status',
        'Assignee','Parent','Parent Key','Epic Link','Epic link',
        'Labels','Components','Priority','Due date',
        'Target start date','Target Start Date','Target end date','Target End Date',
        'Resolved','Updated','Comment'];
      keep.forEach(k => { if (r[k] !== undefined) o[k] = r[k]; });
      // Also carry through any "Sprint" or "blocks" columns
      Object.keys(r).forEach(k => {
        const kl = k.toLowerCase();
        if (kl.includes('sprint') || kl.includes('block') || kl.includes('is blocked'))
          o[k] = r[k];
      });
      return o;
    });
    localStorage.setItem(SPIN_LS_KEY,      JSON.stringify(slim));
    localStorage.setItem(SPIN_LS_META_KEY, JSON.stringify({
      filename, ts: new Date().toISOString(), count: slim.length
    }));
    return slim.length;
  } catch(e) { console.warn('Could not save spin to localStorage:', e); return 0; }
}

function loadSpinFromStorage() {
  try {
    const raw  = localStorage.getItem(SPIN_LS_KEY);
    const meta = JSON.parse(localStorage.getItem(SPIN_LS_META_KEY) || '{}');
    if (!raw) return null;
    return { rows: JSON.parse(raw), filename: meta.filename || 'spin plan (cached)', count: meta.count || 0 };
  } catch(e) { return null; }
}

function initSpinFromStorage() {
  const cached = loadSpinFromStorage();
  if (!cached) return;
  S.files.spin   = cached.rows;
  if (!S.fileNames) S.fileNames = {};
  S.fileNames.spin   = cached.filename;
  S.fileNames._spinFromCache = true;
  updateStatusBar();
  // Re-process through the spin engine so S.spin tree is ready
  const fakeFile = { name: cached.filename };
  S._fileRegistry[cached.filename] = { type: 'spin', rows: cached.rows, file: fakeFile };
  if (typeof runSpinEngine === 'function') runSpinEngine(cached.rows);
  // Update any visible fzone
  const fz = document.getElementById('fz-spin');
  const fl = document.getElementById('fl-spin');
  if (fz) fz.classList.add('loaded');
  if (fl) fl.textContent = cached.filename + ' (' + cached.count + ' rows, cached)';
}

function clearSpinFromStorage() {
  localStorage.removeItem(SPIN_LS_KEY);
  localStorage.removeItem(SPIN_LS_META_KEY);
  S.files.spin   = null;
  if (S.fileNames) { delete S.fileNames.spin; delete S.fileNames._spinFromCache; }
  S.spin.issues  = [];
  S.spin.tree    = [];
  S.spin._nodeMap = {};
  updateStatusBar();
}



function clearEpicsFromStorage() {
  localStorage.removeItem(EPICS_LS_KEY);
  localStorage.removeItem(EPICS_LS_META_KEY);
  S.files.epics = null;
  if (S.fileNames) { delete S.fileNames.epics; delete S.fileNames._epicsFromCache; }
  rebuildTickets();
  updateStatusBar();
}

function initEpicsFromStorage() {
  const cached = loadEpicsFromStorage();
  if (!cached) return;
  S.files.epics = cached.rows;
  if (!S.fileNames) S.fileNames = {};
  S.fileNames.epics = cached.filename;
  S.fileNames._epicsFromCache = true;
  rebuildTickets();
  updateStatusBar();
  // Update any visible fzone
  const fz = document.getElementById('fz-epics');
  const fl = document.getElementById('fl-epics');
  if (fz) fz.classList.add('loaded');
  if (fl) fl.textContent = cached.filename + ' (' + cached.count + ' epics, cached)';
}


// ── Draft auto-save to localStorage ──────────────────────────
const DRAFT_LS_KEYS = {
  weekly: 'jira_reportsuite_draft_weekly_v1',
  eos:    'jira_reportsuite_draft_eos_v1',
  pmr:    'jira_reportsuite_draft_pmr_v1',
  sprint: 'jira_reportsuite_draft_sprint_v1',
  spin:   'jira_reportsuite_draft_spin_v1',
};

function autoSaveDraft(reportType) {
  const frameId = {weekly:'rptf0',eos:'rptf1',pmr:'rptf2',sprint:'rptf3',spin:'spin-output'}[reportType];
  const frame = document.getElementById(frameId);
  if (!frame) return;

  const cfgSnap = {
    jira_url: S.cfg.jira_url||'',
    classification: S.cfg.classification||'',
    pmr_title: S.cfg.pmr_title||'',
    eos_projects: JSON.parse(JSON.stringify(S.cfg.eos_projects||{})),
  };
  const spinSnap = reportType === 'spin' ? {
    view: S.spin.view || 'list',
    depNotes:  JSON.parse(JSON.stringify(S.spin.depNotes  || {})),
    depClosed: JSON.parse(JSON.stringify(S.spin.depClosed || {})),
  } : null;

  const draft = {
    reportType, ts: new Date().toISOString(),
    issuesFile: S.fileNames?.issues || '',
    epicsFile:  S.fileNames?.epics  || '',
    wizParams:  JSON.parse(JSON.stringify(S._wizParams || {})),
    cfg: cfgSnap, spinState: spinSnap,
    fields: {}, pmrBluf: {},
  };

  frame.querySelectorAll('[contenteditable="true"]').forEach(el => {
    const pmrKey = el.dataset?.pmrBluf;
    if (pmrKey) draft.pmrBluf[pmrKey] = el.innerText || el.textContent || '';
    else if (el.id) draft.fields[el.id] = el.innerText || el.textContent || '';
  });

  try {
    localStorage.setItem(DRAFT_LS_KEYS[reportType], JSON.stringify(draft));
    updateRecentReports(reportType, draft);
  } catch(e) { console.warn('Draft save failed:', e); }
}

function loadDraftFromStorage(reportType) {
  try {
    const raw = localStorage.getItem(DRAFT_LS_KEYS[reportType]);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function downloadDraftFile(reportType) {
  // Backup: download draft as JSON file (moved to overflow menu)
  const draft = loadDraftFromStorage(reportType);
  if (!draft) { alert('No saved draft for ' + reportType + '. Generate the report first.'); return; }
  const a = document.createElement('a');
  const labels = {weekly:'Weekly',eos:'EOS',pmr:'PMR',sprint:'Sprint',spin:'Spin'};
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(draft, null, 2));
  a.download = labels[reportType] + '_draft_' + dtg() + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── Recent Reports tracking ───────────────────────────────────
const RECENT_LS_KEY = 'jira_reportsuite_recent_v1';

function updateRecentReports(reportType, draft) {
  try {
    const raw = localStorage.getItem(RECENT_LS_KEY);
    const recent = raw ? JSON.parse(raw) : [];
    // Remove existing entry for this type, add new one at front
    const filtered = recent.filter(r => r.reportType !== reportType);
    const labels = {weekly:'Weekly Digest',eos:'End of Sprint',pmr:'PMR',sprint:'Sprint Plan',spin:'Spin Plan',batch:'All Reports'};
    const paramStr = _draftParamSummary(reportType, draft.wizParams);
    filtered.unshift({ reportType, ts: draft.ts, label: labels[reportType] || reportType, params: paramStr, issuesFile: draft.issuesFile });
    localStorage.setItem(RECENT_LS_KEY, JSON.stringify(filtered.slice(0, 5)));
    renderRecentReports();
  } catch(e) {}
}

function _draftParamSummary(type, p) {
  if (!p) return '';
  if (type === 'weekly') {
    const s = (p.wStart||'').slice(5).replace('-','/');
    const e = (p.wEnd||'').slice(5).replace('-','/');
    return s && e ? s + ' – ' + e : '';
  }
  if (type === 'eos')    return [p.eosCur, p.eosFut].filter(Boolean).join(' / ');
  if (type === 'pmr') {
    if (!p.pmrMonth) return '';
    try { const [yr,mo] = p.pmrMonth.split('-'); const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return (MONTHS[parseInt(mo)-1]||mo) + ' ' + yr; } catch(e) { return p.pmrMonth; }
  }
  if (type === 'sprint') return p.prevsprint ? (p.cursprint ? p.prevsprint + ' / ' + p.cursprint : p.prevsprint) : '';
  if (type === 'spin') return p.spinFile || '';
  return '';
}

function renderRecentReports() {
  const slot = document.getElementById('recent-reports-slot');
  if (!slot) return;
  try {
    const raw = localStorage.getItem(RECENT_LS_KEY);
    const recent = raw ? JSON.parse(raw) : [];
    if (!recent.length) { slot.innerHTML = ''; return; }
    const ICONS = {weekly:'newspaper',eos:'flag',pmr:'bar_chart',sprint:'task_alt',spin:'account_tree',batch:'dynamic_feed'};
    slot.innerHTML =
      '<div class="home-section-label" style="margin-top:24px">Recent</div>' +
      '<div class="recent-grid">' +
      recent.map(r => {
        const icon = ICONS[r.reportType] || 'description';
        const age  = _timeAgo(r.ts);
        return '<div class="recent-card" onclick="restoreFromRecent(\'' + r.reportType + '\')">' +
          '<span class="mi recent-card-icon">' + icon + '</span>' +
          '<div class="recent-card-body">' +
            '<div class="recent-card-name">' + esc(r.label) + '</div>' +
            (r.params ? '<div class="recent-card-params">' + esc(r.params) + '</div>' : '') +
            '<div class="recent-card-age">' + age + '</div>' +
          '</div>' +
          '<button class="btn btn-ghost btn-xs recent-card-btn">Restore →</button>' +
        '</div>';
      }).join('') +
      '</div>';
  } catch(e) { slot.innerHTML = ''; }
}

function _timeAgo(iso) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 2)  return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  } catch(e) { return ''; }
}

function restoreFromRecent(reportType) {
  const draft = loadDraftFromStorage(reportType);
  if (!draft) { alert('No saved data for this report.'); return; }
  S._pendingDraft = S._pendingDraft || {};
  S._pendingDraft[reportType] = draft;
  S._wizParams = JSON.parse(JSON.stringify(draft.wizParams || {}));
  if (draft.spinState && reportType === 'spin') {
    if (draft.spinState.depNotes)  S.spin.depNotes  = Object.assign(S.spin.depNotes  || {}, draft.spinState.depNotes);
    if (draft.spinState.depClosed) S.spin.depClosed = Object.assign(S.spin.depClosed || {}, draft.spinState.depClosed);
    if (draft.spinState.view) S.spin.view = draft.spinState.view;
  }
  startWizard(reportType);
}


function toggleOverflow(id) {
  const menu = document.getElementById(id);
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  // Close all open overflow menus first
  document.querySelectorAll('.rpt-overflow-menu').forEach(m => m.style.display = 'none');
  if (!isOpen) {
    menu.style.display = 'block';
    // Close on outside click
    setTimeout(function() {
      document.addEventListener('click', function _close(e) {
        if (!menu.contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', _close);
        }
      });
    }, 0);
  }
}


function importOverrides(input) {
  const files = Array.from(input.files || []); if (!files.length) return;
  input.value = '';
  readFileAsText(files[0])
    .then(text => {
      const data = JSON.parse(text);
      if (data.overrides && Array.isArray(data.overrides)) {
        S.overrides = data.overrides;
        localStorage.setItem('jira_reportsuite_overrides_v1', JSON.stringify(S.overrides));
        alert('Overrides imported: ' + S.overrides.length + ' rules.');
      } else { alert('Invalid overrides file.'); }
    })
    .catch(err => alert('Could not parse file: ' + err.message));
}

function loadSavedCfg(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(!raw) return;
    const saved=JSON.parse(raw);
    // Deep merge into S.cfg — only override keys that exist in saved
    function merge(target, src){
      for(const k of Object.keys(src)){
        if(src[k]!==null && typeof src[k]==='object' && !Array.isArray(src[k]) && typeof target[k]==='object' && !Array.isArray(target[k])){
          merge(target[k], src[k]);
        } else {
          target[k]=src[k];
        }
      }
    }
    merge(S.cfg, saved);
    _migrateCfg();
  }catch(e){}
}

function exportConfig(){
  const payload={version:1,cfg:S.cfg,topics:S.topics,exported_at:new Date().toISOString()};
  const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(payload,null,2)); a.download=`reportsuite_config_${dtg()}.json`; a.click();
}

function importConfig(input){
  const files=Array.from(input.files||[]); if(!files.length) return;
  // Reset input so same file can be re-selected
  input.value='';
  const errors=[];
  let loaded=0;
  Promise.all(files.map(file=>
    readFileAsText(file).then(text=>{
      const data=JSON.parse(text);
      const src=data.cfg||data;
      // Deep merge cfg: arrays replace, objects merge
      Object.keys(src).forEach(k=>{
        if(Array.isArray(src[k])) S.cfg[k]=src[k];
        else if(src[k]&&typeof src[k]==='object'&&!Array.isArray(src[k])) Object.assign(S.cfg[k]||(S.cfg[k]={}), src[k]);
        else S.cfg[k]=src[k];
      });
      // Restore topics if present in the export payload (exportConfig includes data.topics)
      if(data.topics&&Array.isArray(data.topics)) S.topics=data.topics;
      loaded++;
    }).catch(err=>errors.push(file.name+': '+err.message))
  )).then(()=>{
    if(loaded){ _migrateCfg(); autoSaveCfg(); populateConfigFields(); }
    const msg=files.length>1?`${loaded} config file${loaded>1?'s':''} merged successfully.`:'Config imported successfully.';
    if(errors.length) alert((loaded?msg+'\n':'')+'Errors:\n'+errors.join('\n'));
    else alert(msg);
  });
}

function resetConfig(){
  if(!confirm('Reset all config to defaults? This cannot be undone.')) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

// ── Config field helpers
function cfgSet(key, val){
  S.cfg[key]=val;
}
function _migrateCfg(){
  // Promote legacy jira_base_url → jira_url, then drop the alias key
  if(!S.cfg.jira_url && S.cfg.jira_base_url) S.cfg.jira_url = S.cfg.jira_base_url;
  delete S.cfg.jira_base_url;

  // Strip phantom 7th sprints (e.g. 26.2.7 = Mar 26–31) left over from older defaults.
  // Identify them by a sprint id ending in `.7` AND a duration shorter than a real 14-day sprint.
  if(Array.isArray(S.cfg.sprint_calendar) && S.cfg.sprint_calendar.length){
    S.cfg.sprint_calendar = S.cfg.sprint_calendar.filter(s=>{
      if(!s || !s.sprint || !/\.7$/.test(s.sprint)) return true;
      if(!s.start || !s.end) return true;
      const ms = new Date(s.end+'T00:00:00Z') - new Date(s.start+'T00:00:00Z');
      const days = ms / 86400000;
      return days >= 13; // real 2-week sprint stays, short stubs get dropped
    });
  }

  // Backfill pmr_roadmap on configs saved before the Integrated Roadmap feature.
  // Keeps existing deselections / manual edits intact on re-loads.
  // Year defaults come from the current date so a fresh install in a new
  // calendar year auto-targets the right range.
  const nowYear = new Date().getFullYear();
  const defaultSlide = {
    id: 'overview',
    title: 'Integrated Milestone Roadmap',
    mode: 'months', year: nowYear,
    rangeStart: nowYear + '-01', rangeEnd: nowYear + '-12',
    tiers: ['T0','T1','T2','T3'],
    emphasizeTier: 'T1'
  };
  if(!S.cfg.pmr_roadmap || typeof S.cfg.pmr_roadmap !== 'object'){
    S.cfg.pmr_roadmap = {
      enabled: true,
      slides: [ Object.assign({}, defaultSlide) ],
      milestones: [],
      seedVersion: 0
    };
  } else {
    // Field-level backfill for partial configs
    const r = S.cfg.pmr_roadmap;
    if(typeof r.enabled !== 'boolean') r.enabled = true;
    if(!Array.isArray(r.slides) || !r.slides.length){
      r.slides = [ Object.assign({}, defaultSlide) ];
    }
    if(!Array.isArray(r.milestones)) r.milestones = [];
    if(typeof r.seedVersion !== 'number') r.seedVersion = 0;
    // Normalize each milestone to have a _userEdited tracker for sticky
    // field overrides (added after v8.36 shipped without it).
    r.milestones.forEach(m => {
      if(!m._userEdited || typeof m._userEdited !== 'object') m._userEdited = {};
    });
  }
}
function cfgSetRole(idx, field, val){
  if(!S.cfg.roles[idx]) S.cfg.roles[idx]={role:'',name:'',id:''};
  S.cfg.roles[idx][field]=val;
}

// Populate all form fields from S.cfg (called on nav to config + after import)
function populateConfigFields(){
  _migrateCfg();
  function setVal(id,val){ const el=document.getElementById(id); if(el&&val!==undefined) el.value=val||''; }
  setVal('cfg-jira-url', S.cfg.jira_url||'');
  // Sprint Metrics / Cover
  setVal('cfg-class-high',   S.cfg.classification_highest||'');
  setVal('cfg-class-actual', S.cfg.classification||'');
  setVal('cfg-rpt-title',    S.cfg.sprint_report_title||'Agile Acquisition Sprint Package');
  setVal('cfg-cover-title',  S.cfg.sprint_cover_title||'Agile Acquisition Sprint Comprehensive Plan');
  // Prepared For
  setVal('cfg-pfor-name', S.cfg.prepared_for_name||S.cfg.prepared_for||'');
  setVal('cfg-pfor-addr1', S.cfg.prepared_for_addr1||'');
  setVal('cfg-pfor-addr2', S.cfg.prepared_for_addr2||'');
  setVal('cfg-pfor-csz',   S.cfg.prepared_for_csz||'');
  // Prepared By
  setVal('cfg-pby-name',  S.cfg.prepared_by_name||'');
  setVal('cfg-pby-org',   S.cfg.prepared_by_org||S.cfg.prepared_by_name||'');
  setVal('cfg-pby-addr1', S.cfg.prepared_by_addr1||'');
  setVal('cfg-pby-addr2', S.cfg.prepared_by_addr2||'');
  setVal('cfg-pby-csz',   S.cfg.prepared_by_csz||'');
  // Contract
  setVal('cfg-bt',       S.cfg.bt_do_line||'');
  setVal('cfg-rpt-num',  S.cfg.report_number||'');
  setVal('cfg-contract', S.cfg.contract_number||'');
  setVal('cfg-cdrl',         S.cfg.cdrl_number||'');
  setVal('cfg-did',          S.cfg.did_numbers||'');
  setVal('cfg-num-plan',     S.cfg.num_plan||'');
  setVal('cfg-num-report',   S.cfg.num_report||'');
  setVal('cfg-num-stories',  S.cfg.num_stories||'');
  setVal('cfg-num-incident', S.cfg.num_incident||'');
  // EOS AI prompt
  const aiEn = document.getElementById('cfg-eos-ai-enabled');
  if (aiEn) aiEn.checked = S.cfg.eos_ai_prompt_enabled !== false;
  setVal('cfg-eos-ai-prompt', S.cfg.eos_ai_prompt || '');
  // Roles
  const roles=S.cfg.roles||[];
  setVal('cfg-po-name', roles[0]?.name||''); setVal('cfg-po-id', roles[0]?.id||'');
  setVal('cfg-tl-name', roles[1]?.name||''); setVal('cfg-tl-id', roles[1]?.id||'');
  setVal('cfg-ga-name', roles[2]?.name||''); setVal('cfg-ga-id', roles[2]?.id||'');
  // Blurbs
  const blurbs=S.cfg.schedule_blurbs||[];
  ['sb1','sb2','sb3','sb4'].forEach((id,i)=>setVal(id, blurbs[i]||''));
  // Release labels
  setVal('cfg-ga-release-lbl',   S.cfg.graph_analytics_release_label||'');
  setVal('cfg-ga-release-blurb', S.cfg.graph_analytics_blurb||'');
  setVal('cfg-afx-release-lbl',  S.cfg.afx_release_label||'');
  // Seed sprint calendar with defaults only when completely empty (not when user has a small calendar)
  if(S.cfg.sprint_calendar.length===0){
    S.cfg.sprint_calendar=DEFAULT_SPRINT_CALENDAR.map(s=>({...s}));
  }
  renderClassPresets();
  // Render tag boxes (safe to call repeatedly)
  renderTagBox('tags-backend','backend_components');
  renderTagBox('tags-userfacing','user_facing_components');
  renderTagBox('tags-always-labels','always_include_labels');
  renderTagBox('tags-exclkw','excluded_summary_keywords');
  renderTagBox('tags-pmr-features','pmr_feature_types');
  renderTagBox('tags-pmr-bugs','pmr_bug_types');
}

// ── Classification preset chips (renders into two fields: highest + actual)
function renderClassPresets(){
  const PRESET_DEFAULTS=['(U) UNCLASSIFIED','(U//FOUO) CUI','(S) SECRET','(TS) TOP SECRET','(TS//SCI)'];
  // Seed only if the key is completely absent (first-run / pre-migration configs)
  if(!S.cfg.classification_presets) S.cfg.classification_presets=[...PRESET_DEFAULTS];
  // Derive entirely from the user's saved list — do not force-merge hardcoded defaults
  const allPresets=S.cfg.classification_presets||[];
  const chip=(preset,targetId,cfgKey)=>`<button class="btn btn-ghost btn-xs" style="font-family:var(--mono);font-size:10px;padding:2px 8px" onclick="document.getElementById('${targetId}').value='${esc(preset)}';cfgSet('${cfgKey}','${esc(preset)}');autoSaveCfg()">${esc(preset)}</button>`;
  const high=document.getElementById('class-presets-high');
  const actual=document.getElementById('class-presets-actual');
  if(high)   high.innerHTML=allPresets.map(p=>chip(p,'cfg-class-high','classification_highest')).join('');
  if(actual) actual.innerHTML=allPresets.map(p=>chip(p,'cfg-class-actual','classification')).join('');
}

// ── Field mapping
function renderFieldMapRows(){
  const el=document.getElementById('field-map-rows'); if(!el) return;
  const map=S.cfg.field_map||[];
  el.innerHTML=map.map((m,i)=>`
    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:5px">
      <input type="text" value="${esc(m.raw)}" placeholder="e.g. Custom field (Epic Name)" style="font-size:var(--fs-xs)" onchange="S.cfg.field_map[${i}].raw=this.value;autoSaveCfg()">
      <input type="text" value="${esc(m.canonical)}" placeholder="e.g. Epic Name" style="font-size:var(--fs-xs)" onchange="S.cfg.field_map[${i}].canonical=this.value;autoSaveCfg()">
      <button class="btn btn-red btn-xs" onclick="S.cfg.field_map.splice(${i},1);renderFieldMapRows();autoSaveCfg()">✕</button>
    </div>`).join('');
}

function addFieldMapRow(){
  if(!S.cfg.field_map) S.cfg.field_map=[];
  S.cfg.field_map.push({raw:'',canonical:''});
  renderFieldMapRows();
}

function addDefaultFieldMaps(){
  if(!S.cfg.field_map) S.cfg.field_map=[];
  const defaults=[
    {raw:'Custom field (Epic Name)',canonical:'Epic Name'},
    {raw:'Custom field (Epic Link)',canonical:'Epic Link'},
    {raw:'Custom field (Story Points)',canonical:'Story Points'},
    {raw:'Custom field (Sprint)',canonical:'Sprint'},
    {raw:'Story point estimate',canonical:'Story Points'},
    {raw:'Epic Name',canonical:'Epic Name'},
    {raw:'Epic Link',canonical:'Epic Link'},
  ];
  defaults.forEach(d=>{
    if(!S.cfg.field_map.some(m=>m.raw===d.raw)) S.cfg.field_map.push(d);
  });
  renderFieldMapRows();
  autoSaveCfg();
}

// ── Sprint prefix rows
function renderSprintPrefixRows(){
  const el=document.getElementById('sprint-prefix-rows'); if(!el) return;
  const prefixes=S.cfg.sprint_prefixes||[];
  el.innerHTML=prefixes.map((p,i)=>`
    <div style="display:flex;gap:6px;margin-bottom:5px;align-items:center">
      <input type="text" value="${esc(p)}" placeholder="e.g. DX" style="width:120px;font-size:var(--fs-xs)" onchange="S.cfg.sprint_prefixes[${i}]=this.value">
      <button class="btn btn-red btn-xs" onclick="S.cfg.sprint_prefixes.splice(${i},1);renderSprintPrefixRows()">✕</button>
    </div>`).join('');
}

function addSprintPrefixRow(){
  if(!S.cfg.sprint_prefixes) S.cfg.sprint_prefixes=[];
  S.cfg.sprint_prefixes.push('');
  renderSprintPrefixRows();
}

