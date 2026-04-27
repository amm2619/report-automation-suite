// ============================================================
// SPIN PLAN — ENGINE
// Ported from roadmap_v59. All key links go through jiraLink()
// using ReportSuite's .tk-c class and configured base URL.
// ============================================================

// ── Spin state (extends S) ──────────────────────────────────
S.spin = {
  issues: [],
  tree: [],
  view: 'list',       // 'list' | 'col' | 'spin'
  sprintCount: 5,
  depNotes: {},
  depClosed: {},
  manualDeps: [],
  filterText: '',
  filterStatus: '',
  filterProject: '',
  _sort: { col: 'key', dir: 1 },
  _showAllEpics: {},
  _statsCache: {},
  _nodeMap: {},
  _todayStr: new Date().toISOString().slice(0, 10),
};

// ── Roadmap-compatible utils (use RS esc/jiraLink) ──────────
const _snl = v => ((v || '').trim()).toLowerCase().replace(/\s+/g, ' ');
const SPIN_DONE = new Set(['done', 'closed', 'resolved', 'complete', 'completed', 'released',
  'shipped', 'delivered', 'accepted', 'verified', 'cancelled', 'canceled',
  'abandoned', 'wontfix', 'won\'t fix', 'obsolete', 'duplicate', 'rejected']);
const spinIsDone = s => SPIN_DONE.has(_snl(s));

// Classify a Jira status into one of 5 buckets for rendering.
// Uses substring matching so custom statuses like "Dev In Progress"
// or "Awaiting QA Review" still get meaningful color treatment.
function spinStatusCategory(s) {
  const l = _snl(s);
  if (!l) return 'open';
  if (SPIN_DONE.has(l)) return 'done';
  if (l === 'blocked' || /\b(block|impediment|on.?hold|stuck|waiting\s+on)\b/.test(l)) return 'blocked';
  if (/\b(progress|in.?dev|develop|implement|coding|active)\b/.test(l)) return 'inprogress';
  if (/\b(review|code.?review|peer.?review|in.?test|testing|qa|verify|verification|staging|awaiting|ready.?for|integration|deploy|release)\b/.test(l)) return 'review';
  if (/\b(backlog|to.?do|todo|open|new|planned|draft|icebox|proposed|candidate|grooming|refinement|selected|ready)\b/.test(l)) return 'open';
  return 'open';
}

function spinIsBehind(issue) {
  if (spinIsDone(issue.status)) return false;
  const ce = spinMatchCalFast(issue);
  if (!ce) return false;
  return normSpinDate(ce.end) < S.spin._todayStr;
}
function normSpinDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return String(s);
  return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
}
function spinMatchCal(name) {
  if (!name) return null;
  const n = _snl(name);
  const m = n.match(/(\d{2}\.\d+\.\d+)/);
  const bare = m ? m[1] : n;
  const cal = S.cfg.sprint_calendar || [];
  return cal.find(s => {
    const sn = _snl(s.sprint);
    return n === sn || sn === bare || n.includes(sn) || sn.includes(bare);
  }) || null;
}

// Match a sprint calendar entry by target end date (for issues with no sprint)
function spinMatchCalByDate(targetEndDate) {
  if (!targetEndDate) return null;
  const cal = S.cfg.sprint_calendar || [];
  return cal.find(s => s.start <= targetEndDate && targetEndDate <= s.end) || null;
}
function spinMatchCalFast(issue) {
  if (issue._calEntry !== undefined) return issue._calEntry;
  return spinMatchCal(issue.sprint || '');
}
function sprintToSpin(id) {
  const p = (id || '').split('.');
  return p.length >= 2 ? `Q${p[1]} FY${p[0]}` : (id || '');
}
function spinUid(s) { return (s || '').replace(/[^a-zA-Z0-9\-]/g, '_'); }

// ── Jira SVG icons (Atlaskit-style) ────────────────────────
const SPIN_BLOCKED_ICON = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#FF5630"/><rect x="3" y="7" width="10" height="2" rx="1" fill="#fff"/></svg>`;
const SPIN_DEP_ICON = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6.5 4.5h-1A3 3 0 005 10.5h1a1 1 0 000-2H5a1 1 0 010-2h1.5a1 1 0 000-2zm3 0a1 1 0 000 2H11a1 1 0 010 2h-1.5a1 1 0 000 2H11A3 3 0 0011 4.5h-1.5zm-3.5 4a1 1 0 000 2h3a1 1 0 000-2H6z" fill="currentColor"/></svg>`;

const SPIN_ISSUE_ICONS = {
  epic:     `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#6554C0" width="16" height="16" rx="3"/><path d="M7 13l4.5-6H8.5L9 3 4.5 9H7.5L7 13z" fill="#fff"/></svg>`,
  story:    `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#36B37E" width="16" height="16" rx="3"/><path d="M10.5 3h-5C5 3 4.5 3.5 4.5 4v9l3.5-2 3.5 2V4c0-.5-.5-1-1-1z" fill="#fff"/></svg>`,
  bug:      `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#FF5630" width="16" height="16" rx="3"/><circle cx="8" cy="9" r="3" fill="#fff"/><circle cx="8" cy="5.5" r="1.5" fill="#fff"/><rect x="6.5" y="6.5" width="3" height="1" fill="#FF5630" rx=".5"/></svg>`,
  task:     `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#2684FF" width="16" height="16" rx="3"/><path d="M4 8l3 3 5-5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  subtask:  `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#2684FF" width="16" height="16" rx="3" opacity=".7"/><path d="M4.5 8.5l2.5 2.5L11 6" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  strategy: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#00B8D9" width="16" height="16" rx="3"/><circle cx="8" cy="8" r="4" stroke="#fff" stroke-width="1.5" fill="none"/><circle cx="8" cy="8" r="1.5" fill="#fff"/></svg>`,
  program:  `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#FF8B00" width="16" height="16" rx="3"/><rect x="3" y="4.5" width="4" height="2" rx="1" fill="#fff"/><rect x="3" y="7.5" width="7" height="2" rx="1" fill="#fff"/><rect x="3" y="10" width="5" height="1.5" rx=".75" fill="#fff"/></svg>`,
};

