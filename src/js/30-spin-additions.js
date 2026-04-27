// ============================================================
// SPIN PLAN — ENGINE ADDITIONS
// Phase 2: Spin View, Global Drilldown, Epic Controls,
//           Search/Sort, Dep Management
// ============================================================

// ── Spin state additions ────────────────────────────────────
S.spin._activeSpin = null;
S.spin._spinTierOpen = null;
S.spin._spinMonths = {};
S.spin._ctxMap = null;

// ── Project badge (uses RS .b-dx/.b-lx/.b-rc classes) ───────
function spinProjBadge(proj) {
  if (!proj) return '';
  const cls = proj === 'DX' ? 'b-dx' : proj === 'LX' ? 'b-lx' : proj === 'RC' ? 'b-rc' : '';
  if (!cls) return '';  // DQV and other org-level keys — no badge
  return `<span class="badge b-proj ${cls}">${esc(proj)}</span>`;
}

// ── Context map: story key → {epicKey, tier, tierRank, project} ──
function spinBuildContextMap() {
  const map = {};
  const epics = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'epic');
  const stories = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'story');
  stories.forEach(s => {
    const epicKey = s.epicLink || s.parentKey || '';
    const epic = epics.find(e => e.key === epicKey);
    // Match topic for tier label
    const topicMatch = _spinMatchTopicForIssue(s, epic);
    map[s.key] = {
      epicKey,
      epicSummary: epic?.summary || '',
      tier: topicMatch?.header || 'Untiered',
      tierRank: topicMatch?.tier_rank ?? topicMatch?.rank ?? 99,
      project: s.project || epic?.project || '',
    };
  });
  return map;
}

function _spinMatchTopicForIssue(story, epic) {
  const topics = S.topics || [];
  const blob = [story.summary, epic?.summary || '', story.labels, story.components].join(' | ').toLowerCase();
  const proj = story.project || (epic ? epic.project : '');
  let best = null, bestByEpicKey = false;
  for (const t of topics) {
    const tprojs = t.projects || [];
    if (tprojs.length && !tprojs.includes(proj)) continue;
    const epicKeys = t.epic_keys || [];
    const epicKeyMatch = epic && (epicKeys.includes(epic.key) || epicKeys.includes(story.epicLink));
    if (epicKeyMatch) {
      const rank = t.tier_rank ?? t.rank ?? 99;
      const bestRank = best ? (best.tier_rank ?? best.rank ?? 99) : 999;
      if (!best || rank < bestRank || (rank === bestRank && !bestByEpicKey)) { best = t; bestByEpicKey = true; }
      continue;
    }
    if (bestByEpicKey && best) {
      const rank = t.tier_rank ?? t.rank ?? 99;
      if (rank === (best.tier_rank ?? best.rank ?? 99)) continue;
    }
    const kws = t.keywords || t.kw || [];
    const excl = t.exclude_keywords || t.excl || [];
    if (kws.some(k => blob.includes(k)) && !excl.some(ex => blob.includes(ex))) {
      const rank = t.tier_rank ?? t.rank ?? 99;
      const bestRank = best ? (best.tier_rank ?? best.rank ?? 99) : 999;
      if (!best || rank < bestRank) { best = t; bestByEpicKey = false; }
    }
  }
  return best;
}

