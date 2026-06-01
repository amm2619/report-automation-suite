'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vt2.v1';
const PROJECTS    = ['DX', 'LX', 'RC', 'AFX'];
const ALL_TABS    = ['All', ...PROJECTS];

const PROJ_COLOR = {
  DX:  '#06b6d4',
  LX:  '#7c3aed',
  RC:  '#f97316',
  AFX: '#ec4899',
  All: '#a78bfa',
};

// ─── State ────────────────────────────────────────────────────────────────────

const DEFAULT = {
  tickets: [],
  manual: {},        // sprintName → { name, start, end, plan:{}, comp:{} }
  config: { jiraUrl: '' },
  view: { project: 'All', metric: 'points' },
};

let S = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT);
    return Object.assign(clone(DEFAULT), JSON.parse(raw));
  } catch (_) {
    return clone(DEFAULT);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.length) return [];
  const first   = lines[0] || '';
  const tabs    = (first.match(/\t/g)  || []).length;
  const commas  = (first.match(/,/g)   || []).length;
  const delim   = tabs > commas ? '\t' : ',';
  const re      = delim === '\t'
    ? /("(?:[^"]|"")*"|[^\t]*)\t?/g
    : /("(?:[^"]|"")*"|[^,]*),?/g;

  function parseLine(line) {
    const out = [];
    const rx  = new RegExp(re.source, 'g');
    let m;
    while ((m = rx.exec(line)) !== null) {
      if (m.index === rx.lastIndex) { rx.lastIndex++; break; }
      let v = m[1];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"');
      out.push(v);
    }
    return out;
  }

  const seen = {};
  const headers = parseLine(lines[0]).map(h => {
    const k = h.trim();
    if (seen[k] === undefined) { seen[k] = 0; return k; }
    return `${k}.${++seen[k]}`;
  });

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseLine(lines[i]);
    const row  = {};
    headers.forEach((h, j) => { row[h] = (vals[j] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function resolveField(row, name) {
  if (row[name] !== undefined) return row[name] || '';
  const tries = [
    `Custom field (${name})`,
    `customfield_${name}`,
    name.replace(/ /g, '_'),
    name.toLowerCase(),
  ];
  for (const t of tries) {
    if (row[t] !== undefined) return row[t] || '';
  }
  const lower = name.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase().includes(lower)) return row[k] || '';
  }
  return '';
}

function normSprint(raw) {
  if (!raw) return '';
  let s = raw.trim();
  const blob = s.match(/\bname=([^,\]]+)/i);
  if (blob) s = blob[1].trim();
  s = s.replace(/\s*\[EXT\](?:\[COMPLETED\])?/gi, '').trim();
  const num = s.match(/(\d{2,4}\.\d+\.\d+)/);
  return num ? num[1] : s;
}

function collectSprints(row) {
  const seen = new Set();
  const out  = [];
  for (const [k, v] of Object.entries(row)) {
    if (!/^sprint(\.\d+)?$/i.test(k.trim()) || !v) continue;
    for (const part of String(v).split(/\s*\+\s*/)) {
      const n = normSprint(part);
      if (n && !seen.has(n)) { seen.add(n); out.push(n); }
    }
  }
  return out;
}

function bucketProject(key) {
  const m = (key || '').match(/^([A-Z]+)/);
  if (!m) return '';
  return m[1] === 'RCR' ? 'RC' : m[1];
}

function parsePoints(row) {
  const raw = resolveField(row, 'Story Points') || resolveField(row, 'Story point estimate') || '0';
  return parseFloat(raw) || 0;
}

const DONE_SET = new Set(['done', 'closed', 'resolved']);
const isDone   = status => DONE_SET.has((status || '').toLowerCase().trim());

function buildTicket(row) {
  const key = (resolveField(row, 'Issue key') || resolveField(row, 'Key') || '').trim();
  return {
    key,
    project: bucketProject(key),
    sprints: collectSprints(row),
    points:  parsePoints(row),
    done:    isDone(resolveField(row, 'Status')),
  };
}

// ─── CSV load ─────────────────────────────────────────────────────────────────

