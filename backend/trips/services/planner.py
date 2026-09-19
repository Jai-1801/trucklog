"""Orchestrates one plan request: places -> route -> HOS engine -> labels -> log sheets.
Everything here is I/O glue; the rules live in trips/hos/."""

import math
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cache
from zoneinfo import ZoneInfo

from timezonefinder import TimezoneFinder

from trips.hos.engine import MIN_DRIVE_MI, simulate
from trips.hos.logsheets import DailyLog, build_daily_logs
from trips.hos.models import DutyEvent, DutyStatus, EventKind, HosLimits, Leg

from . import geocoding, routing
from .geocoding import Place
from .geometry import RouteLocator, simplify

NOTES = {
    EventKind.DRIVE: "Driving",
    EventKind.PICKUP: "Pickup (loading)",
    EventKind.DROPOFF: "Dropoff (unloading)",
    EventKind.FUEL: "Fuel stop",
    EventKind.BREAK: "30-min break",
    EventKind.REST: "10-hr sleeper berth rest",
    EventKind.RESTART: "34-hr restart",
    None: "Off duty (trip complete)",
}

ASSUMPTIONS = [
    "Property-carrying driver on the 70-hour / 8-day cycle; no adverse driving conditions.",
    "Driver starts rested (10+ hours off) at the trip start time.",
    "Limits: 11 h driving and a 14-h window per duty period, a 30-min break after 8 h of "
    "driving, 10 h off to reset, 34 h off to restart the cycle.",
    "Pickup and dropoff take 1 hour each (on duty, not driving).",
    "Fuel at least every 1,000 miles; each fuel stop is 30 min on duty.",
    "Daily rests are logged in the sleeper berth; 30-min breaks and restarts as off duty.",
    "Drive times come from truck routing (OpenRouteService HGV profile), capped at 65 mph "
    "average, and planned on a 15-minute grid like a paper log (rounded up).",
    "Cycle hours already used are assumed not to roll off during the trip (conservative).",
    "Times use the home-terminal time zone, taken from the current location.",
    "A calendar day may show more than 11 h of driving when it spans two duty periods.",
]


@dataclass(frozen=True)
class PlaceInput:
    label: str | None = None
    short: str | None = None
    lat: float | None = None
    lng: float | None = None
    query: str | None = None


@dataclass(frozen=True)
class PlanRequest:
    current: PlaceInput
    pickup: PlaceInput
    dropoff: PlaceInput
    cycle_used_hrs: float
    start_at: datetime | None = None  # naive, home-terminal wall clock


@cache
def _tz_finder() -> TimezoneFinder:
    return TimezoneFinder()


def _resolve(place: PlaceInput) -> Place:
    if place.lat is not None and place.lng is not None:
        label = place.label or f"{place.lat:.4f}, {place.lng:.4f}"
        short = place.short or label.removesuffix(", USA")
        return Place(label, short, place.lat, place.lng)
    return geocoding.geocode((place.query or place.label or "").strip())


def _next_quarter_hour(dt: datetime) -> datetime:
    dt = dt.replace(second=0, microsecond=0)
    return dt + timedelta(minutes=-dt.minute % 15)


def plan_trip(req: PlanRequest) -> dict:
    with ThreadPoolExecutor(max_workers=8) as pool:
        current, pickup, dropoff = pool.map(_resolve, (req.current, req.pickup, req.dropoff))
        route = routing.route(tuple((p.lng, p.lat) for p in (current, pickup, dropoff)))

        limits = HosLimits()
        cycle_used_min = round(req.cycle_used_hrs * 60)
        to_pickup, to_dropoff = (Leg(leg.distance_mi, leg.duration_min) for leg in route.legs)
        events = simulate(to_pickup, to_dropoff, cycle_used_min, limits)

        tz_name = _tz_finder().timezone_at(lng=current.lng, lat=current.lat) or "America/Chicago"
        tz = ZoneInfo(tz_name)
        start = _next_quarter_hour(req.start_at or datetime.now(tz).replace(tzinfo=None))

        locator = RouteLocator(route.legs, MIN_DRIVE_MI)
        pickup_mi = next(e.start_mi for e in events if e.kind == EventKind.PICKUP)
        known = {0.0: current.short, round(pickup_mi, 1): pickup.short}
        known[round(events[-1].end_mi, 1)] = dropoff.short

        # Dry run to learn which mile markers need a place name, then look them up at once.
        needed: set[float] = {round(e.start_mi, 1) for e in events}

        def record(mi: float) -> str:
            needed.add(round(mi, 1))
            return ""

        build_daily_logs(events, start, cycle_used_min, record, limits)
        lookups = [mi for mi in needed if mi not in known]
        points = [locator.point_at(mi) for mi in lookups]
        names = pool.map(lambda p: geocoding.reverse(p[1], p[0]), points)
        labels = known | dict(zip(lookups, names, strict=True))

    def label_at(mi: float) -> str:
        return labels.get(round(mi, 1)) or labels[min(labels, key=lambda k: abs(k - mi))]

    days = build_daily_logs(events, start, cycle_used_min, label_at, limits)

    def at(minute: int) -> str:
        return (start + timedelta(minutes=minute)).replace(tzinfo=tz).isoformat()

    return {
        "summary": _summary(events, days, start, tz_name, cycle_used_min, route.provider, at),
        "route": {
            "geometry": {
                "type": "LineString",
                "coordinates": simplify(tuple(c for leg in route.legs for c in leg.coordinates)),
            },
            "legs": [
                {
                    "from": a.short,
                    "to": b.short,
                    "miles": round(leg.distance_mi, 1),
                    "drive_hrs": round(leg.duration_min / 60, 2),
                }
                for leg, a, b in zip(route.legs, (current, pickup), (pickup, dropoff), strict=True)
            ],
            "provider": route.provider,
        },
        "places": {
            name: {"label": p.label, "short": p.short, "lat": p.lat, "lng": p.lng}
            for name, p in (("current", current), ("pickup", pickup), ("dropoff", dropoff))
        },
        "stops": _stops(events, locator, label_at, at, current),
        "events": [
            {
                "status": e.status.value,
                "kind": e.kind.value,
                "start_at": at(e.start_min),
                "end_at": at(e.end_min),
                "duration_hrs": e.duration_min / 60,
                "miles": round(e.miles, 1),
                "odometer_mi": round(e.start_mi, 1),
                "location": label_at(e.start_mi),
                "note": NOTES[e.kind],
            }
            for e in events
        ],
        "days": [_day(d) for d in days],
        "assumptions": ASSUMPTIONS,
        "warnings": _warnings(events, cycle_used_min, route.provider, limits),
    }


