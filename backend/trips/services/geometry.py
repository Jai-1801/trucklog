"""Where on the road is trip mile X? The engine speaks in odometer miles; the map
and the remarks need coordinates."""

import math
from bisect import bisect_left

from .routing import Coord, RouteLeg

EARTH_RADIUS_MI = 3958.8


def haversine_mi(a: Coord, b: Coord) -> float:
    lng1, lat1, lng2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(h))


class RouteLocator:
    """Maps a trip odometer reading to a point on the route polyline. Distances along
    each leg's polyline are rescaled to the router's leg distance, so mile markers
    match the engine exactly. Legs the engine skipped as "already there" contribute
    no miles, mirroring `engine.MIN_DRIVE_MI`."""

    def __init__(self, legs: tuple[RouteLeg, ...], min_drive_mi: float) -> None:
        self._points: list[Coord] = []
        self._miles: list[float] = []
        odometer = 0.0
        for leg in legs:
            coords = leg.coordinates or ((0.0, 0.0),)
            counts = leg.distance_mi >= min_drive_mi
            steps = [haversine_mi(a, b) for a, b in zip(coords, coords[1:], strict=False)]
            scale = leg.distance_mi / sum(steps) if counts and sum(steps) > 0 else 0.0
            along = odometer
            self._add(coords[0], along)
            for point, step in zip(coords[1:], steps, strict=True):
                along += step * scale
                self._add(point, along)
            odometer += leg.distance_mi if counts else 0.0

    def _add(self, point: Coord, mile: float) -> None:
        self._points.append(point)
        self._miles.append(mile)

    def point_at(self, mile: float) -> Coord:
        i = bisect_left(self._miles, mile)
        if i <= 0:
            return self._points[0]
        if i >= len(self._miles):
            return self._points[-1]
        m0, m1 = self._miles[i - 1], self._miles[i]
        f = (mile - m0) / (m1 - m0) if m1 > m0 else 0.0
        (x0, y0), (x1, y1) = self._points[i - 1], self._points[i]
        return (x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)


def simplify(coords: tuple[Coord, ...], max_points: int = 2500) -> list[list[float]]:
    """Thin a long polyline for the browser, keeping both ends. Rounded to ~1 m."""
    stride = max(1, math.ceil(len(coords) / max_points))
    kept = list(coords[::stride])
    if kept[-1] != coords[-1]:
        kept.append(coords[-1])
    return [[round(lng, 5), round(lat, 5)] for lng, lat in kept]