function spinIssueIcon(it, size) {
  const t = _snl(it || '');
  const sz = size || 13;
  let key = t === 'epic' ? 'epic'
    : (t === 'story' || t === 'user story' || t === 'user request') ? 'story'
    : (t === 'bug' || t === 'defect') ? 'bug'
    : t === 'task' ? 'task'
    : (t === 'sub-task' || t === 'subtask') ? 'subtask'
    : t === 'strategy' ? 'strategy'
    : t === 'program' ? 'program'
    : null;
  if (!key) return '';
  const svg = SPIN_ISSUE_ICONS[key];
  return `<span style="display:inline-flex;align-items:center;flex-shrink:0;width:${sz}px;height:${sz}px;margin-right:3px;vertical-align:middle">${svg}</span>`;
}
function spinBlockedIcon(size) {
  const sz = size || 13;
  return `<span style="display:inline-flex;align-items:center;flex-shrink:0;width:${sz}px;height:${sz}px;vertical-align:middle">${SPIN_BLOCKED_ICON}</span>`;
}
function spinDepIcon(size) {
  const sz = size || 14;
  return `<span style="display:inline-flex;align-items:center;flex-shrink:0;width:${sz}px;height:${Math.round(sz*0.75)}px;vertical-align:middle;color:var(--a2)">${SPIN_DEP_ICON}</span>`;
}
function spinStatusIcon(s) {
  const cat = spinStatusCategory(s);
  if (cat === 'blocked')    return spinBlockedIcon(11) + ' ';
  if (cat === 'done')       return '<span class="u-iflex-mr2"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#36B37E"/><path d="M2.5 5l1.8 1.8 3.2-3.2" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  if (cat === 'inprogress') return '<span class="u-iflex-mr2"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#0052CC"/><circle cx="5" cy="5" r="2" fill="#fff"/></svg></span>';
  if (cat === 'review')     return '<span class="u-iflex-mr2"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#6554C0"/><path d="M3 5h4M5 3v4" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg></span>';
  return '<span class="u-iflex-mr2"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="#8A97B8" stroke-width="1.5"/></svg></span>';
}
function spinSbClass(s) { const cat = spinStatusCategory(s); return cat === 'blocked' ? 'sbl' : cat === 'done' ? 'sd' : cat === 'inprogress' ? 'sip' : cat === 'review' ? 'srv' : 'sop'; }
function spinStatusBadge(s) { if (!s) return ''; return `<span class="sb ${spinSbClass(s)}">${spinStatusIcon(s)}${esc(s)}</span>`; }

// ── Key link — all keys go through RS jiraLink with .tk-c ───
function spinKeyLink(key, dim) {
  return jiraLink(key, dim ? 'tk-c' : 'tk-c');
}

// Dep key link uses a2 color to stay visually distinct
function spinDepKeyLink(key) {
  const base = S.cfg.jira_url || ''.trim().replace(/\/+$/, '');
  if (base) return `<a href="${base}/browse/${esc(key)}" target="_blank" class="dep-key">${esc(key)}</a>`;
  return `<span class="dep-key">${esc(key)}</span>`;
}

// Badge helpers
function spinBehindBadge(n, onclick) {
  if (!n) return `<span class="badge b-placeholder"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>0</span>`;
  const e = onclick ? ` onclick="${onclick}"` : '';
  return `<span class="badge b-behind"${e} title="${n} behind schedule"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>${n}</span>`;
}
function spinBlockedBadge(n, onclick) {
  if (!n) return `<span class="badge b-placeholder">${spinBlockedIcon(11)} 0</span>`;
  const e = onclick ? ` onclick="${onclick}"` : '';
  return `<span class="badge b-blocked"${e} title="${n} blocked">${spinBlockedIcon(11)} ${n}</span>`;
}
function spinDepBadge(n, onclick) {
  if (!n) return `<span class="badge b-placeholder">${spinDepIcon(14)} 0</span>`;
  const e = onclick ? ` onclick="${onclick}"` : '';
  return `<span class="badge b-dep"${e} title="${n} open ${n > 1 ? 'dependencies' : 'dependency'}">${spinDepIcon(14)} ${n}</span>`;
}
function spinProgBar(pct) {
  const cls = pct >= 67 ? 'prog-green' : pct >= 34 ? 'prog-amber' : 'prog-red';
  return `<div class="prog-bar-outer"><div class="prog-bar-inner ${cls}" style="width:${pct}%"></div></div>`;
}

// ── Issue classification ────────────────────────────────────
// Issue type sets — covers both classic Jira and Jira Plans exports.
// Jira Plans uses: Initiative > Strategy > Program > Epic > Story > Child Issue / Sub-task
const SPIN_STORY_TYPES = new Set(['story','task','sub-task','subtask','bug','defect','user request',
  'improvement','technical task','child issue','child_issue','feature','requirement',
  'new feature','feature request','enhancement','usability','technical debt','research',
  'documentation','help ticket','change request','request for change','user story',
  'defect','change request']);
const SPIN_INITIATIVE_TYPES = new Set(['initiative']);
const SPIN_EPIC_TYPES    = new Set(['epic']);
const SPIN_PROGRAM_TYPES = new Set(['program','capability','feature group']);
const SPIN_STRATEGY_TYPES = new Set(['strategy','theme','objective']);

function spinClassifyLevel(it) {
  const t = _snl(it || '');
  if (SPIN_STRATEGY_TYPES.has(t)) return 'strategy';
  if (SPIN_PROGRAM_TYPES.has(t))  return 'program';
  if (SPIN_INITIATIVE_TYPES.has(t)) return 'initiative';
  if (SPIN_EPIC_TYPES.has(t))     return 'epic';
  if (SPIN_STORY_TYPES.has(t))    return 'story';
  return 'upper';
}

// ── CSV → Spin issue normalizer ─────────────────────────────

// Parse Jira Plans date format: d-mmm-yy (e.g. "1-Apr-26" → "2026-04-01")
function parseSpinDate(v) {
  if (!v) return '';
  v = v.trim();
  // ISO format already
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // d-mmm-yy or d-mmm-yyyy
  const MONTHS = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  const m = v.match(/^(\d{1,2})[\-\/](\w{3})[\-\/](\d{2,4})$/);
  if (!m) return '';
  const day = m[1].padStart(2, '0');
  const mon = MONTHS[m[2].toLowerCase()] || '';
  if (!mon) return '';
  let yr = parseInt(m[3]);
  if (yr < 100) yr = yr < 70 ? 2000 + yr : 1900 + yr;
  return `${yr}-${mon}-${day}`;
}

function normSpinCsvIssue(row) {
  // Handles a single Jira Plans / Roadmap CSV export containing all
  // issue levels (Strategy → Program → Epic → Story) in one file.
  // Hierarchy is expressed via the Parent column, not Epic Link.
  const key = (row['Issue key'] || row['Key'] || '').trim();

  // Sprint: extract from blob or plain text, collect all Sprint.N columns
  const sprints = collectSprints(row); // RS helper handles Sprint, Sprint.1 etc.

  // Parent key: the primary hierarchy link in Jira Plans exports
  const parentKey = (row['Parent'] || row['parent'] || row['Parent Key'] || '').trim();

  // Epic Link: present in classic Jira exports, often absent in Plans exports.
  // Fall back to parentKey when the parent is an epic (resolved later in buildSpinTree).
  const epicLink = (row['Epic Link'] || row['Epic link'] || '').trim();

  // Dep link columns — Jira exports these with various name formats
  const deps = { blockedBy: [], blocking: [] };
  Object.keys(row).forEach(col => {
    const cl = col.toLowerCase();
    const val = (row[col] || '').trim();
    if (!val) return;
    if (cl.includes('is blocked by')) {
      val.split(',').map(k => k.trim()).filter(Boolean)
        .forEach(dk => deps.blockedBy.push({ key: dk, status: '', summary: '' }));
    } else if (cl === 'blocks' || cl.endsWith(' blocks')) {
      val.split(',').map(k => k.trim()).filter(Boolean)
        .forEach(dk => deps.blocking.push({ key: dk, status: '', summary: '' }));
    }
  });

  const commentBody = (row['Comment'] || '').toLowerCase();
  const commentDeps = (commentBody.includes('depend') || commentBody.includes('waiting on'))
    ? [{ author: '', text: row['Comment'] || '', date: '' }] : [];

  return {
    key,
    project: bucketKey(key),
    // `title` is the canonical field (spin plan CSV uses the "Title" column).
    // `summary` is kept as an alias for legacy spin-plan render code.
    title:      (row['Title'] || row['Summary'] || '').trim(),
    summary:    (row['Title'] || row['Summary'] || '').trim(),
    status:     (row['Status'] || row['Issue status'] || row['Issue Status'] || '').trim(),
    issueType:  (row['Hierarchy'] || row['Issue Type'] || '').trim(),
    assignee:   (row['Assignee'] || 'Unassigned').trim(),
    epicLink,                          // may be empty for Plans exports
    epicName:   '',                    // resolved after tree build (from parent epics)
    parentKey,                         // PRIMARY hierarchy field for Jira Plans
    sprint:     sprints[0] || '',
    sprints,
    targetStart: parseSpinDate(row['Target start date'] || row['Target Start Date'] || ''),
    targetEnd:   parseSpinDate(row['Target end date']   || row['Target End Date']   || row['Due date'] || ''),
    priority:   (row['Priority'] || '').trim(),
    components: (row['Components'] || '').trim(),
    labels:     (row['Labels'] || '').trim(),
    points:     parsePoints(row),
    resolvedDt: parseDate(row['Resolved'] || ''),
    updatedDt:  parseDate(row['Updated'] || ''),
    deps,
    commentDeps,
    _calEntry: undefined,
  };
}

