// ============================================================
// DOWNLOAD / EXPORT
// ============================================================

// Standalone HTML export — full dark-theme self-contained file
// EOS Confluence copy — project picker modal (replaces old downloadAllConfluence)
// ── Shared Confluence picker ──────────────────────────────────
// opts: { overlayId, checkboxPrefix, statusId, copyBtnId, available, label, getMarkup }
function openConfluencePicker(opts) {
  const { overlayId, checkboxPrefix, statusId, copyBtnId, available, label, getMarkup } = opts;
  let overlay = document.getElementById(overlayId);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
    document.body.appendChild(overlay);
  }
  const checkboxes = available.map(p =>
    `<label style="display:flex;align-items:center;gap:8px;padding:7px 0;cursor:pointer;font-size:var(--fs-sm)">
      <input type="checkbox" id="${checkboxPrefix}${p}" checked style="width:14px;height:14px;accent-color:var(--a1)">
      ${esc(p)}
    </label>`
  ).join('');
  overlay.innerHTML = `
    <div style="background:var(--s2);border:1px solid var(--bd2);border-radius:var(--r);width:min(360px,92vw);padding:24px;display:flex;flex-direction:column;gap:14px">
      <div style="font-weight:600;font-size:var(--fs-base);color:var(--tx)">Copy for Confluence</div>
      <div class="u-muted-xs">${label}</div>
      <div style="border:1px solid var(--bd);border-radius:var(--r2);padding:4px 12px">${checkboxes}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('${overlayId}').style.display='none'">Cancel</button>
        <button class="btn btn-primary btn-sm" id="${copyBtnId}">
          <span class="mi" style="font-size:14px;margin-right:4px">content_copy</span>Copy
        </button>
      </div>
      <div id="${statusId}" style="font-size:var(--fs-xs);color:var(--a3);min-height:16px;text-align:right"></div>
    </div>`;
  overlay.style.display = 'flex';
  document.getElementById(copyBtnId).addEventListener('click', async function() {
    const chosen = available.filter(p => document.getElementById(checkboxPrefix + p)?.checked);
    if (!chosen.length) { alert('Select at least one project.'); return; }
    const markup = getMarkup(chosen);
    await copyTextWithFallback(markup, document.getElementById(statusId), 2500);
  });
}

function openEOSConfluencePicker() {
  // Regenerate from the live DOM so user-typed summaries are included
  refreshEOSConfluenceTexts();
  const texts = S.eosConfluenceTexts || {};
  const available = Object.keys(texts);
  if (!available.length) { alert('Run the EOS report first.'); return; }

  // Build the picker with an extra toggle for empty topics
  let overlay = document.getElementById('eos-conf-picker');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'eos-conf-picker';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
    document.body.appendChild(overlay);
  }
  const checkboxes = available.map(p =>
    `<label style="display:flex;align-items:center;gap:8px;padding:7px 0;cursor:pointer;font-size:var(--fs-sm)">
      <input type="checkbox" id="eosc-${p}" checked style="width:14px;height:14px;accent-color:var(--a1)">
      ${esc(p)}
    </label>`
  ).join('');
  const hideEmpty = S.cfg.eos_hide_empty_topics || false;
  overlay.innerHTML = `
    <div style="background:var(--s2);border:1px solid var(--bd2);border-radius:var(--r);width:min(400px,92vw);padding:24px;display:flex;flex-direction:column;gap:14px">
      <div style="font-weight:600;font-size:var(--fs-base);color:var(--tx)">Copy for Confluence</div>
      <div class="u-muted-xs">Choose which projects to include in the copied markup.</div>
      <div style="border:1px solid var(--bd);border-radius:var(--r2);padding:4px 12px">${checkboxes}</div>
      <label style="display:flex;align-items:center;gap:8px;font-size:var(--fs-xs);color:var(--mu);cursor:pointer">
        <input type="checkbox" id="eosc-hide-empty" ${hideEmpty?'checked':''} style="width:14px;height:14px;accent-color:var(--a1)">
        Exclude empty (NSTR) topics
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('eos-conf-picker').style.display='none'">Cancel</button>
        <button class="btn btn-primary btn-sm" id="eosc-copy-btn">
          <span class="mi" style="font-size:14px;margin-right:4px">content_copy</span>Copy
        </button>
      </div>
      <div id="eosc-copy-status" style="font-size:var(--fs-xs);color:var(--a3);min-height:16px;text-align:right"></div>
    </div>`;
  overlay.style.display = 'flex';
  document.getElementById('eosc-copy-btn').addEventListener('click', async function() {
    const chosen = available.filter(p => document.getElementById('eosc-' + p)?.checked);
    if (!chosen.length) { alert('Select at least one project.'); return; }
    // Read the toggle and persist + regenerate if changed
    const wantHide = !!document.getElementById('eosc-hide-empty')?.checked;
    if (wantHide !== (S.cfg.eos_hide_empty_topics || false)) {
      S.cfg.eos_hide_empty_topics = wantHide;
      autoSaveCfg();
      refreshEOSConfluenceTexts();
    }
    const markup = chosen.map(p => texts[p] || '').join('\n\n').trim();
    await copyTextWithFallback(markup, document.getElementById('eosc-copy-status'), 2500);
  });
}

function openWeeklyConfluencePicker() {
  const src = document.getElementById('w-copy-src');
  if (!src) { alert('Run the Weekly report first.'); return; }
  const projNames = {DX:'DataXplorer', LX:'LinkXplorer', RC:'Rollercoaster'};
  const available = [];
  src.querySelectorAll('h3').forEach(h3 => {
    const proj = Object.keys(projNames).find(k => projNames[k] === h3.textContent.trim());
    if (proj && !available.includes(proj)) available.push(proj);
  });
  if (!available.length) { alert('No project sections found. Run the Weekly report first.'); return; }
  openConfluencePicker({
    overlayId: 'wk-conf-picker',
    checkboxPrefix: 'wkc-',
    statusId: 'wkc-copy-status',
    copyBtnId: 'wkc-copy-btn',
    available,
    label: 'Choose which projects to include in the copied Confluence markup.',
    getMarkup: chosen => _buildWeeklyConfluenceMarkup(chosen, src, projNames),
  });
}

