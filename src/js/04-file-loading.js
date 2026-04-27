// ============================================================
// FILE LOADING
// ============================================================
// Promisified FileReader — eliminates counter-based async completion tracking
function readFileAsText(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read ' + file.name));
    reader.readAsText(file);
  });
}

function loadFile(type, input) {
  const files=Array.from(input.files||[]); if(!files.length) return;
  input.value=''; // reset so same file re-triggers

  if(files.length > 1 || type === 'multi') {
    Promise.all(files.map(file =>
      readFileAsText(file).then(text => {
        const firstLine = (text||'').split(/\r?\n/)[0]||'';
        const detectedType = detectCsvType(file.name, firstLine);
        processCsvLoad(detectedType||'issues', file, text);
      })
    )).then(() => rebuildTickets())
      .catch(err => console.error('File load error:', err));
    return;
  }

  const file=files[0];
  readFileAsText(file)
    .then(text => { processCsvLoad(type, file, text); rebuildTickets(); })
    .catch(err => console.error('File load error:', err));
}

function detectCsvType(filename, firstLine) {
  // Header sniffing is more reliable than filename — check it first
  if (firstLine) {
    const h = firstLine.toLowerCase();
    // Roadmap/spin: any export with a Hierarchy column (Jira Plans / Roadmap).
    // Checked first so a roadmap that also has an Assignee column doesn't get
    // misrouted to the issues bucket.
    if (h.includes('hierarchy')) return 'spin';
    // Issues: uniquely has Epic Link + Assignee
    if (h.includes('epic link') && h.includes('assignee')) return 'issues';
    // Epics: has Issue key + Project + Summary but NOT Assignee (small column set)
    if (h.includes('issue key') && h.includes('project') && !h.includes('assignee')) return 'epics';
    // Legacy epics check
    if (h.includes('epic name')) return 'epics';
  }
  // Filename fallback — last resort
  const f = filename.toLowerCase();
  if (f.includes('epic') && !f.includes('issue') && !f.includes('roadmap')) return 'epics';
  if (f.includes('issue') || f.includes('master')) return 'issues';
  if (f.includes('plan') || f.includes('roadmap') || f.includes('spin')) return 'spin';
  return null; // unknown — caller decides
}

function processCsvLoad(type, file, text) {
  const rows = parseCSV(text);
  const fname = file.name;

  // Register in file registry
  if (!S._fileRegistry) S._fileRegistry = {};

  // Check for same-type conflict: another file already loaded for this type
  const existing = Object.entries(S._fileRegistry).find(
    ([n, v]) => v.type === type && n !== fname
  );
  if (existing) {
    const [existName] = existing;
    const keep = confirm(
      'Two ' + type + ' files loaded — which do you want to use?\n\n' +
      'EXISTING: ' + existName + '\n' +
      'NEW:      ' + fname + '\n\n' +
      'OK = use new file    Cancel = keep existing'
    );
    if (!keep) return; // user chose to keep existing
    // Remove the old one from registry
    delete S._fileRegistry[existName];
  }

  S._fileRegistry[fname] = { type: type, rows: rows, file: file };
  S.files[type] = rows;
  // Persist epics and spin to localStorage so they survive page refresh
  if (type === 'epics') saveEpicsToStorage(rows, fname);
  if (type === 'spin')  saveSpinToStorage(rows, fname);
  if (!S.fileNames) S.fileNames = {};
  S.fileNames[type] = fname;

  // Update file zone UI if present
  const fz = document.getElementById('fz-' + type);
  const fl = document.getElementById('fl-' + type);
  if (fz) fz.classList.add('loaded');
  if (fl) fl.textContent = fname + ' (' + rows.length + ' rows)';

  updateStatusBar();

  if (type === 'issues') {
    refreshAssigneePicker();
    if (rows.length) {
      const cols = Object.keys(rows[0]);
      const el = document.getElementById('field-map-detected');
      if (el) {
        el.innerHTML = cols.map(col => {
          const isCustom = /custom field|customfield/i.test(col);
          return '<span style="display:inline-block;margin:2px 3px;padding:2px 8px;border-radius:3px;font-family:var(--mono);font-size:var(--fs-xs);background:' +
            (isCustom ? 'var(--a4d)' : 'var(--s4)') + ';color:' +
            (isCustom ? 'var(--a4)' : 'var(--mu)') + ';border:1px solid ' +
            (isCustom ? 'var(--a4b)' : 'var(--bd)') + '">' + esc(col) + '</span>';
        }).join('');
      }
    }
  }
}
function handleMultiCsvDrop(fileList) {
  const files = Array.from(fileList||[]).filter(f=>f.name.toLowerCase().endsWith('.csv'));
  if(!files.length) return;
  files.sort((a,b)=>(b.lastModified||0)-(a.lastModified||0));
  Promise.all(files.map(file =>
    readFileAsText(file).then(text => {
      const firstLine = (text||'').split(/\r?\n/)[0]||'';
      const type = detectCsvType(file.name, firstLine) || 'issues';
      processCsvLoad(type, file, text);
    })
  )).then(() => rebuildTickets())
    .catch(err => console.error('Multi-drop error:', err));
}

