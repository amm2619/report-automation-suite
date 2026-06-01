# Sprint Planner — Velocity Tracker

A standalone, client-side sprint planner and velocity tracker. No build step
or server required — open `index.html` in a browser.

This branch (`sprint-planner`) holds the velocity-tracker project only. The
ReportSuite app lives on its own `report-suite` branch (which `main` mirrors).

## Files

| File          | Purpose                                                  |
| ------------- | -------------------------------------------------------- |
| `index.html`  | App shell and markup                                     |
| `styles.css`  | Styling                                                  |
| `app.js`      | Main app logic (planning, velocity, rendering)           |
| `data.js`     | State and persistence                                    |
| `holidays.js` | Holiday calendar data used for sprint capacity           |
| `ical.js`     | iCal import/export helpers                               |

## Running

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/
```
