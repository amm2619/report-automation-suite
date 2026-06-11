# Velocity — Sprint Capacity Planner

A **standalone, fully-offline** sprint planner and velocity tracker for
engineering managers running multiple projects (DX · DataXplorer,
LX · LinkXplorer, RC · ROLLERCOASTER). It takes a backlog of Jira-style tickets,
lets you assign them to people across named sprints, and continuously shows
**assigned points vs. each person's adjusted capacity** so you never overcommit
a sprint.

"Adjusted capacity" is derived per person, per sprint from:

- the person's **base velocity** (rolling average of points landed in recent
  sprints, or their stated goal if they have too little history),
- minus **weekends, US federal holidays, and personal leave** in the sprint
  window,
- with a separate **work-from-home (WFH) budget** tracked for contractors.

Tickets, people, leave, and velocity history are all brought in from **Jira HTML
exports** and an **iCal (.ics)** leave file — no live API required.

## Running (no internet needed)

The app ships precompiled with React vendored locally, so there are **no CDNs and
no build step to run it** — just open the file:

```
open index.html        # or double-click it; works straight from file://
```

(You can also serve the folder with any static server, e.g.
`python3 -m http.server`, but it is not required.)

Either way your data is **saved automatically in the browser** and restored on
refresh — it persists until you clear it from **Settings → Data → Clear all
data**. **Export data** there writes a one-off JSON copy you can keep anywhere.

## Auto-save to a folder (optional)

If you'd like the app to keep a live `velocity-data.json` in a folder of your
choice, run it over `http://localhost` (a "secure context", which the browser
requires for folder access) using the bundled server:

```sh
npm start            # serves on http://localhost:8000
```

Then open <http://localhost:8000>, go to **Settings → Data → Auto-save to a
folder → Connect folder**, and pick a folder once. From then on every change is
written to `velocity-data.json` in that folder, and reconnecting it later (or on
another machine) loads it back. Requires a Chromium browser (Chrome/Edge); on
other browsers the in-browser auto-save + Export/Import still work.

## Importing your data

- **Import tickets** (top bar, Planner header, or Settings) — paste/drop a Jira
  issue-navigator **Export → HTML** of your backlog + in-sprint tickets. People
  are created from the assignees, referenced sprints are added to the calendar,
  and tickets land in their sprint (or the backlog).
- **Import history** — a Jira HTML export of completed tickets seeds each
  person's rolling velocity.
- **Import iCal** (Settings) — a `.ics` leave calendar; matched to people and
  subtracted from capacity.

## Files

| File / dir       | Responsibility                                                  |
| ---------------- | -------------------------------------------------------------- |
| `index.html`     | Document shell; loads vendored React + `bundle.js`              |
| `styles.css`     | All styles + theme tokens (midnight / slate / daylight)        |
| `data.js`        | Empty starting data **and** all calculation helpers (`window.VP`) |
| `ui.jsx`         | Shared primitives + the Jira-HTML (board & history) and iCal parsers |
| `panel.jsx`      | `DescPanel` — left-sliding ticket detail panel                 |
| `planner.jsx`    | `Planner` — capacity cards, ticket rows, single + multi sprint  |
| `team.jsx`       | `Team` — person cards, add/edit modal, velocity table          |
| `sprints.jsx`    | `Sprints` — dictate the shared sprint calendar (its own save file) |
| `views.jsx`      | `Settings`, velocity basis, import modals, `Debug`             |
| `app.jsx`        | Root: state, top bar, nav, toasts                              |
| `fsstore.js`     | Folder auto-save helper (File System Access API), `window.FSStore` |
| `bundle.js`      | **Generated** — the precompiled app the browser actually runs   |
| `build.js`       | Compiles the sources (`data.js` + `fsstore.js` + `.jsx`) into `bundle.js` |
| `server.js`      | Tiny zero-dep static server for `npm start` (localhost)         |
| `vendor/`        | Vendored React + ReactDOM (UMD, production)                    |

## Editing the app

The `.jsx` files and `data.js` are the source of truth; `bundle.js` is generated.
After editing any of them, rebuild (needs Node + npm, online once to install the
dev dependency):

```sh
npm install      # one-time: installs Babel (dev only)
npm run build    # regenerates bundle.js
```

The build is dev-only — the committed `bundle.js` is all the app needs to run.

## Notes

- **Data is in-memory.** `data.js` starts empty; everything you import or edit
  lives in the session and resets on reload (only the active project + the
  "hide past sprints" toggle persist to `localStorage`). Persisting to a backend
  is the main gap to close for long-term use.
- **Fonts.** The UI font is **Roboto**, vendored locally as a latin variable
  woff2 in `vendor/fonts/` and declared via `@font-face` — nothing is fetched at
  runtime, so the app stays fully offline. The base font size is **12pt (16px)**
  and no text is rendered smaller than that. (`--font-mono` still falls back to
  the system monospace stack.)
- **Theming.** Themes are CSS custom-property sets selected by the `data-theme`
  attribute on `<html>` (`midnight` by default); `data-density` controls spacing.
