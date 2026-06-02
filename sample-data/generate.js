'use strict';

/*
 * Generates Jira-export-style HTML fixtures (sample-data/*.html) for the
 * Sprint Planner. The markup mirrors Jira's issue-navigator "Export → HTML":
 * a <table id="issuetable"> whose <th> cells are field names — including the
 * literal "Custom field (Story Points)" — and whose <tr class="issuerow">
 * rows are the tickets (Key + Summary + fields all on one line).
 *
 * Run:  node sample-data/generate.js
 */

const fs   = require('fs');
const path = require('path');

const JIRA = 'https://jira.example.com';

// Columns, in display order. `field` is the Jira field name shown in the <th>.
const COLUMNS = [
  { field: 'Issue Type',                  cls: 'issuetype' },
  { field: 'Key',                         cls: 'issuekey' },
  { field: 'Summary',                     cls: 'summary' },
  { field: 'Assignee',                    cls: 'assignee' },
  { field: 'Status',                      cls: 'status' },
  { field: 'Resolution',                  cls: 'resolution' },
  { field: 'Custom field (Story Points)', cls: 'customfield' },
  { field: 'Sprint',                      cls: 'sprint' },
  { field: 'Epic Link',                   cls: 'epic' },
  { field: 'Labels',                      cls: 'labels' },
  { field: 'Description',                 cls: 'description' },
];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Render a single field's <td> the way Jira's export nests its markup.
function cell(col, t) {
  switch (col.cls) {
    case 'issuetype':
      return `<td class="issuetype"><img src="${JIRA}/images/icons/${esc(t.type)}.png" alt="${esc(t.type)}" title="${esc(t.type)}" height="16" width="16"></td>`;
    case 'issuekey':
      return `<td class="issuekey"><a href="${JIRA}/browse/${esc(t.key)}" class="issue-link" data-issue-key="${esc(t.key)}">${esc(t.key)}</a></td>`;
    case 'summary':
      return `<td class="summary"><p><a href="${JIRA}/browse/${esc(t.key)}">${esc(t.summary)}</a></p></td>`;
    case 'assignee':
      return `<td class="assignee">${t.assignee ? `<span class="user-hover">${esc(t.assignee)}</span>` : '<span class="unassigned-user">Unassigned</span>'}</td>`;
    case 'status':
      return `<td class="status"><span class="jira-issue-status-lozenge">${esc(t.status)}</span></td>`;
    case 'resolution':
      return `<td class="resolution">${esc(t.resolution || 'Unresolved')}</td>`;
    case 'customfield':
      return `<td class="customfield">${t.points == null ? '' : esc(t.points)}</td>`;
    case 'sprint':
      return `<td class="sprint">${esc(t.sprint || '')}</td>`;
    case 'epic':
      return `<td class="epic">${esc(t.epic || '')}</td>`;
    case 'labels':
      return `<td class="labels">${(t.labels || []).length
        ? `<ul class="labels">${t.labels.map(l => `<li><span class="lozenge">${esc(l)}</span></li>`).join('')}</ul>`
        : ''}</td>`;
    case 'description':
      // Jira wraps descriptions in a div with rich HTML — paragraphs, lists, breaks.
      return `<td class="description"><div class="description">${t.description || ''}</div></td>`;
    default:
      return '<td></td>';
  }
}

