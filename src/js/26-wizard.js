// ============================================================
// WIZARD ENGINE
// ============================================================

// Canonical report type identifiers — all magic strings should reference these.
// WIZARDS, DRAFT_LS_KEYS, PAGE_TITLES, and switch-like if/else chains all use these values.
const REPORT_TYPES = Object.freeze({
  WEEKLY:  'weekly',
  EOS:     'eos',
  PMR:     'pmr',
  SPRINT:  'sprint',
  SPIN:    'spin',
  BATCH:   'batch',
});

const WIZARDS = {
  weekly: {
    name: 'Weekly Digest',
    icon: mi(APP_ICONS.weekly),
    steps: ['Files', 'Date Range', 'Report'],
    panels: ['wiz-weekly-upload', 'wiz-weekly-params', 'wiz-weekly-report'],
  },
  eos: {
    name: 'End of Sprint',
    icon: mi(APP_ICONS.eos),
    steps: ['Files', 'Sprints', 'Report'],
    panels: ['wiz-eos-upload', 'wiz-eos-params', 'wiz-eos-report'],
  },
  pmr: {
    name: 'PMR',
    icon: mi(APP_ICONS.pmr),
    steps: ['Files', 'Month', 'Report'],
    panels: ['wiz-pmr-upload', 'wiz-pmr-params', 'wiz-pmr-report'],
  },
  sprint: {
    name: 'Sprint Plan/Report',
    icon: mi(APP_ICONS.sprint),
    steps: ['Files', 'Report'],
    panels: ['wiz-sprint-upload', 'wiz-sprint-report'],
  },
  batch: {
    name: 'Run All Reports',
    icon: mi(APP_ICONS.weekly),
    steps: ['Choose Reports & Params', 'All Reports'],
  },
  spin: {
    name: 'Spin Plan',
    icon: mi(APP_ICONS.spin),
    steps: ['Files', 'Report'],
    panels: ['wiz-spin-upload', 'wiz-spin-report'],
  },
  velocity: {
    name: 'Sprint Velocity',
    icon: mi(APP_ICONS.velocity),
    steps: ['Files', 'Report'],
    panels: ['wiz-velocity-upload', 'wiz-velocity-report'],
  },
};

let _activeWizard = null;
let _activeStep = 0;

function startWizard(type) {
  console.log('[startWizard] type:', type);
  _activeWizard = type;
  const wiz = WIZARDS[type];
  const hasIssues = !!(S.files.issues && S.files.issues.length);
  const hasEpics  = !!(S.files.epics  && S.files.epics.length);
  const isTwoStep = wiz.steps.length === 2;
  const needsEpics = type !== 'sprint' && type !== 'spin';
  const filesReady = hasIssues && (!needsEpics || hasEpics);
  // Skip upload step if all required files already loaded (not for batch which has no upload)
  _activeStep = (filesReady && !isTwoStep && type !== 'batch') ? 1 : 0;
  S.currentPage = type;
  document.getElementById('wiz-title').innerHTML = wiz.icon + '&nbsp;&nbsp;' + esc(wiz.name);
  renderWizardSteps(wiz.steps, _activeStep);
  renderWizardContent(type, _activeStep);
  if (filesReady && isTwoStep && type !== 'batch') {
    setTimeout(function() {
      const runners = {sprint:runSprint, spin:runSpin, velocity:(typeof runVelocity==='function'?runVelocity:null)};
      const runner = runners[type];
      if (runner) runner();
    }, 0);
  }
  document.getElementById('home').classList.add('hidden');
  document.getElementById('wizard').classList.add('active');
}


function openSpinDashboard() {
  // Always go to spin wizard; startWizard handles skip logic
  startWizard('spin');
}


// Returns the previous calendar month as "YYYY-MM" — used in both batch and wizard PMR param init.
function prevMonthYYYYMM(){
  const d=new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()-1);
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
}

// ── Month picker state + helpers ─────────────────────────────────────────────
const _mmp = { year: new Date().getUTCFullYear(), selected: null };