// ── Tree builder ────────────────────────────────────────────
function buildSpinTree(issues) {
  const byKey = {};
  issues.forEach(i => byKey[i.key] = i);

  // Build a summary→key lookup as fallback for exports where Parent is text
  const bySummary = {};
  issues.forEach(i => {
    if (i.summary) bySummary[i.summary.trim().toLowerCase()] = i.key;
  });

  function resolveParent(i) {
    if (!i.parentKey) {
      return (i.epicLink && i.epicLink !== i.parentKey && byKey[i.epicLink]) ? i.epicLink : null;
    }
    if (byKey[i.parentKey]) return i.parentKey;                         // key match
    const norm = i.parentKey.trim().toLowerCase();
    if (bySummary[norm]) return bySummary[norm];                        // summary match
    if (i.epicLink && byKey[i.epicLink]) return i.epicLink;             // epicLink fallback
    return null;
  }

  // Build parent→children map.
  const children = {};
  issues.forEach(i => {
    const pKey = resolveParent(i);
    if (pKey) {
      if (!children[pKey]) children[pKey] = [];
      children[pKey].push(i.key);
    }
  });

  function buildNode(key, visiting) {
    if (visiting.has(key)) return null;
    const issue = byKey[key];
    if (!issue) return null;
    const next = new Set(visiting);
    next.add(key);
    return { issue, children: (children[key] || []).map(k => buildNode(k, next)).filter(Boolean) };
  }

  // Root = issues whose parent resolves to something in this dataset
  const hasParentInSet = new Set(
    issues.filter(i => resolveParent(i) !== null).map(i => i.key)
  );
  const roots = issues.filter(i => !hasParentInSet.has(i.key)).map(i => i.key);
  const tree = roots.map(k => buildNode(k, new Set())).filter(Boolean);

  // Index all nodes
  S.spin._nodeMap = {};
  function indexNode(n) { S.spin._nodeMap[n.issue.key] = n; n.children.forEach(indexNode); }
  tree.forEach(indexNode);

  // Any issue not yet indexed is orphaned (e.g. circular ref) — surface as root
  issues.forEach(i => {
    if (!S.spin._nodeMap[i.key]) {
      const node = { issue: i, children: [] };
      tree.push(node);
      indexNode(node);
    }
  });

  // Resolve epicName for stories: walk up tree to nearest epic ancestor
  function resolveEpicName(node, nearestEpicKey, nearestEpicName) {
    const lvl = spinClassifyLevel(node.issue.issueType);
    if (lvl === 'epic') {
      nearestEpicKey  = node.issue.key;
      nearestEpicName = node.issue.summary;
    }
    // Backfill epicLink on stories that only have parentKey
    if ((lvl === 'story') && !node.issue.epicLink && nearestEpicKey) {
      node.issue.epicLink  = nearestEpicKey;
      node.issue.epicName  = nearestEpicName;
    }
    node.children.forEach(c => resolveEpicName(c, nearestEpicKey, nearestEpicName));
  }
  tree.forEach(root => resolveEpicName(root, '', ''));

  return tree;
}

// ── Lightweight engine: parse + build tree without rendering ─
// Called by initSpinFromStorage to pre-populate S.spin on page
// load so the dep count chip in the status bar shows correctly.
function runSpinEngine(spinRows) {
  if (!spinRows || !spinRows.length) return;
  const issues = spinRows.map(row => normSpinCsvIssue(row));
  const cal = S.cfg.sprint_calendar || [];
  issues.forEach(i => {
    i._calEntry = spinMatchCal(i.sprint) || spinMatchCalByDate(i.targetEnd);
  });
  S.spin.issues = issues;
  S.spin.tree = buildSpinTree(issues);
  spinBuildCalIdx();
  S.spin._todayStr = new Date().toISOString().slice(0, 10);
}

// ── Stats ───────────────────────────────────────────────────
function spinCollectLeaves(node, depth) {
  if ((depth || 0) > 50) return [];
  if (spinClassifyLevel(node.issue.issueType) === 'story') return [node.issue];
  return node.children.flatMap(c => spinCollectLeaves(c, (depth || 0) + 1));
}
function spinGatherDeps(n) {
  const d = { blockedBy: [], blocking: [], commentDeps: [] };
  const add = i => { d.blockedBy.push(...(i.deps?.blockedBy || [])); d.blocking.push(...(i.deps?.blocking || [])); d.commentDeps.push(...(i.commentDeps || [])); };
  add(n.issue);
  spinCollectLeaves(n).forEach(s => add(s));
  n.children.forEach(ch => { const cd = spinGatherDeps(ch); d.blockedBy.push(...cd.blockedBy); d.blocking.push(...cd.blocking); d.commentDeps.push(...cd.commentDeps); });
  d.blockedBy = Object.values(Object.fromEntries(d.blockedBy.filter(x => x.key).map(x => [x.key, x])));
  d.blocking = Object.values(Object.fromEntries(d.blocking.filter(x => x.key).map(x => [x.key, x])));
  return d;
}
function spinNodeStats(node) {
  const stories = spinCollectLeaves(node);
  const total = stories.length;
  const done = stories.filter(s => spinIsDone(s.status)).length;
  const blocked = stories.filter(s => spinStatusCategory(s.status) === 'blocked').length;
  const behind = stories.filter(s => spinIsBehind(s)).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const spinMap = {};
  stories.forEach(s => {
    if (!s.sprint) return;
    const cal = spinMatchCalFast(s);
    const spin = sprintToSpin(cal ? cal.sprint : s.sprint);
    if (!spinMap[spin]) spinMap[spin] = { total: 0, done: 0 };
    spinMap[spin].total++;
    if (spinIsDone(s.status)) spinMap[spin].done++;
  });
  const deps = spinGatherDeps(node);
  return { total, done, blocked, behind, pct, deps };
}

// ── Summary bar stats ───────────────────────────────────────
function spinGlobalStats() {
  const issues = S.spin.issues;
  const stories = issues.filter(i => spinClassifyLevel(i.issueType) === 'story');
  const total = stories.length;
  const done = stories.filter(s => spinIsDone(s.status)).length;
  const inprog = stories.filter(s => spinStatusCategory(s.status) === 'inprogress').length;
  const blocked = stories.filter(s => spinStatusCategory(s.status) === 'blocked').length;
  const behind = stories.filter(s => spinIsBehind(s)).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return { total, done, inprog, blocked, behind, pct };
}

