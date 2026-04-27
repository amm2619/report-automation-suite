// ============================================================
// SPIN PLAN — COLUMN VIEW
// Replaces the simplified renderSpinColView.
// All key links → jiraLink() / spinKeyLink() → .tk-c
// ============================================================

// ── Sprint calendar index for O(1) sprint ordering ──────────
function spinBuildCalIdx() {
  const cal = S.cfg.sprint_calendar || [];
  S.spin._sprintCalIdx = {};
  cal.forEach((sc, i) => { S.spin._sprintCalIdx[sc.sprint] = i; });
}

// ── Collect epics under a node ──────────────────────────────
function spinCollectEpics(node, depth) {
  if ((depth || 0) > 50) return [];
  if (spinClassifyLevel(node.issue.issueType) === 'epic') return [node.issue];
  return node.children.flatMap(c => spinCollectEpics(c, (depth || 0) + 1));
}

// ── Epic completion % (for sort) ───────────────────────────
function spinEpicPct(node) {
  const st = spinNodeStats(node);
  return st.total > 0 ? st.pct : -1;
}

// ── Sort epics: project order → earliest sprint → key ───────
function spinSortEpicNodes(nodes) {
  const projOrder = { DX: 0, LX: 1, RC: 2, AFX: 3 };
  const calIdx = S.spin._sprintCalIdx || {};
  return [...nodes].sort((a, b) => {
    const pa = projOrder[a.issue.project] ?? 4;
    const pb = projOrder[b.issue.project] ?? 4;
    if (pa !== pb) return pa - pb;
    // Earliest sprint from stories
    const minSprint = node => spinCollectLeaves(node).reduce((min, s) => {
      const ce = spinMatchCalFast(s);
      const idx = ce ? (calIdx[ce.sprint] ?? 999) : 999;
      return idx < min ? idx : min;
    }, 999);
    const sa = minSprint(a), sb = minSprint(b);
    if (sa !== sb) return sa - sb;
    return a.issue.key.localeCompare(b.issue.key);
  });
}

// ── showAll state per section ────────────────────────────────
S.spin._showAllEpics = S.spin._showAllEpics || {};

