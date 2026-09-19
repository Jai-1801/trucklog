# CLAUDE.md — TruckLog (Spotter AI Full-Stack Assessment)

> Operating manual for AI agents and humans working in this repo. Read this first, every session.
> Deep specs live in `docs/`. This file stays short. If it disagrees with `docs/`, fix whichever is wrong.

## 1. What we're building (one breath)

A Django + React app. A truck driver enters **current location, pickup, dropoff, and current cycle hours used**.
The app returns **(a)** a map of the route with every stop and rest, and **(b)** the FMCSA **Driver's Daily Log sheets**,
drawn and filled in, one per calendar day. The logs must obey Hours-of-Service rules exactly.

**Graders test the hosted URL for accuracy, and they judge UI/UX.** Both count. Pretty and wrong fails. Correct but ugly scores badly.

Deliverables: public GitHub repo, a hosted URL, and a 3–5 min Loom. Budget: **16 work hours or less over 4 days or less.**

**Live:** app https://trucklog-web.vercel.app · API https://trucklog-api-pi.vercel.app/api/health · repo https://github.com/Jai-1801/trucklog
Deploy: **push to `main`**. Both Vercel projects are Git-connected (`trucklog-api` has Root Directory `backend`, `trucklog-web` has `frontend`), so every push to `main` deploys both to production. Don't run `vercel deploy` from inside `backend/` or `frontend/`: with a Root Directory set, the CLI expects the repo root.
In Git Bash, prefix `vercel api` calls with `MSYS_NO_PATHCONV=1`, or the `/v9/...` path gets rewritten into a Windows path.

## 2. Source of truth (read before touching the engine)

| File | What it is |
|---|---|
| `docs/BUILD.md` | Product spec, architecture, API contract, UI spec, milestones, Loom script |
| `docs/HOS_RULES.md` | Hours-of-Service engine spec, golden test scenarios, log-drawing rules |
| `new-full-stack-dev-assessment.docx` | Original brief from Spotter (inputs, outputs, assumptions) |
| `fmcsa-hos-395-drivers-guide-to-hos-2022-04-28-0-1-.pdf` | FMCSA HOS guide. Pages 6–11 (limits) and 15–19 (log format) matter |
| `blank-paper-log.png` | The log sheet we must reproduce visually |
| `fmsca-image (1).png` | Guide TOC. Highlighted sections are the ones in scope |
| Video `youtube.com/watch?v=whxe41XYXS8` | Schneider: "How to fill out a log book". Reference for drawing style (lines, vertical connectors, remark brackets) |

## 3. Non-negotiable assumptions (from the brief)

- Property-carrying driver, **70 hr / 8 day** cycle, no adverse driving conditions, no short-haul exceptions.
- **Fuel at least once every 1,000 miles** (a fuel stop is 30 min On Duty).
- **Pickup = 1 hr On Duty, Dropoff = 1 hr On Duty.**
- Limits: **11 hr driving**, **14 hr window**, **30 min break after 8 hr cumulative driving**, **10 hr off to reset**, **34 hr restart** when the cycle is exhausted.
- No split-sleeper tricks. We plan conservatively and legally. Full detail: `docs/HOS_RULES.md`.

## 4. Stack & layout

```
backend/            Django 5.2 + DRF. Stateless planning API (no DB, no sessions). Deployed via vercel.json
  config/           settings, urls, wsgi
  trips/
    hos/            PURE-PYTHON HOS engine: no Django, no I/O, fully unit-tested
      engine.py     simulate(legs, cycle_used, start) -> list[DutyEvent]
      logsheets.py  split events at midnight -> DailyLog[] (grid segments, totals, remarks, recap)
      models.py     dataclasses: DutyStatus, DutyEvent, Stop, DailyLog
    services/       external I/O only: geocoding.py, routing.py (with timeouts, caching, fallbacks)
    api/            serializers.py, views.py, urls.py
    tests/          pytest. Engine golden tests + API tests with mocked providers
frontend/           React 19 + Vite 8 + TypeScript (strict) + Tailwind v4 + oxlint
  src/
    features/trip-form/   inputs, location autocomplete, validation
    features/route-map/   react-leaflet map, route polyline, stop markers, popups
    features/itinerary/   timeline of duty events
    features/eld-log/     <LogSheet/> pure SVG renderer, print/PDF export
    lib/api.ts            typed client; types mirror the API contract in docs/BUILD.md
docs/
```

**Boundary rule:** the backend owns all HOS logic and returns ready-to-draw day data. The frontend **renders only**.
It never re-derives HOS math. Every number on a log sheet traces back to one engine event.

## 5. Commands

