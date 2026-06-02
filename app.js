'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vp2.v1';
const PROJECTS    = ['DX', 'LX', 'RC'];
// Key prefix → full Jira project name (shown on the project tabs).
const PROJECT_NAMES = { DX: 'DataXplorer', LX: 'LinkXplorer', RC: 'ROLLERCOASTER' };
// These are used as foreground text on dark surfaces — all pass WCAG AA 4.5:1
const PROJ_COLOR  = { DX: '#22d3ee', LX: '#a78bfa', RC: '#fb923c' };

// ─── State ────────────────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  config: {
    jiraUrl:         '',
    resolutions:     [...DATA.DEFAULT_RESOLUTIONS],
    // Explicit (locked) sprints — each has its own start/end dates.
    // Auto-generated sprints are appended after the last locked one.
    sprints:         [],   // [{ id, start, end }]
    defaultDuration: 14,   // calendar days for auto-generated sprints
    futureCount:     4,    // how many auto sprints to show after last locked one
  },
  people:            [],   // { id, name, sid, type, project, goalPoints }
  historical:        [],   // raw ticket objects from historical Jira HTML
  leave:             [],   // { sid, date, halfDay, summary }
  leaveHalfDay:      false,
  backlog:           [],   // ticket objects from sprint Jira HTML
  assignments:       {},   // key → { personId, wfh, sprintIdx }
  view: {
    section:   'planner',  // 'planner' | 'team' | 'history' | 'settings'
    project:   'DX',       // active project tab: 'DX' | 'LX' | 'RC'
    sprintIdx: 0,
    mode:      'single',   // 'single' | 'multi'
  },
};

let S = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(DEFAULT_STATE);
    return deepMerge(deepClone(DEFAULT_STATE), JSON.parse(raw));
  } catch (_) { return deepClone(DEFAULT_STATE); }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
}

function deepClone(o)        { return JSON.parse(JSON.stringify(o)); }
function deepMerge(base, src) {
  if (typeof src !== 'object' || src === null) return src;
  const out = { ...base };
  for (const k of Object.keys(src)) {
    out[k] = (typeof src[k] === 'object' && !Array.isArray(src[k]) && src[k] !== null)
      ? deepMerge(base[k] || {}, src[k])
      : src[k];
  }
  return out;
}

// ─── Derived data helpers ─────────────────────────────────────────────────────

function getVelocity() {
  const projMap = {};
  S.people.forEach(p => { if (p.project) projMap[p.name] = p.project; });
  return DATA.computeVelocity(S.historical, S.config.resolutions, projMap);
}

function getSprints() {
  // Build locked sprints (explicit entries in config, sorted by start)
  const locked = (S.config.sprints || [])
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((sp, i) => ({
      idx:      i,
      start:    sp.start,
      end:      sp.end,
      name:     sp.name || '',
      workDays: HOLIDAYS.workDays(sp.start, sp.end),
      holidays: HOLIDAYS.inRange(sp.start, sp.end),
      locked:   true,
      id:       sp.id,
    }));

  if (!locked.length) return [];

  // Auto-generate future sprints after the last locked one
  const dur       = S.config.defaultDuration || 14;
  const autoCount = S.config.futureCount ?? 4;
  let cursor = new Date(locked[locked.length - 1].end + 'T00:00:00');
  cursor.setDate(cursor.getDate() + 1);

  const all = [...locked];
  for (let i = 0; i < autoCount; i++) {
    const s   = cursor.toISOString().slice(0, 10);
    const end = new Date(cursor);
    end.setDate(end.getDate() + dur - 1);
    const e   = end.toISOString().slice(0, 10);
    all.push({
      idx:      all.length,
      start:    s,
      end:      e,
      name:     '',
      workDays: HOLIDAYS.workDays(s, e),
      holidays: HOLIDAYS.inRange(s, e),
      locked:   false,
    });
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }
  return all;
}

function currentSprint() {
  const all = getSprints();
  return all[S.view.sprintIdx] || all[0] || null;
}

function personById(id) { return S.people.find(p => p.id === id); }

// Display name for a sprint — the user's label, falling back to "Sprint N".
function sprintLabel(sp) {
  return sp && sp.name && sp.name.trim() ? sp.name.trim() : `Sprint ${(sp ? sp.idx : 0) + 1}`;
}

// ─── Project filter (top-level DX / LX / RC tabs) ──────────────────────────────

function activeProject()        { return S.view.project || 'DX'; }
function peopleInProject(proj)  { return S.people.filter(p => p.project === (proj || activeProject())); }
function backlogInProject(proj) { return S.backlog.filter(t => t.project === (proj || activeProject())); }

function assignedTickets(personId, sprintIdx) {
  return S.backlog.filter(t => {
    const a = S.assignments[t.key];
    return a && a.personId === personId && (sprintIdx === undefined || a.sprintIdx === sprintIdx);
  });
}

