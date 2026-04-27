// ============================================================
// APP_ICONS — single source of truth for all UI icons.
// Change here, updates everywhere via mi(APP_ICONS.X).
// ============================================================
const APP_ICONS = {
  // Reports
  weekly:         'newspaper',
  eos:            'flag',
  sprint:         'task_alt',
  pmr:            'bar_chart',
  spin:           'account_tree',
  velocity:       'analytics',
  // General settings
  config:         'settings',
  appearance:     'contrast',
  calendar:       'date_range',
  // Data & Routing
  topics:         'label',
  overrides:      'rule',
  classification: 'verified_user',
  // Guide-only sections
  files:          'folder_open',
  drafts:         'save',
  people:         'group',
  legend:         'info',
  tips:           'tips_and_updates',
  // Actions
  save:           'save',
  restore:        'history',
  export:         'download',
  import:         'upload',
  reset:          'restart_alt',
  copy:           'content_copy',
  mail:           'mail',
  code:           'code',
  delete:         'delete',
  add:            'add',
  close:          'close',
  check:          'check',
  back:           'arrow_back',
  fullscreen:     'open_in_full',
  guide:          'help_outline',
  filter:         'filter_list',
  view_list:      'format_list_bulleted',
  view_col:       'view_week',
  view_spin:      'account_tree',
  sort_asc:       'arrow_upward',
  sort_desc:      'arrow_downward',
  sort_both:      'swap_vert',
  chevron:        'chevron_right',
  expand:         'unfold_more',
  collapse:       'unfold_less',
  warning:        'warning',
};


function issueTypeBadge(t){
  return issueTypeIcon(t, 13);
}
function issueTypeIcon(it, size){
  const l=normLower(it||'');
  const sz=size||13;
  let key;
  if(l==='epic') key='epic';
  else if(l==='story'||l==='user story'||l==='user request') key='story';
  else if(l==='bug'||l==='defect') key='bug';
  else if(l==='task') key='task';
  else if(l==='sub-task'||l==='subtask') key='subtask';
  else key='task';
  const svg=ISSUE_ICONS[key]; if(!svg) return '';
  return `<span style="display:inline-flex;align-items:center;flex-shrink:0;width:${sz}px;height:${sz}px;margin-right:3px;vertical-align:middle" title="${esc(it||'')}">${svg}</span>`;
}
function statusIcon(s){
  const l=normLower(s);
  if(l==='blocked') return `<span style="display:inline-flex;align-items:center;margin-right:3px;width:14px;height:14px;flex-shrink:0;vertical-align:middle">${BLOCKED_ICON}</span>`;
  if(_isDone(l)) return '<span class="u-iflex-mr3"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#36B37E"/><path d="M2.5 5l1.8 1.8 3.2-3.2" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  if(l==='in progress') return '<span class="u-iflex-mr3"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#0052CC"/><circle cx="5" cy="5" r="2" fill="#fff"/></svg></span>';
  if(l==='reviewing'||l==='in test') return '<span class="u-iflex-mr3"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#6554C0"/><path d="M3 5h4M5 3v4" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg></span>';
  return '<span class="u-iflex-mr3"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="#8A97B8" stroke-width="1.5"/></svg></span>';
}

function sbClass(s){ const l=normLower(s); return l==='blocked'?'sbl':_isDone(l)?'sd':l==='in progress'?'sip':(l==='reviewing'||l==='in test')?'srv':'sop'; }

function statusBadge(s){
  if(!s) return '';
  return `<span class="sb ${sbClass(s)}">${statusIcon(s)}${esc(s)}</span>`;
}
function statusLabel(s){ if(!s) return ''; return statusIcon(s)+esc(s); }

