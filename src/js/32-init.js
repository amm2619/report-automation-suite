// ============================================================
// REPORT FRAME CONTROLS (macOS dots)
// ============================================================
function closeReport(id){
  const el=document.getElementById(id);
  if(el) el.style.display='none';
}
function minimizeReport(id){
  const el=document.getElementById(id);
  if(!el) return;
  const body=el.querySelector('.rpt-body');
  if(!body) return;
  const minimized=el.classList.toggle('minimized');
  if(body) body.style.display=minimized?'none':'';
}
function fullscreenReport(id){
  const el=document.getElementById(id);
  if(!el) return;
  const isFs = el.classList.toggle('fullscreen');
  // Update the icon in the fullscreen button within this frame
  const fsBtn = el.querySelector('.fs-btn .mi');
  if(fsBtn) fsBtn.textContent = isFs ? 'close_fullscreen' : 'open_in_full';
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.rpt-frame.fullscreen').forEach(el=>fullscreenReport(el.id));
  }
  // Ctrl+Enter — generate / advance wizard
  if(e.ctrlKey && e.key==='Enter'){
    e.preventDefault();
    const genBtn=document.querySelector('.wiz-content .btn-primary');
    if(genBtn) genBtn.click();
  }
  // Ctrl+Shift+C — copy for Confluence (EOS or PMR)
  if(e.ctrlKey && e.shiftKey && e.key==='C'){
    e.preventDefault();
    if(typeof openEOSConfluencePicker==='function' && document.getElementById('rptf1'))
      openEOSConfluencePicker(true);
    else if(typeof copyPmrNarrative==='function' && document.getElementById('rptf2'))
      copyPmrNarrative();
  }
});

window.addEventListener('DOMContentLoaded',()=>{
  loadAppAppearance();
  loadSpinPrefs();
  const _vb=document.querySelector('.app-logo-ver'); if(_vb) _vb.textContent=APP_VERSION;
  loadSavedCfg();
  initEpicsFromStorage(); // restore epics from cache
  initSpinFromStorage();  // restore spin plan from cache
  renderRecentReports();  // show recent reports on home screen
  setTimeout(populateEOSSprints, 0);
  try{
    const savedOverrides=localStorage.getItem('jira_reportsuite_overrides_v1');
    if(savedOverrides){ const o=JSON.parse(savedOverrides); if(Array.isArray(o)&&o.length) S.overrides=o; }
  }catch(e){}
  try{
    const savedTopics=localStorage.getItem('jira_reportsuite_topics_v1');
    if(savedTopics){ const t=JSON.parse(savedTopics); if(Array.isArray(t)&&t.length) S.topics=t; }
  }catch(e){}
  // Re-apply saved overrides back into topic rules (they modify S.topics in memory)
  reapplyOverridesToTopics();
  updateStatusBar();
  // Date defaults are now set when wizard steps render (elements don't exist until then)
  const hasSaved=localStorage.getItem(LS_KEY);
  const dot=document.getElementById('cfg-dirty-dot');
  const msg=document.getElementById('cfg-save-msg');
  if(hasSaved){
    if(dot) dot.classList.remove('unsaved');
    if(msg){ msg.textContent='Loaded from saved config'; msg.style.color='var(--a3)';
      setTimeout(()=>{ if(msg&&!_cfgDirty){ msg.textContent='No changes'; msg.style.color='var(--mu)'; if(dot) dot.classList.remove('unsaved'); } },4000);
    }
  }
});



