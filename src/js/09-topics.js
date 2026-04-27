// ============================================================
// TOPICS EDITOR
// ============================================================
function renderTopicsList(){
  const el=document.getElementById('topics-list');
  el.innerHTML=S.topics.map((t,i)=>`
  <div class="topic-item" id="topic-item-${i}">
    <div class="topic-hdr" onclick="toggleTopic(${i})">
      <div class="t-rank">${t.tier_rank}</div>
      <div class="t-label">${esc(t.header)}</div>
      <div class="t-projs">${t.projects.map(p=>`<span class="tp tp-${p.toLowerCase()}">${p}</span>`).join('')}</div>
      <span class="t-chev" id="tc-${i}">›</span>
    </div>
    <div class="topic-body" id="tb-${i}">
      <div class="field-row"><div class="fl">Topic ID<small>Used in pmr_layouts config</small></div><input type="text" data-idx="${i}" data-tf="topic_id" value="${esc(t.topic_id)}" class="topic-field"></div>
      <div class="field-row"><div class="fl">Header</div><input type="text" data-idx="${i}" data-tf="header" value="${esc(t.header)}" class="topic-field topic-field-header"></div>
      <div class="field-row"><div class="fl">Tier Rank<small>Lower = higher priority</small></div><input type="text" data-idx="${i}" data-tf="tier_rank" value="${t.tier_rank}" class="topic-field topic-field-rank" style="width:60px"></div>
      <div class="field-row"><div class="fl">Projects</div>
        <div class="row">${['DX','LX','RC','AFX'].map(p=>`<label style="display:flex;align-items:center;gap:4px;font-size:var(--fs-sm);cursor:pointer"><input type="checkbox" ${t.projects.includes(p)?'checked':''} onchange="toggleProject(${i},'${p}',this.checked)">${p}</label>`).join('')}</div>
      </div>
      <div class="field-row"><div class="fl">Epic Keys</div><div id="epics-${i}" class="tag-box" onclick="focusTagIn(this)"><input class="tag-in" placeholder="e.g. DX-12345..." onkeydown="topicTagKeydown(event,this,${i},'epic_keys')"></div></div>
      <div class="field-row"><div class="fl">Exact Phrases</div><div id="phrases-${i}" class="tag-box" onclick="focusTagIn(this)"><input class="tag-in" placeholder="exact phrase..." onkeydown="topicTagKeydown(event,this,${i},'exact_phrases')"></div></div>
      <div class="field-row"><div class="fl">Keywords</div><div id="keywords-${i}" class="tag-box" onclick="focusTagIn(this)"><input class="tag-in" placeholder="keyword..." onkeydown="topicTagKeydown(event,this,${i},'keywords')"></div></div>
      <div class="field-row"><div class="fl">Exclude Keywords</div><div id="exclkw-${i}" class="tag-box" onclick="focusTagIn(this)"><input class="tag-in" placeholder="exclude keyword..." onkeydown="topicTagKeydown(event,this,${i},'exclude_keywords')"></div></div>
      <div class="row mt8">
        <button class="btn btn-ghost btn-xs" onclick="moveTopicUp(${i})"><span class="mi" style="font-size:13px;margin-right:2px">arrow_upward</span>Move Up</button>
        <button class="btn btn-ghost btn-xs" onclick="moveTopicDown(${i})"><span class="mi" style="font-size:13px;margin-right:2px">arrow_downward</span>Move Down</button>
        <button class="btn btn-red btn-xs" onclick="deleteTopic(${i})"><span class="mi" style="font-size:13px;margin-right:2px">delete</span>Delete Topic</button>
      </div>
    </div>
  </div>`).join('');

  // Wire topic field inputs via delegation — avoids embedding raw values in onchange strings
  el.querySelectorAll('input.topic-field').forEach(function(inp) {
    inp.addEventListener('change', function() {
      const idx = +this.dataset.idx;
      const field = this.dataset.tf;
      const val = field === 'tier_rank' ? (parseInt(this.value)||0) : this.value;
      S.topics[idx][field] = val;
      // Mirror live label / rank updates
      if (field === 'header') {
        const lbl = document.querySelector('#topic-item-' + idx + ' .t-label');
        if (lbl) lbl.textContent = val;
      }
      if (field === 'tier_rank') {
        const rnk = document.querySelector('#topic-item-' + idx + ' .t-rank');
        if (rnk) rnk.textContent = val;
      }
    });
  });

  // Render tags
  S.topics.forEach((t,i)=>{
    renderTopicTags(i,'epic_keys','epics');
    renderTopicTags(i,'exact_phrases','phrases');
    renderTopicTags(i,'keywords','keywords');
    renderTopicTags(i,'exclude_keywords','exclkw');
  });
}
function _makeTopicTag(idx, field, v, input) {
  const el = document.createElement('span');
  el.className = 'tag';
  const text = document.createTextNode(v);
  const x = document.createElement('span');
  x.className = 'tag-x';
  x.textContent = '×';
  x.dataset.idx   = idx;
  x.dataset.field = field;
  x.dataset.val   = v;
  x.addEventListener('click', function() {
    const i = +this.dataset.idx, f = this.dataset.field, val = this.dataset.val;
    S.topics[i][f] = S.topics[i][f].filter(t => t !== val);
    this.closest('.tag').remove();
  });
  el.appendChild(text);
  el.appendChild(x);
  return el;
}
function renderTopicTags(idx, field, prefix) {
  const box = document.getElementById(`${prefix}-${idx}`);
  if (!box) return;
  const input = box.querySelector('.tag-in');
  box.querySelectorAll('.tag').forEach(t => t.remove());
  (S.topics[idx][field] || []).forEach(v => {
    box.insertBefore(_makeTopicTag(idx, field, v), input);
  });
}
function removeTopicTag(idx, field, val, el) {
  // Legacy path (kept for any residual onclick refs); prefer _makeTopicTag event listener
  S.topics[idx][field] = S.topics[idx][field].filter(v => v !== val);
  el.closest('.tag').remove();
}
function topicTagKeydown(e, input, idx, field) {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const val = input.value.trim();
  if (!val) return;
  if (!S.topics[idx][field]) S.topics[idx][field] = [];
  if (!S.topics[idx][field].includes(val)) {
    S.topics[idx][field].push(val);
    input.before(_makeTopicTag(idx, field, val));
  }
  input.value = '';
}
function toggleTopic(i){
  const body=document.getElementById('tb-'+i);
  const chev=document.getElementById('tc-'+i);
  body.classList.toggle('open');
  chev.classList.toggle('open');
}
function toggleProject(idx,proj,checked){
  if(checked&&!S.topics[idx].projects.includes(proj)) S.topics[idx].projects.push(proj);
  if(!checked) S.topics[idx].projects=S.topics[idx].projects.filter(p=>p!==proj);
  document.querySelector(`#topic-item-${idx} .t-projs`).innerHTML=S.topics[idx].projects.map(p=>`<span class="tp tp-${p.toLowerCase()}">${p}</span>`).join('');
}
function addTopic(){
  S.topics.push({topic_id:'new_topic_'+Date.now(),header:'New Topic',tier_rank:99,projects:[],epic_keys:[],exact_phrases:[],keywords:[],exclude_keywords:[]});
  renderTopicsList();
  // scroll to bottom and open new
  const i=S.topics.length-1;
  setTimeout(()=>{toggleTopic(i);document.getElementById('topic-item-'+i).scrollIntoView({behavior:'smooth'});},50);
}
function deleteTopic(i){ if(confirm('Delete this topic?')){ S.topics.splice(i,1); renderTopicsList(); } }
function moveTopicUp(i){ if(i===0) return; [S.topics[i-1],S.topics[i]]=[S.topics[i],S.topics[i-1]]; renderTopicsList(); }
function moveTopicDown(i){ if(i>=S.topics.length-1) return; [S.topics[i],S.topics[i+1]]=[S.topics[i+1],S.topics[i]]; renderTopicsList(); }
function exportTopics(){
  try{ localStorage.setItem('jira_reportsuite_topics_v1', JSON.stringify(S.topics)); }catch(e){}
  const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(S.topics,null,2)); a.download='topics_config.json'; a.click();
}
function importTopics(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      // Accept either a raw array or a wrapped object with a topics key
      const topics=Array.isArray(data)?data:(data.topics||null);
      if(!topics||!topics.length){ alert('No topics found in file.'); return; }
      const merge=confirm(`Import ${topics.length} topics?\n\nOK = Replace all current topics\nCancel = Merge (add new, keep existing)`);
      if(merge){
        S.topics=topics;
      } else {
        const existingIds=new Set(S.topics.map(t=>t.topic_id));
        topics.forEach(t=>{ if(!existingIds.has(t.topic_id)) S.topics.push(t); });
      }
      renderTopicsList();
      // Also save to localStorage so topics survive a reload
      try{ localStorage.setItem('jira_reportsuite_topics_v1', JSON.stringify(S.topics)); }catch(e){}
      const msg=document.getElementById('topics-import-msg');
      if(msg){ msg.textContent=`✓ ${topics.length} topics imported`; msg.style.color='var(--a3)'; setTimeout(()=>msg.textContent='',4000); }
    }catch(err){ alert('Failed to parse topics file: '+err.message); }
  };
  reader.readAsText(file);
}

