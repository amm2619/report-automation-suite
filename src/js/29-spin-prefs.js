// ============================================================
// SPIN PLAN — INLINE PREFS PANEL
// ============================================================
function spinRenderPrefsPanel() {
  const panel = document.getElementById('spin-prefs-panel');
  if (!panel) return;
  const isDark = !document.body.classList.contains('light');
  try {
    const saved = localStorage.getItem(SPIN_PREFS_KEY);
    const prefs = saved ? Object.assign({}, SPIN_PREFS_DEFAULTS, JSON.parse(saved)) : Object.assign({}, SPIN_PREFS_DEFAULTS);
    const epicCount = prefs.epicCount || 5;
    const sprintCount = prefs.sprintCount || 5;
    const fontSize = S.spin._fontSize || 13;

    panel.innerHTML = `
      <h3>Display</h3>
      <div class="spin-pref-row">
        <div><div class="spin-pref-label">Font size</div><div class="spin-pref-sub">Current: ${fontSize}px</div></div>
        <div class="spin-pref-ctrl spin-pref-stepper">
          <button onclick="spinChangeFontSize(-1);spinRenderPrefsPanel()">−</button>
          <span class="spin-pref-num">${fontSize}</span>
          <button onclick="spinChangeFontSize(1);spinRenderPrefsPanel()">+</button>
        </div>
      </div>
      <div class="spin-pref-row">
        <div><div class="spin-pref-label">Sprints visible</div><div class="spin-pref-sub">Columns shown in Sprint tab</div></div>
        <div class="spin-pref-ctrl spin-pref-stepper">
          <button onclick="spinSetSpinPref('sprintCount',Math.max(2,${sprintCount}-1))">−</button>
          <span class="spin-pref-num">${sprintCount}</span>
          <button onclick="spinSetSpinPref('sprintCount',Math.min(12,${sprintCount}+1))">+</button>
        </div>
      </div>
      <div class="spin-pref-row">
        <div><div class="spin-pref-label">Epics per column</div><div class="spin-pref-sub">Before "show more"</div></div>
        <div class="spin-pref-ctrl spin-pref-stepper">
          <button onclick="spinSetSpinPref('epicCount',Math.max(1,${epicCount}-1))">−</button>
          <span class="spin-pref-num">${epicCount}</span>
          <button onclick="spinSetSpinPref('epicCount',Math.min(20,${epicCount}+1))">+</button>
        </div>
      </div>

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--bd)">
        <div style="font-size:10px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Color &amp; Icon Guide</div>
        <div style="font-size:10px;font-weight:600;color:var(--di);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Status</div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:var(--fs-xs)">
          <div class="u-flex-6"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#36B37E"/><path d="M2.5 5l1.8 1.8 3.2-3.2" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span style="color:var(--a3);font-weight:600">Done</span><span style="color:var(--di)">closed / resolved</span></div>
          <div class="u-flex-6"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#0052CC"/><circle cx="5" cy="5" r="2" fill="#fff"/></svg><span style="color:var(--a1);font-weight:600">In Progress</span><span style="color:var(--di)">actively being worked</span></div>
          <div class="u-flex-6"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#6554C0"/><path d="M3 5h4M5 3v4" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg><span style="color:var(--a2);font-weight:600">Reviewing</span><span style="color:var(--di)">in review / QA</span></div>
          <div class="u-flex-6"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="#8A97B8" stroke-width="1.5"/></svg><span style="color:var(--mu);font-weight:600">Open</span><span style="color:var(--di)">not yet started</span></div>
          <div class="u-flex-6"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#FF5630"/><rect x="4" y="7" width="8" height="2" rx="1" fill="#fff"/></svg><span style="color:var(--a5);font-weight:600">Blocked</span><span style="color:var(--di)">cannot proceed</span></div>
        </div>
        <div style="font-size:10px;font-weight:600;color:var(--di);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Progress bars</div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:var(--fs-xs)">
          <div class="u-flex-8"><div style="width:28px;height:6px;border-radius:3px;background:var(--a3);flex-shrink:0"></div><span style="color:var(--di)">≥ 67% on track</span></div>
          <div class="u-flex-8"><div style="width:28px;height:6px;border-radius:3px;background:var(--a4);flex-shrink:0"></div><span style="color:var(--di)">34–66% in progress</span></div>
          <div class="u-flex-8"><div style="width:28px;height:6px;border-radius:3px;background:var(--a5);flex-shrink:0"></div><span style="color:var(--di)">< 34% needs attention</span></div>
        </div>
      </div>`;
  } catch(e) { panel.innerHTML = '<div class="u-dim-xs">Error loading prefs.</div>'; }
}

