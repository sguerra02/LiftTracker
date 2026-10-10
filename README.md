# Iron Ledger

A home-gym workout log that runs entirely in the browser. It picks your next workout from your last one, keeps every weight loadable with the equipment you own, and charts where you've been and where you're headed.

There are no accounts, no server and no build step. Your data stays in the browser's `localStorage` on your device.

## Features

- **Programs:** GZCLP, Starting Strength, StrongLifts 5×5, Greyskull LP, Phrak's GSLP, Reddit Basic Beginner Routine, 5/3/1 (standard, Beginners, 2-day, Boring But Big), Texas Method, dumbbell-only, double progression and custom plans.
- **Automatic progression:** stage changes, AMRAP bumps, training-max cycles and RPE-adjusted jumps.
- **Comeback ramp:** after 14 or more days off, the next sessions run at reduced weights.
  - 14–27 days: 90%, then 95%.
  - 28–55 days: 85%, 90%, then 95%.
  - 56+ days: 75%, 85%, 90%, then 95%.

  These sessions don't move your progression up or down.
- **Plate plan:** chooses plate combinations, and nudges warm-up weights slightly, so you strip and reload as few plates as possible across the whole workout.
- **Set timestamps:** each checked set records its time. History shows how long each exercise took and your real rest compared with the plan's.
- **Rest timer alerts:**
  - A beep and a vibration when rest ends.
  - An optional lock-screen notification, which needs the hosted (https) version.
- **Cardio log:**
  - Logs walks, runs, rides, rowing and more.
  - Shows weekly active minutes against the 150-minute guideline.
  - Cardio sessions count toward streaks.
- **Progress:** a workout-vs-same-workout report with a muscle map, goals with ETAs, history charts, a calendar, bodyweight tracking, now-vs-peak and a 30-day projection.
- **Trophies and sharing:**
  - PRs, streaks, badges, strength levels, a lifetime tonnage ladder and a year in review.
  - Any PR can be shared as an image card.
  - Any plan can be shared as a file.
- **Units and themes:** lb or kg, with light and dark themes.
- **Installable and works offline (PWA).**

## Project layout

```
index.html                 page shell; loads js/main.js as an ES module
css/styles.css             all styles (light/dark tokens at the top)
js/main.js                 start-up: imports every module, renders, registers the service worker
js/registry.js             shared click/change/input handler tables (ACT, CH, IN)
js/core.js                 helpers, units, exercise library, default plans, storage and migration
js/equipment.js            plate and load math
js/engine.js               progression engine
js/state.js                view state, tabs, render()
js/actions.js              core event handlers, backup import/export
js/fun.js                  real-world weight comparisons, lifetime ladder
js/charts.js               SVG line charts
js/ui.js                   rest timer, modal, toast
js/sample.js               demo data
js/views/*.js              one file per screen
js/features/timing.js      set timestamps and rest analysis
js/features/alerts.js      rest timer sound, vibration and notifications
js/features/comeback.js    comeback ramp after a break
js/features/plates.js      plate plan optimizer
js/features/cardio.js      cardio log
js/features/share.js       PR cards and plan files
sw.js                      offline cache (network-first) and rest notifications
tests/                     Playwright tests, made-up sample data, local server
scripts/update-sw.mjs      regenerates the service worker's file list
```

Every file is an ES module with explicit `import`/`export`. A feature registers its buttons by adding handlers to `ACT`, `CH` or `IN` from `js/registry.js`. Markup uses `data-act="name"` for clicks, `data-ch` for change events and `data-in` for input events.

## Run locally

ES modules don't load from `file://`, so serve the folder:

```bash
npm start            # http://localhost:4173 (Node, no dependencies)
# or: python3 -m http.server 8000
```

## Tests

```bash
npm install
npx playwright install chromium
npm test
```

The suite runs in Chromium with a Pixel 7 profile. It covers:
- first-run setup;
- every tab;
- progression;
- backup round trips;
- unit conversion;
- every built-in program;
- set timing, the comeback ramp and the plate plan;
- cardio, plan sharing and PR cards;
- offline use and rest notifications.

GitHub Actions (`.github/workflows/test.yml`) runs the suite on every push to `main` and on pull requests. Failed runs upload the Playwright report.

The test data in `tests/fixtures/` is made up by the app's sample-data generator, not a real log.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. The site appears at `https://<your-username>.github.io/<repo-name>/`.

Netlify, Cloudflare Pages and Vercel also work with no build command.

### Shipping updates

Run `npm run sw` before you push. It refreshes the service worker's file list and bumps its cache version, so phones pick up the new files. A test fails if a script is missing from that list.

## Your data

- Everything lives in `localStorage` under the key `ironledger.v1`. It belongs to one browser on one device, at one web address.
- To move to another device or address, use **Setup → Settings & data → Download backup file** in the old copy, then **Import** in the new one.
- Clearing site data deletes the log, so download a backup now and then. The app reminds you when one is due.
- Plan files (from **Plans → Share**) contain only the plan, with no weights or workouts. Importing one adds the plan without touching anything else.
