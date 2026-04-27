// ============================================================
// MATCH ENGINE
// ============================================================
function topicTrace(ticket, topic) {
  const tid=topic.topic_id||topic.header;
  const base={topic_id:tid,header:topic.header,tier_rank:topic.tier_rank!=null?topic.tier_rank:999,matched_rule:null,excluded_by:null,fail_reason:null};
  if(!topic.projects.includes(ticket.project_bucket)) return {...base,result:'no_match',fail_reason:'project_mismatch'};
  // Epic key
  if((topic.epic_keys||[]).includes(ticket.epic_link)) return {...base,result:'match',matched_rule:`epic_key:${ticket.epic_link}`};
  // Exact phrase
  const blob=normLower(ticket.match_blob);
  const normBlob=normForMatch(blob);
  for(const p of (topic.exact_phrases||[])) {
    if(normBlob.includes(normForMatch(p))) return {...base,result:'match',matched_rule:`exact_phrase:${p}`};
  }
  // Exclude keywords
  for(const ex of (topic.exclude_keywords||[])) {
    if(blob.includes(ex.toLowerCase())) return {...base,result:'excluded',excluded_by:`exclude_keyword:${ex}`};
  }
  // Keywords
  for(const kw of (topic.keywords||[])) {
    if(blob.includes(kw.toLowerCase())) return {...base,result:'match',matched_rule:`keyword:${kw}`};
  }
  return {...base,result:'no_match',fail_reason:'no_rule_fired'};
}
function normForMatch(v){
  return v.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function findBestMatch(ticket, topics) {
  const traces=topics.map(t=>topicTrace(ticket,t));
  const matches=traces.map((tr,i)=>({topic:topics[i],trace:tr})).filter(x=>x.trace.result==='match');
  if(!matches.length) return {best:null,traces};
  matches.sort((a,b)=>(a.trace.tier_rank-b.trace.tier_rank)||topics.indexOf(a.topic)-topics.indexOf(b.topic));
  return {best:matches[0].topic,traces};
}

