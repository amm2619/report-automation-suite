// ============================================================
// PMR NARRATIVE EXPORT
// ============================================================
async function copyPmrNarrative(){
  const frame=document.getElementById('rptf2');
  const cst=document.getElementById('pmr-narrative-cst');
  if(!frame){ if(cst){cst.textContent='Run PMR first';setTimeout(()=>cst.textContent='',2500);} return; }

  let lines=[];
  // Walk all slides
  frame.querySelectorAll('.slide').forEach(slide=>{
    const h2=slide.querySelector('h2');
    if(h2) lines.push(h2.textContent.trim(),'');
    // Walk all h3 and h4 sub-headings and their associated bluf boxes
    slide.querySelectorAll('h3,h4,[data-pmr-bluf]').forEach(el=>{
      if(el.tagName==='H3'||el.tagName==='H4'){
        lines.push('  '+el.textContent.trim());
      } else if(el.dataset.pmrBluf!==undefined){
        const txt=(el.innerText||el.textContent||'').trim();
        lines.push('  '+(txt||'[no narrative]'),'');
      }
    });
    lines.push('');
  });

  const text=lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  await copyTextWithFallback(text, cst, 2500);
}

// Feature / Improvement / Bug — mirrors BAMBOOTIGER slide 7
// NEW FEATURES = full-height left card; IMPROVEMENTS = top-right; BUG FIXES = bottom-right
function _pmrAddFibSlide(pres, ctx, sd) {
  const { C, F, W, H, FOUO_H, BODY_Y, M, rect, text, addHeader, fit } = ctx;
  const s = pres.addSlide();
  s.background = { color: C.void };
  addHeader(s, '(U//FOUO) ' + sd.header, C.cyan);
  // Top-level narrative strip (if any)
  let topY = BODY_Y;
  if (sd.topNarrative) {
    rect(s, M, topY, W - M*2, 0.50, C.cardLt);
    rect(s, M, topY, 0.04, 0.50, C.cyan);
    text(s, sd.topNarrative, { x:M+0.14, y:topY+0.05, w:W-M*2-0.22, h:0.40, fontSize:11, color:C.text, valign:'top', wrap:true });
    topY += 0.60;
  }
  const sec = { features:null, improvements:null, bugs:null };
  sd.sections.forEach(x => {
    const l = x.label.toLowerCase();
    if (l.indexOf('feature') >= 0) sec.features = x;
    else if (l.indexOf('improvement') >= 0) sec.improvements = x;
    else if (l.indexOf('bug') >= 0) sec.bugs = x;
  });
  const leftW = 6.6;
  const rightX = M + leftW + 0.15;
  const rightW = W - rightX - M;
  const bodyH = H - FOUO_H - topY - 0.1;
  const rightH = (bodyH - 0.15) / 2;
  function card(x, y, w, h, label, color, section) {
    rect(s, x, y, w, h, C.card);
    rect(s, x, y, w, 0.048, color);
    text(s, label, { x:x+0.14, y:y+0.06, w:w-0.28, h:0.22, fontSize:11, bold:true, color:color, fontFace:F.mono });
    const narr = section && section.narrative ? section.narrative : '(no narrative)';
    text(s, narr, { x:x+0.14, y:y+0.34, w:w-0.28, h:h-0.90, fontSize:13, color:C.text, valign:'top', wrap:true });
    const cnt = section ? section.tickets.length : 0;
    const tY = y + h - 0.42;
    rect(s, x+0.14, tY, w-0.28, 0.012, C.divider);
    text(s, cnt + ' ticket' + (cnt===1?'':'s'), { x:x+0.14, y:tY+0.04, w:w-0.28, h:0.18, fontSize:9, bold:true, color:C.muted, fontFace:F.mono });
    if (cnt) text(s, fit(section.tickets.join(' · '), 130), { x:x+0.14, y:tY+0.20, w:w-0.28, h:0.18, fontSize:8, color:C.muted, fontFace:F.mono });
  }
  card(M, topY, leftW, bodyH, 'NEW FEATURES', C.green, sec.features);
  card(rightX, topY, rightW, rightH, 'IMPROVEMENTS', C.blue2, sec.improvements);
  card(rightX, topY + rightH + 0.15, rightW, rightH, 'BUG FIXES / BLOCKERS', C.red, sec.bugs);
}

// Project split — mirrors BAMBOOTIGER slide 10 (stacked product rows)
// Each row: square tag block (DX/LX/RC) + wide narrative card with ticket footer
function _pmrAddProjectSlide(pres, ctx, sd, projects) {
  const { C, F, W, H, FOUO_H, BODY_Y, M, rect, text, addHeader, fit } = ctx;
  const s = pres.addSlide();
  s.background = { color: C.void };
  addHeader(s, '(U) ' + sd.header, C.cyan);
  const info = {
    DataXplorer:   { code:'DX', color:C.cyan },
    LinkXplorer:   { code:'LX', color:C.cyanDk },
    Rollercoaster: { code:'RC', color:C.purple },
  };
  // Top-level narrative strip (if any)
  let topY = BODY_Y;
  if (sd.topNarrative) {
    rect(s, M, topY, W - M*2, 0.50, C.cardLt);
    rect(s, M, topY, 0.04, 0.50, C.cyan);
    text(s, sd.topNarrative, { x:M+0.14, y:topY+0.05, w:W-M*2-0.22, h:0.40, fontSize:11, color:C.text, valign:'top', wrap:true });
    topY += 0.60;
  }
  const matched = projects.map(p => {
    const found = sd.sections.find(sec => sec.label.toLowerCase() === p.toLowerCase());
    return { name:p, info:info[p], section:found };
  });
  const totalH = H - FOUO_H - topY - 0.15;
  const gap = 0.18;
  const rowH = (totalH - gap * (projects.length - 1)) / projects.length;
  const tagW = 1.10;
  const narrX = M + tagW + 0.08;
  const narrW = W - narrX - M;
  matched.forEach((m, i) => {
    const rY = topY + i * (rowH + gap);
    // Tag block
    rect(s, M, rY, tagW, rowH, C.card);
    rect(s, M, rY, 0.06, rowH, m.info.color);
    text(s, m.info.code, { x:M, y:rY + rowH*0.08, w:tagW, h:rowH*0.58, align:'center', fontSize:26, bold:true, color:m.info.color });
    text(s, m.name, { x:M+0.05, y:rY + rowH*0.65, w:tagW-0.10, h:rowH*0.30, align:'center', fontSize:10, color:m.info.color });
    // Narrative card
    rect(s, narrX, rY, narrW, rowH, C.card);
    rect(s, narrX, rY, narrW, 0.03, m.info.color);
    const narr = m.section ? (m.section.narrative || '(no narrative)') : 'NSTR';
    text(s, narr, { x:narrX+0.14, y:rY+0.10, w:narrW-0.28, h:rowH*0.62, fontSize:13, color:C.text, valign:'top', wrap:true });
    // Ticket footer
    const cnt = m.section ? m.section.tickets.length : 0;
    const tY = rY + rowH - 0.34;
    rect(s, narrX+0.14, tY, narrW-0.28, 0.012, C.divider);
    const tixLine = cnt + ' ticket' + (cnt===1?'':'s') + (cnt ? '  ·  ' + fit(m.section.tickets.join(' · '), 150) : '');
    text(s, tixLine, { x:narrX+0.14, y:tY+0.04, w:narrW-0.28, h:0.22, fontSize:9, color:C.muted, fontFace:F.mono });
  });
}

// Mission support / other — two-column card layout with purple + gold accents
function _pmrAddMissionSupportSlide(pres, ctx, sd) {
  const { C, F, W, H, FOUO_H, BODY_Y, M, rect, text, addHeader, fit } = ctx;
  const s = pres.addSlide();
  s.background = { color: C.void };
  addHeader(s, '(U) ' + sd.header, C.purple);
  const sec = { ms:null, other:null };
  sd.sections.forEach(x => {
    const l = x.label.toLowerCase();
    if (l.indexOf('mission support') >= 0) sec.ms = x;
    else sec.other = x;
  });
  // Top-level narrative strip (if any)
  let topY = BODY_Y;
  if (sd.topNarrative) {
    rect(s, M, topY, W - M*2, 0.50, C.cardLt);
    rect(s, M, topY, 0.04, 0.50, C.purple);
    text(s, sd.topNarrative, { x:M+0.14, y:topY+0.05, w:W-M*2-0.22, h:0.40, fontSize:11, color:C.text, valign:'top', wrap:true });
    topY += 0.60;
  }
  const gap = 0.2;
  const cardW = (W - M*2 - gap) / 2;
  const cardH = H - FOUO_H - topY - 0.1;
  function card(x, label, color, section) {
    rect(s, x, topY, cardW, cardH, C.card);
    rect(s, x, topY, cardW, 0.048, color);
    text(s, label, { x:x+0.14, y:topY+0.06, w:cardW-0.28, h:0.22, fontSize:11, bold:true, color:color, fontFace:F.mono });
    const narr = section ? (section.narrative || '(no narrative)') : 'NSTR';
    text(s, narr, { x:x+0.14, y:topY+0.34, w:cardW-0.28, h:cardH*0.62, fontSize:13, color:C.text, valign:'top', wrap:true });
    const cnt = section ? section.tickets.length : 0;
    const tY = topY + cardH - 0.70;
    rect(s, x+0.14, tY-0.04, cardW-0.28, 0.012, C.divider);
    text(s, 'TICKETS  (' + cnt + ')', { x:x+0.14, y:tY, w:cardW-0.28, h:0.20, fontSize:9, bold:true, color:C.muted, fontFace:F.mono });
    if (cnt) text(s, fit(section.tickets.join('  ·  '), 260), { x:x+0.14, y:tY+0.22, w:cardW-0.28, h:0.42, fontSize:9, color:C.muted, fontFace:F.mono, wrap:true });
  }
  card(M, 'MISSION SUPPORT', C.purple, sec.ms);
  card(M + cardW + gap, 'OTHER', C.gold, sec.other);
}

