// ============================================================
// SPRINT XLSX DOWNLOAD (browser-native via xlsx-js-style)
// ============================================================
function downloadSprintXlsx(mode) {
  // mode = 'plan' (CreateSprintPlan) or 'eos' (EndOfSprint)
  if(!S.allTickets.length){ alert('Load jira_issues_master.csv first.'); return; }
  const cal=S.cfg.sprint_calendar;
  const today=new Date().toISOString().slice(0,10);
  const cur=cal.find(s=>s.start<=today&&today<=s.end)||cal[cal.length-1];
  const curIdx=cal.indexOf(cur);
  const prev=curIdx>0?cal[curIdx-1]:null;
  if(!prev){ alert('Need at least 2 sprints in the sprint calendar.'); return; }
  const cfg=S.cfg;
  const PROJS=['DX','LX','RC','AFX'];
  const excl=new Set(cfg.excluded_assignees.map(a=>a.toLowerCase()));
  const fmtD=s=>{ if(!s)return ''; const[y,m,d]=s.split('-'); return `${m}/${d}/${y}`; };

  const curTix={}, prevTix={};
  S.allTickets.forEach(t=>{
    if(!PROJS.includes(t.project_bucket)) return;
    if(excl.has((t.assignee||'').toLowerCase())) return;
    if(sprintMatches(t,cur.sprint)) curTix[t.issue_key]=t;
    if(prev&&sprintMatches(t,prev.sprint)) prevTix[t.issue_key]=t;
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
      if(rd>=prev.start&&rd<=prev.end){
        cCount[t.project_bucket]++;cPts[t.project_bucket]+=t.story_points;
        cCount.Total++;cPts.Total+=t.story_points;
      }
    }
  });
  const fmt=v=>v===Math.floor(v)?v:parseFloat(v.toFixed(1));
  const curStories=Object.values(curTix).sort((a,b)=>a.issue_key.localeCompare(b.issue_key));
  const prevStories=Object.values(prevTix).sort((a,b)=>a.issue_key.localeCompare(b.issue_key));
  const roles=cfg.roles||[];

  // ── Config constants ───────────────────────────────────────
  const CLASSIFICATION = cfg.classification||'';
  const CLASS_HIGHEST  = cfg.classification_highest||'';
  const BT_DO_LINE     = cfg.bt_do_line||'';
  const REPORT_NUMBER  = cfg.report_number||'';
  const CONTRACT_NUMBER= cfg.contract_number||'';
  const CDRL_NUMBERS   = cfg.cdrl_number||'';
  const DID_NUMBERS    = cfg.did_numbers||'';
  const NUM_PLAN       = cfg.num_plan||'';
  const NUM_REPORT     = cfg.num_report||'';
  const NUM_STORIES    = cfg.num_stories||'';
  const NUM_INCIDENT   = cfg.num_incident||'';
  const PREP_FOR_NAME  = cfg.prepared_for_name||'';
  const PREP_FOR_ADDR1 = cfg.prepared_for_addr1||'';
  const PREP_FOR_CSZ   = cfg.prepared_for_csz||'';
  const PREP_BY_NAME   = cfg.prepared_by_name||'';
  const PREP_BY_ORG    = cfg.prepared_by_org||'';
  const PREP_BY_ADDR1  = cfg.prepared_by_addr1||'';
  const PREP_BY_CSZ    = cfg.prepared_by_csz||'';
  const STORY_NOTE     = '*Story points are the unit of measure for work completed in a sprint.';
  const CUR_SPRINT     = cur.sprint;
  const CUR_START      = fmtD(cur.start);
  const CUR_END        = fmtD(cur.end);
  const PREV_SPRINT    = prev.sprint;
  const PREV_START     = fmtD(prev.start);
  const PREV_END       = fmtD(prev.end);

  // ── Style helpers ──────────────────────────────────────────
  function xlNavy()      { return { font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:12}, fill:{fgColor:{rgb:'1F3564'}}, alignment:{horizontal:'center'} }; }
  function xlNavyLeft()  { return { font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:12}, fill:{fgColor:{rgb:'1F3564'}}, alignment:{horizontal:'left'} }; }
  function xlNavyRight() { return { font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:12}, fill:{fgColor:{rgb:'1F3564'}}, alignment:{horizontal:'right'} }; }
  function xlNavyTitle() { return { font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:14}, fill:{fgColor:{rgb:'1F3564'}}, alignment:{horizontal:'center'} }; }
  function xlMeta(shade) { return { font:{name:'Calibri',sz:12}, fill: shade ? {fgColor:{rgb:'D4E1D9'}} : {fgColor:{rgb:'FFFFFF'}} }; }
  function xlMetaLabel() { return { font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:12}, fill:{fgColor:{rgb:'1F3564'}}, alignment:{horizontal:'left'} }; }
  function xlDataCell(shade) { return { font:{name:'Calibri',sz:12}, fill: shade ? {fgColor:{rgb:'D4E1D9'}} : {fgColor:{rgb:'FFFFFF'}}, border:{top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}} }; }
  function xlNote()      { return { font:{italic:true,name:'Calibri',sz:10} }; }
  function xlBoldLeft()  { return { font:{bold:true,name:'Calibri',sz:12}, alignment:{horizontal:'left'} }; }
  function xlBoldRight() { return { font:{bold:true,name:'Calibri',sz:12}, alignment:{horizontal:'right'} }; }
  function xlTableHdr()  { return { font:{bold:true,color:{rgb:'FFFFFF'},name:'Calibri',sz:12}, fill:{fgColor:{rgb:'1F3564'}} }; }

  // ── Worksheet builder ──────────────────────────────────────
  // Returns {ws, rowData, merges} where ws is populated, rowData is array of row heights
  function makeWs() {
    return { data:{}, merges:[], rows:[], cols:[] };
  }
  function setCell(ws, r, c, v, s) {
    const addr = XLSX.utils.encode_cell({r,c});
    ws.data[addr] = { v: v===undefined||v===null?'':v, t: typeof v==='number'?'n':'s', s: s||{} };
  }
  function mergeFull(ws, r, nCols) {
    ws.merges.push({s:{r,c:0},e:{r,c:nCols-1}});
  }
  function mergeRange(ws, r, c1, c2) {
    ws.merges.push({s:{r,c:c1},e:{r,c:c2}});
  }
  function setRowH(ws, r, hpt) {
    while(ws.rows.length<=r) ws.rows.push({});
    ws.rows[r]={hpt};
  }

  // Banner row (row r, 0-indexed), returns r+1
  function writeBanner(ws, r, nCols) {
    mergeFull(ws,r,nCols);
    setCell(ws,r,0,CLASS_HIGHEST,xlNavy());
    setRowH(ws,r,24);
    return r+1;
  }
  // Classification row
  function writeClassLeft(ws, r, nCols) {
    mergeFull(ws,r,nCols);
    setCell(ws,r,0,CLASSIFICATION,xlBoldLeft());
    setRowH(ws,r,21);
    return r+1;
  }
  function writeClassRight(ws, r, nCols) {
    mergeFull(ws,r,nCols);
    setCell(ws,r,0,CLASSIFICATION,xlBoldRight());
    setRowH(ws,r,21);
    return r+1;
  }

  // WriteMetaBlock: 8 rows (title, number, spacer, sprint#, start, end, type)
  // Returns r+8
  function writeMetaBlock(ws, r, title, num, spNum, sd, ed, rType, nCols) {
    // Row 1: title (merged full, navy title)
    mergeFull(ws,r,nCols); setCell(ws,r,0,title,xlNavyTitle()); setRowH(ws,r,37); r++;
    // Row 2: "Number" (A+B merged, navy) | num (C-G merged)
    mergeRange(ws,r,0,1); setCell(ws,r,0,'Number',xlNavyLeft());
    mergeRange(ws,r,2,nCols-1); setCell(ws,r,2,num,xlMeta(false)); setRowH(ws,r,24); r++;
    // Row 3: spacer
    mergeFull(ws,r,nCols); setCell(ws,r,0,'',{}); setRowH(ws,r,8); r++;
    // Row 4: Sprint Number
    setCell(ws,r,0,'Sprint Number',xlMetaLabel()); mergeRange(ws,r,1,nCols-1); setCell(ws,r,1,spNum,xlMeta(false)); setRowH(ws,r,24); r++;
    // Row 5: Start Date (shaded)
    setCell(ws,r,0,'Start Date',xlMetaLabel()); mergeRange(ws,r,1,nCols-1); setCell(ws,r,1,sd,xlMeta(true)); setRowH(ws,r,24); r++;
    // Row 6: End Date
    setCell(ws,r,0,'End Date',xlMetaLabel()); mergeRange(ws,r,1,nCols-1); setCell(ws,r,1,ed,xlMeta(false)); setRowH(ws,r,24); r++;
    // Row 7: Report Type (shaded)
    setCell(ws,r,0,'Report Type',xlMetaLabel()); mergeRange(ws,r,1,nCols-1); setCell(ws,r,1,rType,xlMeta(true)); setRowH(ws,r,24); r++;
    // Row 8: blank spacer
    mergeFull(ws,r,nCols); setCell(ws,r,0,'',{}); setRowH(ws,r,8); r++;
    return r;
  }

  // WriteUserStories: headers + data rows + note footer; returns r after note
  function writeUserStories(ws, r, stories, nCols) {
    const hdrs=['ID','Classification','Project','Epic','Story Title','Story Points*'];
    hdrs.forEach((h,c)=>setCell(ws,r,c,h,xlTableHdr())); setRowH(ws,r,24); r++;
    stories.forEach((t,i)=>{
      const shade=i%2===1;
      const row=[t.issue_key||'', cfg.classification||'', t.project_bucket||'', t.epic_name||'', t.summary||'', t.story_points||0];
      row.forEach((v,c)=>setCell(ws,r,c,v,xlDataCell(shade)));
      setRowH(ws,r,24); r++;
    });
    if(stories.length===0){
      for(let c=0;c<nCols;c++) setCell(ws,r,c,'',xlDataCell(false));
      setRowH(ws,r,24); r++;
    }
    mergeRange(ws,r,0,nCols-1); setCell(ws,r,0,STORY_NOTE,xlNote()); r++;
    return r;
  }

  // WriteIncidentTab: banner/class/meta/headers/3 rows/note/class/banner
  function writeIncidentTab(isFinal, spNum, sd, ed, rType, num) {
    const nCols=isFinal?9:8;
    const ws=makeWs();
    let r=0;
    r=writeBanner(ws,r,nCols);
    r=writeClassLeft(ws,r,nCols);
    r=writeMetaBlock(ws,r,'Agile Acquisition Incident Report',num,spNum,sd,ed,rType,nCols);
    // headers
    const hdrs=['Incident ID','Classification','Project','Description','Impacted Story ID','Impacted Stories','Impacted Points*','Projected Duration'];
    if(isFinal) hdrs.push('Disposition');
    hdrs.forEach((h,c)=>setCell(ws,r,c,h,xlTableHdr())); setRowH(ws,r,24); r++;
    // 3 empty data rows
    for(let i=0;i<3;i++){
      for(let c=0;c<nCols;c++) setCell(ws,r,c,'',xlDataCell(i%2===1));
      setRowH(ws,r,24); r++;
    }
    mergeRange(ws,r,0,nCols-1); setCell(ws,r,0,STORY_NOTE,xlNote()); r++;
    r++; // blank gap
    r=writeClassRight(ws,r,nCols);
    r=writeBanner(ws,r,nCols);
    ws.cols=[{wch:14},{wch:14},{wch:10},{wch:30},{wch:14},{wch:20},{wch:12},{wch:14}];
    if(isFinal) ws.cols.push({wch:20});
    return ws;
  }

  // ── Build Cover Sheet ──────────────────────────────────────
  function buildCoverSheet(sprintLabel, useEos) {
    const nCols=7;
    const ws=makeWs();
    let r=0;
    r=writeBanner(ws,r,nCols);
    r=writeClassLeft(ws,r,nCols);
    // Title
    mergeFull(ws,r,nCols); setCell(ws,r,0,'Agile Acquisition Sprint Comprehensive Plan',xlNavyTitle()); setRowH(ws,r,37); r++;
    // BT_DO_LINE
    mergeFull(ws,r,nCols); setCell(ws,r,0,BT_DO_LINE,{}); setRowH(ws,r,21); r++;
    // Sprint
    mergeFull(ws,r,nCols); setCell(ws,r,0,'Sprint '+sprintLabel,{}); setRowH(ws,r,21); r++;
    // empty
    mergeFull(ws,r,nCols); setCell(ws,r,0,'',{}); r++;
    // DID / Report / Contract / CDRL
    mergeFull(ws,r,nCols); setCell(ws,r,0,'DID Numbers: '+DID_NUMBERS,{}); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,'Report Number: '+REPORT_NUMBER,{}); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,'Contract Number: '+CONTRACT_NUMBER,{}); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,'CDRL Numbers: '+CDRL_NUMBERS,{}); r++;
    // Prepared For header
    mergeFull(ws,r,nCols); setCell(ws,r,0,'Prepared For:',xlNavyLeft()); setRowH(ws,r,21); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,PREP_FOR_NAME,{}); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,PREP_FOR_ADDR1,{}); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,PREP_FOR_CSZ,{}); r++;
    // Prepared By header
    mergeFull(ws,r,nCols); setCell(ws,r,0,'Prepared By:',xlNavyLeft()); setRowH(ws,r,21); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,PREP_BY_NAME,{}); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,PREP_BY_ORG,{}); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,PREP_BY_ADDR1,{}); r++;
    mergeFull(ws,r,nCols); setCell(ws,r,0,PREP_BY_CSZ,{}); r++;
    r=writeClassRight(ws,r,nCols);
    r=writeBanner(ws,r,nCols);
    ws.cols=[{wch:30},{wch:20},{wch:20},{wch:20},{wch:20},{wch:20},{wch:20}];
    return ws;
  }

  // ── Build Information Sheet ────────────────────────────────
  function buildInfoSheet() {
    const nCols=7;
    const ws=makeWs();
    let r=0;
    r=writeBanner(ws,r,nCols);
    r=writeClassLeft(ws,r,nCols);
    r=writeClassRight(ws,r,nCols);
    r=writeBanner(ws,r,nCols);
    return ws;
  }

  // ── Build Sprint Plan Sheet ────────────────────────────────
  function buildSprintPlanSheet(sprintLabel, sd, ed, storyList) {
    const nCols=7;
    const ws=makeWs();
    let r=0;
    r=writeBanner(ws,r,nCols);
    r=writeClassLeft(ws,r,nCols);
    r=writeMetaBlock(ws,r,'Agile Acquisition Sprint Plan',NUM_PLAN,sprintLabel,sd,ed,'Agile Sprint Plan',nCols);
    // Roles table
    const roleHdrs=['Role','Name','ID'];
    roleHdrs.forEach((h,c)=>setCell(ws,r,c,h,xlTableHdr())); setRowH(ws,r,24); r++;
    roles.forEach((ro,i)=>{
      const shade=i%2===1;
      setCell(ws,r,0,(ro.role||'')+':',xlDataCell(shade));
      setCell(ws,r,1,ro.name||'',xlDataCell(shade));
      setCell(ws,r,2,ro.id||'',xlDataCell(shade));
      setRowH(ws,r,24); r++;
    });
    // Metrics table
    const mHdrs=['','Total','DX','RC','LX','AFX'];
    mHdrs.forEach((h,c)=>setCell(ws,r,c,h,xlTableHdr())); setRowH(ws,r,24); r++;
    const planRow=['Planned Stories:',fmt(pCount.Total),fmt(pCount.DX),fmt(pCount.RC),fmt(pCount.LX),fmt(pCount.AFX)];
    planRow.forEach((v,c)=>setCell(ws,r,c,v,xlDataCell(false))); setRowH(ws,r,24); r++;
    const ptsRow=['Planned Points*:',fmt(pPts.Total),fmt(pPts.DX),fmt(pPts.RC),fmt(pPts.LX),fmt(pPts.AFX)];
    ptsRow.forEach((v,c)=>setCell(ws,r,c,v,xlDataCell(true))); setRowH(ws,r,24); r++;
    mergeRange(ws,r,0,5); setCell(ws,r,0,STORY_NOTE,xlNote()); r++;
    r++; // blank gap
    r=writeClassRight(ws,r,nCols);
    r=writeBanner(ws,r,nCols);
    ws.cols=[{wch:28},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12}];
    return ws;
  }

  // ── Build Sprint Report Sheet ──────────────────────────────
  function buildSprintReportSheet(sprintLabel, sd, ed, isEos) {
    const nCols=7;
    const ws=makeWs();
    let r=0;
    r=writeBanner(ws,r,nCols);
    r=writeClassLeft(ws,r,nCols);
    r=writeMetaBlock(ws,r,'Agile Acquisition Sprint Report',NUM_REPORT,sprintLabel,sd,ed,'Agile Sprint Report',nCols);
    if(isEos){
      const mHdrs=['','Total','DX','RC','LX','AFX'];
      mHdrs.forEach((h,c)=>setCell(ws,r,c,h,xlTableHdr())); setRowH(ws,r,24); r++;
      const planRow=['Planned Stories:',fmt(pCount.Total),fmt(pCount.DX),fmt(pCount.RC),fmt(pCount.LX),fmt(pCount.AFX)];
      planRow.forEach((v,c)=>setCell(ws,r,c,v,xlDataCell(false))); setRowH(ws,r,24); r++;
      const ptsRow=['Planned Points*:',fmt(pPts.Total),fmt(pPts.DX),fmt(pPts.RC),fmt(pPts.LX),fmt(pPts.AFX)];
      ptsRow.forEach((v,c)=>setCell(ws,r,c,v,xlDataCell(true))); setRowH(ws,r,24); r++;
      const compRow=['Completed Stories:',fmt(cCount.Total),fmt(cCount.DX),fmt(cCount.RC),fmt(cCount.LX),fmt(cCount.AFX)];
      compRow.forEach((v,c)=>setCell(ws,r,c,v,xlDataCell(false))); setRowH(ws,r,24); r++;
      const cptsRow=['Completed Points*:',fmt(cPts.Total),fmt(cPts.DX),fmt(cPts.RC),fmt(cPts.LX),fmt(cPts.AFX)];
      cptsRow.forEach((v,c)=>setCell(ws,r,c,v,xlDataCell(true))); setRowH(ws,r,24); r++;
      mergeRange(ws,r,0,5); setCell(ws,r,0,STORY_NOTE,xlNote()); r++;
      r++; // blank gap
    }
    r=writeClassRight(ws,r,nCols);
    r=writeBanner(ws,r,nCols);
    ws.cols=[{wch:28},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12}];
    return ws;
  }

  // ── Build User Stories Sheet ───────────────────────────────
  function buildUserStoriesSheet(sprintLabel, sd, ed, storyList) {
    const nCols=6;
    const ws=makeWs();
    let r=0;
    r=writeBanner(ws,r,nCols);
    r=writeClassLeft(ws,r,nCols);
    r=writeMetaBlock(ws,r,'Agile Acquisition User Stories',NUM_STORIES,sprintLabel,sd,ed,'User Stories',nCols);
    r=writeUserStories(ws,r,storyList,nCols);
    r++; // blank gap
    r=writeClassRight(ws,r,nCols);
    r=writeBanner(ws,r,nCols);
    ws.cols=[{wch:14},{wch:14},{wch:10},{wch:30},{wch:40},{wch:12}];
    return ws;
  }

  // ── Convert ws to xlsx-js-style worksheet object ───────────
  function wsToXlsx(ws) {
    const sheet={};
    // Find max row/col
    let maxR=0, maxC=0;
    Object.keys(ws.data).forEach(addr=>{
      const {r,c}=XLSX.utils.decode_cell(addr);
      if(r>maxR) maxR=r;
      if(c>maxC) maxC=c;
    });
    Object.assign(sheet, ws.data);
    sheet['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:maxR,c:maxC}});
    sheet['!merges']=ws.merges;
    if(ws.rows.length) sheet['!rows']=ws.rows;
    if(ws.cols.length) sheet['!cols']=ws.cols;
    return sheet;
  }

  // ── Assemble workbook ──────────────────────────────────────
  const wb=XLSX.utils.book_new();
  let fileLabel;

  if(mode==='plan'){
    // CreateSprintPlan — current sprint
    fileLabel=tok(CUR_SPRINT);
    const coverWs=buildCoverSheet(CUR_SPRINT,false);
    const infoWs=buildInfoSheet();
    const planWs=buildSprintPlanSheet(CUR_SPRINT,CUR_START,CUR_END,curStories);
    const reportWs=buildSprintReportSheet(CUR_SPRINT,CUR_START,CUR_END,false);
    const storiesWs=buildUserStoriesSheet(CUR_SPRINT,CUR_START,CUR_END,[]);
    const initIncWs=writeIncidentTab(false,CUR_SPRINT,CUR_START,CUR_END,'Initial Incident Report',NUM_INCIDENT);
    const finIncWs=writeIncidentTab(true,CUR_SPRINT,CUR_START,CUR_END,'Final Incident Report',NUM_INCIDENT);
    XLSX.utils.book_append_sheet(wb,wsToXlsx(coverWs),'Cover Sheet');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(infoWs),'Information');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(planWs),'Sprint Plan');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(reportWs),'Sprint Report');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(storiesWs),'User Stories');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(initIncWs),'Initial Incident');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(finIncWs),'Final Incident');
  } else {
    // EndOfSprint — prev sprint report + new cur sprint plan
    fileLabel=tok(PREV_SPRINT)+'_EOS';
    const coverWs=buildCoverSheet(PREV_SPRINT,true);
    const infoWs=buildInfoSheet();
    const planWs=buildSprintPlanSheet(CUR_SPRINT,CUR_START,CUR_END,curStories);
    const reportWs=buildSprintReportSheet(PREV_SPRINT,PREV_START,PREV_END,true);
    const storiesWs=buildUserStoriesSheet(PREV_SPRINT,PREV_START,PREV_END,prevStories);
    const initIncWs=writeIncidentTab(false,PREV_SPRINT,PREV_START,PREV_END,'Initial Incident Report',NUM_INCIDENT);
    const finIncWs=writeIncidentTab(true,PREV_SPRINT,PREV_START,PREV_END,'Final Incident Report',NUM_INCIDENT);
    XLSX.utils.book_append_sheet(wb,wsToXlsx(coverWs),'Cover Sheet');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(infoWs),'Information');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(planWs),'Sprint Plan');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(reportWs),'Sprint Report');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(storiesWs),'User Stories');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(initIncWs),'Initial Incident');
    XLSX.utils.book_append_sheet(wb,wsToXlsx(finIncWs),'Final Incident');
  }

  // ── Write file ─────────────────────────────────────────────
  XLSX.writeFile(wb, `Sprint_${fileLabel}_${APP_VERSION}_${dtg()}.xlsx`);
}