// ── Spin View: month × tier matrix ─────────────────────────
function renderSpinMatrixView() {
  const cal = S.cfg.sprint_calendar || [];
  if (!cal.length) return '<div class="nstr" style="padding:20px">No sprint calendar configured. Add sprints in Settings → Configuration.</div>';

  const today = S.spin._todayStr;

  // Group calendar into quarter/spin buckets
  const spinMap = {};
  cal.forEach(sc => {
    const spin = sprintToSpin(sc.sprint);
    if (!spinMap[spin]) spinMap[spin] = { label: spin, sprints: [] };
    spinMap[spin].sprints.push(sc);
  });
  const spinKeys = Object.keys(spinMap).sort((a, b) => {
    const pa = a.match(/Q(\d+)\s*FY(\d+)/), pb = b.match(/Q(\d+)\s*FY(\d+)/);
    if (!pa || !pb) return a.localeCompare(b);
    return (+pa[2] - +pb[2]) || (+pa[1] - +pb[1]);
  });

  // Find active spin
  const curEntry = cal.find(sc => normSpinDate(sc.start) <= today && today <= normSpinDate(sc.end))
    || cal.find(sc => normSpinDate(sc.start) > today) || cal[cal.length - 1];
  const curSpin = sprintToSpin(curEntry?.sprint || '');
  // Always sync to current quarter (user can override via spin selector)
  if (!S.spin._activeSpin || !spinMap[S.spin._activeSpin] || S.spin._activeSpin === '__default__') {
    S.spin._activeSpin = spinMap[curSpin] ? curSpin : spinKeys[spinKeys.length - 1];
  }

  const spin = spinMap[S.spin._activeSpin];
  if (!spin) return '<div class="nstr">No data for selected spin.</div>';

  const sprints = [...spin.sprints].sort((a, b) => a.sprint.localeCompare(b.sprint));

  // Group into 3 months (2 sprints each), derive actual month name from dates
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Derive unique month names: use the END date of the LAST sprint in each group
  // to avoid two groups mapping to the same start month
  const months = [
    { sprints: sprints.slice(0, 2) },
    { sprints: sprints.slice(2, 4) },
    { sprints: sprints.slice(4, 6) },
  ].filter(m => m.sprints.length).map((m, i) => {
    // Use midpoint date of the group for month label
    const allDates = m.sprints.flatMap(s => [s.start, s.end]).filter(Boolean).sort();
    const midDate = allDates[Math.floor(allDates.length / 2)] || m.sprints[0]?.start || '';
    const monthIdx = midDate ? parseInt(midDate.split('-')[1]) - 1 : -1;
    return { ...m, name: monthIdx >= 0 ? MONTH_NAMES[monthIdx] : ('M' + (i+1)), sprintRange: m.sprints.map(s => s.sprint).join(' + ') };
  });

  // Store month sprint keys for drill function
  S.spin._spinMonths = {};
  months.forEach(m => { S.spin._spinMonths[m.name] = m.sprints.map(s => s.sprint); });
  S.spin._spinTierOpen = null;

  // Per-month stats
  function monthStats(mSprints) {
    const spKeys = new Set(mSprints.map(sc => sc.sprint));
    const stories = S.spin.issues.filter(s => {
      if (spinClassifyLevel(s.issueType) !== 'story') return false;
      if (!s.sprint) return false;
      const cal = spinMatchCalFast(s);
      return cal && spKeys.has(cal.sprint);
    });
    const done = stories.filter(s => spinIsDone(s.status)).length;
    const behind = stories.filter(s => spinIsBehind(s)).length;
    const blocked = stories.filter(s => _snl(s.status) === 'blocked').length;
    const pct = stories.length ? Math.round(done / stories.length * 100) : 0;
    const byProj = {};
    const projKeys = [...new Set(S.spin.issues.map(i => i.project).filter(Boolean))];
    projKeys.forEach(p => {
      const ps = stories.filter(s => s.project === p);
      byProj[p] = { done: ps.filter(s => spinIsDone(s.status)).length, total: ps.length, pct: ps.length ? Math.round(ps.filter(s => spinIsDone(s.status)).length / ps.length * 100) : 0 };
    });
    return { total: stories.length, done, behind, blocked, pct, byProj, sprintRange: mSprints.map(s => s.sprint).join(' + ') };
  }

  function mPhase(m) {
    if (m.sprints.some(s => normSpinDate(s.start) <= today && today <= normSpinDate(s.end))) return 'current';
    if (m.sprints.every(s => normSpinDate(s.end) < today)) return 'past';
    return 'future';
  }

  const mStats = months.map(m => ({ ...m, stats: monthStats(m.sprints) }));

  // Spin-level summary
  const allSpinStories = S.spin.issues.filter(s => {
    if (spinClassifyLevel(s.issueType) !== 'story' || !s.sprint) return false;
    const ce = spinMatchCalFast(s);
    return ce && spin.sprints.some(sc => sc.sprint === ce.sprint);
  });
  const spinDone = allSpinStories.filter(s => spinIsDone(s.status)).length;
  const spinBehind = allSpinStories.filter(s => spinIsBehind(s)).length;
  const spinBlocked = allSpinStories.filter(s => _snl(s.status) === 'blocked').length;
  const spinPct = allSpinStories.length ? Math.round(spinDone / allSpinStories.length * 100) : 0;
  const pctCls = spinPct >= 67 ? 'c-green' : spinPct >= 34 ? 'c-amber' : 'c-red';

  // Spin selector
  const spinSel = `<div class="spin-sel-pill">${spinKeys.map(k =>
    `<button class="pill-btn${k === S.spin._activeSpin ? ' active' : ''}" onclick="spinSetActiveSpin('${esc(k)}')">${esc(k)}</button>`
  ).join('')}</div>`;

  // Month cards
  const monthCards = mStats.map(m => {
    const ph = mPhase(m);
    const st = m.stats;
    const barCls = st.pct >= 67 ? 'prog-green' : st.pct >= 34 ? 'prog-amber' : 'prog-red';
    const projRows = Object.entries(st.byProj).filter(([, v]) => v.total > 0).map(([p, ps]) =>
      `<div class="spin-stat"><span class="spin-stat-label">${esc(p)}</span>
       <span class="spin-stat-val">${ps.done}/${ps.total} <span style="color:var(--mu);font-weight:400">${ps.pct}%</span></span></div>`
    ).join('');
    const isCurrent = ph === 'current';
    return `<div class="spin-month">
      <div class="spin-month-hdr${isCurrent ? ' current' : ''}">
        <div class="spin-month-name${isCurrent ? ' current' : ''}">${esc(m.name)}${isCurrent ? ' <span style="font-size:var(--fs-xs);color:var(--a1);font-weight:400">● now</span>' : ''}</div>
        <div class="spin-month-sub">${esc(st.sprintRange)}</div>
      </div>
      <div class="spin-month-body">
        <div class="spin-prog">
          <div class="spin-prog-lbl"><span>Overall</span><span>${st.pct}% · ${st.done}/${st.total}</span></div>
          <div class="prog-bar-outer"><div class="prog-bar-inner ${barCls}" style="width:${st.pct}%"></div></div>
        </div>
        ${projRows}
      </div>
    </div>`;
  }).join('');

  // Tier breakdown table (topic × month)
  const topics = S.topics || [];
  const epics = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'epic');

  const tierRows = topics.map(topic => {
    const epicKeys = new Set(topic.epic_keys || []);
    const kws = topic.keywords || topic.kw || [];
    const topicEpics = epics.filter(e =>
      epicKeys.has(e.key) || kws.some(k => e.summary.toLowerCase().includes(k))
    );
    if (!topicEpics.length) return '';
    const cells = mStats.map(m => {
      const spKeys = new Set(m.sprints.map(s => s.sprint));
      const stories = S.spin.issues.filter(s => {
        if (spinClassifyLevel(s.issueType) !== 'story' || !s.sprint) return false;
        const ce = spinMatchCalFast(s);
        return ce && spKeys.has(ce.sprint) && topicEpics.some(e => s.epicLink === e.key || s.parentKey === e.key);
      });
      if (!stories.length) return `<td style="color:var(--di);font-size:var(--fs-xs);padding:6px 10px">—</td>`;
      const done = stories.filter(s => spinIsDone(s.status)).length;
      const pct = Math.round(done / stories.length * 100);
      const col = pct >= 80 ? 'var(--a3)' : pct >= 40 ? 'var(--a4)' : 'var(--mu)';
      const incomplete = stories.filter(s => !spinIsDone(s.status));
      const cellKey = `${topic.topic_id || topic.id}__${m.name}`;
      const clickAttr = incomplete.length
        ? ` onclick="spinShowTierDrill('${esc(topic.topic_id || topic.id)}','${esc(m.name)}',event)" data-spin-cell="${esc(cellKey)}" style="padding:6px 10px;cursor:pointer" title="${incomplete.length} open task${incomplete.length !== 1 ? 's' : ''}"`
        : ` style="padding:6px 10px"`;
      return `<td${clickAttr}>
        <div class="u-flex-4">
          <span style="font-size:var(--fs-sm);font-weight:600;color:${col}">${pct}%</span>
          ${incomplete.length ? `<span style="font-size:var(--fs-xs);color:var(--a4);font-weight:600">${incomplete.length} open</span>` : ''}
        </div>
        <div class="u-dim-xs">${done}/${stories.length}</div>
        <div class="tr-bar"><div class="tr-bar-fill" style="width:${pct}%;background:${col}"></div></div>
      </td>`;
    }).join('');
    const tierRank = topic.tier_rank ?? topic.rank ?? 99;
    const tierColor = tierRank === 0 ? 'var(--a5)' : tierRank === 1 ? 'var(--a1)' : tierRank <= 4 ? 'var(--a4)' : 'var(--mu)';
    const shortHdr = (topic.header || '').replace(/^\([^)]*\)\s*/, '').replace(/Tier \d+: Priority \d+:\s*/, '');
    const tid = topic.topic_id || topic.id || '';
    return `<tr id="spin-tier-row-${spinUid(tid)}">
      <td style="padding:6px 10px;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${tierColor};margin-right:5px;vertical-align:middle;flex-shrink:0"></span>
        <span style="font-size:var(--fs-xs);color:var(--tx)" title="${esc(topic.header || '')}">${esc(shortHdr)}</span>
      </td>${cells}
    </tr>`;
  }).filter(Boolean).join('');

  const mHdrs = mStats.map(m => `<th>${esc(m.name)}</th>`).join('');

  return `<div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:var(--fs-base);font-weight:600;color:var(--tx)">${esc(S.spin._activeSpin)} — Spin Overview</div>
        <div style="font-size:var(--fs-xs);color:var(--mu);margin-top:2px">${sprints[0]?.start || ''} – ${sprints[sprints.length - 1]?.end || ''} · ${sprints.length} sprint${sprints.length !== 1 ? 's' : ''}</div>
      </div>
      ${spinSel}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:14px">
      <div class="sc"><div class="sv c-blue">${allSpinStories.length}</div><div class="sl">Stories</div></div>
      <div class="sc"><div class="sv ${pctCls}">${spinPct}%</div><div class="sl">Complete</div></div>
      <div class="sc"><div class="sv c-amber">${spinBehind}</div><div class="sl"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>Behind</div></div>
      <div class="sc"><div class="sv c-red">${spinBlocked}</div><div class="sl">Blocked</div></div>
    </div>
    <div class="spin-month-grid">${monthCards}</div>
    <div style="font-size:var(--fs-xs);font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Progress by tier</div>
    <div class="tw" style="margin:0">
      <table class="spin-tier-tbl">
        <thead><tr><th>Tier</th>${mHdrs}</tr></thead>
        <tbody>${tierRows || '<tr><td colspan="4" style="color:var(--di);padding:10px;font-style:italic">No topic/tier data — configure Topics in Settings</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;
}

function spinSetActiveSpin(label) {
  S.spin._activeSpin = label;
  S.spin._spinTierOpen = null;
  renderSpinReport();
}

// ── Tier drill: inline expand row in month×tier table ───────
function spinShowTierDrill(topicId, monthName, event) {
  if (event) event.stopPropagation();
  const topic = S.topics.find(t => (t.topic_id || t.id) === topicId);
  if (!topic) return;

  const rowEl = document.getElementById('spin-tier-row-' + spinUid(topicId));
  if (!rowEl) return;

  const cellKey = topicId + '__' + monthName;
  if (S.spin._spinTierOpen === cellKey) {
    spinCloseTierExpand(); return;
  }
  spinCloseTierExpand();
  S.spin._spinTierOpen = cellKey;

  // Highlight active cell
  rowEl.querySelectorAll('td[data-spin-cell]').forEach(td => {
    td.style.background = td.dataset.spinCell === cellKey ? 'var(--a1d)' : '';
  });

  const epicKeys = new Set(topic.epic_keys || []);
  const kws = topic.keywords || topic.kw || [];
  const topicEpics = S.spin.issues.filter(i =>
    spinClassifyLevel(i.issueType) === 'epic' && (epicKeys.has(i.key) || kws.some(k => i.summary.toLowerCase().includes(k)))
  );
  const sprintKeys = new Set((S.spin._spinMonths[monthName] || []));
  const incomplete = S.spin.issues.filter(s => {
    if (spinIsDone(s.status) || spinClassifyLevel(s.issueType) !== 'story' || !s.sprint) return false;
    const ce = spinMatchCalFast(s);
    return ce && sprintKeys.has(ce.sprint) && topicEpics.some(e => s.epicLink === e.key || s.parentKey === e.key);
  });

  const tierShort = (topic.header || '').replace(/^\([^)]*\)\s*/, '').replace(/Tier \d+: Priority \d+:\s*/, '').replace(/Tier \d+:\s*/, '').trim();
  const colSpan = rowEl.querySelectorAll('td').length || 4;

  let innerHtml;
  if (!incomplete.length) {
    innerHtml = `<div style="padding:10px 14px;font-size:var(--fs-sm);color:var(--a3)">&#10003; All tasks complete for ${esc(tierShort)} — ${esc(monthName)}</div>`;
  } else {
    const tId = 'spin-tier-inline-tbl';
    const rows = incomplete.map(s => {
      const epic = topicEpics.find(e => e.key === s.epicLink || e.key === s.parentKey);
      return `<tr data-searchable data-text="${esc((s.project+' '+s.key+' '+s.summary+' '+s.status).toLowerCase())}" data-status="${esc(s.status)}">
        <td style="white-space:nowrap;padding:5px 10px">${spinProjBadge(s.project)} ${spinIssueIcon(s.issueType, 12)}${spinKeyLink(s.key)}</td>
        <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px;padding:5px 10px" title="${esc(s.summary)}">${esc(s.summary)}</td>
        <td style="white-space:nowrap;padding:5px 10px;overflow:hidden;text-overflow:ellipsis;max-width:200px">${epic ? (jiraLink(epic.key, 'tk-c') + '<span style="color:var(--di);font-size:var(--fs-xs);margin-left:5px">' + esc((epic.summary||'').slice(0,40)) + '</span>') : '—'}</td>
        <td style="padding:5px 10px">${spinStatusBadge(s.status)}</td>
      </tr>`;
    }).join('');
    innerHtml = `
      <div style="padding:7px 10px 3px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:var(--fs-sm);font-weight:600;color:var(--tx)">${esc(tierShort)} — ${esc(monthName)}</span>
        <span style="font-size:var(--fs-xs);color:var(--a4);font-weight:600">${incomplete.length} open task${incomplete.length !== 1 ? 's' : ''}</span>
      </div>
      ${spinBuildSearchBar(tId)}
      <div class="tw" style="margin:0 0 2px">
        <table class="dtbl" id="${tId}">
          <thead><tr>
            ${spinMkSortTh('Ticket', 0, tId)}
            ${spinMkSortTh('Summary', 1, tId)}
            ${spinMkSortTh('Epic / Name', 2, tId)}
            ${spinMkSortTh('Status', 3, tId)}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  const expandRow = document.createElement('tr');
  expandRow.id = 'spin-tier-expand-row';
  expandRow.style.background = 'var(--s2)';
  expandRow.innerHTML = `<td colspan="${colSpan}" style="padding:0;border-bottom:2px solid var(--a1b)">${innerHtml}</td>`;
  rowEl.insertAdjacentElement('afterend', expandRow);
}

function spinCloseTierExpand() {
  const old = document.getElementById('spin-tier-expand-row');
  if (old) old.remove();
  document.querySelectorAll('td[data-spin-cell]').forEach(td => { td.style.background = ''; });
  S.spin._spinTierOpen = null;
}

// ── Global drill panel (summary bar drilldowns) ─────────────
function spinDrilldown(type) {
  const panel = document.getElementById('spin-global-drill');
  if (panel && panel.style.display !== 'none' && panel.dataset.activeType === type) {
    spinCloseDrilldown(); return;
  }
  if (panel) panel.dataset.activeType = type;

  S.spin._ctxMap = spinBuildContextMap();
  const ctx = S.spin._ctxMap;
  const allStories = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'story');
  const allEpics   = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'epic');
  const tierShort  = h => (h || 'Untiered').replace(/Tier \d+: Priority \d+:\s*/, '').replace(/Tier \d+:\s*/, '');

  function storyTableDrill(items, extraColFn) {
    if (!items.length) return '<div class="dep-empty" style="padding:12px 0">None found.</div>';
    const tId = 'spin-drill-tbl-' + (Date.now() % 10000);
    const sorted = [...items].sort((a, b) => {
      const ca = ctx[a.key] || {}, cb = ctx[b.key] || {};
      const po = { DX: 0, LX: 1, RC: 2 };
      return (po[ca.project] ?? 3) - (po[cb.project] ?? 3) || ((ca.tierRank || 99) - (cb.tierRank || 99)) || a.key.localeCompare(b.key);
    });
    const rows = sorted.map(s => {
      const c = ctx[s.key] || {};
      return `<tr data-searchable data-text="${esc((c.project + ' ' + c.epicKey + ' ' + s.key + ' ' + s.summary + ' ' + s.status).toLowerCase())}" data-status="${esc(s.status)}">
        <td style="white-space:nowrap">${spinProjBadge(c.project)}</td>
        <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${spinIssueIcon('Epic', 12)}${jiraLink(c.epicKey || '', 'tk-c')}<span style="color:var(--di);font-size:var(--fs-xs);margin-left:5px;overflow:hidden;text-overflow:ellipsis">${esc((S.spin.issues.find(i => i.key === c.epicKey)?.summary || '').slice(0,35))}</span></td>
        <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px">${spinIssueIcon(s.issueType, 12)}${spinKeyLink(s.key)} <span style="color:var(--tx);font-size:var(--fs-sm)" title="${esc(s.summary)}">${esc(s.summary)}</span></td>
        <td>${spinStatusBadge(s.status)}</td>
        ${extraColFn ? `<td style="white-space:nowrap">${extraColFn(s, c)}</td>` : ''}
      </tr>`;
    }).join('');
    const extraTh = extraColFn ? spinMkSortTh('Info', 4, tId) : '';
    return spinBuildSearchBar(tId) + `<div class="tw"><table class="dtbl" id="${tId}">
      <thead><tr>${spinMkSortTh('Proj',0,tId)}${spinMkSortTh('Epic / Name',1,tId)}${spinMkSortTh('Story',2,tId)}${spinMkSortTh('Status',3,tId)}${extraTh}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  let title = '', sub = '', body = '';

  if (type === 'deps') {
    title = 'Dependencies'; sub = 'All open dep links across epics';
    body = renderSpinUnifiedDeps('open');
  } else if (type === 'overall') {
    // Tier rollup view
    const tierMap = {};
    allStories.forEach(s => {
      const c = ctx[s.key] || {};
      const t = c.tier || 'Untiered';
      if (!tierMap[t]) tierMap[t] = { total: 0, done: 0, behind: 0, blocked: 0, rank: c.tierRank ?? 99 };
      tierMap[t].total++;
      if (spinIsDone(s.status)) tierMap[t].done++;
      if (spinIsBehind(s)) tierMap[t].behind++;
      if (_snl(s.status) === 'blocked') tierMap[t].blocked++;
    });
    const sortedTiers = Object.entries(tierMap).sort((a, b) => a[1].rank - b[1].rank);
    body = sortedTiers.map(([tier, st]) => {
      const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
      const barClr = pct >= 67 ? 'var(--a3)' : pct >= 34 ? 'var(--a4)' : 'var(--a5)';
      return `<div style="margin-bottom:8px;padding:11px 14px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <span style="font-size:var(--fs-base);font-weight:600;color:var(--tx);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tierShort(tier))}</span>
          <span style="font-size:var(--fs-base);font-weight:700;color:${barClr};min-width:44px;text-align:right;flex-shrink:0">${pct}%</span>
          <span style="font-size:var(--fs-sm);color:var(--mu);min-width:52px;text-align:right;flex-shrink:0">${st.done}/${st.total}</span>
          ${spinBehindBadge(st.behind)}
          ${spinBlockedBadge(st.blocked)}
        </div>
        <div style="height:6px;background:var(--s5);border-radius:20px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barClr};border-radius:20px;transition:width .3s"></div>
        </div>
      </div>`;
    }).join('') || '<div class="dep-empty">No data.</div>';
    title = 'Overall Progress'; sub = 'By tier';
  } else if (type === 'epics') {
    const tId = 'spin-drill-epics';
    const rows = allEpics.sort((a,b) => ({DX:0,LX:1,RC:2}[a.project]??3)-({DX:0,LX:1,RC:2}[b.project]??3)||a.key.localeCompare(b.key)).map(e => {
      const st = S.spin.issues.filter(s => s.epicLink === e.key || s.parentKey === e.key);
      const done = st.filter(s => spinIsDone(s.status)).length;
      const pct = st.length ? Math.round(done / st.length * 100) : 0;
      const c = pct >= 67 ? 'var(--a3)' : pct >= 34 ? 'var(--a4)' : 'var(--a5)';
      return `<tr data-searchable data-text="${esc((e.project+' '+e.key+' '+e.summary).toLowerCase())}">
        <td>${spinProjBadge(e.project)}</td><td>${spinIssueIcon('Epic',12)}${spinKeyLink(e.key)}</td>
        <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.summary)}">${esc(e.summary)}</td>
        <td><span style="font-weight:600;color:${c}">${pct}%</span> <span class="u-dim-xs">${done}/${st.length}</span></td>
      </tr>`;
    }).join('');
    body = spinBuildSearchBar(tId) + `<div class="tw"><table class="dtbl" id="${tId}">
      <thead><tr>${spinMkSortTh('Proj',0,tId)}${spinMkSortTh('Key',1,tId)}${spinMkSortTh('Summary',2,tId)}${spinMkSortTh('Progress',3,tId)}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    title = 'All Epics'; sub = `${allEpics.length} epics`;
  } else if (type === 'programs' || type === 'strategies') {
    const level = type === 'programs' ? 'program' : 'strategy';
    const items = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === level);
    const tId = 'spin-drill-' + type;
    const rows = items.sort((a,b) => ({DX:0,LX:1,RC:2}[a.project]??3)-({DX:0,LX:1,RC:2}[b.project]??3)||a.key.localeCompare(b.key)).map(prog => {
      const node = S.spin._nodeMap[prog.key];
      const st   = node ? spinCollectLeaves(node) : [];
      const done    = st.filter(s => spinIsDone(s.status)).length;
      const behind  = st.filter(s => spinIsBehind(s)).length;
      const blocked = st.filter(s => _snl(s.status) === 'blocked').length;
      const pct     = st.length ? Math.round(done / st.length * 100) : 0;
      const pctClr  = pct >= 67 ? 'var(--a3)' : pct >= 34 ? 'var(--a4)' : 'var(--a5)';
      return `<tr data-searchable data-text="${esc((prog.project+' '+prog.key+' '+prog.summary).toLowerCase())}">
        <td>${spinProjBadge(prog.project)}</td>
        <td style="white-space:nowrap">${spinIssueIcon(prog.issueType,12)}${spinKeyLink(prog.key)}</td>
        <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(prog.summary)}">${esc(prog.summary)}</td>
        <td style="white-space:nowrap">
          <span style="font-weight:700;color:${pctClr}">${pct}%</span>
          <span style="color:var(--di);font-size:var(--fs-xs);margin-left:4px">${done}/${st.length}</span>
          ${spinBehindBadge(behind)}${spinBlockedBadge(blocked)}
        </td>
      </tr>`;
    }).join('');
    body = spinBuildSearchBar(tId) + `<div class="tw"><table class="dtbl" id="${tId}">
      <thead><tr>
        ${spinMkSortTh('Proj',0,tId)}
        ${spinMkSortTh('Key',1,tId)}
        ${spinMkSortTh('Summary',2,tId)}
        ${spinMkSortTh('Progress',3,tId)}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    title = type === 'programs' ? 'Programs' : 'Strategies';
    sub = `${items.length} ${type}`;
  } else {
    const cfgMap = {
      stories:  { t: 'All Stories',     s: `${allStories.length} total`,                      items: allStories,                                       extra: null },
      complete: { t: 'Complete Stories', s: 'Done / Closed / Resolved',                        items: allStories.filter(s => spinIsDone(s.status)),     extra: null },
      behind:   { t: 'Behind Schedule',  s: 'Past sprint end, not done',                       items: allStories.filter(s => spinIsBehind(s)),           extra: (s) => `<span style="font-size:var(--fs-xs);color:var(--a4)">${esc(s.sprint ? sprintToSpin(s.sprint) : 'no sprint')}</span>` },
      blocked:  { t: 'Blocked Stories',  s: 'Status = Blocked',                               items: allStories.filter(s => _snl(s.status) === 'blocked'), extra: null },
    };
    const cfg = cfgMap[type];
    if (!cfg) return;
    title = cfg.t; sub = cfg.s;
    body = storyTableDrill(cfg.items, cfg.extra);
  }

  spinShowDrilldownPanel(title, sub, body);
}