// Title slide — mirrors BAMBOOTIGER slide 1 (split-panel hero + info chips)
function _pmrAddTitleSlide(pres, ctx, meta, data) {
  const { C, F, W, H, FOUO_H, rect, text, addFOUO } = ctx;
  const s = pres.addSlide();
  s.background = { color: C.navyDk };
  addFOUO(s);
  // Left navy panel + cyan strip
  rect(s, 0, FOUO_H, 7.063, H - FOUO_H*2, C.navy);
  rect(s, 7.063, FOUO_H, 0.055, H - FOUO_H*2, C.cyan);
  // Title
  text(s, meta.pmrTitle || 'PMR', { x:0.36, y:1.6, w:6.5, h:1.3, fontSize:44, bold:true, color:'FFFFFF', charSpacing:2 });
  // Accent divider
  rect(s, 0.36, 3.02, 2.8, 0.04, C.cyan);
  rect(s, 3.20, 3.02, 2.467, 0.04, '3A4A5A');
  // Subtitle
  text(s, 'Monthly Progress Report', { x:0.36, y:3.14, w:6.5, h:0.45, fontSize:18, color:C.subtle });
  // WORK PERIOD line
  if (meta.workPeriod) {
    text(s, [
      { text:'WORK PERIOD  ', options:{ fontSize:12, bold:true, color:'6A7A8A', fontFace:F.mono } },
      { text: meta.workPeriod, options:{ fontSize:16, bold:true, color:'FFFFFF' } },
    ], { x:0.36, y:3.72, w:6.8, h:0.36 });
  }
  // SUBMITTED line
  text(s, [
    { text:'SUBMITTED  ', options:{ fontSize:12, bold:true, color:'6A7A8A', fontFace:F.mono } },
    { text: meta.submitted, options:{ fontSize:14, color:'FFFFFF' } },
  ], { x:0.36, y:4.84, w:6.8, h:0.36 });

  // Right side — subtitle tag + product name block
  text(s, 'XPLORER SUITE', { x:7.981, y:0.45, w:5, h:0.38, fontSize:11, bold:true, color:'5A6070', fontFace:F.mono });
  rect(s, 8.081, 0.88, 4.99, 0.022, C.border);
  text(s, [
    { text:'Program Management', options:{ fontSize:34, bold:true, color:'1E2736', breakLine:true } },
    { text:'Review', options:{ fontSize:34, bold:true, color:'1E2736' } },
  ], { x:7.981, y:0.96, w:5, h:1.45 });

  // Info chips: PERIOD / TOPICS / TICKETS / STATUS
  function chip(y, label, value) {
    rect(s, 7.981, y, 4.5, 0.456, 'FFFFFF');
    rect(s, 7.981, y, 0.03, 0.454, C.cyan);
    text(s, label, { x:8.048, y:y, w:1.2, h:0.456, fontSize:10.5, bold:true, color:'5A6070', fontFace:F.mono, valign:'middle' });
    text(s, value, { x:9.281, y:y, w:3.1, h:0.456, fontSize:14, color:'1E2736', valign:'middle' });
  }
  chip(2.75, 'PERIOD',  meta.monthLong || meta.monthLabel || '—');
  chip(3.40, 'TOPICS',  String(data.length));
  const totalTix = data.reduce((a, sd) => a + sd.allTickets.length, 0);
  chip(4.05, 'TICKETS', String(totalTix));
  chip(4.70, 'STATUS',  'IN PROGRESS');
}

// Agenda slide — two-column list of topic headers under a single "TOPICS" section header
function _pmrAddAgendaSlide(pres, ctx, data) {
  const { C, F, W, H, FOUO_H, BODY_Y, M, rect, text, addHeader } = ctx;
  const s = pres.addSlide();
  s.background = { color: C.void };
  addHeader(s, '(U) Presentation Agenda', C.cyan);
  const gap = 0.2;
  const half = (W - M*2 - gap) / 2;
  const itemH = 0.30, headerH = 0.27;
  const splitAt = Math.ceil(data.length / 2);
  const cols = [ data.slice(0, splitAt), data.slice(splitAt) ];
  cols.forEach((items, ci) => {
    const x = M + ci * (half + gap);
    let y = BODY_Y + 0.05;
    // Section header bar
    rect(s, x, y, half, headerH, C.navy);
    rect(s, x, y, 0.032, headerH, C.cyan);
    text(s, 'TOPICS', { x:x+0.10, y:y, w:half-0.14, h:headerH, fontSize:11, bold:true, color:'FFFFFF', fontFace:F.mono, valign:'middle' });
    y += headerH + 0.005;
    // Items
    const maxY = H - FOUO_H - itemH - 0.1;
    items.forEach(item => {
      if (y > maxY) return;
      rect(s, x, y, half, itemH, C.cardLt);
      rect(s, x + 0.10, y + 0.11, 0.08, 0.08, C.cyan);
      const label = item.header.length > 56 ? item.header.slice(0, 53) + '…' : item.header;
      text(s, label, { x:x+0.26, y:y, w:half-0.30, h:itemH, fontSize:13, color:'1E2736', valign:'middle' });
      y += itemH;
    });
  });
}

// Diamond shape wrapper. pptxgenjs ships ShapeType.diamond in all recent
// versions, but if it's ever missing we fall back to a 45°-rotated square
// via the `rotate` option, which renders identically. This lets the roadmap
// slide survive even on pptxgenjs builds that don't expose diamond.
function _pmrDiamondShape(pres, s, x, y, w, h, fill, stroke, strokeW) {
  const fillOpt   = { color: fill };
  const lineOpt   = { color: stroke || '1A1E28', width: (strokeW == null ? 0.75 : strokeW) };
  const diamondType = pres && pres.ShapeType && pres.ShapeType.diamond;
  if (diamondType) {
    s.addShape(diamondType, { x, y, w, h, fill: fillOpt, line: lineOpt });
    return;
  }
  // Fallback: square rotated 45° around its center. pptxgenjs rotate takes
  // degrees and spins around the shape's own midpoint.
  s.addShape(pres.ShapeType.rect, {
    x, y, w, h, fill: fillOpt, line: lineOpt, rotate: 45
  });
}