function spinTogglePrefs() {
  const panel = document.getElementById('spin-prefs-panel');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    spinRenderPrefsPanel();
    panel.style.display = 'block';
    setTimeout(function() {
      document.addEventListener('click', function spinPrefsOutside(e) {
        const btn = document.getElementById('spin-prefs-btn');
        if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
          panel.style.display = 'none';
          document.removeEventListener('click', spinPrefsOutside);
        }
      });
    }, 10);
  } else {
    panel.style.display = 'none';
  }
}

function spinSetSpinPref(key, val) {
  spinSavePref(key, val);
  spinRenderPrefsPanel();
  // Re-render report to apply new pref
  if (key === 'epicCount' || key === 'sprintCount') {
    renderSpinReport();
  }
}

// Spin history bar — dropdown to switch between saved spins + save button
function spinHistoryBarHtml() {
  const history = S.cfg.spin_history || [];
  const activeId = S.spin._activeHistoryId || '';
  let opts = '<option value="">Current</option>';
  history.forEach(h => {
    const sel = h.id === activeId ? ' selected' : '';
    const d = h.ts ? new Date(h.ts).toLocaleDateString() : '';
    opts += `<option value="${esc(h.id)}"${sel}>${esc(h.label)} (${h.count} rows, ${d})</option>`;
  });
  return `<select style="font-size:var(--fs-xs);padding:2px 6px;background:var(--s3);border:1px solid var(--bd);color:var(--tx);border-radius:3px;max-width:200px" onchange="spinSwitchHistory(this.value)" title="Switch spin period">${opts}</select>`
    + `<button class="btn btn-ghost btn-xs" onclick="spinSaveToHistory()" title="Save current spin to history"><span class="mi" style="font-size:13px;margin-right:2px">save</span>Save Spin</button>`
    + (history.length ? `<button class="btn btn-ghost btn-xs" onclick="spinManageHistory()" title="Manage saved spins"><span class="mi" style="font-size:13px">delete_sweep</span></button>` : '');
}

function spinSaveToHistory() {
  const label = prompt('Label for this spin (e.g., "Spin 2 — 26.2.1–26.2.6"):');
  if (!label) return;
  const id = saveSpinToHistory(label);
  if (id) {
    S.spin._activeHistoryId = id;
    if (typeof runSpin === 'function') runSpin();
  }
}

function spinSwitchHistory(id) {
  if (!id) {
    // Switch back to current (live loaded) spin
    S.spin._activeHistoryId = '';
    const cached = loadSpinFromStorage();
    if (cached) {
      S.files.spin = cached.rows;
      if (!S.fileNames) S.fileNames = {};
      S.fileNames.spin = cached.filename;
      updateStatusBar();
      if (typeof runSpinEngine === 'function') runSpinEngine(cached.rows);
      if (typeof runSpin === 'function') runSpin();
    }
    return;
  }
  switchToHistoricalSpin(id);
}

function spinManageHistory() {
  const history = S.cfg.spin_history || [];
  if (!history.length) { alert('No saved spins.'); return; }
  const list = history.map((h, i) => `${i + 1}. ${h.label} (${h.count} rows)`).join('\n');
  const idx = prompt('Saved spins:\n\n' + list + '\n\nEnter number to delete (or cancel):');
  if (!idx) return;
  const i = parseInt(idx, 10) - 1;
  if (i >= 0 && i < history.length) {
    const h = history[i];
    if (confirm('Delete "' + h.label + '"?')) {
      deleteSpinFromHistory(h.id);
      if (S.spin._activeHistoryId === h.id) {
        S.spin._activeHistoryId = '';
      }
      if (typeof runSpin === 'function') runSpin();
    }
  }
}

function renderSpinReport() {
  const out = document.getElementById('spin-report-body');
  if (!out) return;
  const tree = S.spin.tree;
  let html = '';
  if (S.spin.view === 'list') html = renderSpinListView(tree);
  else if (S.spin.view === 'col') html = renderSpinColView(tree);
  else if (S.spin.view === 'spin') html = renderSpinMatrixView();
  out.innerHTML = html;
}

