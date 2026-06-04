# Release Notes — Jira build notes generator

A **standalone, fully-offline** companion to the Velocity · Sprint Planner. Drop
in a Jira issue-navigator **HTML export** for a build and it generates
**Confluence-ready release notes**, grouped by **Fix Version → Epic → issue**,
with **bug fixes listed first**.

It shares the sprint planner's design system (the same theme tokens, top bar,
cards, drop-zone, modals, and toasts) so the two apps feel like one suite.

## Primary file

`Jira_ReleaseNotes_v<version>_<date>.html` — a single self-contained file with
all markup, CSS, and JavaScript inline (vanilla JS, no build step, no CDN). Just
open it:

```
open Jira_ReleaseNotes_v1.0_20260603.html   # or double-click; works from file://
```

Your build details, imported issues, edits, and theme are saved automatically in
the browser (`localStorage`) and restored on refresh.

## How to use

1. In Jira, run an issue-navigator search for the issues in your build, then
   choose **Export · HTML**.
2. Open the app and click **Import Jira HTML** (or drag the `.html` file anywhere
   onto the window, or paste the markup). The parser reads **Key, Issue Type,
   Summary, Epic, Fix Version/s, Status, Resolution, Assignee, Description** —
   issue types are read from the column text *or* the Jira type icon's alt-text.
3. In **Compose**, fill in the build details — **Product / system** (DataXplorer,
   LinkXplorer, ROLLERCOASTER, SWINGCAROUSEL), **Build / release**, **Release
   date** (themed calendar that matches the app theme), **Environment** (Staging,
   Beta, Production), and optional **Intro** / **Jira base URL** — then curate the
   issues:
   - **Search** by key or summary, and toggle **type filter chips** to focus the
     list (filters affect the view only, never the output).
   - **Include/exclude** any issue with its switch, or use the bulk actions —
     *Include shown*, *Exclude shown*, and **Exclude unresolved** (drops issues
     with no resolution, i.e. not yet done).
   - **Reclassify** a mis-typed issue by clicking its type badge (a dot marks
     overrides; reset returns it to the Jira value).
   - Click any **summary** to reword it for the notes.
4. In **Preview & Export**, review the rendered notes and export.

## Grouping

- **Fix Version** — numeric versions first (natural order, e.g. `2.9.0` before
  `2.10.0`), then alphabetically-named versions; issues with multiple fix
  versions appear under each, and issues with none fall under *Unversioned* (last).
- then **Epic** (alphabetical; un-epic'd issues under *Other changes*).
- then individual **issues**, with **bug fixes first**, then new features,
  improvements, tasks, and other changes.

## Output (built for Confluence)

A single export — **Copy for Confluence** — copies **Confluence storage format**
(XHTML + macros) to the clipboard. The generated page contains:

- a **table of contents** macro;
- an **Overview** section — *"The &lt;Product&gt; product team is scheduled to
  deploy the latest release &lt;Build/release&gt; to &lt;Environment&gt; on
  &lt;Release date&gt;…"* — filled from the Compose fields (plus the optional
  Intro in an **info** panel);
- a **Release Summary** table (Deployment Checklist · OME · Regression Tests),
  left blank to fill in for the deployment;
- the deployment contents: a native **status lozenge** per issue type (Red bug /
  Green feature / Blue improvement / Yellow task / Grey change) inside an
  **expand** section per fix version, epics within, bug fixes on top.

Because it's storage format, paste it via the page's **{ } source editor** or
push it through the Confluence **REST API** (`body.storage`) — not the
rich-text editor. Adding a **Jira base URL** in Compose turns every issue key
into a link.

## Enclave transfer (`enclave/`)

For moving the app into an air-gapped / text-only enclave, the `enclave/`
folder holds **base64-encoded** copies of the project files, each with an extra
`.txt` extension (e.g. `Jira_ReleaseNotes_v1.0_20260603.html.txt`) so they pass
through systems that only accept text. Decode on the far side:

```sh
base64 -d enclave/Jira_ReleaseNotes_v1.0_20260603.html.txt > Jira_ReleaseNotes_v1.0_20260603.html
# then just open the .html file
```

## Editing the app

It's a single HTML file — edit the inline `<style>` and `<script>` directly.
After editing, verify the script parses:

```sh
python3 -c "import re; html=open('Jira_ReleaseNotes_v1.0_20260603.html').read(); \
  blocks=re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</script>', html); \
  [open(f'/tmp/c{i}.js','w').write(b) for i,b in enumerate(blocks)]"
node --check /tmp/c0.js
```

A **SessionStart hook** (`.claude/hooks/session-start.sh`) runs this same check
automatically at the start of every Claude Code session (including Claude Code
on the web), reporting a ✅/‼️ status line for each `Jira_*.html` app. It always
exits 0, so a syntax error surfaces in the session context without blocking
startup. Once this hook is merged to the default branch, all future sessions use it.