function spinToggleShowAll(sectionId) {
  S.spin._showAllEpics[sectionId] = !S.spin._showAllEpics[sectionId];
  renderSpinReport();
  setTimeout(() => {
    const el = document.getElementById('spin-sec-' + sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 80);
}

// ── Sprint breakdown popup ───────────────────────────────────
function spinShowPopup(eid, e) {
  e.stopPropagation();
  document.querySelectorAll('.spin-popup.open').forEach(x => { if (x.id !== 'spp-' + eid) x.classList.remove('open'); });
  document.getElementById('spp-' + eid)?.classList.toggle('open');
}
document.addEventListener('click', () => document.querySelectorAll('.spin-popup.open').forEach(x => x.classList.remove('open')));

// ── Per-epic dep tab jump ────────────────────────────────────
function spinJumpToDeps(eid) {
  const body = document.getElementById('sceb-' + eid);
  const xb   = document.getElementById('scxb-' + eid);
  if (body && !body.classList.contains('open')) {
    body.classList.add('open');
    if (xb) { xb.classList.add('open'); xb.textContent = '−'; }
  }
  document.querySelectorAll(`#scer-${eid} .dtab`).forEach((t, i) => t.classList.toggle('active', i === 1));
  document.querySelectorAll(`#scer-${eid} .dpanel`).forEach((p, i) => p.classList.toggle('active', i === 1));
  document.getElementById(`scdp-${eid}-deps`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function spinColToggleEpic(eid) {
  const body = document.getElementById('sceb-' + eid);
  const xb   = document.getElementById('scxb-' + eid);
  if (!body) return;
  const open = body.classList.toggle('open');
  if (xb) { xb.classList.toggle('open', open); xb.textContent = open ? '−' : '+'; }
  if (open) setTimeout(() => {
    const tw = document.getElementById('sctw-' + eid);
    const cur = tw?.querySelector('.spr-current');
    if (tw && cur) tw.scrollTop = Math.max(0, cur.offsetTop - 8);
  }, 80);
}

function spinColSwitchTab(eid, tab) {
  document.querySelectorAll(`#scer-${eid} .dtab`).forEach(t => t.classList.remove('active'));
  document.querySelectorAll(`#scer-${eid} .dpanel`).forEach(p => p.classList.remove('active'));
  document.getElementById(`scdp-${eid}-${tab}`)?.classList.add('active');
  const tabIdx = tab === 'stories' ? 0 : 1;
  document.querySelectorAll(`#scer-${eid} .dtab`)[tabIdx]?.classList.add('active');
}

function spinColToggleSprintRow(bodyId) {
  const body = document.getElementById(bodyId);
  const chev = document.getElementById('spchev-' + bodyId);
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  if (chev) chev.style.transform = open ? 'rotate(90deg)' : '';
}

// ── Full story table (sprint-grouped, sortable, searchable) ──
function spinColStoriesTable(stories, eid) {
  if (!stories.length) return '<div class="dep-empty" style="padding:10px 0">No stories linked.</div>';
  const ORDER = ['blocked','in progress','reviewing','in test','open','done','closed','resolved'];
  const calIdx = S.spin._sprintCalIdx || {};
  const today = S.spin._todayStr;

  // Group by resolved calendar sprint
  const bySprintMap = {};
  stories.forEach(s => {
    const ce = spinMatchCalFast(s);
    const key = ce ? ce.sprint : (s.sprint || '__nosprint');
    if (!bySprintMap[key]) bySprintMap[key] = [];
    bySprintMap[key].push(s);
  });

  const sortedSprintKeys = Object.keys(bySprintMap).sort((a, b) => {
    if (a === '__nosprint') return 1;
    if (b === '__nosprint') return -1;
    return (calIdx[a] ?? 999) - (calIdx[b] ?? 999);
  });

  const cal = S.cfg.sprint_calendar || [];
  let html = '';

  sortedSprintKeys.forEach((spKey, idx) => {
    const spStories = bySprintMap[spKey].sort((a, b) =>
      ((ORDER.indexOf(_snl(a.status)) + 1) || 99) - ((ORDER.indexOf(_snl(b.status)) + 1) || 99) || a.key.localeCompare(b.key)
    );
    const calEntry = cal.find(sc => sc.sprint === spKey) || null;
    const sprintId = calEntry ? calEntry.sprint : (spStories[0]?.sprint || 'No Sprint');
    const fmt = d => { const [, m, dy] = d.split('-'); return `${parseInt(m)}/${parseInt(dy)}`; };
    const dateRange = calEntry ? `(${fmt(calEntry.start)} – ${fmt(calEntry.end)})` : '';

    let sprintLabel = 'Future', sprintLabelCls = 'color:var(--di)';
    if (calEntry) {
      const end = normSpinDate(calEntry.end), start = normSpinDate(calEntry.start);
      if (end < today)                        { sprintLabel = 'Past';    sprintLabelCls = 'color:var(--mu)'; }
      else if (start <= today && today <= end) { sprintLabel = 'Current'; sprintLabelCls = 'color:var(--a1);font-weight:700'; }
    }

    const total   = spStories.length;
    const done    = spStories.filter(s => spinIsDone(s.status)).length;
    const hasBehind  = spStories.some(s => spinIsBehind(s));
    const hasBlocked = spStories.some(s => _snl(s.status) === 'blocked');
    const rowCls = hasBlocked ? 'background:rgba(245,107,107,.04)' : hasBehind ? 'background:rgba(245,167,65,.04)' : '';
    const rowBodyId = `scspb-${eid}-${idx}`;
    const isCurrent = sprintLabel === 'Current';

    html += `<tr class="${isCurrent ? 'spr-current' : ''} sprint-row-hdr" onclick="spinColToggleSprintRow('${rowBodyId}')" style="cursor:pointer;${rowCls};border-bottom:1px solid var(--bd)">
      <td style="padding:5px 6px;white-space:nowrap;font-family:var(--mono);font-weight:700;font-size:var(--fs-xs);color:var(--tx);width:56px;overflow:hidden;text-overflow:clip">${esc(sprintId)}</td>
      <td style="padding:5px 4px;white-space:nowrap;font-size:var(--fs-xs);color:var(--di);width:76px">${dateRange}</td>
      <td style="padding:5px 4px;white-space:nowrap;font-size:var(--fs-xs);width:60px;${sprintLabelCls}">${sprintLabel}</td>
      <td style="padding:5px 2px;width:28px;text-align:center">${spinBehindBadge(hasBehind?1:0)}</td>
      <td style="padding:5px 2px;width:28px;text-align:center">${spinBlockedBadge(hasBlocked?1:0)}</td>
      <td style="padding:5px 4px;white-space:nowrap;font-size:var(--fs-xs);font-weight:600;color:${done===total&&total>0?'var(--a3)':'var(--tx)'};width:32px;text-align:right">${done}/${total}</td>
      <td style="padding:5px 5px;width:16px;text-align:right"><span class="mi" style="font-size:12px;color:var(--di);transition:transform .15s" id="spchev-${rowBodyId}">chevron_right</span></td>
    </tr>
    <tbody id="${rowBodyId}" style="display:none">`;

    spStories.forEach(s => {
      const behind  = spinIsBehind(s);
      const isDoneRow = spinIsDone(s.status);
      const link = spinKeyLink(s.key);
      const searchData = `data-searchable data-text="${esc((_snl(s.key)+' '+_snl(s.summary)+' '+_snl(s.status)).toLowerCase())}" data-status="${esc(s.status)}"`;
      if (isDoneRow) {
        html += `<tr class="done" style="background:var(--s3)" ${searchData}>
          <td colspan="2" style="padding:4px 24px;overflow:hidden">
            <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden;opacity:.6">
              ${spinIssueIcon(s.issueType, 11)}${link}
              <span style="color:var(--bd3);flex-shrink:0">·</span>
              <span style="overflow:hidden;text-overflow:ellipsis;color:var(--di);font-size:var(--fs-sm)" title="${esc(s.summary)}">${esc(s.summary)}</span>
              <span style="margin-left:auto;flex-shrink:0">${spinStatusBadge(s.status)}</span>
            </div>
          </td>
          <td style="text-align:right;font-size:var(--fs-sm);padding:4px 10px;color:var(--di);white-space:nowrap">${s.points || '—'}</td>
        </tr>`;
      } else {
        html += `<tr class="${_snl(s.status)==='blocked'?'blocked':behind?'behind':''}" style="background:var(--s3)" ${searchData}>
          <td style="padding:6px 24px;overflow:hidden">
            <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden">
              ${spinIssueIcon(s.issueType, 12)}${link}
              <span style="color:var(--bd3);flex-shrink:0">·</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${behind?'var(--a4)':'var(--tx)'};font-size:var(--fs-sm)" title="${esc(s.summary)}">${behind?'<span class="behind-dot"></span>':''}${esc(s.summary)}</span>
            </div>
          </td>
          <td style="padding:6px 10px;max-width:110px;overflow:hidden;white-space:nowrap" data-sort="${esc(s.status)}">${spinStatusBadge(s.status)}</td>
          <td style="text-align:right;font-size:var(--fs-sm);padding:6px 10px;white-space:nowrap" data-sort="${s.points||0}">${s.points || '—'}</td>
        </tr>`;
      }
    });
    html += `</tbody>`;
  });

  const tblId = `sctbl-${eid}`;
  const spH = Math.round(((S.spin._epicCount || S.spin.sprintCount || 5) * 41) + 33);
  return `${spinBuildSearchBar(tblId)}<div class="tw tw-scroll" style="max-height:${spH}px;overflow-x:hidden" id="sctw-${eid}">
    <table class="stbl" style="width:100%;table-layout:fixed" id="${tblId}">
      <colgroup>
        <col style="width:56px"><col style="width:76px"><col style="width:60px">
        <col style="width:28px"><col style="width:28px"><col style="width:32px"><col style="width:16px">
      </colgroup>
      <tbody>${html}</tbody>
    </table>
  </div>`;
}

// ── Full dep panel per epic (blockedBy + blocking + manual add) ──
function spinColDepsPanel(node, eid) {
  const epicKey = node.issue.key;
  const stats = spinNodeStats(node);
  const { blockedBy, blocking } = stats.deps;

  const storyOpts = [{ key: epicKey, summary: '(This epic)' }, ...spinCollectLeaves(node)]
    .map(s => `<option value="${esc(s.key)}">${esc(s.key)} — ${esc((s.summary || '').slice(0, 50))}</option>`).join('');

  let html = `<div class="dep-add-form">
    <div class="dep-add-title">Add Dependency</div>
    <div class="dep-add-row">
      <input type="text" id="scdj-${eid}" placeholder="Jira key (optional, e.g. EXT-123)" style="width:175px">
      <input type="text" id="scdd-${eid}" placeholder="What are we waiting on?" style="flex:1;min-width:180px">
    </div>
    <div class="dep-add-row" style="align-items:center">
      <span style="font-size:var(--fs-xs);color:var(--mu);flex-shrink:0">Affects:</span>
      <select id="scds-${eid}" style="flex:1;min-width:160px">${storyOpts}</select>
      <button class="btn btn-ghost btn-sm" onclick="spinColAddDep('${eid}','${epicKey}')">Add</button>
      <span id="scdm-${eid}" style="font-size:var(--fs-xs);color:var(--a3)"></span>
    </div>
  </div>`;

  // Manual deps for this epic
  const epicLeafKeys = new Set(spinCollectLeaves(node).map(s => s.key));
  epicLeafKeys.add(epicKey);
  const manualForEpic = (S.spin.manualDeps || []).filter(d => d.affectedStories?.some(k => epicLeafKeys.has(k)));
  if (manualForEpic.length) {
    html += `<div class="dep-sec-title">${spinDepIcon(13)} Manual Dependencies (${manualForEpic.length})</div>`;
    html += manualForEpic.map(d => `<div class="dep-item">
      <div class="dep-hdr">
        ${d.jiraKey ? spinDepKeyLink(d.jiraKey) : ''}
        <span class="dep-sum">${esc(d.description || '')}</span>
        <span class="u-dim-xs">affects: ${esc((d.affectedStories || []).join(', '))}</span>
        <button class="btn btn-ghost btn-xs" style="color:var(--a5);border-color:var(--a5b)" onclick="spinColRemoveDep('${d.id}','${eid}','${epicKey}')"><span class="mi">close</span></button>
      </div>
    </div>`).join('');
  }

  // Jira blockedBy
  if (blockedBy.length) {
    html += `<div class="dep-sec-title" style="margin-top:${manualForEpic.length ? 10 : 0}px"><span class="mi" style="font-size:13px;color:var(--a5)">arrow_downward</span> Waiting On — Blocked By (${blockedBy.length})</div>`;
    html += blockedBy.map(d => {
      const nk = `${epicKey}_${d.key}`;
      const editId = `scde-${spinUid(nk)}`;
      const noteVal = S.spin.depNotes[nk] || '';
      const displayText = noteVal || d.summary || '';
      const noteHtml = spinInlineNoteEditor(editId, displayText, noteVal, nk);
      return `<div class="dep-item ${spinIsDone(d.status) ? 'resolved' : ''}">
        <div class="dep-hdr">
          ${spinDepKeyLink(d.key)}
          ${d.status ? spinStatusBadge(d.status) : ''}
          <span class="dep-sum">${esc(displayText) || '<em style="color:var(--di)">(no description)</em>'}</span>
          ${spinIsDone(d.status) ? '<span style="color:var(--a3);font-size:var(--fs-xs)">&#10003; resolved</span>' : ''}
        </div>
        ${noteHtml}
      </div>`;
    }).join('');
  }

  // Jira blocking
  if (blocking.length) {
    html += `<div class="dep-sec-title" style="margin-top:10px"><span class="mi" style="font-size:13px;color:var(--a2)">arrow_upward</span> Others Waiting On Us (${blocking.length})</div>`;
    html += blocking.map(d => {
      const nk = `${epicKey}_out_${d.key}`;
      const editId = `scde-${spinUid(nk)}`;
      const noteVal = S.spin.depNotes[nk] || '';
      const displayText = noteVal || d.summary || '';
      const noteHtml = spinInlineNoteEditor(editId, displayText, noteVal, nk);
      return `<div class="dep-item">
        <div class="dep-hdr">${spinDepKeyLink(d.key)} <span class="dep-sum">${esc(displayText) || '<em style="color:var(--di)">(no description)</em>'}</span></div>
        ${noteHtml}
      </div>`;
    }).join('');
  }

  if (!blockedBy.length && !blocking.length && !manualForEpic.length)
    html += '<div class="dep-empty" style="margin-top:8px">No dependencies yet. Use the form above to add one.</div>';

  return html;
}

function spinInlineNoteEditor(editId, displayText, noteVal, noteKey) {
  const noteDisplay = displayText
    ? `<span class="u-muted-xs">${esc(displayText.slice(0, 60))}${displayText.length > 60 ? '…' : ''}</span>`
    : `<span style="font-size:var(--fs-xs);color:var(--di);font-style:italic">no note</span>`;
  const editBtn = `<button onclick="spinToggleNoteEdit('${editId}')" style="padding:1px 7px;border-radius:10px;font-size:var(--fs-xs);cursor:pointer;border:1px solid var(--bd);background:var(--s4);color:var(--mu);margin-left:5px">Edit</button>`;
  return `<div style="display:flex;align-items:center;gap:3px">
    <div id="${editId}-view" style="display:flex;align-items:center">${noteDisplay}${editBtn}</div>
    <div id="${editId}-edit" style="display:none;align-items:center;gap:4px;width:100%">
      <input id="${editId}-input" value="${esc(noteVal)}" placeholder="Note about this dependency…"
        style="flex:1;min-width:110px;background:var(--s4);border:1px solid var(--bd2);color:var(--tx);font-family:var(--sans);font-size:var(--fs-xs);padding:3px 7px;border-radius:var(--r2);outline:none">
      <button onclick="spinColSaveNote('${esc(noteKey)}','${editId}')"
        style="padding:2px 9px;border-radius:10px;font-size:var(--fs-xs);cursor:pointer;border:1px solid var(--a3b);background:var(--a3d);color:var(--a3);font-weight:600">Save</button>
      <button onclick="spinToggleNoteEdit('${editId}')"
        style="padding:2px 7px;border-radius:10px;font-size:var(--fs-xs);cursor:pointer;border:1px solid var(--bd);background:transparent;color:var(--mu)"><span class="mi">close</span></button>
    </div>
  </div>`;
}

function spinColSaveNote(noteKey, editId) {
  const input = document.getElementById(editId + '-input');
  if (!input) return;
  S.spin.depNotes[noteKey] = input.value.trim();
  spinToggleNoteEdit(editId);
}

const JIRA_KEY_RE_SPIN = /^[A-Z][A-Z0-9]*-\d+$/;
function spinColAddDep(eid, epicKey) {
  const desc = (document.getElementById(`scdd-${eid}`)?.value || '').trim();
  const jKey = (document.getElementById(`scdj-${eid}`)?.value || '').trim();
  const story = document.getElementById(`scds-${eid}`)?.value || epicKey;
  const msg = document.getElementById(`scdm-${eid}`);
  if (!desc) { if (msg) { msg.textContent = 'Enter a description.'; msg.style.color = 'var(--a5)'; setTimeout(() => msg.textContent = '', 2500); } return; }
  if (jKey && !JIRA_KEY_RE_SPIN.test(jKey)) { if (msg) { msg.textContent = 'Invalid key — use format like DX-123.'; msg.style.color = 'var(--a5)'; setTimeout(() => msg.textContent = '', 2500); } return; }
  if (!S.spin.manualDeps) S.spin.manualDeps = [];
  S.spin.manualDeps.push({ id: 'dep_' + Date.now(), description: desc, jiraKey: jKey, affectedStories: [story], addedAt: new Date().toISOString() });
  document.getElementById(`scdd-${eid}`).value = '';
  document.getElementById(`scdj-${eid}`).value = '';
  if (msg) { msg.textContent = 'Added!'; setTimeout(() => msg.textContent = '', 2000); }
  // Targeted re-render of dep panel only
  const node = S.spin._nodeMap[epicKey];
  const depPanel = document.getElementById(`scdp-${eid}-deps`);
  if (depPanel && node) depPanel.innerHTML = spinColDepsPanel(node, eid);
  spinUpdateSummaryBar();
}

function spinColRemoveDep(depId, eid, epicKey) {
  S.spin.manualDeps = (S.spin.manualDeps || []).filter(d => d.id !== depId);
  const node = S.spin._nodeMap[epicKey];
  const depPanel = document.getElementById(`scdp-${eid}-deps`);
  if (depPanel && node) depPanel.innerHTML = spinColDepsPanel(node, eid);
  spinUpdateSummaryBar();
}

// ── Full epic block (the column view card) ───────────────────
function spinRenderEpicBlock(node, showProj) {
  const epic = node.issue;
  const eid = spinUid(epic.key);
  const stats = spinNodeStats(node);
  const stories = spinCollectLeaves(node);

  if (!stories.length) {
    return `<div class="l2-hdr" style="opacity:.65">
      ${showProj ? spinProjBadge(epic.project) : ''}
      ${spinKeyLink(epic.key)}
      <span style="font-size:var(--fs-sm);color:var(--mu);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(epic.summary)}</span>
      <span class="badge b-noepic"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>No stories</span>
    </div>`;
  }

  const barCls = stats.pct >= 67 ? 'prog-green' : stats.pct >= 34 ? 'prog-amber' : 'prog-red';
  const calIdx = S.spin._sprintCalIdx || {};
  // Per-spin breakdown for hover popup
  const spinBreakdown = {};
  stories.forEach(s => {
    if (!s.sprint) return;
    const ce = spinMatchCalFast(s);
    const spin = sprintToSpin(ce ? ce.sprint : s.sprint);
    if (!spinBreakdown[spin]) spinBreakdown[spin] = { total: 0, done: 0 };
    spinBreakdown[spin].total++;
    if (spinIsDone(s.status)) spinBreakdown[spin].done++;
  });
  const spins = Object.entries(spinBreakdown)
    .map(([spin, v]) => ({ spin, total: v.total, done: v.done, pct: v.total ? Math.round(v.done / v.total * 100) : 0 }))
    .sort((a, b) => {
      const parse = s => { const m = s.match(/Q(\d+)\s*FY(\d+)/); return m ? [+m[2], +m[1]] : [99, 99]; };
      const [fa, qa] = parse(a.spin), [fb, qb] = parse(b.spin);
      return fa !== fb ? fa - fb : qa - qb;
    });
  const spRows = spins.map(s =>
    `<div class="sp-row"><span class="sp-lbl">${esc(s.spin)}</span><div class="sp-track"><div class="sp-fill" style="width:${s.pct}%"></div></div><span class="sp-pct">${s.pct}%</span><span class="sp-cnt">${s.done}/${s.total}</span></div>`
  ).join('') || `<div class="u-dim-xs">No sprint data</div>`;

  const openDeps = [...(stats.deps.blockedBy || []), ...(stats.deps.blocking || [])]
    .filter(d => !spinIsDone(d.status) && !S.spin.depClosed[`${epic.key}_${d.key}`]).length;
  const manualDepCount = (S.spin.manualDeps || []).filter(d => {
    const leafKeys = new Set(spinCollectLeaves(node).map(s => s.key));
    leafKeys.add(epic.key);
    return !d.closed && d.affectedStories?.some(k => leafKeys.has(k));
  }).length;
  const totalOpenDeps = openDeps + manualDepCount;

  const depTotal = (stats.deps.blockedBy?.length || 0) + (stats.deps.blocking?.length || 0);

  return `<div id="scer-${eid}">
    <div class="l2-hdr" onclick="spinColToggleEpic('${eid}')" style="flex-direction:column;align-items:stretch;gap:0;padding:8px 14px">
      <div style="display:flex;align-items:center;gap:7px;min-width:0">
        <div class="xbtn" id="scxb-${eid}" style="flex-shrink:0">+</div>
        ${showProj ? spinProjBadge(epic.project) : ''}
        ${spinIssueIcon(epic.issueType, 13)}
        ${spinKeyLink(epic.key)}
        <span style="font-size:var(--fs-sm);font-weight:500;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0" title="${esc(epic.summary)}">${esc(epic.summary)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-left:24px;min-width:0">
        <div style="display:flex;align-items:center;gap:4px;width:180px;flex-shrink:0">
          ${spinBehindBadge(stats.behind)}
          ${spinBlockedBadge(stats.blocked)}
          ${spinDepBadge(totalOpenDeps, `spinJumpToDeps('${eid}');event.stopPropagation()`)}
        </div>
        <div class="prog-wrap" style="position:relative;flex:1;min-width:0">
          <div class="prog-bar-outer" onclick="spinShowPopup('${eid}',event);event.stopPropagation()" title="Click for sprint breakdown">
            <div class="prog-bar-inner ${barCls}" style="width:${stats.pct}%"></div>
            <div class="spin-popup" id="spp-${eid}">${spRows}</div>
          </div>
          <div class="prog-meta"><span class="prog-pct">${stats.pct}%</span><span class="prog-cnt">${stats.done}/${stats.total}</span></div>
        </div>
      </div>
    </div>
    <div class="l2-body" id="sceb-${eid}">
      <div class="detail-panel">
        <div class="dtabs">
          <button class="dtab active" onclick="spinColSwitchTab('${eid}','stories')">Sprints (${stories.length})</button>
          <button class="dtab" onclick="spinColSwitchTab('${eid}','deps')">Dependencies${depTotal ? ` (${depTotal})` : ''}</button>
        </div>
        <div class="dpanel active" id="scdp-${eid}-stories">${spinColStoriesTable(stories, eid)}</div>
        <div class="dpanel" id="scdp-${eid}-deps">${spinColDepsPanel(node, eid)}</div>
      </div>
    </div>
  </div>`;
}

// ── Upper node (Strategy / Program) in column view ───────────
function spinRenderUpperNode(node, colMode) {
  const issue = node.issue;
  const lvl = spinClassifyLevel(issue.issueType);
  const nid = spinUid(issue.key);
  const epicsUnder = spinCollectEpics(node);
  const allStories = spinCollectLeaves(node);
  const tot = allStories.length;
  const done = allStories.filter(s => spinIsDone(s.status)).length;
  const behind = allStories.filter(s => spinIsBehind(s)).length;
  const blocked = allStories.filter(s => _snl(s.status) === 'blocked').length;
  const pct = tot ? Math.round(done / tot * 100) : 0;
  const noEpics = epicsUnder.length === 0;
  const isStrategy = lvl === 'strategy';

  const badge = isStrategy
    ? `<span class="l0-badge">${spinIssueIcon('Strategy', 12)}Strategy</span>`
    : `<span class="l1-badge">${spinIssueIcon('Program', 12)}Program</span>`;

  const stats = `<span style="display:flex;gap:8px;font-size:var(--fs-xs);color:var(--mu);align-items:center;flex-shrink:0">
    ${noEpics
      ? `<span class="badge b-noepic"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>No epics mapped</span>`
      : `<span style="color:var(--a3);font-weight:600">${pct}%</span><span>${done}/${tot}</span>`}
    ${spinBehindBadge(noEpics ? 0 : behind)}
    ${spinBlockedBadge(noEpics ? 0 : blocked)}
  </span>`;

  let childrenHtml = '';
  if (noEpics) {
    childrenHtml = `<div class="no-epic-row"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>No epics mapped to this ${lvl}.</div>`;
  } else {
    const epicNodes = spinSortEpicNodes(node.children.filter(c => spinClassifyLevel(c.issue.issueType) === 'epic'));
    const subUpper = node.children.filter(c => ['strategy', 'program'].includes(spinClassifyLevel(c.issue.issueType)));
    subUpper.forEach(su => { childrenHtml += spinRenderUpperNode(su, colMode); });
    if (colMode) childrenHtml += spinRenderEpicsInCols(epicNodes, nid);
    else epicNodes.forEach(en => { childrenHtml += spinRenderEpicBlock(en, true); });
  }

  const hdrCls = isStrategy ? 'l0-hdr' : 'l1-hdr';
  const bodyCls = isStrategy ? 'l0-body' : 'l1-body';

  return `<div>
    <div class="${hdrCls} open" id="scuh-${nid}" onclick="spinColToggleUpper('${nid}')">
      ${badge}
      ${jiraLink(issue.key, 'tk-c')}
      <span style="font-size:var(--fs-base);font-weight:600;color:var(--tx);flex:1">${esc(issue.summary)}</span>
      ${stats}
      <span class="chev open" id="scuc-${nid}">›</span>
    </div>
    <div class="${bodyCls} open" id="scub-${nid}">${childrenHtml}</div>
  </div>`;
}

function spinColToggleUpper(nid) {
  document.getElementById('scub-' + nid)?.classList.toggle('open');
  document.getElementById('scuc-' + nid)?.classList.toggle('open');
  document.getElementById('scuh-' + nid)?.classList.toggle('open');
}

// ── Epics in 3-column grid (sorted by %, with fade reveal) ───
function spinRenderEpicsInCols(epicNodes, sectionKey) {
  if (!epicNodes.length) return '';
  const projects = (S.cfg.sprint_prefixes || ['DX', 'LX', 'RC']).filter(p => p !== 'RCR' && p !== 'AFX');
  const limit = S.spin._epicCount || 5;
  const showAll = !!(S.spin._showAllEpics && S.spin._showAllEpics[sectionKey]);

  const byProj = {};
  projects.forEach(p => {
    byProj[p] = epicNodes.filter(n => n.issue.project === p)
      .sort((a, b) => spinEpicPct(b) - spinEpicPct(a));
  });
  const hasMore = projects.some(p => byProj[p].length > limit);
  const visible = {};
  projects.forEach(p => { visible[p] = showAll ? byProj[p] : byProj[p].slice(0, limit); });
  const maxRows = Math.max(...projects.map(p => visible[p].length), 1);

  const hdrs = projects.map(p => `<div class="col-proj-hdr" style="border-top:3px solid var(--bd3);color:var(--tx)">${esc(p)}</div>`).join('');
  let cells = [];
  for (let i = 0; i < maxRows; i++) {
    projects.forEach(p => {
      const n = visible[p][i];
      cells.push(`<div class="col-cell">${n ? spinRenderEpicBlock(n, false) : ''}</div>`);
    });
  }

  const moreCount = projects.reduce((n, p) => n + byProj[p].length - visible[p].length, 0);
  const moreBtn = (!showAll && hasMore)
    ? `<div class="epic-reveal-btn" onclick="spinToggleShowAll('${sectionKey}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5"/></svg>${moreCount} more epic${moreCount > 1 ? 's' : ''}</div>` : '';
  const lessBtn = (showAll && hasMore)
    ? `<div class="epic-reveal-btn open" onclick="spinToggleShowAll('${sectionKey}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5"/></svg>Show fewer</div>` : '';

  const colCount = projects.length;
  const grid = `<div class="col-wrap"><div class="col-hdr-row">${hdrs}</div><div class="col-view" style="grid-template-columns:repeat(${colCount},minmax(0,1fr))">${cells.join('')}</div></div>`;
  if (!showAll && hasMore)
    return `<div class="epic-fade-wrap">${grid}<div class="epic-fade"></div></div>${moreBtn}`;
  return grid + lessBtn;
}

// ── Global error boundary ─────────────────────────────────────
window.addEventListener('error', e => {
  console.error('[ReportSuite]', e.message, 'at', e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', e => {
  console.error('[ReportSuite] Unhandled promise rejection:', e.reason);
});


