# Sample data

Test fixtures for the Sprint Planner. The two `.html` files are
**Jira issue-navigator HTML exports** (the kind you get from *Export → HTML*),
and `leave.ics` is an iCalendar leave feed.

| File                    | Import via                  | What it exercises                              |
| ----------------------- | --------------------------- | ---------------------------------------------- |
| `historical-jira.html`  | Historical HTML upload      | Per-person velocity (auto-detects people)      |
| `backlog-sprint.html`   | Backlog HTML upload         | Tickets to plan; pre-assigned ones auto-attach |
| `leave.ics`             | iCal leave import           | Leave days → reduced sprint capacity           |
| `generate.js`           | —                           | Regenerates the two HTML files                 |

The HTML tables follow Jira's export shape: a `<table id="issuetable">` whose
`<th>` cells are field names — including the literal **`Custom field (Story
Points)`** — and whose `<tr class="issuerow">` rows are tickets (Key + Summary +
fields all on one row). Because cells are real HTML, multi-line **descriptions
stay intact** instead of being split across file lines.

## Projects & keys

Tickets are bucketed into the three project tabs by key prefix:

| Tab | Project        | Key prefix  |
| --- | -------------- | ----------- |
| DX  | DataXplorer    | `DX-#####`  |
| LX  | LinkXplorer    | `LX-####`   |
| RC  | ROLLERCOASTER  | `RCR-####`  |

## Suggested run-through

1. **Import `historical-jira.html`.** Five people are auto-detected and, based
   on the project of the tickets they own, dropped onto the matching tab.
   Everyone defaults to **contractor** — flip the few GOV folks in the Team tab.
   Some rows are intentionally excluded from velocity: unresolved tickets,
   an unassigned ticket, and a zero-point chore.

2. **Set each person's SID** (Team tab → edit) so leave can attach to them:

   | Person       | Tab | SID       |
   | ------------ | --- | --------- |
   | Alice Nguyen | DX  | `anguyen` |
   | Bob Carter   | LX  | `bcarter` |
   | Carol Diaz   | RC  | `cdiaz`   |
   | Dev Patel    | DX  | `dpatel`  |
   | Erin Walsh   | LX  | `ewalsh`  |

3. **Import `backlog-sprint.html`.** 16 tickets for sprint `26.3.1` across
   DX/LX/RC. Tickets that already have an assignee are **pre-assigned** to that
   person (their points count immediately); the rest are open to plan. Each tab
   shows only its own project's tickets, with the team as cards across the top.

4. **Import `leave.ics`.** Leave lands in June 2026 — add a locked sprint around
   then in Settings (you can **name** it, e.g. `26.3.1`) to watch leave eat into
   capacity. Click any ticket's summary to open the description panel.

## Regenerating

Edit the data arrays in `generate.js` and run:

```sh
node sample-data/generate.js
```
