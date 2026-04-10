/* ============================================================================
 * Sprint Velocity Report — drop-in for ReportSuite v8_36
 * ----------------------------------------------------------------------------
 * Self-registers as a new wizard once the Suite's inline script has parsed.
 * Reuses computeSprintTotals() from the Suite so velocity totals always
 * reconcile with the Sprint Plan/Report numbers.
 *
 * Visual style is intentionally distinct from other Suite reports:
 *   - Teal/magenta accent palette scoped under .velocity-report
 *   - KPI cards with colored side rails
 *   - Per-project sparkline grid (small-multiples)
 *   - Detail chart with rolling 3-sprint trend overlay
 *   - Suite-standard .rt table for sprint history
 *
 * Hooks the Suite touches: WIZARDS, S, computeSprintTotals, sprintMatches, esc
 * ========================================================================== */
(function () {
  'use strict';

  // ─── Init ────────────────────────────────────────────────────────────────
  function init() {
    if (typeof WIZARDS === 'undefined' ||
        typeof S === 'undefined' ||
        typeof startWizard !== 'function' ||
        typeof computeSprintTotals !== 'function' ||
        typeof esc !== 'function') {
      setTimeout(init, 50);
      return;
    }
    injectStyles();
    // Expose globally so the Suite's runners dict picks it up by bare name.
    window.runVelocity = runVelocity;
    if (S.reportHtml && !('velocity' in S.reportHtml)) S.reportHtml.velocity = '';
    ensureHomeCard();
    console.log('[velocity-report] integrated with ReportSuite');
  }

  // Inject the Sprint Velocity card into the Tools section of the home
  // grid. Only runs if this file loaded successfully — i.e. the card
  // appears in the UI exactly when velocity-report.js is sitting next to
  // ReportSuite_v8_36.html. If the file is missing (404), this function
  // never runs and the card never appears, leaving the Suite unchanged.
  function ensureHomeCard() {
    // Idempotent: don't double-insert if re-run
    if (document.querySelector('.report-card.velocity')) return;
    // The home grid hasn't always finished parsing when this runs — retry
    // briefly if the anchor isn't there yet. The Dependencies card lives
    // in the Tools grid and is our anchor point.
    var depsCard = document.querySelector('.report-card.deps-card');
    if (!depsCard || !depsCard.parentNode) {
      setTimeout(ensureHomeCard, 50);
      return;
    }
    var card = document.createElement('div');
    card.className = 'report-card velocity';
    card.setAttribute('onclick', "startWizard('velocity')");
    card.innerHTML = [
      '<div class="rc-header">',
        '<div class="rc-icon"><span class="mi" style="font-size:28px">analytics</span></div>',
      '</div>',
      '<div class="rc-name">Sprint Velocity</div>',
      '<div class="rc-desc">Per-project velocity trend across the sprint calendar. Reuses Sprint Plan/Report math.</div>',
      '<div class="rc-steps">',
        '<span class="rc-step-pip">Live View</span>',
      '</div>'
    ].join('');
    // Append after the Dependencies card inside the Tools grid.
    depsCard.parentNode.insertBefore(card, depsCard.nextSibling);
  }

  // ─── View state (persisted across re-renders) ────────────────────────────
  if (!window.__velocityView) {
    window.__velocityView = { project: 'Total', metric: 'points' };
  }
  var VIEW = window.__velocityView;

  // ─── Constants ───────────────────────────────────────────────────────────
  var PROJS = ['DX', 'LX', 'RC', 'AFX'];
  var TABS = ['Total', 'DX', 'LX', 'RC', 'AFX'];
  var PROJ_LABEL = {
    DX: 'DX',
    LX: 'LX',
    RC: 'RC',
    AFX: 'AFX',
    Total: 'All Projects'
  };
  var PROJ_COLOR = {
    DX:    '#34d4c5',  // teal
    LX:    '#e879c8',  // magenta
    RC:    '#fbbf24',  // amber
    AFX:   '#a78bfa',  // lavender
    Total: '#6ba8ff'   // suite blue (continuity with the rest of the suite)
  };

  // ─── Compute ─────────────────────────────────────────────────────────────
  function computeSeries() {
    var cal = (S.cfg && S.cfg.sprint_calendar) || [];
    return cal.map(function (s) {
      var t = computeSprintTotals(s);
      return {
        sprint:    s.sprint,
        start:     s.start,
        end:       s.end,
        planPts:   t.planPts,
        compPts:   t.compPts,
        planCount: t.planCount,
        compCount: t.compCount
      };
    });
  }

  function statsFor(series, project, metric) {
    var planKey = metric === 'count' ? 'planCount' : 'planPts';
    var compKey = metric === 'count' ? 'compCount' : 'compPts';
    var committed = series.map(function (s) { return Number(s[planKey][project]) || 0; });
    var completed = series.map(function (s) { return Number(s[compKey][project]) || 0; });
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    var avg = function (a) { return a.length ? sum(a) / a.length : 0; };
    var totC = sum(committed);
    var totD = sum(completed);
    return {
      committed:      committed,
      completed:      completed,
      avg:            avg(completed),
      recent:         avg(completed.slice(-3)),
      max:            Math.max.apply(null, [1].concat(committed, completed)),
      completionRate: totC > 0 ? (totD / totC) * 100 : 0,
      sprintCount:    series.length,
      totCommitted:   totC,
      totCompleted:   totD
    };
  }

  function rollingAvg(arr, win) {
    return arr.map(function (_, i) {
      var slice = arr.slice(Math.max(0, i - win + 1), i + 1);
      return slice.reduce(function (x, y) { return x + y; }, 0) / slice.length;
    });
  }

  function round(n, d) {
    if (d == null) d = 1;
    var f = Math.pow(10, d);
    return Math.round(n * f) / f;
  }

  function fmtNum(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '0';
    return n === Math.floor(n) ? String(n) : n.toFixed(1);
  }

  function completionTone(pct) {
    if (pct >= 90) return 'good';
    if (pct >= 70) return 'warn';
    if (pct > 0)   return 'bad';
    return 'amber';
  }

  // ─── Runner ──────────────────────────────────────────────────────────────
  function runVelocity() {
    var out = document.getElementById('velocity-output');
    if (!out) { console.warn('[velocity] #velocity-output not in DOM'); return; }
    if (!S.allTickets || !S.allTickets.length) {
      out.innerHTML = '<div class="card lr"><div class="card-title" style="color:var(--a5)">No Data</div><div>Load the Issues CSV first. Go back to Upload.</div></div>';
      return;
    }
    var cal = (S.cfg && S.cfg.sprint_calendar) || [];
    if (!cal.length) {
      out.innerHTML = '<div class="card lr"><div class="card-title" style="color:var(--a5)">No Sprint Calendar</div><div>Add at least one sprint in Settings &rarr; Sprint Calendar.</div></div>';
      return;
    }
    var series = computeSeries();
    out.innerHTML = renderReport(series);
    wireEvents(out);
    if (S.reportHtml) S.reportHtml.velocity = out.innerHTML;
  }

  // ─── Top-level render ────────────────────────────────────────────────────
  function renderReport(series) {
    var totalStats = statsFor(series, 'Total', VIEW.metric);
    var sprintsLbl = series.length + ' sprint' + (series.length === 1 ? '' : 's');
    return ''
      + '<div class="velocity-report" data-metric="' + VIEW.metric + '">'
      +   '<div class="vel-header">'
      +     '<div class="vel-header-left">'
      +       '<div class="vel-title">Sprint Velocity</div>'
      +       '<div class="vel-subtitle">Per-project trend across the sprint calendar &middot; ' + sprintsLbl + '</div>'
      +     '</div>'
      +     '<div class="vel-header-right">'
      +       '<div class="vel-toggle" role="tablist" aria-label="Metric">'
      +         '<button type="button" class="vel-toggle-btn ' + (VIEW.metric === 'points' ? 'active' : '') + '" data-metric="points">Story Points</button>'
      +         '<button type="button" class="vel-toggle-btn ' + (VIEW.metric === 'count'  ? 'active' : '') + '" data-metric="count">Story Count</button>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   kpiRow(totalStats)
      +   smallMultiples(series)
      +   '<div class="vel-section-label">Project Detail</div>'
      +   projectTabs()
      +   detailChart(series)
      +   historyTable(series)
      + '</div>';
  }

  // ─── KPI cards ───────────────────────────────────────────────────────────
  function kpiRow(stats) {
    var unit = VIEW.metric === 'count' ? 'stories' : 'pts';
    return ''
      + '<div class="vel-kpi-row">'
      +   kpiCard('Average Velocity', fmtNum(round(stats.avg, 1)),                      'across all sprints',     unit, 'primary')
      +   kpiCard('Last 3 Sprints',   fmtNum(round(stats.recent, 1)),                   'recent rolling average', unit, 'magenta')
      +   kpiCard('Completion Rate',  fmtNum(round(stats.completionRate, 0)) + '%',     'completed / planned',    '',   completionTone(stats.completionRate))
      +   kpiCard('Sprints Tracked',  String(stats.sprintCount),                        'in calendar',            '',   'amber')
      + '</div>';
  }

  function kpiCard(label, value, sub, unit, tone) {
    var unitHtml = unit ? ' <span class="vel-kpi-unit">' + unit + '</span>' : '';
    return ''
      + '<div class="vel-kpi vel-tone-' + tone + '">'
      +   '<div class="vel-kpi-label">' + esc(label) + '</div>'
      +   '<div class="vel-kpi-value">' + value + unitHtml + '</div>'
      +   '<div class="vel-kpi-sub">' + esc(sub) + '</div>'
      + '</div>';
  }

  // ─── Small-multiples (sparkline grid) ────────────────────────────────────
  function smallMultiples(series) {
    return ''
      + '<div class="vel-section-label">Per-Project Velocity</div>'
      + '<div class="vel-multiples">'
      +   PROJS.map(function (p) { return spark(series, p); }).join('')
      + '</div>';
  }

  function spark(series, project) {
    var stats = statsFor(series, project, VIEW.metric);
    var w = 220, h = 60, pad = 4;
    var innerW = w - pad * 2;
    var innerH = h - pad * 2;
    var data = stats.completed;
    var max  = Math.max.apply(null, [1].concat(data));
    var step = data.length > 1 ? innerW / (data.length - 1) : 0;
    var pts = data.map(function (v, i) {
      var x = pad + i * step;
      var y = pad + innerH - (v / max) * innerH;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var lastX = pad + (data.length - 1) * step;
    var lastY = pad + innerH - ((data[data.length - 1] || 0) / max) * innerH;
    var color = PROJ_COLOR[project];
    return ''
      + '<button type="button" class="vel-spark" data-project="' + project + '">'
      +   '<div class="vel-spark-head">'
      +     '<span class="vel-spark-name">' + project + '</span>'
      +     '<span class="vel-spark-avg">' + fmtNum(round(stats.recent, 1)) + '</span>'
      +   '</div>'
      +   '<svg class="vel-spark-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">'
      +     '<polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + pts + '"/>'
      +     '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3" fill="' + color + '"/>'
      +   '</svg>'
      +   '<div class="vel-spark-foot">avg ' + fmtNum(round(stats.avg, 1)) + ' &middot; ' + stats.sprintCount + ' sprints</div>'
      + '</button>';
  }

  // ─── Project tabs ────────────────────────────────────────────────────────
  function projectTabs() {
    return '<div class="vel-tabs" role="tablist">'
      + TABS.map(function (p) {
          var active = (VIEW.project === p);
          return '<button type="button" class="vel-tab ' + (active ? 'active' : '') + '" data-project="' + p + '" role="tab">'
            + '<span class="vel-tab-dot" style="background:' + PROJ_COLOR[p] + '"></span>'
            + esc(PROJ_LABEL[p])
            + '</button>';
        }).join('')
      + '</div>';
  }

  // ─── Detail chart (SVG) ──────────────────────────────────────────────────
  function detailChart(series) {
    var project = VIEW.project;
    var stats = statsFor(series, project, VIEW.metric);
    var trend = rollingAvg(stats.completed, 3);
    var W = 760, H = 280, padL = 36, padR = 12, padT = 16, padB = 36;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var n = series.length;
    var slot = n > 0 ? innerW / n : 0;
    var max = Math.max(stats.max, Math.max.apply(null, [1].concat(trend)));
    function yScale(v) { return padT + innerH - (v / max) * innerH; }
    var color = PROJ_COLOR[project];

    // Y grid + labels
    var yLabels = '';
    for (var i = 0; i <= 4; i++) {
      var v = Math.round(max * i / 4);
      var y = yScale(v).toFixed(1);
      yLabels += '<line class="vel-grid" x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '"/>'
              +  '<text class="vel-axis-y" x="' + (padL - 6) + '" y="' + (Number(y) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>';
    }

    // Bars + trend points
    var bars = '';
    var trendPts = [];
    var xLabels = '';
    series.forEach(function (s, i) {
      var cx = padL + slot * i + slot / 2;
      var groupW = Math.min(slot * 0.7, 36);
      var barW = Math.max(8, groupW / 2 - 1);
      var x1 = cx - groupW / 2;
      var x2 = cx + 1;
      var cVal = stats.committed[i];
      var dVal = stats.completed[i];
      var cY = yScale(cVal);
      var dY = yScale(dVal);
      var cH = (padT + innerH - cY);
      var dH = (padT + innerH - dY);
      bars += '<rect class="vel-bar vel-bar-committed" x="' + x1.toFixed(1) + '" y="' + cY.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + cH.toFixed(1) + '">'
            +   '<title>' + esc(s.sprint) + ' \u2014 planned: ' + fmtNum(cVal) + '</title>'
            + '</rect>'
            + '<rect class="vel-bar vel-bar-completed" x="' + x2.toFixed(1) + '" y="' + dY.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + dH.toFixed(1) + '" style="fill:' + color + '">'
            +   '<title>' + esc(s.sprint) + ' \u2014 completed: ' + fmtNum(dVal) + '</title>'
            + '</rect>';
      trendPts.push(cx.toFixed(1) + ',' + yScale(trend[i]).toFixed(1));
      var raw = s.sprint || '';
      var lbl = raw.length > 10 ? raw.slice(0, 9) + '\u2026' : raw;
      xLabels += '<text class="vel-axis-x" x="' + cx.toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle">' + esc(lbl) + '</text>';
    });

    var trendSvg = '';
    if (trendPts.length) {
      trendSvg = '<polyline class="vel-trend" points="' + trendPts.join(' ') + '" fill="none" stroke="#e879c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      trendPts.forEach(function (p) {
        var xy = p.split(',');
        trendSvg += '<circle class="vel-trend-dot" cx="' + xy[0] + '" cy="' + xy[1] + '" r="3" fill="#e879c8"/>';
      });
    }

    return ''
      + '<div class="vel-chart-wrap">'
      +   '<div class="vel-chart-head">'
      +     '<div class="vel-chart-title"><span class="vel-chart-dot" style="background:' + color + '"></span>' + esc(PROJ_LABEL[project]) + '</div>'
      +     '<div class="vel-chart-legend">'
      +       '<span class="vel-leg-item"><span class="vel-leg-swatch vel-leg-committed"></span>Planned</span>'
      +       '<span class="vel-leg-item"><span class="vel-leg-swatch" style="background:' + color + '"></span>Completed</span>'
      +       '<span class="vel-leg-item"><span class="vel-leg-swatch vel-leg-line"></span>3-sprint avg</span>'
      +     '</div>'
      +   '</div>'
      +   '<svg class="vel-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">'
      +     yLabels
      +     bars
      +     trendSvg
      +     xLabels
      +   '</svg>'
      + '</div>';
  }

  // ─── History table ───────────────────────────────────────────────────────
  function historyTable(series) {
    var isPts = VIEW.metric !== 'count';
    var planKey = isPts ? 'planPts' : 'planCount';
    var compKey = isPts ? 'compPts' : 'compCount';
    var unit = isPts ? ' pts' : '';
    var project = VIEW.project;
    var rows = series.map(function (s) {
      var c = Number(s[planKey][project]) || 0;
      var d = Number(s[compKey][project]) || 0;
      var pct = c > 0 ? Math.round((d / c) * 100) : 0;
      var tone = completionTone(pct);
      return '<tr>'
        + '<td>' + esc(s.sprint) + '</td>'
        + '<td class="vel-dates">' + esc(s.start) + ' &mdash; ' + esc(s.end) + '</td>'
        + '<td class="num">' + fmtNum(c) + (c ? unit : '') + '</td>'
        + '<td class="num">' + fmtNum(d) + (d ? unit : '') + '</td>'
        + '<td class="num vel-pct vel-tone-' + tone + '">' + (c > 0 ? pct + '%' : '\u2014') + '</td>'
        + '</tr>';
    }).join('');
    return ''
      + '<div class="vel-section-label">Sprint History &mdash; ' + esc(PROJ_LABEL[project]) + '</div>'
      + '<div class="vel-table-wrap">'
      +   '<table class="rt vel-table">'
      +     '<thead><tr><th>Sprint</th><th>Dates</th><th class="num">Planned</th><th class="num">Completed</th><th class="num">%</th></tr></thead>'
      +     '<tbody>' + rows + '</tbody>'
      +   '</table>'
      + '</div>';
  }

  // ─── Events ──────────────────────────────────────────────────────────────
  function wireEvents(root) {
    root.querySelectorAll('.vel-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = btn.getAttribute('data-metric');
        if (m && m !== VIEW.metric) { VIEW.metric = m; runVelocity(); }
      });
    });
    root.querySelectorAll('.vel-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = btn.getAttribute('data-project');
        if (p && p !== VIEW.project) { VIEW.project = p; runVelocity(); }
      });
    });
    root.querySelectorAll('.vel-spark').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = btn.getAttribute('data-project');
        if (p && p !== VIEW.project) { VIEW.project = p; runVelocity(); }
      });
    });
  }

  // ─── Scoped styles ───────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('velocity-report-styles')) return;
    var css = [
      '.velocity-report {',
      '  --vel-primary:   #34d4c5;',
      '  --vel-trend:     #e879c8;',
      '  --vel-amber:     #fbbf24;',
      '  --vel-lavender:  #a78bfa;',
      '  --vel-blue:      #6ba8ff;',
      '  --vel-committed: rgba(140, 157, 189, 0.28);',
      '  --vel-bg-glow:   rgba(52, 212, 197, 0.07);',
      '  font-family: var(--sans);',
      '  color: var(--tx);',
      '  background: radial-gradient(ellipse at top left, var(--vel-bg-glow), transparent 60%), var(--s1);',
      '  border: 1px solid var(--bd);',
      '  border-radius: var(--r);',
      '  padding: 22px 24px 28px;',
      '}',

      /* Header */
      '.vel-header {',
      '  display: flex; justify-content: space-between; align-items: flex-start;',
      '  gap: 16px; flex-wrap: wrap;',
      '  padding-bottom: 18px; border-bottom: 1px solid var(--bd);',
      '  margin-bottom: 20px;',
      '}',
      '.vel-title {',
      '  font-size: 22px; font-weight: 700; letter-spacing: -0.01em;',
      '  background: linear-gradient(90deg, var(--vel-primary), var(--vel-trend));',
      '  -webkit-background-clip: text; background-clip: text;',
      '  -webkit-text-fill-color: transparent; color: transparent;',
      '}',
      '.vel-subtitle { margin-top: 4px; color: var(--mu); font-size: var(--fs-sm); }',

      /* Metric toggle */
      '.vel-header-right { display: flex; align-items: center; gap: 10px; }',
      '.vel-toggle {',
      '  display: inline-flex; background: var(--s3); border: 1px solid var(--bd);',
      '  border-radius: 999px; padding: 3px;',
      '}',
      '.vel-toggle-btn {',
      '  background: transparent; border: none; padding: 6px 14px;',
      '  color: var(--mu); font-family: var(--sans); font-size: var(--fs-xs);',
      '  font-weight: 600; border-radius: 999px; cursor: pointer; transition: all 0.15s;',
      '}',
      '.vel-toggle-btn:hover { color: var(--tx); }',
      '.vel-toggle-btn.active { background: var(--vel-primary); color: #06231f; }',

      /* KPI cards */
      '.vel-kpi-row {',
      '  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));',
      '  gap: 12px; margin-bottom: 24px;',
      '}',
      '.vel-kpi {',
      '  position: relative; background: var(--s2); border: 1px solid var(--bd);',
      '  border-radius: var(--r); padding: 14px 16px 14px 19px; overflow: hidden;',
      '}',
      '.vel-kpi::before {',
      '  content: ""; position: absolute; inset: 0 auto 0 0; width: 3px;',
      '  background: var(--vel-primary);',
      '}',
      '.vel-tone-magenta::before { background: var(--vel-trend); }',
      '.vel-tone-amber::before   { background: var(--vel-amber); }',
      '.vel-tone-good::before    { background: var(--a3); }',
      '.vel-tone-warn::before    { background: var(--a4); }',
      '.vel-tone-bad::before     { background: var(--a5); }',
      '.vel-kpi-label {',
      '  font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em;',
      '  color: var(--mu); margin-bottom: 6px;',
      '}',
      '.vel-kpi-value {',
      '  font-family: var(--mono); font-size: 28px; font-weight: 700;',
      '  color: var(--tx); line-height: 1.1;',
      '}',
      '.vel-kpi-unit { font-size: 13px; font-weight: 500; color: var(--mu); margin-left: 2px; }',
      '.vel-kpi-sub { font-size: var(--fs-xs); color: var(--mu); margin-top: 4px; }',

      /* Section labels */
      '.vel-section-label {',
      '  font-size: var(--fs-xs); font-weight: 600; text-transform: uppercase;',
      '  letter-spacing: 0.08em; color: var(--mu); margin: 6px 0 10px;',
      '}',

      /* Small-multiples */
      '.vel-multiples {',
      '  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));',
      '  gap: 10px; margin-bottom: 24px;',
      '}',
      '.vel-spark {',
      '  background: var(--s2); border: 1px solid var(--bd); border-radius: var(--r);',
      '  padding: 12px 14px; cursor: pointer; text-align: left;',
      '  font-family: var(--sans); color: var(--tx); transition: all 0.15s;',
      '}',
      '.vel-spark:hover {',
      '  border-color: var(--bd2); background: var(--s3); transform: translateY(-1px);',
      '}',
      '.vel-spark-head {',
      '  display: flex; justify-content: space-between; align-items: baseline;',
      '  margin-bottom: 6px;',
      '}',
      '.vel-spark-name { font-size: var(--fs-sm); font-weight: 600; color: var(--tx); }',
      '.vel-spark-avg { font-family: var(--mono); font-size: 18px; font-weight: 700; }',
      '.vel-spark-svg { width: 100%; height: 50px; display: block; }',
      '.vel-spark-foot {',
      '  font-size: 10px; color: var(--mu); margin-top: 4px;',
      '  text-transform: uppercase; letter-spacing: 0.04em;',
      '}',

      /* Tabs */
      '.vel-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }',
      '.vel-tab {',
      '  background: var(--s2); border: 1px solid var(--bd); color: var(--mu);',
      '  font-family: var(--sans); font-size: var(--fs-xs); font-weight: 600;',
      '  padding: 7px 14px; border-radius: 999px; cursor: pointer;',
      '  display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s;',
      '}',
      '.vel-tab:hover { color: var(--tx); border-color: var(--bd2); }',
      '.vel-tab.active { background: var(--s4); color: var(--tx); border-color: var(--bd3); }',
      '.vel-tab-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }',

      /* Detail chart */
      '.vel-chart-wrap {',
      '  background: var(--s2); border: 1px solid var(--bd); border-radius: var(--r);',
      '  padding: 16px 18px; margin-bottom: 24px;',
      '}',
      '.vel-chart-head {',
      '  display: flex; justify-content: space-between; align-items: center;',
      '  flex-wrap: wrap; gap: 12px; margin-bottom: 12px;',
      '}',
      '.vel-chart-title {',
      '  display: flex; align-items: center; gap: 8px;',
      '  font-size: var(--fs-base); font-weight: 600; color: var(--tx);',
      '}',
      '.vel-chart-dot { width: 10px; height: 10px; border-radius: 50%; }',
      '.vel-chart-legend { display: flex; gap: 14px; flex-wrap: wrap; }',
      '.vel-leg-item {',
      '  display: inline-flex; align-items: center; gap: 5px;',
      '  font-size: var(--fs-xs); color: var(--mu);',
      '}',
      '.vel-leg-swatch { width: 12px; height: 12px; border-radius: 2px; display: inline-block; }',
      '.vel-leg-committed { background: var(--vel-committed); }',
      '.vel-leg-line { background: var(--vel-trend); height: 3px; border-radius: 2px; }',
      '.vel-chart-svg { width: 100%; height: auto; max-height: 320px; display: block; }',
      '.vel-bar { transition: opacity 0.15s; }',
      '.vel-bar:hover { opacity: 0.85; }',
      '.vel-bar-committed { fill: var(--vel-committed); }',
      '.vel-grid { stroke: var(--bd); stroke-width: 1; stroke-dasharray: 2 3; }',
      '.vel-axis-y, .vel-axis-x {',
      '  font-family: var(--mono); font-size: 10px; fill: var(--mu);',
      '}',
      '.vel-trend { filter: drop-shadow(0 0 4px rgba(232, 121, 200, 0.4)); }',
      '.vel-trend-dot { filter: drop-shadow(0 0 3px rgba(232, 121, 200, 0.5)); }',

      /* History table */
      '.vel-table-wrap { overflow-x: auto; }',
      '.vel-table { width: 100%; }',
      '.vel-table .num {',
      '  font-family: var(--mono); text-align: right; white-space: nowrap;',
      '}',
      '.vel-table th.num { text-align: right; }',
      '.vel-table .vel-dates {',
      '  font-family: var(--mono); font-size: var(--fs-xs); color: var(--mu);',
      '}',
      '.vel-table .vel-pct { font-weight: 600; }',
      '.vel-table .vel-tone-good { color: var(--a3); }',
      '.vel-table .vel-tone-warn { color: var(--a4); }',
      '.vel-table .vel-tone-bad  { color: var(--a5); }',

      /* Light theme nudges — match Suite's body.light */
      'body.light .vel-toggle-btn.active { color: #06231f; }',
      'body.light .vel-bar-committed { fill: rgba(140, 157, 189, 0.40); }'
    ].join('\n');
    var styleEl = document.createElement('style');
    styleEl.id = 'velocity-report-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ─── Boot ────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
