"""Turn engine events into FMCSA daily log sheets. Spec: docs/HOS_RULES.md §4.

Each sheet covers one calendar day, midnight to midnight, in home-terminal time.
The day before the trip starts is padded Off Duty, as is the rest of the last day.
"""

import math
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from .models import DutyEvent, DutyStatus, EventKind, HosLimits

DAY_MIN = 24 * 60


@dataclass(frozen=True)
class GridSegment:
    status: DutyStatus
    start_min: int  # minutes after midnight
    end_min: int


@dataclass(frozen=True)
class Remark:
    """A change of duty status. `kind` is None for going off duty at the end of the trip."""

    time_min: int
    location: str
    kind: EventKind | None
    duration_min: int


@dataclass(frozen=True)
class DailyLog:
    day_number: int
    date: date
    segments: tuple[GridSegment, ...]
    totals_min: dict[DutyStatus, int]
    miles_driven: float
    from_location: str
    to_location: str
    remarks: tuple[Remark, ...]
    on_duty_today_min: int
    cycle_total_min: int  # recap A: on-duty hours in the cycle at the end of the day
    cycle_available_min: int  # recap B: hours available tomorrow


def _odometer_at(events: list[DutyEvent], t: int) -> float:
    for e in events:
        if e.start_min <= t < e.end_min:
            return e.start_mi + e.miles * (t - e.start_min) / e.duration_min
    return events[-1].end_mi if t >= events[-1].end_min else 0.0


def _cycle_at(events: list[DutyEvent], cycle_used_min: int, t: int) -> int:
    """On-duty minutes in the cycle at trip minute t. A restart only resets once complete."""
    cycle = cycle_used_min
    for e in events:
        if e.start_min >= t:
            break
        if e.kind == EventKind.RESTART:
            if e.end_min <= t:
                cycle = 0
        elif e.status.counts_toward_cycle:
            cycle += min(e.end_min, t) - e.start_min
    return cycle


def build_daily_logs(
    events: list[DutyEvent],
    start_at: datetime,
    cycle_used_min: int,
    label_at: Callable[[float], str],
    limits: HosLimits | None = None,
) -> list[DailyLog]:
    """`start_at` is the trip start as home-terminal wall-clock time. `label_at` maps a
    trip odometer reading to a place name ("City, ST") for remarks and from/to."""
    limits = limits or HosLimits()
    res = limits.resolution_min
    cycle_used_min = math.ceil(cycle_used_min / res) * res  # same rounding as the engine
    offset = start_at.hour * 60 + start_at.minute  # trip minute 0 on the day-1 clock
    trip_end = events[-1].end_min
    day_count = max(1, math.ceil((offset + trip_end) / DAY_MIN))

    # Whole-trip timeline on the day-1 clock, padded Off Duty on both ends.
    timeline = [(DutyStatus.OFF_DUTY, 0, offset, None)]
    timeline += [(e.status, offset + e.start_min, offset + e.end_min, e) for e in events]
    timeline.append((DutyStatus.OFF_DUTY, offset + trip_end, day_count * DAY_MIN, None))

    logs = []
    for day in range(day_count):
        day_start, day_end = day * DAY_MIN, (day + 1) * DAY_MIN
        segments: list[GridSegment] = []
        totals = dict.fromkeys(DutyStatus, 0)
        miles = 0.0

        for status, start, end, event in timeline:
            lo, hi = max(start, day_start), min(end, day_end)
            if lo >= hi:
                continue
            totals[status] += hi - lo
            if event is not None and status == DutyStatus.DRIVING:
                miles += event.miles * (hi - lo) / event.duration_min
            if segments and segments[-1].status == status:
                segments[-1] = GridSegment(status, segments[-1].start_min, hi - day_start)
            else:
                segments.append(GridSegment(status, lo - day_start, hi - day_start))

        remarks = []
        previous_status = None
        for e in events:
            at = offset + e.start_min
            if day_start <= at < day_end and e.status != previous_status:
                remarks.append(Remark(at - day_start, label_at(e.start_mi), e.kind, e.duration_min))
            previous_status = e.status
        if day_start < offset + trip_end <= day_end:
            remarks.append(
                Remark(offset + trip_end - day_start, label_at(events[-1].end_mi), None, 0)
            )

        trip_t_at_day_end = min(day_end - offset, trip_end)
        cycle_total = _cycle_at(events, cycle_used_min, trip_t_at_day_end)
        logs.append(
            DailyLog(
                day_number=day + 1,
                date=start_at.date() + timedelta(days=day),
                segments=tuple(segments),
                totals_min=totals,
                miles_driven=miles,
                from_location=label_at(_odometer_at(events, max(0, day_start - offset))),
                to_location=label_at(_odometer_at(events, trip_t_at_day_end)),
                remarks=tuple(remarks),
                on_duty_today_min=totals[DutyStatus.DRIVING] + totals[DutyStatus.ON_DUTY],
                cycle_total_min=cycle_total,
                cycle_available_min=max(0, limits.cycle_min - cycle_total),
            )
        )
    return logs
