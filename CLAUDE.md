# upgraded-pancake — Claude Code project notes

This branch holds the **Mid-Sprint Report** project only — the End of Sprint
report lifted out of ReportSuite and turned into a mid-sprint instrument, with
Jira HTML exports as its one data source. The full ReportSuite (Weekly, EOS,
PMR, Sprint, Spin) still lives on `main` / `report-suite`; the sprint-planner /
velocity-tracker app lives on its own `sprint-planner` branch.

**This branch does not merge to `main`.** It deletes the suite, which is
correct here and wrong there. One project per branch.

## What the report is for

An end-of-sprint report is accounting: what did we finish. This is an
intervention: read at the halfway mark of a month-long sprint, with ~10 working
days of runway left, its job is to tell a mission lead what needs a decision
while there is still time to act. That framing decides the layout — exceptions
lead, delivery follows.

## Source of truth — one file, no build step

The deliverable **is** the HTML app, a single self-contained file holding all
markup, CSS, and JavaScript. **Edit that file directly.** There is no build step
and no separate source tree.

## Primary file

`Jira_MidSprintReport_v<version>_<date>.html`, and the version lives in four
places that must stay in sync:

1. `<title>Mid-Sprint Report vX.Y</title>` (document head)
2. `const APP_VERSION='vX.Y';` (main script block)
3. `'<title>Mid-Sprint Report vX.Y</title>\n'` (inside `buildStandaloneHtml`)
4. `<span class="app-logo-ver">vX.Y</span>` (header badge)

When the version changes, rename the file to match and update all four spots.
`Grep` for `APP_VERSION|Mid-Sprint Report v|app-logo-ver`. The badge is
overwritten from `APP_VERSION` at load, so a stale literal there only shows
for the instant before JS runs — keep it in sync anyway.

## Sprints are calendar months

A sprint runs from the first of the month to the last, so the calendar is
**derived, never hand-maintained** — it cannot run out and cannot drift:

- `fiscalSprintId(year, month)` — canonical `YY.Q.S` id on the US Federal FY
  (Q1=Oct–Dec … Q4=Jul–Sep), `S` being the month's slot in the quarter, 1–3.
  March 2026 is `26.2.3`.
- `monthlySprintEntry` / `ensureMonthlySprints` — fill any missing months around
  today, leaving existing (including hand-edited) rows alone. Called at startup
  and whenever settings render.
- `isMonthAligned` + the `_migrateCfg` hook drop stored rows left over from the
  old two-week cadence.
- `cleanSpinSprint` canonicalises `26.2.3`, `2026-03` and `March 2026` to the
  same id. A bare `26.03` is deliberately **not** parsed — whether `26` is the
  fiscal or calendar year is ambiguous and guessing would misfile work.

`sprintClock(sprintId, todayISO)` returns where today sits in the sprint, in
both calendar and working days. Working days are what "can this still land"
actually depends on.

## Report internals

`runEOS()` builds the report (function names keep the `eos*` prefix; the ids and
`data-eos-*` keys are load-bearing for draft autosave/restore).

`eosCategorizeThreads` sorts topics into `Landed so far` / `Advancing` /
`Queued for next` / `At risk`. **Blockers are an attribute of a thread, never a
bucket that claims it.** A thread that shipped eight things and carries one
blocker belongs under what it landed. Filing it under risk instead is what used
to put "9 landed" directly above "Landed — 0 threads"; don't reintroduce it.
Only a thread with nothing but blockers is at risk.

Exceptions are collected separately as *items* (`cat.attention`) so nothing is
hidden inside a category, and rendered by `buildEOSAttentionPanel`:

- `EOS_STALL_DAYS = 7` — in flight but silent for a week inside a month.
- `EOS_NOT_STARTED_AFTER_PCT = 40` — unstarted work is only an exception once
  the sprint is genuinely underway; on day 2 everything is unstarted.
- `EOS_ATTENTION_VISIBLE = 8` — longer groups collapse behind a disclosure.

The attention panel deliberately carries **no assignee**. It is what gets
screen-shared, and a name next to "stalled 9 days" reads as an accusation
whatever was meant by it. The report names the problem; the **Debug** tab
carries an Assignee column so a lead can still find who to go to.

## Authored content: the BLUF draft and the asks

`buildBlufDraft` composes a factual first sentence from `cat.pulse` and the
clock — every clause is something the report already computed, so it can't
claim more than the data supports. It is **offered, never written**:
`buildBlufSuggestionHtml` renders it under the empty BLUF with a *Use this*
button (`useBlufDraft`). Nothing machine-written reaches Confluence unless
somebody accepts it or writes their own — what a mission lead reads should be a
person's words. `onEosBlufInput` hides the suggestion once the field has text.

Each thread carries a **What we need from you** field (`data-eos-ask` +
`data-eos-proj`, id `bluf-eos-<proj>-<tidx>-ask`). `collectEOSAsks` reads the
non-empty ones live from the DOM and `refreshEOSAsks` rebuilds the roll-up
panel on input — it has to be live, because at render time every field is
empty. The Confluence export carries both a `What We're Asking of You` section
and a per-thread `(U) Ask:` line.

