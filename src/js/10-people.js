// ============================================================
// PEOPLE UI
// ============================================================
function renderPeopleUI(){
  renderExcludedList();
  refreshAssigneePicker();
}
function renderExcludedList(){
  const el=document.getElementById('excluded-list');
  if(!S.cfg.excluded_assignees.length){ el.innerHTML='<div class="nstr">No excluded people configured.</div>'; return; }
  el.innerHTML=S.cfg.excluded_assignees.map(a=>`
    <div class="row" style="margin-bottom:5px">
      <span style="font-family:var(--mono);font-size:var(--fs-sm);flex:1">${esc(a)}</span>
      <button class="btn btn-red btn-xs" onclick="removeExcluded('${esc(a)}')">Remove</button>
    </div>`).join('');
}
function addExcludedManual(){
  const input=document.getElementById('excl-manual-in');
  const val=input.value.trim().toLowerCase();
  if(!val||S.cfg.excluded_assignees.includes(val)) { input.value=''; return; }
  S.cfg.excluded_assignees.push(val);
  input.value='';
  renderPeopleUI();
}
function removeExcluded(name){
  S.cfg.excluded_assignees=S.cfg.excluded_assignees.filter(a=>a!==name);
  refreshAssigneePicker();
  renderExcludedList();
}
function refreshAssigneePicker(){
  const all=new Set();
  if(S.files.issues) S.files.issues.forEach(r=>{ const a=(r['Assignee']||'').trim(); if(a) all.add(a); });
  if(S.files.start) S.files.start.forEach(r=>{ const a=(r['Assignee']||'').trim(); if(a) all.add(a); });
  const el=document.getElementById('assignee-list');
  const cnt=document.getElementById('assignee-csv-count');
  if(!el) return;
  cnt.textContent=`${all.size} found`;
  if(!all.size){ el.innerHTML='<div class="nstr">Load CSV files to detect assignees.</div>'; return; }
  el.innerHTML=[...all].sort().map(a=>{
    const excl=S.cfg.excluded_assignees.includes(a.toLowerCase());
    return `<div class="assignee-chip${excl?' selected':''}" onclick="toggleAssignee('${esc(a)}',this)">${excl?'✕ ':''}${esc(a)}</div>`;
  }).join('');
}
function toggleAssignee(name,chip){
  const lower=name.toLowerCase();
  if(S.cfg.excluded_assignees.includes(lower)){
    S.cfg.excluded_assignees=S.cfg.excluded_assignees.filter(a=>a!==lower);
    chip.classList.remove('selected');
    chip.textContent=name;
  } else {
    S.cfg.excluded_assignees.push(lower);
    chip.classList.add('selected');
    chip.textContent='✕ '+name;
  }
  renderExcludedList();
}

