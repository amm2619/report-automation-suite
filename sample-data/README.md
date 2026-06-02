# Sample data

Test fixtures for kicking the tires on the Sprint Planner. Open `index.html`,
then import these in order.

| File                   | Import via                          | What it exercises                          |
| ---------------------- | ----------------------------------- | ------------------------------------------ |
| `historical-jira.csv`  | Historical Jira CSV upload          | Per-person velocity (auto-detects people)  |
| `backlog-sprint.csv`   | Sprint / backlog CSV upload         | Tickets to plan and assign                 |
| `leave.ics`            | iCal leave import                   | Leave days → reduced sprint capacity       |

## Suggested run-through

1. **Import `historical-jira.csv`.** Five people are auto-detected
   (Alice Nguyen, Bob Carter, Carol Diaz, Dev Patel, Erin Walsh). Each has
   completed work across multiple sprints, so the velocity view shows a real
   per-person average. A few rows are intentionally *not* counted: unresolved
   tickets (In Progress / To Do / Reopened), an unassigned ticket, and a
   zero-point chore.

2. **Set each person's project, type, and SID** (Team view → edit person).
   The SID is what links leave to a person — set them to match the iCal file:

   | Person       | Project | Type        | SID       |
   | ------------ | ------- | ----------- | --------- |
   | Alice Nguyen | DX      | gov         | `anguyen` |
   | Bob Carter   | LX      | gov         | `bcarter` |
   | Carol Diaz   | RC      | gov         | `cdiaz`   |
   | Dev Patel    | DX      | contractor  | `dpatel`  |
   | Erin Walsh   | LX      | gov         | `ewalsh`  |

   Marking Dev Patel a **contractor** exercises the WFH-budget logic.

3. **Import `backlog-sprint.csv`.** 16 tickets across DX/LX/RC for sprint
   `26.3.1`. Most are unassigned so you can assign them in the planner; a few
   come pre-assigned.

4. **Import `leave.ics`.** Leave lands in June 2026 (set the sprint window
   around then to see it bite into capacity). Includes all-day ranges, a
   single day, an `ATTENDEE`-only event (Dev Patel), and a timed event — all
   resolved by SID. Weekends are skipped automatically.

## Tweaking

These are plain CSV / iCal files — edit them in any text editor to add people,
change point totals, or move leave dates. The CSV columns follow a Jira export
(`Issue key`, `Assignee`, `Story Points`, `Sprint`, `Resolution`, …); extra
columns are ignored and the importer is tolerant of column-name variants.