// Integrated Milestone Roadmap — tier rows × month columns, diamond milestones
// with product letter + status color, Next Steps panel on the right, status
// legend on the bottom. Header uses a neutral navy bar (no tier accent)
// because this slide spans all tiers. All labels are Cambria (per the
// BAMBOOTIGER style guidance) rather than the mono/Courier used elsewhere.
function _pmrAddIntegratedRoadmapSlide(pres, ctx, sd) {
  const { C, F, W, H, FOUO_H, HDR_Y, HDR_H, BAR_Y, BAR_H, BODY_Y, M, rect, text, addHeader, fit } = ctx;
  const s = pres.addSlide();
  s.background = { color: C.void };

  const payload = sd.roadmap || {};
  const slide = payload.slide || {};
  const milestones = Array.isArray(payload.milestones) ? payload.milestones : [];
  const title = slide.title || 'Integrated Milestone Roadmap';

  // Header — neutral (no accent stripe), Cambria title. Reuses the same
  // dimensions as addHeader for visual consistency with the rest of the deck.
  rect(s, 0, HDR_Y, W, HDR_H, C.navy);
  text(s, '(U) ' + title, { x:0.20, y:HDR_Y, w:W-0.4, h:HDR_H, valign:'middle', fontSize:22, bold:true, color:'FFFFFF', fontFace:'Cambria' });
  rect(s, 0, BAR_Y, W, BAR_H, C.border);

  // Layout geometry (inches)
  const padL = M + 0.40;                       // left gutter for tier labels
  const panelW = 2.40;                         // right-side Next Steps panel
  const padR = M + panelW + 0.14;
  const areaX = padL;

  // Compute month columns from the slide config
  const months = (typeof pmrRoadmapMonthsForSlide === 'function')
    ? pmrRoadmapMonthsForSlide(slide) : [];
  if (!months.length) {
    text(s, '(Roadmap has no valid month range — check Integrated Roadmap settings.)',
      { x:areaX, y:BODY_Y+0.2, w:W-padL-padR, h:0.5, fontSize:13, color:C.muted, fontFace:'Cambria' });
    return;
  }
  // Year strip is extra header space when the range crosses a year boundary
  const hasYearBreak = months.some((m, i) => i > 0 && m.yearBreak);
  const yearStripH = hasYearBreak ? 0.18 : 0;
  const areaY = BODY_Y + 0.40 + yearStripH;
  const areaW = W - padL - padR;
  const areaH = H - FOUO_H - areaY - 0.60;     // leave room for legend at bottom
  const colW = areaW / months.length;

  // Header year: single-year range shows one label top-center; multi-year
  // range shows a contiguous band above the month strip.
  if (!hasYearBreak) {
    text(s, String(slide.year || months[0].year || ''), {
      x: areaX, y: BODY_Y - 0.02, w: areaW, h: 0.24,
      fontSize: 12, bold: true, color: C.muted, fontFace:'Cambria', align:'center'
    });
  } else {
    // Walk year bands and draw a tag per contiguous stretch
    let bandStart = 0;
    for (let i = 0; i <= months.length; i++) {
      const atEnd = (i === months.length);
      const breakHere = atEnd || (i > bandStart && months[i].year !== months[bandStart].year);
      if (breakHere) {
        const bx = areaX + (colW * bandStart);
        const bw = colW * (i - bandStart);
        rect(s, bx, BODY_Y + 0.02, bw, yearStripH - 0.02, C.cardLt);
        text(s, String(months[bandStart].year), {
          x: bx, y: BODY_Y + 0.02, w: bw, h: yearStripH - 0.02,
          fontSize: 10, bold: true, color: C.text, fontFace:'Cambria',
          align:'center', valign:'middle'
        });
        bandStart = i;
      }
    }
  }
  // Month labels + vertical gridlines. Year-break lines get a heavier stroke.
  months.forEach((m, i) => {
    const cx = areaX + (colW * i);
    const thickness = m.yearBreak ? 0.018 : 0.008;
    rect(s, cx, areaY, thickness, areaH, m.yearBreak ? C.text : C.border);
    text(s, m.label, {
      x: cx, y: BODY_Y + 0.22 + yearStripH, w: colW, h: 0.20,
      fontSize: 10, bold: true, color: C.muted, fontFace:'Cambria', align:'center'
    });
  });
  // Closing vertical gridline on the right edge
  rect(s, areaX + areaW, areaY, 0.008, areaH, C.border);

  // Tier rows with proportional heights
  const tiers = (Array.isArray(slide.tiers) && slide.tiers.length) ? slide.tiers : ['T0','T1','T2','T3'];
  const emph = slide.emphasizeTier || 'T1';
  const totalWeight = tiers.reduce((acc, t) => acc + (t === emph ? 2.5 : 1), 0);
  const tierY = {}, tierH = {};
  let cursor = areaY;
  tiers.forEach(t => {
    const h = areaH * ((t === emph ? 2.5 : 1) / totalWeight);
    tierY[t] = cursor;
    tierH[t] = h;
    cursor += h;
    // Row background card + separator
    rect(s, areaX, tierY[t], areaW, h, C.card);
    rect(s, areaX, tierY[t] + h - 0.008, areaW, 0.008, C.border);
    // Tier label in the left gutter
    text(s, t, {
      x: areaX - 0.40, y: tierY[t] + (h/2) - 0.14, w: 0.36, h: 0.28,
      fontSize: 13, bold: true, color: C.text, fontFace:'Cambria', align:'right', valign:'middle'
    });
  });

  // Group milestones per tier for lane packing
  const byTier = {};
  tiers.forEach(t => { byTier[t] = []; });
  milestones.forEach(mile => {
    if (!byTier[mile.tier]) return;
    const mk = (mile.date || '').slice(0, 7);
    const mi = months.findIndex(m => m.key === mk);
    if (mi < 0) return;
    const cx = areaX + (colW * mi) + (colW / 2);
    byTier[mile.tier].push({ mile, cx });
  });

  // Status color palette (mirrors PMR_ROADMAP_STATUS in the editor).
  const statusColor = {
    complete:    C.blue2,
    in_progress: C.green,
    not_started: C.subtle,
    blocked:     C.red
  };

  // Diamond + label dimensions (inches). Emphasized tiers get a taller label
  // band so they can host 2 lines of Cambria at 8pt.
  const diamondSize = 0.22;
  const labelW      = 1.10;
  const labelH1     = 0.20; // one line of label
  const labelH2     = 0.36; // two lines (for emphasized tier)
  const minGapX     = diamondSize + 0.05;
  const minClusterGap = colW * 0.35;

  tiers.forEach(t => {
    const items = byTier[t] || [];
    if (!items.length) return;
    const isEmph = (t === emph);
    const labelH = isEmph ? labelH2 : labelH1;
    const laneUnit = diamondSize + labelH + 0.04;
    // Cap lanes to what actually fits vertically, leaving at least 0.04" pad
    const maxLanes = Math.max(1, Math.floor((tierH[t] - 0.04) / laneUnit));
    const packed = (typeof pmrRoadmapAssignLanes === 'function')
      ? pmrRoadmapAssignLanes(
          items.map(it => ({ x: it.cx, width: diamondSize })),
          minGapX,
          { maxLanes: maxLanes, minClusterGap: minClusterGap }
        )
      : { laneOf: items.map(() => 0), laneCount: 1, clusters: [] };
    const laneCount = packed.laneCount;
    const totalUsed = laneCount * laneUnit;
    const startY = tierY[t] + Math.max(0.04, (tierH[t] - totalUsed) / 2);
    items.forEach((it, idx) => {
      const lane = packed.laneOf[idx];
      if (lane < 0) return; // absorbed into a cluster badge
      const laneTop = startY + (lane * laneUnit);
      const cy = laneTop + (diamondSize / 2);
      const color = statusColor[it.mile.status] || statusColor.not_started;
      const prodLetter = (it.mile.product === 'DX') ? 'D'
                       : (it.mile.product === 'LX') ? 'L'
                       : (it.mile.product === 'RC') ? 'R'
                       : 'X';
      _pmrDiamondShape(pres, s,
        it.cx - (diamondSize/2), cy - (diamondSize/2),
        diamondSize, diamondSize,
        color, C.text, 0.75
      );
      // Product letter centered inside the diamond
      text(s, prodLetter, {
        x: it.cx - (diamondSize/2), y: cy - 0.10,
        w: diamondSize, h: 0.20,
        fontSize: 10, bold: true, color: 'FFFFFF', fontFace:'Cambria',
        align:'center', valign:'middle'
      });
      // Label below the diamond — word-aware, 2 lines for emphasized tier
      const lines = (typeof pmrRoadmapTruncLabel === 'function')
        ? pmrRoadmapTruncLabel(it.mile.label || '', isEmph ? 20 : 18, isEmph ? 2 : 1)
        : [fit(it.mile.label || '', isEmph ? 38 : 20)];
      text(s, lines.join('\n'), {
        x: it.cx - (labelW/2), y: cy + (diamondSize/2) + 0.02,
        w: labelW, h: labelH,
        fontSize: 8, color: C.text, fontFace:'Cambria',
        align:'center', valign:'top', wrap: true
      });
    });
    // Cluster badges for overflow items (dense months in short rows)
    (packed.clusters || []).forEach(cl => {
      const laneTop = startY + (cl.laneIdx * laneUnit);
      const cy = laneTop + (diamondSize / 2);
      const badgeSize = diamondSize * 1.1;
      s.addShape(pres.ShapeType.ellipse, {
        x: cl.x - (badgeSize/2), y: cy - (badgeSize/2),
        w: badgeSize, h: badgeSize,
        fill: { color: C.gold }, line: { color: C.text, width: 0.75 }
      });
      text(s, '+' + cl.count, {
        x: cl.x - (badgeSize/2), y: cy - 0.10,
        w: badgeSize, h: 0.20,
        fontSize: 9, bold: true, color: 'FFFFFF', fontFace:'Cambria',
        align:'center', valign:'middle'
      });
    });
  });

  // ── Next Steps panel (right side) ────────────────────────────────────
  const panelX = areaX + areaW + 0.14;
  const panelY = areaY;
  rect(s, panelX, panelY, panelW, areaH, C.card);
  rect(s, panelX, panelY, panelW, 0.24, C.navy);
  text(s, 'NEXT STEPS', {
    x: panelX + 0.08, y: panelY, w: panelW - 0.16, h: 0.24,
    fontSize: 10, bold: true, color: 'FFFFFF', fontFace:'Cambria', valign:'middle'
  });
  const sorted = milestones.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const rowY0 = panelY + 0.32;
  const rowH = 0.28;
  const maxRows = Math.floor((areaH - 0.40) / rowH);
  sorted.slice(0, maxRows).forEach((mile, i) => {
    const ry = rowY0 + (i * rowH);
    const color = statusColor[mile.status] || statusColor.not_started;
    // Status dot
    s.addShape(pres.ShapeType.ellipse, {
      x: panelX + 0.08, y: ry + 0.06, w: 0.10, h: 0.10,
      fill: { color: color }, line: { color: color }
    });
    // Date
    const d = (mile.date || '').slice(5); // MM-DD
    text(s, d, {
      x: panelX + 0.22, y: ry, w: 0.46, h: rowH,
      fontSize: 9, bold: true, color: C.text, fontFace:'Cambria', valign:'middle'
    });
    // Tier tag
    text(s, mile.tier || '', {
      x: panelX + 0.68, y: ry, w: 0.26, h: rowH,
      fontSize: 8, bold: true, color: C.muted, fontFace:'Cambria', valign:'middle'
    });
    // Label — word-aware single-line truncation
    const lblLines = (typeof pmrRoadmapTruncLabel === 'function')
      ? pmrRoadmapTruncLabel(mile.label || '', 28, 1)
      : [fit(mile.label || '', 32)];
    text(s, lblLines[0] || '', {
      x: panelX + 0.94, y: ry, w: panelW - 1.02, h: rowH,
      fontSize: 9, color: C.text, fontFace:'Cambria', valign:'middle'
    });
  });
  if (sorted.length > maxRows) {
    text(s, '+' + (sorted.length - maxRows) + ' more…', {
      x: panelX + 0.08, y: panelY + areaH - 0.24, w: panelW - 0.16, h: 0.20,
      fontSize: 8, italic: true, color: C.muted, fontFace:'Cambria', valign:'middle'
    });
  }

  // ── Legend strip (bottom) ────────────────────────────────────────────
  const legendY = areaY + areaH + 0.18;
  const legendItems = [
    { c: statusColor.complete,    l: 'Completed'    },
    { c: statusColor.in_progress, l: 'In Progress'  },
    { c: statusColor.not_started, l: 'Not Started'  },
    { c: statusColor.blocked,     l: 'Blocked'      }
  ];
  let lx = areaX;
  legendItems.forEach(it => {
    s.addShape(pres.ShapeType.ellipse, {
      x: lx, y: legendY + 0.04, w: 0.12, h: 0.12,
      fill: { color: it.c }, line: { color: it.c }
    });
    text(s, it.l, {
      x: lx + 0.16, y: legendY, w: 1.10, h: 0.22,
      fontSize: 9, color: C.text, fontFace:'Cambria', valign:'middle'
    });
    lx += 1.30;
  });
  // Product key on the right end of the legend
  text(s, 'D=DataXplorer · L=LinkXplorer · R=Rollercoaster · X=Cross', {
    x: areaX + 5.3, y: legendY, w: areaW - 5.3, h: 0.22,
    fontSize: 8, color: C.muted, fontFace:'Cambria', valign:'middle', align:'right'
  });
}

// Dispatcher: pick the layout-specific renderer
function _pmrAddContentSlide(pres, ctx, sd) {
  switch (sd.layout) {
    case 'feature_improvement_bug':  _pmrAddFibSlide(pres, ctx, sd); break;
    case 'project_split_3':          _pmrAddProjectSlide(pres, ctx, sd, ['DataXplorer','LinkXplorer','Rollercoaster']); break;
    case 'project_split_2':          _pmrAddProjectSlide(pres, ctx, sd, ['DataXplorer','Rollercoaster']); break;
    case 'mission_support_other':    _pmrAddMissionSupportSlide(pres, ctx, sd); break;
    case 'integrated_roadmap':       _pmrAddIntegratedRoadmapSlide(pres, ctx, sd); break;
    default:                         _pmrAddSimpleListSlide(pres, ctx, sd);
  }
}

// Simple list — single full-width card with narrative + ticket strip
function _pmrAddSimpleListSlide(pres, ctx, sd) {
  const { C, F, W, H, FOUO_H, BODY_Y, M, rect, text, addHeader, fit } = ctx;
  const s = pres.addSlide();
  s.background = { color: C.void };
  addHeader(s, '(U) ' + sd.header, C.cyan);
  const x = M, y = BODY_Y, w = W - M*2, h = H - FOUO_H - y - 0.1;
  rect(s, x, y, w, h, C.card);
  rect(s, x, y, w, 0.048, C.cyan);
  text(s, 'NARRATIVE', { x:x+0.18, y:y+0.06, w:w-0.36, h:0.22, fontSize:11, bold:true, color:C.cyan, fontFace:F.mono });
  const narr = sd.topNarrative || (sd.sections[0] && sd.sections[0].narrative) || '(no narrative provided)';
  text(s, narr, { x:x+0.18, y:y+0.34, w:w-0.36, h:h*0.62, fontSize:13, color:C.text, valign:'top', wrap:true });
  // Ticket footer
  const tx = sd.allTickets;
  const tY = y + h - 0.70;
  rect(s, x+0.18, tY-0.04, w-0.36, 0.018, C.divider);
  text(s, 'TICKETS  (' + tx.length + ')', { x:x+0.18, y:tY, w:w-0.36, h:0.20, fontSize:9, bold:true, color:C.muted, fontFace:F.mono });
  if (tx.length) text(s, fit(tx.join('  ·  '), 420), { x:x+0.18, y:tY+0.22, w:w-0.36, h:0.42, fontSize:9, color:C.muted, fontFace:F.mono, wrap:true });
}

// ── INTEGRATED MILESTONE ROADMAP — data layer ──────────────────────────────
// Helpers that seed, parse, and normalize milestone data for the roadmap
// slide. The roadmap lives in S.cfg.pmr_roadmap; seeding reads from
// S.spin.issues (already normalized by normSpinCsvIssue). User edits made
// through the editor are persisted via autoSaveCfg() and survive re-seeds.

// "Tier 1: Priority 2: ..." → "T1". Falls back to '' when no match.
// Accepts Roman numerals and plain numbers, and handles "T1"/"Tier I" variants.
function pmrRoadmapParseTier(title) {
  if (!title) return '';
  // "T1", "T 1" shorthand
  let m = title.match(/\bT\s*([0-3])\b/i);
  if (m) return 'T' + m[1];
  // "Tier 1", "Tier-1", "Tier: 1"
  m = title.match(/\bTier[\s:\-–]*([0-3])\b/i);
  if (m) return 'T' + m[1];
  // "Tier I"/"Tier II"/"Tier III" Roman numerals
  m = title.match(/\bTier\s*(I{1,3})\b/i);
  if (m) {
    const r = m[1].toUpperCase();
    return r === 'I' ? 'T1' : r === 'II' ? 'T2' : 'T3';
  }
  return '';
}

// Walk the spin plan parent chain to find a tier marker when the epic's own
// title doesn't contain one. Used by the seeder. Walks up to `maxDepth`
// levels (default 5) which is well above any realistic Strategy → Program →
// Epic depth.
function pmrRoadmapParseTierDeep(issue, spinIndex, maxDepth) {
  if (!issue) return '';
  const own = pmrRoadmapParseTier(issue.title || issue.summary || '');
  if (own) return own;
  if (!spinIndex || !issue.parentKey) return '';
  let cur = spinIndex[issue.parentKey];
  let depth = 0;
  const limit = (typeof maxDepth === 'number') ? maxDepth : 5;
  while (cur && depth < limit) {
    const t = pmrRoadmapParseTier(cur.title || cur.summary || '');
    if (t) return t;
    cur = cur.parentKey ? spinIndex[cur.parentKey] : null;
    depth++;
  }
  return '';
}

