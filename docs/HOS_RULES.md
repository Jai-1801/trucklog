# HOS Engine Spec

> The accuracy-critical core. Source: FMCSA *Interstate Truck Driver's Guide to Hours of Service* (2022), pp. 5–19.
> Scope: property-carrying CMV, 70 hr / 8 day, no adverse conditions, no short-haul exceptions, no split sleeper.

## 1. Duty statuses (the 4 rows on the log)

| Row | Status | Used for in our plan |
|---|---|---|
| 1 | **Off Duty** (`OFF`) | Time before the trip starts, 30-min breaks, 34-hr restart, time after the trip ends |
| 2 | **Sleeper Berth** (`SB`) | 10-hr daily rest (an OTR truck is assumed to have a sleeper) |
| 3 | **Driving** (`D`) | Time at the controls while moving |
| 4 | **On Duty, Not Driving** (`ON`) | Pickup (1 h), dropoff (1 h), fueling (30 min) |

On-duty time includes fueling and loading/unloading (p. 5). Both Driving and On Duty count toward the 14-hr window and the 70-hr cycle.

## 2. Rules the engine enforces

| # | Rule | Source | Engine behavior |
|---|---|---|---|
| R1 | **11-hr driving limit**: at most 11 h driving after 10 consecutive hours off | §395.3(a)(3), p. 6 | When `drive_since_reset == 11h`, insert a 10-h `SB` rest |
| R2 | **14-hr window**: no driving after the 14th hour since coming on duty after 10 h off. On-duty work after hour 14 is allowed | §395.3(a)(2), p. 6 | The window opens at the first on-duty or driving minute after a reset. When `now - window_start == 14h`, driving stops and a 10-h rest follows. On-duty tasks (e.g. dropoff) may finish past hour 14 |
| R3 | **30-min break** after **8 h cumulative driving** since the last ≥30-min non-driving period. Off, SB, or On Duty all qualify if consecutive | §395.3(a)(3)(ii), p. 10 | When `drive_since_break == 8h`, insert a 30-min `OFF` break. Any consecutive non-driving block of 30 min or more (fuel, pickup, dropoff, rest) resets `drive_since_break` |
| R4 | **70 hr / 8 day**: no driving once on-duty hours (D + ON) in the rolling window reach 70 | §395.3(b), p. 10 | `cycle_used = input + all D/ON minutes so far`. When it hits 70 h, insert a **34-h `OFF` restart**, then set `cycle_used = 0` |
| R5 | **34-hr restart**: 34 or more consecutive hours off/SB resets the cycle to 0 | §395.3(c), p. 11 | As above. A 34-h restart also resets R1, R2, and R3 |
| R6 | **10-hr reset**: 10 or more consecutive hours off/SB resets R1 and R2 | p. 6–7 | After a 10-h rest: `drive_since_reset = 0`, `window_start = None`, `drive_since_break = 0` |
| A1 | **Fuel at least every 1,000 mi** | Brief | Before a drive segment would push `miles_since_fuel` over 1,000, stop at the 1,000-mi point and add 30 min `ON` fueling. Assume the tank is full at trip start |
| A2 | **Pickup 1 h, dropoff 1 h** | Brief | `ON` for 60 min at the pickup and dropoff coordinates |

## 3. Algorithm (discrete-event simulation)