Draft restore writes `innerText` directly and fires no input event, so both
restore paths call `syncEOSAuthoredState()` to resync the suggestion and the
roll-up. Any contenteditable with a stable id is autosaved and restored for
free, which is why the ask field ids are deterministic.

## Story points — optional, and honest about it

`parsePoints` defaults a missing column to 0, so a zero sum is
indistinguishable from "nobody estimated this". Nothing points-shaped renders
until at least one ticket in the export actually carries a value:

- `eosSumPoints(tickets)` / `eosExportHasPoints(tickets?)` — the latter
  defaults to `S.allTickets`.
- `eosCategorizeThreads` adds `ptsDone`/`ptsTotal` per thread and
  `pulse.ptsLanded`/`pulse.ptsCommitted`. The **Points landed** pulse tile, the
  per-thread `N/M pts` stat and the Confluence pulse clause are all gated on
  `ptsCommitted` being non-zero.
- `buildPointsNoticeHtml` renders a one-time nudge when the export has no
  points, with **Dismiss** (this run) and **Don't show again**
  (`dismissPointsNotice(true)` → `POINTS_NOTICE_KEY` = `jira_reportsuite_points_notice_v1`).
  It never blocks the report. **Settings → Manage Data → Notices** has a
  *Show again* button (`resetPointsNotice`), so a permanent dismissal is
  recoverable and a fresh browser sees the notice again.

## Topics — the routing rules

Topics are published by another team, not written here. `topics_source_url`
(Settings → Topics) stores the link and `renderTopicsSourceLink()` renders the
**Open topics source** button from it, so the next person can find the list
without asking. `configs/topics_config.json` is the **source of truth** for the 18 topics, and
the app's built-in `S.topics` default is a copy of it. Change one, change the
other; a test pins the six values that were found out of sync once already
(codenames spelled out, and the narrower `508_compliance` / `techsigint`
project scopes) so the copies cannot drift silently again.

Built-in defaults only apply to somebody who has never saved topics — once a
browser has `jira_reportsuite_topics_v1` in localStorage, that wins and a new
default never reaches them. An existing user takes an updated list through
**Settings → Topics → Import**, which replaces or merges.

## The Guide

`openGuide()` renders the in-app help, and `GUIDE_SECTIONS` drives its nav.
Each section needs three things that must agree or the guide-consistency test
fails: an entry in `GUIDE_SECTIONS`, an `<h3 data-guide-section="id">`, and a
`<div id="guide-id">` anchor. Section icons come from `APP_ICONS[id]` — a
missing entry falls back to a name the inline SVG sprite must actually carry,
or the raw word renders as text next to the heading.

**Setup — start here** is written for somebody who has never seen the app and
is not the person who built it: what it is, the two Jira HTML exports, the
columns those exports must carry and what breaks without each one, the one-time
settings (Topics above all), and a plain-language troubleshooting list. Keep it
accurate when behaviour changes — a wrong setup page is worse than none,
because the reader has no way to know it is wrong.

`buildEOSConfluence()` mirrors the on-screen structure, including the clock line
and a Needs Attention section. `openEOSConfluencePicker()` drives the per-project
copy dialog. `report formats/EOS_Format.txt` is the original format reference and
predates the mid-sprint reframing.

## Data ingest — Jira HTML exports only

There is no CSV path. Data comes from Jira's **Export → HTML**:

- `parseJiraHtmlReport(text)` — scores every `<table>` and takes the issue list;
  falls back to `jiraHtmlRowsFromDetailExport` for the printable export.
- `jiraHtmlRowsFromTable` returns `{rows, headers, hasTh}`. A table must score
  ≥ 4 on `JIRA_HTML_HEADER_WEIGHTS` and either use `<th>` or have ≥ 4 columns,
  which stops a two-column label/value table being read as the issue list.
- `jiraHtmlCellText` — `<br>` and list items become `", "` so multi-valued
  fields survive; `jiraHtmlDedupeHeaders` gives `Sprint`, `Sprint.1`, … so
  `collectSprints` walks them all.
- `detectJiraHtmlType` → `ingestJiraHtmlFile` → `storeJiraRows` routes a file to
  `issues` or `epics` by its columns, filename as last resort.

## Checks

```sh
python3 -c "import re; html=open('Jira_MidSprintReport_vX_Y_YYYYMMDD.html').read(); \
  blocks=re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</script>', html); \
  [open(f'/tmp/c{i}.js','w').write(b) for i,b in enumerate(blocks)]"
node --check /tmp/c0.js
```

Then open the page and click **[Tests] → Run All** (or call `runTests()`).
It should be **172/172** green.

`test files/jira_issues_export.html` and `jira_epics_export.html` are
Jira-shaped fixtures whose sprints are remapped onto the current month and the
next, with dates shifted so the sprint reads as live. To see the report in its
intended state, pin the browser clock to the middle of that month
(Playwright: `page.clock.install({time: new Date('2026-09-16T12:00:00Z')})`) —
otherwise the clock shows whatever day it actually is.