// Jira status → canonical roadmap status bucket. Handles common variations
// seen across Jira deployments (backlog/todo/new/ready, in progress/in
// development/in review/in test/staging/awaiting, done/closed/resolved,
// blocked/impediment/on hold, cancelled/abandoned).
function pmrRoadmapMapStatus(status) {
  const s = (status || '').toLowerCase().trim();
  if (!s) return 'not_started';
  // Completed family
  if (/\b(done|closed|resolved|complete|completed|shipped|released|delivered|accepted|verified)\b/.test(s)) return 'complete';
  // Cancelled / abandoned — treated as complete so they exit the active view
  if (/\b(cancell?ed|abandoned|wontfix|obsolete|rejected|duplicate)\b/.test(s)) return 'complete';
  // Blocked family
  if (/\b(block|impediment|on[\s\-]*hold|stuck|waiting\s+on|depend)/.test(s)) return 'blocked';
  // In-progress family (includes review/test/staging/awaiting deploy)
  if (/\b(progress|in\s+dev|develop|implement|review|code\s*review|peer\s*review|in\s+test|testing|qa|staging|integration|awaiting|ready\s+for|verify|verification)\b/.test(s)) return 'in_progress';
  // Not-started family (explicit)
  if (/\b(backlog|to[\s\-]?do|todo|open|new|planned|proposed|candidate|icebox|draft)\b/.test(s)) return 'not_started';
  return 'not_started';
}

// DX-123 / LX-12 / RCR-8 → 'DX' | 'LX' | 'RC' | 'X' (cross-product fallback)
function pmrRoadmapProductLetter(key) {
  const b = bucketKey(key || '');
  if (b === 'DX') return 'DX';
  if (b === 'LX') return 'LX';
  if (b === 'RC') return 'RC';
  return 'X';
}

// ISO date 'YYYY-MM-DD' → month key 'YYYY-MM'. Returns '' if malformed.
function pmrRoadmapMonthKey(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? (m[1] + '-' + m[2]) : '';
}

// Word-aware truncation that returns an array of lines (for multi-line
// labels). Breaks on whitespace, falls back to mid-word truncation if a
// single word is longer than maxCharsPerLine. Guarantees no more than
// `maxLines` entries; final line is suffixed with an ellipsis if truncated.
function pmrRoadmapTruncLabel(str, maxCharsPerLine, maxLines) {
  const s = (str || '').trim();
  if (!s) return [''];
  const cpl = Math.max(4, maxCharsPerLine || 22);
  const ml  = Math.max(1, maxLines || 1);
  // Single-line fast path
  if (ml === 1) {
    if (s.length <= cpl) return [s];
    // Try to break on last space within cpl
    const cut = s.lastIndexOf(' ', cpl - 1);
    const head = (cut > cpl * 0.5) ? s.slice(0, cut) : s.slice(0, cpl - 1);
    return [head.replace(/\s+$/,'') + '…'];
  }
  // Multi-line: greedy word wrap
  const words = s.split(/\s+/);
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= cpl) {
      cur = next;
      continue;
    }
    // Current word doesn't fit — flush cur
    if (cur) lines.push(cur);
    if (lines.length >= ml) break;
    // If the single word itself is longer than cpl, hard-split it
    if (w.length > cpl) {
      cur = w.slice(0, cpl - 1) + '…';
      lines.push(cur);
      cur = '';
      if (lines.length >= ml) break;
    } else {
      cur = w;
    }
  }
  if (cur && lines.length < ml) lines.push(cur);
  // If we ran out of lines mid-text, mark the last line as truncated
  if (lines.length === ml) {
    const consumed = lines.join(' ').replace(/…$/,'').length + (lines.length - 1);
    if (consumed < s.length - 1) {
      const last = lines[ml - 1];
      if (!/…$/.test(last)) {
        lines[ml - 1] = (last.length >= cpl - 1 ? last.slice(0, cpl - 1) : last) + '…';
      }
    }
  }
  return lines.length ? lines : [''];
}

// Read the current spin plan and produce a fresh candidate milestone list.
// Merges into S.cfg.pmr_roadmap.milestones:
//   • New ticketKeys are added (selected=true by default, slideIds=[primary])
//   • Existing ticketKeys refresh spin-derived fields, BUT any field that
//     the user has manually edited (tracked in m._userEdited) is skipped,
//     so manual corrections survive re-seeds.
//   • slideIds (selection) is always preserved — deselection is sticky.
//   • Manual entries (ticketKey='' / missing) are left untouched.
//
// Returns a diagnostic object:
//   { added, refreshed, skipped, manual, totalCandidates, typeCounts,
//     statusCounts, tierCounts, sample:[…first 3 mapped rows…], reason? }
// The UI displays added/refreshed; the rest is printed to the console for
// debugging seeding issues without a round-trip to the developer.
function pmrRoadmapSeedFromSpin() {
  const roadmap = S.cfg.pmr_roadmap;
  if (!roadmap) {
    return { added:0, refreshed:0, skipped:0, manual:0, totalCandidates:0,
             typeCounts:{}, statusCounts:{}, tierCounts:{}, sample:[],
             reason: 'no roadmap cfg' };
  }

  const spin = (S.spin && Array.isArray(S.spin.issues)) ? S.spin.issues : [];
  if (!spin.length) {
    return { added:0, refreshed:0, skipped:0, manual:0, totalCandidates:0,
             typeCounts:{}, statusCounts:{}, tierCounts:{}, sample:[],
             reason: 'no spin plan loaded — upload a roadmap CSV on the Files page first' };
  }

  // Build an index for parent-chain tier lookup
  const spinIndex = {};
  spin.forEach(i => { if (i && i.key) spinIndex[i.key] = i; });

  // Lenient filter: accept any row whose issueType matches epic/program
  // (case-insensitive, partial-match) and has a target end date. Rows with
  // missing issueType fall through to the "skipped" bucket for diagnostics.
  const typeCounts = {};
  const skippedReasons = { no_type:0, wrong_type:0, no_date:0 };
  const candidates = [];
  spin.forEach(i => {
    const raw = (i.issueType || '').trim();
    const t = raw.toLowerCase();
    typeCounts[raw || '(blank)'] = (typeCounts[raw || '(blank)'] || 0) + 1;
    if (!t) { skippedReasons.no_type++; return; }
    const isEpic = /\b(epic|epics|feature|initiative)\b/.test(t);
    const isProgram = /\b(program|programs|programme)\b/.test(t);
    if (!isEpic && !isProgram) { skippedReasons.wrong_type++; return; }
    if (!i.targetEnd) { skippedReasons.no_date++; return; }
    candidates.push(i);
  });

  // Index existing milestones by ticketKey for sticky merge
  const byKey = {};
  (roadmap.milestones || []).forEach(m => {
    if (m.ticketKey) byKey[m.ticketKey] = m;
  });

  const primarySlideId = (roadmap.slides && roadmap.slides[0]) ? roadmap.slides[0].id : 'overview';
  let added = 0, refreshed = 0, skippedSticky = 0;
  const tierCounts = {}, statusCounts = {};
  const sample = [];

  candidates.forEach(ep => {
    const existing = byKey[ep.key];
    const labelText = (ep.title || ep.summary || ep.key).trim();
    const fields = {
      tier:      pmrRoadmapParseTierDeep(ep, spinIndex, 5)
                   || (existing && existing.tier) || 'T1',
      product:   pmrRoadmapProductLetter(ep.key),
      date:      ep.targetEnd,
      status:    pmrRoadmapMapStatus(ep.status),
      label:     labelText.length > 60 ? labelText.slice(0, 59) + '…' : labelText,
      labelFull: labelText,
      ticketKey: ep.key
    };
    tierCounts[fields.tier] = (tierCounts[fields.tier] || 0) + 1;
    statusCounts[fields.status] = (statusCounts[fields.status] || 0) + 1;
    if (sample.length < 3) {
      sample.push({ key:ep.key, title:labelText, tier:fields.tier,
                    status:fields.status, date:fields.date,
                    rawStatus:ep.status, rawType:ep.issueType });
    }
    if (existing) {
      // Preserve any field the user has explicitly edited
      const edited = existing._userEdited || {};
      let anySkipped = false;
      Object.keys(fields).forEach(k => {
        if (k === 'ticketKey') { existing[k] = fields[k]; return; }
        if (edited[k]) { anySkipped = true; return; }
        existing[k] = fields[k];
      });
      if (anySkipped) skippedSticky++;
      refreshed++;
    } else {
      roadmap.milestones.push(Object.assign({
        id: 'ms_' + ep.key,
        slideIds: [primarySlideId],
        _userEdited: {}
      }, fields));
      added++;
    }
  });

  const manual = (roadmap.milestones || []).filter(m => !m.ticketKey).length;
  roadmap.seedVersion = (roadmap.seedVersion || 0) + 1;
  if (typeof autoSaveCfg === 'function') autoSaveCfg();

  const diag = {
    added, refreshed, skipped: skippedSticky, manual,
    totalCandidates: candidates.length,
    totalSpinRows: spin.length,
    skippedReasons, typeCounts, statusCounts, tierCounts, sample
  };
  // Console diagnostics — surfaces issueType/status distribution so the user
  // can see exactly what mapped to what without opening the debugger.
  try { console.log('[pmrRoadmapSeedFromSpin]', diag); } catch(_) {}
  return diag;
}

// Add a blank manual milestone (no ticketKey) to the current roadmap.
// Used by the editor's "+ Manual" button. Manual entries start with every
// field flagged as user-edited so re-seeds never touch them (they can't
// match a ticketKey anyway, but this keeps the contract explicit).
function pmrRoadmapAddManual() {
  const roadmap = S.cfg.pmr_roadmap;
  if (!roadmap) return null;
  const primarySlideId = (roadmap.slides && roadmap.slides[0]) ? roadmap.slides[0].id : 'overview';
  const id = 'ms_manual_' + Date.now();
  const m = {
    id, tier: 'T1', product: 'X',
    date: '', status: 'not_started',
    label: '(new milestone)', labelFull: '(new milestone)',
    ticketKey: '',
    slideIds: [primarySlideId],
    _userEdited: { tier:true, product:true, date:true, status:true, label:true }
  };
  roadmap.milestones.push(m);
  if (typeof autoSaveCfg === 'function') autoSaveCfg();
  return m;
}

// Toggle a milestone's inclusion on a particular slide. Empty slideIds = deselected.
function pmrRoadmapToggleSelected(milestoneId, slideId) {
  const roadmap = S.cfg.pmr_roadmap;
  if (!roadmap) return;
  const m = (roadmap.milestones || []).find(x => x.id === milestoneId);
  if (!m) return;
  if (!Array.isArray(m.slideIds)) m.slideIds = [];
  const i = m.slideIds.indexOf(slideId);
  if (i >= 0) m.slideIds.splice(i, 1); else m.slideIds.push(slideId);
  if (typeof autoSaveCfg === 'function') autoSaveCfg();
}

