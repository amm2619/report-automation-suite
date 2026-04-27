// ============================================================
// CLIPBOARD HELPERS
// ============================================================
// Shared plain-text copy with textarea execCommand fallback.
// statusEl: optional element to show confirmation; ms: display duration.
async function copyTextWithFallback(text, statusEl, ms){
  if(!text || !text.trim()){
    if(statusEl){ statusEl.textContent='Nothing to copy.'; statusEl.style.color='var(--a4)'; setTimeout(()=>{ statusEl.textContent=''; statusEl.style.color=''; }, ms||2000); }
    return;
  }
  const done = ()=>{ if(statusEl){ statusEl.textContent='✓ Copied!'; statusEl.style.color='var(--a3)'; setTimeout(()=>{ statusEl.textContent=''; statusEl.style.color=''; }, ms||2000); } };
  const fail = ()=>{
    // Last resort: show a textarea the user can manually Ctrl+C from
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;width:min(600px,90vw);height:200px;background:var(--s2);color:var(--tx);border:2px solid var(--a1);border-radius:var(--r);padding:10px;font-family:var(--mono);font-size:var(--fs-xs)';
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px';
    const lbl=document.createElement('div');
    lbl.textContent='Press Ctrl+C to copy, then close this box';
    lbl.style.cssText='color:var(--tx);font-size:var(--fs-sm);font-weight:600';
    const closeBtn=document.createElement('button');
    closeBtn.textContent='Close';
    closeBtn.className='btn btn-ghost btn-sm';
    closeBtn.onclick=()=>document.body.removeChild(wrap);
    wrap.appendChild(lbl); wrap.appendChild(ta); wrap.appendChild(closeBtn);
    document.body.appendChild(wrap);
    ta.focus(); ta.select();
  };
  // Try modern clipboard API first
  if(navigator.clipboard && navigator.clipboard.writeText){
    try{ await navigator.clipboard.writeText(text); done(); return; }catch(e){}
  }
  // Try execCommand fallback
  try{
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.cssText='position:fixed;opacity:0;top:0;left:0;pointer-events:none';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok=document.execCommand('copy');
    document.body.removeChild(ta);
    if(ok){ done(); return; }
  }catch(e){}
  // Neither worked — show manual copy dialog
  fail();
}
async function copyRich(srcId){
  const el=document.getElementById(srcId);
  const st=document.getElementById(srcId+'-cst');
  try{
    if(navigator.clipboard&&window.ClipboardItem){
      await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([el.innerHTML],{type:'text/html'}),'text/plain':new Blob([el.innerText],{type:'text/plain'})})]);
    } else {
      const r=document.createRange(); r.selectNodeContents(el);
      window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
      document.execCommand('copy'); window.getSelection().removeAllRanges();
    }
    if(st){st.textContent='Copied!';setTimeout(()=>st.textContent='',2000);}
  }catch(e){if(st)st.textContent='Failed';}
}
async function copyPlain(id){
  const el=document.getElementById(id);
  const st=document.getElementById(id+'-cst');
  await copyTextWithFallback(el.innerText, st, 2000);
}

// ============================================================
// COLLAPSIBLE PARAMETER PANELS
// ============================================================
function updateParamSummary(summaryId, id1, id2, id3){
  const el=document.getElementById(summaryId); if(!el) return;
  const v1=id1?document.getElementById(id1)?.value||'':'';
  const v2=id2?document.getElementById(id2)?.value||'':'';
  const v3=id3?document.getElementById(id3)?.value||'':'';
  const parts=[v1,v2,v3].filter(Boolean);
  el.textContent=parts.join(' → ');
}

// ============================================================
// UTILS
// ============================================================
function fmtDate(dt){
  if(!dt) return '';
  return dt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
}
function dtg(){
  const now=new Date();
  return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
}

