// ============================================================
// TABS
// ============================================================
function switchTab(btn, group) {
  const container=btn.closest('.tabs').parentElement;
  const idx=Array.from(btn.closest('.tabs').children).indexOf(btn);
  btn.closest('.tabs').querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  container.querySelectorAll(':scope > .tab-panel').forEach((p,i)=>{
    p.classList.toggle('active',i===idx);
  });
  // Re-render dynamic config sections when switching tabs
  if(group==='cfg') renderConfigUI();
}
function switchStab(btn, container) {
  const idx=Array.from(btn.closest('.stabs').children).indexOf(btn);
  btn.closest('.stabs').querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const panels=[...container.querySelectorAll(':scope > .stab-panel')];
  panels.forEach((p,i)=>p.classList.toggle('active',i===idx));
}
function switchRtab(btn) {
  const rtabs=btn.closest('.r-tabs');
  const idx=Array.from(rtabs.children).indexOf(btn);
  rtabs.querySelectorAll('.r-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const cont=rtabs.parentElement;
  cont.querySelectorAll(':scope > .r-panel').forEach((p,i)=>p.classList.toggle('active',i===idx));
}
function switchPtab(btn, panelPrefix) {
  btn.closest('.ptabs').querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const proj=btn.dataset.proj;
  const cont=btn.closest('.rpt-body')||btn.closest('#eos-output');
  cont.querySelectorAll('[data-ptab-panel]').forEach(p=>p.style.display=p.dataset.ptabPanel===proj?'block':'none');
}
function switchRstab(btn) {
  const stabs=btn.closest('.r-subtabs');
  const idx=Array.from(stabs.children).indexOf(btn);
  stabs.querySelectorAll('.r-subtab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const cont=stabs.parentElement;
  cont.querySelectorAll(':scope > .r-sub-panel').forEach((p,i)=>p.classList.toggle('active',i===idx));
}

function switchEosProject(btn) {
  const bar = btn.closest('.eos-bar');
  const frame = bar.closest('.rpt-body-inner');
  const proj = btn.dataset.eosProj;
  const color = btn.dataset.eosColor || 'a1';
  bar.querySelector('.eos-seg').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const badge = bar.querySelector('.eos-badge');
  badge.textContent = proj;
  badge.dataset.color = color;
  frame.querySelectorAll('.eos-proj-group').forEach(g => g.classList.toggle('active', g.dataset.eosProjPanel === proj));
}
function switchEosView(btn) {
  const bar = btn.closest('.eos-bar');
  const frame = bar.closest('.rpt-body-inner');
  const idx = Array.from(bar.querySelector('.eos-views').children).indexOf(btn);
  bar.querySelector('.eos-views').querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (idx === 1) refreshEOSConfluenceTexts();
  frame.querySelectorAll('.eos-proj-group').forEach(g => {
    g.querySelectorAll(':scope > .eos-view-panel').forEach((p, i) => p.classList.toggle('active', i === idx));
  });
}

