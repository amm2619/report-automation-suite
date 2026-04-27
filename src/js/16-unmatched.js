// ============================================================
// UNMATCHED PANEL + OVERRIDE MODAL
// ============================================================
function unmatchedPanel(tickets, context, panelId){
  if(!tickets.length) return '<p style="color:var(--a3);font-size:var(--fs-base)">✓ All tickets matched a topic.</p>';
  // Store tickets in a lookup so onclick doesn't need to pass JSON inline
  const items=tickets.map(t=>{
    const safeId=`um_${t.issue_key.replace(/[^a-zA-Z0-9]/g,'_')}`;
    S._unmatchedLookup[safeId]=t;
    return `
  <div class="um-item">
    <div class="um-header">
      <span class="um-key">${jiraLink(t.issue_key,'um-key')}</span>
      <button class="btn btn-purple btn-xs" onclick="openOverrideModal('${safeId}')">+ Create Rule</button>
    </div>
    <div class="um-summary">${esc(t.summary)}</div>
    <div class="um-meta">
      Epic: ${esc(t.epic_name||t.epic_link||'—')} &nbsp;·&nbsp; Labels: ${esc(t.labels||'—')} &nbsp;·&nbsp; Components: ${esc((t.components||[]).join(', ')||'—')}
    </div>
  </div>`;
  }).join('');
  return `<div id="${panelId}">${items}</div>`;
}

function openOverrideModal(ticketIdOrJson){
  // Accept either a safeId lookup key (new) or raw JSON string (legacy)
  let t;
  if(ticketIdOrJson.startsWith('um_')){
    t=S._unmatchedLookup[ticketIdOrJson];
    if(!t){ alert('Ticket not found — try regenerating the report.'); return; }
  } else {
    try{ t=JSON.parse(ticketIdOrJson); }catch(e){ alert('Could not parse ticket data.'); return; }
  }
  S.pendingOverride={ticket:t};
  document.getElementById('modal-ticket-info').innerHTML=`<strong class="mono" style="color:var(--a5)">${jiraLink(t.issue_key)}</strong> — ${esc(t.summary)}`;
  const topicSel=document.getElementById('modal-topic-select');
  const exclSel=document.getElementById('modal-excl-topic');
  topicSel.innerHTML=S.topics.map(tp=>`<option value="${esc(tp.topic_id)}">${esc(tp.header)}</option>`).join('');
  exclSel.innerHTML=S.topics.map(tp=>`<option value="${esc(tp.topic_id)}">${esc(tp.header)}</option>`).join('');
  // Pre-suggest value
  document.getElementById('modal-rule-value').value='';
  updateModalRuleInput();
  // Move modal to body so it escapes overflow:hidden stacking contexts
  const mo = document.getElementById('modal-override');
  if(mo.parentElement !== document.body) document.body.appendChild(mo);
  mo.classList.add('open');
}
function updateModalRuleInput(){
  const type=document.getElementById('modal-rule-type').value;
  const t=S.pendingOverride?.ticket;
  const hints={
    keyword:`Keyword to add. Will match against: Summary, Epic Name, Labels, Components.${t?` Suggested from ticket: "${t.summary.split(' ').slice(0,3).join(' ')}"`:''}`,
    exact_phrase:`An exact phrase that appears in the ticket's text.`,
    epic_key:`Epic key to add.${t&&t.epic_link?` Ticket's epic: ${t.epic_link}`:''}`,
    exclude_keyword:`Add this keyword to a DIFFERENT topic's exclude list, to stop it matching there.`
  };
  document.getElementById('modal-rule-hint').textContent=hints[type]||'';
  document.getElementById('modal-extra-topic-row').style.display=type==='exclude_keyword'?'grid':'none';
  // Pre-fill suggestions
  if(t){
    if(type==='epic_key') document.getElementById('modal-rule-value').value=t.epic_link||'';
    else if(type==='keyword') document.getElementById('modal-rule-value').value='';
    else document.getElementById('modal-rule-value').value='';
  }
}
function closeModal(){ document.getElementById('modal-override').classList.remove('open'); S.pendingOverride=null; }
function reapplyOverridesToTopics(){
  // Re-apply stored override records back into S.topics after a page reload
  S.overrides.forEach(o=>{
    const targetIdx=S.topics.findIndex(tp=>tp.topic_id===o.target_topic_id);
    if(targetIdx<0) return;
    if(o.rule_type==='keyword'){
      if(!S.topics[targetIdx].keywords.includes(o.value)) S.topics[targetIdx].keywords.push(o.value);
    } else if(o.rule_type==='exact_phrase'){
      if(!S.topics[targetIdx].exact_phrases.includes(o.value)) S.topics[targetIdx].exact_phrases.push(o.value);
    } else if(o.rule_type==='epic_key'){
      if(!S.topics[targetIdx].epic_keys.includes(o.value)) S.topics[targetIdx].epic_keys.push(o.value);
    } else if(o.rule_type==='exclude_keyword'&&o.excl_topic_id){
      const exIdx=S.topics.findIndex(tp=>tp.topic_id===o.excl_topic_id);
      if(exIdx>=0&&!S.topics[exIdx].exclude_keywords.includes(o.value)) S.topics[exIdx].exclude_keywords.push(o.value);
    }
  });
}

