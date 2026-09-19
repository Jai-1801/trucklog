"""Value types for the HOS engine. Pure Python: no Django, no I/O."""

from dataclasses import dataclass
from enum import StrEnum


class DutyStatus(StrEnum):
    """The four rows of the FMCSA log grid, in grid order."""

    OFF_DUTY = "OFF"
    SLEEPER = "SB"
    DRIVING = "D"
    ON_DUTY = "ON"

    @property
    def counts_toward_cycle(self) -> bool:
        return self in (DutyStatus.DRIVING, DutyStatus.ON_DUTY)


class EventKind(StrEnum):
    DRIVE = "drive"
    PICKUP = "pickup"
    DROPOFF = "dropoff"
    FUEL = "fuel"
    BREAK = "break"
    REST = "rest"
    RESTART = "restart"


@dataclass(frozen=True)
class HosLimits:
    """Property-carrying, 70 hr / 8 day. Minutes throughout. Overridable in tests only."""

    driving_min: int = 11 * 60
    window_min: int = 14 * 60
    driving_before_break_min: int = 8 * 60
    cycle_min: int = 70 * 60
    break_min: int = 30
    rest_min: int = 10 * 60
    restart_min: int = 34 * 60
    fuel_interval_mi: float = 1000.0
    fuel_min: int = 30
    pickup_min: int = 60
    dropoff_min: int = 60
    # Paper logs are drawn to the quarter hour. Drive times round up and fuel stops come
    # earlier to fit, so every event lands on a grid tick and the plan stays conservative.
    resolution_min: int = 15


@dataclass(frozen=True)
class Leg:
    """One routed leg, as the router reports it."""

    distance_mi: float
    duration_min: float


@dataclass(frozen=True)
class DutyEvent:
    """A contiguous block of one duty status. Times are minutes since trip start.
    Odometer values are cumulative trip miles at the block's start and end."""

    status: DutyStatus
    kind: EventKind
    start_min: int
    end_min: int
    start_mi: float
    end_mi: float

    @property
    def duration_min(self) -> int:
        return self.end_min - self.start_min

    @property
    def miles(self) -> float:
        return self.end_mi - self.start_mi