function loadCSV(text, filename) {
  const rows = parseCSV(text);
  if (!rows.length) { showToast('No rows found in CSV.', 'error'); return; }

  const hasSprintCol = rows.some(r =>
    Object.keys(r).some(k => /^sprint(\.\d+)?$/i.test(k.trim()))
  );
  if (!hasSprintCol) {
    showToast('No Sprint column found — make sure your Jira export includes Sprint.', 'error');
    return;
  }

  const tickets = rows
    .map(buildTicket)
    .filter(t => t.key && t.sprints.length && PROJECTS.includes(t.project));

  if (!tickets.length) {
    showToast('No valid project tickets found. Check Issue Key and Sprint columns.', 'error');
    return;
  }

  S.tickets = tickets;
  saveState();
  showToast(`Loaded ${tickets.length} tickets from ${filename}`, 'success');
  render();
}

// ─── Series computation ───────────────────────────────────────────────────────

function compareSprints(a, b) {
  const p = s => { const m = s.match(/^(\d+)\.(\d+)\.(\d+)/); return m ? [+m[1],+m[2],+m[3]] : null; };
  const pa = p(a), pb = p(b);
  if (pa && pb) {
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  }
  return (pa ? -1 : pb ? 1 : a.localeCompare(b));
}

function empty() {
  const o = { All: 0 };
  PROJECTS.forEach(p => { o[p] = 0; });
  return o;
}

function buildSeries() {
  const names = new Set();
  S.tickets.forEach(t => t.sprints.forEach(s => names.add(s)));
  Object.keys(S.manual).forEach(n => names.add(n));

  return [...names].sort(compareSprints).map(name => {
    const plan  = empty(), comp  = empty();
    const planN = empty(), compN = empty();

    S.tickets.forEach(t => {
      if (!t.sprints.includes(name)) return;
      if (!PROJECTS.includes(t.project)) return;
      const p = t.project;
      plan[p]  += t.points; plan.All  += t.points; planN[p]++; planN.All++;
      if (t.done) { comp[p] += t.points; comp.All += t.points; compN[p]++; compN.All++; }
    });

    const m = S.manual[name];
    let start = '', end = '';
    if (m) {
      start = m.start || '';
      end   = m.end   || '';
      PROJECTS.forEach(p => {
        if (m.plan?.[p] !== undefined) plan[p]  = m.plan[p];
        if (m.comp?.[p] !== undefined) comp[p]  = m.comp[p];
      });
      plan.All = PROJECTS.reduce((s, p) => s + plan[p], 0);
      comp.All = PROJECTS.reduce((s, p) => s + comp[p], 0);
    }
    return { name, start, end, plan, comp, planN, compN };
  });
}

function statsFor(series, project, metric) {
  const pk = metric === 'count' ? 'planN' : 'plan';
  const ck = metric === 'count' ? 'compN' : 'comp';
  const committed = series.map(s => s[pk][project] || 0);
  const completed = series.map(s => s[ck][project] || 0);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const avg = a => a.length ? sum(a) / a.length : 0;
  const totC = sum(committed), totD = sum(completed);
  return {
    committed, completed,
    avg:            avg(completed),
    recent:         avg(completed.slice(-3)),
    completionRate: totC > 0 ? (totD / totC) * 100 : 0,
    sprintCount:    series.length,
    totCommitted:   totC,
    totCompleted:   totD,
    max:            Math.max(1, ...committed, ...completed),
  };
}

function rollingAvg(arr, w = 3) {
  return arr.map((_, i) => {
    const sl = arr.slice(Math.max(0, i - w + 1), i + 1);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]
  );
}

function fmt(n, d = 1) {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  return n === Math.floor(n) ? String(n) : n.toFixed(d);
}

function pctTone(pct) {
  return pct >= 90 ? 'good' : pct >= 70 ? 'warn' : 'bad';
}

function uid() {
  return window.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'info') {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.classList.add('fading');
    setTimeout(() => el.remove(), 280);
  }, 3200);
}

// ─── Export / Import ──────────────────────────────────────────────────────────