// Remove a milestone entirely (manual deletes).
function pmrRoadmapDeleteMilestone(milestoneId) {
  const roadmap = S.cfg.pmr_roadmap;
  if (!roadmap || !Array.isArray(roadmap.milestones)) return;
  roadmap.milestones = roadmap.milestones.filter(m => m.id !== milestoneId);
  if (typeof autoSaveCfg === 'function') autoSaveCfg();
}

// Compute the ordered month list for a given slide config.
// Returns an array of { key:'YYYY-MM', label:'JAN', year:2026, yearBreak:bool }
// where yearBreak is true on the first entry of any year after the first.
// Also validates the range — returns [] if the range is inverted or invalid.
function pmrRoadmapMonthsForSlide(slide) {
  const SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const out = [];
  if (!slide || !slide.rangeStart || !slide.rangeEnd) return out;
  const sm0 = String(slide.rangeStart).split('-').map(Number);
  const em0 = String(slide.rangeEnd).split('-').map(Number);
  if (sm0.length < 2 || em0.length < 2) return out;
  const [sy, sm] = sm0, [ey, em] = em0;
  if (!sy || !sm || !ey || !em) return out;
  // Reject inverted ranges outright — caller can show an error
  if (ey < sy || (ey === sy && em < sm)) return out;
  let y = sy, m = sm;
  let firstYear = sy;
  for (let guard = 0; guard < 60; guard++) {
    out.push({
      key: y + '-' + String(m).padStart(2, '0'),
      label: SHORT[m - 1] || '',
      year: y,
      yearBreak: (y !== firstYear && m === 1)
    });
    if (y === ey && m === em) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

// Greedy lane assignment for packing dense clusters within a tier row.
// items: array of { x: number (coord along the row axis), width: number }
// minGap: minimum horizontal gap between items sharing a lane
// opts (optional):
//   maxLanes:   cap on visible lanes. Items that would spill into higher
//               lanes are collapsed into cluster badges on the last lane.
//   minClusterGap: horizontal distance used to merge overflow items into
//               a single cluster anchor. Defaults to minGap * 2.
// Returns: { laneOf: number[], laneCount: number, clusters: Array<{x, count, laneIdx, members:number[]}> }
// - laneOf[i] may be -1 for items that were absorbed into a cluster badge.
function pmrRoadmapAssignLanes(items, minGap, opts) {
  const options = opts || {};
  const maxLanes = (typeof options.maxLanes === 'number' && options.maxLanes > 0)
    ? options.maxLanes : Infinity;
  const clusterGap = (typeof options.minClusterGap === 'number')
    ? options.minClusterGap : (minGap * 2);

  const lanes = []; // lanes[i] = rightmost x occupied in lane i
  const laneOf = new Array(items.length);
  const order = items.map((it, idx) => ({ idx, x: it.x, w: it.width || 0 }))
                     .sort((a, b) => a.x - b.x);
  const overflow = []; // items that didn't fit within maxLanes
  order.forEach(o => {
    const leftEdge = o.x - (o.w / 2);
    let placed = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] + minGap <= leftEdge) { placed = i; break; }
    }
    if (placed < 0) {
      if (lanes.length < maxLanes) { placed = lanes.length; lanes.push(0); }
      else { overflow.push(o); laneOf[o.idx] = -1; return; }
    }
    lanes[placed] = o.x + (o.w / 2);
    laneOf[o.idx] = placed;
  });

  // Collapse overflow items into cluster badges. Each badge sits on the last
  // lane and absorbs nearby overflow items within `clusterGap`. The cluster
  // x-position is the average of its members.
  const clusters = [];
  if (overflow.length) {
    const lastLane = Math.max(0, lanes.length - 1);
    overflow.sort((a, b) => a.x - b.x);
    let i = 0;
    while (i < overflow.length) {
      let j = i + 1;
      const members = [overflow[i].idx];
      let sumX = overflow[i].x;
      while (j < overflow.length && (overflow[j].x - overflow[j - 1].x) <= clusterGap) {
        members.push(overflow[j].idx);
        sumX += overflow[j].x;
        j++;
      }
      clusters.push({
        x: sumX / members.length,
        count: members.length,
        laneIdx: lastLane,
        members
      });
      i = j;
    }
  }
  return { laneOf, laneCount: lanes.length || 1, clusters };
}

// Filter milestones for a particular slide: include only if selected AND
// the date falls inside the slide's month range.
function pmrRoadmapMilestonesForSlide(slide) {
  const roadmap = S.cfg.pmr_roadmap;
  if (!roadmap || !slide) return [];
  const months = pmrRoadmapMonthsForSlide(slide);
  const keys = {};
  months.forEach(m => { keys[m.key] = true; });
  return (roadmap.milestones || []).filter(m => {
    if (!Array.isArray(m.slideIds) || m.slideIds.indexOf(slide.id) < 0) return false;
    const mk = pmrRoadmapMonthKey(m.date);
    if (!mk || !keys[mk]) return false;
    if (Array.isArray(slide.tiers) && slide.tiers.indexOf(m.tier) < 0) return false;
    return true;
  });
}

// ── PMR PPTX HELPERS (BAMBOOTIGER format) ──────────────────────────────────
// Walk PMR slide DOM → [{header, layout, topNarrative, sections:[{label,narrative,tickets}], allTickets, roadmap?}]
function _pmrExtractSlides(frame) {
  const out = [];
  frame.querySelectorAll('.slide').forEach(slide => {
    const h2 = slide.querySelector('h2');
    let header = h2 ? h2.textContent.trim() : '(Untitled)';
    header = header.replace(/^\(U\)\s*/i, '').trim();
    if (/^agenda$/i.test(header)) return;
    const layout = slide.getAttribute('data-pmr-layout') || 'simple_list';
    const slugCtx = (slide.id || '').replace(/^pmr-slide-/, '');

    // Integrated roadmap slides carry a JSON payload on a data-roadmap
    // attribute instead of ticket/narrative sections. Short-circuit the rest
    // of the extractor and push a roadmap-typed entry directly.
    if (layout === 'integrated_roadmap') {
      const wrap = slide.querySelector('[data-roadmap]');
      let roadmap = null;
      if (wrap) {
        try { roadmap = JSON.parse(decodeURIComponent(wrap.getAttribute('data-roadmap') || '')); }
        catch (e) { roadmap = null; }
      }
      out.push({ header, layout, topNarrative: '', sections: [], allTickets: [], roadmap });
      return;
    }

    let topNarrative = '';
    const topBluf = slide.querySelector('[data-pmr-bluf="' + slugCtx + '"]');
    if (topBluf) topNarrative = (topBluf.innerText || topBluf.textContent || '').trim();
    // Sections from h4 elements (pooled layouts) or entire slide (simple_list)
    const sections = [];
    const h4s = slide.querySelectorAll('h4');
    if (h4s.length > 0) {
      h4s.forEach(h4 => {
        const label = h4.textContent.trim();
        let narrative = ''; const tickets = [];
        let n = h4.nextElementSibling;
        while (n && n.tagName !== 'H4' && n.tagName !== 'H3' && n.tagName !== 'H2') {
          if (n.dataset && n.dataset.pmrBluf !== undefined && !narrative) {
            narrative = (n.innerText || n.textContent || '').trim();
          }
          if (n.querySelectorAll) {
            n.querySelectorAll('a.tk, .tk-c, span.tk').forEach(tk => {
              const k = (tk.textContent || '').trim();
              if (k && tickets.indexOf(k) < 0) tickets.push(k);
            });
          }
          n = n.nextElementSibling;
        }
        sections.push({ label, narrative, tickets });
      });
    } else {
      const tickets = [];
      slide.querySelectorAll('a.tk, .tk-c, span.tk').forEach(tk => {
        const k = (tk.textContent || '').trim();
        if (k && tickets.indexOf(k) < 0) tickets.push(k);
      });
      sections.push({ label: '', narrative: '', tickets });
    }
    // Dedupe sections by label (combines h3-grouped sub-topics with same h4 labels)
    const map = {}, order = [];
    sections.forEach(s => {
      const k = s.label.toLowerCase();
      if (!map[k]) { map[k] = { label:s.label, narrative:s.narrative, tickets:s.tickets.slice() }; order.push(k); }
      else {
        if (s.narrative && !map[k].narrative) map[k].narrative = s.narrative;
        s.tickets.forEach(t => { if (map[k].tickets.indexOf(t) < 0) map[k].tickets.push(t); });
      }
    });
    const merged = order.map(k => map[k]);
    const allTickets = [];
    merged.forEach(sec => sec.tickets.forEach(t => { if (allTickets.indexOf(t) < 0) allTickets.push(t); }));
    out.push({ header, layout, topNarrative, sections: merged, allTickets });
  });
  return out;
}

