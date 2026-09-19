"""Hours-of-Service trip simulation. Spec: docs/HOS_RULES.md §2–3.

The driver starts fresh (10+ h off) at minute 0 and works through two legs:
current -> pickup (then 1 h pickup), pickup -> dropoff (then 1 h dropoff).
Before every drive chunk, the engine takes whichever rest the rules demand, then
drives until the nearest limit, leg end, or fuel point. Time is whole minutes on a
15-minute grid (HosLimits.resolution_min), like a paper log.
Distance within a leg is linear in driving time, so odometer values are exact
at leg ends.
"""

import math
from dataclasses import dataclass, field

from .models import DutyEvent, DutyStatus, EventKind, HosLimits, Leg

_EPS = 1e-6
# Shorter legs (about 80 m) mean the driver is already there, e.g. parked at the pickup.
MIN_DRIVE_MI = 0.05


@dataclass
class _Clock:
    limits: HosLimits
    cycle_min: int
    t: int = 0
    odometer: float = 0.0
    driving_since_rest: int = 0
    driving_since_break: int = 0
    window_start: int | None = None
    last_fuel_mi: float = 0.0
    events: list[DutyEvent] = field(default_factory=list)

    def add(self, status: DutyStatus, kind: EventKind, minutes: int, miles: float = 0.0) -> None:
        start_mi = self.odometer
        self.odometer += miles
        self.events.append(
            DutyEvent(status, kind, self.t, self.t + minutes, start_mi, self.odometer)
        )
        self.t += minutes

        if status.counts_toward_cycle:
            self.cycle_min += minutes
            if self.window_start is None:
                self.window_start = self.events[-1].start_min
        if status == DutyStatus.DRIVING:
            self.driving_since_rest += minutes
            self.driving_since_break += minutes
        elif minutes >= self.limits.break_min:
            self.driving_since_break = 0

    def on_duty_task(self, kind: EventKind, minutes: int) -> None:
        self.add(DutyStatus.ON_DUTY, kind, minutes)
        if kind == EventKind.FUEL:
            self.last_fuel_mi = self.odometer

    def rest(self) -> None:
        self.add(DutyStatus.SLEEPER, EventKind.REST, self.limits.rest_min)
        self.driving_since_rest = 0
        self.window_start = None

    def restart(self) -> None:
        self.add(DutyStatus.OFF_DUTY, EventKind.RESTART, self.limits.restart_min)
        self.driving_since_rest = 0
        self.window_start = None
        self.cycle_min = 0

    def window_left(self) -> int:
        if self.window_start is None:
            return self.limits.window_min
        return self.limits.window_min - (self.t - self.window_start)


def _drive_leg(clock: _Clock, leg: Leg) -> None:
    lim = clock.limits
    if leg.distance_mi < MIN_DRIVE_MI:
        return
    res = lim.resolution_min
    leg_minutes = max(res, math.ceil(leg.duration_min / res - _EPS) * res)
    mi_per_min = leg.distance_mi / leg_minutes
    leg_start_mi = clock.odometer
    driven = 0

    while driven < leg_minutes:
        fuel_miles_left = lim.fuel_interval_mi - (clock.odometer - clock.last_fuel_mi)
        fuel_minutes_left = max(
            0, math.floor(min(fuel_miles_left / mi_per_min, leg_minutes) / res + _EPS) * res
        )

        if clock.cycle_min >= lim.cycle_min:
            clock.restart()
        elif clock.driving_since_rest >= lim.driving_min or clock.window_left() <= 0:
            clock.rest()
        elif fuel_minutes_left == 0:
            clock.on_duty_task(EventKind.FUEL, lim.fuel_min)
        elif clock.driving_since_break >= lim.driving_before_break_min:
            clock.add(DutyStatus.OFF_DUTY, EventKind.BREAK, lim.break_min)
        else:
            chunk = min(
                leg_minutes - driven,
                lim.driving_min - clock.driving_since_rest,
                clock.window_left(),
                lim.driving_before_break_min - clock.driving_since_break,
                lim.cycle_min - clock.cycle_min,
                fuel_minutes_left,
            )
            driven += chunk
            # Anchor to the leg start so the leg ends on its exact routed distance.
            target_mi = leg_start_mi + leg.distance_mi * driven / leg_minutes
            clock.add(DutyStatus.DRIVING, EventKind.DRIVE, chunk, target_mi - clock.odometer)


def simulate(
    to_pickup: Leg,
    to_dropoff: Leg,
    cycle_used_min: int,
    limits: HosLimits | None = None,
) -> list[DutyEvent]:
    """Plan the trip. Returns contiguous duty events starting at minute 0."""
    limits = limits or HosLimits()
    res = limits.resolution_min
    cycle_min = math.ceil(cycle_used_min / res) * res  # round up: never under-count
    clock = _Clock(limits=limits, cycle_min=cycle_min)

    _drive_leg(clock, to_pickup)
    clock.on_duty_task(EventKind.PICKUP, clock.limits.pickup_min)
    _drive_leg(clock, to_dropoff)
    clock.on_duty_task(EventKind.DROPOFF, clock.limits.dropoff_min)

    return clock.events
