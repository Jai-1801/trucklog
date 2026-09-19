# TruckLog: Build Doc

**Owner:** Jai Surya · **For:** Spotter AI, Full Stack Developer assessment · **Appetite:** 16 hrs / 4 days
**Deliverables:** GitHub repo · hosted URL · 3–5 min Loom · **Status:** M0–M5 shipped (live at https://trucklog-web.vercel.app); Loom pending

---

## 1. Press release (working backwards)

> **TruckLog turns a dispatch into a compliant day plan in seconds.**
> A driver types where they are, where they're picking up, where they're dropping off, and how many cycle hours they've used.
> TruckLog plans the route on a truck profile, places every fuel stop, 30-minute break, 10-hour rest, and 34-hour restart
> where FMCSA rules require it, and draws the Driver's Daily Log for each day of the trip. The log looks like the paper
> form drivers already know and is ready to print.

**FAQ**
- *Is the plan legal?* It follows the 11/14/8/70 rules in the FMCSA guide and uses no exceptions. Every assumption is shown in the app.
- *Why paper-style logs?* It's the form the brief asks for, and it's the fastest way for a reviewer to check correctness by eye.

## 2. Users & jobs

| User | Job to be done | What delights them |
|---|---|---|
| Driver / dispatcher | "Can I legally make this run, and when do I arrive?" | An instant ETA plus a clear list of stops |
| Grader (Spotter) | "Are the logs correct and is the UX polished?" | Logs that sum to 24, rules visibly respected, fast and good-looking UI |

## 3. Scope

**Must (graded):**
1. Form with 4 inputs: current, pickup, dropoff (autocomplete), and cycle used (0–70, step 0.25)
2. Route map with a free provider: polyline, pins for start/pickup/dropoff, markers for fuel/break/rest/restart, popups with time and duration
3. HOS engine following `docs/HOS_RULES.md` (golden tests green)
4. Daily log sheets: one per calendar day, drawn to match `blank-paper-log.png`, with grid lines, totals, miles, from/to, remarks, and recap
5. Trip summary: total miles, driving hours, on-duty hours, trip duration, ETA at pickup/dropoff, number of days
6. Hosted and publicly reachable. Loom recorded

**Should:**
7. Itinerary timeline (vertical list of duty events synced with the map, so hovering an event highlights its marker)
8. Print / Download PDF of all log sheets (`window.print` with print CSS, a clean A4/Letter page per sheet)
9. "Assumptions" drawer that lists the decisions from `HOS_RULES.md` §6
10. Sample-trip buttons (e.g. "Chicago → Dallas → Los Angeles") so graders can test in one click
11. Mobile-responsive layout

**Stretch (cut first):** trip start time picker (otherwise default: next hour) · shareable URL (inputs in query string) · dark mode · pre/post-trip inspection toggle · animated log drawing · editable carrier/truck fields on the log

**Out of scope:** auth, a database, saving trips, split sleeper, adverse-conditions exception, team drivers, real ELD integration.

## 4. Architecture

```
 Browser (React, Vercel)                       Django API (Vercel Python / Render)           Free providers
 ┌──────────────────────────┐   POST /api/trips/plan   ┌───────────────────────────┐
 │ TripForm ──► useTripPlan │ ───────────────────────► │ views.plan_trip           │
 │ RouteMap  (react-leaflet)│                          │  ├ services.geocoding  ───┼──► ORS Pelias / Nominatim
 │ Itinerary                │ ◄─────────────────────── │  ├ services.routing    ───┼──► ORS driving-hgv (fallback OSRM)
 │ LogSheet[] (SVG)         │   route + stops + days   │  ├ hos.engine.simulate    │
 └──────────────────────────┘                          │  ├ hos.logsheets.build    │
          ▲ tiles                                      │  └ reverse-geocode stops ─┼──► ORS / Nominatim reverse
          └──── CARTO Positron / OSM tiles             └───────────────────────────┘
          GET /api/geocode/autocomplete?q=  (proxied so the API key stays server-side)
```

- **Stateless:** each request is a pure function of its inputs. No DB is needed (keep Django's default SQLite only for the admin/health check, or disable it).
- **The backend is the single source of truth** for HOS and the log data. The frontend only renders.

## 5. Providers (all free)

| Need | Primary | Fallback | Notes |
|---|---|---|---|
| Autocomplete | ORS `/geocode/autocomplete` (Pelias) | Photon (komoot) | Debounce 250 ms, US-biased (`boundary.country=US`) |
| Geocode free text | ORS `/geocode/search` | Nominatim (1 req/s, needs a User-Agent) | Used when the user typed text without picking a suggestion |
| Routing | ORS `/v2/directions/driving-hgv/geojson` | OSRM public demo (`driving`) | ORS free tier: 2,000 req/day, 40/min |
| Reverse geocode stops | ORS `/geocode/reverse` | Nominatim reverse | Format "City, ST". Cache by rounded lat/lng (2 dp) |
| Map tiles | Esri World Light Gray Canvas (base + reference labels) | OSM standard | Keyless. CARTO basemaps now watermark "API KEY REQUIRED" without a key. Attribution required |
| Time zone | `timezonefinder` (offline, Python) | browser zone | Home-terminal time zone |

**Day-1 spike:** confirm the ORS key works for a cross-country HGV route (e.g. NYC → LA, about 2,800 mi) and time it.

## 6. API contract

### `POST /api/trips/plan`

```jsonc
// request
{
  "current_location": { "label": "Chicago, IL", "lat": 41.8781, "lng": -87.6298 },  // or { "query": "Chicago" }
  "pickup_location":  { "label": "St. Louis, MO", "lat": 38.627, "lng": -90.1994 },
  "dropoff_location": { "label": "Dallas, TX", "lat": 32.7767, "lng": -96.797 },
  "current_cycle_used_hrs": 12.5,
  "start_at": "2026-09-20T06:00"            // optional, local to the home-terminal time zone
}
```

```jsonc
// 200 response
{
  "summary": {
    "total_miles": 961.4, "driving_hrs": 17.5, "on_duty_hrs": 19.5, "trip_hrs": 33.0,
    "start_at": "...", "pickup_eta": "...", "dropoff_eta": "...", "days": 2,
    "cycle_used_end_hrs": 32.0, "timezone": "America/Chicago"
  },
  "route": {
    "geometry": { "type": "LineString", "coordinates": [[lng, lat], ...] },   // simplified, max ~2,000 pts
    "legs": [ { "from": "Chicago, IL", "to": "St. Louis, MO", "miles": 297.1, "drive_hrs": 4.6 }, ... ]
  },
  "stops": [
    { "id": "s1", "type": "pickup|dropoff|fuel|break|rest|restart|start",
      "label": "Springfield, IL", "lat": 0, "lng": 0,
      "arrive_at": "...", "depart_at": "...", "duration_hrs": 0.5, "odometer_mi": 201.3 }
  ],
  "events": [ { "status": "OFF|SB|D|ON", "start_at": "...", "end_at": "...", "miles": 0, "note": "Pickup", "location": "St. Louis, MO" } ],
  "days": [
    {
      "date": "2026-09-20", "from": "Chicago, IL", "to": "Joplin, MO",
      "total_miles_driving": 540.2,
      "segments": [ { "status": "OFF", "start_min": 0, "end_min": 360 }, ... ],   // covers 0..1440 exactly
      "totals": { "OFF": 6.5, "SB": 5.5, "D": 11.0, "ON": 1.0 },
      "remarks": [ { "time_min": 360, "location": "Chicago, IL", "note": "On duty – start" }, ... ],
      "recap": { "on_duty_today": 12.0, "a_cycle_total": 24.5, "b_available_tomorrow": 45.5, "c_last_5_days": null }
    }
  ],
  "assumptions": [ "Average speed from truck routing profile", "Fuel stop = 30 min on duty", ... ],
  "warnings": [ ]    // e.g. "Cycle exhausted – 34-hr restart inserted on day 1"
}
```

**Errors:** `400 VALIDATION_ERROR` (field messages) · `422 LOCATION_NOT_FOUND` · `422 ROUTE_NOT_FOUND` (e.g., an overseas location) · `422 TRIP_TOO_LONG` (> 5,000 mi) · `502 PROVIDER_UNAVAILABLE` · `504 PROVIDER_TIMEOUT`.
Shape: `{ "error": { "code": "...", "message": "Human sentence.", "fields": { ... } } }`.

### `GET /api/geocode/autocomplete?q=chica` → `[{ label, lat, lng }]` (at most 6)
### `GET /api/health` → `{ "ok": true, "version": "<git sha>" }`

**Validation:** cycle must be between 0 and 70 inclusive. All 3 locations are required. Current may equal pickup (0-mi leg). Pickup may not equal dropoff (warn but allow).

## 7. The log sheet (the part graders look at hardest)

Recreate `blank-paper-log.png` as SVG (viewBox about 1000×760):

- **Header:** "Drivers Daily Log (24 hours)", month/day/year, From / To, boxes for *Total Miles Driving Today* and *Total Mileage Today*, truck/trailer numbers (placeholder "Truck #101 / Trailer #2201", editable as a stretch), carrier name, main office address, home terminal address.
- **Grid:** 4 rows (1. Off Duty, 2. Sleeper Berth, 3. Driving, 4. On Duty (not driving)). 24 hour columns labeled Mid-night, 1–11, Noon, 1–11, Mid-night. 15-min tick marks (tall tick on the half hour). A "Total Hours" column on the right, plus the grand total (24).
- **Duty line:** a single continuous path (stroke about 2.5 px, ink-blue `#1d4ed8`), horizontal on the active row, vertical at each change. This mirrors the hand-drawn style in the video.
- **Remarks:** under the grid, a bracket spanning each non-driving stop, and a line from the change time down to a rotated (−45°) label: "St. Louis, MO – Pickup".
- **Shipping documents:** "BOL-{short trip id}", shipper & commodity: "General Freight".
- **Recap (70 hr / 8 day column):** on duty today (lines 3 + 4), A, B, and C as defined in `HOS_RULES.md` §4. Gray out the 60/7 column.
- **Interaction:** hover a grid segment to see a tooltip with status, start–end, duration, and location. Day tabs or a horizontal pager ("Day 2 of 3"). Keyboard ←/→ changes the day.
- **Print:** each sheet on its own page, no app chrome, black ink.

Build it as a pure component: `<LogSheet day={DailyLog} meta={SheetMeta} />`. Snapshot-test the SVG path for G1.

## 8. UI/UX spec

**Principles:** one screen, no page navigation, instant clarity. Aim for a Linear/Vercel level of polish: restrained, typographic, one accent color.

**Layout (desktop ≥1024):**
```
┌──────────────────────────────────────────────────────────────────────┐
│ ● TruckLog      HOS-compliant trip planner         Assumptions  GitHub│
├───────────────┬──────────────────────────────────────────────────────┤
│ Plan a trip   │                                                      │
│ ○ Current     │                     MAP                              │
│ ○ Pickup      │   route + stop markers, auto-fit bounds               │
│ ○ Dropoff     │                                                      │
│ Cycle used ▭  │                                                      │
│ [Plan trip]   ├──────────────────────────────────────────────────────┤
│ Samples: ···  │ 1,961 mi · 33.5 h driving · 3 days · ETA Wed 14:20   │
│───────────────│  Itinerary (timeline)     │  Stops legend            │
│ Itinerary ... │                                                      │
├───────────────┴──────────────────────────────────────────────────────┤
│ Daily Logs   [Day 1] [Day 2] [Day 3]                 ⎙ Print / PDF   │
│  ┌───────────────── SVG log sheet ─────────────────┐                 │
└──────────────────────────────────────────────────────────────────────┘
```
**Mobile (<768):** the form stacks, then the summary chips, the map (60vh), itinerary, and swipeable log sheets. The log sheet scrolls horizontally inside its card. The page never scrolls horizontally.

**Design tokens:**
- Font: *Inter* (UI) + *JetBrains Mono* (numbers, times). Tabular numerals for all figures.
- Colors: neutral slate background `#f8fafc`, cards white with a `#e2e8f0` border and radius 12. Accent `#2563eb`.
  Status colors (map markers, timeline, legend): Driving `#2563eb` · On Duty `#f59e0b` · Off Duty `#64748b` · Sleeper `#7c3aed` · Restart `#dc2626`. Pickup/dropoff pins: `#16a34a` / `#0f172a`.
- Spacing on a 4-pt grid. Motion 150–200 ms ease-out. Honor `prefers-reduced-motion`.

**States:**
- *Empty:* a hero card that explains the three outputs, with sample-trip buttons and the map showing a US overview.
- *Loading:* the button shows a spinner; the map, summary, and log areas show skeletons. Step copy: "Geocoding → Routing → Applying HOS rules → Drawing logs".
- *Error:* an inline message on the offending field, or a toast for provider failures with a Retry button. Never a blank screen.
- *Long trip:* 6+ day tabs scroll horizontally, and the summary shows a warning chip ("Includes 34-hr restart").

**Accessibility:** labeled inputs, visible focus rings, contrast AA, a map alternative (the itinerary list), and an SVG `<title>`/`aria-label` per sheet.

**Frontend libraries:** react-leaflet + leaflet, @tanstack/react-query, react-hook-form + zod, lucide-react icons, tailwindcss, date-fns / date-fns-tz. Optional: shadcn/ui primitives (tabs, tooltip, drawer, toast).

## 9. Milestones (16 h budget)

| # | Milestone | Hrs | Exit criteria |
|---|---|---|---|
| M0 | Scaffold + **deploy hello-world** (Django `/api/health`, Vite app calling it, CORS, env vars) | 1.5 | The live URLs return health from the deployed backend |
| M1 | HOS engine + golden tests G1–G5 (pure Python, stub router) | 3.5 | `pytest` green, property tests pass on 500 random trips |
| M2 | Services: geocode, autocomplete, route (ORS + fallback), reverse geocode, time zone; `/plan` endpoint + API tests with mocked HTTP | 2.5 | A real Chicago→Dallas request returns the full contract in < 4 s |
| M3 | Frontend: form, autocomplete, map, summary, itinerary | 3.0 | End-to-end on the deployed URL |
| M4 | LogSheet SVG + day pager + print | 3.0 | G1 renders identically to the hand check, sums to 24, and prints cleanly |
| M5 | Polish: states, responsive, assumptions drawer, samples, README, QA pass | 1.5 | DoD checklist in CLAUDE.md §8 |
| M6 | Loom + submission | 1.0 | Links submitted |

**Cut line:** if M4 ends after hour 13, drop everything marked Stretch and ship.

## 10. Loom script (4:30 target)

1. **0:00–0:20 Hook.** "This is TruckLog. Enter a trip and get a legal route plan plus filled-out FMCSA daily logs."
2. **0:20–1:30 Demo.** Pick sample Chicago → St. Louis → Los Angeles with cycle 40. Show the map stops, fuel at ≤1,000 mi, the 30-min break at 8 h, 10-h rests, and click through Day 1..N logs. Point out totals = 24 and the remarks. Then run cycle 68 to show a 34-h restart.
3. **1:30–2:30 HOS engine.** Walk through `hos/engine.py`: event simulation, the `min()` of limits, and the golden and property tests (run `pytest` on screen).
4. **2:30–3:30 Architecture.** Stateless Django API, provider fallbacks and caching, the backend owning the logic while the frontend renders, and the SVG log renderer.
5. **3:30–4:15 Decisions and trade-offs.** Assumptions drawer, conservative cycle handling, what I'd do next (split sleeper, ELD export, saved trips).
6. **4:15–4:30 Close.** Links.

## 11. QA checklist (run on the deployed URL)

- [ ] Short trip (<11 h driving, single day), e.g., Dallas → Fort Worth → Austin
- [ ] Current == pickup (0-mi first leg)
- [ ] Coast to coast (NYC → Chicago → LA): multiple days, fuel stops every ≤1,000 mi, 10-h rests
- [ ] Cycle 69.5 → immediate 34-h restart after pickup
- [ ] Cycle 70 → restart before the first drive
- [ ] Invalid location "asdfgh" → field error
- [ ] Overseas dropoff (e.g., London) → ROUTE_NOT_FOUND message
- [ ] Every sheet sums to 24, miles per day add up to the route total, and the recap A/B are consistent across days
- [ ] Mobile Safari/Chrome at 375 px. Print preview
- [ ] Cold-start time of the backend (if > 10 s, add a warm-up ping from the frontend on page load)

## 12. Deployment

- **Frontend:** Vercel project `frontend/`, framework Vite, env `VITE_API_BASE_URL`.
- **Backend:** Vercel Python runtime (Django WSGI, stateless, which suits serverless). Fallback: Render free web service (`gunicorn config.wsgi`) with a warm-up ping. Use `whitenoise` only if the admin is kept.
- **Settings:** `DEBUG=False`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` = the frontend domain, `SECURE_*` defaults.
- **README:** live link at the top, a screenshot, quickstart, architecture diagram, assumptions, test instructions, and a Loom link.

## 13. Risks

| Risk | Mitigation |
|---|---|
| ORS quota or outage during grading | LRU cache, OSRM + Nominatim fallback, clear error with Retry |
| Serverless cold start / timeouts on long routes | Simplify geometry, cap reverse-geocode calls (dedupe by city), parallelize with a thread pool, 10 s timeouts |
| HOS edge-case bug seen by graders | Golden + property tests, and on-screen assumptions |
| Log drawing looks off vs the paper form | Build from `blank-paper-log.png` measurements. Compare side by side before M4 exit |
| Over-scoping polish | Shape Up cut line at hour 13 |