function spinShowDrilldownPanel(title, sub, bodyHtml) {
  const panel = document.getElementById('spin-global-drill');
  if (!panel) return;
  panel.querySelector('.spin-drill-hdr span').textContent = title + (sub ? ' — ' + sub : '');
  panel.querySelector('.spin-drill-body').innerHTML = bodyHtml;
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function spinCloseDrilldown() {
  const el = document.getElementById('spin-global-drill');
  if (el) { el.style.display = 'none'; el.dataset.activeType = ''; }
}

// ── Unified deps panel (global view all deps) ───────────────
function renderSpinUnifiedDeps(filter) {
  filter = filter || 'open';
  const epics = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'epic');
  const epicNodes = Object.values(S.spin._nodeMap || {}).filter(n => ['epic','initiative'].includes(spinClassifyLevel(n.issue.issueType)));

  const jiraDeps = [];
  epicNodes.forEach(n => {
    const epic = n.issue;
    const deps = spinGatherDeps(n);
    deps.blockedBy.forEach(d => {
      const nk = `${epic.key}_${d.key}`;
      const closed = !!S.spin.depClosed[nk];
      const jiraResolved = spinIsDone(d.status);
      jiraDeps.push({ id: nk, source: 'jira', epic, depKey: d.key, depSummary: d.summary || '', depStatus: d.status || '', note: S.spin.depNotes[nk] || '', closed, jiraResolved });
    });
  });

  const all = jiraDeps;
  const open = all.filter(d => !d.closed && !d.jiraResolved);
  const closed = all.filter(d => d.closed || d.jiraResolved);
  const rows = filter === 'open' ? open : filter === 'closed' ? closed : all;

  const filterTabs = ['open', 'closed', 'all'].map(f =>
    `<button onclick="spinRefreshDeps('${f}')" style="padding:3px 13px;border-radius:20px;font-size:var(--fs-xs);font-weight:${filter===f?'700':'500'};cursor:pointer;border:1px solid ${filter===f?'var(--a1b)':'var(--bd)'};background:${filter===f?'var(--a1d)':'var(--s3)'};color:${filter===f?'var(--a1)':'var(--mu)'}">${f.charAt(0).toUpperCase()+f.slice(1)} (${f==='open'?open.length:f==='closed'?closed.length:all.length})</button>`
  ).join('');

  const header = `<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">${filterTabs}</div>`;
  if (!rows.length) return header + '<div class="dep-empty" style="padding:10px 0">No dependencies in this category.</div>';

  const tId = 'spin-udeps-tbl';
  const tableRows = rows.map(dep => {
    const isClosed = dep.closed || dep.jiraResolved;
    const noteVal = dep.note || '';
    const editId = `sdep-${dep.id.replace(/[^a-z0-9]/gi, '_')}`;
    const noteDisplay = noteVal
      ? `<span class="u-muted-xs">${esc(noteVal.slice(0, 60))}${noteVal.length > 60 ? '…' : ''}</span>`
      : `<span style="font-size:var(--fs-xs);color:var(--di);font-style:italic">no note</span>`;
    const editBtn = `<button onclick="spinToggleNoteEdit('${editId}')" style="padding:1px 7px;border-radius:10px;font-size:var(--fs-xs);cursor:pointer;border:1px solid var(--bd);background:var(--s4);color:var(--mu);margin-left:5px">Edit</button>`;
    const noteCell = `<div style="display:flex;align-items:center;gap:3px">
      <div id="${editId}-view" style="display:flex;align-items:center">${noteDisplay}${editBtn}</div>
      <div id="${editId}-edit" style="display:none;align-items:center;gap:4px;width:100%">
        <input id="${editId}-input" value="${esc(noteVal)}" placeholder="Add note…" style="flex:1;min-width:100px;background:var(--s4);border:1px solid var(--bd2);color:var(--tx);font-family:var(--sans);font-size:var(--fs-xs);padding:3px 7px;border-radius:var(--r2);outline:none">
        <button onclick="spinSaveNote('${esc(dep.id)}','${editId}')" style="padding:2px 9px;border-radius:10px;font-size:var(--fs-xs);cursor:pointer;border:1px solid var(--a3b);background:var(--a3d);color:var(--a3);font-weight:600">Save</button>
        <button onclick="spinToggleNoteEdit('${editId}')" style="padding:2px 7px;border-radius:10px;font-size:var(--fs-xs);cursor:pointer;border:1px solid var(--bd);background:transparent;color:var(--mu)">✕</button>
      </div>
    </div>`;
    const actionBtn = !isClosed
      ? `<button onclick="spinCloseDep('${esc(dep.id)}','${esc(dep.depKey)}')" style="white-space:nowrap;padding:2px 9px;border-radius:20px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;border:1px solid var(--a3b);background:var(--a3d);color:var(--a3)">Mark Resolved</button>`
      : `<div style="display:flex;align-items:center;gap:5px"><span style="font-size:var(--fs-xs);color:var(--a3);font-weight:600">&#10003; Resolved</span>
         <button onclick="spinReopenDep('${esc(dep.id)}','${esc(dep.depKey)}')" style="white-space:nowrap;padding:2px 9px;border-radius:20px;font-size:var(--fs-xs);cursor:pointer;border:1px solid var(--bd);background:var(--s4);color:var(--mu)">Reopen</button></div>`;
    return `<tr style="${isClosed ? 'opacity:.55' : ''}">
      <td style="white-space:nowrap">${dep.epic ? spinProjBadge(dep.epic.project) : ''}</td>
      <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${dep.epic ? (jiraLink(dep.epic.key, 'tk-c') + '<span style="color:var(--di);font-size:var(--fs-xs);margin-left:5px">' + esc((dep.epic.summary || '').slice(0, 35)) + '</span>') : ''}</td>
      <td style="white-space:nowrap">${dep.depKey ? spinDepKeyLink(dep.depKey) : ''}</td>
      <td style="min-width:160px;max-width:260px">${noteCell}</td>
      <td style="white-space:nowrap">${actionBtn}</td>
    </tr>`;
  }).join('');

  return header + `<div class="tw"><table class="dtbl" id="${tId}">
    <thead><tr>
      ${spinMkSortTh('Project', 0, tId)}
      ${spinMkSortTh('Epic / Name', 1, tId)}
      ${spinMkSortTh('Depends On', 2, tId)}
      ${spinMkSortTh('Note', 3, tId)}
      <th style="background:var(--s3);padding:6px 10px;font-size:var(--fs-xs);font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--bd)">Action</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table></div>`;
}