// Unassigned tickets in the active project (candidates for the current sprint).
function unassignedTickets(sprintIdx) {
  const proj = activeProject();
  return S.backlog.filter(t => {
    if (t.project !== proj) return false;
    const a = S.assignments[t.key];
    return !a || a.sprintIdx !== (sprintIdx === undefined ? S.view.sprintIdx : sprintIdx);
  });
}

function personCapacity(person) {
  const sp = currentSprint();
  if (!sp) return null;
  return DATA.computeCapacity(person, sp.start, sp.end, S.leave, getVelocity());
}

function assignedPts(personId) {
  const si = S.view.sprintIdx;
  return assignedTickets(personId, si).reduce((s, t) => {
    const a = S.assignments[t.key];
    return s + (a ? (t.points || 0) : 0);
  }, 0);
}

function wfhPts(personId) {
  const si = S.view.sprintIdx;
  return assignedTickets(personId, si).reduce((s, t) => {
    const a = S.assignments[t.key];
    return s + (a && a.wfh ? (t.points || 0) : 0);
  }, 0);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(s)          { return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
function fmt(n,d=1)      { return typeof n==='number'&&isFinite(n)?(n===Math.floor(n)?String(n):n.toFixed(d)):'0'; }
function uid()           { return window.crypto?.randomUUID?.() ?? 'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36); }
function fmtDate(iso)    { if(!iso)return''; const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function jiraLink(key)   {
  const base = (S.config.jiraUrl||'').replace(/\/$/,'');
  return base ? `<a href="${base}/browse/${esc(key)}" target="_blank" class="ticket-key">${esc(key)}</a>`
              : `<span class="ticket-key">${esc(key)}</span>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function toast(msg, type='info') {
  document.querySelector('.toast')?.remove();
  const el = Object.assign(document.createElement('div'), { className:`toast toast-${type}`, textContent:msg });
  document.body.appendChild(el);
  setTimeout(()=>{ el.classList.add('fading'); setTimeout(()=>el.remove(),280); }, 3400);
}

// ─── Description panel ────────────────────────────────────────────────────────

function openDesc(key) {
  const t = S.backlog.find(x => x.key === key) || S.historical.find(x => x.key === key);
  if (!t) return;
  const panel = document.getElementById('desc-panel');
  document.getElementById('desc-key').innerHTML = jiraLink(key);
  document.getElementById('desc-summary').textContent = t.summary;
  document.getElementById('desc-body').textContent = t.description || '(No description)';
  panel.classList.remove('hidden');
}
function closeDesc() { document.getElementById('desc-panel').classList.add('hidden'); }

// ─── Section navigation ───────────────────────────────────────────────────────

function goTo(section) {
  S.view.section = section;
  renderApp();
}

// ─── FILE HANDLERS ────────────────────────────────────────────────────────────

function readFile(file, cb) {
  const r = new FileReader();
  r.onload = e => cb(e.target.result, file.name);
  r.readAsText(file);
}

// Guess each assignee's project from the tickets they own (most-frequent wins).
function inferProjects(tickets) {
  const tally = {};
  for (const t of tickets) {
    if (!t.assignee || !t.project) continue;
    (tally[t.assignee] = tally[t.assignee] || {});
    tally[t.assignee][t.project] = (tally[t.assignee][t.project] || 0) + 1;
  }
  const out = {};
  for (const [name, projs] of Object.entries(tally)) {
    out[name] = Object.entries(projs).sort((a, b) => b[1] - a[1])[0][0];
  }
  return out;
}

// Collapse any same-name people into one, re-pointing their assignments to the
// survivor, so a person is only ever seen once. Names are matched trimmed +
// case-insensitive. Returns the surviving person for a given name.
function dedupePeople() {
  const byKey = new Map();          // normalized name → surviving person
  const remap = {};                 // dropped id → survivor id
  const kept  = [];
  for (const p of S.people) {
    const key = (p.name || '').trim().toLowerCase();
    const survivor = byKey.get(key);
    if (survivor) {
      remap[p.id] = survivor.id;
      // Keep any details the survivor is missing.
      survivor.sid        = survivor.sid        || p.sid;
      survivor.project    = survivor.project    || p.project;
      survivor.goalPoints = survivor.goalPoints ?? p.goalPoints;
    } else {
      byKey.set(key, p);
      kept.push(p);
    }
  }
  if (kept.length !== S.people.length) {
    for (const a of Object.values(S.assignments)) {
      if (a.personId && remap[a.personId]) a.personId = remap[a.personId];
    }
    S.people = kept;
  }
  return byKey;
}

// Create any people seen as assignees; fill in an inferred project where the
// person doesn't already have one (so manual edits in the Team tab stick).
// Everyone defaults to contractor — flip the few GOV folks in the Team tab.
function ensurePeople(tickets) {
  const guess = inferProjects(tickets);
  const byName = dedupePeople();
  [...new Set(tickets.map(t => t.assignee).filter(Boolean))].forEach(name => {
    const existing = byName.get(name.trim().toLowerCase());
    if (!existing) {
      const p = { id: uid(), name, sid: '', type: 'contractor', project: guess[name] || '', goalPoints: null };
      S.people.push(p);
      byName.set(name.trim().toLowerCase(), p);
    } else if (!existing.project && guess[name]) {
      existing.project = guess[name];
    }
  });
}

function handleHistoricalHTML(text, filename) {
  const tickets = DATA.parseHTML(text).map(DATA.buildTicket).filter(t => t.key && t.sprints.length);
  if (!tickets.length) { toast('No tickets with sprints found in the Jira HTML.','error'); return; }

  ensurePeople(tickets);
  S.historical = tickets;
  save();
  toast(`Loaded ${tickets.length} historical tickets from ${filename}`,'success');
  renderApp();
}

function handleBacklogHTML(text, filename) {
  const tickets = DATA.parseHTML(text).map(DATA.buildTicket).filter(t => t.key);
  if (!tickets.length) { toast('No tickets found in the Jira HTML.','error'); return; }

  ensurePeople(tickets);
  S.backlog = tickets;

  // A ticket that already carries an assignee is pre-assigned to that person in
  // the current sprint, so their points count immediately.
  let auto = 0;
  const sprintIdx = S.view.sprintIdx || 0;
  tickets.forEach(t => {
    if (!t.assignee || S.assignments[t.key]) return;
    const p = S.people.find(x => x.name === t.assignee);
    if (p) { S.assignments[t.key] = { personId: p.id, sprintIdx, wfh: false }; auto++; }
  });

  save();
  toast(`Loaded ${tickets.length} backlog tickets${auto ? ` (${auto} pre-assigned)` : ''} from ${filename}`,'success');
  renderApp();
}

function handleICAL(text, filename) {
  const events = ICAL_PARSER.parse(text);
  if (!events.length) { toast('No events found in iCal file.','error'); return; }
  const dates = ICAL_PARSER.toLeaveDates(events, S.leaveHalfDay);
  if (!dates.length) { toast('No leave dates extracted.','error'); return; }

  // Merge with existing leave (replace same sid+date)
  const existing = S.leave.filter(l => !dates.find(d=>d.sid===l.sid&&d.date===l.date));
  S.leave = [...existing, ...dates];
  save();
  toast(`Imported ${dates.length} leave day records from ${filename}`,'success');
  renderApp();
}

// ─── PEOPLE CRUD ──────────────────────────────────────────────────────────────

function openPersonModal(id) {
  const modal = document.getElementById('person-modal');
  const p     = id ? S.people.find(x=>x.id===id) : null;
  document.getElementById('pm-id').value         = id || '';
  document.getElementById('pm-name').value       = p?.name        || '';
  document.getElementById('pm-sid').value        = p?.sid         || '';
  document.getElementById('pm-type').value       = p?.type        || 'contractor';
  document.getElementById('pm-project').value    = p?.project     || '';
  document.getElementById('pm-goal').value       = p?.goalPoints  ?? '';
  document.getElementById('pm-title').textContent = id ? 'Edit Person' : 'Add Person';
  modal.classList.remove('hidden');
  document.getElementById('pm-name').focus();
}

function closePersonModal() { document.getElementById('person-modal').classList.add('hidden'); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('person-form').addEventListener('submit', e => {
    e.preventDefault();
    const id      = document.getElementById('pm-id').value;
    const name    = document.getElementById('pm-name').value.trim();
    const sid     = document.getElementById('pm-sid').value.trim().toLowerCase();
    const type    = document.getElementById('pm-type').value;
    const project = document.getElementById('pm-project').value;
    const goal    = parseFloat(document.getElementById('pm-goal').value) || null;
    if (!name) { toast('Name is required.','error'); return; }

    if (id) {
      const p = S.people.find(x=>x.id===id);
      if (p) Object.assign(p, { name, sid, type, project, goalPoints:goal });
    } else {
      // Don't create a second card for someone who already exists.
      const dup = S.people.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
      if (dup) { toast(`${name} is already on the team.`,'error'); return; }
      S.people.push({ id:uid(), name, sid, type, project, goalPoints:goal });
    }
    save();
    closePersonModal();
    renderApp();
  });
});

function deletePerson(id) {
  if (!confirm('Remove this person?')) return;
  S.people = S.people.filter(p=>p.id!==id);
  save();
  renderApp();
}

// ─── ASSIGNMENT ───────────────────────────────────────────────────────────────

function assignTicket(key, personId) {
  if (!personId) {
    delete S.assignments[key];
  } else {
    S.assignments[key] = Object.assign(S.assignments[key]||{}, { personId, sprintIdx:S.view.sprintIdx });
  }
  save();
  renderPlanner();
}

function toggleWFH(key) {
  if (!S.assignments[key]) return;
  S.assignments[key].wfh = !S.assignments[key].wfh;
  save();
  renderPlanner();
}

function moveToSprint(key, sprintIdx) {
  if (!S.assignments[key]) return;
  S.assignments[key].sprintIdx = sprintIdx;
  save();
  renderPlanner();
}

// ─── SPRINT MANAGEMENT ───────────────────────────────────────────────────────

function addSprint() {
  const startEl = document.getElementById('asd-start');
  const durEl   = document.getElementById('asd-dur');
  const nameEl  = document.getElementById('asd-name');
  const start   = startEl.value;
  const dur     = parseInt(durEl.value, 10) || 14;
  const name    = (nameEl?.value || '').trim();
  if (!start) { toast('Enter a start date for the sprint.', 'error'); return; }

  const endD = new Date(start + 'T00:00:00');
  endD.setDate(endD.getDate() + dur - 1);
  const end = endD.toISOString().slice(0, 10);

  // Check for overlap with existing locked sprints
  const existing = S.config.sprints || [];
  const overlaps = existing.some(sp => sp.start <= end && sp.end >= start);
  if (overlaps) { toast('This sprint overlaps an existing locked sprint.', 'error'); return; }

  if (!S.config.sprints) S.config.sprints = [];
  S.config.sprints.push({ id: uid(), start, end, name });
  S.config.sprints.sort((a, b) => a.start.localeCompare(b.start));
  if (nameEl) nameEl.value = '';
  save();

  // Pre-fill next suggested start
  const next = new Date(end + 'T00:00:00');
  next.setDate(next.getDate() + 1);
  startEl.value = next.toISOString().slice(0, 10);
  renderSettings();
}

function removeSprint(id) {
  S.config.sprints = (S.config.sprints || []).filter(sp => sp.id !== id);
  save();
  renderSettings();
}

function renameSprint(id, name) {
  const sp = (S.config.sprints || []).find(s => s.id === id);
  if (!sp) return;
  sp.name = (name || '').trim();
  save();
  renderApp();   // refresh tabs/headers that show the label
}

// Lock an auto-generated sprint by converting it to an explicit locked sprint
function lockAutoSprint(idx) {
  const sp = getSprints()[idx];
  if (!sp || sp.locked) return;
  if (!S.config.sprints) S.config.sprints = [];
  S.config.sprints.push({ id: uid(), start: sp.start, end: sp.end });
  S.config.sprints.sort((a, b) => a.start.localeCompare(b.start));
  save();
  renderSettings();
  renderPlanner();
}

// ─── SETTINGS SAVE ────────────────────────────────────────────────────────────

function saveSettings() {
  S.config.jiraUrl         = document.getElementById('cfg-jira').value.trim();
  S.config.defaultDuration = parseInt(document.getElementById('cfg-dur').value, 10) || 14;
  S.config.futureCount     = parseInt(document.getElementById('cfg-future').value, 10) ?? 4;
  // Resolutions: read the checkboxes + custom textarea
  const checked = [...document.querySelectorAll('#cfg-res-list input:checked')].map(el => el.value);
  const custom  = (document.getElementById('cfg-res-custom').value || '').split(',').map(s => s.trim()).filter(Boolean);
  S.config.resolutions = [...new Set([...checked, ...custom])];
  // Clear auto-generated future sprints from preview — locked sprints are the schedule
  S.config.futureCount = 0;
  save();
  toast('Settings saved.', 'success');
  renderApp();
}

// ─── EXPORT / IMPORT ──────────────────────────────────────────────────────────

function exportData() {
  const blob = new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'),{href:url,download:`sprint-plan-${new Date().toISOString().slice(0,10)}.json`});
  a.click(); URL.revokeObjectURL(url);
}

function importData(text) {
  try {
    const d = JSON.parse(text);
    S = deepMerge(deepClone(DEFAULT_STATE), d);
    save(); toast('Data imported.','success'); renderApp();
  } catch(_) { toast('Invalid JSON file.','error'); }
}

// ─── RENDER: shell ────────────────────────────────────────────────────────────

function renderApp() {
  // Nav active states
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.section === S.view.section)
  );
  document.querySelectorAll('.section-panel').forEach(el =>
    el.classList.toggle('hidden', el.dataset.section !== S.view.section)
  );
  renderProjectTabs();
  switch (S.view.section) {
    case 'planner':  renderPlanner();  break;
    case 'team':     renderTeam();     break;
    case 'history':  renderHistory();  break;
    case 'settings': renderSettings(); break;
  }
}

// ─── RENDER: project tabs (top-level DX / LX / RC filter) ──────────────────────

function renderProjectTabs() {
  const el = document.getElementById('project-tabs');
  if (!el) return;
  // Settings is project-agnostic; hide the tabs there.
  el.classList.toggle('hidden', S.view.section === 'settings');
  el.innerHTML = PROJECTS.map(p => {
    const count = backlogInProject(p).length;
    return `<button class="proj-tab${p === activeProject() ? ' active' : ''}"
                    style="--pc:${PROJ_COLOR[p]}" onclick="setProject('${p}')">
      <span class="proj-tab-key">${p}</span>
      <span class="proj-tab-name">${esc(PROJECT_NAMES[p])}</span>
      ${count ? `<span class="proj-tab-count">${count}</span>` : ''}
    </button>`;
  }).join('');
}

function setProject(p) {
  S.view.project = p;
  save();
  renderApp();
}

// ─── RENDER: Settings ─────────────────────────────────────────────────────────

function renderSettings() {
  const c = S.config;
  document.getElementById('cfg-jira').value    = c.jiraUrl || '';
  document.getElementById('cfg-dur').value     = c.defaultDuration || 14;
  document.getElementById('cfg-future').value  = c.futureCount ?? 4;

  // Locked sprint list (with holidays inline)
  const sprintList = document.getElementById('cfg-sprint-list');
  const locked     = (S.config.sprints || []).slice().sort((a, b) => a.start.localeCompare(b.start));
  if (locked.length) {
    sprintList.innerHTML = locked.map((sp, i) => {
      const dur      = Math.round((new Date(sp.end + 'T00:00:00') - new Date(sp.start + 'T00:00:00')) / 86400000) + 1;
      const wd       = HOLIDAYS.workDays(sp.start, sp.end);
      const holidays = HOLIDAYS.inRange(sp.start, sp.end)
        .map(h => `<span class="holiday-chip">${esc(h.name)}</span>`).join('');
      return `<div class="sprint-list-item">
        <span class="sli-lock">🔒</span>
        <input class="sli-name" type="text" value="${esc(sp.name || '')}"
               placeholder="Sprint ${i + 1}" title="Sprint name"
               onchange="renameSprint('${sp.id}', this.value)">
        <span class="sli-dates">${fmtDate(sp.start)} – ${fmtDate(sp.end)}</span>
        <span class="sli-meta">${dur} cal days · ${wd} work days</span>
        ${holidays}
        <button class="act-btn danger sm" onclick="removeSprint('${sp.id}')" title="Remove">✕</button>
      </div>`;
    }).join('');
  } else {
    sprintList.innerHTML = '<p class="preview-hint" style="padding:6px 0">No locked sprints yet. Add one below.</p>';
  }

  // Suggest next start date (day after last locked sprint end, or today)
  const asdStart = document.getElementById('asd-start');
  if (!asdStart.value) {
    if (locked.length) {
      const last = new Date(locked[locked.length - 1].end + 'T00:00:00');
      last.setDate(last.getDate() + 1);
      asdStart.value = last.toISOString().slice(0, 10);
    } else {
      asdStart.value = new Date().toISOString().slice(0, 10);
    }
    document.getElementById('asd-dur').value = c.defaultDuration || 14;
  }

  // Resolution checkboxes
  const ALL_RES = ['Done', 'Fixed', 'Resolved', 'Completed', 'Complete', 'Closed', "Won't Fix", 'Cannot Reproduce'];
  document.getElementById('cfg-res-list').innerHTML = ALL_RES.map(r => {
    const chk = S.config.resolutions.includes(r) ? 'checked' : '';
    return `<label class="res-item"><input type="checkbox" value="${esc(r)}" ${chk}> ${esc(r)}</label>`;
  }).join('');
  const custom = S.config.resolutions.filter(r => !ALL_RES.includes(r));
  document.getElementById('cfg-res-custom').value = custom.join(', ');
}

// ─── RENDER: Team ─────────────────────────────────────────────────────────────

function renderTeam() {
  const vel     = getVelocity();
  const sprints = getSprints();
  const sp      = sprints[S.view.sprintIdx] || null;

  const container = document.getElementById('team-list');
  const roster    = peopleInProject();
  if (!roster.length) {
    container.innerHTML = `<p class="empty-hint">No ${PROJECT_NAMES[activeProject()]} team members yet. Import a Jira HTML export or add people manually (set their project to ${activeProject()}).</p>`;
    return;
  }

  container.innerHTML = roster.map(p => {
    const v    = vel[p.name];
    const hist = v && v.sprintCount >= 2;
    const avg  = hist ? fmt(v.avg) : (p.goalPoints ? fmt(p.goalPoints)+' (goal)' : '—');
    const cap  = sp ? DATA.computeCapacity(p, sp.start, sp.end, S.leave, vel) : null;

    const leaveHtml = cap && cap.leaveDates.length
      ? cap.leaveDates.map(d=>`<span class="leave-chip">${d}</span>`).join('')
      : '';

    const wfhBadge = p.type === 'contractor'
      ? `<span class="type-badge ctr">CONTRACTOR</span>
         ${cap ? `<span class="wfh-budget">WFH budget: ${fmt(cap.wfhBudgetPts)} pts / ${cap.wfhBudgetDays} days</span>` : ''}`
      : `<span class="type-badge gov">GOV</span>`;

    const projBadge = p.project
      ? `<span class="proj-badge" style="background:${PROJ_COLOR[p.project]}20;color:${PROJ_COLOR[p.project]}">${p.project}</span>`
      : '<span class="proj-badge no-proj">No project</span>';

    return `<div class="person-card" id="pc-${p.id}">
      <div class="pc-head">
        <div class="pc-name-row">
          <span class="pc-name">${esc(p.name)}</span>
          ${projBadge}
          ${wfhBadge}
        </div>
        <div class="pc-actions">
          <button class="act-btn" onclick="openPersonModal('${p.id}')">Edit</button>
          <button class="act-btn danger" onclick="deletePerson('${p.id}')">Remove</button>
        </div>
      </div>
      <div class="pc-meta">
        <span>SID: <code>${esc(p.sid||'—')}</code></span>
        <span>Avg velocity: <strong>${avg}</strong> pts${hist?` (${v.sprintCount} sprints)`:''}</span>
        ${cap?`<span>Sprint capacity: <strong>${cap.adjustedCapacity}</strong> pts (${cap.availDays}/${cap.totalWorkDays} days)</span>`:''}
      </div>
      ${leaveHtml?`<div class="leave-row">Leave: ${leaveHtml}</div>`:''}
    </div>`;
  }).join('');
}

// ─── RENDER: History (velocity dashboard) ─────────────────────────────────────

function renderHistory() {
  const vel = getVelocity();
  const container = document.getElementById('history-content');

  if (!S.historical.length) {
    container.innerHTML = '<p class="empty-hint">Import a historical Jira HTML export to see velocity per person.</p>';
    return;
  }

  // Only show people on the active project tab.
  const proj  = activeProject();
  const names = new Set(peopleInProject(proj).map(p => p.name));
  const entries = Object.entries(vel).filter(([name]) => names.has(name)).sort((a,b)=>b[1].avg-a[1].avg);
  if (!entries.length) {
    container.innerHTML = `<p class="empty-hint">No velocity history for ${PROJECT_NAMES[proj]} yet.</p>`;
    return;
  }

  const rows = entries.map(([name,v]) => {
    const person = S.people.find(p=>p.name===name);
    const color  = proj ? PROJ_COLOR[proj] : '#94a3b8';
    const sprintCols = Object.entries(v.sprintPoints)
      .sort(([a],[b])=>a.localeCompare(b))
      .map(([s,pts])=>`<td class="num">${pts}</td>`)
      .join('');

    return `<tr>
      <td><span class="hist-name">${esc(name)}</span></td>
      <td>${proj?`<span class="proj-badge" style="background:${color}20;color:${color}">${proj}</span>`:'—'}</td>
      <td class="num"><strong>${fmt(v.avg)}</strong></td>
      <td class="num">${v.sprintCount}</td>
      ${sprintCols}
    </tr>`;
  }).join('');

  // Collect all sprint keys for header (only the people shown)
  const allSprints = [...new Set(entries.flatMap(([,v])=>Object.keys(v.sprintPoints)))].sort();

  container.innerHTML = `
    <div class="table-wrap">
      <table class="history">
        <thead>
          <tr>
            <th>Name</th><th>Project</th><th class="num">Avg</th><th class="num">Sprints</th>
            ${allSprints.map(s=>`<th class="num">${esc(s)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── RENDER: Planner ──────────────────────────────────────────────────────────

function renderPlanner() {
  const sprints = getSprints();
  if (!sprints.length) {
    document.getElementById('planner-content').innerHTML =
      '<p class="empty-hint">Add a locked sprint in Settings to get started.</p>';
    return;
  }

  // Sprint tabs
  const tabsEl = document.getElementById('sprint-tabs');
  tabsEl.innerHTML = sprints.map((sp, i) =>
    `<button class="sp-tab${i === S.view.sprintIdx ? ' active' : ''}${sp.locked ? ' locked' : ''}"
             onclick="selectSprint(${i})">
      ${sp.locked ? '<span class="tab-lock">🔒</span>' : ''}${esc(sprintLabel(sp))}
      <span class="sp-tab-dates">${sp.start.slice(5)}</span>
    </button>`
  ).join('');

  // Mode toggle
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === S.view.mode)
  );

  if (S.view.mode === 'multi') {
    renderMultiSprint(sprints);
  } else {
    renderSingleSprint(sprints[S.view.sprintIdx]);
  }
}

function selectSprint(idx) {
  S.view.sprintIdx = idx;
  renderPlanner();
}

function setMode(mode) {
  S.view.mode = mode;
  renderPlanner();
}

function renderSingleSprint(sp) {
  const vel       = getVelocity();
  const proj      = activeProject();
  const people    = peopleInProject(proj);
  const container = document.getElementById('planner-content');

  // Sprint header bar
  const holidays  = sp.holidays.map(h => `<span class="holiday-chip">${esc(h.name)}</span>`).join('');
  const lockBadge = sp.locked
    ? '<span class="locked-badge">🔒 Locked</span>'
    : `<button class="btn btn-sm" onclick="lockAutoSprint(${sp.idx})" title="Lock this sprint's dates so they don't shift when you change the default duration">Lock Sprint</button>`;
  const spHeader = `<div class="sp-header">
    <div class="sp-hd-left">
      ${lockBadge}
      <span class="sp-name">${esc(sprintLabel(sp))}</span>
      <span class="sp-label">${fmtDate(sp.start)} – ${fmtDate(sp.end)}</span>
      <span class="sp-wd-badge">${sp.workDays} work days</span>
      ${holidays}
    </div>
    <div class="sp-hd-right">
      <label class="btn btn-sm">
        ⬆ Load Backlog HTML
        <input type="file" accept=".html,.htm" onchange="handleBacklogUpload(event)" style="display:none">
      </label>
    </div>
  </div>`;

  // Team-member capacity cards across the top.
  const cards = people.length
    ? people.map(p => renderTeamCard(p, sp, vel)).join('')
    : `<p class="empty-hint">No ${PROJECT_NAMES[proj]} team members yet — import a Jira HTML export, or add people in the Team tab.</p>`;

  // Sprint ticket list for this project (unassigned + tickets in this sprint).
  const list = backlogInProject(proj)
    .filter(t => { const a = S.assignments[t.key]; return !a || a.sprintIdx === sp.idx; })
    .sort((a, b) => {
      const pa = S.assignments[a.key]?.personId ? 0 : 1;
      const pb = S.assignments[b.key]?.personId ? 0 : 1;
      return pa - pb || a.key.localeCompare(b.key);
    });
  const assignedCount = list.filter(t => S.assignments[t.key]?.personId).length;
  const rows = list.length
    ? list.map(t => renderTicketListRow(t, people)).join('')
    : '<p class="empty-hint">No tickets for this project in this sprint. Import a backlog HTML export.</p>';

  container.innerHTML = spHeader
    + `<div class="team-cards">${cards}</div>`
    + `<div class="ticket-list">
         <div class="list-hd">Sprint tickets · ${esc(PROJECT_NAMES[proj])}
           <span class="list-hd-sub">${assignedCount} assigned / ${list.length} shown</span>
         </div>
         ${rows}
       </div>`;
}

function renderTeamCard(person, sp, vel) {
  const cap        = DATA.computeCapacity(person, sp.start, sp.end, S.leave, vel);
  const asgPts     = assignedPts(person.id);
  const wfhPt      = wfhPts(person.id);
  const remaining  = cap.adjustedCapacity - asgPts;
  const overBudget = remaining < 0;
  const wfhOver    = person.type === 'contractor' && wfhPt > cap.wfhBudgetPts;
  const pct        = cap.adjustedCapacity > 0 ? Math.min(100, Math.round(asgPts / cap.adjustedCapacity * 100)) : 0;
  const color      = PROJ_COLOR[person.project] || '#94a3b8';
  const capHist    = cap.hasHistory ? '' : '<span class="goal-note" title="No 2+ sprint history yet — using goal points">goal</span>';
  const leaveNote  = cap.leaveDates.length ? `<span class="card-leave" title="${cap.leaveDates.join(', ')}">${cap.leaveDates.length}d leave</span>` : '';

  const wfhBar = person.type === 'contractor'
    ? `<div class="wfh-bar-wrap" title="WFH: ${fmt(wfhPt)} / ${fmt(cap.wfhBudgetPts)} pts budget">
        <span class="wfh-bar-label${wfhOver ? ' over' : ''}">WFH ${fmt(wfhPt)}/${fmt(cap.wfhBudgetPts)} pts</span>
        <div class="wfh-bar"><div class="wfh-fill${wfhOver ? ' over' : ''}" style="width:${Math.min(100, cap.wfhBudgetPts ? Math.round(wfhPt / cap.wfhBudgetPts * 100) : 0)}%"></div></div>
       </div>`
    : '';

  return `<div class="team-card${overBudget ? ' over-budget' : ''}" style="border-top:3px solid ${color}">
    <div class="tc-head">
      <span class="tc-name">${esc(person.name)}</span>
      <span class="type-badge ${person.type === 'contractor' ? 'ctr' : 'gov'}">${person.type === 'contractor' ? 'CTR' : 'GOV'}</span>
      ${capHist}
    </div>
    <div class="tc-pts${overBudget ? ' over' : ''}">
      <strong>${asgPts}</strong> / ${cap.adjustedCapacity} pts
      <span class="cap-remain">${remaining >= 0 ? `${remaining} left` : `${-remaining} over`}</span>
    </div>
    <div class="cap-bar"><div class="cap-fill${overBudget ? ' over' : ''}" style="width:${pct}%"></div></div>
    ${wfhBar}
    ${leaveNote ? `<div class="tc-leave">${leaveNote}</div>` : ''}
  </div>`;
}

function renderTicketListRow(t, people) {
  const a        = S.assignments[t.key] || {};
  const assigned = !!a.personId;
  const wfh      = !!a.wfh;
  const color    = PROJ_COLOR[t.project] || '#94a3b8';
  const epic     = t.epicName ? `<span class="epic-label">${esc(t.epicName)}</span>` : '';
  const clickable = t.description || t.summary;
  const summary  = clickable
    ? `<span class="t-summary t-link" onclick="openDesc('${esc(t.key)}')" title="View details">${esc(t.summary)}</span>`
    : `<span class="t-summary">${esc(t.summary)}</span>`;

  const assigneeSel = `<select class="assign-sel sm" onchange="assignFromSelect('${esc(t.key)}',this)">
      <option value="">— Unassigned —</option>
      ${people.map(p => `<option value="${p.id}"${a.personId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
    </select>`;

  const wfhPill = assigned
    ? `<button class="wfh-pill${wfh ? ' active' : ''}" onclick="toggleWFH('${esc(t.key)}')" title="Toggle WFH">WFH</button>`
    : '';

  const spSel = (assigned && getSprints().length > 1)
    ? `<select class="assign-sel sm" onchange="moveToSprint('${esc(t.key)}',+this.value)" title="Move to sprint">
        ${getSprints().map((sp, i) => `<option value="${i}"${i === S.view.sprintIdx ? ' selected' : ''}>${esc(sprintLabel(sp))}</option>`).join('')}
      </select>`
    : '';

  return `<div class="ticket-row${assigned ? '' : ' unassigned'}" data-key="${esc(t.key)}">
    <div class="ticket-main">
      <span class="t-key" style="color:${color}">${jiraLink(t.key)}</span>
      ${epic}
      ${summary}
    </div>
    <div class="ticket-meta">
      <span class="t-pts">${t.points || '?'} pts</span>
      ${assigneeSel}
      ${wfhPill}
      ${spSel}
    </div>
  </div>`;
}

function renderMultiSprint(sprints) {
  const vel       = getVelocity();
  const proj      = activeProject();
  const people    = peopleInProject(proj);
  const container = document.getElementById('planner-content');

  const cols = sprints.map((sp,i) => {
    const totalCapacity = people.reduce((s,p) => {
      const cap = DATA.computeCapacity(p, sp.start, sp.end, S.leave, vel);
      return s + cap.adjustedCapacity;
    }, 0);
    const totalAssigned = people.reduce((s,p) => {
      return s + assignedTickets(p.id, i).reduce((x,t) => x+(t.points||0), 0);
    }, 0);
    const pct = totalCapacity > 0 ? Math.min(100,Math.round(totalAssigned/totalCapacity*100)) : 0;
    const hl  = sp.holidays.map(h=>`<span class="holiday-chip sm">${esc(h.name)}</span>`).join('');

    return `<div class="multi-col">
      <div class="multi-col-hd">
        <div class="mc-title">${esc(sprintLabel(sp))}</div>
        <div class="mc-dates">${sp.start.slice(5)} – ${sp.end.slice(5)}</div>
        <div class="mc-wd">${sp.workDays} days ${hl}</div>
        <div class="cap-bar" style="margin-top:6px">
          <div class="cap-fill" style="width:${pct}%"></div>
        </div>
        <div class="mc-cap">${totalAssigned} / ${totalCapacity} pts</div>
      </div>
      <div class="mc-tickets">
        ${backlogInProject(proj).filter(t=>(S.assignments[t.key]?.sprintIdx??0)===i&&S.assignments[t.key]?.personId)
          .map(t=>{
            const a = S.assignments[t.key];
            const person = personById(a.personId);
            const color = PROJ_COLOR[t.project]||'#94a3b8';
            return `<div class="mc-ticket">
              <span style="color:${color}">${esc(t.key)}</span>
              <span class="mc-pts">${t.points||'?'}</span>
              ${person?`<span class="mc-assignee">${esc(person.name.split(' ')[0])}</span>`:''}
              ${a.wfh?'<span class="wfh-pill active sm">WFH</span>':''}
            </div>`;
          }).join('') || '<p class="mc-empty">No tickets assigned</p>'}
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="multi-grid">${cols}</div>`;
}

// ─── ASSIGN HELPERS ───────────────────────────────────────────────────────────

function assignFromSelect(key, sel) {
  assignTicket(key, sel.value);   // '' unassigns; re-render rebuilds the select
}

function handleBacklogUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  readFile(file, handleBacklogHTML);
  e.target.value = '';
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // File inputs
  document.getElementById('hist-input').addEventListener('change', e => {
    const f = e.target.files[0]; if(f) readFile(f,handleHistoricalHTML); e.target.value='';
  });
  document.getElementById('ical-input').addEventListener('change', e => {
    const f = e.target.files[0]; if(f) readFile(f,handleICAL); e.target.value='';
  });
  document.getElementById('import-input').addEventListener('change', e => {
    const f = e.target.files[0]; if(f) readFile(f,t=>importData(t)); e.target.value='';
  });

  // ESC closes panels/modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDesc(); closePersonModal(); }
  });

  renderApp();
});
