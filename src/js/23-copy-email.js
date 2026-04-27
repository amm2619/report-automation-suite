// ============================================================
// COPY WEEKLY FOR EMAIL
// ============================================================
async function copyWeeklyForEmail(){
  const src = document.getElementById('w-copy-src');
  const cst = document.getElementById('w-cst');
  if(!src){ if(cst) cst.textContent='No report'; return; }
  const thStyle = 'padding:6px 8px;background:#1e3a8a;color:#fff;font-size:11pt;text-align:left;font-family:Calibri,Arial,sans-serif';
  const tdStyle = 'padding:5px 8px;border:1px solid #ddd;font-size:11pt;font-family:Calibri,Arial,sans-serif;vertical-align:top';
  let emailHtml = '<div style="font-family:Calibri,Arial,sans-serif">';
  src.querySelectorAll('.r-card').forEach(card => {
    const h3 = card.querySelector('h3');
    if(!h3) return;
    const projName = h3.textContent.trim();
    const blufEl = card.querySelector('.bluf-field');
    const blufText = blufEl ? (blufEl.innerText||blufEl.textContent||'').trim() : '';
    let sectionHtml = '';
    card.querySelectorAll('h3').forEach((sh, i) => {
      if(i === 0) return;
      const sectionTitle = sh.textContent.trim();
      const table = sh.nextElementSibling;
      if(!table) return;
      const rows = [];
      table.querySelectorAll('tbody tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if(tds.length < 3) return;
        const aTag = tds[1]&&tds[1].querySelector('a');
        const _itSpan=tds[1]&&tds[1].querySelector('span[title]');
        const typeIcon = issueTypeIcon((_itSpan&&_itSpan.getAttribute('title'))||'task', 14);
        const keyCell = typeIcon+(aTag
          ? '<a href="'+aTag.href+'" style="color:#1a56db;font-family:Calibri,Arial,sans-serif">'+aTag.innerText.trim()+'</a>'
          : (tds[1]?tds[1].innerText.trim():''));
        const statusTxt = tds[3]?tds[3].innerText.trim():'';
        rows.push('<tr>'
          +'<td style="'+tdStyle+';width:20%">'+(tds[0]?tds[0].innerText.trim():'')+'</td>'
          +'<td style="'+tdStyle+';white-space:nowrap">'+keyCell+'</td>'
          +'<td style="'+tdStyle+'">'+(tds[2]?tds[2].innerText.trim():'')+'</td>'
          +'<td style="'+tdStyle+';white-space:nowrap">'+statusLabel(statusTxt)+'</td>'
          +'</tr>');
      });
      if(rows.length){
        sectionHtml += '<p style="font-size:10pt;font-weight:700;color:#555;font-family:Calibri,Arial,sans-serif;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.5px">'+sectionTitle+'</p>'
          +'<table style="border-collapse:collapse;width:100%;margin-bottom:10px">'
          +'<thead><tr>'
          +'<th style="'+thStyle+';width:20%">Epic</th>'
          +'<th style="'+thStyle+'">Key</th>'
          +'<th style="'+thStyle+'">Summary</th>'
          +'<th style="'+thStyle+'">Status</th>'
          +'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';
      }
    });
    if(!sectionHtml && !blufText) return;
    emailHtml += '<h2 style="font-size:14pt;font-weight:700;color:#1e3a8a;font-family:Calibri,Arial,sans-serif;margin:20px 0 6px;border-bottom:2px solid #1e3a8a;padding-bottom:4px">'+projName+'</h2>';
    if(blufText) emailHtml += '<p style="font-size:11pt;font-family:Calibri,Arial,sans-serif;margin:0 0 10px;color:#222"><strong>BLUF:</strong> '+blufText+'</p>';
    emailHtml += sectionHtml;
  });
  emailHtml += '</div>';
  try {
    if(navigator.clipboard && window.ClipboardItem){
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([emailHtml],{type:'text/html'}),
        'text/plain': new Blob([src.innerText],{type:'text/plain'})
      })]);
    } else {
      const tmp = document.createElement('div');
      tmp.innerHTML = emailHtml;
      tmp.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(tmp);
      const r = document.createRange(); r.selectNodeContents(tmp);
      window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
      document.execCommand('copy'); window.getSelection().removeAllRanges();
      document.body.removeChild(tmp);
    }
    if(cst){cst.textContent='Copied!';setTimeout(()=>cst.textContent='',2500);}
  } catch(err){
    if(cst){cst.textContent='Copy failed';setTimeout(()=>cst.textContent='',2500);}
  }
}

// ── Weekly: Confluence copy with per-project chooser ─────────────────────────
// Builds Confluence wiki markup for chosen Weekly Digest projects from the live DOM.
function _buildWeeklyConfluenceMarkup(chosen, src, projNames) {
  const lines = [];
  chosen.forEach(proj => {
    const allCards = Array.from(src.children).filter(el => el.classList.contains('r-card'));
    const projCard = allCards.find(card => {
      const h3 = card.querySelector('h3');
      return h3 && h3.textContent.trim() === projNames[proj];
    });
    if (!projCard) return;

    lines.push(`h2. ${projNames[proj]}`);

    const blufEl = projCard.querySelector('.bluf-field');
    const blufText = blufEl ? (blufEl.innerText || blufEl.textContent || '').trim() : '';
    if (blufText) { lines.push(`*BLUF:* ${blufText}`); lines.push(''); }

    const allH3s = Array.from(projCard.querySelectorAll('h3'));
    allH3s.slice(1).forEach(sh => {
      lines.push(`h3. ${sh.textContent.trim()}`);
      let sib = sh.nextElementSibling;
      while (sib && !sib.classList.contains('tw')) sib = sib.nextElementSibling;
      if (sib) {
        const rows = [];
        sib.querySelectorAll('tbody tr').forEach(tr => {
          const tds = tr.querySelectorAll('td');
          if (tds.length < 2) return;
          const keyEl = tds[1]?.querySelector('.tk-c');
          const key = keyEl ? keyEl.textContent.trim() : '';
          if (key) rows.push(`* {jira:${key}}`);
        });
        if (rows.length) lines.push(...rows);
      }
      lines.push('');
    });

    if (allH3s.length <= 1) { lines.push('_NSTR for this period._'); lines.push(''); }
  });
  return lines.join('\n').trim();
}


function getStatusColor(status){
  if(!status) return '#555';
  const s = status.toLowerCase();
  if(s==='done'||s==='closed') return '#16a34a';
  if(s==='blocked') return '#dc2626';
  if(s==='in progress') return '#2563eb';
  if(s==='reviewing'||s==='in test') return '#d97706';
  return '#555';
}