function spinRefreshDeps(filter) {
  // Also refresh standalone deps dashboard if open
  const dashBody = document.getElementById('deps-dash-body');
  if (dashBody && document.getElementById('deps-dashboard-overlay')?.style.display !== 'none') {
    dashBody.innerHTML = renderSpinUnifiedDeps(filter);
  }
  const body = document.getElementById('spin-global-drill')?.querySelector('.spin-drill-body');
  if (body) body.innerHTML = renderSpinUnifiedDeps(filter);
  const panel = document.getElementById('spin-global-drill');
  if (panel) panel.dataset.depsFilter = filter;
  const saved = _spinSortState['spin-udeps-tbl'];
  if (saved && saved.col >= 0) spinSortTable('spin-udeps-tbl', saved.col, saved.dir);
}

function spinCloseDep(id, depKey) {
  // Resolve across all epics that share this dep key
  Object.values(S.spin._nodeMap || {})
    .filter(n => spinClassifyLevel(n.issue.issueType) === 'epic')
    .forEach(n => {
      spinGatherDeps(n).blockedBy.filter(d => d.key === depKey).forEach(d => {
        S.spin.depClosed[n.issue.key + '_' + d.key] = true;
      });
    });
  const filter = document.getElementById('spin-global-drill')?.dataset.depsFilter || 'open';
  spinRefreshDeps(filter);
  spinUpdateSummaryBar();
}