function esc(t){ return (t==null?'':String(t)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function jiraLink(key, cssClass){
  const base=S.cfg.jira_url||'';
  const cls=cssClass||'tk-c';
  return base
    ? `<a href="${base}/browse/${esc(key)}" target="_blank" class="${cls}" style="text-decoration:none">${esc(key)}</a>`
    : `<span class="${cls}">${esc(key)}</span>`;
}

// Apply field mapping: resolve raw column name -> canonical name
function resolveCol(row, canonicalName) {
  // Direct hit
  if(row[canonicalName]!==undefined) return row[canonicalName]||'';
  // Check user-defined field map
  const map=S.cfg.field_map||[];
  for(const {raw,canonical} of map){
    if(canonical.toLowerCase()===canonicalName.toLowerCase()&&row[raw]!==undefined) return row[raw]||'';
  }
  // Auto-detect common Jira custom field patterns
  const patterns=[
    `Custom field (${canonicalName})`,
    `customfield_${canonicalName}`,
    canonicalName.replace(/ /g,'_'),
    canonicalName.toLowerCase(),
  ];
  for(const p of patterns){ if(row[p]!==undefined) return row[p]||''; }
  // Partial match fallback — last resort; warn so ambiguous mappings are visible
  const lower=canonicalName.toLowerCase();
  for(const k of Object.keys(row)){
    if(k.toLowerCase().includes(lower)){
      console.warn('[resolveCol] partial-match fallback: "'+k+'" -> "'+canonicalName+'" — add an explicit field_map entry to suppress this');
      return row[k]||'';
    }
  }
  return '';
}

// Extract human-readable sprint name from Jira's sprint field value.
// Jira exports the sprint field as either a plain name OR a blob like:
// com.atlassian.greenhopper...Sprint@abc[...,name=DX 26.2.6,state=ACTIVE,...]
function extractSprintName(raw) {
  if (!raw) return '';
  const s = raw.trim();
  // Try to pull name= from the Jira sprint object blob (classic Jira format)
  const blobMatch = s.match(/\bname=([^,\]]+)/i);
  if (blobMatch) return cleanSpinSprint(blobMatch[1].trim());
  return cleanSpinSprint(s);
}

function cleanSpinSprint(raw) {
  // Strip [EXT], [EXT][COMPLETED], and project prefix (e.g. "LX ", "DX ")
  // Input: "LX 26.2.6[EXT]" or "LX 26.2.6 [EXT][COMPLETED]"
  // Output: "26.2.6"
  let s = (raw || '').trim();
  s = s.replace(/\s*\[EXT\](?:\[COMPLETED\])?/gi, '').trim();
  // Extract just the sprint number (YY.Q.S pattern)
  const numMatch = s.match(/(\d{2,4}\.\d+\.\d+)/);
  if (numMatch) return numMatch[1];
  return s;
}

// Collect all sprint values from a row (Jira exports sprint as repeated columns)
function collectSprints(row) {
  const seen = new Set();
  const vals = [];
  const add = (v) => {
    // Split on ' + ' for multi-sprint fields (Jira Plans format)
    const parts = String(v).split(/\s*\+\s*/);
    parts.forEach(part => {
      const name = extractSprintName(normText(part));
      if (name && !seen.has(name)) { seen.add(name); vals.push(name); }
    });
  };
  // Scan all Sprint columns: Sprint, Sprint.1, Sprint.2...
  for (const [k, v] of Object.entries(row)) {
    if (/^sprint(\.\d+)?$/i.test(k.trim()) && v) add(v);
  }
  // Sort by sprint number descending — latest sprint first (bucket into most recent)
  vals.sort((a, b) => {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pb[i] || 0) - (pa[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  });
  return vals;
}

function buildTicket(row, epicMap) {
  const key=normText(resolveCol(row,'Issue key')||resolveCol(row,'Key')||'');
  const proj=bucketKey(key);
  const epicLink=normText(resolveCol(row,'Epic Link'));
  const epicName=epicMap[epicLink]||normText(resolveCol(row,'Epic Name'))||'';
  const labels=normText(resolveCol(row,'Labels'));
  const comps=normSet(resolveCol(row,'Components'));
  const sprints=collectSprints(row);
  const blob=[normText(resolveCol(row,'Summary')),epicName,labels,comps.join(' ')].join(' | ');
  return {
    issue_key:key, project_bucket:proj,
    summary:normText(resolveCol(row,'Summary')),
    issue_type:normText(resolveCol(row,'Issue Type')),
    status:normText(resolveCol(row,'Status')),
    epic_link:epicLink,
    epic_name:epicName||(epicLink||'Unmapped Epic'),
    sprint:sprints[0]||'',
    sprints, // all sprint values
    components:comps, labels,
    story_points:parsePoints(row),
    assignee:normText(resolveCol(row,'Assignee')),
    created_dt:parseDate(resolveCol(row,'Created')),
    updated_dt:parseDate(resolveCol(row,'Updated')),
    resolved_dt:parseDate(resolveCol(row,'Resolved')),
    match_blob:blob
  };
}

// Sprint matching: handles "DX 26.2.6", "RC 26.2.6", "LX 26.2.6", plain "26.2.6"
// Also handles RCR -> RC equivalence
// Accepts either a full ticket object OR a plain sprint string (backward compat)
function sprintMatches(ticketOrField, sprint_number) {
  if(!sprint_number) return false;
  const sn=sprint_number.trim();
  // Backward compat: if first arg is a string, wrap it
  const ticket=(typeof ticketOrField==='string')
    ? {sprints:[ticketOrField], sprint:ticketOrField, project_bucket:''}
    : ticketOrField;
  const proj=ticket.project_bucket||'';
  const rcr=proj==='RC';
  const prefixes=['',proj,...(S.cfg.sprint_prefixes||[])];
  if(rcr) prefixes.push('RCR');
  const sprints=ticket.sprints||[ticket.sprint||''];
  return sprints.some(sf=>{
    const sfn=(sf||'').toLowerCase();
    const snl=sn.toLowerCase();
    if(sfn.includes(snl)) return true;
    return prefixes.some(p=>{
      if(!p) return false;
      const pl=p.toLowerCase();
      return sfn.includes(`${pl} ${snl}`) || sfn.includes(`${pl}-${snl}`) || sfn.includes(`${pl}${snl}`);
    });
  });
}

