# upgraded-pancake — Claude Code project notes

## Git workflow: always merge to main

This repo uses a **trunk-based workflow**. Do not maintain long-lived feature
branches — every change should end up on `main`.

- If session instructions direct you to develop on a `claude/…` branch, still
  commit and push there, but then also push the same HEAD to `main` so `main`
  stays in sync.
- The `.claude/settings.json` **PostToolUse** hook handles this automatically:
  after any `git push origin <branch>`, it runs
  `git push origin HEAD:main` to fast-forward `main`. No manual merge step,
  no pull request needed.
- If the fast-forward fails (e.g. `main` diverged), investigate rather than
  force-pushing. Ask the user before any destructive recovery.

## Primary file

The main deliverable is the ReportSuite HTML app, a single self-contained
file that holds all markup, CSS, and JavaScript (app logic + embedded
`pptxgenjs` bundle). It is named `Jira_ReportSuite_v<version>_<date>.html`
and the version lives in three places that must stay in sync:

1. `<title>ReportSuite vX.YY</title>` (document head)
2. `const APP_VERSION='vX.YY';` (main script block)
3. `'<title>ReportSuite vX.YY</title>\n'` (inside `buildStandaloneHtml`)

When the version changes, rename the file to match and update all three
spots. Use `Grep` for `v8\.\d+|APP_VERSION` to find every occurrence.

## PMR PPTX export

The `downloadPmrPptx()` function generates a BAMBOOTIGER-formatted PowerPoint
deck directly in the browser via `pptxgenjs`. The generator is split across
helpers prefixed `_pmr*`:

- `_pmrExtractSlides` — walks the PMR slide DOM, reads the
  `data-pmr-layout` attribute set by `renderSlide`, and returns structured
  slide data.
- `_pmrBuildMeta` / `_pmrCtx` — metadata and shared rendering primitives
  (colors, dimensions, FOUO bars, header chrome).
- `_pmrAddTitleSlide`, `_pmrAddAgendaSlide`, `_pmrAddSimpleListSlide`,
  `_pmrAddFibSlide`, `_pmrAddProjectSlide`, `_pmrAddMissionSupportSlide` —
  one renderer per layout type.

When adding new layouts: update `renderSlide` to emit the new
`data-pmr-layout` value, add a case in the dispatcher, and write a new
`_pmrAdd<Name>Slide` helper that mirrors the corresponding slide in
`BAMBOOTIGER_PMR_March2026_v6 (1).pptx` (the template reference checked
into the repo).

## Syntax check

After editing the HTML, verify all inline `<script>` blocks parse:

```sh
python3 -c "import re; html=open('Jira_ReportSuite_vX_YY_YYYYMMDD.html').read(); \
  blocks=re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</script>', html); \
  [open(f'/tmp/c{i}.js','w').write(b) for i,b in enumerate(blocks)]"
for i in 0 1 2; do node --check /tmp/c$i.js || echo "block $i FAILED"; done
```