// Build title/month/work-period metadata from wizard params and cfg
function _pmrBuildMeta() {
  const cfg = S.cfg || {};
  const wp = S._wizParams || S.params || {};
  const pmrTitle = (cfg.pmr_title || '(U) PMR').replace(/^\(U\)\s*/i, '').trim();
  const pmrMonth = wp.pmrMonth || '';
  const pmrStart = wp.pmrStart || '';
  const pmrEnd = wp.pmrEnd || '';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let monthLabel = pmrMonth, monthLong = '', workPeriod = '';
  try {
    if (pmrMonth) {
      const [yr, mo] = pmrMonth.split('-');
      const i = parseInt(mo, 10) - 1;
      monthLabel = (SHORT[i] || mo) + ' ' + yr;
      monthLong = (MONTHS[i] || mo) + ' ' + yr;
    }
    if (pmrStart && pmrEnd) {
      const sd = new Date(pmrStart + 'T00:00:00');
      const ed = new Date(pmrEnd + 'T00:00:00');
      workPeriod = MONTHS[sd.getMonth()] + ' ' + sd.getDate() + ' – ' + MONTHS[ed.getMonth()] + ' ' + ed.getDate() + ', ' + ed.getFullYear();
    }
  } catch (e) { /* keep raw */ }
  const today = new Date();
  const submitted = MONTHS[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();
  const safeName = (monthLabel || 'current').replace(/\s+/g, '_');
  return { pmrTitle, pmrMonth, monthLabel, monthLong, workPeriod, submitted, safeName };
}

// Shared constants + low-level helpers (colors, dimensions, shape/text primitives)
function _pmrCtx(pres) {
  const C = {
    void:'F7F5F1', navy:'1E2736', navyDk:'141A26', card:'FFFFFF', cardLt:'F0EDE8', border:'D4CFC8',
    cyan:'0071A4', cyanDk:'2952A3', purple:'6030A0', orange:'B84A10', magenta:'B02060',
    gold:'B87800', green:'0A7A4A', red:'C0392B', blue2:'0060B0', amber:'F5A800',
    text:'1A1E28', muted:'5A6070', subtle:'8899BB', divider:'D4CFC8', fouoBg:'007A33',
  };
  const F = { body:'Calibri', mono:'Courier New' };
  const W = 13.333, H = 7.5, FOUO_H = 0.22, HDR_Y = 0.22, HDR_H = 0.82;
  const BAR_Y = HDR_Y + HDR_H, BAR_H = 0.05;
  const BODY_Y = BAR_Y + BAR_H + 0.1, M = 0.26;
  const rect = (s,x,y,w,h,fill) => s.addShape(pres.ShapeType.rect, { x,y,w,h, fill:{color:fill}, line:{color:fill} });
  const text = (s,t,opts) => s.addText(typeof t === 'string' ? t : t, Object.assign({ margin:0, fontFace:F.body }, opts));
  function addFOUO(s) {
    rect(s, 0, 0, W, FOUO_H, C.fouoBg);
    text(s, 'UNCLASSIFIED // FOR OFFICIAL USE ONLY', { x:0,y:0,w:W,h:FOUO_H, align:'center', valign:'middle', fontSize:8, bold:true, color:'FFFFFF', charSpacing:2.5, fontFace:F.mono });
    rect(s, 0, H - FOUO_H, W, FOUO_H, C.fouoBg);
    text(s, 'UNCLASSIFIED // FOR OFFICIAL USE ONLY', { x:0,y:H-FOUO_H,w:W,h:FOUO_H, align:'center', valign:'middle', fontSize:8, bold:true, color:'FFFFFF', charSpacing:2.5, fontFace:F.mono });
  }
  function addHeader(s, title, accent) {
    accent = accent || C.cyan;
    rect(s, 0, HDR_Y, W, HDR_H, C.navy);
    rect(s, 0, HDR_Y, 0.05, HDR_H, accent);
    text(s, title, { x:0.20, y:HDR_Y, w:W-0.4, h:HDR_H, valign:'middle', fontSize:22, bold:true, color:'FFFFFF' });
    rect(s, 0, BAR_Y, W*0.35, BAR_H, accent);
    rect(s, W*0.35, BAR_Y, W*0.65, BAR_H, C.border);
  }
  const fit = (str, n) => (str && str.length > n) ? str.slice(0, n-1) + '…' : (str || '');
  return { pres, C, F, W, H, FOUO_H, HDR_Y, HDR_H, BAR_Y, BAR_H, BODY_Y, M, rect, text, addFOUO, addHeader, fit };
}

// ── DOWNLOAD PMR PPTX (BAMBOOTIGER format) ─────────────────────────────────
function downloadPmrPptx() {
  const frame = document.getElementById('rptf2');
  if (!frame) { alert('Run PMR first before downloading PPTX.'); return; }
  const data = _pmrExtractSlides(frame);
  const meta = _pmrBuildMeta();
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = meta.pmrTitle + ' — ' + meta.monthLabel;
  const ctx = _pmrCtx(pres);
  _pmrAddTitleSlide(pres, ctx, meta, data);
  _pmrAddAgendaSlide(pres, ctx, data);
  data.forEach(sd => _pmrAddContentSlide(pres, ctx, sd));
  pres.writeFile({ fileName: 'BAMBOOTIGER_PMR_' + meta.safeName + '.pptx' });
}


function guideScrollTo(id) {
  const el = document.getElementById(id);
  const body = document.getElementById('guide-body');
  if(el && body) {
    body.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
  }
}


function buildGuideNav(overlay) {
  const GUIDE_SECTIONS = [
    { id:'start',     label:'Getting Started' },
    { id:'files',     label:'Your Files' },
    { id:'weekly',    label:'Weekly Digest' },
    { id:'eos',       label:'End of Sprint' },
    { id:'pmr',       label:'PMR' },
    { id:'sprint',    label:'Sprint Plan' },
    { id:'spin',      label:'Spin Plan' },
    { id:'velocity',  label:'Velocity' },
    { id:'config',    label:'Settings' },
    { id:'tips',      label:'Tips' },
  ];
  const nav = overlay.querySelector('#guide-nav');
  if (nav) {
    nav.innerHTML = GUIDE_SECTIONS.map(function(s) {
      var icon = APP_ICONS[s.id] || 'circle';
      return '<div class="guide-nav-item" data-target="guide-' + s.id + '" onclick="guideScrollTo(\'' + 'guide-' + s.id + '\')">'
        + mi(icon, 'font-size:16px;margin-right:8px')
        + '<span>' + s.label + '</span></div>';
    }).join('');
  }
  // Inject icons into h3 headings
  overlay.querySelectorAll('h3[data-guide-section]').forEach(function(h3) {
    var sid = h3.getAttribute('data-guide-section');
    var icon = APP_ICONS[sid] || 'circle';
    var text = h3.textContent.trim();
    h3.innerHTML = mi(icon, 'font-size:15px;margin-right:6px;vertical-align:middle') + text;
  });
  // Re-attach IntersectionObserver after nav rebuild
  var guideBody = overlay.querySelector('#guide-body');
  var guideAnchors = overlay.querySelectorAll('[id^="guide-"]');
  var guideNavItems = overlay.querySelectorAll('.guide-nav-item');
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if(entry.isIntersecting) {
        guideNavItems.forEach(function(el){ el.classList.remove('active'); });
        var active = overlay.querySelector('.guide-nav-item[data-target="' + entry.target.id + '"]');
        if(active) active.classList.add('active');
      }
    });
  }, { root: guideBody, threshold: 0, rootMargin: '-10% 0px -80% 0px' });
  guideAnchors.forEach(function(el){ observer.observe(el); });
}