def _stops(events: list[DutyEvent], locator: RouteLocator, label_at, at, current: Place) -> list:
    stops = [
        {
            "id": "start",
            "type": "start",
            "label": current.short,
            "lat": current.lat,
            "lng": current.lng,
            "arrive_at": at(0),
            "depart_at": at(0),
            "duration_hrs": 0,
            "odometer_mi": 0,
        }
    ]
    for i, e in enumerate(events):
        if e.kind == EventKind.DRIVE:
            continue
        lng, lat = locator.point_at(e.start_mi)
        stops.append(
            {
                "id": f"s{i}",
                "type": e.kind.value,
                "label": label_at(e.start_mi),
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "arrive_at": at(e.start_min),
                "depart_at": at(e.end_min),
                "duration_hrs": e.duration_min / 60,
                "odometer_mi": round(e.start_mi, 1),
            }
        )
    return stops


def _day(d: DailyLog) -> dict:
    return {
        "day_number": d.day_number,
        "date": d.date.isoformat(),
        "from": d.from_location,
        "to": d.to_location,
        "total_miles_driving": round(d.miles_driven, 1),
        "segments": [
            {"status": s.status.value, "start_min": s.start_min, "end_min": s.end_min}
            for s in d.segments
        ],
        "totals": {status.value: d.totals_min[status] / 60 for status in DutyStatus},
        "remarks": [
            {
                "time_min": r.time_min,
                "location": r.location,
                "kind": r.kind.value if r.kind else "off",
                "note": NOTES[r.kind],
                "duration_min": r.duration_min,
            }
            for r in d.remarks
        ],
        "recap": {
            "on_duty_today": d.on_duty_today_min / 60,
            "a_cycle_total": d.cycle_total_min / 60,
            "b_available_tomorrow": d.cycle_available_min / 60,
            "c_last_5_days": None,
        },
    }


def _summary(events, days, start, tz_name, cycle_used_min, provider, at) -> dict:
    def total(status: DutyStatus) -> float:
        return sum(e.duration_min for e in events if e.status == status) / 60

    by_kind = {kind.value: sum(1 for e in events if e.kind == kind) for kind in EventKind}
    pickup = next(e for e in events if e.kind == EventKind.PICKUP)
    return {
        "total_miles": round(events[-1].end_mi, 1),
        "driving_hrs": total(DutyStatus.DRIVING),
        "on_duty_hrs": total(DutyStatus.DRIVING) + total(DutyStatus.ON_DUTY),
        "trip_hrs": events[-1].end_min / 60,
        "start_at": at(0),
        "pickup_at": at(pickup.start_min),
        "dropoff_at": at(events[-1].start_min),
        "end_at": at(events[-1].end_min),
        "days": len(days),
        "cycle_used_start_hrs": math.ceil(cycle_used_min / 15) * 15 / 60,
        "cycle_used_end_hrs": days[-1].cycle_total_min / 60,
        "timezone": tz_name,
        "stop_counts": {k: v for k, v in by_kind.items() if k != "drive"},
        "routing_provider": provider,
    }


def _warnings(events, cycle_used_min, provider, limits: HosLimits) -> list[str]:
    warnings = []
    if cycle_used_min >= limits.cycle_min:
        warnings.append("Cycle already at 70 h: a 34-hr restart comes before any driving.")
    elif any(e.kind == EventKind.RESTART for e in events):
        warnings.append("The 70-hr cycle runs out mid-trip, so the plan includes a 34-hr restart.")
    if provider != "openrouteservice":
        warnings.append(
            "Truck routing was unavailable, so car routing was used. Times may be optimistic."
        )
    return warnings