function spinReopenDep(id, depKey) {
  Object.keys(S.spin.depClosed).forEach(k => { if (k.endsWith('_' + depKey)) delete S.spin.depClosed[k]; });
  const filter = document.getElementById('spin-global-drill')?.dataset.depsFilter || 'open';
  spinRefreshDeps(filter);
  spinUpdateSummaryBar();
}

function spinToggleNoteEdit(editId) {
  const view = document.getElementById(editId + '-view');
  const edit = document.getElementById(editId + '-edit');
  if (!view || !edit) return;
  const isEditing = edit.style.display !== 'none';
  view.style.display = isEditing ? 'flex' : 'none';
  edit.style.display = isEditing ? 'none' : 'flex';
  if (!isEditing) setTimeout(() => document.getElementById(editId + '-input')?.focus(), 50);
}

function spinSaveNote(id, editId) {
  const input = document.getElementById(editId + '-input');
  if (!input) return;
  const val = input.value.trim();
  S.spin.depNotes[id] = val;
  spinToggleNoteEdit(editId);
  spinRefreshDeps(document.getElementById('spin-global-drill')?.dataset.depsFilter || 'open');
}

// ── Summary bar with clickable drilldown chips ───────────────
function spinUpdateSummaryBar() {
  const gStats = spinGlobalStats();
  const openDeps = Object.values(S.spin._nodeMap || {})
    .filter(n => spinClassifyLevel(n.issue.issueType) === 'epic')
    .reduce((sum, n) => {
      const deps = spinGatherDeps(n);
      return sum + deps.blockedBy.filter(d => !spinIsDone(d.status) && !S.spin.depClosed[n.issue.key + '_' + d.key]).length;
    }, 0);
  const allEpics = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'epic');
  const strategies = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'strategy').length;
  const programs = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'program').length;
  const pctCls = gStats.pct >= 67 ? 'c-green' : gStats.pct >= 34 ? 'c-amber' : 'c-red';

  // Diagnostic: count how many epics have stories (tree resolution health)
  const epicsWithKids = allEpics.filter(e => {
    const n = S.spin._nodeMap[e.key];
    return n && n.children.length > 0;
  }).length;
  const epicsEmpty = allEpics.length - epicsWithKids;
  // Count orphaned stories (not reachable from any epic via tree)
  const allStoryIssues = S.spin.issues.filter(i => spinClassifyLevel(i.issueType) === 'story');
  const storiesInTree = gStats.total; // spinGlobalStats counts leaves under epics
  const orphanStories = allStoryIssues.length - storiesInTree;

  const diagParts = [`${gStats.total} stories under ${epicsWithKids} epics`];
  if (epicsEmpty) diagParts.push(`${epicsEmpty} epics empty`);
  if (orphanStories > 0) diagParts.push(`${orphanStories} orphan stories`);
  const diagCls = orphanStories > 0 ? 'color:var(--a4)' : 'color:var(--mu)';
  const diagLine = `<div style="font-size:var(--fs-xs);${diagCls};padding:0 4px 8px;display:flex;gap:6px;align-items:center"><span class="mi" style="font-size:12px">info</span>${esc(diagParts.join(' · '))}</div>`;

  const bar = `<div class="spin-sum-bar" style="margin-bottom:14px">
    <div class="sc clickable" onclick="spinDrilldown('programs')" title="All programs"><div class="sv c-blue">${programs}</div><div class="sl">${spinIssueIcon('Program',11)} Programs ›</div></div>
    <div class="sc clickable" onclick="spinDrilldown('epics')" title="All epics"><div class="sv c-blue">${allEpics.length}</div><div class="sl">${spinIssueIcon('Epic',11)} Epics ›</div></div>
    <div class="sc clickable" onclick="spinDrilldown('stories')" title="All stories"><div class="sv c-blue">${gStats.total}</div><div class="sl">${spinIssueIcon('Story',11)} Stories ›</div></div>
    <div class="sc clickable" onclick="spinDrilldown('complete')" title="Complete stories"><div class="sv c-green">${gStats.done}</div><div class="sl"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="vertical-align:middle"><rect width="16" height="16" rx="3" fill="#36B37E"/><path d="M4 8l3 3 5-5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg> Complete ›</div></div>
    <div class="sc clickable" onclick="spinDrilldown('overall')" title="Progress by tier"><div class="sv ${pctCls}">${gStats.pct}%</div><div class="sl">&#9646; Overall ›</div></div>
    <div class="sc clickable" onclick="spinDrilldown('behind')" title="Behind schedule"><div class="sv c-amber">${gStats.behind}</div><div class="sl"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>Behind ›</div></div>
    <div class="sc clickable" onclick="spinDrilldown('blocked')" title="Blocked stories"><div class="sv c-red">${gStats.blocked}</div><div class="sl">${spinBlockedIcon(11)} Blocked ›</div></div>
    <div class="sc clickable" onclick="spinDrilldown('deps')" title="Open dependencies"><div class="sv c-purple">${openDeps}</div><div class="sl">${spinDepIcon(13)} Deps ›</div></div>
  </div>`;

  const el = document.getElementById('spin-sumbar-slot');
  if (el) el.innerHTML = diagLine + bar;
}

