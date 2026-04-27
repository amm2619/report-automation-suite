// ============================================================
// GUIDE
// ============================================================

// ============================================================
// REPORT DRAFT SAVE / RESTORE
// ============================================================
// ── Draft save/restore: download to disk / load from disk ──────────────────
function saveDraft(reportType) {
  const frame = document.getElementById({weekly:'rptf0',eos:'rptf1',pmr:'rptf2',sprint:'rptf3',spin:'spin-output'}[reportType]);
  if(!frame){ alert('Generate the report first, then save.'); return; }

  // Snapshot the subset of cfg that matters for re-running the report
  const cfgSnap = {
    jira_url: S.cfg.jira_url||'',
    classification: S.cfg.classification||'',
    pmr_title: S.cfg.pmr_title||'',
    eos_projects: JSON.parse(JSON.stringify(S.cfg.eos_projects||{})),
  };
  // Spin-specific: capture view, dep notes, dep closed state
  const spinSnap = reportType === 'spin' ? {
    view:      S.spin.view || 'list',
    depNotes:  JSON.parse(JSON.stringify(S.spin.depNotes  || {})),
    depClosed: JSON.parse(JSON.stringify(S.spin.depClosed || {})),
  } : null;

  const draft = {
    reportType,
    ts: new Date().toISOString(),
    issuesFile: S.fileNames?.issues||'',
    epicsFile:  S.fileNames?.epics||'',
    wizParams:  JSON.parse(JSON.stringify(S._wizParams||{})),  // dates/sprints
    cfg:        cfgSnap,
    spinState:  spinSnap,
    fields:  {},   // by element id (weekly/eos bluf fields)
    pmrBluf: {},   // by data-pmr-bluf attribute (PMR narrative boxes)
  };

  frame.querySelectorAll('[contenteditable="true"]').forEach(el=>{
    const pmrKey = el.dataset?.pmrBluf;
    if(pmrKey) draft.pmrBluf[pmrKey] = el.innerText || el.textContent || '';
    else if(el.id) draft.fields[el.id] = el.innerText || el.textContent || '';
  });

  const json = JSON.stringify(draft, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  const labels = {weekly:'Weekly',eos:'EOS',pmr:'PMR',sprint:'Sprint',spin:'Spin'};
  a.download = labels[reportType] + '_draft_' + dtg() + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  const btnId = {weekly:'draft-save-weekly',eos:'draft-save-eos',pmr:'draft-save-pmr',sprint:'draft-save-sprint',spin:'spin-save-btn'}[reportType];
  const btn = document.getElementById(btnId);
  if(btn){ const origH=btn.innerHTML; btn.innerHTML='<span class="mi" style="font-size:14px;margin-right:3px">done</span>Saved'; setTimeout(()=>btn.innerHTML=origH,1800); }
}

function restoreDraft(reportType) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try{
        const draft = JSON.parse(ev.target.result);
        if(!draft.fields && !draft.pmrBluf) throw new Error('Not a valid draft file');
        let restored = 0;
        // Restore by element id (weekly, eos)
        Object.entries(draft.fields||{}).forEach(([id,text])=>{
          const el = document.getElementById(id);
          if(el && el.isContentEditable){ el.innerText=text; restored++; }
        });
        // Restore by data-pmr-bluf attribute (PMR narratives — survives re-render)
        Object.entries(draft.pmrBluf||{}).forEach(([key,text])=>{
          const el = document.querySelector(`[data-pmr-bluf="${key}"]`);
          if(el && el.isContentEditable){ el.innerText=text; restored++; }
        });
        // Show CSV names from draft if helpful
        const btn = document.getElementById('draft-restore-'+reportType);
        const csvHint = [draft.issuesFile, draft.epicsFile].filter(Boolean).join(', ');
        const hintTxt = csvHint ? ` (${csvHint})` : '';
        if(btn){ const orig=btn.textContent; btn.textContent=`✓ ${restored} field${restored!==1?'s':''} restored${hintTxt}`; setTimeout(()=>btn.textContent=orig,3500); }
        // Restore spin-specific state
        if(draft.spinState && reportType === 'spin') {
          if(draft.spinState.depNotes)  Object.assign(S.spin.depNotes  || (S.spin.depNotes={}),  draft.spinState.depNotes);
          if(draft.spinState.depClosed) Object.assign(S.spin.depClosed || (S.spin.depClosed={}), draft.spinState.depClosed);
          if(draft.spinState.view) { S.spin.view = draft.spinState.view; spinSetView(draft.spinState.view); }
          restored++;
        }
        if(!restored){ alert('No matching fields found — make sure you generate the report first, then restore the draft.'); }
      }catch(err){ alert('Could not load draft: '+err.message); }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input); input.click(); document.body.removeChild(input);
}

function checkDraftAndRestore(reportType) {
  // Show the Restore Draft button
  const btn = document.getElementById('draft-restore-'+reportType);
  if(btn) btn.style.display='inline-flex';
  // If a draft was loaded in step 0, apply it now that the report DOM exists
  const applied = applyPendingDraft(reportType);
  if(applied && btn){
    const orig=btn.textContent;
    btn.textContent=`✓ ${applied} field${applied!==1?'s':''} restored from draft`;
    setTimeout(()=>btn.textContent=orig,3000);
  }
}


// ── Wizard step 0: load draft from file, preview CSV names ──────────────────

// loadDraftForWizard removed v8.5 — Continue Working card now reads auto-saved
// drafts from localStorage via buildWizardRecentDraft() instead of a file picker.

// Skip params step — load wizParams from draft and go straight to report
function generateFromDraft(reportType) {
  if(!S.files.issues || !S.files.issues.length) {
    alert('Load the Issues CSV first, then click Generate from Draft.');
    return;
  }
  const draft = S._pendingDraft[reportType];
  if(!draft || !draft.wizParams) { alert('No draft loaded.'); return; }

  // Restore saved params directly into S._wizParams
  S._wizParams = JSON.parse(JSON.stringify(draft.wizParams));

  // Restore spin-specific state before running
  if(reportType === 'spin' && draft.spinState) {
    if(draft.spinState.depNotes)  S.spin.depNotes  = Object.assign(S.spin.depNotes  || {}, draft.spinState.depNotes);
    if(draft.spinState.depClosed) S.spin.depClosed = Object.assign(S.spin.depClosed || {}, draft.spinState.depClosed);
    if(draft.spinState.view) S.spin.view = draft.spinState.view;
  }

  // Jump to the last step (works for both 2-step and 3-step wizards)
  const wiz = WIZARDS[reportType];
  const lastStep = wiz.steps.length - 1;
  _activeStep = lastStep;
  renderWizardSteps(wiz.steps, lastStep);
  renderWizardContent(reportType, lastStep);

  // Run the report
  const runners = {weekly:runWeekly, eos:runEOS, pmr:runPMR, sprint:runSprint, spin:runSpin};
  const runner = runners[reportType];
  if(runner) runner();
}

// Apply pending draft after report renders (called from checkDraftAndRestore)
function applyPendingDraft(reportType) {
  const draft = S._pendingDraft?.[reportType];
  if(!draft) return;
  let restored = 0;
  Object.entries(draft.fields||{}).forEach(([id,text])=>{
    const el = document.getElementById(id);
    if(el&&el.isContentEditable){ el.innerText=text; restored++; }
  });
  Object.entries(draft.pmrBluf||{}).forEach(([key,text])=>{
    const el = document.querySelector(`[data-pmr-bluf="${key}"]`);
    if(el&&el.isContentEditable){ el.innerText=text; restored++; }
  });
  if(restored) delete S._pendingDraft[reportType];
  return restored;
}