function render(title, tickets) {
  const head = COLUMNS.map(c => `<th class="colHeaderLink headerrow-${c.cls}">${esc(c.field)}</th>`).join('');
  const body = tickets.map(t =>
    `<tr class="issuerow" data-issuekey="${esc(t.key)}">${COLUMNS.map(c => cell(c, t)).join('')}</tr>`
  ).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
</head>
<body class="jira">
<h1>${esc(title)}</h1>
<table id="issuetable" class="aui aui-table-rowhover">
<thead><tr class="rowHeader">${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
<p class="result-count">Displaying <strong>${tickets.length}</strong> issues.</p>
</body>
</html>
`;
}

// ── Multi-line descriptions (rich HTML, like a real Jira export) ──────────────
const D = {
  onboarding: `<p>The current onboarding wizard loses users at step 1.</p>
<p>Acceptance criteria:</p>
<ul><li>Progress indicator across all steps</li><li>Inline field validation</li><li>Back/Next preserve state</li></ul>
<p>See the Figma link in the epic for the target design.</p>`,
  proration: `<p>When a customer upgrades mid-cycle we must prorate the remaining days.</p>
<p>Formula: <code>(newRate - oldRate) * daysRemaining / daysInCycle</code>.</p>
<p>Round to the nearest cent; never charge a negative amount.</p>`,
  rollup: `<p>Nightly job aggregates raw usage events into per-account daily totals.</p>
<p>Must be idempotent — re-running for a date overwrites, never duplicates.</p>`,
  retention: `<p>Cohort retention chart grouped by signup week.</p>
<p>Backend returns a matrix; the frontend renders the heatmap. Cache results for 1 hour.</p>`,
  notifPrefs: `<p>Let users choose per-channel notification preferences (email, push, in-app).</p>
<p>Defaults: email on, push off. Honor a global mute switch.</p>`,
  toast: `<p>Reusable toast/notification component for the design system.</p>
<p>Variants: info, success, warning, error. Auto-dismiss after 5s; pause on hover.</p>`,
};

// ── HISTORICAL (completed work → drives velocity) ─────────────────────────────
// Keys: DX-##### (DataXplorer), LX-#### (LinkXplorer), RCR-#### (ROLLERCOASTER).
const historical = [
  { type: 'Story', key: 'DX-10101', summary: 'Redesign the account onboarding wizard, step 1', assignee: 'Alice Nguyen', status: 'Done', resolution: 'Done', points: 5, sprint: '26.1.1', epic: 'Onboarding Revamp', labels: ['frontend'], description: D.onboarding },
  { type: 'Story', key: 'DX-10102', summary: 'Add inline validation to the signup form', assignee: 'Alice Nguyen', status: 'Done', resolution: 'Done', points: 3, sprint: '26.1.1', epic: 'Onboarding Revamp', labels: ['frontend'] },
  { type: 'Bug',   key: 'DX-10103', summary: 'Fix avatar upload crash on Safari', assignee: 'Alice Nguyen', status: 'Done', resolution: 'Fixed', points: 2, sprint: '26.1.2', epic: 'Onboarding Revamp', labels: ['bug'] },
  { type: 'Story', key: 'DX-10104', summary: 'Build profile completeness meter (carried across sprints)', assignee: 'Alice Nguyen', status: 'Done', resolution: 'Done', points: 8, sprint: '26.1.2 + 26.1.3', epic: 'Onboarding Revamp', labels: ['frontend'] },
  { type: 'Story', key: 'DX-10105', summary: 'Implement typeahead search suggestions', assignee: 'Alice Nguyen', status: 'Done', resolution: 'Done', points: 5, sprint: '26.2.1', epic: 'Search Overhaul', labels: ['frontend'] },
  { type: 'Story', key: 'DX-10106', summary: 'Faceted filters sidebar (not finished)', assignee: 'Alice Nguyen', status: 'In Progress', resolution: '', points: 5, sprint: '26.2.2', epic: 'Search Overhaul', labels: ['frontend'] },

  { type: 'Story', key: 'LX-2001', summary: 'Port invoice generation to the new service', assignee: 'Bob Carter', status: 'Done', resolution: 'Done', points: 8, sprint: '26.1.1', epic: 'Billing Migration', labels: ['backend'] },
  { type: 'Story', key: 'LX-2002', summary: 'Add proration logic for mid-cycle upgrades', assignee: 'Bob Carter', status: 'Done', resolution: 'Resolved', points: 5, sprint: '26.1.2', epic: 'Billing Migration', labels: ['backend'], description: D.proration },
  { type: 'Bug',   key: 'LX-2003', summary: 'Rounding error on tax — off by one cent', assignee: 'Bob Carter', status: 'Done', resolution: 'Fixed', points: 3, sprint: '26.1.3', epic: 'Billing Migration', labels: ['bug'] },
  { type: 'Story', key: 'LX-2004', summary: 'Retry failed charges with exponential backoff', assignee: 'Bob Carter', status: 'Done', resolution: 'Done', points: 5, sprint: '26.2.1', epic: 'Billing Migration', labels: ['backend'] },
  { type: 'Task',  key: 'LX-2005', summary: 'Add dashboards for charge success rate', assignee: 'Bob Carter', status: 'Done', resolution: 'Done', points: 2, sprint: '26.2.2', epic: 'Billing Migration', labels: ['ops'] },
  { type: 'Story', key: 'LX-2006', summary: 'Dunning email sequence (backlog)', assignee: 'Bob Carter', status: 'To Do', resolution: '', points: 8, sprint: '26.2.3', epic: 'Billing Migration', labels: ['backend'] },

  { type: 'Story', key: 'RCR-3001', summary: 'Nightly rollup job for usage metrics', assignee: 'Carol Diaz', status: 'Done', resolution: 'Done', points: 5, sprint: '26.1.1', epic: 'Reporting Suite', labels: ['backend'], description: D.rollup },
  { type: 'Story', key: 'RCR-3002', summary: 'Export report to CSV', assignee: 'Carol Diaz', status: 'Done', resolution: 'Completed', points: 3, sprint: '26.1.2', epic: 'Reporting Suite', labels: ['backend'] },
  { type: 'Bug',   key: 'RCR-3003', summary: 'Timezone offset wrong in scheduled reports', assignee: 'Carol Diaz', status: 'Done', resolution: 'Fixed', points: 2, sprint: '26.1.3', epic: 'Reporting Suite', labels: ['bug'] },
  { type: 'Story', key: 'RCR-3004', summary: 'Add cohort retention chart', assignee: 'Carol Diaz', status: 'Done', resolution: 'Done', points: 8, sprint: '26.2.1', epic: 'Reporting Suite', labels: ['backend'], description: D.retention },
  { type: 'Story', key: 'RCR-3005', summary: 'Cache expensive aggregate queries', assignee: 'Carol Diaz', status: 'Done', resolution: 'Done', points: 5, sprint: '26.2.2', epic: 'Reporting Suite', labels: ['backend'] },
  { type: 'Task',  key: 'RCR-3006', summary: 'Zero-point chore (excluded from velocity)', assignee: 'Carol Diaz', status: 'Done', resolution: 'Done', points: 0, sprint: '26.2.3', epic: 'Reporting Suite', labels: ['chore'] },

  { type: 'Story', key: 'DX-10110', summary: 'Extract button component to shared lib', assignee: 'Dev Patel', status: 'Done', resolution: 'Done', points: 3, sprint: '26.1.1', epic: 'Design System', labels: ['frontend'] },
  { type: 'Story', key: 'DX-10111', summary: 'Token-ize the color palette', assignee: 'Dev Patel', status: 'Done', resolution: 'Done', points: 5, sprint: '26.1.2', epic: 'Design System', labels: ['frontend'] },
  { type: 'Story', key: 'DX-10112', summary: 'Migrate modals to the new dialog primitive', assignee: 'Dev Patel', status: 'Done', resolution: 'Done', points: 5, sprint: '26.2.1', epic: 'Design System', labels: ['frontend'] },
  { type: 'Bug',   key: 'DX-10113', summary: 'Focus trap escapes on nested modals', assignee: 'Dev Patel', status: 'Done', resolution: 'Fixed', points: 2, sprint: '26.2.2', epic: 'Design System', labels: ['bug'] },

  { type: 'Story', key: 'LX-2010', summary: 'Email digest scheduler', assignee: 'Erin Walsh', status: 'Done', resolution: 'Done', points: 5, sprint: '26.1.1', epic: 'Notifications', labels: ['backend'] },
  { type: 'Story', key: 'LX-2011', summary: 'Push notification delivery pipeline', assignee: 'Erin Walsh', status: 'Done', resolution: 'Done', points: 8, sprint: '26.1.2', epic: 'Notifications', labels: ['backend'] },
  { type: 'Task',  key: 'LX-2012', summary: 'Add per-user notification preferences', assignee: 'Erin Walsh', status: 'Done', resolution: 'Done', points: 3, sprint: '26.2.1', epic: 'Notifications', labels: ['ops'], description: D.notifPrefs },
  { type: 'Story', key: 'LX-2013', summary: 'Batch notifications to reduce noise', assignee: 'Erin Walsh', status: 'Done', resolution: 'Done', points: 5, sprint: '26.2.2', epic: 'Notifications', labels: ['backend'] },
  { type: 'Bug',   key: 'LX-2014', summary: 'Duplicate emails on retry (still open)', assignee: 'Erin Walsh', status: 'Reopened', resolution: '', points: 3, sprint: '26.2.3', epic: 'Notifications', labels: ['bug'] },

  { type: 'Story', key: 'DX-10120', summary: 'Unassigned cleanup ticket (should be ignored)', assignee: '', status: 'Done', resolution: 'Done', points: 3, sprint: '26.1.1', epic: 'Tech Debt', labels: ['chore'] },
];

// ── BACKLOG (upcoming sprint 26.3.1 → planning) ───────────────────────────────
// Tickets WITH an assignee are auto-assigned in the planner; the rest are open.
const backlog = [
  { type: 'Story', key: 'DX-10130', summary: 'Saved searches with shareable URLs', assignee: '', status: 'To Do', resolution: '', points: 5, sprint: '26.3.1', epic: 'Search Overhaul', labels: ['frontend'] },
  { type: 'Story', key: 'DX-10131', summary: 'Empty-state illustrations for no results', assignee: '', status: 'To Do', resolution: '', points: 3, sprint: '26.3.1', epic: 'Search Overhaul', labels: ['frontend'] },
  { type: 'Bug',   key: 'DX-10132', summary: 'Highlight matched terms in result snippets', assignee: 'Alice Nguyen', status: 'To Do', resolution: '', points: 2, sprint: '26.3.1', epic: 'Search Overhaul', labels: ['bug'] },
  { type: 'Story', key: 'DX-10133', summary: 'Offline mode for recently viewed items', assignee: '', status: 'To Do', resolution: '', points: 8, sprint: '26.3.1', epic: 'Mobile App', labels: ['frontend'] },
  { type: 'Story', key: 'DX-10134', summary: 'Dark mode audit for form controls', assignee: '', status: 'To Do', resolution: '', points: 3, sprint: '26.3.1', epic: 'Design System', labels: ['frontend'] },
  { type: 'Story', key: 'DX-10135', summary: 'Toast notification component', assignee: 'Dev Patel', status: 'To Do', resolution: '', points: 5, sprint: '26.3.1', epic: 'Design System', labels: ['frontend'], description: D.toast },

  { type: 'Story', key: 'LX-2020', summary: 'Self-serve plan downgrade flow', assignee: '', status: 'To Do', resolution: '', points: 8, sprint: '26.3.1', epic: 'Billing Migration', labels: ['backend'] },
  { type: 'Story', key: 'LX-2021', summary: 'Webhook for payment provider events', assignee: 'Bob Carter', status: 'To Do', resolution: '', points: 5, sprint: '26.3.1', epic: 'Billing Migration', labels: ['backend'] },
  { type: 'Task',  key: 'LX-2022', summary: 'Alerting on failed dunning emails', assignee: '', status: 'To Do', resolution: '', points: 3, sprint: '26.3.1', epic: 'Billing Migration', labels: ['ops'] },
  { type: 'Story', key: 'LX-2023', summary: 'In-app notification center', assignee: '', status: 'To Do', resolution: '', points: 5, sprint: '26.3.1', epic: 'Notifications', labels: ['backend'] },
  { type: 'Story', key: 'LX-2024', summary: 'Digest frequency A/B test framework', assignee: '', status: 'To Do', resolution: '', points: 8, sprint: '26.3.1', epic: 'Notifications', labels: ['backend'] },
  { type: 'Task',  key: 'LX-2025', summary: 'Backfill notification preference defaults', assignee: 'Erin Walsh', status: 'To Do', resolution: '', points: 2, sprint: '26.3.1', epic: 'Notifications', labels: ['ops'] },

  { type: 'Story', key: 'RCR-3020', summary: 'Scheduled report delivery via Slack', assignee: '', status: 'To Do', resolution: '', points: 8, sprint: '26.3.1', epic: 'Reporting Suite', labels: ['backend'] },
  { type: 'Story', key: 'RCR-3021', summary: 'Drill-down from chart to raw rows', assignee: 'Carol Diaz', status: 'To Do', resolution: '', points: 5, sprint: '26.3.1', epic: 'Reporting Suite', labels: ['backend'] },
  { type: 'Bug',   key: 'RCR-3022', summary: 'Fix CSV export encoding for non-ASCII', assignee: '', status: 'To Do', resolution: '', points: 3, sprint: '26.3.1', epic: 'Reporting Suite', labels: ['bug'] },
  { type: 'Story', key: 'RCR-3023', summary: 'Custom date-range presets', assignee: '', status: 'To Do', resolution: '', points: 5, sprint: '26.3.1', epic: 'Reporting Suite', labels: ['backend'] },
];

const out = path.join(__dirname);
fs.writeFileSync(path.join(out, 'historical-jira.html'), render('Historical issues — velocity export', historical));
fs.writeFileSync(path.join(out, 'backlog-sprint.html'),  render('Sprint 26.3.1 backlog', backlog));
console.log(`Wrote historical-jira.html (${historical.length} rows) and backlog-sprint.html (${backlog.length} rows).`);