```bash
# backend
cd backend && python -m venv .venv && source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements-dev.txt   # runtime deps pinned in requirements.txt
python manage.py runserver 8000
pytest -q                          # must be green before any commit
ruff check . && ruff format .

# frontend
cd frontend && npm install
npm run dev                        # http://localhost:5173 (use `localhost`, not 127.0.0.1), proxies /api -> :8000
npm run typecheck && npm run lint && npm run test
npm run build
```

Environment variables (never commit real values; keep `.env.example` current):
`ORS_API_KEY` (OpenRouteService), `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `VITE_API_BASE_URL`.

## 6. How we work (borrowed from teams who ship great product)

1. **Correctness first, then craft (Stripe).** The HOS engine is the product. Write the golden tests in `docs/HOS_RULES.md` *before* the engine. Nothing ships if a golden test is red.
2. **Fixed time, variable scope (Basecamp's Shape Up).** 16 hours is the appetite. When something slips, cut from the "Stretch" list in `docs/BUILD.md`. Never cut from "Must". Never extend the deadline.
3. **Ship to production on day 1 (Vercel).** A hello-world frontend and backend deployed end to end before any feature work. Deploy after every milestone. The hosted URL is the one graders use, so that is the one to test.
4. **Quality is a feature (Linear).** Crisp type, generous spacing, one accent color, instant feedback, no layout shift, skeletons over spinners, clear empty and error states. Every state gets designed: empty, loading, success, error, and a very long trip.
5. **Work backwards from the demo (Amazon).** The Loom script in `docs/BUILD.md` §10 is the acceptance test. If a feature doesn't show up in it, it's probably scope creep.
6. **Small, verifiable steps.** One concern per commit and a conventional message (`feat(hos): ...`, `fix(log): ...`). Run tests before claiming anything works. Show output, don't assert it.
7. **Make assumptions visible.** Every modeling choice (average speed, fuel duration, time zone, recap math) is listed in the app's "Assumptions" drawer and in `docs/HOS_RULES.md` §Decisions. Graders forgive a stated assumption. They don't forgive a hidden one.

## 7. Code conventions

- **Python:** type hints everywhere, `@dataclass(frozen=True)` for engine models. Time is handled internally as **minutes since trip start (int)** or aware `datetime`, never floats of hours in logic. Hours appear only at the display/serializer edge. The engine itself plans on a 15-minute grid (see `HOS_RULES.md` §6), so the drawing code never rounds.
- **Engine purity:** `trips/hos/` imports nothing from Django, `requests`, or `services/`. Test it with plain pytest.
- **External APIs:** always set a timeout (≤10 s), catch provider errors, and return a typed 4xx/5xx with a human message (`{"error": {"code": "ROUTE_NOT_FOUND", "message": "..."}}`). Cache geocode and route calls in-process (LRU) to spare free-tier quotas.
- **TypeScript:** `strict: true`, no `any`. API types live in one file (`lib/types.ts`) that matches the contract. Components are small and presentational. Data fetching goes through TanStack Query.
- **Styling:** Tailwind v4. Design tokens live in the `@theme` block of `frontend/src/index.css` (see `docs/BUILD.md` §8), used as `bg-accent`, `text-muted`, `bg-status-driving`, etc. No inline magic hex values.
- **Log sheet** is SVG with a fixed `viewBox` so it scales crisply, prints cleanly, and exports to PDF.
- No dead code, no commented-out blocks, no `console.log` in commits. Match surrounding style.

## 8. Definition of done (per feature)

- [ ] Golden tests and new unit tests pass (`pytest -q`, `npm run test`)
- [ ] Typecheck and lint are clean
- [ ] Works on the **deployed** URL, not only localhost
- [ ] Empty, loading, and error states are handled
- [ ] Looks right at 375 px (mobile) and 1440 px (desktop)
- [ ] Every log sheet sums to exactly 24.00 hrs, and the cycle recap matches engine totals
- [ ] Assumptions are documented if a new one was introduced

## 9. Guardrails for agents

- Don't change the HOS rules or the golden expectations to make a test pass. If you think a rule is wrong, stop and flag it with the page number in the FMCSA PDF.
- Don't add a database, auth, or accounts. The app is stateless by design (stretch: shareable URL via query string).
- Don't commit secrets, `.env`, `node_modules`, `.venv`, or `db.sqlite3`.
- Don't swap the map or routing provider without updating `docs/BUILD.md` §5.
- Ask before adding any dependency over ~50 kB gzip to the frontend.
- Don't add a `pyproject.toml` to `backend/`. Vercel's Python builder then expects a uv `[project]` table and the deploy fails. Tool config lives in `pytest.ini` / `ruff.toml`, and deps in `requirements.txt`.
- When unsure about product behavior, check `docs/BUILD.md` first, then the brief, then ask.