function openGuide(){
  let overlay=document.getElementById('guide-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='guide-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    overlay.innerHTML=`
      <div style="background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);width:min(960px,96vw);max-height:93vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--bd);flex-shrink:0">
          <span style="font-weight:700;color:var(--tx);font-size:var(--fs-lg)"><span class="mi" style="font-size:18px;margin-right:8px;vertical-align:middle">menu_book</span>Report Suite ${APP_VERSION} — User Guide</span>
          <button onclick="document.getElementById('guide-overlay').remove()" style="background:none;border:none;color:var(--mu);font-size:18px;cursor:pointer;padding:2px 8px;border-radius:var(--r2)">✕</button>
        </div>
        <div style="display:flex;flex:1;overflow:hidden">
          <div style="width:175px;flex-shrink:0;background:var(--s2);border-right:1px solid var(--bd);overflow-y:auto;padding:8px 0" id="guide-nav"></div>
          <div style="flex:1;overflow-y:auto;padding:24px 30px;font-size:var(--fs-sm);line-height:1.75;color:var(--tx)" id="guide-body">

          <!-- ════════ GETTING STARTED ════════ -->
          <div id="guide-start" style="scroll-margin-top:12px"></div>
          <h3 style="color:var(--a3);font-size:var(--fs-lg);border-bottom:2px solid var(--a3b);padding-bottom:6px;margin:0 0 14px" data-guide-section="start">Getting Started</h3>

          <div style="background:var(--a3d);border:1px solid var(--a3b);border-radius:var(--r);padding:16px 20px;margin-bottom:16px">
            <div style="font-weight:700;color:var(--a3);margin-bottom:8px">3 steps. That's it.</div>
            <ol style="margin:0;padding-left:20px;font-size:var(--fs-sm);line-height:2.2;color:var(--tx)">
              <li><strong>Export 2 CSVs from Jira</strong> (see JQL below)</li>
              <li><strong>Drop them onto the app</strong> (the gray bar at the top)</li>
              <li><strong>Click the report you want</strong> on the home screen</li>
            </ol>
          </div>

          <div style="font-weight:700;color:var(--tx);margin:16px 0 8px">The 2 files you need from Jira</div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
            <div style="background:var(--s3);border:1px solid var(--bd);border-left:3px solid var(--a1);border-radius:var(--r2);padding:12px 16px">
              <div style="font-weight:700;color:var(--a1);margin-bottom:4px">1. Issues CSV <span style="color:var(--mu);font-weight:400;font-size:var(--fs-xs)">(required for all reports)</span></div>
              <div style="font-size:var(--fs-xs);color:var(--mu);margin-bottom:6px">Go to Jira &rarr; Filters &rarr; paste this JQL &rarr; Export &rarr; CSV (All fields)</div>
              <code style="display:block;background:var(--s2);border:1px solid var(--bd2);border-radius:var(--r2);padding:8px 12px;font-size:var(--fs-xs);color:var(--a1);user-select:all;cursor:text">project in (DX, LX, RCR) ORDER BY updated DESC</code>
            </div>
            <div style="background:var(--s3);border:1px solid var(--bd);border-left:3px solid var(--a2);border-radius:var(--r2);padding:12px 16px">
              <div style="font-weight:700;color:var(--a2);margin-bottom:4px">2. Epics CSV <span style="color:var(--mu);font-weight:400;font-size:var(--fs-xs)">(needed for Weekly, EOS, PMR)</span></div>
              <div style="font-size:var(--fs-xs);color:var(--mu);margin-bottom:6px">Same process, different JQL:</div>
              <code style="display:block;background:var(--s2);border:1px solid var(--bd2);border-radius:var(--r2);padding:8px 12px;font-size:var(--fs-xs);color:var(--a2);user-select:all;cursor:text">project in (DX, LX, RCR) AND issuetype = Epic</code>
            </div>
            <div style="background:var(--s3);border:1px solid var(--bd);border-left:3px solid var(--a4);border-radius:var(--r2);padding:12px 16px">
              <div style="font-weight:700;color:var(--a4);margin-bottom:4px">3. Roadmap CSV <span style="color:var(--mu);font-weight:400;font-size:var(--fs-xs)">(optional &mdash; only for Spin Plan)</span></div>
              <div style="font-size:var(--fs-xs);color:var(--mu);margin-bottom:6px">Export from Jira Plans / Roadmap view. Can be CSV or TSV (tab-separated) &mdash; both work.</div>
              <div style="font-size:var(--fs-xs);color:var(--mu)">Must have a <code>Hierarchy</code> column (Strategy / Program / Epic / Story etc.)</div>
            </div>
          </div>
          <div style="font-size:var(--fs-xs);color:var(--mu);margin-bottom:20px">Drop all files at once &mdash; the app figures out which is which from the column headers. You can also use the <strong>Jira API</strong> panel (configure in Settings) to fetch directly without exporting CSVs.</div>

          <!-- ════════ YOUR FILES ════════ -->
          <div id="guide-files" style="scroll-margin-top:12px"></div>
          <h3 style="color:var(--a1);font-size:var(--fs-base);border-bottom:1px solid var(--bd);padding-bottom:4px;margin:0 0 10px" data-guide-section="files">Your Files</h3>
          <p>Drop files onto the gray bar at the top. The app auto-detects which file is which from the column headers. You can drop multiple files at once.</p>
          <ul class="u-list-indent-tight">
            <li><strong>Issues CSV</strong> &rarr; needed for Weekly, EOS, Sprint, PMR</li>
            <li><strong>Epics CSV</strong> &rarr; needed for readable epic names in Weekly, EOS, PMR</li>
            <li><strong>Roadmap CSV</strong> &rarr; only for Spin Plan (accepts CSV or TSV)</li>
          </ul>
          <p style="font-size:var(--fs-xs);color:var(--mu)">Your text (BLUF, summaries) auto-saves as you type. Come back later and it's still there. Use <strong>Continue Working</strong> on the Files step to restore everything including your date/sprint selections.</p>

          <!-- ════════ WEEKLY DIGEST ════════ -->
          <div id="guide-weekly" style="scroll-margin-top:12px"></div>
          <h3 class="u-a2-hdr" data-guide-section="weekly">Weekly Digest</h3>
          <div style="background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);padding:14px 18px;margin-bottom:12px">
            <ol style="margin:0;padding-left:18px;color:var(--tx);font-size:var(--fs-sm);line-height:2.2">
              <li>Drop <strong>Issues + Epics CSVs</strong></li>
              <li>Click <strong>Weekly Digest</strong> &rarr; pick start &amp; end dates</li>
              <li>Click <strong>Generate</strong></li>
              <li>Click <strong>Copy for Confluence</strong> &rarr; paste into Confluence</li>
            </ol>
          </div>
          <p>Shows tickets updated in your date range, grouped by project (DX/LX/RC). The <strong>Debug</strong> tab shows why each ticket was included or excluded.</p>

          <!-- ════════ END OF SPRINT ════════ -->
          <div id="guide-eos" style="scroll-margin-top:12px"></div>
          <h3 class="u-a2-hdr" data-guide-section="eos">End of Sprint (EOS)</h3>
          <div style="background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);padding:14px 18px;margin-bottom:12px">
            <ol style="margin:0;padding-left:18px;color:var(--tx);font-size:var(--fs-sm);line-height:2.2">
              <li>Drop <strong>Issues + Epics CSVs</strong></li>
              <li>Click <strong>End of Sprint</strong> &rarr; pick Current &amp; Future sprints</li>
              <li>Click <strong>Generate</strong></li>
              <li>Fill in the <strong>BLUF</strong> and <strong>Summary</strong> boxes for each topic</li>
              <li>Fill in <strong>Deployments</strong>, <strong>User Engagement</strong>, <strong>Demonstrations</strong> (or leave blank for NSTR)</li>
              <li>Click <strong>Copy for Confluence</strong> &rarr; pick projects &rarr; paste</li>
            </ol>
          </div>

          <p style="font-weight:700;color:var(--tx);margin:14px 0 6px">What each section does</p>
          <ul class="u-list-indent-tight">
            <li><strong>BLUF</strong> &mdash; top-level summary for the project. Type it, it auto-saves.</li>
            <li><strong>Topic sections</strong> &mdash; tickets grouped by topic (HCI Migration, Tool Mod, etc.). Each has a Summary field and a ticket table.</li>
            <li><strong>AI button</strong> &mdash; the sparkle icon next to each topic copies a prompt + ticket list to your clipboard. Paste into ChatGPT/Claude to generate a summary. Configure the prompt in Settings &rarr; EOS &rarr; AI Summary Prompt.</li>
            <li><strong>Prioritization</strong> &mdash; at the bottom. Pick epics to see backlog tickets, or paste JQL for Confluence to run live.</li>
            <li><strong>Deployments / User Engagement / Demos</strong> &mdash; type content or leave blank. Blank = "NSTR" in Confluence.</li>
          </ul>

          <p style="font-weight:700;color:var(--tx);margin:14px 0 6px">Confluence output</p>
          <ul class="u-list-indent-tight">
            <li>Ticket tables are live <strong>{jira:...}</strong> macros &mdash; Confluence runs the JQL, so tables update as tickets change</li>
            <li>Sprint counts link to Jira filtered views</li>
            <li>Check <strong>"Exclude empty topics"</strong> in the copy picker to hide NSTR sections</li>
            <li>Your typed summaries are included. No typing = no summary line (no "TBD")</li>
          </ul>

          <p style="font-size:var(--fs-xs);color:var(--mu)">Everything auto-saves as you type. Close the browser, come back, your text is still there.</p>

          <!-- ════════ PMR ════════ -->
          <div id="guide-pmr" style="scroll-margin-top:12px"></div>
          <h3 class="u-a2-hdr" data-guide-section="pmr">PMR</h3>
          <div style="background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);padding:14px 18px;margin-bottom:12px">
            <ol style="margin:0;padding-left:18px;color:var(--tx);font-size:var(--fs-sm);line-height:2.2">
              <li>Drop <strong>Issues + Epics CSVs</strong></li>
              <li>Click <strong>PMR</strong> &rarr; pick the reporting month</li>
              <li>Click <strong>Generate</strong></li>
              <li>Fill in the narrative boxes for each topic</li>
              <li>Click <strong>Copy Narrative</strong> to copy text, or <strong>Download PPTX</strong> for a PowerPoint deck</li>
            </ol>
          </div>
          <p>Tickets appear in the PMR only if they were in a sprint that overlapped the selected month AND were updated/resolved within that month.</p>
          <p><strong>Download PPTX</strong> generates a formatted PowerPoint matching the BAMBOOTIGER template &mdash; title slide, agenda, and layout-specific content slides.</p>

          <!-- Integrated Milestone Roadmap — dedicated expandable walkthrough -->
          <details style="background:var(--s3);border:1px solid var(--a4b);border-left:3px solid var(--a4);border-radius:var(--r2);margin:14px 0;overflow:hidden">
            <summary style="padding:12px 18px;cursor:pointer;font-weight:700;font-size:var(--fs-sm);color:var(--a4);user-select:none;display:flex;align-items:center;gap:8px">
              <span class="mi" style="font-size:16px">route</span>
              How the Integrated Milestone Roadmap works
            </summary>
            <div style="padding:4px 18px 18px;font-size:var(--fs-sm);line-height:1.8;color:var(--tx)">

              <p style="color:var(--mu);margin:8px 0 12px">The roadmap slide shows your program milestones on a timeline organized by tier (T0, T1, T2, T3). It pulls data from your spin plan CSV and lets you pick which milestones to show on the slide. Here's how to set it up:</p>

              <div style="font-weight:700;color:var(--a4);margin:12px 0 8px">Step 1: Load your Roadmap CSV</div>
              <p style="margin:0 0 4px">Drop your Jira Plans / Roadmap CSV onto the file bar. This is the same file the Spin Plan uses. It needs:</p>
              <ul style="margin:0 0 12px;padding-left:18px">
                <li>A <code>Hierarchy</code> column (Strategy, Program, Initiative, Epic, etc.)</li>
                <li>A <code>Target end date</code> column (this becomes the milestone date)</li>
                <li>A <code>Parent</code> column (keys or title text — both work)</li>
              </ul>

              <div style="font-weight:700;color:var(--a4);margin:12px 0 8px">Step 2: Open the Roadmap Editor</div>
              <p style="margin:0 0 4px">Go to <strong>Settings &rarr; PMR &rarr; Integrated Milestone Roadmap</strong> (scroll to the bottom of the PMR settings page).</p>
              <p style="margin:0 0 12px">Click <strong>Re-seed from Spin Plan</strong>. This imports every Epic and Program row that has a target end date. Each becomes a milestone.</p>

              <div style="font-weight:700;color:var(--a4);margin:12px 0 8px">Step 3: Curate your milestones</div>
              <p style="margin:0 0 4px">The milestone table shows everything that was imported. For each milestone you can:</p>
              <ul style="margin:0 0 4px;padding-left:18px">
                <li><strong>Check/uncheck S1</strong> &mdash; controls whether it appears on the overview slide</li>
                <li><strong>Change the Tier</strong> &mdash; if the auto-detected tier is wrong (it reads from the parent chain)</li>
                <li><strong>Change the Date</strong> &mdash; override the target end date</li>
                <li><strong>Change the Status</strong> &mdash; gray (not started), green (in progress), blue (complete), red (blocked)</li>
                <li><strong>Edit the Label</strong> &mdash; what text shows on the diamond</li>
              </ul>
              <p style="font-size:var(--fs-xs);color:var(--mu);margin:4px 0 12px">Gold dots next to a field mean you've manually edited it &mdash; re-seeding won't overwrite your changes.</p>

              <div style="font-weight:700;color:var(--a4);margin:12px 0 8px">Step 4: Configure the slide</div>
              <ul style="margin:0 0 12px;padding-left:18px">
                <li><strong>Title</strong> &mdash; the slide header text</li>
                <li><strong>From / To</strong> &mdash; which months to show (e.g., Jan 2026 &ndash; Dec 2026)</li>
                <li><strong>Tiers</strong> &mdash; which tier rows to include (T0, T1, T2, T3)</li>
                <li><strong>Emphasize</strong> &mdash; one tier gets a taller row (default: T1)</li>
              </ul>
              <p style="margin:0 0 12px">Optionally click <strong>Add Zoomed Slide</strong> to create a second slide with a tighter date range (e.g., Mar&ndash;Jul).</p>

              <div style="font-weight:700;color:var(--a4);margin:12px 0 8px">Step 5: Preview and generate</div>
              <p style="margin:0 0 4px">The <strong>Preview</strong> at the bottom of the editor shows a live SVG of your slide. Toggle milestones on/off and it updates instantly.</p>
              <p style="margin:0 0 4px">When you run the PMR report, the roadmap slide(s) appear before the first Tier 1 topic in the report.</p>
              <p style="margin:0 0 12px">Click <strong>Download PPTX</strong> and the roadmap slide is included in the deck with diamond-shaped milestones, a Next Steps panel, and a status legend.</p>

              <div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r2);padding:10px 14px;margin-top:8px">
                <div style="font-weight:600;font-size:var(--fs-xs);color:var(--mu);margin-bottom:6px">What the diamonds mean</div>
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:var(--fs-xs)">
                  <span><span style="display:inline-block;width:10px;height:10px;background:#8899BB;transform:rotate(45deg);margin-right:4px"></span>Not started</span>
                  <span><span style="display:inline-block;width:10px;height:10px;background:#0A7A4A;transform:rotate(45deg);margin-right:4px"></span>In progress</span>
                  <span><span style="display:inline-block;width:10px;height:10px;background:#0060B0;transform:rotate(45deg);margin-right:4px"></span>Complete</span>
                  <span><span style="display:inline-block;width:10px;height:10px;background:#C0392B;transform:rotate(45deg);margin-right:4px"></span>Blocked</span>
                </div>
                <div style="font-size:var(--fs-xs);color:var(--mu);margin-top:6px">The letter inside each diamond is the product: <strong>D</strong>=DataXplorer, <strong>L</strong>=LinkXplorer, <strong>R</strong>=Rollercoaster</div>
              </div>

            </div>
          </details>

          <!-- ════════ SPRINT PLAN ════════ -->
          <div id="guide-sprint" style="scroll-margin-top:12px"></div>
          <h3 class="u-a2-hdr" data-guide-section="sprint">Sprint Plan/Report</h3>
          <div style="background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);padding:14px 18px;margin-bottom:12px">
            <ol style="margin:0;padding-left:18px;color:var(--tx);font-size:var(--fs-sm);line-height:2.2">
              <li>Drop <strong>Issues CSV</strong> (epics not needed)</li>
              <li>Click <strong>Sprint Plan/Report</strong> &mdash; runs immediately</li>
              <li>Click <strong>Download VBA</strong> &rarr; open Excel &rarr; Alt+F11 &rarr; Import File &rarr; Run macro</li>
            </ol>
          </div>
          <p>Auto-detects current &amp; previous sprints from the calendar. Generates Sprint Plan and Sprint Report workbooks with 7 tabs each. Government employees (Excluded People) are filtered from counts.</p>
          <p style="font-size:var(--fs-xs);color:var(--mu)">The <strong>Sprint Delta</strong> box accepts pasted text from the Jira Sprint Report page to detect mid-sprint additions and removals.</p>

          <!-- ════════ SPIN PLAN ════════ -->
          <div id="guide-spin" style="scroll-margin-top:12px"></div>
          <h3 style="color:var(--a1);font-size:var(--fs-base);border-bottom:1px solid var(--bd);padding-bottom:4px;margin:20px 0 10px" data-guide-section="spin">Spin Plan</h3>
          <div style="background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);padding:14px 18px;margin-bottom:12px">
            <ol style="margin:0;padding-left:18px;color:var(--tx);font-size:var(--fs-sm);line-height:2.2">
              <li>Drop your <strong>Roadmap CSV</strong> (from Jira Plans export)</li>
              <li>Click <strong>Spin Plan</strong> &mdash; opens directly</li>
              <li>Switch between <strong>List</strong>, <strong>Column</strong>, and <strong>Spin</strong> views</li>
              <li>Click the summary chips (Epics, Stories, Behind, Blocked, Deps) to drill down</li>
            </ol>
          </div>
          <p>Must have a <code>Hierarchy</code> column. <code>Parent</code> can be issue keys or title strings &mdash; both work. CSV and TSV are auto-detected.</p>
          <p style="font-size:var(--fs-xs);color:var(--mu)">A <strong>diagnostic banner</strong> above the summary bar shows story/epic resolution counts. Amber = some stories didn't find their parent.</p>

          <!-- ════════ VELOCITY ════════ -->
          <div id="guide-velocity" style="scroll-margin-top:12px"></div>
          <h3 style="color:var(--a1);font-size:var(--fs-base);border-bottom:1px solid var(--bd);padding-bottom:4px;margin:20px 0 10px" data-guide-section="velocity">Sprint Velocity</h3>
          <p>Optional. If <code>velocity-report.js</code> is in the same folder, a <strong>Sprint Velocity</strong> card appears on the home screen. Remove the file to hide it. Uses the same Issues CSV and sprint calendar as other reports.</p>

          <!-- ════════ SETTINGS ════════ -->
          <div id="guide-config" style="scroll-margin-top:12px"></div>
          <h3 class="u-a1-hdr" data-guide-section="config">Settings</h3>
          <p>All settings auto-save to your browser. Use <strong>Export / Import Config</strong> to transfer between machines.</p>
          <ul class="u-list-indent-tight">
            <li><strong>General</strong> &mdash; Jira URL (makes ticket keys clickable), classification, contract info, roles, sprint prefixes</li>
            <li><strong>Weekly Digest</strong> &mdash; backend components (excluded), user-facing components, always-include keywords, excluded keywords</li>
            <li><strong>EOS</strong> &mdash; per-project report titles, MTL points, AI summary prompt (toggle + editable text)</li>
            <li><strong>PMR</strong> &mdash; title, topic groups, slide layouts, feature/bug type lists, Integrated Milestone Roadmap editor</li>
            <li><strong>Sprint Calendar</strong> &mdash; sprint dates (pre-populated FY26&ndash;FY27). Keep it current &mdash; it drives auto-detection everywhere</li>
            <li><strong>Topics</strong> &mdash; how tickets get bucketed into report sections (epic keys, keywords, phrases). Import/Export as JSON</li>
            <li><strong>Excluded People</strong> &mdash; government employees filtered from Sprint Plan counts only</li>
            <li><strong>Rule Overrides</strong> &mdash; quick fixes from the Unmatched tab. Persist across sessions. Export as backup</li>
            <li><strong>Appearance</strong> &mdash; dark/light theme, text size</li>
            <li><strong>Field Mapping</strong> &mdash; map non-standard Jira column names</li>
          </ul>

          <p style="font-weight:600;color:var(--tx);margin:0 0 8px">Status Icons</p>
          <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">
            <div class="u-flex-10"><span class="u-iflex"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#36B37E"/><path d="M2.5 5l1.8 1.8 3.2-3.2" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span style="color:var(--a3);font-weight:600;min-width:130px">Done</span><span style="color:var(--mu)">Closed, done, or resolved</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#0052CC"/><circle cx="5" cy="5" r="2" fill="#fff"/></svg></span><span style="color:var(--a1);font-weight:600;min-width:130px">In Progress</span><span style="color:var(--mu)">Actively being worked</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#6554C0"/><path d="M3 5h4M5 3v4" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg></span><span style="color:var(--a2);font-weight:600;min-width:130px">Reviewing / In Test</span><span style="color:var(--mu)">Awaiting review or QA</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="#8A97B8" stroke-width="1.5"/></svg></span><span style="color:var(--mu);font-weight:600;min-width:130px">Open / To Do</span><span style="color:var(--mu)">Not yet started</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg viewBox="0 0 16 16" width="11" height="11"><circle cx="8" cy="8" r="7" fill="#FF5630"/><rect x="3" y="7" width="10" height="2" rx="1" fill="#fff"/></svg></span><span style="color:var(--a5);font-weight:600;min-width:130px">Blocked</span><span style="color:var(--mu)">Cannot proceed — has a blocker</span></div>
          </div>

          <p style="font-weight:600;color:var(--tx);margin:0 0 8px">Issue Type Icons</p>
          <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">
            <div class="u-flex-10"><span class="u-iflex"><svg viewBox="0 0 16 16" width="14" height="14"><rect fill="#6554C0" width="16" height="16" rx="3"/><path d="M7 13l4.5-6H8.5L9 3 4.5 9H7.5L7 13z" fill="#fff"/></svg></span><span style="font-weight:600;color:var(--tx);min-width:130px">Epic</span><span style="color:var(--mu)">Large body of work spanning multiple stories</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg viewBox="0 0 16 16" width="14" height="14"><rect fill="#36B37E" width="16" height="16" rx="3"/><path d="M10.5 3h-5C5 3 4.5 3.5 4.5 4v9l3.5-2 3.5 2V4c0-.5-.5-1-1-1z" fill="#fff"/></svg></span><span style="font-weight:600;color:var(--tx);min-width:130px">Story</span><span style="color:var(--mu)">User-facing unit of work</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg viewBox="0 0 16 16" width="14" height="14"><rect fill="#FF5630" width="16" height="16" rx="3"/><circle cx="8" cy="9" r="3" fill="#fff"/><circle cx="8" cy="5.5" r="1.5" fill="#fff"/></svg></span><span style="font-weight:600;color:var(--tx);min-width:130px">Bug</span><span style="color:var(--mu)">Defect or unintended behavior</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg viewBox="0 0 16 16" width="14" height="14"><rect fill="#2684FF" width="16" height="16" rx="3"/><path d="M4 8l3 3 5-5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span style="font-weight:600;color:var(--tx);min-width:130px">Task</span><span style="color:var(--mu)">Technical or process work item</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg viewBox="0 0 16 16" width="14" height="14"><rect fill="#FF8B00" width="16" height="16" rx="3"/><rect x="3" y="4.5" width="4" height="2" rx="1" fill="#fff"/><rect x="3" y="7.5" width="7" height="2" rx="1" fill="#fff"/><rect x="3" y="10" width="5" height="1.5" rx=".75" fill="#fff"/></svg></span><span style="font-weight:600;color:var(--tx);min-width:130px">Program</span><span style="color:var(--mu)">Collection of related epics</span></div>
            <div class="u-flex-10"><span class="u-iflex"><svg viewBox="0 0 16 16" width="14" height="14"><rect fill="#00B8D9" width="16" height="16" rx="3"/><circle cx="8" cy="8" r="4" stroke="#fff" stroke-width="1.5" fill="none"/><circle cx="8" cy="8" r="1.5" fill="#fff"/></svg></span><span style="font-weight:600;color:var(--tx);min-width:130px">Strategy</span><span style="color:var(--mu)">Top-level initiative grouping programs</span></div>
          </div>

          <p style="font-weight:600;color:var(--tx);margin:0 0 8px">Alert Badges</p>
          <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">
            <div class="u-flex-10"><span class="badge b-behind"><span class="mi" style="font-size:11px;margin-right:2px">warning</span>2</span><span style="color:var(--mu)">Stories past their sprint end date, not yet done</span></div>
            <div class="u-flex-10"><span class="badge b-blocked"><svg viewBox="0 0 16 16" width="11" height="11" style="vertical-align:middle;margin-right:2px"><circle cx="8" cy="8" r="7" fill="#FF5630"/><rect x="3" y="7" width="10" height="2" rx="1" fill="#fff"/></svg> 1</span><span style="color:var(--mu)">Count of blocked stories in this epic</span></div>
            <div class="u-flex-10"><span class="badge b-dep"><svg viewBox="0 0 16 16" width="12" height="10" style="vertical-align:middle;margin-right:2px;color:var(--a2)"><path d="M6.5 4.5h-1A3 3 0 005 10.5h1a1 1 0 000-2H5a1 1 0 010-2h1.5a1 1 0 000-2zm3 0a1 1 0 000 2H11a1 1 0 010 2h-1.5a1 1 0 000 2H11A3 3 0 0011 4.5h-1.5zm-3.5 4a1 1 0 000 2h3a1 1 0 000-2H6z" fill="currentColor"/></svg> 3</span><span style="color:var(--mu)">Open blocker or linked ticket dependencies</span></div>
          </div>

          <p style="font-weight:600;color:var(--tx);margin:0 0 8px">Progress Bars</p>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:12px"><div style="width:60px;height:6px;border-radius:3px;background:var(--a3);flex-shrink:0"></div><span style="color:var(--a3);font-weight:600;min-width:60px">&#8805; 67%</span><span style="color:var(--mu)">On track</span></div>
            <div style="display:flex;align-items:center;gap:12px"><div style="width:60px;height:6px;border-radius:3px;background:var(--a4);flex-shrink:0"></div><span style="color:var(--a4);font-weight:600;min-width:60px">34–66%</span><span style="color:var(--mu)">In progress — watch this</span></div>
            <div style="display:flex;align-items:center;gap:12px"><div style="width:60px;height:6px;border-radius:3px;background:var(--a5);flex-shrink:0"></div><span style="color:var(--a5);font-weight:600;min-width:60px">&lt; 34%</span><span style="color:var(--mu)">Needs attention</span></div>
          </div>

          <!-- ==== TIPS ==== -->
          <div id="guide-tips" style="scroll-margin-top:12px"></div>
          <h3 style="color:var(--a3);font-size:var(--fs-base);border-bottom:1px solid var(--bd);padding-bottom:4px;margin:20px 0 10px" data-guide-section="tips">Tips</h3>
          <ul style="padding-left:18px;display:flex;flex-direction:column;gap:6px">
            <li><strong>Keep the sprint calendar current.</strong> It drives auto-detection in EOS and Sprint Plan. Always have at least one sprint after the current one.</li>
            <li><strong>Fill in summaries before copying.</strong> Confluence copy reads the live text at the moment you click.</li>
            <li><strong>Use the Debug tab</strong> in EOS and PMR to see exactly why a ticket ended up where it did.</li>
            <li><strong>Ticket in the wrong section?</strong> Click <strong>+ Create Rule</strong> in the Unmatched tab. For recurring issues, edit the Topic directly.</li>
            <li><strong>Text too small?</strong> Settings &rarr; Appearance &rarr; adjust text size.</li>
            <li><strong>Back up your settings.</strong> Export Config &amp; Overrides before major changes.</li>
          </ul>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
    buildGuideNav(overlay);  // populate nav + h3 icons from APP_ICONS
  } else {
    overlay.remove();
  }
}


