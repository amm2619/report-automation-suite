# upgraded-pancake — Claude Code project notes

This branch holds the **EOS Report** project only — the End of Sprint report
lifted out of ReportSuite as a standalone app, with Jira HTML exports as its
one data source. The full ReportSuite (Weekly, EOS, PMR, Sprint, Spin) still
lives on `main` / `report-suite`; the sprint-planner / velocity-tracker app
lives on its own `sprint-planner` branch.

## Source of truth — one file, no build step

The deliverable **is** the EOS Report HTML app, a single self-contained file
holding all markup, CSS, and JavaScript. **Edit that file directly.** There is
no build step and no separate source tree. Do not reintroduce a second
representation of the app — one file anyone can open in a browser is the point.

## Primary file

`Jira_EOSReport_v<version>_<date>.html`, and the version lives in three places
that must stay in sync:

1. `<title>EOS Report vX.Y</title>` (document head)
2. `const APP_VERSION='vX.Y';` (main script block)
3. `'<title>EOS Report vX.Y</title>\n'` (inside `buildStandaloneHtml`)

When the version changes, rename the file to match and update all three spots.
`Grep` for `APP_VERSION|EOS Report v` to find every occurrence. The header
badge (`.app-logo-ver`) is set from `APP_VERSION` at load, so it needs no edit.

## Data ingest — Jira HTML exports only

There is no CSV path. Data comes from Jira's **Export → HTML**, routed through:

- `parseJiraHtmlReport(text)` — entry point. Scores every `<table>` in the
  document and takes the issue list; falls back to `jiraHtmlRowsFromDetailExport`
  for the printable/full-content export, which renders one label/value block
  per issue.
- `jiraHtmlRowsFromTable(table)` — returns `{rows, headers, hasTh}`. A table
  must score ≥ 4 on `JIRA_HTML_HEADER_WEIGHTS` and either use `<th>` headers or
  have ≥ 4 columns, which is what stops a two-column label/value table from
  being mistaken for the issue list.
- `jiraHtmlCellText(cell)` — one cell to one line; `<br>` and list items become
  `", "` so multi-valued fields (labels, components, sprints) survive.
- `jiraHtmlDedupeHeaders` — duplicate columns become `Sprint`, `Sprint.1`, … so
  `collectSprints` can walk them all, matching the old CSV behaviour.
- `detectJiraHtmlType` → `ingestJiraHtmlFile` → `storeJiraRows` routes a file
  to the `issues` or `epics` bucket by its columns, filename as last resort.

Rows come out shaped exactly as before (one object per issue, keyed by column
label), so everything downstream — `buildTicket`, `resolveCol`, topic routing —
is unchanged.

## Report internals

`runEOS()` builds the report; helpers are prefixed `eos*` / `_eosPrio*`.
`buildEOSConfluence()` produces the Confluence markup, and
`openEOSConfluencePicker()` drives the per-project copy dialog.
`report formats/EOS_Format.txt` is the format reference.

## Checks

Syntax check after editing:

```sh
python3 -c "import re; html=open('Jira_EOSReport_vX_Y_YYYYMMDD.html').read(); \
  blocks=re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</script>', html); \
  [open(f'/tmp/c{i}.js','w').write(b) for i,b in enumerate(blocks)]"
node --check /tmp/c0.js
```

The app also ships its own behavior test harness — open the page and click
**[Tests] → Run All** (or call `runTests()` from the console). It should be
153/153 green. `test files/jira_issues_export.html` and
`jira_epics_export.html` are Jira-shaped fixtures for exercising ingest.