function applyOverride(){
  const t=S.pendingOverride?.ticket;
  if(!t){ closeModal(); return; }
  const topicId=document.getElementById('modal-topic-select').value;
  const ruleType=document.getElementById('modal-rule-type').value;
  const value=document.getElementById('modal-rule-value').value.trim();
  const exclTopicId=document.getElementById('modal-excl-topic').value;
  if(!value){ alert('Enter a value for the rule.'); return; }

  // Apply rule to topics in memory
  const targetIdx=S.topics.findIndex(tp=>tp.topic_id===topicId);
  if(targetIdx<0){ alert('Topic not found.'); return; }
  if(ruleType==='keyword') { if(!S.topics[targetIdx].keywords.includes(value)) S.topics[targetIdx].keywords.push(value); }
  else if(ruleType==='exact_phrase') { if(!S.topics[targetIdx].exact_phrases.includes(value)) S.topics[targetIdx].exact_phrases.push(value); }
  else if(ruleType==='epic_key') { if(!S.topics[targetIdx].epic_keys.includes(value)) S.topics[targetIdx].epic_keys.push(value); }
  else if(ruleType==='exclude_keyword') {
    const exIdx=S.topics.findIndex(tp=>tp.topic_id===exclTopicId);
    if(exIdx>=0&&!S.topics[exIdx].exclude_keywords.includes(value)) S.topics[exIdx].exclude_keywords.push(value);
  }

  // Save override record
  S.overrides.push({
    ticket_key:t.issue_key, summary:t.summary,
    target_topic_id:topicId, target_topic_header:S.topics[targetIdx].header,
    rule_type:ruleType, value,
    excl_topic_id:ruleType==='exclude_keyword'?exclTopicId:null,
    applied_at:new Date().toISOString()
  });

  // Persist overrides to localStorage
  try{ localStorage.setItem('jira_reportsuite_overrides_v1', JSON.stringify(S.overrides)); }catch(e){}

  closeModal();

  // Rerun current report, then scroll Unmatched tab into view and show feedback
  try {
    const page = _activeWizard || S.currentPage;
    if(page==='eos') runEOS();
    else if(page==='pmr') runPMR();
    else if(page==='weekly') runWeekly();
    else if(page==='sprint') runSprint();
    else console.warn('[applyOverride] no active wizard/page to rerun, _activeWizard=', _activeWizard, 'S.currentPage=', S.currentPage);

    // After rerun: activate the Unmatched sub-tab and show a confirmation banner
    setTimeout(function() {
      // Find and click the Unmatched tab so user sees the updated list
      const allSubtabs = document.querySelectorAll('.r-subtab');
      const umTab = Array.from(allSubtabs).find(t => t.textContent.trim().startsWith('Unmatched'));
      if (umTab) { umTab.click(); umTab.scrollIntoView({ behavior:'smooth', block:'nearest' }); }

      // Show a brief dismissable status banner above the unmatched panel
      const ruleDesc = ruleType === 'exclude_keyword'
        ? 'Exclude rule added — report re-run.'
        : 'Rule added to “' + (S.topics.find(tp=>tp.topic_id===topicId)?.header||topicId) + '” — report re-run.';
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--s2);border:1px solid var(--a3b);border-left:3px solid var(--a3);border-radius:var(--r);box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:var(--fs-sm);color:var(--tx);max-width:360px';
      banner.innerHTML = '<span class="mi" style="color:var(--a3);font-size:16px;flex-shrink:0">check_circle</span><span style="flex:1">' + ruleDesc + '</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--mu);cursor:pointer;font-size:16px;padding:0 0 0 6px;line-height:1">&times;</button>';
      document.body.appendChild(banner);
      setTimeout(function() { if(banner.parentElement) banner.remove(); }, 4000);
    }, 120);
  } catch(err) {
    console.error('[applyOverride] rerun failed:', err);
    alert('Rule applied, but rerun failed: ' + err.message + '\n\nClick Generate Report to rerun manually.');
  }
  renderOverridesUI();
}