// ── Main entry point ────────────────────────────────────────
function runSpin() {
  const out = document.getElementById('spin-output');
  if (!out) {
    // spin-output not in DOM — likely called before wizard last step rendered
    // Try to find it and retry once after a tick
    setTimeout(function() {
      const out2 = document.getElementById('spin-output');
      if (out2) runSpin();
    }, 50);
    return;
  }

  const spinRows = S.files.spin && S.files.spin.length ? S.files.spin : null;

  if (!spinRows) {
    out.innerHTML = `<div class="card lr"><div class="card-title" style="color:var(--a5)">No Roadmap File</div><div>Load a Jira Plan CSV first. Go back to Upload and drop the CSV export from your Jira Roadmap or Plans view.</div></div>`;
    return;
  }

  // Normalize issues — single Jira Plans CSV, no separate epics file needed.
  // Epic names are resolved after tree build by walking the hierarchy.
  const issues = spinRows.map(row => normSpinCsvIssue(row));

  // Pre-resolve calendar entries
  const cal = S.cfg.sprint_calendar || [];
  issues.forEach(i => {
    i._calEntry = spinMatchCal(i.sprint) || spinMatchCalByDate(i.targetEnd);
  });

  S.spin.issues = issues;
  S.spin.tree = buildSpinTree(issues);
  spinBuildCalIdx(); // build sprint calendar index for column view sorting
  // View pref comes from Settings → Spin Plan (no wizard step for this)
  try {
    const _sprefs = localStorage.getItem(SPIN_PREFS_KEY);
    const _sp = _sprefs ? Object.assign({}, SPIN_PREFS_DEFAULTS, JSON.parse(_sprefs)) : Object.assign({}, SPIN_PREFS_DEFAULTS);
    S.spin.view = _sp.view || 'list';
    S.spin.sprintCount = _sp.sprintCount || 5;
  } catch(e) { S.spin.view = 'list'; S.spin.sprintCount = 5; }
  S.spin._todayStr = new Date().toISOString().slice(0, 10);
  S.spin._sort = { col: 'key', dir: 1 };
  S.spin._statsCache = {};
  S.spin.filterText = '';
  S.spin.filterStatus = '';
  S.spin.filterProject = '';

  const gStats = spinGlobalStats();
  const pctCls = gStats.pct >= 67 ? 'c-green' : gStats.pct >= 34 ? 'c-amber' : 'c-red';

  // Build project filter options
  const projects = [...new Set(issues.map(i => i.project).filter(Boolean))].sort();
  const projOpts = projects.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');

  out.innerHTML = `
<div class="rpt-frame" id="spin-rpt-frame" style="position:relative">
  <div class="rpt-bar">
    <div class="u-flex-8">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--a1)"></div>
      <span style="font-size:var(--fs-sm);font-weight:600;color:var(--tx)">Spin Plan</span>
      <span class="rpt-bar-fn">${esc(S.fileNames?.spin || '')}</span>
    </div>
    <div class="u-flex-8" style="flex-wrap:wrap;gap:6px">
      <div class="spin-view-pill">
        <button class="spin-pill-btn${S.spin.view === 'list' ? ' active' : ''}" data-view="list" onclick="spinSetView('list')"><span class="mi" style="font-size:14px;margin-right:3px">format_list_bulleted</span>List</button>
        <button class="spin-pill-btn${S.spin.view === 'col' ? ' active' : ''}" data-view="col" onclick="spinSetView('col')"><span class="mi" style="font-size:14px;margin-right:3px">view_week</span>Column</button>
        <button class="spin-pill-btn${S.spin.view === 'spin' ? ' active' : ''}" data-view="spin" onclick="spinSetView('spin')"><span class="mi" style="font-size:14px;margin-right:3px">account_tree</span>Spin</button>
      </div>
      ${spinHistoryBarHtml()}
      <button class="btn btn-ghost btn-xs fs-btn" onclick="fullscreenReport('spin-rpt-frame')" title="Fullscreen (Esc to exit)"><span class="mi">open_in_full</span></button>
    </div>
  </div>
  <div class="rpt-body">
    <div class="rpt-body-inner">
      <div id="spin-sumbar-slot"></div>
      <div id="spin-global-drill" class="spin-drill" style="display:none" data-active-type="" data-deps-filter="open">
        <div class="spin-drill-hdr">
          <span style="font-size:var(--fs-sm);font-weight:600;color:var(--tx)"></span>
          <div style="flex:1"></div>
          <button onclick="spinCloseDrilldown()" style="background:none;border:none;color:var(--mu);font-size:var(--fs-base);cursor:pointer;padding:0 4px;line-height:1"><span class="mi">close</span></button>
        </div>
        <div class="spin-drill-body" style="padding:12px 16px;max-height:400px;overflow-y:auto"></div>
      </div>
      <div id="spin-main-filter"></div>
      <div id="spin-drill-panel" class="spin-drill" style="display:none">
        <div class="spin-drill-hdr">
          <span id="spin-drill-title" style="font-size:var(--fs-sm);font-weight:600;color:var(--tx)"></span>
          <div style="flex:1"></div>
          <button onclick="spinCloseDrill()" style="background:none;border:none;color:var(--mu);font-size:var(--fs-base);cursor:pointer;padding:0 4px;line-height:1"><span class="mi">close</span></button>
        </div>
        <div id="spin-drill-body" class="spin-drill-body" style="padding:12px 16px;max-height:320px;overflow-y:auto"></div>
      </div>
      <div id="spin-report-body"></div>
    </div>
  </div>
</div>`;

  // Render clickable summary bar
  spinUpdateSummaryBar();

  // Render report body
  renderSpinReport();
  // Save draft immediately after render — no timing assumption needed
  autoSaveDraft('spin');
  updateRecentReports('spin', {
    ts: new Date().toISOString(),
    wizParams: Object.assign({}, S._wizParams||{}, {
      spinFile: S.fileNames&&S.fileNames.issues ? S.fileNames.issues.replace(/\.csv$/i,'').slice(0,30) : ''
    }),
    issuesFile: S.fileNames&&S.fileNames.issues ? S.fileNames.issues : ''
  });
  // Populate unified filter bar
  spinBuildMainFilter(projOpts);
}


