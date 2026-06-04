# upgraded-pancake — Claude Code project notes

This branch (`release-notes`) holds the **Release Notes** project only — a
single self-contained HTML app that turns a Jira issue-navigator HTML export
into Confluence-ready release notes for a build. Sibling apps live on their own
branches: the **ReportSuite** app on `report-suite` (mirrored by `main`), and
the sprint-planner / velocity-tracker on `sprint-planner`.

## Primary file

The deliverable is `Jira_ReleaseNotes_v<version>_<date>.html`: one file holding
all markup, CSS, and vanilla JS (no build step, no CDN, no framework). It opens
straight from `file://`. The version lives in two places that must stay in sync:

1. `<title>Release Notes …</title>` (document head)
2. the file name `Jira_ReleaseNotes_v<version>_<date>.html`

When the version changes, rename the file to match and update the title. The
exported document derives its own title from the build metadata (`docTitle()`),
so it needs no version bump.

## Look & feel

The app deliberately reuses the **Velocity · Sprint Planner** design system
(the `sprint-planner` branch): the same theme tokens (Midnight / Slate /
Daylight), top bar, nav tabs, cards, drop-zone, modal, switches, and toasts, so
the apps feel like one suite. Keep visual changes consistent with that system.

## Architecture (in `<script>`)

- **Parser** — `parseJiraHtml(html)` reads an issue-navigator "Export · HTML"
  table by column header: Key, Issue Type (column text *or* the type icon's
  `alt`), Summary, Epic, Fix Version/s, Status, Resolution, Assignee,
  Description. It splits multiple fix versions, preserves multi-line
  descriptions, and skips non-issue rows (key must match `KEY_RE`).
- **Grouping** — `grouped(rows)` buckets Fix Version → Epic → issues, with
  **bug fixes first** (`TYPES[].rank`). Versions sort via `versionCmp`:
  numeric-leading names first (natural ascending), then alphabetical names, with
  the no-version bucket (`NO_VERSION`) always last; epics sort alphabetically
  with the no-epic bucket (`NO_EPIC`) last.
- **Compose** — build metadata: Product / system (dropdown: DataXplorer,
  LinkXplorer, ROLLERCOASTER, SWINGCAROUSEL), Build / release (text), Release
  date (themed popover via `makeDatePicker`, not the native control),
  Environment (dropdown: Staging, Beta, Production), plus optional Intro and
  Jira base URL. `overviewText()` turns these into the Overview prose.
- **Type system** — `TYPES` maps a normalized type id (bug / feature /
  improvement / task / other) to rank, label, emoji, CSS class, and Confluence
  `colour`. `classifyType` normalizes Jira's raw type; `typeFor(r)` applies a
  per-issue manual override (`state.typeOverride`). Route all
  label/rank/emoji/colour reads through `typeFor`.
- **Output** — a single export, `buildConfluenceStorage()`: Confluence storage
  XHTML with a `toc` macro, an **Overview** section (`overviewText`), a
  **Release Summary** table (Deployment Checklist / OME / Regression Tests, left
  blank to fill in), then a `status` lozenge per issue inside an `expand` per
  fix version (intro in an `info` panel). It must stay well-formed XML.
  `buildPreviewHtml()` renders a themed on-screen approximation of the same.
  When you change the grouping/structure, update both.
- **State** persists to `localStorage` (`rn.state.v1`): meta, per-issue
  exclusions, summary edits, type overrides, collapse, theme, jira base URL.
  Search and type-filter chips are view-only and never affect the output.

## Syntax check

After editing the HTML, verify the inline `<script>` parses:

```sh
python3 -c "import re; html=open('Jira_ReleaseNotes_v1.0_20260603.html').read(); \
  blocks=re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</script>', html); \
  [open(f'/tmp/c{i}.js','w').write(b) for i,b in enumerate(blocks)]"
node --check /tmp/c0.js
```

The `.claude/hooks/session-start.sh` SessionStart hook runs this check
automatically for every `Jira_*.html` app at the start of each session
(including Claude Code on the web) and prints a ✅/‼️ status line. It always
exits 0, so it never blocks startup.