function exportJSON() {
  const blob = new Blob(
    [JSON.stringify({ tickets: S.tickets, manual: S.manual, config: S.config }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), {
    href:     url,
    download: `velocity-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(text) {
  try {
    const d = JSON.parse(text);
    if (d.tickets) S.tickets = d.tickets;
    if (d.manual)  S.manual  = d.manual;
    if (d.config)  Object.assign(S.config, d.config);
    saveState();
    showToast('Data imported.', 'success');
    render();
  } catch (_) {
    showToast('Invalid JSON — check the file and try again.', 'error');
  }
}

// ─── Manual sprint CRUD ───────────────────────────────────────────────────────

function saveManualSprint(data) {
  S.manual[data.name] = data;
  saveState();
  render();
}

function deleteManualSprint(name) {
  delete S.manual[name];
  saveState();
  render();
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function hasData() {
  return S.tickets.length > 0 || Object.keys(S.manual).length > 0;
}

function render() {
  const has = hasData();
  document.getElementById('upload-zone').classList.toggle('hidden', has);
  document.getElementById('dashboard').classList.toggle('hidden', !has);
  if (!has) return;

  const series           = buildSeries();
  const { project, metric } = S.view;

  renderStatsBar(series);
  renderKPIs(series, project, metric);
  renderSparkgrid(series, metric);
  renderChart(series, project, metric);
  renderTable(series, project, metric);
  syncActiveStates();
}

function renderStatsBar(series) {
  const el   = document.getElementById('stats-bar');
  const projs = [...new Set(S.tickets.map(t => t.project))].filter(p => PROJECTS.includes(p)).sort();
  const parts = [];
  if (S.tickets.length) parts.push(`<strong>${S.tickets.length}</strong> tickets`);
  const mc = Object.keys(S.manual).length;
  if (mc) parts.push(`<strong>${mc}</strong> manual sprint${mc !== 1 ? 's' : ''}`);
  parts.push(`<strong>${series.length}</strong> sprints`);
  if (projs.length) {
    parts.push('Projects: ' + projs.map(p =>
      `<span class="proj-chip" style="color:${PROJ_COLOR[p]}">${p}</span>`
    ).join(''));
  }
  el.innerHTML = parts.join('<span class="sep">·</span>')
    + '<button class="upload-link" onclick="document.getElementById(\'csv-input\').click()">Upload new CSV</button>';
}

function renderKPIs(series, project, metric) {
  const st   = statsFor(series, project, metric);
  const unit = metric === 'count' ? 'stories' : 'pts';
  const tone = pctTone(st.completionRate);
  const items = [
    { lbl:'Avg Velocity',   val:fmt(st.avg),   unit, sub:'all sprints',       cls:'kpi-1' },
    { lbl:'Last 3 Sprints', val:fmt(st.recent), unit, sub:'rolling average',  cls:'kpi-2' },
    { lbl:'Completion',     val:fmt(st.completionRate, 0)+'%', unit:'', sub:'planned vs done', cls:`kpi-3-${tone}` },
    { lbl:'Sprints',        val:String(st.sprintCount),        unit:'', sub:'tracked total',   cls:'kpi-4' },
  ];
  document.getElementById('kpi-row').innerHTML = items.map(it =>
    `<div class="kpi-card ${it.cls}">
      <div class="kpi-label">${esc(it.lbl)}</div>
      <div class="kpi-value">${esc(it.val)}<span class="kpi-unit">${esc(it.unit)}</span></div>
      <div class="kpi-sub">${esc(it.sub)}</div>
    </div>`
  ).join('');
}

function renderSparkgrid(series, metric) {
  const ck = metric === 'count' ? 'compN' : 'comp';
  document.getElementById('sparkgrid').innerHTML = PROJECTS.map(p => {
    const data   = series.map(s => s[ck][p] || 0);
    const st     = statsFor(series, p, metric);
    const color  = PROJ_COLOR[p];
    const isActive = S.view.project === p;
    const W = 200, H = 44, pad = 3;
    const iW = W - pad * 2, iH = H - pad * 2;
    const mx = Math.max(1, ...data);
    const step = data.length > 1 ? iW / (data.length - 1) : 0;
    const pts  = data.map((v, i) =>
      `${(pad + i * step).toFixed(1)},${(pad + iH - (v / mx) * iH).toFixed(1)}`
    ).join(' ');
    const lx = (pad + (data.length - 1) * step).toFixed(1);
    const ly = (pad + iH - ((data.at(-1) || 0) / mx) * iH).toFixed(1);
    return `<button class="spark-card${isActive ? ' active' : ''}" data-project="${p}"
              style="--spark-color:${color}" onclick="setProject('${p}')">
      <div class="spark-head">
        <span class="spark-name" style="color:${color}">${esc(p)}</span>
        <span class="spark-val"  style="color:${color}">${fmt(st.recent)}</span>
      </div>
      <svg class="spark-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <polyline fill="none" stroke="${color}" stroke-width="2" opacity=".85" points="${pts}"/>
        <circle cx="${lx}" cy="${ly}" r="3.5" fill="${color}"/>
      </svg>
      <div class="spark-foot">avg ${fmt(st.avg)} · ${st.sprintCount} sprint${st.sprintCount !== 1 ? 's' : ''}</div>
    </button>`;
  }).join('');
}

function renderChart(series, project, metric) {
  const el    = document.getElementById('chart-area');
  const color = PROJ_COLOR[project];

  document.getElementById('chart-dot').style.background = color;
  document.getElementById('chart-proj-name').textContent =
    project === 'All' ? 'All Projects' : project;
  document.getElementById('leg-comp-swatch').style.background = color;

  if (!series.length) {
    el.innerHTML = '<div class="chart-empty">No sprint data yet — upload a CSV or add sprints manually.</div>';
    return;
  }

  const st    = statsFor(series, project, metric);
  const trend = rollingAvg(st.completed);

  const W  = 800, H  = 260;
  const pL = 42,  pR = 14, pT = 16, pB = 38;
  const iW = W - pL - pR, iH = H - pT - pB;
  const n  = series.length;
  const slot = n ? iW / n : 0;
  const mx   = Math.max(st.max, ...trend, 1);
  const yS   = v => pT + iH - (v / mx) * iH;

  let yLines = '';
  for (let i = 0; i <= 4; i++) {
    const v = Math.round(mx * i / 4);
    const y = yS(v).toFixed(1);
    yLines += `<line class="v-grid" x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}"/>
               <text class="v-axis" x="${pL - 5}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
  }

  let bars = '', tPts = [], xLbls = '';
  series.forEach((s, i) => {
    const cx  = pL + slot * i + slot / 2;
    const bw  = Math.max(5, Math.min(slot * 0.36, 20));
    const cV  = st.committed[i] || 0;
    const dV  = st.completed[i] || 0;
    const cY  = yS(cV), dY = yS(dV);
    const cH  = pT + iH - cY, dH = pT + iH - dY;
    bars += `<rect class="v-bar v-bar-plan" x="${(cx - bw - 1).toFixed(1)}" y="${cY.toFixed(1)}"
               width="${bw.toFixed(1)}" height="${cH.toFixed(1)}">
               <title>${esc(s.name)} — planned: ${fmt(cV)}</title></rect>
             <rect class="v-bar" x="${(cx + 1).toFixed(1)}" y="${dY.toFixed(1)}"
               width="${bw.toFixed(1)}" height="${dH.toFixed(1)}" style="fill:${color}">
               <title>${esc(s.name)} — completed: ${fmt(dV)}</title></rect>`;
    tPts.push(`${cx.toFixed(1)},${yS(trend[i]).toFixed(1)}`);
    const lbl = s.name.length > 9 ? s.name.slice(0, 8) + '…' : s.name;
    xLbls += `<text class="v-axis" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(lbl)}</text>`;
  });

  const tLine = tPts.length
    ? `<polyline class="v-trend" points="${tPts.join(' ')}"
         fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
       ${tPts.map(p => { const [x, y] = p.split(','); return `<circle class="v-trend-dot" cx="${x}" cy="${y}" r="3" fill="#fbbf24"/>`; }).join('')}`
    : '';

  el.innerHTML =
    `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${yLines}${bars}${tLine}${xLbls}
    </svg>`;
}

function renderTable(series, project, metric) {
  const pk   = metric === 'count' ? 'planN' : 'plan';
  const ck   = metric === 'count' ? 'compN' : 'comp';
  const unit = metric === 'count' ? '' : ' pts';
  const tbody = document.getElementById('sprint-tbody');

  if (!series.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No sprints yet — upload a CSV or add a sprint manually.</td></tr>';
    return;
  }

  tbody.innerHTML = series.map((s, i) => {
    const c    = s[pk][project] || 0;
    const d    = s[ck][project] || 0;
    const pct  = c > 0 ? Math.round((d / c) * 100) : null;
    const tone = pct !== null ? pctTone(pct) : '';
    const prev = i > 0 ? (series[i - 1][ck][project] || 0) : null;
    const tr   = prev === null ? ''
      : d > prev ? '<span class="trend-up">↑</span>'
      : d < prev ? '<span class="trend-dn">↓</span>'
      : '<span class="trend-eq">=</span>';
    const isM  = !!S.manual[s.name];
    const date = s.start && s.end ? `${s.start} – ${s.end}` : s.start || '';
    return `<tr>
      <td><span class="sprint-name">${esc(s.name)}</span>${isM ? '<span class="manual-badge">manual</span>' : ''}</td>
      <td class="r">${date ? `<span class="date-str">${esc(date)}</span>` : '<span class="trend-eq">—</span>'}</td>
      <td class="r num">${c ? fmt(c) + unit : '—'}</td>
      <td class="r num">${d ? fmt(d) + unit : '—'}</td>
      <td class="r num pct-${tone}">${pct !== null ? pct + '%' : '—'}</td>
      <td class="r">${tr}</td>
      <td class="r">
        ${isM
          ? `<button class="act-btn" onclick="openModal('${esc(s.name)}')">Edit</button>
             <button class="act-btn danger" onclick="confirmDel('${esc(s.name)}')">Del</button>`
          : ''}
      </td>
    </tr>`;
  }).join('');
}

function syncActiveStates() {
  document.querySelectorAll('.proj-pill').forEach(el =>
    el.classList.toggle('active', el.dataset.project === S.view.project)
  );
  document.querySelectorAll('.metric-opt').forEach(el =>
    el.classList.toggle('active', el.dataset.metric === S.view.metric)
  );
}

// ─── View setters ─────────────────────────────────────────────────────────────

function setProject(p) {
  S.view.project = p;
  const series = buildSeries();
  renderKPIs(series, p, S.view.metric);
  renderSparkgrid(series, S.view.metric);
  renderChart(series, p, S.view.metric);
  renderTable(series, p, S.view.metric);
  syncActiveStates();
}

function setMetric(m) {
  S.view.metric = m;
  render();
}

// ─── Sprint modal ─────────────────────────────────────────────────────────────

function openModal(sprintName) {
  const modal = document.getElementById('sprint-modal');
  document.getElementById('sprint-form').reset();
  document.getElementById('sprint-name-input').dataset.original = '';

  if (sprintName) {
    document.getElementById('modal-title').textContent = 'Edit Sprint';
    const m = S.manual[sprintName];
    if (m) {
      document.getElementById('sprint-name-input').value = m.name;
      document.getElementById('sprint-start').value      = m.start || '';
      document.getElementById('sprint-end').value        = m.end   || '';
      PROJECTS.forEach(p => {
        const pi = document.getElementById(`plan-${p}`);
        const ci = document.getElementById(`comp-${p}`);
        if (pi) pi.value = m.plan?.[p] ?? '';
        if (ci) ci.value = m.comp?.[p] ?? '';
      });
      document.getElementById('sprint-name-input').dataset.original = sprintName;
    }
  } else {
    document.getElementById('modal-title').textContent = 'Add Sprint';
  }

  modal.classList.remove('hidden');
  document.getElementById('sprint-name-input').focus();
}

function closeModal() {
  document.getElementById('sprint-modal').classList.add('hidden');
}

function handleSprintSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('sprint-name-input').value.trim();
  if (!name) { showToast('Sprint name is required.', 'error'); return; }

  const original = document.getElementById('sprint-name-input').dataset.original;
  if (original && original !== name) delete S.manual[original];

  const plan = {}, comp = {};
  PROJECTS.forEach(p => {
    plan[p] = parseFloat(document.getElementById(`plan-${p}`)?.value) || 0;
    comp[p] = parseFloat(document.getElementById(`comp-${p}`)?.value) || 0;
  });

  saveManualSprint({
    name,
    start: document.getElementById('sprint-start').value,
    end:   document.getElementById('sprint-end').value,
    plan,
    comp,
  });
  closeModal();
  showToast(`Sprint "${name}" saved.`, 'success');
}