async function copyEOSConfluence(available) {
  // Legacy entry point kept for any direct callers — delegates to picker flow
  openEOSConfluencePicker();
}

async function copyWeeklyConfluence(available) {
  // Legacy entry point kept for any direct callers — delegates to picker flow
  openWeeklyConfluencePicker();
}

function tok(id){ return (id||'').replace(/\./g,'_'); }

function buildSprintVbaCode(){
  if(!S.allTickets.length){ alert('Load jira_issues_master.csv first.'); return; }
  const cal=S.cfg.sprint_calendar;
  const today=new Date().toISOString().slice(0,10);
  const cur=cal.find(s=>s.start<=today&&today<=s.end)||cal[cal.length-1];
  const curIdx=cal.indexOf(cur);
  const prev=curIdx>0?cal[curIdx-1]:null;
  const next=curIdx<cal.length-1?cal[curIdx+1]:null;
  if(!prev){ alert('Need at least 2 sprints in the sprint calendar.'); return; }
  const prevsprint=prev.sprint;
  const prevstart=prev.start;
  const prevend=prev.end;
  const cfg=S.cfg;
  const PROJS=['DX','LX','RC','AFX'];
  const excl=new Set(cfg.excluded_assignees.map(a=>a.toLowerCase()));
  const fmtD=s=>{ if(!s)return ''; const[y,m,d]=s.split('-'); return `${m}/${d}/${y}`; };
  const vbStr=s=>'"'+(s||'').replace(/"/g,'""')+'"';
  const curTix={}, prevTix={};
  S.allTickets.forEach(t=>{
    if(!PROJS.includes(t.project_bucket)) return;
    if(excl.has((t.assignee||'').toLowerCase())) return;
    if(sprintMatches(t,cur.sprint)) curTix[t.issue_key]=t;
    if(prev&&sprintMatches(t,prevsprint)) prevTix[t.issue_key]=t;
  });
  const pCount={Total:0},pPts={Total:0},cCount={Total:0},cPts={Total:0};
  PROJS.forEach(p=>{pCount[p]=0;pPts[p]=0;cCount[p]=0;cPts[p]=0;});
  Object.values(curTix).forEach(t=>{
    pCount[t.project_bucket]++;pPts[t.project_bucket]+=t.story_points;
    pCount.Total++;pPts.Total+=t.story_points;
  });
  Object.values(prevTix).forEach(t=>{
    const res=t.resolved_dt;
    if(res){const rd=res.toISOString().slice(0,10);
      if(rd>=prevstart&&rd<=prev.end){
        cCount[t.project_bucket]++;cPts[t.project_bucket]+=t.story_points;
        cCount.Total++;cPts.Total+=t.story_points;
      }
    }
  });
  const fmt=v=>v===Math.floor(v)?v:parseFloat(v.toFixed(1));
  const curStories=Object.values(curTix).sort((a,b)=>a.issue_key.localeCompare(b.issue_key))
    .map(t=>`Array(${vbStr(t.issue_key)}, ${vbStr(cfg.classification||'')}, ${vbStr(t.project_bucket)}, ${vbStr(t.epic_name||'')}, ${vbStr(t.summary)}, ${vbStr(String(t.story_points||0))})`);
  const prevStories=Object.values(prevTix).sort((a,b)=>a.issue_key.localeCompare(b.issue_key))
    .map(t=>`Array(${vbStr(t.issue_key)}, ${vbStr(cfg.classification||'')}, ${vbStr(t.project_bucket)}, ${vbStr(t.epic_name||'')}, ${vbStr(t.summary)}, ${vbStr(String(t.story_points||0))})`);
  const roles=cfg.roles||[];
  const navyBGR=6567199, lgrayBGR=14279124, whiteBGR=16777215;
  if(!next){
    alert('Warning: No next sprint found in the sprint calendar after ' + cur.sprint + '. Add the next sprint to Settings → Sprint Calendar for accurate VBA output. Using placeholder values.');
  }
  const nextSprint=next||{sprint:'(next sprint — update calendar)',start:'',end:''};
  const vba=`Attribute VB_Name = "SprintPackageMacros"
' ===============================================================
' SPRINT PACKAGE MACROS  Generated: ${new Date().toLocaleDateString()}
' Alt+F11 > Import File > select this .bas > Alt+F8 to run
' CreateSprintPlan  - creates Plan workbook for ${cur.sprint}
' EndOfSprint       - completes ${prevsprint} + creates ${cur.sprint} plan
' ===============================================================
Option Explicit
Private Const CLASSIFICATION As String = ${vbStr(cfg.classification||'')}
Private Const CLASS_HIGHEST  As String = ${vbStr(cfg.classification_highest||'')}
Private Const BT_DO_LINE     As String = ${vbStr(cfg.bt_do_line||'')}
Private Const REPORT_NUMBER  As String = ${vbStr(cfg.report_number||'')}
Private Const CONTRACT_NUMBER As String = ${vbStr(cfg.contract_number||'')}
Private Const CDRL_NUMBERS   As String = ${vbStr(cfg.cdrl_number||'')}
Private Const DID_NUMBERS    As String = ${vbStr(cfg.did_numbers||'')}
Private Const NUM_PLAN       As String = ${vbStr(cfg.num_plan||'')}
Private Const NUM_REPORT     As String = ${vbStr(cfg.num_report||'')}
Private Const NUM_STORIES    As String = ${vbStr(cfg.num_stories||'')}
Private Const NUM_INCIDENT   As String = ${vbStr(cfg.num_incident||'')}
Private Const PREP_FOR_NAME  As String = ${vbStr(cfg.prepared_for_name||'')}
Private Const PREP_FOR_ADDR1 As String = ${vbStr(cfg.prepared_for_addr1||'')}
Private Const PREP_FOR_CSZ   As String = ${vbStr(cfg.prepared_for_csz||'')}
Private Const PREP_BY_NAME   As String = ${vbStr(cfg.prepared_by_name||'')}
Private Const PREP_BY_ORG    As String = ${vbStr(cfg.prepared_by_org||'')}
Private Const PREP_BY_ADDR1  As String = ${vbStr(cfg.prepared_by_addr1||'')}
Private Const PREP_BY_CSZ    As String = ${vbStr(cfg.prepared_by_csz||'')}
Private Const STORY_NOTE     As String = "*Story points are the unit of measure for work completed in a sprint."
Private Const NAVY_COLOR     As Long = ${navyBGR}
Private Const LGRAY_COLOR    As Long = ${lgrayBGR}
Private Const WHITE_COLOR    As Long = ${whiteBGR}
Private Const FONT_NAME      As String = "Calibri"
Private Const FONT_SIZE      As Integer = 12
Private Const CUR_SPRINT     As String = ${vbStr(cur.sprint)}
Private Const CUR_START      As String = ${vbStr(fmtD(cur.start))}
Private Const CUR_END        As String = ${vbStr(fmtD(cur.end))}
Private Const PREV_SPRINT    As String = ${vbStr(prevsprint)}
Private Const PREV_START     As String = ${vbStr(fmtD(prevstart))}
Private Const PREV_END       As String = ${vbStr(fmtD(prevend))}
Private Const PLAN_TOT_STORIES As Integer = ${pCount.Total||0}
Private Const PLAN_DX_STORIES  As Integer = ${pCount.DX||0}
Private Const PLAN_LX_STORIES  As Integer = ${pCount.LX||0}
Private Const PLAN_RC_STORIES  As Integer = ${pCount.RC||0}
Private Const PLAN_AFX_STORIES As Integer = ${pCount.AFX||0}
Private Const PLAN_TOT_PTS     As Double  = ${fmt(pPts.Total||0)}
Private Const PLAN_DX_PTS      As Double  = ${fmt(pPts.DX||0)}
Private Const PLAN_LX_PTS      As Double  = ${fmt(pPts.LX||0)}
Private Const PLAN_RC_PTS      As Double  = ${fmt(pPts.RC||0)}
Private Const PLAN_AFX_PTS     As Double  = ${fmt(pPts.AFX||0)}
Private Const RPT_TOT_COMP     As Integer = ${cCount.Total||0}
Private Const RPT_DX_COMP      As Integer = ${cCount.DX||0}
Private Const RPT_LX_COMP      As Integer = ${cCount.LX||0}
Private Const RPT_RC_COMP      As Integer = ${cCount.RC||0}
Private Const RPT_AFX_COMP     As Integer = ${cCount.AFX||0}
Private Const RPT_TOT_COMP_PTS As Double  = ${fmt(cPts.Total||0)}
Private Const RPT_DX_COMP_PTS  As Double  = ${fmt(cPts.DX||0)}
Private Const RPT_LX_COMP_PTS  As Double  = ${fmt(cPts.LX||0)}
Private Const RPT_RC_COMP_PTS  As Double  = ${fmt(cPts.RC||0)}
Private Const RPT_AFX_COMP_PTS As Double  = ${fmt(cPts.AFX||0)}

Private Sub StyleBanner(ws As Worksheet, r As Long, text As String)
    ws.Cells(r,1).Value=text: ws.Cells(r,1).Font.Name=FONT_NAME: ws.Cells(r,1).Font.Size=FONT_SIZE
    ws.Cells(r,1).Font.Bold=True: ws.Cells(r,1).Font.Color=WHITE_COLOR
    ws.Cells(r,1).Interior.Color=NAVY_COLOR: ws.Cells(r,1).HorizontalAlignment=xlCenter
    ws.Rows(r).RowHeight=18
End Sub
Private Sub StylePM(ws As Worksheet, r As Long, text As String, alignRight As Boolean)
    ws.Cells(r,1).Value=text: ws.Cells(r,1).Font.Name=FONT_NAME: ws.Cells(r,1).Font.Size=FONT_SIZE
    ws.Cells(r,1).Font.Bold=True: ws.Rows(r).RowHeight=16
    If alignRight Then ws.Cells(r,1).HorizontalAlignment=xlRight Else ws.Cells(r,1).HorizontalAlignment=xlLeft
End Sub
Private Sub StyleTitle(ws As Worksheet, r As Long, text As String)
    ws.Cells(r,1).Value=text: ws.Cells(r,1).Font.Name=FONT_NAME: ws.Cells(r,1).Font.Size=14
    ws.Cells(r,1).Font.Bold=True: ws.Cells(r,1).Font.Color=WHITE_COLOR
    ws.Cells(r,1).Interior.Color=NAVY_COLOR: ws.Cells(r,1).HorizontalAlignment=xlCenter: ws.Rows(r).RowHeight=28
End Sub
Private Sub StyleMetaLabel(ws As Worksheet, r As Long, label As String, val As String, shaded As Boolean)
    ws.Cells(r,1).Value=label: ws.Cells(r,1).Font.Bold=True: ws.Cells(r,1).Font.Color=WHITE_COLOR
    ws.Cells(r,1).Interior.Color=NAVY_COLOR: ws.Cells(r,1).HorizontalAlignment=xlLeft
    ws.Cells(r,2).Value=val: ws.Cells(r,2).Font.Name=FONT_NAME: ws.Cells(r,2).Font.Size=FONT_SIZE
    If shaded Then ws.Cells(r,2).Interior.Color=LGRAY_COLOR: ws.Rows(r).RowHeight=18
End Sub
Private Sub StyleTableHeader(ws As Worksheet, r As Long, headers() As String)
    Dim i As Integer
    For i=0 To UBound(headers)
        ws.Cells(r,i+1).Value=headers(i): ws.Cells(r,i+1).Font.Bold=True
        ws.Cells(r,i+1).Font.Color=WHITE_COLOR: ws.Cells(r,i+1).Interior.Color=NAVY_COLOR
        ws.Cells(r,i+1).Font.Name=FONT_NAME: ws.Cells(r,i+1).Font.Size=FONT_SIZE
    Next i: ws.Rows(r).RowHeight=20
End Sub
Private Sub MergeFull(ws As Worksheet, r As Long, nCols As Integer)
    ws.Range(ws.Cells(r,1),ws.Cells(r,nCols)).Merge
End Sub
Private Sub SetDefaultFont(ws As Worksheet)
    ws.Cells.Font.Name=FONT_NAME: ws.Cells.Font.Size=FONT_SIZE
End Sub
Private Function CreateWorkbookShell() As Workbook
    Dim wb As Workbook: Set wb=Workbooks.Add
    Dim names(6) As String
    names(0)="Cover Sheet": names(1)="Information": names(2)="Sprint Plan"
    names(3)="Sprint Report": names(4)="User Stories": names(5)="Initial Incident": names(6)="Final Incident"
    Do While wb.Sheets.Count<7: wb.Sheets.Add After:=wb.Sheets(wb.Sheets.Count): Loop
    Do While wb.Sheets.Count>7: Application.DisplayAlerts=False: wb.Sheets(wb.Sheets.Count).Delete: Application.DisplayAlerts=True: Loop
    Dim i As Integer: For i=0 To 6: wb.Sheets(i+1).Name=names(i): Next i
    Set CreateWorkbookShell=wb
End Function
Private Sub WriteMetaBlock(ws As Worksheet, r As Long, title As String, num As String, spNum As String, sd As String, ed As String, rType As String, nCols As Integer)
    MergeFull ws,r,nCols: StyleTitle ws,r,title: r=r+1
    ws.Range(ws.Cells(r,1),ws.Cells(r,2)).Merge
    ws.Cells(r,1).Value="Number": ws.Cells(r,1).Font.Bold=True: ws.Cells(r,1).Font.Color=WHITE_COLOR: ws.Cells(r,1).Interior.Color=NAVY_COLOR
    ws.Range(ws.Cells(r,3),ws.Cells(r,nCols)).Merge: ws.Cells(r,3).Value=num: ws.Rows(r).RowHeight=18: r=r+1
    MergeFull ws,r,nCols: ws.Rows(r).RowHeight=6: r=r+1
    StyleMetaLabel ws,r,"Sprint Number",spNum,False: ws.Range(ws.Cells(r,2),ws.Cells(r,nCols)).Merge: r=r+1
    StyleMetaLabel ws,r,"Start Date",sd,True: ws.Range(ws.Cells(r,2),ws.Cells(r,nCols)).Merge: r=r+1
    StyleMetaLabel ws,r,"End Date",ed,False: ws.Range(ws.Cells(r,2),ws.Cells(r,nCols)).Merge: r=r+1
    StyleMetaLabel ws,r,"Report Type",rType,True: ws.Range(ws.Cells(r,2),ws.Cells(r,nCols)).Merge
End Sub
Private Sub WriteUserStories(ws As Worksheet, stories As Variant, r As Long, nCols As Integer)
    Dim hdrs(5) As String: hdrs(0)="ID": hdrs(1)="Classification": hdrs(2)="Project": hdrs(3)="Epic": hdrs(4)="Story Title": hdrs(5)="Story Points*"
    StyleTableHeader ws,r,hdrs: r=r+1
    Dim i As Integer, j As Integer
    For i=0 To UBound(stories)
        For j=0 To 5
            ws.Cells(r,j+1).Value=stories(i)(j): ws.Cells(r,j+1).Font.Name=FONT_NAME: ws.Cells(r,j+1).Font.Size=FONT_SIZE
            ws.Cells(r,j+1).Borders.LineStyle=xlContinuous
            If i Mod 2=1 Then ws.Cells(r,j+1).Interior.Color=LGRAY_COLOR
        Next j: ws.Rows(r).RowHeight=18: r=r+1
    Next i
    ws.Cells(r,1).Value=STORY_NOTE: ws.Cells(r,1).Font.Italic=True: ws.Cells(r,1).Font.Size=10
    ws.Range(ws.Cells(r,1),ws.Cells(r,nCols)).Merge
End Sub
Private Sub WriteIncidentTab(ws As Worksheet, spNum As String, sd As String, ed As String, rType As String, num As String, isFinal As Boolean)
    Dim nCols As Integer: nCols=IIf(isFinal,9,8)
    ws.Cells.Clear: SetDefaultFont ws: Dim r As Long: r=1
    MergeFull ws,r,nCols: StyleBanner ws,r,CLASS_HIGHEST: r=r+1
    MergeFull ws,r,nCols: StylePM ws,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws,r,"Agile Acquisition Incident Report",num,spNum,sd,ed,rType,nCols
    r=r+8
    Dim hdrs() As String: If isFinal Then ReDim hdrs(8) Else ReDim hdrs(7)
    hdrs(0)="Incident ID": hdrs(1)="Classification": hdrs(2)="Project": hdrs(3)="Description"
    hdrs(4)="Impacted Story ID": hdrs(5)="Impacted Stories": hdrs(6)="Impacted Points*": hdrs(7)="Projected Duration"
    If isFinal Then hdrs(8)="Disposition"
    StyleTableHeader ws,r,hdrs: r=r+1
    Dim i As Integer, j As Integer
    For i=0 To 2
        For j=0 To UBound(hdrs)
            ws.Cells(r,j+1).Borders.LineStyle=xlContinuous
            If i Mod 2=1 Then ws.Cells(r,j+1).Interior.Color=LGRAY_COLOR
        Next j: ws.Rows(r).RowHeight=18: r=r+1
    Next i
    ws.Cells(r,1).Value=STORY_NOTE: ws.Cells(r,1).Font.Italic=True: ws.Cells(r,1).Font.Size=10
    ws.Range(ws.Cells(r,1),ws.Cells(r,nCols)).Merge: r=r+2
    MergeFull ws,r,nCols: StylePM ws,r,CLASSIFICATION,True: r=r+1
    MergeFull ws,r,nCols: StyleBanner ws,r,CLASS_HIGHEST
End Sub

Sub CreateSprintPlan()
    Dim savePath As String
    savePath=Application.GetSaveAsFilename(InitialFileName:="Sprint_${tok(cur.sprint)}_Plan.xlsx", _
        FileFilter:="Excel Workbook (*.xlsx),*.xlsx",Title:="Save Sprint Plan Workbook")
    If savePath="False" Then Exit Sub
    Dim wb As Workbook: Set wb=CreateWorkbookShell()
    Dim r As Long: Dim nCols As Integer: nCols=7
    ' Cover Sheet
    Dim wsCover As Worksheet: Set wsCover=wb.Worksheets("Cover Sheet")
    wsCover.Cells.Clear: SetDefaultFont wsCover: r=1
    MergeFull wsCover,r,nCols: StyleBanner wsCover,r,CLASS_HIGHEST: r=r+1
    MergeFull wsCover,r,nCols: StylePM wsCover,r,CLASSIFICATION,False: r=r+1
    MergeFull wsCover,r,nCols: StyleTitle wsCover,r,"Agile Acquisition Sprint Comprehensive Plan": r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value=BT_DO_LINE: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value="Sprint " & CUR_SPRINT: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value="": r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value="DID Numbers: " & DID_NUMBERS: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value="Report Number: " & REPORT_NUMBER: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value="Contract Number: " & CONTRACT_NUMBER: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value="CDRL Numbers: " & CDRL_NUMBERS: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value="Prepared For:": wsCover.Cells(r,1).Interior.Color=NAVY_COLOR: wsCover.Cells(r,1).Font.Color=WHITE_COLOR: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value=PREP_FOR_NAME: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value=PREP_FOR_ADDR1: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value=PREP_FOR_CSZ: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value="Prepared By:": wsCover.Cells(r,1).Interior.Color=NAVY_COLOR: wsCover.Cells(r,1).Font.Color=WHITE_COLOR: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value=PREP_BY_NAME: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value=PREP_BY_ORG: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value=PREP_BY_ADDR1: r=r+1
    MergeFull wsCover,r,nCols: wsCover.Cells(r,1).Value=PREP_BY_CSZ: r=r+1
    MergeFull wsCover,r,nCols: StylePM wsCover,r,CLASSIFICATION,True: r=r+1
    MergeFull wsCover,r,nCols: StyleBanner wsCover,r,CLASS_HIGHEST
    wsCover.Columns("A:G").ColumnWidth=20: wsCover.Columns("A").ColumnWidth=30
    ' Sprint Plan Tab
    Dim ws3 As Worksheet: Set ws3=wb.Worksheets("Sprint Plan")
    ws3.Cells.Clear: SetDefaultFont ws3: r=1
    MergeFull ws3,r,nCols: StyleBanner ws3,r,CLASS_HIGHEST: r=r+1
    MergeFull ws3,r,nCols: StylePM ws3,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws3,r,"Agile Acquisition Sprint Plan",NUM_PLAN,CUR_SPRINT,CUR_START,CUR_END,"Agile Sprint Plan",nCols
    r=r+8: r=r+1
    Dim hdrs3(2) As String: hdrs3(0)="Role": hdrs3(1)="Name": hdrs3(2)="ID"
    StyleTableHeader ws3,r,hdrs3: r=r+1
${roles.map((ro,i)=>`    ws3.Cells(r,1).Value=${vbStr((ro.role||'')+':')}
    ws3.Cells(r,2).Value=${vbStr(ro.name||'')}
    ws3.Cells(r,3).Value=${vbStr(ro.id||'')}
    ws3.Rows(r).RowHeight=18${i%2===1?': ws3.Rows(r).Interior.Color=LGRAY_COLOR':''}
    r=r+1`).join('\n')}
    ' Metrics
    Dim mHdrs(5) As String: mHdrs(0)="": mHdrs(1)="Total": mHdrs(2)="DX": mHdrs(3)="RC": mHdrs(4)="LX": mHdrs(5)="AFX"
    StyleTableHeader ws3,r,mHdrs: r=r+1
    ws3.Cells(r,1).Value="Planned Stories:": ws3.Cells(r,2).Value=PLAN_TOT_STORIES: ws3.Cells(r,3).Value=PLAN_DX_STORIES: ws3.Cells(r,4).Value=PLAN_RC_STORIES: ws3.Cells(r,5).Value=PLAN_LX_STORIES: ws3.Cells(r,6).Value=PLAN_AFX_STORIES: r=r+1
    ws3.Cells(r,1).Value="Planned Points*:": ws3.Cells(r,2).Value=PLAN_TOT_PTS: ws3.Cells(r,3).Value=PLAN_DX_PTS: ws3.Cells(r,4).Value=PLAN_RC_PTS: ws3.Cells(r,5).Value=PLAN_LX_PTS: ws3.Cells(r,6).Value=PLAN_AFX_PTS: r=r+1
    ws3.Cells(r,1).Value=STORY_NOTE: ws3.Cells(r,1).Font.Italic=True: ws3.Cells(r,1).Font.Size=10: ws3.Range(ws3.Cells(r,1),ws3.Cells(r,6)).Merge: r=r+2
    MergeFull ws3,r,nCols: StylePM ws3,r,CLASSIFICATION,True: r=r+1
    MergeFull ws3,r,nCols: StyleBanner ws3,r,CLASS_HIGHEST
    ws3.Columns("A").ColumnWidth=28: ws3.Columns("B:F").ColumnWidth=12
    ' Empty Sprint Report tab
    Dim ws4 As Worksheet: Set ws4=wb.Worksheets("Sprint Report")
    ws4.Cells.Clear: SetDefaultFont ws4: r=1
    MergeFull ws4,r,nCols: StyleBanner ws4,r,CLASS_HIGHEST: r=r+1
    MergeFull ws4,r,nCols: StylePM ws4,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws4,r,"Agile Acquisition Sprint Report",NUM_REPORT,CUR_SPRINT,CUR_START,CUR_END,"Agile Sprint Report",nCols
    r=r+9: MergeFull ws4,r,nCols: StylePM ws4,r,CLASSIFICATION,True: r=r+1
    MergeFull ws4,r,nCols: StyleBanner ws4,r,CLASS_HIGHEST
    ws4.Columns("A").ColumnWidth=28: ws4.Columns("B:F").ColumnWidth=12
    ' User Stories tab (empty)
    Dim ws5 As Worksheet: Set ws5=wb.Worksheets("User Stories")
    ws5.Cells.Clear: SetDefaultFont ws5: r=1
    MergeFull ws5,r,6: StyleBanner ws5,r,CLASS_HIGHEST: r=r+1
    MergeFull ws5,r,6: StylePM ws5,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws5,r,"Agile Acquisition User Stories",NUM_STORIES,CUR_SPRINT,CUR_START,CUR_END,"User Stories",6
    r=r+9: r=r+1
    Dim emptyS(0) As Variant: emptyS(0)=Array("","","","","","")
    WriteUserStories ws5,emptyS,r,6: r=r+3
    MergeFull ws5,r,6: StylePM ws5,r,CLASSIFICATION,True: r=r+1
    MergeFull ws5,r,6: StyleBanner ws5,r,CLASS_HIGHEST
    ws5.Columns("A").ColumnWidth=14: ws5.Columns("B").ColumnWidth=14: ws5.Columns("C").ColumnWidth=10
    ws5.Columns("D").ColumnWidth=30: ws5.Columns("E").ColumnWidth=40: ws5.Columns("F").ColumnWidth=12
    WriteIncidentTab wb.Worksheets("Initial Incident"),CUR_SPRINT,CUR_START,CUR_END,"Initial Incident Report",NUM_INCIDENT,False
    WriteIncidentTab wb.Worksheets("Final Incident"),CUR_SPRINT,CUR_START,CUR_END,"Final Incident Report",NUM_INCIDENT,True
    Application.DisplayAlerts=False
    wb.SaveAs Filename:=savePath, FileFormat:=xlOpenXMLWorkbook
    Application.DisplayAlerts=True
    MsgBox "Sprint Plan created: " & savePath,vbInformation,"Done"
End Sub

Sub EndOfSprint()
    Dim prevFile As String
    prevFile=Application.GetOpenFilename(FileFilter:="Excel Workbook (*.xlsx),*.xlsx", _
        Title:="Locate Sprint_${tok(prevsprint)}_Plan.xlsx")
    If prevFile="False" Then Exit Sub
    Dim wbPrev As Workbook: Set wbPrev=Workbooks.Open(prevFile)
    Dim nCols As Integer: nCols=7: Dim r As Long
    ' Fill Sprint Report tab
    Dim ws4 As Worksheet: Set ws4=wbPrev.Worksheets("Sprint Report")
    ws4.Cells.Clear: SetDefaultFont ws4: r=1
    MergeFull ws4,r,nCols: StyleBanner ws4,r,CLASS_HIGHEST: r=r+1
    MergeFull ws4,r,nCols: StylePM ws4,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws4,r,"Agile Acquisition Sprint Report",NUM_REPORT,PREV_SPRINT,PREV_START,PREV_END,"Agile Sprint Report",nCols
    r=r+9
    Dim mHdrs(5) As String: mHdrs(0)="": mHdrs(1)="Total": mHdrs(2)="DX": mHdrs(3)="RC": mHdrs(4)="LX": mHdrs(5)="AFX"
    StyleTableHeader ws4,r,mHdrs: r=r+1
    ws4.Cells(r,1).Value="Planned Stories:": ws4.Cells(r,2).Value=PLAN_TOT_STORIES: ws4.Cells(r,3).Value=PLAN_DX_STORIES: ws4.Cells(r,4).Value=PLAN_RC_STORIES: ws4.Cells(r,5).Value=PLAN_LX_STORIES: ws4.Cells(r,6).Value=PLAN_AFX_STORIES: r=r+1
    ws4.Cells(r,1).Value="Planned Points*:": ws4.Cells(r,2).Value=PLAN_TOT_PTS: ws4.Cells(r,3).Value=PLAN_DX_PTS: ws4.Cells(r,4).Value=PLAN_RC_PTS: ws4.Cells(r,5).Value=PLAN_LX_PTS: ws4.Cells(r,6).Value=PLAN_AFX_PTS: r=r+1
    ws4.Cells(r,1).Value="Completed Stories:": ws4.Cells(r,2).Value=RPT_TOT_COMP: ws4.Cells(r,3).Value=RPT_DX_COMP: ws4.Cells(r,4).Value=RPT_RC_COMP: ws4.Cells(r,5).Value=RPT_LX_COMP: ws4.Cells(r,6).Value=RPT_AFX_COMP: r=r+1
    ws4.Cells(r,1).Value="Completed Points*:": ws4.Cells(r,2).Value=RPT_TOT_COMP_PTS: ws4.Cells(r,3).Value=RPT_DX_COMP_PTS: ws4.Cells(r,4).Value=RPT_RC_COMP_PTS: ws4.Cells(r,5).Value=RPT_LX_COMP_PTS: ws4.Cells(r,6).Value=RPT_AFX_COMP_PTS: r=r+1
    ws4.Cells(r,1).Value=STORY_NOTE: ws4.Cells(r,1).Font.Italic=True: ws4.Cells(r,1).Font.Size=10: ws4.Range(ws4.Cells(r,1),ws4.Cells(r,6)).Merge: r=r+2
    MergeFull ws4,r,nCols: StylePM ws4,r,CLASSIFICATION,True: r=r+1
    MergeFull ws4,r,nCols: StyleBanner ws4,r,CLASS_HIGHEST
    ws4.Columns("A").ColumnWidth=28: ws4.Columns("B:F").ColumnWidth=12
    ' Fill User Stories tab
    Dim ws5 As Worksheet: Set ws5=wbPrev.Worksheets("User Stories")
    ws5.Cells.Clear: SetDefaultFont ws5: r=1
    MergeFull ws5,r,6: StyleBanner ws5,r,CLASS_HIGHEST: r=r+1
    MergeFull ws5,r,6: StylePM ws5,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws5,r,"Agile Acquisition User Stories",NUM_STORIES,PREV_SPRINT,PREV_START,PREV_END,"User Stories",6
    r=r+9: r=r+1
    Dim prevStories(${Math.max(0,prevStories.length-1)}) As Variant
${prevStories.length>0 ? prevStories.map((s,i)=>`    prevStories(${i})=${s}`).join('\n') : '    prevStories(0)=Array("","","","","","")'}
    WriteUserStories ws5,prevStories,r,6: r=r+${prevStories.length+2}
    MergeFull ws5,r,6: StylePM ws5,r,CLASSIFICATION,True: r=r+1
    MergeFull ws5,r,6: StyleBanner ws5,r,CLASS_HIGHEST
    ws5.Columns("A").ColumnWidth=14: ws5.Columns("B").ColumnWidth=14: ws5.Columns("C").ColumnWidth=10
    ws5.Columns("D").ColumnWidth=30: ws5.Columns("E").ColumnWidth=40: ws5.Columns("F").ColumnWidth=12
    wbPrev.Save: MsgBox "Sprint " & PREV_SPRINT & " report completed.",vbInformation,"Step 1 Done"
    ' Create new Plan
    Dim savePath As String
    savePath=Application.GetSaveAsFilename(InitialFileName:="Sprint_${tok(cur.sprint)}_Plan.xlsx", _
        FileFilter:="Excel Workbook (*.xlsx),*.xlsx",Title:="Save Sprint ${cur.sprint} Plan")
    If savePath="False" Then MsgBox "Skipped new Plan.",vbInformation: Exit Sub
    Dim wbNew As Workbook: Set wbNew=CreateWorkbookShell()
    r=1
    Dim wsC As Worksheet: Set wsC=wbNew.Worksheets("Cover Sheet")
    wsC.Cells.Clear: SetDefaultFont wsC
    MergeFull wsC,r,7: StyleBanner wsC,r,CLASS_HIGHEST: r=r+1
    MergeFull wsC,r,7: StylePM wsC,r,CLASSIFICATION,False: r=r+1
    MergeFull wsC,r,7: StyleTitle wsC,r,"Agile Acquisition Sprint Comprehensive Plan": r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value=BT_DO_LINE: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value="Sprint " & CUR_SPRINT: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value="": r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value="DID Numbers: " & DID_NUMBERS: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value="Report Number: " & REPORT_NUMBER: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value="Contract Number: " & CONTRACT_NUMBER: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value="CDRL Numbers: " & CDRL_NUMBERS: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value="Prepared For:": wsC.Cells(r,1).Interior.Color=NAVY_COLOR: wsC.Cells(r,1).Font.Color=WHITE_COLOR: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value=PREP_FOR_NAME: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value=PREP_FOR_ADDR1: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value=PREP_FOR_CSZ: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value="Prepared By:": wsC.Cells(r,1).Interior.Color=NAVY_COLOR: wsC.Cells(r,1).Font.Color=WHITE_COLOR: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value=PREP_BY_NAME: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value=PREP_BY_ORG: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value=PREP_BY_ADDR1: r=r+1
    MergeFull wsC,r,7: wsC.Cells(r,1).Value=PREP_BY_CSZ: r=r+1
    MergeFull wsC,r,7: StylePM wsC,r,CLASSIFICATION,True: r=r+1
    MergeFull wsC,r,7: StyleBanner wsC,r,CLASS_HIGHEST
    wsC.Columns("A:G").ColumnWidth=20: wsC.Columns("A").ColumnWidth=30
    Dim ws3n As Worksheet: Set ws3n=wbNew.Worksheets("Sprint Plan")
    ws3n.Cells.Clear: SetDefaultFont ws3n: r=1
    MergeFull ws3n,r,7: StyleBanner ws3n,r,CLASS_HIGHEST: r=r+1
    MergeFull ws3n,r,7: StylePM ws3n,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws3n,r,"Agile Acquisition Sprint Plan",NUM_PLAN,CUR_SPRINT,CUR_START,CUR_END,"Agile Sprint Plan",7
    r=r+8: r=r+1
    StyleTableHeader ws3n,r,Array("Role","Name","ID"): r=r+1
${roles.map((ro,i)=>`    ws3n.Cells(r,1).Value=${vbStr((ro.role||'')+':')}
    ws3n.Cells(r,2).Value=${vbStr(ro.name||'')}
    ws3n.Cells(r,3).Value=${vbStr(ro.id||'')}
    ws3n.Rows(r).RowHeight=18: r=r+1`).join('\n')}
    StyleTableHeader ws3n,r,Array("","Total","DX","RC","LX","AFX"): r=r+1
    ws3n.Cells(r,1).Value="Planned Stories:": ws3n.Cells(r,2).Value=PLAN_TOT_STORIES: ws3n.Cells(r,3).Value=PLAN_DX_STORIES: ws3n.Cells(r,4).Value=PLAN_RC_STORIES: ws3n.Cells(r,5).Value=PLAN_LX_STORIES: ws3n.Cells(r,6).Value=PLAN_AFX_STORIES: r=r+1
    ws3n.Cells(r,1).Value="Planned Points*:": ws3n.Cells(r,2).Value=PLAN_TOT_PTS: ws3n.Cells(r,3).Value=PLAN_DX_PTS: ws3n.Cells(r,4).Value=PLAN_RC_PTS: ws3n.Cells(r,5).Value=PLAN_LX_PTS: ws3n.Cells(r,6).Value=PLAN_AFX_PTS: r=r+1
    ws3n.Cells(r,1).Value=STORY_NOTE: ws3n.Cells(r,1).Font.Italic=True: ws3n.Cells(r,1).Font.Size=10: ws3n.Range(ws3n.Cells(r,1),ws3n.Cells(r,6)).Merge: r=r+2
    MergeFull ws3n,r,7: StylePM ws3n,r,CLASSIFICATION,True: r=r+1
    MergeFull ws3n,r,7: StyleBanner ws3n,r,CLASS_HIGHEST
    ws3n.Columns("A").ColumnWidth=28: ws3n.Columns("B:F").ColumnWidth=12
    Dim ws4n As Worksheet: Set ws4n=wbNew.Worksheets("Sprint Report")
    ws4n.Cells.Clear: SetDefaultFont ws4n: r=1
    MergeFull ws4n,r,7: StyleBanner ws4n,r,CLASS_HIGHEST: r=r+1
    MergeFull ws4n,r,7: StylePM ws4n,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws4n,r,"Agile Acquisition Sprint Report",NUM_REPORT,CUR_SPRINT,CUR_START,CUR_END,"Agile Sprint Report",7
    r=r+9: MergeFull ws4n,r,7: StylePM ws4n,r,CLASSIFICATION,True: r=r+1
    MergeFull ws4n,r,7: StyleBanner ws4n,r,CLASS_HIGHEST
    ws4n.Columns("A").ColumnWidth=28: ws4n.Columns("B:F").ColumnWidth=12
    Dim ws5n As Worksheet: Set ws5n=wbNew.Worksheets("User Stories")
    ws5n.Cells.Clear: SetDefaultFont ws5n: r=1
    MergeFull ws5n,r,6: StyleBanner ws5n,r,CLASS_HIGHEST: r=r+1
    MergeFull ws5n,r,6: StylePM ws5n,r,CLASSIFICATION,False: r=r+1
    WriteMetaBlock ws5n,r,"Agile Acquisition User Stories",NUM_STORIES,CUR_SPRINT,CUR_START,CUR_END,"User Stories",6
    r=r+9: r=r+1
    Dim curStories(${Math.max(0,curStories.length-1)}) As Variant
${curStories.length>0 ? curStories.map((s,i)=>`    curStories(${i})=${s}`).join('\n') : '    curStories(0)=Array("","","","","","")'}
    WriteUserStories ws5n,curStories,r,6: r=r+${curStories.length+2}
    MergeFull ws5n,r,6: StylePM ws5n,r,CLASSIFICATION,True: r=r+1
    MergeFull ws5n,r,6: StyleBanner ws5n,r,CLASS_HIGHEST
    ws5n.Columns("A").ColumnWidth=14: ws5n.Columns("B").ColumnWidth=14: ws5n.Columns("C").ColumnWidth=10
    ws5n.Columns("D").ColumnWidth=30: ws5n.Columns("E").ColumnWidth=40: ws5n.Columns("F").ColumnWidth=12
    WriteIncidentTab wbNew.Worksheets("Initial Incident"),CUR_SPRINT,CUR_START,CUR_END,"Initial Incident Report",NUM_INCIDENT,False
    WriteIncidentTab wbNew.Worksheets("Final Incident"),CUR_SPRINT,CUR_START,CUR_END,"Final Incident Report",NUM_INCIDENT,True
    Application.DisplayAlerts=False
    wbNew.SaveAs Filename:=savePath,FileFormat:=xlOpenXMLWorkbook
    Application.DisplayAlerts=True
    MsgBox "Sprint " & CUR_SPRINT & " Plan created: " & savePath,vbInformation,"All Done"
End Sub
`;
  return { vba, sprint: cur.sprint };
}

function downloadSprintVBA(){
  const result = buildSprintVbaCode();
  if(!result) return;
  const {vba, sprint} = result;
  S._lastVba = result;
  const a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(vba);
  a.download=`SprintMacros_${APP_VERSION}_${tok(sprint)}_${dtg()}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function copySprintVBA(){
  const result = buildSprintVbaCode();
  if(!result) return;
  S._lastVba = result;
  await copyTextWithFallback(result.vba, document.getElementById('vba-copy-cst'), 2500);
}

