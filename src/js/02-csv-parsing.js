// ============================================================
// NAVIGATION
// ============================================================
const PAGE_TITLES = {
  files:'Files', config:'Configuration', topics:'Topics', people:'Excluded People',
  weekly:'Weekly Digest', eos:'End of Sprint', pmr:'PMR', sprint:'Sprint Plan/Report',
    overrides:'Rule Overrides', classification:'Classification'
};


// ============================================================
// CSV PARSING
// ============================================================
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if(!lines.length) return [];
  // Auto-detect delimiter: if the first line has more tabs than commas, treat
  // as TSV. Jira Plans exports can be either format depending on whether the
  // user exports from the UI (CSV) or copies from a spreadsheet (TSV).
  const firstLine = lines[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delim = tabCount > commaCount ? '\t' : ',';
  const delimRe = delim === '\t'
    ? /("(?:[^"]|"")*"|[^\t]*)\t?/g
    : /("(?:[^"]|"")*"|[^,]*),?/g;
  function parseLine(line) {
    const out=[];
    let m;
    const re = new RegExp(delimRe.source, 'g');
    while((m=re.exec(line))!==null) {
      if(m.index===re.lastIndex) { re.lastIndex++; break; }
      let v=m[1];
      if(v.startsWith('"')&&v.endsWith('"')) v=v.slice(1,-1).replace(/""/g,'"');
      out.push(v);
    }
    return out;
  }
  const rawHeaders = parseLine(lines[0]);
  // Rename duplicate headers: Sprint -> Sprint, Sprint -> Sprint.1, Sprint -> Sprint.2 ...
  const seen={};
  const headers = rawHeaders.map(h=>{
    const k=h.trim();
    if(seen[k]===undefined){ seen[k]=0; return k; }
    seen[k]++;
    return `${k}.${seen[k]}`;
  });
  const rows=[];
  for(let i=1;i<lines.length;i++) {
    if(!lines[i].trim()) continue;
    const vals=parseLine(lines[i]);
    const row={};
    headers.forEach((h,j)=>row[h]=(vals[j]||'').trim());
    rows.push(row);
  }
  return rows;
}