// ── Search bar builder ───────────────────────────────────────
function spinBuildSearchBar(containerId) {
  return `<div class="sf-bar" id="sfbar-${containerId}" style="flex-wrap:nowrap;padding:6px 0">
    <input class="sf-search" id="sfsearch-${containerId}" type="text" placeholder="Search…" oninput="spinFilterRows('${containerId}')" style="flex:1;min-width:80px;font-family:var(--sans);font-size:var(--fs-xs)">
    <select class="sf-sel" id="sfstatus-${containerId}" onchange="spinFilterRows('${containerId}')" style="width:auto;flex-shrink:1;min-width:0;font-size:var(--fs-xs)">
      <option value="">All Statuses</option>
      <option>In Progress</option><option>Open</option><option>Done</option>
      <option>Blocked</option><option>Reviewing</option><option>In Test</option>
    </select>
    <span class="sf-count" id="sfcount-${containerId}" style="white-space:nowrap;flex-shrink:0"></span>
    <button class="sf-clear" onclick="spinClearSearch('${containerId}')" style="flex-shrink:0;white-space:nowrap;background:none;border:none;color:var(--mu);cursor:pointer;font-size:var(--fs-xs);padding:4px 6px;display:flex;align-items:center;gap:2px"><span class="mi" style="font-size:12px">close</span> Clear</button>
  </div>`;
}