// ============================================================
// SPIN PLAN — PREFERENCES
// ============================================================
const SPIN_PREFS_KEY = 'jira_reportsuite_spin_prefs_v1';
const SPIN_PREFS_DEFAULTS = {
  view: 'list',
  sprintCount: 5,
  fontSize: 13,
  theme: 'dark',
  defaultSort: 'key',
  epicCount: 5,
};

function loadSpinPrefs() {
  try {
    const saved = localStorage.getItem(SPIN_PREFS_KEY);
    if (saved) {
      const p = JSON.parse(saved);
      Object.assign(S.spin, {
        view: p.view || SPIN_PREFS_DEFAULTS.view,
        sprintCount: p.sprintCount || SPIN_PREFS_DEFAULTS.sprintCount,
        _fontSize: p.fontSize || SPIN_PREFS_DEFAULTS.fontSize,
        _theme: p.theme || SPIN_PREFS_DEFAULTS.theme,
        _defaultSort: p.defaultSort || SPIN_PREFS_DEFAULTS.defaultSort,
        _epicCount: p.epicCount || SPIN_PREFS_DEFAULTS.epicCount,
      });
    }
  } catch(e) {}
  applySpinFontSize();
  applySpinTheme();
}

function spinSavePrefView(view) {
  S.spin.view = view; // update live state immediately
  spinSavePref('view', view);
  // Update pill pickers in both settings and active report bar
  document.querySelectorAll('#spin-pref-view-pill .spin-pill-btn, .spin-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  const hidden = document.getElementById('spin-pref-view');
  if (hidden) hidden.value = view;
}

function spinSavePref(key, val) {
  try {
    const saved = localStorage.getItem(SPIN_PREFS_KEY);
    const prefs = saved ? JSON.parse(saved) : Object.assign({}, SPIN_PREFS_DEFAULTS);
    prefs[key] = val;
    localStorage.setItem(SPIN_PREFS_KEY, JSON.stringify(prefs));
    // Mirror into S.spin live
    if (key === 'view') S.spin.view = val;
    if (key === 'sprintCount') S.spin.sprintCount = val;
    if (key === 'fontSize') { S.spin._fontSize = val; applySpinFontSize(); }
    if (key === 'theme') { S.spin._theme = val; applySpinTheme(); }
    if (key === 'defaultSort') { S.spin._defaultSort = val; S.spin._sort.col = val; }
    if (key === 'epicCount') S.spin._epicCount = val;
  } catch(e) {}
}

// [appearance fns moved — see below settings block]

function populateSpinPrefsUI() {
  try {
    const saved = localStorage.getItem(SPIN_PREFS_KEY);
    const prefs = saved ? Object.assign({}, SPIN_PREFS_DEFAULTS, JSON.parse(saved)) : Object.assign({}, SPIN_PREFS_DEFAULTS);
    const sel = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    // Activate the right pill button
    const view = prefs.view || 'list';
    document.querySelectorAll('#spin-pref-view-pill .spin-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    const hidden = document.getElementById('spin-pref-view');
    if (hidden) hidden.value = view;
    sel('spin-pref-sort', prefs.defaultSort);
    sel('spin-pref-epics', String(prefs.epicCount));
    sel('spin-pref-sprints', String(prefs.sprintCount || 5));
  } catch(e) {}
}


