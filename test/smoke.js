'use strict';

/*
 * Smoke test: load the app's data modules in a sandbox and run them against the
 * sample fixtures. No framework — just asserts and a non-zero exit on failure.
 * Run with `node test/smoke.js` (or `npm test`).
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');

// ─── Load app modules into a shared sandbox ──────────────────────────────────
// The modules declare `const DATA = ...` etc., which don't attach to the vm
// context, so re-export them onto `this` after each file runs.
const ctx = { console };
vm.createContext(ctx);
const expose =
  '\nthis.HOLIDAYS=typeof HOLIDAYS!=="undefined"?HOLIDAYS:this.HOLIDAYS;' +
  'this.DATA=typeof DATA!=="undefined"?DATA:this.DATA;' +
  'this.ICAL_PARSER=typeof ICAL_PARSER!=="undefined"?ICAL_PARSER:this.ICAL_PARSER;';
for (const f of ['holidays.js', 'data.js', 'ical.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8') + expose, ctx, { filename: f });
}
const { DATA, ICAL_PARSER, HOLIDAYS } = ctx;
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

// ─── Historical CSV → velocity ───────────────────────────────────────────────
console.log('historical-jira.csv');
const histTickets = DATA.parseCSV(read('historical-jira.csv'))
  .map(DATA.buildTicket).filter(t => t.key && t.sprints.length);

check('parses a non-trivial number of tickets', () => {
  assert(histTickets.length >= 20, `only ${histTickets.length} tickets`);
});
check('RCR- key buckets to RC project', () => {
  const t = histTickets.find(t => t.key === 'RCR-401');
  assert(t && t.project === 'RC', `got ${t && t.project}`);
});

const vel = DATA.computeVelocity(histTickets, DATA.DEFAULT_RESOLUTIONS, PROJ_MAP);
check('all five people have velocity history (>=2 sprints)', () => {
  for (const name of Object.keys(PROJ_MAP)) {
    assert(vel[name], `no velocity for ${name}`);
    assert(vel[name].sprintCount >= 2, `${name} has only ${vel[name].sprintCount} sprint(s)`);
  }
});
check('unassigned ticket is excluded from velocity', () => {
  assert(!vel[''] && !vel['undefined'], 'unassigned work leaked into velocity');
});
check('zero-point and unresolved tickets do not inflate counts', () => {
  // Carol has 5 done point-bearing sprints; the zero-point chore must not add one.
  assert(vel['Carol Diaz'].sprintCount === 5, `Carol sprintCount=${vel['Carol Diaz'].sprintCount}`);
});

// ─── Backlog CSV ─────────────────────────────────────────────────────────────
console.log('backlog-sprint.csv');
const backlog = DATA.parseCSV(read('backlog-sprint.csv'))
  .map(DATA.buildTicket).filter(t => t.key);
check('backlog has tickets across all three projects', () => {
  const projects = new Set(backlog.map(t => t.project));
  for (const p of DATA.PROJECTS) assert(projects.has(p), `missing project ${p}`);
});
check('backlog tickets carry story points', () => {
  assert(backlog.some(t => t.points > 0), 'no backlog ticket has points');
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
  const person = { name: 'Alice Nguyen', sid: 'anguyen', type: 'gov', goalPoints: 8 };
  const cap = DATA.computeCapacity(person, '2026-06-01', '2026-06-12', leave, vel);
  assert(cap.leaveDays > 0, 'expected Alice to have leave in this window');
  assert(cap.availDays < cap.totalWorkDays, 'availDays should drop below totalWorkDays');
});

console.log(`\n${passed} checks passed.`);
if (process.exitCode) console.error('Smoke test FAILED.');