function buildMonthPicker() {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const curYYYYMM = now.getUTCFullYear() + '-' + String(now.getUTCMonth()+1).padStart(2,'0');
  const yr = _mmp.year || now.getUTCFullYear();
  let cells = '';
  for (let m = 0; m < 12; m++) {
    const val = yr + '-' + String(m+1).padStart(2,'0');
    const isFuture  = val > curYYYYMM;
    const isSelected = val === _mmp.selected;
    const isCurrent  = val === curYYYYMM;
    let cls = 'mmp-cell';
    if (isFuture)   cls += ' mmp-future';
    if (isSelected) cls += ' mmp-selected';
    if (isCurrent && !isSelected) cls += ' mmp-current';
    const click = isFuture ? '' : `onclick="mmpSelect('${val}','${MONTHS[m]} ${yr}')"`;
    cells += `<div class="${cls}" ${click}>${MONTHS[m]}</div>`;
  }
  const sel = _mmp.selected || '';
  const selLabel = sel ? (()=>{ const [y,m]=sel.split('-').map(Number); return MONTHS[m-1]+' '+y; })() : 'Select a month';
  return `
<input type="hidden" id="pmr-month-sel" value="${esc(sel)}">
<div class="mmp-wrap">
  <div class="mmp-header">
    <button class="btn btn-ghost btn-sm" onclick="mmpNav(-1)" style="padding:2px 8px">&lsaquo;</button>
    <span style="font-weight:600;font-size:var(--fs-sm);color:var(--tx)">${yr}</span>
    <button class="btn btn-ghost btn-sm" onclick="mmpNav(1)" style="padding:2px 8px">&rsaquo;</button>
  </div>
  <div class="mmp-grid" id="mmp-grid">${cells}</div>
  <div style="margin-top:8px;font-size:var(--fs-xs);color:var(--mu);text-align:center" id="mmp-label">${esc(selLabel)}</div>
</div>`;
}

function mmpSelect(val, label) {
  _mmp.selected = val;
  // Update hidden input
  const inp = document.getElementById('pmr-month-sel');
  if (inp) inp.value = val;
  // Update label
  const lbl = document.getElementById('mmp-label');
  if (lbl) lbl.textContent = label || val;
  // Update cell highlight — re-render grid if present, else just toggle classes
  const grid = document.getElementById('mmp-grid');
  if (grid) {
    grid.querySelectorAll('.mmp-cell').forEach(el => {
      el.classList.remove('mmp-selected');
    });
    // Find the cell whose onclick contains this val
    grid.querySelectorAll('.mmp-cell').forEach(el => {
      if ((el.getAttribute('onclick')||'').includes(`'${val}'`)) {
        el.classList.add('mmp-selected');
      }
    });
  }
}

function mmpNav(dir) {
  _mmp.year = (_mmp.year || new Date().getUTCFullYear()) + dir;
  // Re-render the grid in place
  const grid = document.getElementById('mmp-grid');
  const wrap = grid && grid.closest('.mmp-wrap');
  if (!wrap) return;
  // Replace the whole mmp-wrap content
  const container = wrap.parentElement;
  const hiddenInp = document.getElementById('pmr-month-sel');
  const curVal = hiddenInp ? hiddenInp.value : (_mmp.selected || '');
  _mmp.selected = curVal || _mmp.selected;
  // Re-render inline
  const tmpDiv = document.createElement('div');
  tmpDiv.innerHTML = buildMonthPicker();
  wrap.parentElement.replaceChild(tmpDiv.firstElementChild, wrap);
}

function runBatchReports() {
  console.log('[Batch] runBatchReports fired');
  rebuildTickets(); // ensure allTickets is current before runners check it
  const doWeekly = !!(document.getElementById('batch-weekly')?.checked);
  const doEOS    = !!(document.getElementById('batch-eos')?.checked);
  const doSprint = !!(document.getElementById('batch-sprint')?.checked);
  const doPMR    = !!(document.getElementById('batch-pmr')?.checked);

  const p = S._wizParams || {};
  // Weekly: read from date range picker state
  const _bwk = DRP.get('batch-wk');
  p.wStart = _bwk.start || p.wStart || '';
  p.wEnd   = _bwk.end   || p.wEnd   || '';
  // EOS: read from batch select elements
  const _beosCur = (document.getElementById('batch-eos-cur')?.value || '').trim();
  const _beosFut = (document.getElementById('batch-eos-fut')?.value || '').trim();
  if (_beosCur) p.eosCur = _beosCur;
  if (_beosFut) p.eosFut = _beosFut;
  // PMR: use _mmp.selected, fall back to previous month if not set
  const _mmpVal = (_mmp && _mmp.selected) || prevMonthYYYYMM();
  if (_mmpVal) {
    const parts = _mmpVal.split('-').map(Number);
    const yr = parts[0], mo = parts[1];
    p.pmrStart = yr + '-' + String(mo).padStart(2,'0') + '-01';
    const lastDay = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    p.pmrEnd  = yr + '-' + String(mo).padStart(2,'0') + '-' + String(lastDay).padStart(2,'0');
    p.pmrMonth = _mmpVal;
    if (_mmp) _mmp.selected = _mmpVal; // sync picker state
  }
  S._wizParams = p;

  // Snapshot all param values NOW while step 0 DOM still exists
  const _snap = {
    doWeekly: doWeekly, doEOS: doEOS, doSprint: doSprint, doPMR: doPMR,
    wStart: p.wStart, wEnd: p.wEnd,
    eosCur: p.eosCur, eosFut: p.eosFut,
    pmrStart: p.pmrStart, pmrEnd: p.pmrEnd, pmrMonth: p.pmrMonth,
    hasTickets: !!(S.allTickets && S.allTickets.length)
  };

  _activeStep = 1;
  renderWizardSteps(WIZARDS['batch'].steps, 1);
  renderWizardContent('batch', 1);

  // Defer until DOM has painted the new step content
  setTimeout(function() {
  const bar  = document.getElementById('batch-output-bar');
  const body = document.getElementById('batch-output-body');
  if (!bar || !body) { console.error('[Batch] output containers not found after render'); return; }

  const reports = [];
  if (_snap.doWeekly) reports.push({key:'weekly', label:'Weekly Digest',    runner:runWeekly,  outId:'weekly-output'});
  if (_snap.doEOS)    reports.push({key:'eos',    label:'End of Sprint',    runner:runEOS,     outId:'eos-output'});
  if (_snap.doSprint) reports.push({key:'sprint', label:'Sprint Plan',      runner:runSprint,  outId:'sprint-output'});
  if (_snap.doPMR)    reports.push({key:'pmr',    label:'PMR',              runner:runPMR,     outId:'pmr-output'});

  if (!reports.length) { body.innerHTML = '<div class="nstr">No reports selected.</div>'; return; }

  bar.innerHTML = reports.map((r,i) =>
    '<button class="btn ' + (i===0?'btn-primary':'btn-ghost') + ' btn-sm" id="btab-' + r.key + '" onclick="switchBatchTab(\'' + r.key + '\')">' + r.label + '</button>'
  ).join('');

  body.innerHTML = reports.map((r,i) =>
    '<div id="batch-panel-' + r.key + '" style="display:' + (i===0?'block':'none') + '"><div id="' + r.outId + '"></div></div>'
  ).join('');

  setTimeout(function() {
    reports.forEach(function(r) {
      try { r.runner(); } catch(e) {
        const el = document.getElementById(r.outId);
        if (el) el.innerHTML = '<div class="card lr"><div class="card-title" style="color:var(--a5)">Error</div><div>' + esc(String(e)) + '</div></div>';
      }
    });
  }, 0);
  }, 50); // end outer setTimeout — wait for DOM
}