function spinFilterRows(containerId) {
  const q    = (document.getElementById('sfsearch-' + containerId)?.value || '').toLowerCase().trim();
  const stat = (document.getElementById('sfstatus-' + containerId)?.value || '').toLowerCase();
  const countEl = document.getElementById('sfcount-' + containerId);
  const container = document.getElementById(containerId);
  if (!container) return;
  const rows = container.querySelectorAll('tr[data-searchable]');
  let visible = 0;
  rows.forEach(row => {
    const text = (row.dataset.text || row.textContent || '').toLowerCase();
    const rowStat = (row.dataset.status || '').toLowerCase();
    const show = (!q || text.includes(q)) && (!stat || rowStat.includes(stat));
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  if (countEl) countEl.textContent = rows.length ? `${visible}/${rows.length}` : '';
}

function spinClearSearch(containerId) {
  const s = document.getElementById('sfsearch-' + containerId);
  const st = document.getElementById('sfstatus-' + containerId);
  if (s) s.value = '';
  if (st) st.value = '';
  spinFilterRows(containerId);
}

// ── Table sort ───────────────────────────────────────────────
const _spinSortState = {};
function spinSortTable(tableId, colIdx, forcedDir) {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  const state = _spinSortState[tableId] || { col: -1, dir: 'asc' };
  const newDir = forcedDir || (state.col === colIdx && state.dir === 'asc' ? 'desc' : 'asc');
  _spinSortState[tableId] = { col: colIdx, dir: newDir };
  tbl.querySelectorAll('th').forEach((th, i) => {
    const icon = th.querySelector('.th-sort-icon');
    if (!icon) return;
    if (i === colIdx) {
      icon.className = 'mi'; icon.style.fontSize = '11px';
      icon.textContent = newDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
    } else {
      icon.className = 'mi'; icon.style.fontSize = '11px';
      icon.textContent = 'swap_vert';
    }
    icon.classList.toggle('active', i === colIdx);
  });
  const tbody = tbl.querySelector('tbody') || tbl;
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => r.querySelectorAll('td').length > 1);
  rows.sort((a, b) => {
    const aT = (a.querySelectorAll('td')[colIdx]?.dataset.sort || a.querySelectorAll('td')[colIdx]?.textContent || '').trim().toLowerCase();
    const bT = (b.querySelectorAll('td')[colIdx]?.dataset.sort || b.querySelectorAll('td')[colIdx]?.textContent || '').trim().toLowerCase();
    const aN = parseFloat(aT), bN = parseFloat(bT);
    const cmp = !isNaN(aN) && !isNaN(bN) ? aN - bN : aT.localeCompare(bT, undefined, { numeric: true });
    return newDir === 'asc' ? cmp : -cmp;
  });
  rows.forEach(r => tbody.appendChild(r));
}

function spinMkSortTh(label, colIdx, tableId) {
  const ico = '<svg style="width:11px;height:11px;fill:currentColor;vertical-align:middle;opacity:.45;margin-left:3px"><use href="#mi-swap_vert"/></svg>';
  return `<th class="th-sort-th" onclick="spinSortTable('${tableId}',${colIdx})"><span class="th-sort">${esc(label)}${ico}</span></th>`;
}

// ── Epic controls: expand/collapse all in a section ─────────
function spinExpandAllEpics(sectionId) {
  const body = document.getElementById(sectionId);
  if (!body) return;
  body.querySelectorAll('[id^="spinl2body-"]').forEach(el => {
    if (!el.classList.contains('open')) {
      const id = el.id.replace('spinl2body-', '');
      el.classList.add('open');
      document.getElementById('spinl2-' + id)?.classList.add('open');
      const xb = document.getElementById('spinxbtn-' + id);
      if (xb) { xb.classList.add('open'); xb.textContent = '−'; }
      document.getElementById('spinchev-' + id)?.classList.add('open');
    }
  });
}

function spinCollapseAllEpics(sectionId) {
  const body = document.getElementById(sectionId);
  if (!body) return;
  body.querySelectorAll('[id^="spinl2body-"]').forEach(el => {
    if (el.classList.contains('open')) {
      const id = el.id.replace('spinl2body-', '');
      el.classList.remove('open');
      document.getElementById('spinl2-' + id)?.classList.remove('open');
      const xb = document.getElementById('spinxbtn-' + id);
      if (xb) { xb.classList.remove('open'); xb.textContent = '+'; }
      document.getElementById('spinchev-' + id)?.classList.remove('open');
    }
  });
}

// ── Epic sort by completion % ────────────────────────────────
function spinSortEpicsByPct(sectionId) {
  const body = document.getElementById(sectionId);
  if (!body) return;
  const rows = Array.from(body.querySelectorAll('.lrow[id^="spinrow-"]'));
  rows.sort((a, b) => {
    const getPct = el => {
      const pctEl = el.querySelector('.prog-pct');
      return pctEl ? parseInt(pctEl.textContent) || 0 : 0;
    };
    return getPct(b) - getPct(a); // descending
  });
  rows.forEach(r => body.appendChild(r));
}