// Returns the count of open (non-closed, non-dismissed) blocked-by dependencies
// across all epic nodes in the processed spin plan.
function _countOpenDeps() {
  if (!S.spin || !S.spin.issues || !S.spin.issues.length) return 0;
  return Object.values(S.spin._nodeMap || {})
    .filter(n => spinClassifyLevel(n.issue.issueType) === 'epic')
    .reduce((sum, n) => {
      const deps = spinGatherDeps(n);
      return sum + deps.blockedBy.filter(x =>
        !spinIsDone(x.status) && !S.spin.depClosed[n.issue.key + '_' + x.key]
      ).length;
    }, 0);
}

function updateStatusBar(){
  const hasIssues=!!(S.files.issues&&S.files.issues.length);
  const hasEpics=!!(S.files.epics&&S.files.epics.length);
  const hasSpin =!!(S.files.spin &&S.files.spin.length);
  // Header chips
  const ci=document.getElementById('hchip-issues');
  const ce=document.getElementById('hchip-epics');
  const li=document.getElementById('hsl-issues');
  const le=document.getElementById('hsl-epics');
  if(ci){ci.className='hst-chip'+(hasIssues?' ok':'');if(li) li.textContent=hasIssues?`Issues — ${S.files.issues.length} rows`:'No data loaded';}
  if(ce){ce.className='hst-chip'+(hasEpics?' ok':hasIssues?' warn':'');if(le) le.textContent=hasEpics?`Epics — ${S.files.epics.length} rows`:'No epics';}
  const cs=document.getElementById('hchip-spin');
  const ls=document.getElementById('hsl-spin');
  if(cs){cs.className='hst-chip'+(hasSpin?' ok':'');if(ls) ls.textContent=hasSpin?`Roadmap — ${S.files.spin.length} rows`:'No roadmap';}
  // Deps chip — shows open dep count when spin data is processed
  const cd=document.getElementById('hchip-deps');
  const ld=document.getElementById('hsl-deps');
  if(cd){
    const hasDeps=!!(S.spin&&S.spin.issues&&S.spin.issues.length);
    const depCount=hasDeps ? _countOpenDeps() : 0;
    cd.className='hst-chip'+(hasDeps&&depCount>0?' warn':'');
    if(ld) ld.textContent=hasDeps?(depCount+' open dep'+(depCount!==1?'s':'')):'No dependencies';
  }
  // Wizard sidebar dots
  const di=document.getElementById('sd-issues');
  const de=document.getElementById('sd-epics');
  const sli=document.getElementById('sl-issues');
  const sle=document.getElementById('sl-epics');
  if(di){di.className='wsd-dot'+(hasIssues?' ok':'');if(sli) sli.textContent=hasIssues?`${S.files.issues.length} rows loaded`:'Not loaded';}
  if(de){de.className='wsd-dot'+(hasEpics?' ok':' warn');if(sle) sle.textContent=hasEpics?`${S.files.epics.length} rows loaded`:'Not loaded';}
  // Refresh wizard step 0 if currently on it (so fzone loads state + next button updates)
  if(_activeWizard && _activeStep===0) renderWizardContent(_activeWizard, 0);
}
function rebuildTickets(){
  // Build epic map from epics CSV — use resolveCol so custom field names work
  S.epicMap={};
  if(S.files.epics) {
    S.files.epics.forEach(r=>{
      // Key is always in "Issue key" column in Jira epics exports
      const key=normText(resolveCol(r,'Issue key')||resolveCol(r,'Epic Key')||resolveCol(r,'Key')||'');
      // Name: prefer Custom field (Epic Name), fall back to Epic Name, then Summary
      const name=normText(
        r['Custom field (Epic Name)'] ||
        resolveCol(r,'Epic Name') ||
        resolveCol(r,'Summary') || ''
      );
      if(key&&name) S.epicMap[key]=name;
    });
  }
  // Also try to pull epic names directly from issues CSV if no epics file loaded
  // (some Jira exports include Epic Name as a column on each issue row)
  if(S.files.issues && !S.files.epics) {
    S.files.issues.forEach(r=>{
      const issueType=normText(resolveCol(r,'Issue Type')).toLowerCase();
      if(issueType==='epic') {
        const key=normText(resolveCol(r,'Issue key')||resolveCol(r,'Key')||'');
        const name=normText(resolveCol(r,'Summary')||'');
        if(key&&name) S.epicMap[key]=name;
      }
    });
  }
  S.allTickets=[];
  if(S.files.issues) {
    S.allTickets=S.files.issues.map(r=>buildTicket(r,S.epicMap));
  }
}