function switchBatchTab(key) {
  document.querySelectorAll('[id^="btab-"]').forEach(function(b) {
    b.className = b.id === 'btab-' + key ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
  });
  document.querySelectorAll('[id^="batch-panel-"]').forEach(function(p) {
    p.style.display = p.id === 'batch-panel-' + key ? 'block' : 'none';
  });
}


function openDepsDashboard() {
  // If spin not loaded, try restoring from cache first
  if (!S.spin || !S.spin.issues || !S.spin.issues.length) {
    const cached = loadSpinFromStorage();
    if (cached) {
      initSpinFromStorage();
      // Give the engine a moment to process
      setTimeout(openDepsDashboard, 100);
      return;
    }
    // No data and no cache — show upload prompt inside modal
    let overlay = document.getElementById('deps-dashboard-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'deps-dashboard-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
      overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.style.display='none'; });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '<div style="background:var(--s2);border:1px solid var(--bd2);border-radius:var(--r);width:min(520px,92vw);padding:32px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">' +
      '<span class="mi" style="font-size:36px;color:var(--mu)">upload_file</span>' +
      '<div style="font-weight:700;font-size:var(--fs-base);color:var(--tx)">Load a Spin Plan CSV</div>' +
      '<div style="font-size:var(--fs-sm);color:var(--mu)">Drop your roadmap / spin plan CSV onto the header drop zone, then open Dependencies again.</div>' +
      '<label class="btn btn-primary" style="cursor:pointer"><span class="mi" style="font-size:14px;margin-right:4px">upload_file</span>Browse CSV' +
      '<input type="file" accept=".csv" style="display:none" onchange="handleMultiCsvDrop(this.files);this.value=\'\';closeDepsDashboard();setTimeout(openDepsDashboard,400)"></label>' +
      '<button onclick="closeDepsDashboard()" style="background:none;border:none;color:var(--mu);cursor:pointer;font-size:var(--fs-sm)">Cancel</button>' +
      '</div>';
    overlay.style.display = 'flex';
    return;
  }

  // Build or reuse the standalone deps overlay
  let overlay = document.getElementById('deps-dashboard-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'deps-dashboard-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
    overlay.innerHTML =
      '<div style="background:var(--s2);border:1px solid var(--bd2);border-radius:var(--r);width:min(900px,95vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--bd);flex-shrink:0">' +
          '<span style="font-size:15px;font-weight:700;color:var(--tx)">Dependencies</span>' +
          '<span class="u-muted-xs" id="deps-dash-sub"></span>' +
          '<div style="flex:1"></div>' +
          '<button onclick="closeDepsDashboard()" ' +
            'style="background:none;border:none;color:var(--mu);cursor:pointer;font-size:18px;line-height:1;padding:2px 6px">' +
            '<span class="mi">close</span></button>' +
        '</div>' +
        '<div style="overflow-y:auto;padding:14px 18px;flex:1" id="deps-dash-body"></div>' +
      '</div>';
    // Close on backdrop click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
    document.body.appendChild(overlay);
  }

  overlay.style.display = 'flex';
  const body = document.getElementById('deps-dash-body');
  const sub  = document.getElementById('deps-dash-sub');

  // Count open deps for subtitle
  const epicNodes = Object.values(S.spin._nodeMap || {})
    .filter(n => spinClassifyLevel(n.issue.issueType) === 'epic');
  const openCount = epicNodes.reduce((sum, n) => {
    const deps = spinGatherDeps(n);
    return sum + deps.blockedBy.filter(d =>
      !spinIsDone(d.status) && !S.spin.depClosed[n.issue.key + '_' + d.key]
    ).length;
  }, 0);
  if (sub) sub.textContent = openCount + ' open';
  if (body) body.innerHTML = renderSpinUnifiedDeps('open');
}