```
inputs:
  legs = [ (current → pickup), (pickup → dropoff) ]    # each: distance_mi, duration_min, geometry
  cycle_used_min, start_at (aware datetime in home-terminal tz)

state: t (minutes since start), drive_since_reset, drive_since_break, window_start,
       cycle_used, miles_since_fuel, odometer, events[]

for leg in legs:
    speed = leg.distance_mi / leg.duration_min            # per-leg average speed from the router
    remaining = leg.distance_mi
    while remaining > 0:
        if cycle_used >= 70h:              add OFF 34h  ("34-hr restart"); reset all; continue
        if drive_since_reset >= 11h or window_expired(): add SB 10h ("10-hr rest"); reset daily; continue
        if drive_since_break >= 8h:        add OFF 30m  ("30-min break"); drive_since_break = 0; continue
        if miles_since_fuel >= 1000:       add ON 30m   ("Fuel");  miles_since_fuel = 0; drive_since_break = 0; continue
        open window if closed (window_start = t)
        chunk_min = min( remaining / speed,
                         11h - drive_since_reset,
                         14h - (t - window_start),
                         8h  - drive_since_break,
                         70h - cycle_used,
                         (1000 - miles_since_fuel) / speed )
        add D chunk_min; advance odometer, counters, remaining
    at end of leg 0: add ON 60m ("Pickup")    # opens the window if closed; counts toward cycle; resets drive_since_break
    at end of leg 1: add ON 60m ("Dropoff")
after dropoff: trip ends. Logs pad OFF to midnight.
```

Notes:
- **On-duty tasks and the 70-hr limit.** If the cycle hits 70 during pickup, the task still completes, because on-duty work past 70 is legal and only driving is barred (p. 10). The restart comes before the next drive.
- **On-duty tasks and the 14-hr window.** Same principle. Dropoff may extend past hour 14.
- **Ordering when several limits hit at once:** 34h restart > 10h rest > fuel > 30-min break. A 10-h rest also satisfies the 30-min break. If fuel and break are both due, one 30-min `ON` fuel stop satisfies both, since R3 accepts on-duty time.
- **Zero-length current→pickup leg** (driver already at pickup): skip the drive and go straight to the pickup task.
- **Stop geolocation:** every non-driving event gets a coordinate by interpolating the odometer along the leg polyline. Labels come from a reverse geocode, formatted as "City, ST" (FMCSA remark format, p. 17).
- **Precision:** simulate in whole minutes. Sub-minute rounding is carried forward so totals stay exact.

## 4. Turning events into daily log sheets

1. **Time base:** home-terminal time zone, taken from the current location's time zone (shown in the UI). Every day runs midnight to midnight (p. 16).
2. Day 1 starts `OFF` from 00:00 to the trip start. The last day ends `OFF` from trip end to 24:00. A 34-h restart that spans calendar days appears on each day it touches.
3. Split any event that crosses midnight.
4. Per day, output:
   - `segments`: `[ {status, start_min, end_min} ]` covering 0–1440 with no gaps or overlaps
   - `totals`: hours per status. **They must sum to 24.00**
   - `total_miles_driving_today`: sum of miles on `D` segments
   - `remarks`: one entry per duty-status change, `{time_min, location "City, ST", note}` (e.g., "Pickup", "Fuel", "30-min break", "10-hr rest")
   - `from` / `to`: location at 00:00 (or start) and at 24:00 (or end)
   - `recap` (70/8 column): `on_duty_today = D + ON`, `A = cycle hours after today` (input cycle + trip D/ON so far, reset by a 34h restart), `B = 70 − A` (hours available tomorrow). "C" (last 5 days) can't be derived from a single cycle-hours input, so render "—" and explain in a tooltip.
5. **Drawing rules** (p. 17 and the video): a solid horizontal line on the active row, a **vertical connector** at every status change, and a remark bracket under the grid marking where each non-driving stop starts and ends, with the location written at an angle beneath it (paper-log convention). Totals go in the right column. The grid has 15-minute ticks.

## 5. Golden scenarios (write these as pytest cases FIRST)

All scenarios use a **fixed 50 mph** stub router and start at **06:00 on Day 1**, with cycle 0 unless stated.

### G1: Basic two-day trip (0 mi to pickup, 1,000 mi to dropoff)

