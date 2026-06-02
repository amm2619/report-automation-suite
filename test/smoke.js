'use strict';

/*
 * Smoke test: load the app's data modules in a sandbox and run them against the
 * sample fixtures. No framework — just asserts and a non-zero exit on failure.
 * Run with `node test/smoke.js` (or `npm test`).
 *
 * parseHTML uses the browser DOMParser; in Node we inject jsdom's so the exact
 * same code path the browser uses is exercised here.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');

// ─── Load app modules into a shared sandbox ──────────────────────────────────
// The modules declare `const DATA = ...` etc., which don't attach to the vm
// context, so re-export them onto `this` after each file runs.
const ctx = { console, DOMParser: new JSDOM().window.DOMParser };
vm.createContext(ctx);
const expose =
  '\nthis.HOLIDAYS=typeof HOLIDAYS!=="undefined"?HOLIDAYS:this.HOLIDAYS;' +
  'this.DATA=typeof DATA!=="undefined"?DATA:this.DATA;' +
  'this.ICAL_PARSER=typeof ICAL_PARSER!=="undefined"?ICAL_PARSER:this.ICAL_PARSER;';
for (const f of ['holidays.js', 'data.js', 'ical.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8') + expose, ctx, { filename: f });
}
const { DATA, ICAL_PARSER } = ctx;
const read = f => fs.readFileSync(path.join(root, 'sample-data', f), 'utf8');

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}\n    ${e.message}`); process.exitCode = 1; }
}

const PROJ_MAP = {
  'Alice Nguyen': 'DX', 'Bob Carter': 'LX', 'Carol Diaz': 'RC',
  'Dev Patel': 'DX', 'Erin Walsh': 'LX',
};

// ─── Historical Jira HTML → velocity ─────────────────────────────────────────
console.log('historical-jira.html');
const histTickets = DATA.parseHTML(read('historical-jira.html'))
  .map(DATA.buildTicket).filter(t => t.key && t.sprints.length);

check('parses a non-trivial number of tickets from the Jira table', () => {
  assert(histTickets.length >= 20, `only ${histTickets.length} tickets`);
});
check('reads story points from the "Custom field (Story Points)" column', () => {
  const t = histTickets.find(t => t.key === 'DX-10101');
  assert(t && t.points === 5, `DX-10101 points = ${t && t.points}`);
});
check('RCR- key buckets to the RC project', () => {
  const t = histTickets.find(t => t.key === 'RCR-3001');
  assert(t && t.project === 'RC', `got ${t && t.project}`);
});
check('multi-line descriptions survive intact (not split across lines)', () => {
  const t = histTickets.find(t => t.key === 'DX-10101');
  assert(t.description.includes('\n'), 'expected a multi-line description');
  assert(/Acceptance criteria/.test(t.description), 'description body missing');
  assert(/Progress indicator/.test(t.description), 'list item text missing');
});
check('a carried-over ticket lands in both of its sprints', () => {
  const t = histTickets.find(t => t.key === 'DX-10104');
  assert(t.sprints.includes('26.1.2') && t.sprints.includes('26.1.3'), `sprints = ${t.sprints}`);
});

const vel = DATA.computeVelocity(histTickets, DATA.DEFAULT_RESOLUTIONS, PROJ_MAP);
check('all five people have velocity history (>=2 sprints)', () => {
  for (const name of Object.keys(PROJ_MAP)) {
    assert(vel[name], `no velocity for ${name}`);
    assert(vel[name].sprintCount >= 2, `${name} has only ${vel[name].sprintCount} sprint(s)`);
  }
});
check('unassigned + zero-point + unresolved tickets are excluded from velocity', () => {
  assert(!vel[''] && !vel['undefined'], 'unassigned work leaked into velocity');
  assert(vel['Carol Diaz'].sprintCount === 5, `Carol sprintCount=${vel['Carol Diaz'].sprintCount}`);
});

// ─── Backlog Jira HTML ───────────────────────────────────────────────────────
console.log('backlog-sprint.html');
const backlog = DATA.parseHTML(read('backlog-sprint.html'))
  .map(DATA.buildTicket).filter(t => t.key);
check('backlog has tickets across all three projects', () => {
  const projects = new Set(backlog.map(t => t.project));
  for (const p of DATA.PROJECTS) assert(projects.has(p), `missing project ${p}`);
});
check('some backlog tickets carry an assignee (drive auto-assignment)', () => {
  const assigned = backlog.filter(t => t.assignee);
  assert(assigned.length >= 3, `only ${assigned.length} pre-assigned tickets`);
  assert(assigned.some(t => t.assignee === 'Alice Nguyen'), 'expected an Alice ticket');
});
check('an empty Jira assignee ("Unassigned") is normalized to blank', () => {
  assert(backlog.some(t => !t.assignee), 'expected some unassigned tickets');
  assert(!backlog.some(t => /^unassigned$/i.test(t.assignee)), '"Unassigned" leaked through as a name');
});

// ─── iCal leave ──────────────────────────────────────────────────────────────
console.log('leave.ics');
const events = ICAL_PARSER.parse(read('leave.ics'));
const leave  = ICAL_PARSER.toLeaveDates(events, false);
check('every event resolves a SID (organizer or attendee)', () => {
  assert(events.length >= 5, `only ${events.length} events`);
  assert(events.every(e => e.sid), 'an event has no SID');
});
check('leave expands to per-day records, weekends skipped', () => {
  assert(leave.length >= 10, `only ${leave.length} leave-days`);
  for (const d of leave) {
    const dow = new Date(d.date + 'T00:00:00').getDay();
    assert(dow !== 0 && dow !== 6, `weekend leave day ${d.date}`);
  }
});
check('leave SIDs match the documented people', () => {
  const sids = new Set(leave.map(d => d.sid));
  for (const s of ['anguyen', 'bcarter', 'cdiaz', 'dpatel', 'ewalsh']) {
    assert(sids.has(s), `missing leave for SID ${s}`);
  }
});

// ─── Capacity sanity (ties the pieces together) ──────────────────────────────
console.log('capacity');
check('leave reduces available days within a sprint', () => {
  const person = { name: 'Alice Nguyen', sid: 'anguyen', type: 'contractor', goalPoints: 8 };
  const cap = DATA.computeCapacity(person, '2026-06-01', '2026-06-12', leave, vel);
  assert(cap.leaveDays > 0, 'expected Alice to have leave in this window');
  assert(cap.availDays < cap.totalWorkDays, 'availDays should drop below totalWorkDays');
});

console.log(`\n${passed} checks passed.`);
if (process.exitCode) console.error('Smoke test FAILED.');