function closeDepsDashboard() {
  var o = document.getElementById("deps-dashboard-overlay");
  if (o) o.style.display = "none";
}

function exitWizard() {
  document.getElementById('wizard').classList.remove('active');
  document.getElementById('home').classList.remove('hidden');
  _activeWizard = null;
  _activeStep = 0;
  S.currentPage = 'files';
  S._wizParams = {};
}

function renderWizardSteps(steps, activeIdx) {
  const el = document.getElementById('wiz-steps');
  if(!el) return;
  el.innerHTML = steps.map((s, i) => {
    const cls = i < activeIdx ? 'ws-item done' : i === activeIdx ? 'ws-item active' : 'ws-item';
    const sep = i < steps.length - 1 ? '<span class="ws-sep">›</span>' : '';
    return `<div class="${cls}" onclick="goWizardStep(${i})">
      <div class="ws-num">${i < activeIdx ? '✓' : i + 1}</div>
      <span>${esc(s)}</span>
    </div>${sep}`;
  }).join('');
}

function goWizardStep(idx) {
  if (!_activeWizard) return;
  const wiz = WIZARDS[_activeWizard];
  // Only allow going back or to completed steps
  if (idx > _activeStep) return;
  _activeStep = idx;
  renderWizardSteps(wiz.steps, idx);
  renderWizardContent(_activeWizard, idx);
}

function wizNext() {
  if (!_activeWizard) return;
  const wiz = WIZARDS[_activeWizard];
  if (_activeStep < wiz.steps.length - 1) {
    _activeStep++;
    renderWizardSteps(wiz.steps, _activeStep);
    renderWizardContent(_activeWizard, _activeStep);
  }
}

function wizBack() {
  // Close any open spin panels before navigating
  var dp = document.getElementById('spin-global-drill');
  if(dp) dp.style.display = 'none';
  var pp = document.getElementById('spin-prefs-panel');
  if(pp) pp.style.display = 'none';
  if (_activeStep > 0) goWizardStep(_activeStep - 1);
  else exitWizard();
}

function renderWizardContent(type, step) {
  console.log('[renderWizardContent] type:', type, 'step:', step);
  const el = document.getElementById('wiz-content');
  el.innerHTML = getWizardStepHTML(type, step);
  // Re-init any inputs
  if (type === 'weekly' && step === 1) {
    const p = S._wizParams || {};
    const defEnd   = new Date().toISOString().slice(0,10);
    const defStart = new Date(Date.now()-7*864e5).toISOString().slice(0,10);
    initDateRangePicker(p.wStart || defStart, p.wEnd || defEnd);
  }
  if (type === 'eos' && step === 1) populateEOSSprints();
  // sprint has no step 1 — goes directly upload → report
  if (type === 'spin' && step === WIZARDS['spin'].steps.length - 1) {
    setTimeout(function() { populateSpinPrefsUI(); }, 0);
  }
  // Batch: init date picker immediately (synchronous) + other pickers after paint
  if (type === 'batch' && step === 0) {
    // Seed _drp immediately so params are ready when Run is clicked
    const _batchP = S._wizParams || {};
    const _bDefEnd   = new Date().toISOString().slice(0,10);
    const _bDefStart = new Date(Date.now()-7*864e5).toISOString().slice(0,10);
    DRP.init('batch-wk', _batchP.wStart || _bDefStart, _batchP.wEnd || _bDefEnd);
    setTimeout(function() {
      const now = new Date();
      const p = S._wizParams || {};
      // PMR: auto-select previous month
      const val = (p.pmrMonth) || prevMonthYYYYMM();
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const [myr,mmo] = val.split('-').map(Number);
      mmpSelect(val, MONTHS[mmo-1] + ' ' + myr);
      // EOS: pre-select sprints
      const cal = S.cfg.sprint_calendar || [];
      const today = new Date().toISOString().slice(0,10);
      const curIdx = cal.findIndex(s => s.start <= today && today <= s.end);
      const cur = cal[curIdx]; const prev = cal[curIdx-1];
      if (prev) { const elc = document.getElementById('batch-eos-cur'); if(elc) elc.value = p.eosCur || prev.sprint; }
      if (cur)  { const elf = document.getElementById('batch-eos-fut'); if(elf) elf.value = p.eosFut || cur.sprint; }
    }, 50);
  }
  if (type === 'pmr' && step === 1) {
    const p = S._wizParams || {};
    const now = new Date();
    _mmp.year = now.getFullYear();
    _mmp.selected = null;
    setTimeout(()=>{
      if(p.pmrMonth){
        const [yr,mo] = p.pmrMonth.split('-').map(Number);
        _mmp.year = yr;
        const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        mmpSelect(p.pmrMonth, months[mo-1]+' '+yr);
      }
    }, 0);
  }
}

