// ============================================================
// JIRA API
// ─────────────────────────────────────────────────────────────
function toggleApiPanel(){
  const body=document.getElementById('api-panel-body');
  const chev=document.getElementById('api-collapse-chevron');
  if(!body) return;
  const open=body.style.display==='none'||body.style.display==='';
  body.style.display=open?'block':'none';
  if(chev) chev.style.transform=open?'rotate(90deg)':'rotate(0deg)';
}
function toggleTokenVis(){
  const inp=document.getElementById('api-token');
  if(!inp) return;
  inp.type=inp.type==='password'?'text':'password';
}
function apiHeaders(){
  const creds=btoa(`${S.api.user}:${S.api.token}`);
  return { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };
}

function apiBase(){
  // Try proxy first on localhost:5050, then direct
  return S.api.useProxy ? 'http://localhost:5050' : (S.api.url||'').replace(/\/$/, '');
}

async function jiraFetch(path, useProxy=false){
  const base = useProxy ? 'http://localhost:5050' : (S.api.url||'').replace(/\/$/, '');
  const url = `${base}${path}`;
  const opts = useProxy
    ? { method:'GET', headers:{ 'X-Jira-Url': S.api.url, 'X-Jira-User': S.api.user, 'X-Jira-Token': S.api.token } }
    : { method:'GET', headers: apiHeaders() };
  const res = await fetch(url, opts);
  if(!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

async function testJiraConnection(){
  const msg=document.getElementById('api-test-msg');
  const dot=document.getElementById('api-status-dot');
  const txt=document.getElementById('api-status-txt');
  const corsWarn=document.getElementById('api-cors-warn');
  const fetchBtn=document.getElementById('api-fetch-btn');

  // Sync from config tab inputs if used
  const cfgUrl=document.getElementById('cfg-api-url');
  const cfgUser=document.getElementById('cfg-api-user');
  const cfgToken=document.getElementById('cfg-api-token');
  if(cfgUrl?.value) S.api.url=cfgUrl.value;
  if(cfgUser?.value) S.api.user=cfgUser.value;
  if(cfgToken?.value) S.api.token=cfgToken.value;
  // Also sync from files page inputs
  const fpUrl=document.getElementById('api-url');
  const fpUser=document.getElementById('api-user');
  const fpToken=document.getElementById('api-token');
  if(fpUrl?.value) S.api.url=fpUrl.value;
  if(fpUser?.value) S.api.user=fpUser.value;
  if(fpToken?.value) S.api.token=fpToken.value;

  if(!S.api.url||!S.api.user||!S.api.token){
    if(msg) msg.textContent='Enter URL, username, and token first.';
    return;
  }
  if(msg) { msg.textContent='Testing...'; msg.style.color='var(--mu)'; }
  if(corsWarn) corsWarn.style.display='none';

  // Try direct first
  let connected=false;
  let useProxy=false;
  try {
    await jiraFetch('/rest/api/2/myself', false);
    connected=true;
  } catch(e){
    const isCors=e instanceof TypeError || (e.message&&e.message.toLowerCase().includes('fetch'));
    if(isCors){
      // Try proxy
      try {
        await jiraFetch('/rest/api/2/myself', true);
        connected=true; useProxy=true;
      } catch(e2){
        // Proxy not running either
        if(corsWarn) corsWarn.style.display='block';
      }
    }
  }

  S.api.connected=connected;
  S.api.useProxy=useProxy;
  if(dot) dot.style.background=connected?'var(--a3)':'var(--a5)';
  if(txt) txt.textContent=connected?(useProxy?'Connected via proxy':'Connected'):'Connection failed';
  if(txt) txt.style.color=connected?'var(--a3)':'var(--a5)';
  if(msg) { msg.textContent=connected?(useProxy?'✓ Connected through local proxy':'✓ Connected directly'):'✗ Failed — see CORS warning below'; msg.style.color=connected?'var(--a3)':'var(--a5)'; }
  if(fetchBtn) fetchBtn.disabled=!connected;
}

// ── FETCH MODAL ───────────────────────────────────────────
function showFetchModal(){
  if(!S.api.connected){ alert('Test the connection first.'); return; }
  document.getElementById('modal-fetch').classList.add('open');
  updateJqlPreview();
}
function closeFetchModal(){ document.getElementById('modal-fetch').classList.remove('open'); }
async function runJiraFetch(){
  // Delegate to executeFetch — single canonical implementation
  updateJqlPreview();
  await executeFetch();
}

// Returns a JQL-ready "project in (...)" clause derived from sprint_prefixes.
// Collapses RCR -> RC (Jira project key), drops AFX (not a tracked Jira project).
function _jqlProjects() {
  const raw = S.cfg.sprint_prefixes || ['DX', 'LX', 'RC'];
  const keys = [...new Set(raw.map(p => p === 'RCR' ? 'RC' : p).filter(p => p !== 'AFX'))];
  return `project in (${keys.join(', ')})`;
}

function updateJqlPreview(){
  const mode=document.getElementById('jql-mode').value;
  const preview=document.getElementById('jql-preview');
  const projects=_jqlProjects();
  const days=document.getElementById('jql-days')?.value||14;
  const sprint=document.getElementById('jql-sprint')?.value||'';
  let jql='';
  if(mode==='updated')   jql=`${projects} AND updated >= -${days}d ORDER BY updated DESC`;
  if(mode==='sprint')    jql=`${projects} AND sprint = "${sprint}" ORDER BY updated DESC`;
  if(mode==='custom')    jql=document.getElementById('jql-custom')?.value||'';
  if(preview) preview.textContent=jql;
  S.api._jql=jql;
}

async function executeFetch(){
  const jql=S.api._jql||document.getElementById('jql-custom')?.value||'';
  if(!jql){ alert('No JQL query set.'); return; }
  const statusEl=document.getElementById('modal-fetch-status')||document.getElementById('fetch-status');
  if(statusEl) statusEl.textContent='Fetching...';

  try {
    const rows=[];
    let startAt=0, total=1;
    while(startAt<total){
      const path=`/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=100&fields=summary,status,issuetype,assignee,priority,labels,components,customfield_10016,customfield_10014,sprint,created,updated,resolutiondate,parent`;
      const data=await jiraFetch(path, S.api.useProxy);
      total=data.total||0;
      const issues=data.issues||[];
      issues.forEach(issue=>{
        const f=issue.fields||{};
        const sprintField=(f.sprint||f.customfield_10020);
        const sprintName=Array.isArray(sprintField)?sprintField.map(s=>s.name||s).join(', '):(sprintField?.name||sprintField||'');
        rows.push({
          'Issue key': issue.key,
          'Summary': f.summary||'',
          'Status': f.status?.name||'',
          'Issue Type': f.issuetype?.name||'',
          'Assignee': f.assignee?.displayName||f.assignee?.name||'',
          'Labels': (f.labels||[]).join(', '),
          'Components': (f.components||[]).map(c=>c.name).join(', '),
          'Epic Link': f.customfield_10014||f.parent?.key||'',
          'Story Points': f.customfield_10016||f.story_points||'',
          'Sprint': sprintName,
          'Created': f.created?.slice(0,10)||'',
          'Updated': f.updated?.slice(0,10)||'',
          'Resolved': f.resolutiondate?.slice(0,10)||'',
          'Project key': issue.key.split('-')[0],
        });
      });
      startAt+=issues.length;
      if(!issues.length) break;
      if(statusEl) statusEl.textContent=`Fetched ${rows.length} of ${total}...`;
    }

    S.files.issues=rows;
    rebuildTickets();
    refreshAssigneePicker();
    // Update file status
    document.getElementById('fz-issues')?.classList.add('loaded');
    const _fli=document.getElementById('fl-issues'); if(_fli) _fli.textContent=`Jira API — ${rows.length} issues`;
    updateStatusBar();
    if(statusEl) statusEl.textContent=`✓ Fetched ${rows.length} issues`;
    closeFetchModal();

    // Also fetch epics if requested
    const fetchEpics=document.getElementById('fetch-epics-too')?.checked;
    if(fetchEpics) await fetchEpicsFromJira();

  } catch(e){
    if(statusEl) statusEl.textContent=`Error: ${e.message}`;
  }
}

async function fetchEpicsFromJira(){
  const statusEl=document.getElementById('modal-fetch-status')||document.getElementById('fetch-status');
  const jql=`${_jqlProjects()} AND issuetype = Epic ORDER BY key ASC`;
  try {
    const epicRows=[];
    let startAt=0, total=1;
    while(startAt<total){
      const path=`/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=100&fields=summary,project`;
      const data=await jiraFetch(path, S.api.useProxy);
      total=data.total||0;
      (data.issues||[]).forEach(issue=>{
        epicRows.push({ 'Epic Key': issue.key, 'Epic Name': issue.fields?.summary||'', 'Project': issue.fields?.project?.key||'' });
      });
      startAt+=(data.issues||[]).length;
      if(!(data.issues||[]).length) break;
    }
    S.files.epics=epicRows;
    // Rebuild epic map
    S.epicMap={};
    epicRows.forEach(r=>{ if(r['Epic Key']&&r['Epic Name']) S.epicMap[r['Epic Key']]=r['Epic Name']; });
    rebuildTickets();
    document.getElementById('fz-epics')?.classList.add('loaded');
    const _fle=document.getElementById('fl-epics'); if(_fle) _fle.textContent=`Jira API — ${epicRows.length} epics`;
    updateStatusBar();
    if(statusEl) statusEl.textContent=`✓ Fetched issues + ${epicRows.length} epics`;
  } catch(e){
    console.warn('Epic fetch failed:', e.message);
  }
}

// ── PROXY SCRIPT ──────────────────────────────────────────
function downloadProxyScript(){
  const script=`#!/usr/bin/env python3
"""
jira_proxy.py — Local CORS proxy for Report Suite
Run: python jira_proxy.py
Then use the app normally. Keeps your Jira token local.
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request, urllib.error, base64, json, sys

PORT = 5050

class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[proxy] {fmt % args}")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        jira_url   = self.headers.get('X-Jira-Url', '').rstrip('/')
        jira_user  = self.headers.get('X-Jira-User', '')
        jira_token = self.headers.get('X-Jira-Token', '')

        if not jira_url:
            self.send_response(400)
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"error":"Missing X-Jira-Url header"}')
            return

        target = jira_url + self.path
        creds  = base64.b64encode(f"{jira_user}:{jira_token}".encode()).decode()
        req    = urllib.request.Request(target, headers={
            'Authorization': f'Basic {creds}',
            'Accept':        'application/json',
            'Content-Type':  'application/json',
        })

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self._cors()
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(500)
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers',
                         'X-Jira-Url, X-Jira-User, X-Jira-Token, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')

if __name__ == '__main__':
    print(f"Jira proxy running on http://localhost:{PORT}")
    print("Keep this window open while using Report Suite.")
    print("Press Ctrl+C to stop.\\n")
    try:
        HTTPServer(('localhost', PORT), ProxyHandler).serve_forever()
    except KeyboardInterrupt:
        print("\\nProxy stopped.")
        sys.exit(0)
`;
  const a=document.createElement('a'); a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(script); a.download='jira_proxy.py'; a.click();
}

// OVERRIDES
// ============================================================
function renderOverridesUI(){
  const el=document.getElementById('overrides-list');
  if(!el) return; // settings overlay may be closed
  if(!S.overrides.length){ el.innerHTML='<div class="empty-state"><div class="esi"><span class="mi" style="font-size:28px">rule</span></div>No overrides created yet.<br>Use the Unmatched tab in any report to create rules.</div>'; return; }
  el.innerHTML=S.overrides.map((o,i)=>`
  <div class="card l2" style="margin-bottom:8px">
    <div class="row" style="margin-bottom:6px">
      <span class="mono" style="font-size:var(--fs-xs);color:var(--a5)">${esc(o.ticket_key)}</span>
      <span style="font-size:var(--fs-sm);color:var(--tx);flex:1">${esc(o.summary)}</span>
      <button class="btn btn-red btn-xs" onclick="removeOverride(${i})">Remove</button>
    </div>
    <div style="font-size:var(--fs-xs);color:var(--a2);margin-bottom:3px">→ ${esc(o.target_topic_header)}</div>
    <div style="font-size:var(--fs-xs);font-family:var(--mono);color:var(--mu)">${o.rule_type}: "${esc(o.value)}"${o.excl_topic_id?` (exclude from: ${esc(o.excl_topic_id)})`:''}</div>
  </div>`).join('');
}
function removeOverride(i){ S.overrides.splice(i,1); try{ localStorage.setItem('jira_reportsuite_overrides_v1', JSON.stringify(S.overrides)); }catch(e){} renderOverridesUI(); }
function clearOverrides(){ if(confirm('Clear all override rules?')){ S.overrides=[]; try{ localStorage.setItem('jira_reportsuite_overrides_v1', JSON.stringify(S.overrides)); }catch(e){} renderOverridesUI(); } }
function exportOverrides(){
  const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify({overrides:S.overrides,exported_at:new Date().toISOString()},null,2)); a.download='overrides.json'; a.click();
}
function loadOverrides(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const data=JSON.parse(e.target.result);
      const rules=data.overrides||[];
      // Apply silently
      rules.forEach(o=>{
        const targetIdx=S.topics.findIndex(tp=>tp.topic_id===o.target_topic_id);
        if(targetIdx<0) return;
        if(o.rule_type==='keyword'&&!S.topics[targetIdx].keywords.includes(o.value)) S.topics[targetIdx].keywords.push(o.value);
        else if(o.rule_type==='exact_phrase'&&!S.topics[targetIdx].exact_phrases.includes(o.value)) S.topics[targetIdx].exact_phrases.push(o.value);
        else if(o.rule_type==='epic_key'&&!S.topics[targetIdx].epic_keys.includes(o.value)) S.topics[targetIdx].epic_keys.push(o.value);
        else if(o.rule_type==='exclude_keyword'){
          const exIdx=S.topics.findIndex(tp=>tp.topic_id===o.excl_topic_id);
          if(exIdx>=0&&!S.topics[exIdx].exclude_keywords.includes(o.value)) S.topics[exIdx].exclude_keywords.push(o.value);
        }
        if(!S.overrides.find(x=>x.ticket_key===o.ticket_key&&x.rule_type===o.rule_type&&x.value===o.value)) S.overrides.push(o);
      });
      document.getElementById('fz-overrides').classList.add('loaded');
      document.getElementById('fl-overrides').textContent=`${file.name} — ${rules.length} rules applied`;
    } catch(err){ alert('Failed to parse overrides file: '+err.message); }
  };
  reader.readAsText(file);
}