function confirmDel(name) {
  if (confirm(`Delete manual sprint "${name}"? This cannot be undone.`)) {
    deleteManualSprint(name);
    showToast(`Sprint "${name}" deleted.`, 'info');
  }
}

// ─── File handlers ────────────────────────────────────────────────────────────

function readCSV(file) {
  if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
    showToast('Please use a .csv file.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => loadCSV(ev.target.result, file.name);
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('Clear ALL data — tickets and manual sprints? This cannot be undone.')) return;
  S.tickets = [];
  S.manual  = {};
  saveState();
  render();
  showToast('All data cleared.', 'info');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const zone       = document.getElementById('upload-zone');
  const csvInput   = document.getElementById('csv-input');
  const importInput = document.getElementById('import-input');

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('dragging'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragging');
    const f = e.dataTransfer.files[0];
    if (f) readCSV(f);
  });
  zone.addEventListener('click', () => csvInput.click());

  csvInput.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) readCSV(f);
    csvInput.value = '';
  });

  importInput.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => importJSON(ev.target.result);
    r.readAsText(f);
    importInput.value = '';
  });

  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    if (e.target.closest('#upload-zone')) return;
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && /\.(csv|tsv)$/i.test(f.name)) readCSV(f);
  });

  document.getElementById('sprint-form').addEventListener('submit', handleSprintSubmit);

  render();
});