// ── Wizard: inline recent-draft panel for the Files step ────────────────────
// Reads localStorage for drafts of this report type and renders them as
// clickable entries. No file picker — everything comes from auto-saved drafts.
function buildWizardRecentDraft(type) {
  const draft = loadDraftFromStorage(type);
  if (!draft || !draft.wizParams || !Object.keys(draft.wizParams).length) {
    return '<div class="u-dim-xs">No saved draft yet. Generate a report to save one automatically.</div>';
  }

  const wp = draft.wizParams;
  const paramStr = _draftParamSummary(type, wp);
  const dt = draft.ts
    ? new Date(draft.ts).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
    : '';
  const fieldCount = Object.keys(draft.fields||{}).length + Object.keys(draft.pmrBluf||{}).length;

  // File badges
  let fileBadges = '';
  if (draft.issuesFile) {
    fileBadges += '<span style="font-family:var(--mono);font-size:10px;background:var(--s4);border:1px solid var(--bd);border-radius:3px;padding:1px 6px;color:var(--mu);display:inline-block;margin-right:4px;margin-top:4px">' + esc(draft.issuesFile) + '</span>';
  }
  if (draft.epicsFile) {
    fileBadges += '<span style="font-family:var(--mono);font-size:10px;background:var(--s4);border:1px solid var(--bd);border-radius:3px;padding:1px 6px;color:var(--mu);display:inline-block;margin-right:4px;margin-top:4px">' + esc(draft.epicsFile) + '</span>';
  }

  // Pre-register the draft so generateFromDraft() can find it immediately
  S._pendingDraft = S._pendingDraft || {};
  S._pendingDraft[type] = draft;

  return `<div style="border:1px solid var(--bd2);border-radius:var(--r2);overflow:hidden">
  <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--s3)">
    <span class="mi" style="font-size:15px;color:var(--a1);flex-shrink:0;margin-top:1px">draft</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:var(--fs-sm);font-weight:600;color:var(--tx)">${paramStr || 'Last session'}</div>
      <div style="font-size:var(--fs-xs);color:var(--mu);margin-top:2px">${fieldCount} field${fieldCount!==1?'s':''} saved&ensp;&middot;&ensp;${dt}</div>
      ${fileBadges ? '<div style="margin-top:3px">' + fileBadges + '</div>' : ''}
    </div>
    <button class="btn btn-primary btn-sm" style="flex-shrink:0" onclick="generateFromDraft('${type}')">
      <span class="mi" style="font-size:13px;margin-right:3px">play_arrow</span>Generate from Draft
    </button>
  </div>
  <div style="padding:6px 12px;font-size:var(--fs-xs);color:var(--mu);border-top:1px solid var(--bd)">Skips the parameters step — uses saved settings. Load your CSVs first.</div>
</div>`;
}

