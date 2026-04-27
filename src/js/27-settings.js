// ============================================================
// SETTINGS OVERLAY
// ============================================================
function openSettings(section) {
  document.getElementById('settings-overlay').classList.add('open');
  switchSettings(section || 'config');
  // Defer render so overlay is painted before DOM queries run
  setTimeout(() => {
    populateConfigFields();
    renderConfigUI();
    if (section === 'topics')     renderTopicsList();
    if (section === 'overrides')  renderOverridesUI();
    if (section === 'calendar')      renderCalendarPane();
    if (section === 'classification') { renderConfigUI(); populateClassificationPane(); }
    if (section === 'sprint')   { refreshAssigneePicker(); clsSelectorRefreshAll(); }
    if (section === 'spin')       { populateSpinPrefsUI(); clsSelectorRefreshAll(); }
    if (section === 'appearance') populateAppPrefsUI();
  }, 0);
}


// ============================================================
// APP-LEVEL APPEARANCE — theme + font size, whole app
// Defined early so settings functions can call populateAppPrefsUI safely.
// ============================================================
const APP_APPEARANCE_KEY = 'jira_reportsuite_appearance_v1';

function _applyFontSize(px) {
  // Scale all --fs-* variables relative to the base (13px = 1.0 scale)
  const scale = px / 13;
  const root = document.documentElement;
  root.style.setProperty('--fs-base', px + 'px');
  root.style.setProperty('--fs-sm',   Math.round(12 * scale) + 'px');
  root.style.setProperty('--fs-xs',   Math.round(11 * scale) + 'px');
  root.style.setProperty('--fs-lg',   Math.round(14 * scale) + 'px');
  root.style.setProperty('--fs-xl',   Math.round(16 * scale) + 'px');
  // Also set root font-size so rem-based sizes scale (spin view uses rem)
  root.style.fontSize = px + 'px';
}

function loadAppAppearance() {
  try {
    const saved = localStorage.getItem(APP_APPEARANCE_KEY);
    if (saved) {
      const p = JSON.parse(saved);
      if (p.theme)    document.body.classList.toggle('light', p.theme === 'light');
      if (p.fontSize) _applyFontSize(p.fontSize);
    }
  } catch(e) {}
}

function populateAppPrefsUI() {
  const isLight = document.body.classList.contains('light');
  const btn = document.getElementById('app-theme-btn');
  if (btn) btn.textContent = isLight ? 'Switch to Dark' : 'Switch to Light';
  const sz = parseInt(document.documentElement.style.fontSize) || 13;
  const el = document.getElementById('app-pref-fontsize-val');
  if (el) el.textContent = sz + 'px';
}

function appToggleTheme() {
  const isLight = document.body.classList.toggle('light');
  try {
    const saved = JSON.parse(localStorage.getItem(APP_APPEARANCE_KEY) || '{}');
    saved.theme = isLight ? 'light' : 'dark';
    localStorage.setItem(APP_APPEARANCE_KEY, JSON.stringify(saved));
    if (S.spin) S.spin._theme = saved.theme;
  } catch(e) {}
  populateAppPrefsUI();
}

function appChangeFontSize(delta) {
  const current = parseInt(document.documentElement.style.fontSize) || 13;
  const next = Math.max(10, Math.min(18, current + delta));
  _applyFontSize(next);
  try {
    const saved = JSON.parse(localStorage.getItem(APP_APPEARANCE_KEY) || '{}');
    saved.fontSize = next;
    localStorage.setItem(APP_APPEARANCE_KEY, JSON.stringify(saved));
    if (S.spin) S.spin._fontSize = next;
  } catch(e) {}
  const el = document.getElementById('app-pref-fontsize-val');
  if (el) el.textContent = next + 'px';
}

// Spin compat shims
function applySpinFontSize() {}
function applySpinTheme() {
  const isDark = !document.body.classList.contains('light');
  document.body.classList.toggle('light', !isDark);
}
function spinToggleTheme()         { appToggleTheme(); }
function spinChangeFontSize(delta) { appChangeFontSize(delta); }

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
}

function switchSettings(section) {
  document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.settings-pane').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('snav-' + section);
  const paneEl = document.getElementById('settings-' + section);
  if (navEl) navEl.classList.add('active');
  if (paneEl) paneEl.classList.add('active');
  const _titles = {
    manage: 'Manage Data',
    config:'Jira / API', appearance:'Appearance',
    weekly:'Weekly Digest', eos:'End of Sprint', pmr:'PMR',
    spin:'Spin Plan', sprint:'Sprint Plan/Report',
    topics:'Topics', overrides:'Rule Overrides', classification:'Classification', calendar:'Sprint Calendar'
  };
  document.getElementById('settings-title').textContent = _titles[section] || 'Settings';
  setTimeout(()=>{
    if(section==='topics')     renderTopicsList();
    if(section==='overrides')  renderOverridesUI();
    if(section==='config')     renderConfigUI();
    if(section==='calendar')      renderCalendarPane();
    if(section==='classification') { renderConfigUI(); populateClassificationPane(); }
    if(section==='sprint')   { renderConfigUI(); refreshAssigneePicker(); clsSelectorRefreshAll(); }
    if(section==='eos')        renderConfigUI();
    if(section==='pmr')      { renderConfigUI(); clsSelectorRefreshAll(); }
    if(section==='spin')       populateSpinPrefsUI();
    if(section==='appearance') populateAppPrefsUI();
    if(section==='manage'){
      try{const m=JSON.parse(localStorage.getItem('jira_reportsuite_epics_meta_v1')||'{}');const el=document.getElementById('epics-cache-meta');if(el)el.textContent=m.filename?(m.count+' epics — '+m.filename):'Not cached';}catch(e){}
      try{const m=JSON.parse(localStorage.getItem('jira_reportsuite_spin_meta_v1')||'{}');const el=document.getElementById('spin-cache-meta');if(el)el.textContent=m.filename?(m.count+' rows — '+m.filename):'Not cached';}catch(e){}
    }
  },0);
}

// ============================================================
// NAV (legacy, kept for any code that calls nav())
// ============================================================
function nav(page) {
  // Settings-only pages
  if (['config','fieldmap','topics','people','overrides','legend'].includes(page)) {
    openSettings(page);
  // Wizard pages — these have both a wizard and a settings pane; open the wizard
  } else if (['weekly','eos','pmr','sprint','spin'].includes(page)) {
    startWizard(page);
  }
}