| Time | Status | Note | Odometer |
|---|---|---|---|
| D1 06:00–07:00 | ON | Pickup | 0 |
| D1 07:00–15:00 | D | 8 h (R3 limit) | 400 |
| D1 15:00–15:30 | OFF | 30-min break | 400 |
| D1 15:30–18:30 | D | 3 h (R1: 11 h reached) | 550 |
| D1 18:30 – D2 04:30 | SB | 10-hr rest | 550 |
| D2 04:30–12:30 | D | 8 h | 950 |
| D2 12:30–13:00 | OFF | 30-min break | 950 |
| D2 13:00–14:00 | D | 1 h | 1000 (arrive; exactly 1,000, so no fuel needed) |
| D2 14:00–15:00 | ON | Dropoff | 1000 |

Expected totals. **Day 1:** OFF 6.5, SB 5.5, D 11, ON 1 (= 24). **Day 2:** OFF 9.5, SB 4.5, D 9, ON 1 (= 24).
Cycle after trip: 22 h. Miles: D1 550, D2 450.

### G2: Fuel stop (0 mi to pickup, 1,200 mi to dropoff)

Same as G1 until D2 13:00. Then: D 13:00–14:00 (mi 1000) → **ON Fuel 14:00–14:30** → D 14:30–16:30 (mi 1100; 11 h reached) → SB 16:30 – D3 02:30 → D 02:30–04:30 (mi 1200) → ON Dropoff 04:30–05:30.
Totals. **Day 2:** OFF 0.5, SB 12, D 11, ON 0.5. **Day 3:** OFF 18.5, SB 2.5, D 2, ON 1.

### G3: Cycle exhaustion (cycle_used = 65, 0 mi to pickup, 500 mi to dropoff)

ON Pickup 06:00–07:00 (cycle 66) → D 07:00–11:00 (cycle 70, mi 200) → **OFF 34-hr restart D1 11:00 – D2 21:00** → D D2 21:00 – D3 03:00 (6 h, remaining 300 mi, mi 500) → ON Dropoff D3 03:00–04:00.
Assert: no driving while cycle ≥ 70, the restart is exactly 34 h, the cycle resets to 0 afterwards, and Day 2 shows OFF from 00:00–21:00.

### G4: 14-hr window binds before 11-hr driving

cycle 0, **300 mi to pickup**, then 600 mi. D 06:00–12:00 (300 mi, 6 h) → ON Pickup 12:00–13:00 (resets the 8-h break counter) → D 13:00–18:00 (5 h, 11 h total, mi 550) → SB 10 h.
Also add a variant where pickup takes place late in the window, and assert the dropoff/pickup task may run past hour 14 while driving never does.

### G5: Property tests (Hypothesis or loops over random inputs)

For random distances 0–3,000 mi and cycle 0–70:
- every day's totals sum to 1440 min
- driving never exceeds 11 h between 10-h resets
- no driving minute falls more than 14 h after the window opened
- no more than 8 h of driving without a ≥30-min non-driving block
- cycle never exceeds 70 h at any driving minute
- `miles_since_fuel` never exceeds 1,000
- the final odometer equals the route distance (±0.1 mi)

## 6. Decisions (show these in the app's "Assumptions" drawer)

| Decision | Choice | Why |
|---|---|---|
| Speed | Per-leg average from the router's truck profile (ORS `driving-hgv`), capped at 65 mph | More realistic than a flat 55 mph and stays traceable to the route |
| Trip start | User-chosen date/time. Default: next full hour, local | Deterministic and editable |
| Prior state | Driver starts fresh (10+ h off before start). Cycle hours come from the input | The brief only provides cycle used |
| Rolling-window drop-off | Conservative: the input cycle hours don't drop off during the trip | We don't know the per-day history. It's legal (never under-counts) |
| 10-h rest | Logged as Sleeper Berth | Standard OTR practice, matches the video |
| 30-min break | Logged as Off Duty | Most common practice |
| Fuel duration | 30 min On Duty | Industry typical. The brief doesn't specify |
| Pre/post-trip inspection | Off by default (stretch toggle: 15 min ON each) | Not in the brief's assumptions. Keeps totals verifiable |
| Split sleeper | Not used | Simpler and always legal |
| Time zone | The current location's zone for the whole trip (home-terminal rule, p. 16) | FMCSA requirement |