function getWizardStepHTML(type, step) {
  console.log('[getWizardStepHTML] type:', type, 'step:', step);
  const hasIssues = !!(S.files.issues && S.files.issues.length);
  const hasEpics = !!(S.files.epics && S.files.epics.length);

  // ── STEP 0: Upload ────────────────────────────────────────
  if (step === 0 && type !== 'batch') {
    const needsEpics = type !== 'sprint' && type !== 'spin';
    const issuesLabel = hasIssues ? (S.files.issues.length + ' issues loaded') : '';
    const epicsLabel  = hasEpics  ? (S.files.epics.length  + ' epics loaded')  : '';
    const statusLine  = [issuesLabel, epicsLabel].filter(Boolean).join(' &middot; ');
    const subLine = statusLine
      ? '<div class="fz-sub" style="color:var(--a3);margin-top:3px">' + statusLine + '</div>'
      : '<div class="fz-sub">' + (type === 'spin' ? 'Single CSV export from Jira Plans / Roadmap' : needsEpics ? 'issues &amp; epics CSVs' : 'jira_issues_master.csv') + '</div>';
    const dropFn = 'handleMultiCsvDrop(event.dataTransfer.files)';
    const changeFn = 'handleMultiCsvDrop(this.files);this.value=\'\''; 
    const zoneLabel = hasIssues ? 'Data loaded &mdash; click or drop to replace' : (type === 'spin' ? 'Select or drop Jira Plan CSV here' : needsEpics ? 'Select or drop CSV files here' : 'Select or drop Issues CSV here');
    const nextStep = esc(WIZARDS[type].steps.length > 2 ? WIZARDS[type].steps[2] : WIZARDS[type].steps[1]);
    // 2-step wizards go directly to report generation; 3-step wizards go to params first
    const isTwoStep = WIZARDS[type].steps.length === 2;
    const nextAction = isTwoStep ? 'runReportAndAdvance(\'' + type + '\')' : 'wizNext()';
    const nextBtn = hasIssues
      ? '<button class="btn btn-primary" onclick="' + nextAction + '">' + nextStep + ' &rarr;</button>'
      : '<button class="btn btn-primary" style="opacity:.5;cursor:not-allowed" onclick="alert(\'Load the Issues CSV first.\')">'+nextStep+' &rarr;</button>';
    // Build loaded file names
    let loadedFilesHtml = '';
    if (S._fileRegistry && Object.keys(S._fileRegistry).length) {
      loadedFilesHtml = Object.entries(S._fileRegistry).map(function(e) {
        const fname = e[0], meta = e[1];
        return '<div style="font-family:var(--mono);font-size:var(--fs-xs);color:var(--a3);margin-top:2px">' +
          esc(fname) + ' <span style="color:var(--mu)">(' + meta.rows.length + ' rows)</span></div>';
      }).join('');
    } else if (hasIssues && S.fileNames && S.fileNames.issues) {
      loadedFilesHtml = '<div style="font-family:var(--mono);font-size:var(--fs-xs);color:var(--a3);margin-top:2px">' + esc(S.fileNames.issues) + '</div>';
      if (needsEpics && S.fileNames.epics) {
        const cacheNote = S.fileNames._epicsFromCache ? ' <span style="color:var(--mu)">(cached)</span>' : '';
        loadedFilesHtml += '<div style="font-family:var(--mono);font-size:var(--fs-xs);color:var(--a3);margin-top:1px;display:flex;align-items:center;gap:8px">' +
          esc(S.fileNames.epics) + cacheNote +
          ' <button onclick="clearEpicsFromStorage();renderWizardContent(_activeWizard,0)" style="font-size:10px;padding:1px 6px;border-radius:3px;border:1px solid var(--bd2);background:var(--s4);color:var(--mu);cursor:pointer">Replace</button></div>';
      }
    }

    return `
<div style="max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:10px">

  <!-- CARD 1: Load Jira Data -->
  <div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);padding:18px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <span class="mi" style="font-size:18px;color:${hasIssues ? 'var(--a3)' : 'var(--mu)'}">folder_open</span>
      <span style="font-weight:600;font-size:var(--fs-base);color:var(--tx)">Load Jira Data</span>
      ${hasIssues ? '<span style="margin-left:auto;font-size:var(--fs-xs);color:var(--a3)">✓ Loaded</span>' : ''}
    </div>
    <div class="fzone ${hasIssues ? 'loaded' : ''}"
         ondragover="event.preventDefault();this.classList.add('drag')"
         ondragleave="this.classList.remove('drag')"
         ondrop="event.preventDefault();this.classList.remove('drag');${dropFn}">
      <input type="file" accept=".csv" multiple onchange="${changeFn}">
      <div class="fz-ico">${hasIssues ? '<span class="mi" style="font-size:22px;color:var(--a3)">check_circle</span>' : '<span class="mi" style="font-size:22px">upload_file</span>'}</div>
      <div class="fz-name" style="${hasIssues ? 'color:var(--a3)' : ''}">${zoneLabel}</div>
      ${subLine}
    </div>
    ${loadedFilesHtml}
  </div>

  <!-- CARD 2: Continue Working -->
  <div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);padding:18px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <span class="mi" style="font-size:18px;color:var(--mu)">history</span>
      <span style="font-weight:600;font-size:var(--fs-base);color:var(--tx)">Continue Working</span>
    </div>
    ${buildWizardRecentDraft(type)}
  </div>

</div>

<div class="step-nav" style="margin-top:20px">
  <button class="btn btn-ghost btn-sm" onclick="exitWizard()"><span class="mi" style="font-size:14px;margin-right:3px">arrow_back</span>Home</button>
  <div class="spacer"></div>
  ${nextBtn}
</div>`;
  }
// ── STEP 1: Parameters ────────────────────────────────────
  if (step === 1 && step < WIZARDS[type].steps.length - 1) {
    let paramsHTML = '';
    if (type === 'weekly') {
      paramsHTML = buildDateRangePicker();
    } else if (type === 'eos') {
      paramsHTML = `
<div class="field-row">
  <div class="fl">Current Sprint</div>
  <div style="display:flex;gap:6px;align-items:center">
    <select id="eos-cur" style="flex:1"></select>
    <span class="u-muted-xs" id="eos-cur-dates"></span>
  </div>
</div>
<div class="field-row">
  <div class="fl">Future Sprint</div>
  <div style="display:flex;gap:6px;align-items:center">
    <select id="eos-fut" style="flex:1"></select>
    <span class="u-muted-xs" id="eos-fut-dates"></span>
  </div>
</div>
<div style="margin-top:6px;font-size:var(--fs-xs);color:var(--mu)">
  Selecting a current sprint auto-sets future to the next one. &nbsp;
  <a id="eos-sprint-more" href="#" style="display:none;color:var(--a1)" onclick="event.preventDefault();eosToggleShowAll()"></a>
</div>`;
    } else if (type === 'pmr') {
      paramsHTML = buildMonthPicker();

    }

    return `
<div class="pg-title">${esc(WIZARDS[type].steps[1])}</div>
<div class="card l1" style="margin-bottom:20px">
  ${paramsHTML}
</div>
<div class="step-nav">
  <button class="btn btn-ghost btn-sm" onclick="wizBack()"><span class="mi" style="font-size:14px;margin-right:3px">arrow_back</span>Back</button>
  <div class="spacer"></div>
  <button class="btn btn-primary" onclick="runReportAndAdvance('${type}')"><span class="mi" style="font-size:14px;margin-right:3px">play_arrow</span>Generate Report</button>
</div>`;
  }


  // ── BATCH step 0: pick reports + params ────────────────────
  if (type === 'batch' && step === 0) {
    console.log('[Batch step 0] S.files.issues:', S.files.issues ? S.files.issues.length + ' rows' : 'null');
    console.log('[Batch step 0] S.files.epics:', S.files.epics ? S.files.epics.length + ' rows' : 'null');
    const cal = S.cfg.sprint_calendar || [];
    const today = new Date().toISOString().slice(0,10);
    const sprintOpts = cal.map(s=>`<option value="${esc(s.sprint)}">${esc(s.sprint)}</option>`).join('');
    const hasIssues = !!(S.files.issues && S.files.issues.length);
    const hasEpics  = !!(S.files.epics  && S.files.epics.length);
    const filesOk = hasIssues; // epics optional — warn but don't block
    const warn = !hasIssues
      ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--s2);border:1px solid var(--a5b);border-left:3px solid var(--a5);border-radius:var(--r2);margin-bottom:12px">
          <span class="mi" style="font-size:18px;color:var(--a5);flex-shrink:0">error</span>
          <div style="flex:1">
            <div style="font-size:var(--fs-sm);font-weight:600;color:var(--a5);margin-bottom:2px">Issues CSV required</div>
            <div class="u-muted-xs">Drop your issues CSV onto the header drop zone before running.</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="exitWizard()" style="flex-shrink:0"><span class="mi" style="font-size:14px;margin-right:3px">arrow_back</span>Go load files</button>
        </div>`
      : !hasEpics
      ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--s2);border:1px solid var(--a4b);border-left:3px solid var(--a4);border-radius:var(--r2);margin-bottom:12px">
          <span class="mi" style="font-size:18px;color:var(--a4);flex-shrink:0">warning</span>
          <div style="flex:1">
            <div style="font-size:var(--fs-sm);font-weight:600;color:var(--a4);margin-bottom:2px">No epics CSV loaded</div>
            <div class="u-muted-xs">Topic routing in EOS and PMR will be limited. Drop your epics CSV to enable full matching.</div>
          </div>
        </div>`
      : '';
    return `
<div class="pg-title">Choose Reports &amp; Parameters</div>
${warn}
<div class="card l1" style="margin-bottom:12px">
  <div style="padding:0 0 12px">
    <div class="fl" class="u-section-hdr">Reports to run</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:var(--fs-sm)"><input type="checkbox" id="batch-weekly" checked> Weekly Digest</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:var(--fs-sm)"><input type="checkbox" id="batch-eos" checked> End of Sprint</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:var(--fs-sm)"><input type="checkbox" id="batch-sprint" checked> Sprint Plan/Report</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:var(--fs-sm)"><input type="checkbox" id="batch-pmr" checked> PMR</label>
    </div>
  </div>
  <div style="border-top:1px solid var(--bd);padding:12px 0 4px">
    <div class="fl" class="u-section-hdr">Weekly — Date Range</div>
    ${DRP.build('batch-wk', { startId:'batch-w-start', endId:'batch-w-end' })}
  </div>
  <div style="border-top:1px solid var(--bd);padding:12px 0">
    <div class="fl" class="u-section-hdr">EOS — Sprints</div>
    <div class="field-row">
      <div class="fl">Current Sprint</div>
      <select id="batch-eos-cur" style="flex:1"><option value="">select</option>${sprintOpts}</select>
    </div>
    <div class="field-row">
      <div class="fl">Future Sprint</div>
      <select id="batch-eos-fut" style="flex:1"><option value="">select</option>${sprintOpts}</select>
    </div>
  </div>
  <div style="border-top:1px solid var(--bd);padding:12px 0 4px">
    <div class="fl" class="u-section-hdr">PMR — Month</div>
    ${buildMonthPicker()}
  </div>
</div>
<div class="step-nav">
  <button class="btn btn-ghost btn-sm" onclick="exitWizard()"><span class="mi" style="font-size:14px;margin-right:3px">arrow_back</span>Home</button>
  <div class="spacer"></div>
  ${filesOk ? '<button class="btn btn-primary" onclick="runBatchReports()">Run Selected Reports &rarr;</button>' : '<button class="btn btn-primary" style="opacity:.45;cursor:not-allowed" onclick="alert(\'Load an Issues CSV first — use the drop zone in the header.\')">Run Selected Reports &rarr;</button>'}
</div>`;
  }

  // ── BATCH step 1: tabbed output ─────────────────────────────
  if (type === 'batch' && step === 1) {
    return `<div id="batch-output-bar" style="display:flex;gap:4px;padding:8px 0 4px;flex-wrap:wrap;border-bottom:1px solid var(--bd);margin-bottom:8px"></div>
<div id="batch-output-body"></div>`;
  }

  // ── LAST STEP: Report (step 1 for 2-step wizards, step 2 for 3-step) ──────────
  if (step === WIZARDS[type].steps.length - 1 && step >= 1) {
    const outputId = {weekly:'weekly-output',eos:'eos-output',pmr:'pmr-output',sprint:'sprint-output',spin:'spin-output',velocity:'velocity-output'};
    return `
<div id="${outputId[type]}"></div>
${type === 'sprint' ? `
<div style="margin-top:28px;padding-top:20px;border-top:2px solid var(--bd)">
  <div style="font-size:var(--fs-lg);font-weight:600;color:var(--tx);margin-bottom:5px">Sprint Delta</div>
  <div style="font-size:var(--fs-sm);color:var(--mu);margin-bottom:18px">Paste Jira Sprint Report text to identify mid-sprint additions and removals.</div>
  <div class="card l1" style="margin-bottom:14px">
    <div class="card-title">Paste Sprint Report Text</div>
    <textarea id="sd-paste" rows="8" placeholder="Ctrl+A on Jira Sprint Report page, Ctrl+C, paste here…" style="font-family:var(--mono);font-size:var(--fs-xs);line-height:1.7;min-height:140px"></textarea>
    <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
      <button class="btn btn-primary btn-sm" onclick="runSprintDelta()"><span class="mi" style="font-size:14px;margin-right:3px">analytics</span>Analyze</button>
      <button class="btn btn-ghost btn-sm" onclick="clearSprintDelta()"><span class="mi" style="font-size:13px;margin-right:2px">close</span>Clear</button>
      <span id="sd-parse-msg" class="u-muted-xs"></span>
    </div>
  </div>
  <div id="sd-output"></div>
</div>` : ''}`;
  }

  return '<div class="nstr">Unknown step.</div>';
}