function normText(v){ return ((v||'').trim()).replace(/\s+/g,' '); }
function normLower(v){ return normText(v).toLowerCase(); }
function normSet(v){
  const raw=(v||'').trim();
  if(!raw) return [];
  return raw.replace(/;/g,',').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
}
function parseDate(v){
  v=(v||'').trim(); if(!v) return null;
  const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  function yr(s){ let y=parseInt(s); return y<100?(y<70?2000+y:1900+y):y; }
  function ampm(hr,ap){ if(!ap) return parseInt(hr); const h=parseInt(hr); return ap.toUpperCase()==='PM'?(h!==12?h+12:12):(h===12?0:h); }
  function utc(Y,M,D,h,mi,s){ return new Date(Date.UTC(Y,M,D,h||0,mi||0,s||0)); }
  let m, d;

  // ISO 8601: 2025-05-20, 2025-05-20 14:30, 2025-05-20T14:30:00Z — normalise to UTC
  m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?/);
  if(m){
    // If explicit timezone present let browser parse; otherwise treat as UTC
    const hasZ = m[7] && /Z|[+-]/.test(m[7]);
    d = hasZ ? new Date(v) : utc(+m[1],+m[2]-1,+m[3],m[4]?+m[4]:0,m[5]?+m[5]:0,m[6]?+m[6]:0);
    if(!isNaN(d.getTime())) return d;
  }

  // DD/MMM/YYYY HH:MM[:SS] [AM|PM]
  m=v.match(/^(\d{1,2})\/([A-Za-z]{3,9})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if(m){ d=utc(yr(m[3]),MONTHS[m[2].toLowerCase().slice(0,3)],+m[1],ampm(m[4],m[7]),+m[5],m[6]?+m[6]:0); if(!isNaN(d.getTime())) return d; }

  // DD/MMM/YYYY
  m=v.match(/^(\d{1,2})\/([A-Za-z]{3,9})\/(\d{2,4})$/i);
  if(m){ d=utc(yr(m[3]),MONTHS[m[2].toLowerCase().slice(0,3)],+m[1]); if(!isNaN(d.getTime())) return d; }

  // DD-MMM-YYYY [HH:MM[:SS] [AM|PM]]
  m=v.match(/^(\d{1,2})-([A-Za-z]{3,9})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if(m){ d=utc(yr(m[3]),MONTHS[m[2].toLowerCase().slice(0,3)],+m[1],m[4]?ampm(m[4],m[7]):0,m[5]?+m[5]:0); if(!isNaN(d.getTime())) return d; }

  // MMM DD, YYYY [HH:MM[:SS] [AM|PM]]
  m=v.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if(m){ d=utc(+m[3],MONTHS[m[1].toLowerCase().slice(0,3)],+m[2],m[4]?ampm(m[4],m[7]):0,m[5]?+m[5]:0); if(!isNaN(d.getTime())) return d; }

  // MM/DD/YYYY [HH:MM[:SS] [AM|PM]]
  m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/);
  if(m){ d=utc(yr(m[3]),+m[1]-1,+m[2],m[4]?ampm(m[4],m[7]):0,m[5]?+m[5]:0); if(!isNaN(d.getTime())) return d; }

  // DD.MM.YYYY [HH:MM]
  m=v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if(m){ d=utc(+m[3],+m[2]-1,+m[1],m[4]?+m[4]:0,m[5]?+m[5]:0); if(!isNaN(d.getTime())) return d; }

  // Last resort: parse then shift to midnight UTC of same date
  d=new Date(v);
  if(!isNaN(d.getTime())) return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()));
  return null;
}
function bucketKey(key){
  key=normText(key);
  if(key.startsWith('DX-')) return 'DX';
  if(key.startsWith('LX-')) return 'LX';
  if(key.startsWith('RCR-')) return 'RC';
  if(key.startsWith('AFX-')) return 'AFX';
  return null; // unrecognized prefix — not a known project bucket
}
function parsePoints(row){
  const raw=row['Story Points']||row['Story point estimate']||'0';
  const v=parseFloat(raw)||0;
  return v===Math.floor(v)?Math.floor(v):v;
}
const _isDone=s=>['done','closed','resolved'].includes(normLower(s));

const BLOCKED_ICON=`<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#FF5630"/><rect x="3" y="7" width="10" height="2" rx="1" fill="#fff"/></svg>`;

const ISSUE_ICONS={
  epic:    `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#6554C0" width="16" height="16" rx="3"/><path d="M7 13l4.5-6H8.5L9 3 4.5 9H7.5L7 13z" fill="#fff"/></svg>`,
  story:   `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#36B37E" width="16" height="16" rx="3"/><path d="M10.5 3h-5C5 3 4.5 3.5 4.5 4v9l3.5-2 3.5 2V4c0-.5-.5-1-1-1z" fill="#fff"/></svg>`,
  bug:     `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#FF5630" width="16" height="16" rx="3"/><circle cx="8" cy="9" r="3" fill="#fff"/><circle cx="8" cy="5.5" r="1.5" fill="#fff"/><rect x="6.5" y="6.5" width="3" height="1" fill="#FF5630" rx=".5"/></svg>`,
  task:    `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#2684FF" width="16" height="16" rx="3"/><path d="M4 8l3 3 5-5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  subtask: `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><rect fill="#2684FF" width="16" height="16" rx="3" opacity=".7"/><path d="M4.5 8.5l2.5 2.5L11 6" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function mi(name,extraStyle){
  return '<span class="mi"' + (extraStyle ? ' style="' + extraStyle + '"' : '') + '>' + name + '</span>';
}