// ── Sprint strip ────────────────────────────────────────────
function renderSpinStrip(container) {
  const cal = S.cfg.sprint_calendar || [];
  const today = S.spin._todayStr;
  const count = S.spin.sprintCount || 5;
  // find current sprint index
  let curIdx = cal.findIndex(s => normSpinDate(s.start) <= today && today <= normSpinDate(s.end));
  if (curIdx < 0) curIdx = cal.findIndex(s => normSpinDate(s.start) > today) - 1;
  if (curIdx < 0) curIdx = 0;
  const start = Math.max(0, curIdx - 1);
  const slice = cal.slice(start, start + count);
  const issues = S.spin.issues;
  const chips = slice.map(s => {
    const inSprint = issues.filter(i => (i.sprints || [i.sprint]).some(sp => {
      const n = _snl(sp); return n.includes(_snl(s.sprint));
    }));
    const total = inSprint.filter(i => spinClassifyLevel(i.issueType) === 'story').length;
    const done = inSprint.filter(i => spinClassifyLevel(i.issueType) === 'story' && spinIsDone(i.status)).length;
    const end = normSpinDate(s.end);
    const start2 = normSpinDate(s.start);
    const isCurrent = start2 <= today && today <= end;
    const isPast = end < today;
    const isFuture = start2 > today;
    const allDone = total > 0 && done === total;
    const cls = isCurrent ? 'active' : isPast && allDone ? 'done' : isPast ? 'incomplete' : 'future';
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="sprint-chip ${cls}" title="${esc(s.sprint)}: ${done}/${total} stories done">${esc(s.sprint)}${total ? ` <span class="sc-cnt">${pct}%</span>` : ''}</div>`;
  }).join('');
  container.innerHTML = `<div class="spin-strip">${chips || '<span class="u-dim-xs">No sprint calendar — add sprints in Settings → Configuration</span>'}</div>`;
}

// ── Story table ─────────────────────────────────────────────
function renderSpinStoryTable(stories, epicId) {
  if (!stories.length) return `<div class="dep-empty" style="padding:8px 14px">No stories</div>`;
  const sort = S.spin._sort;
  const sorted = [...stories].sort((a, b) => {
    let av, bv;
    if (sort.col === 'key') { av = a.key; bv = b.key; }
    else if (sort.col === 'status') { av = a.status; bv = b.status; }
    else if (sort.col === 'pts') { av = a.points || 0; bv = b.points || 0; }
    else if (sort.col === 'assignee') { av = a.assignee; bv = b.assignee; }
    else if (sort.col === 'sprint') { av = a.sprint; bv = b.sprint; }
    else { av = a.key; bv = b.key; }
    return typeof av === 'number'
      ? (av - bv) * sort.dir
      : String(av).localeCompare(String(bv)) * sort.dir;
  });
  const thSort = (col, label) => {
    const active = sort.col === col;
    const arrow = active ? (sort.dir === 1 ? '<span class="mi" style="font-size:11px">arrow_upward</span>' : '<span class="mi" style="font-size:11px">arrow_downward</span>') : '<span class="mi" style="font-size:11px">swap_vert</span>';
    return `<th onclick="spinSortStories('${epicId}','${col}')" style="cursor:pointer">
      <span class="th-sort">${label} <span class="th-sort-icon${active ? ' active' : ''}">${arrow}</span></span></th>`;
  };
  const rows = sorted.map(s => {
    const behind = spinIsBehind(s);
    const blocked = spinStatusCategory(s.status) === 'blocked';
    const done = spinIsDone(s.status);
    const rowCls = blocked ? 'blocked' : behind ? 'behind' : done ? 'done' : '';
    return `<tr class="${rowCls}">
      <td style="white-space:nowrap">${spinIssueIcon(s.issueType, 12)}${spinKeyLink(s.key)}</td>
      <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px" title="${esc(s.summary)}">${esc(s.summary)}</td>
      <td>${spinStatusBadge(s.status)}</td>
      <td style="text-align:right;color:var(--mu);font-family:var(--mono);font-size:var(--fs-xs)">${s.points || ''}</td>
      <td style="color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:var(--fs-xs)" title="${esc(s.assignee)}">${esc(s.assignee)}</td>
      <td style="color:var(--mu);font-size:var(--fs-xs);white-space:nowrap">${esc(s.sprint || '')}</td>
    </tr>`;
  }).join('');
  return `<div class="tw" style="margin:0">
    <table class="stbl">
      <colgroup><col style="width:90px"><col><col style="width:120px"><col style="width:36px"><col style="width:110px"><col style="width:100px"></colgroup>
      <thead><tr>
        ${thSort('key','Key')}
        ${thSort('summary','Summary')}
        ${thSort('status','Status')}
        ${thSort('pts','Pts')}
        ${thSort('assignee','Assignee')}
        ${thSort('sprint','Sprint')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function spinSortStories(epicId, col) {
  if (S.spin._sort.col === col) S.spin._sort.dir *= -1;
  else { S.spin._sort.col = col; S.spin._sort.dir = 1; }
  // Re-render just the stories panel
  const node = S.spin._nodeMap[epicId];
  if (!node) return;
  const panel = document.getElementById('spin-stories-' + spinUid(epicId));
  if (panel) panel.innerHTML = renderSpinStoryTable(spinCollectLeaves(node), epicId);
}

// ── Dep panel ───────────────────────────────────────────────
function renderSpinDepPanel(deps, epicKey) {
  const items = [...deps.blockedBy, ...deps.blocking];
  const open = items.filter(d => !S.spin.depClosed[epicKey + '_' + d.key]);
  if (!open.length && !deps.commentDeps.length) return `<div class="dep-empty">No open dependencies</div>`;
  let html = '';
  if (open.length) {
    html += open.map(d => {
      const id = epicKey + '_' + d.key;
      const note = S.spin.depNotes[id] || '';
      const resolved = !!S.spin.depClosed[id];
      return `<div class="dep-item${resolved ? ' resolved' : ''}">
        <div class="dep-hdr">
          ${spinDepKeyLink(d.key)}
          ${d.status ? spinStatusBadge(d.status) : ''}
          <span class="dep-sum">${esc(d.summary || '')}</span>
          <button class="btn btn-xs btn-ghost" onclick="spinToggleDepClosed('${esc(id)}','${esc(epicKey)}')">${resolved ? 'Reopen' : 'Resolve'}</button>
        </div>
        <textarea class="dep-note" rows="1" placeholder="Add note…" onchange="spinSaveDepNote('${esc(id)}')">${esc(note)}</textarea>
      </div>`;
    }).join('');
  }
  if (deps.commentDeps.length) {
    html += `<div class="dep-sec-title" style="margin-top:10px;font-size:var(--fs-xs);font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.5px">Comment Dependencies</div>`;
    html += deps.commentDeps.slice(0, 3).map(c => `<div class="dep-item"><div style="font-size:var(--fs-xs);color:var(--mu);margin-bottom:3px">${esc(c.author)}${c.date ? ' · ' + esc(c.date) : ''}</div><div style="font-size:var(--fs-sm);color:var(--tx)">${esc((c.text || '').slice(0, 300))}</div></div>`).join('');
  }
  return html;
}

function spinToggleDepClosed(id, epicKey) {
  S.spin.depClosed[id] = !S.spin.depClosed[id];
  const el = document.getElementById('spin-deps-' + spinUid(epicKey));
  if (el) {
    const node = S.spin._nodeMap[epicKey];
    if (node) el.innerHTML = renderSpinDepPanel(spinGatherDeps(node), epicKey);
  }
}
function spinSaveDepNote(id) {
  const ta = document.querySelector(`textarea[onchange="spinSaveDepNote('${id}')"]`);
  if (ta) S.spin.depNotes[id] = ta.value;
}

// ── Epic row (level 2) ──────────────────────────────────────
function renderSpinEpicRow(node) {
  const issue = node.issue;
  const stats = spinNodeStats(node);
  const id = spinUid(issue.key);
  const stories = spinCollectLeaves(node);
  const openDeps = [...stats.deps.blockedBy, ...stats.deps.blocking].filter(d => !S.spin.depClosed[issue.key + '_' + d.key]);
  const projCls = issue.project === 'DX' ? 'b-dx' : issue.project === 'LX' ? 'b-lx' : issue.project === 'RC' ? 'b-rc' : '';
  const pctCls = stats.pct >= 67 ? 'prog-green' : stats.pct >= 34 ? 'prog-amber' : 'prog-red';

  return `<div class="lrow" id="spinrow-${id}">
    <div class="l2-hdr" id="spinl2-${id}" onclick="spinToggleEpic('${id}')">
      <div class="xbtn" id="spinxbtn-${id}">+</div>
      ${spinIssueIcon(issue.issueType, 13)}
      <span class="chev" id="spinchev-${id}">›</span>
      ${projCls ? `<span class="badge b-proj ${projCls}">${esc(issue.project)}</span>` : ''}
      <span style="flex:1;font-size:var(--fs-sm);font-weight:500;color:var(--tx);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(issue.summary)}">${spinKeyLink(issue.key)} ${esc(issue.summary)}</span>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
        ${spinBehindBadge(stats.behind, `event.stopPropagation();spinShowDrill('${id}','behind')`)}
        ${spinBlockedBadge(stats.blocked, `event.stopPropagation();spinShowDrill('${id}','blocked')`)}
        ${spinDepBadge(openDeps.length, `event.stopPropagation();spinShowDrill('${id}','deps')`)}
        <div class="prog-wrap" style="min-width:70px">
          ${spinProgBar(stats.pct)}
          <div class="prog-meta"><span class="prog-pct">${stats.pct}%</span><span class="prog-cnt">${stats.done}/${stats.total}</span></div>
        </div>
      </div>
    </div>
    <div class="l2-body" id="spinl2body-${id}">
      <div class="detail-panel">
        <div class="dtabs">
          <button class="dtab active" onclick="spinSwitchDtab('${id}','stories')">Stories (${stories.length})</button>
          <button class="dtab" onclick="spinSwitchDtab('${id}','deps')">Dependencies${openDeps.length ? ` (${openDeps.length})` : ''}</button>
        </div>
        <div class="dpanel active" id="spin-stories-${id}">${renderSpinStoryTable(stories, issue.key)}</div>
        <div class="dpanel" id="spin-deps-${id}">${renderSpinDepPanel(stats.deps, issue.key)}</div>
      </div>
    </div>
  </div>`;
}

function spinToggleEpic(id) {
  const body = document.getElementById('spinl2body-' + id);
  const hdr = document.getElementById('spinl2-' + id);
  const xbtn = document.getElementById('spinxbtn-' + id);
  const chev = document.getElementById('spinchev-' + id);
  if (!body) return;
  const open = body.classList.toggle('open');
  if (hdr) hdr.classList.toggle('open', open);
  if (xbtn) { xbtn.classList.toggle('open', open); xbtn.textContent = open ? '−' : '+'; }
  if (chev) chev.classList.toggle('open', open);
}

function spinSwitchDtab(id, tab) {
  const tabs = document.querySelectorAll(`[id^="spinl2body-${id}"] .dtab`);
  const panels = document.querySelectorAll(`[id^="spinl2body-${id}"] .dpanel`);
  tabs.forEach((t, i) => { t.classList.toggle('active', (i === 0 && tab === 'stories') || (i === 1 && tab === 'deps')); });
  panels.forEach((p, i) => { p.classList.toggle('active', (i === 0 && tab === 'stories') || (i === 1 && tab === 'deps')); });
}

// ── Program row (level 1) ───────────────────────────────────
function renderSpinProgramRow(node) {
  const issue = node.issue;
  const stats = spinNodeStats(node);
  const id = spinUid(issue.key);
  const epics = node.children.filter(c => spinClassifyLevel(c.issue.issueType) === 'epic');
  const noEpicStories = node.children.filter(c => spinClassifyLevel(c.issue.issueType) === 'story');
  const pctCls = stats.pct >= 67 ? 'c-green' : stats.pct >= 34 ? 'c-amber' : 'c-red';

  const epicRows = epics.map(e => renderSpinEpicRow(e)).join('');
  const noEpicSection = noEpicStories.length
    ? `<div class="no-epic-row"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>${noEpicStories.length} stor${noEpicStories.length > 1 ? 'ies' : 'y'} not linked to an epic</div>` : '';

  return `<div class="l1-hdr" onclick="spinToggleLevel('l1body-${id}','l1chev-${id}')">
    <span class="chev" id="l1chev-${id}">›</span>
    ${spinIssueIcon(issue.issueType, 13)}
    <span class="l1-badge">PROG</span>
    <span class="l1-title">${spinKeyLink(issue.key)} ${esc(issue.summary)}</span>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
      <span class="${pctCls}" style="font-size:var(--fs-xs);font-weight:700;font-family:var(--mono)">${stats.pct}%</span>
      <span class="u-muted-xs">${stats.done}/${stats.total}</span>
    </div>
  </div>
  <div class="l1-body" id="l1body-${id}">
    ${noEpicSection}${epicRows || '<div style="padding:8px 14px;font-size:var(--fs-sm);color:var(--mu);font-style:italic">No epics</div>'}
  </div>`;
}

// ── Strategy row (level 0) ──────────────────────────────────
function renderSpinStrategyRow(node) {
  const issue = node.issue;
  const stats = spinNodeStats(node);
  const id = spinUid(issue.key);
  const pctCls = stats.pct >= 67 ? 'c-green' : stats.pct >= 34 ? 'c-amber' : 'c-red';
  const programs = node.children.filter(c => spinClassifyLevel(c.issue.issueType) === 'program');
  const directEpics = node.children.filter(c => spinClassifyLevel(c.issue.issueType) === 'epic');

  const inner = [
    ...programs.map(p => renderSpinProgramRow(p)),
    ...directEpics.map(e => renderSpinEpicRow(e))
  ].join('');

  return `<div class="lrow">
    <div class="l0-hdr" onclick="spinToggleLevel('l0body-${id}','l0chev-${id}')">
      <span class="chev open" id="l0chev-${id}">›</span>
      ${spinIssueIcon(issue.issueType, 13)}
      <span class="l0-badge">STRATEGY</span>
      <span class="l0-title">${spinKeyLink(issue.key)} ${esc(issue.summary)}</span>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        ${spinProgBar(stats.pct)}
        <span class="${pctCls}" style="font-size:var(--fs-xs);font-weight:700;font-family:var(--mono);min-width:28px;text-align:right">${stats.pct}%</span>
        <span class="u-muted-xs">${stats.done}/${stats.total}</span>
      </div>
    </div>
    <div class="l0-body open" id="l0body-${id}">${inner}</div>
  </div>`;
}

function spinToggleLevel(bodyId, chevId) {
  const body = document.getElementById(bodyId);
  const chev = document.getElementById(chevId);
  if (!body) return;
  const open = body.classList.toggle('open');
  if (chev) chev.classList.toggle('open', open);
}

// ── Flat list view (topic-grouped) ─────────────────────────
function renderSpinListView(tree) {
  const topics = S.topics || [];
  const filter = (S.spin.filterText || '').toLowerCase();
  const fStatus = (S.spin.filterStatus || '').toLowerCase();
  const fProject = (S.spin.filterProject || '').toLowerCase();
  const nodeMap = S.spin._nodeMap || {};

  // Collect all epic nodes
  const allEpicNodes = Object.values(nodeMap).filter(n =>
    spinClassifyLevel(n.issue.issueType) === 'epic'
  );

  // Apply filters
  const filtered = allEpicNodes.filter(n => {
    const issue = n.issue;
    if (fProject && issue.project !== fProject) return false;
    if (fStatus) {
      const leaves = spinCollectLeaves(n);
      if (!leaves.some(s => (s.status||'').toLowerCase().includes(fStatus))) return false;
    }
    if (filter) {
      const txt = (issue.key + ' ' + issue.summary + ' ' + (issue.project||'')).toLowerCase();
      const leaves = spinCollectLeaves(n);
      const leafTxt = leaves.map(s => s.key + ' ' + s.summary).join(' ').toLowerCase();
      if (!txt.includes(filter) && !leafTxt.includes(filter)) return false;
    }
    return true;
  });

  // Group by topic
  const topicGroups = {};
  const ungrouped = [];
  filtered.forEach(n => {
    const topic = _spinMatchTopicForIssue(n.issue, n.issue);
    if (topic) {
      const key = topic.topic_id || topic.id || topic.header;
      if (!topicGroups[key]) topicGroups[key] = { topic, nodes: [] };
      topicGroups[key].nodes.push(n);
    } else {
      ungrouped.push(n);
    }
  });

  // Sort by tier_rank
  const sorted = topics
    .filter(t => topicGroups[t.topic_id || t.id || t.header])
    .map(t => topicGroups[t.topic_id || t.id || t.header]);

  let html = sorted.map(g => spinRenderTierSection(g.topic, g.nodes)).join('');

  if (ungrouped.length) {
    const fakeTopic = { topic_id: '_unmatched', header: 'Unmatched', tier_rank: 99, rank: 99 };
    html += spinRenderTierSection(fakeTopic, ungrouped);
  }

  // Collect stories that are direct roots or whose epic isn't in the tree
  const epicKeys = new Set(allEpicNodes.map(n => n.issue.key));
  const orphanStories = Object.values(nodeMap).filter(n => {
    const lvl = spinClassifyLevel(n.issue.issueType);
    if (lvl !== 'story') return false;
    // orphan if no epic parent found in nodeMap
    const parentNode = n.issue.epicLink ? nodeMap[n.issue.epicLink] : null;
    return !parentNode || !epicKeys.has(n.issue.epicLink);
  }).map(n => n.issue);

  // Apply same filters to orphan stories
  const filteredOrphans = orphanStories.filter(s => {
    if (fProject && s.project !== fProject) return false;
    if (fStatus && !(s.status||'').toLowerCase().includes(fStatus)) return false;
    if (filter) {
      const txt = (s.key + ' ' + s.summary + ' ' + (s.project||'')).toLowerCase();
      if (!txt.includes(filter)) return false;
    }
    return true;
  });

  if (filteredOrphans.length) {
    const orphanRows = filteredOrphans.map(s => {
      const link = spinKeyLink(s.key);
      const sd = 'data-searchable data-text="' + esc((_snl(s.key)+' '+_snl(s.summary)+' '+_snl(s.status)).toLowerCase()) + '" data-status="' + esc(s.status) + '"';
      return '<tr ' + sd + ' style="border-bottom:1px solid var(--bd)"><td style="padding:6px 14px">'
        + '<div class="u-flex-6">'
        + spinIssueIcon(s.issueType,12) + link
        + '<span style="color:var(--bd3)">·</span>'
        + '<span style="font-size:var(--fs-sm);color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.summary) + '</span>'
        + '<span style="margin-left:auto;flex-shrink:0">' + spinStatusBadge(s.status) + '</span>'
        + '</div></td></tr>';
    }).join('');
    const noEpicId = '_noepic';
    html += '<div class="h-section"><div class="lrow">'
      + '<div class="l0-hdr open" id="spin-sh-' + noEpicId + '" onclick="spinToggleSection(\'' + noEpicId + '\')">'
      + '<span class="l0-badge" style="background:var(--s4);color:var(--mu)">—</span>'
      + '<span class="l0-title">No Associated Epic</span>'
      + '<span class="u-muted-xs">' + filteredOrphans.length + ' issue' + (filteredOrphans.length!==1?'s':'') + '</span>'
      + '<span class="chev open" id="spin-sc-' + noEpicId + '">›</span>'
      + '</div>'
      + '<div class="l0-body open" id="spin-sb-' + noEpicId + '">'
      + '<table class="rt" style="width:100%"><tbody>' + orphanRows + '</tbody></table>'
      + '</div></div></div>';
  }

  if (!html) {
    return filter || fStatus || fProject
      ? '<div style="padding:20px;color:var(--di);font-style:italic">No results match the current filters.</div>'
      : '<div style="padding:20px;color:var(--di);font-style:italic">No data. Load a Jira Plans CSV.</div>';
  }
  return html;
}

// ── Column view (by project) ────────────────────────────────

// ── Spin tier section (topic-grouped col/list header) ───────
function spinRenderTierSection(topic, epicNodes) {
  if (!epicNodes.length) return '';
  const tid = spinUid(topic.topic_id || topic.id || topic.header);
  const allStories = epicNodes.flatMap(n => spinCollectLeaves(n));
  const tot = allStories.length;
  const done = allStories.filter(s => spinIsDone(s.status)).length;
  const blocked = allStories.filter(s => spinStatusCategory(s.status) === 'blocked').length;
  const behind = allStories.filter(s => spinIsBehind(s)).length;
  const pct = tot ? Math.round(done / tot * 100) : 0;
  const tierRank = topic.tier_rank ?? topic.rank ?? 99;
  const tierNum = tierRank <= 0 ? 0 : tierRank <= 4 ? 1 : tierRank <= 5 ? 2 : 3;

  const openDeps = epicNodes.reduce((sum, n) => {
    const deps = spinGatherDeps(n);
    return sum + deps.blockedBy.filter(d =>
      !spinIsDone(d.status) && !S.spin.depClosed[`${n.issue.key}_${d.key}`]
    ).length;
  }, 0);

  const pctCls = pct >= 67 ? 'c-green' : pct >= 34 ? 'c-amber' : 'c-red';
  const headerStats = `<span style="display:flex;gap:6px;align-items:center;flex-shrink:0">
    <span class="${pctCls}" style="font-weight:600;font-size:var(--fs-xs)">${pct}%</span>
    <span class="u-muted-xs">${done}/${tot}</span>
    ${spinBehindBadge(behind)}
    ${spinBlockedBadge(blocked)}
    ${openDeps ? spinDepIcon(12) + `<span style="font-size:var(--fs-xs);color:var(--a2)">${openDeps}</span>` : ''}
  </span>`;

  const bodyContent = S.spin.view === 'col'
    ? spinRenderEpicsInCols(epicNodes, tid)
    : spinRenderListInTier(epicNodes, tid);

  return `<div class="h-section">
    <div class="lrow">
      <div class="l0-hdr open" id="spin-sh-${tid}" onclick="spinToggleSection('${tid}')">
        <span class="l0-badge">Tier ${tierNum}</span>
        <span class="l0-title">${esc(topic.header)}</span>
        ${headerStats}
        <span onclick="spinExpandTierEpics('${tid}');event.stopPropagation()" title="Expand all" style="cursor:pointer;padding:3px 6px;border-radius:var(--r2);display:inline-flex;align-items:center;color:var(--mu);background:var(--s4);border:1px solid var(--bd);margin-right:2px"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></svg></span>
        <span onclick="spinCollapseTierEpics('${tid}');event.stopPropagation()" title="Collapse all" style="cursor:pointer;padding:3px 6px;border-radius:var(--r2);display:inline-flex;align-items:center;color:var(--mu);background:var(--s4);border:1px solid var(--bd)"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v2H3V3zm0 8h18v2H3v-2zm0 8h18v2H3v-2z"/></svg></span>
        <span class="chev open" id="spin-sc-${tid}">›</span>
      </div>
      <div class="l0-body open" id="spin-sb-${tid}">${bodyContent}</div>
    </div>
  </div>`;
}

function spinRenderListInTier(epicNodes, tid) {
  // Render epics in list mode — use spinRenderEpicBlock with showProj=true
  let html = '';
  const sorted = spinSortEpicNodes(epicNodes);
  sorted.forEach(n => {
    const lvl = spinClassifyLevel(n.issue.issueType);
    if (lvl === 'epic') {
      html += '<div style="border-bottom:1px solid var(--bd);padding:2px 0">' + spinRenderEpicBlock(n, true) + '</div>';
    } else {
      // Program/Strategy — show header + recurse into child epics
      const childEpics = spinCollectEpics(n);
      const childNodes = childEpics.map(e => S.spin._nodeMap[e.key]).filter(Boolean);
      html += '<div style="padding:6px 14px 2px;font-weight:700;font-size:var(--fs-xs);color:var(--mu);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--bd)">'
        + spinProjBadge(n.issue.project) + ' ' + esc(n.issue.summary) + '</div>';
      childNodes.forEach(cn => {
        html += '<div style="border-bottom:1px solid var(--bd);padding:2px 8px">' + spinRenderEpicBlock(cn, true) + '</div>';
      });
    }
  });
  return html || '<div style="padding:12px;color:var(--di);font-style:italic;font-size:var(--fs-sm)">No epics in this tier.</div>';
}

function spinToggleSection(tid) {
  const sb = document.getElementById('spin-sb-' + tid);
  const sc = document.getElementById('spin-sc-' + tid);
  const sh = document.getElementById('spin-sh-' + tid);
  if (sb) sb.classList.toggle('open');
  if (sc) sc.classList.toggle('open');
  if (sh) sh.classList.toggle('open');
}

function spinExpandTierEpics(tid) {
  const body = document.getElementById('spin-sb-' + tid);
  if (!body) return;
  // sceb- = spinRenderEpicBlock's epic body ID prefix
  body.querySelectorAll('[id^="sceb-"]').forEach(el => {
    if (!el.classList.contains('open')) {
      el.classList.add('open');
      const eid = el.id.replace('sceb-', '');
      const xb = document.getElementById('scxb-' + eid);
      if (xb) { xb.classList.add('open'); xb.textContent = '−'; }
    }
  });
}

function spinCollapseTierEpics(tid) {
  const body = document.getElementById('spin-sb-' + tid);
  if (!body) return;
  body.querySelectorAll('[id^="sceb-"]').forEach(el => {
    if (el.classList.contains('open')) {
      el.classList.remove('open');
      const eid = el.id.replace('sceb-', '');
      const xb = document.getElementById('scxb-' + eid);
      if (xb) { xb.classList.remove('open'); xb.textContent = '+'; }
    }
  });
}

function spinToggleShowAllEpics(tid) {
  if (!S.spin._showAllEpics) S.spin._showAllEpics = {};
  S.spin._showAllEpics[tid] = !S.spin._showAllEpics[tid];
  renderSpinReport();
  setTimeout(() => {
    const el = document.getElementById('spin-sb-' + tid);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

function spinEpicSortKey(node) {
  const projOrder = { DX: 0, LX: 1, RC: 2, AFX: 3 };
  const proj = node.issue.project || '';
  const projRank = projOrder[proj] ?? 4;
  const tierRank = node.issue.topic?.tier_rank ?? node.issue.topic?.rank ?? 99;
  const stories = spinCollectLeaves(node);
  const minSprint = stories.reduce((min, s) => {
    const cal = spinMatchCalFast(s);
    if (!cal) return min;
    const idx = S.spin._calIdx ? (S.spin._calIdx[cal.sprint] ?? 999) : 999;
    return idx < min ? idx : min;
  }, 999);
  return [projRank, tierRank, minSprint, node.issue.key];
}

function renderSpinColView(tree) {
  // Group epic nodes by topic — matching renderSpinListView's approach
  // so col view shows the same tier-grouped structure as the roadmap
  spinBuildCalIdx();
  const topics = S.topics || [];
  const nodeMap = S.spin._nodeMap || {};

  // Collect all epic nodes
  const allEpicNodes = Object.values(nodeMap).filter(n =>
    spinClassifyLevel(n.issue.issueType) === 'epic'
  );

  // Match each epic to a topic
  const topicGroups = {};
  const ungrouped = [];
  allEpicNodes.forEach(n => {
    const topic = _spinMatchTopicForIssue(n.issue, n.issue);
    if (topic) {
      const key = topic.topic_id || topic.id || topic.header;
      if (!topicGroups[key]) topicGroups[key] = { topic, nodes: [] };
      topicGroups[key].nodes.push(n);
    } else {
      ungrouped.push(n);
    }
  });

  // Sort topics by tier_rank
  const sorted = topics
    .filter(t => topicGroups[t.topic_id || t.id || t.header])
    .map(t => topicGroups[t.topic_id || t.id || t.header]);

  let html = sorted.map(g => spinRenderTierSection(g.topic, g.nodes)).join('');

  if (ungrouped.length) {
    const fakeTopic = { topic_id: '_unmatched', header: 'Unmatched', tier_rank: 99, rank: 99 };
    html += spinRenderTierSection(fakeTopic, ungrouped);
  }

  return html || '<div style="padding:20px;color:var(--di);font-style:italic">No epics found. Check that topics are configured in Settings.</div>';
}

// ── Spin view (by quarter) ──────────────────────────────────
function renderSpinQuarterView(tree) {
  const cal = S.cfg.sprint_calendar || [];
  // Build quarter groups from calendar
  const qMap = {};
  cal.forEach(s => {
    const spin = sprintToSpin(s.sprint);
    if (!qMap[spin]) qMap[spin] = { label: spin, sprints: [] };
    qMap[spin].sprints.push(s.sprint);
  });
  const quarters = Object.values(qMap).sort((a, b) => {
    const parse = s => { const m = s.label.match(/Q(\d+)\s*FY(\d+)/); return m ? [parseInt(m[2]), parseInt(m[1])] : [99, 99]; };
    const [fa, qa] = parse(a), [fb, qb] = parse(b);
    return fa !== fb ? fa - fb : qa - qb;
  });
  if (!quarters.length) return `<div style="padding:40px;text-align:center;color:var(--mu)">Configure the sprint calendar in Settings to use Spin view.</div>`;

  const allStories = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'story');
  return quarters.map(q => {
    const inQ = allStories.filter(s => q.sprints.some(sp => (s.sprints || [s.sprint]).some(ss => _snl(ss).includes(_snl(sp)))));
    const done = inQ.filter(s => spinIsDone(s.status)).length;
    const blocked = inQ.filter(s => spinStatusCategory(s.status) === 'blocked').length;
    const behind = inQ.filter(s => spinIsBehind(s)).length;
    const pct = inQ.length ? Math.round(done / inQ.length * 100) : 0;
    const pctCls = pct >= 67 ? 'c-green' : pct >= 34 ? 'c-amber' : 'c-red';
    const rows = inQ.slice(0, 100).map(s => `<tr>
      <td style="white-space:nowrap">${spinIssueIcon(s.issueType, 12)}${spinKeyLink(s.key)}</td>
      <td style="overflow:hidden;text-overflow:ellipsis;max-width:300px" title="${esc(s.summary)}">${esc(s.summary)}</td>
      <td>${spinStatusBadge(s.status)}</td>
      <td class="u-muted-xs">${esc(s.sprint || '')}</td>
    </tr>`).join('');
    return `<div class="r-card l1" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="font-size:var(--fs-base);font-weight:600;color:var(--a1)">${esc(q.label)}</div>
        <span class="${pctCls}" style="font-size:var(--fs-xs);font-weight:700">${pct}%</span>
        <span class="u-muted-xs">${done}/${inQ.length} done</span>
        ${blocked ? `<span style="font-size:var(--fs-xs);color:var(--a5)">${spinBlockedIcon(11)} ${blocked} blocked</span>` : ''}
        ${behind ? `<span style="font-size:var(--fs-xs);color:var(--a4)"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>${behind} behind</span>` : ''}
      </div>
      ${spinProgBar(pct)}
      ${inQ.length ? `<div class="tw" style="margin-top:8px">
        <table class="stbl" style="font-size:var(--fs-xs)">
          <colgroup><col style="width:80px"><col><col style="width:115px"><col style="width:90px"></colgroup>
          <thead><tr><th>Key</th><th>Summary</th><th>Status</th><th>Sprint</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : '<div style="color:var(--mu);font-style:italic;font-size:var(--fs-sm);margin-top:8px">No stories</div>'}
    </div>`;
  }).join('');
}

// ── Drilldown ───────────────────────────────────────────────
let _spinDrillOpen = null;
function spinShowDrill(epicId, type) {
  const node = S.spin._nodeMap[epicId];
  if (!node) return;
  const stats = spinNodeStats(node);
  const drillEl = document.getElementById('spin-drill-panel');
  if (!drillEl) return;
  const titleEl = document.getElementById('spin-drill-title');
  const bodyEl  = document.getElementById('spin-drill-body');
  const issue = node.issue;
  let title = '', items = [];
  if (type === 'behind') {
    title = `Behind Schedule — ${esc(issue.key)}`;
    items = spinCollectLeaves(node).filter(s => spinIsBehind(s));
  } else if (type === 'blocked') {
    title = `Blocked — ${esc(issue.key)}`;
    items = spinCollectLeaves(node).filter(s => spinStatusCategory(s.status) === 'blocked');
  } else if (type === 'deps') {
    title = `Dependencies — ${esc(issue.key)}`;
    drillEl.style.display = 'block';
    _spinDrillOpen = epicId + '_deps';
    if (titleEl) titleEl.textContent = title;
    if (bodyEl)  bodyEl.innerHTML = renderSpinDepPanel(stats.deps, issue.key);
    return;
  }
  drillEl.style.display = 'block';
  _spinDrillOpen = epicId + '_' + type;
  if (titleEl) titleEl.textContent = title;
  const rows = items.map(s => `<div class="drill-row">
    ${spinKeyLink(s.key)} <span style="flex:1;color:var(--tx)">${esc(s.summary)}</span> ${spinStatusBadge(s.status)}
  </div>`).join('');
  if (bodyEl) bodyEl.innerHTML = rows || '<div class="dep-empty">None</div>';
}
function spinCloseDrill() {
  const el = document.getElementById('spin-drill-panel');
  if (el) el.style.display = 'none';
  _spinDrillOpen = null;
}

// ── View toggle ─────────────────────────────────────────────
function spinSetView(v) {
  S.spin.view = v;
  document.querySelectorAll('.spin-pill-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  renderSpinReport();
}

// ── Filter bar ──────────────────────────────────────────────
function spinBuildMainFilter(projOpts) {
  const slot = document.getElementById('spin-main-filter');
  if (!slot) return;
  slot.innerHTML = `<div class="sf-bar" style="padding:6px 0">
    <input class="sf-search" id="spin-filter-text" placeholder="Filter by key or summary…" oninput="spinApplyFilter()" style="flex:1;min-width:0;font-family:var(--sans);font-size:var(--fs-xs)">
    <select class="sf-sel" id="spin-filter-status" onchange="spinApplyFilter()" style="width:140px;flex-shrink:0">
      <option value="">All Statuses</option>
      <option value="in progress">In Progress</option>
      <option value="blocked">Blocked</option>
      <option value="reviewing">Reviewing</option>
      <option value="open">Open</option>
      <option value="done">Done</option>
    </select>
    <select class="sf-sel" id="spin-filter-project" onchange="spinApplyFilter()" style="width:110px;flex-shrink:0">
      <option value="">All Projects</option>${projOpts || ''}
    </select>
    <button onclick="spinClearFilter()" style="white-space:nowrap;flex-shrink:0;background:none;border:none;color:var(--mu);cursor:pointer;font-size:var(--fs-xs);display:flex;align-items:center;gap:2px;padding:4px 6px"><span class="mi" style="font-size:13px">close</span>Clear</button>
  </div>`;
}

function spinApplyFilter() {
  S.spin.filterText = document.getElementById('spin-filter-text')?.value || '';
  S.spin.filterStatus = document.getElementById('spin-filter-status')?.value || '';
  S.spin.filterProject = document.getElementById('spin-filter-project')?.value || '';
  renderSpinReport();
}
function spinClearFilter() {
  S.spin.filterText = '';
  S.spin.filterStatus = '';
  S.spin.filterProject = '';
  const ft = document.getElementById('spin-filter-text'); if (ft) ft.value = '';
  const fs = document.getElementById('spin-filter-status'); if (fs) fs.value = '';
  const fp = document.getElementById('spin-filter-project'); if (fp) fp.value = '';
  renderSpinReport();
}

// ── Report body renderer ────────────────────────────────────