function runReportAndAdvance(type) {
  const runners = {weekly: runWeekly, eos: runEOS, pmr: runPMR, sprint: runSprint, spin: runSpin, velocity: (typeof runVelocity==='function'?runVelocity:null)};
  const runner = runners[type];
  if (!runner) return;

  // Read all param values NOW, before re-rendering destroys the input elements
  if (type === 'weekly') {
    const s = document.getElementById('w-start')?.value || '';
    const e = document.getElementById('w-end')?.value || '';
    if (!s || !e) { alert('Set start and end dates.'); return; }
    S._wizParams = { wStart: s, wEnd: e };
  } else if (type === 'eos') {
    const cur = (document.getElementById('eos-cur')?.value || '').trim();
    const fut = (document.getElementById('eos-fut')?.value || '').trim();
    if (!cur || !fut) { alert('Select current and future sprints.'); return; }
    S._wizParams = { eosCur: cur, eosFut: fut };
  } else if (type === 'pmr') {
    const monthVal = document.getElementById('pmr-month-sel')?.value || '';
    if (!monthVal) { alert('Select a month.'); return; }
    const [yr,mo] = monthVal.split('-').map(Number);
    const s = `${yr}-${String(mo).padStart(2,'0')}-01`;
    const lastDay = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    const e = `${yr}-${String(mo).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    S._wizParams = { pmrStart: s, pmrEnd: e, pmrMonth: monthVal };
  } else {
    S._wizParams = {};
  }

  // Advance to the last step (report) — works for both 2-step and 3-step wizards
  const _lastStep = WIZARDS[type].steps.length - 1;
  _activeStep = _lastStep;
  renderWizardSteps(WIZARDS[type].steps, _lastStep);
  renderWizardContent(type, _lastStep);

  // Run with the saved params — defer one tick so DOM is painted
  setTimeout(function() { runner(); }, 0);
}

