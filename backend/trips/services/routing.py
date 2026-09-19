"""Truck routing: OpenRouteService `driving-hgv` first, the public OSRM demo as a
fallback. Returns one leg per stop pair with its own geometry."""

import logging
from dataclasses import dataclass
from functools import lru_cache

from .errors import ProviderError
from .http import ORS_BASE, UpstreamError, get_json, ors_key, post_json

log = logging.getLogger(__name__)

METERS_PER_MILE = 1609.344
MAX_AVG_MPH = 65  # routers can be optimistic; trucks rarely average more
MAX_TRIP_MI = 5000
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"

Coord = tuple[float, float]  # (lng, lat), GeoJSON order


@dataclass(frozen=True)
class RouteLeg:
    distance_mi: float
    duration_min: float
    coordinates: tuple[Coord, ...]


@dataclass(frozen=True)
class Route:
    legs: tuple[RouteLeg, ...]
    provider: str


def _leg(distance_m: float, duration_s: float, coords: list) -> RouteLeg:
    miles = distance_m / METERS_PER_MILE
    minutes = max(duration_s / 60, miles / MAX_AVG_MPH * 60)
    return RouteLeg(miles, minutes, tuple((c[0], c[1]) for c in coords))


@lru_cache(maxsize=128)
def route(stops: tuple[Coord, ...]) -> Route:
    try:
        result = _ors(stops)
    except ProviderError as exc:
        if exc.code in ("ROUTE_NOT_FOUND", "TRIP_TOO_LONG", "LOCATION_NOT_ROUTABLE"):
            raise
        log.warning("ORS routing failed, using OSRM: %s", exc)
        result = _osrm(stops)
    total = sum(leg.distance_mi for leg in result.legs)
    if total > MAX_TRIP_MI:
        raise ProviderError(
            "TRIP_TOO_LONG",
            f"This trip is {total:,.0f} mi. Plans are limited to {MAX_TRIP_MI:,} mi.",
        )
    return result


def _ors(stops: tuple[Coord, ...]) -> Route:
    try:
        body = post_json(
            f"{ORS_BASE}/v2/directions/driving-hgv/geojson",
            headers={"Authorization": ors_key()},
            json={"coordinates": [list(s) for s in stops], "radiuses": [5000] * len(stops)},
        )
    except UpstreamError as exc:
        raise _ors_error(exc) from exc

    feature = body["features"][0]
    coords = feature["geometry"]["coordinates"]
    waypoints = feature["properties"]["way_points"]
    legs = tuple(
        _leg(seg.get("distance", 0), seg.get("duration", 0), coords[a : b + 1])
        for seg, a, b in zip(
            feature["properties"]["segments"], waypoints[:-1], waypoints[1:], strict=True
        )
    )
    return Route(legs, "openrouteservice")


def _ors_error(exc: UpstreamError) -> ProviderError:
    error = (exc.body or {}).get("error", {}) if isinstance(exc.body, dict) else {}
    code = error.get("code") if isinstance(error, dict) else None
    if code == 2010:
        return ProviderError(
            "LOCATION_NOT_ROUTABLE",
            "One of the locations isn't near a road a truck can reach. Try a nearby city.",
        )
    if code == 2004:
        return ProviderError("TRIP_TOO_LONG", f"Plans are limited to {MAX_TRIP_MI:,} mi.")
    if code == 2009:
        return ProviderError(
            "ROUTE_NOT_FOUND", "No drivable route connects these locations. Are they in the US?"
        )
    return exc


def _osrm(stops: tuple[Coord, ...]) -> Route:
    legs = []
    for a, b in zip(stops, stops[1:], strict=False):
        path = f"{a[0]},{a[1]};{b[0]},{b[1]}"
        body = get_json(f"{OSRM_URL}/{path}", params={"overview": "full", "geometries": "geojson"})
        if body.get("code") != "Ok" or not body.get("routes"):
            raise ProviderError(
                "ROUTE_NOT_FOUND", "No drivable route connects these locations. Are they in the US?"
            )
        r = body["routes"][0]
        legs.append(_leg(r["distance"], r["duration"], r["geometry"]["coordinates"]))
    return Route(tuple(legs), "osrm")
