# Velocity — Sprint Capacity Planner

A client-side sprint planner and velocity tracker for engineering managers
running multiple projects (DX · DataXplorer, LX · LinkXplorer, RC · ROLLERCOASTER).
It takes a backlog of Jira-style tickets, lets you assign them to people across
named sprints, and continuously shows **assigned points vs. each person's
adjusted capacity** so you never overcommit a sprint.

"Adjusted capacity" is derived per person, per sprint from:

- the person's **base velocity** (rolling average of points landed in recent
  sprints, or their stated goal if they have too little history),
- minus **weekends, US federal holidays, and personal leave** falling inside the
  sprint window,
- with a separate **work-from-home (WFH) budget** tracked for contractors.

It also seeds historical velocity from a **Jira HTML export**, imports leave from
an **iCal (.ics)** file, manages the team roster, and maintains the sprint
calendar — including **undated sprints** (planning buckets with no committed
timeframe).

## Running

This is a no-build static app (React + Babel are loaded from a CDN and the JSX is
transpiled in the browser), so it needs network access and should be served over
HTTP rather than opened from `file://`:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## Files

| File           | Responsibility                                                        |
| -------------- | -------------------------------------------------------------------- |
| `index.html`   | Document shell, font + script load order, theme attributes            |
| `styles.css`   | All styles + theme tokens (midnight / slate / daylight)               |
| `data.js`      | Sample data **and** all calculation helpers, on `window.VP`           |
| `ui.jsx`       | Shared primitives: `Avatar`, `Icon`, `DatePicker`, `InlineNumber`, date helpers, the Jira-HTML + iCal parsers |
| `panel.jsx`    | `DescPanel` — left-sliding ticket detail panel                        |
| `planner.jsx`  | `Planner` — capacity cards, ticket rows, single + multi-sprint views  |
| `team.jsx`     | `Team` — person cards, add/edit modal, velocity table                 |
| `views.jsx`    | `Settings`, sprint-calendar editor, Jira-HTML + iCal import modals     |
| `app.jsx`      | Root: state, top bar, nav, toasts                                     |

## Notes

- **Data is in-memory.** The ticket / person / sprint records in `data.js` are
  fabricated sample data, and edits (assignments, points, roster, sprints) live
  in React state for the session — they reset on reload. Only the active project
  and the "hide past sprints" toggle persist (to `localStorage`). Wiring this to a
  real backend (Jira API for tickets, an HRIS/calendar for leave) is the main gap
  to close for production use.
- **Theming.** Three themes ship as CSS custom-property sets, selected by the
  `data-theme` attribute on `<html>` (`midnight` by default), with `data-density`
  controlling spacing.

> Adapted from a high-fidelity design prototype. The capacity math, holiday
> rules, and HTML/iCal parsers are intended to be correct and load-bearing.
