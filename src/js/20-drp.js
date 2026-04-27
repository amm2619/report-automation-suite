// ============================================================
// DATE RANGE PICKER
// ============================================================
// ── DATE RANGE PICKER — instance-based module ─────────────────────────────────
// Usage:
//   const html = DRP.build('wk');          // renders HTML; call once per mount
//   DRP.init('wk', startISO, endISO);      // seeds values after DOM is ready
//   const {start, end} = DRP.get('wk');    // read current selection
//
// Each instance is fully self-contained: all IDs and state are namespaced by id.
// Global legacy aliases _drp / initDateRangePicker / buildDateRangePicker are kept
// so existing call-sites that haven't been migrated yet continue to work.

const DRP = (function() {
  const instances = {};

  function _fmt(iso) {
    if (!iso) return '';
    const [y,m,d] = iso.split('-');
    const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return MONS[parseInt(m)-1] + ' ' + parseInt(d) + ', ' + y;
  }

  function _calIcon() {
    return '<svg width="14" height="14" viewBox="0 0 14 14" style="flex-shrink:0;margin-right:6px;opacity:.7">' +
           '<rect x="1" y="2" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
           '<path d="M1 5.5h12" stroke="currentColor" stroke-width="1.3"/>' +
           '<path d="M4 1v3M10 1v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  }

  function build(id, opts) {
    opts = opts || {};
    const label       = opts.label       || 'Date Range';
    const startId     = opts.startId     || (id + '-start');
    const endId       = opts.endId       || (id + '-end');
    const placeholder = opts.placeholder || 'Click to select date range';

    if (!instances[id]) {
      instances[id] = { start: null, end: null, viewYear: 0, viewMonth: 0, startId, endId };
    } else {
      instances[id].startId = startId;
      instances[id].endId   = endId;
    }

    return `
<div class="drp-wrap" id="${id}-drp-wrap">
  <div class="drp-label">${label}</div>
  <div class="drp-display" id="${id}-drp-display" onclick="DRP._toggle('${id}')">
    ${_calIcon()}<span id="${id}-drp-display-text">${placeholder}</span>
    <span class="drp-chevron" id="${id}-drp-chevron">›</span>
  </div>
  <div class="drp-cal" id="${id}-drp-cal" style="display:none">
    <div class="drp-cal-header">
      <button class="drp-nav" onclick="DRP._nav('${id}',-1)">‹</button>
      <span class="drp-cal-title" id="${id}-drp-cal-title"></span>
      <button class="drp-nav" onclick="DRP._nav('${id}',1)">›</button>
    </div>
    <div class="drp-grid">
      <div class="drp-day-hdr">Su</div><div class="drp-day-hdr">Mo</div>
      <div class="drp-day-hdr">Tu</div><div class="drp-day-hdr">We</div>
      <div class="drp-day-hdr">Th</div><div class="drp-day-hdr">Fr</div>
      <div class="drp-day-hdr">Sa</div>
    </div>
    <div class="drp-days" id="${id}-drp-days"></div>
    <div class="drp-footer">
      <span id="${id}-drp-hint" class="drp-hint">Select start date</span>
      <button class="btn btn-ghost btn-xs" onclick="DRP._clear('${id}')">Clear</button>
    </div>
  </div>
</div>
<input type="hidden" id="${startId}">
<input type="hidden" id="${endId}">
`;
  }

  function init(id, startVal, endVal) {
    let st = instances[id];
    if (!st) {
      st = instances[id] = { start: null, end: null, viewYear: 0, viewMonth: 0,
                              startId: id+'-start', endId: id+'-end' };
    }
    st.start = startVal || null;
    st.end   = endVal   || null;
    const now  = new Date();
    const base = st.start ? new Date(st.start+'T00:00:00Z') : now;
    st.viewYear  = base.getFullYear();
    st.viewMonth = base.getMonth();
    const si = document.getElementById(st.startId);
    const ei = document.getElementById(st.endId);
    if (si) si.value = st.start || '';
    if (ei) ei.value = st.end   || '';
    _updateDisplay(id);
  }

  function get(id) {
    const st = instances[id] || {};
    return { start: st.start || '', end: st.end || '' };
  }

  function _toggle(id) {
    const cal = document.getElementById(id+'-drp-cal');
    const chv = document.getElementById(id+'-drp-chevron');
    if (!cal) return;
    const open = cal.style.display !== 'none';
    cal.style.display = open ? 'none' : 'block';
    if (chv) chv.style.transform = open ? '' : 'rotate(90deg)';
    if (!open) _renderMonth(id);
  }

  function _nav(id, dir) {
    const st = instances[id]; if (!st) return;
    st.viewMonth += dir;
    if (st.viewMonth > 11) { st.viewMonth = 0; st.viewYear++; }
    if (st.viewMonth < 0)  { st.viewMonth = 11; st.viewYear--; }
    _renderMonth(id);
  }

  function _renderMonth(id) {
    const st = instances[id]; if (!st) return;
    const el    = document.getElementById(id+'-drp-days');
    const title = document.getElementById(id+'-drp-cal-title');
    if (!el || !title) return;
    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    title.textContent = MONTHS[st.viewMonth] + ' ' + st.viewYear;
    const firstDay  = new Date(Date.UTC(st.viewYear, st.viewMonth, 1)).getUTCDay();
    const daysInMon = new Date(Date.UTC(st.viewYear, st.viewMonth+1, 0)).getUTCDate();
    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<div class="drp-cell drp-blank"></div>';
    for (let d = 1; d <= daysInMon; d++) {
      const iso = st.viewYear+'-'+String(st.viewMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      let cls = 'drp-cell';
      if (st.start && iso === st.start) cls += ' drp-sel-start';
      if (st.end   && iso === st.end)   cls += ' drp-sel-end';
      if (st.start && st.end && iso > st.start && iso < st.end) cls += ' drp-in-range';
      html += '<div class="'+cls+'" onclick="DRP._pick(\''+id+'\',\''+iso+'\')">'+d+'</div>';
    }
    el.innerHTML = html;
    const hint = document.getElementById(id+'-drp-hint');
    if (hint) {
      if (!st.start)    hint.textContent = 'Select start date';
      else if (!st.end) hint.textContent = 'Now select end date';
      else              hint.textContent = _fmt(st.start) + ' – ' + _fmt(st.end);
    }
  }

  function _pick(id, iso) {
    const st = instances[id]; if (!st) return;
    if (!st.start || (st.start && st.end)) {
      st.start = iso; st.end = null;
    } else {
      if (iso < st.start) { st.end = st.start; st.start = iso; }
      else                 { st.end = iso; }
      setTimeout(function() {
        const cal = document.getElementById(id+'-drp-cal');
        const chv = document.getElementById(id+'-drp-chevron');
        if (cal) cal.style.display = 'none';
        if (chv) chv.style.transform = '';
      }, 180);
    }
    const si = document.getElementById(st.startId);
    const ei = document.getElementById(st.endId);
    if (si) si.value = st.start || '';
    if (ei) ei.value = st.end   || '';
    _updateDisplay(id);
    _renderMonth(id);
  }

  function _clear(id) {
    const st = instances[id]; if (!st) return;
    st.start = null; st.end = null;
    const si = document.getElementById(st.startId);
    const ei = document.getElementById(st.endId);
    if (si) si.value = '';
    if (ei) ei.value = '';
    _updateDisplay(id);
    _renderMonth(id);
  }

  function _updateDisplay(id) {
    const st = instances[id];
    const el = document.getElementById(id+'-drp-display-text');
    if (!el) return;
    if (st && st.start && st.end)  el.textContent = _fmt(st.start) + ' – ' + _fmt(st.end);
    else if (st && st.start)       el.textContent = _fmt(st.start) + ' – select end date';
    else                           el.textContent = 'Click to select date range';
  }

  return { build, init, get, _toggle, _nav, _renderMonth, _pick, _clear };
})();

// ── Legacy shims ──────────────────────────────────────────────────────────────
// Proxy _drp so any code still reading _drp.start / _drp.end gets live values
// from the 'wk' instance. buildDateRangePicker / initDateRangePicker delegate too.
const _drp = new Proxy({}, {
  get(_, k) {
    const st = DRP.get('wk');
    if (k === 'start') return st.start || null;
    if (k === 'end')   return st.end   || null;
    return undefined;
  }
});
function buildDateRangePicker() { return DRP.build('wk', { startId:'w-start', endId:'w-end' }); }
function initDateRangePicker(s, e) { DRP.init('wk', s, e); }
function drpFmt(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  const MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return MONS[parseInt(m)-1]+' '+parseInt(d)+', '+y;
}



function buildStandaloneHtml(title, bodyContent){
  // Hardcoded standalone CSS — never reads document.styleSheets
  var css=":root{--bg:#070910;--s1:#0c0f18;--s2:#111520;--s3:#171c2a;--s4:#1d2336;--bd:#1f2840;--bd2:#2b3652;--a1:#5b9cf6;--a1d:rgba(91,156,246,.09);--a1b:rgba(91,156,246,.2);--a2:#a07cf5;--a2d:rgba(160,124,245,.09);--a2b:rgba(160,124,245,.2);--a3:#3ecf8e;--a3d:rgba(62,207,142,.08);--a3b:rgba(62,207,142,.2);--a4:#f5a741;--a4d:rgba(245,167,65,.08);--a4b:rgba(245,167,65,.2);--a5:#f56b6b;--a5d:rgba(245,107,107,.08);--a5b:rgba(245,107,107,.2);--tx:#dde4f5;--mu:#6b7a9c;--di:#384060;--mono:'Consolas','Cascadia Code','Menlo',monospace;--sans:'Segoe UI','Inter','Arial',sans-serif;--r:8px;--r2:5px;--fs-base:13px;--fs-sm:12px;--fs-xs:11px;--fs-lg:14px;--fs-xl:16px}*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:var(--sans);background:var(--bg);color:var(--tx);font-size:var(--fs-base);line-height:1.55;padding:28px 32px 80px;min-height:100vh}a{color:var(--a1);text-decoration:none;font-weight:500}a:hover{text-decoration:underline}.badge{display:inline-block;padding:1px 7px;border-radius:20px;font-size:var(--fs-xs);font-weight:600;white-space:nowrap}.bd-done{background:var(--a3d);color:var(--a3)}.bd-blk{background:var(--a5d);color:var(--a5)}.bd-prog{background:var(--a1d);color:var(--a1)}.bd-rev{background:var(--a4d);color:var(--a4)}.bd-open{background:var(--s4);color:var(--mu)}.nstr{color:var(--di);font-style:italic;font-size:var(--fs-sm);padding:3px 0}.rpt-frame{background:var(--s1);border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin-bottom:18px;max-width:1200px;margin-left:auto;margin-right:auto}.rpt-bar{background:var(--s2);border-bottom:1px solid var(--bd);padding:9px 14px;display:flex;align-items:center;justify-content:space-between}.rbd-row{display:flex;gap:5px}.rbd{width:8px;height:8px;border-radius:50%}.rbd-r{background:#ff7b7b}.rbd-y{background:#ffb347}.rbd-g{background:#4dd89a}.rpt-bar-fn{font-family:var(--mono);font-size:var(--fs-xs);color:var(--mu)}.rpt-body{padding:22px 26px}.rpt-hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 18px;margin-bottom:20px;background:var(--s2);border:1px solid var(--bd);border-radius:8px;border-left:4px solid var(--a1)}.rpt-hdr h1{font-size:17px;font-weight:600;color:var(--tx)}.rpt-hdr .rsub{font-size:var(--fs-xs);color:var(--mu);margin-top:3px}.r-tabs{display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:18px}.r-tab{padding:8px 15px;font-size:var(--fs-sm);font-weight:500;color:var(--mu);border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;margin-bottom:-1px}.r-tab:hover{color:var(--tx)}.r-tab.active{color:var(--a1);border-bottom-color:var(--a1)}.r-panel{display:none}.r-panel.active{display:block}.r-tabs-sticky{position:sticky;top:0;z-index:10;background:var(--s2);border-bottom:1px solid var(--bd);padding:0 22px}.r-tabs-sticky .r-tab{padding:8px 14px}.r-subtabs{display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:14px}.r-subtab{padding:6px 13px;font-size:var(--fs-xs);font-weight:500;color:var(--mu);border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;margin-bottom:-1px}.r-subtab:hover{color:var(--tx)}.r-subtab.active{color:var(--a2);border-bottom-color:var(--a2)}.r-sub-panel{display:none}.r-sub-panel.active{display:block}.r-subtabs-sticky{position:sticky;top:37px;z-index:9;background:var(--s2);border-bottom:1px solid var(--bd);padding:0 22px}.r-subtabs-sticky .r-subtab{padding:6px 12px}.r-card{background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:14px 18px;margin-bottom:10px}.r-card.l1{border-left:3px solid var(--a1)}.r-card.l2{border-left:3px solid var(--a2)}.r-card.l3{border-left:3px solid var(--a3)}.r-card.lw{border-left:3px solid var(--a4)}.r-card.lr{border-left:3px solid var(--a5)}.r-card h3{font-size:var(--fs-xs);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:9px}.stats-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.stat{background:var(--s3);border:1px solid var(--bd);border-radius:5px;padding:10px 15px}.stat .sv{font-size:20px;font-weight:600;color:var(--a1)}.stat .sl{font-size:var(--fs-xs);color:var(--mu);text-transform:uppercase;letter-spacing:.4px}.tw{overflow-x:auto;border-radius:5px;border:1px solid var(--bd);margin:8px 0}.rt{width:100%;border-collapse:collapse;font-size:var(--fs-sm);background:var(--s2)}.rt thead th{background:var(--s3);color:var(--mu);padding:8px 11px;font-weight:600;font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.5px;text-align:left;border-bottom:1px solid var(--bd);white-space:nowrap}.rt tbody td{padding:7px 11px;border-bottom:1px solid var(--bd);vertical-align:top;color:var(--tx)}.rt tbody tr:last-child td{border-bottom:none}.tk-c{font-family:var(--mono);font-size:var(--fs-xs);color:var(--a1);white-space:nowrap}.bluf-label{display:block;font-size:var(--fs-xs);font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}.bluf-field{padding:4px 0;font-size:var(--fs-sm);line-height:1.6;color:var(--tx);min-height:20px}.bluf-field:empty::before{content:attr(data-placeholder);color:var(--di)}.conf-pre{background:#04060c;color:#9bbbd4;border:1px solid var(--bd);border-radius:5px;padding:12px 14px;font-family:var(--mono);font-size:var(--fs-xs);line-height:1.7;white-space:pre;overflow:auto;max-height:400px;margin-top:8px}.slide{background:var(--s2);border:1px solid var(--bd);border-left:3px solid var(--a2);border-radius:8px;padding:16px 20px;margin-bottom:14px}.slide h2{font-size:var(--fs-base);font-weight:600;color:var(--a2);margin-bottom:10px}.slide h3{font-size:var(--fs-xs);font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.4px;margin:10px 0 5px}.agenda-list{list-style:none;padding:0;display:flex;flex-direction:column;gap:3px}.agenda-list li{padding:6px 13px;border-left:2px solid var(--bd);font-size:var(--fs-sm);border-radius:0 5px 5px 0}.agenda-list li.has{border-left-color:var(--a3);color:var(--tx);background:var(--a3d)}.agenda-list li.nstr{border-left-color:var(--di);color:var(--mu);font-style:italic}.ptabs{margin-bottom:12px}.ptab{display:inline-block;padding:4px 12px;border-radius:var(--r2);font-size:var(--fs-sm);font-weight:600;cursor:pointer;border:1px solid var(--bd);background:var(--s3);color:var(--mu);margin:0 4px 4px 0}.ptab.active{background:var(--a1d);color:var(--a1);border-color:var(--a1b)}.muted{color:var(--mu)}.mono{font-family:var(--mono)}";
  var inlineJS="function switchRtab(btn){\n  var rtabs=btn.parentElement;\n  var idx=Array.from(rtabs.children).indexOf(btn);\n  rtabs.querySelectorAll('.r-tab').forEach(function(t){t.classList.remove('active');});\n  btn.classList.add('active');\n  var cont=rtabs.parentElement;\n  cont.querySelectorAll(':scope > .r-panel').forEach(function(p,i){p.classList.toggle('active',i===idx);});\n}\nfunction switchRstab(btn){\n  var stabs=btn.parentElement;\n  var idx=Array.from(stabs.children).indexOf(btn);\n  stabs.querySelectorAll('.r-subtab').forEach(function(t){t.classList.remove('active');});\n  btn.classList.add('active');\n  var cont=stabs.parentElement;\n  cont.querySelectorAll(':scope > .r-sub-panel').forEach(function(p,i){p.classList.toggle('active',i===idx);});\n}\nfunction switchPtab(btn,proj){\n  var cont=btn.closest('.ptabs').parentElement;\n  cont.querySelectorAll('.ptab').forEach(function(t){t.classList.remove('active');});\n  btn.classList.add('active');\n  cont.querySelectorAll('[data-ptab-panel]').forEach(function(p){\n    p.style.display=p.dataset.ptabPanel===proj?'block':'none';\n  });\n}\nfunction filterDbg(inp,tableId){\n  var val=inp.value.toLowerCase().trim();\n  var tbody=document.querySelector('#'+tableId+' tbody');\n  if(!tbody) return;\n  tbody.querySelectorAll('tr').forEach(function(tr){\n    tr.style.display=(!val||tr.textContent.toLowerCase().includes(val))?'':'none';\n  });\n}\ndocument.addEventListener('click',function(e){\n  var a=e.target.closest('.agenda-list a');\n  if(a){e.preventDefault();var t=document.querySelector(a.getAttribute('href'));if(t)t.scrollIntoView({behavior:'smooth'});}\n});";
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">\n'
    + '<title>ReportSuite v9.2</title>\n'
    + '<style>'+css+'</style>\n'
    + '</head>\n<body style="margin:0;padding:0">\n'
    + bodyContent
    + '\n<script>\n'+inlineJS+'\n<\/script>\n'
    + '</body></html>';
}

