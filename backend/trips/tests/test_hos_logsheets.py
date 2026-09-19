"""Daily log sheets, checked against the day totals in docs/HOS_RULES.md §5."""

from datetime import date, datetime

from hypothesis import given, settings
from hypothesis import strategies as st

from trips.hos.engine import simulate
from trips.hos.logsheets import build_daily_logs
from trips.hos.models import DutyStatus, EventKind, Leg

D, ON, OFF, SB = DutyStatus.DRIVING, DutyStatus.ON_DUTY, DutyStatus.OFF_DUTY, DutyStatus.SLEEPER
START = datetime(2026, 9, 21, 6, 0)


def leg(miles: float) -> Leg:
    return Leg(distance_mi=miles, duration_min=miles / 50 * 60)


def label(mi: float) -> str:
    return f"mi {mi:.0f}"


def hours(log) -> dict:
    return {status: log.totals_min[status] / 60 for status in DutyStatus}


def plan(to_pickup: float, to_dropoff: float, cycle_h: float = 0, start: datetime = START):
    cycle = round(cycle_h * 60)
    events = simulate(leg(to_pickup), leg(to_dropoff), cycle_used_min=cycle)
    return build_daily_logs(events, start_at=start, cycle_used_min=cycle, label_at=label)


def test_g1_day_totals_miles_and_recap():
    day1, day2 = plan(0, 1000)

    assert day1.date == date(2026, 9, 21)
    assert day2.date == date(2026, 9, 22)
    assert hours(day1) == {OFF: 6.5, SB: 5.5, D: 11, ON: 1}
    assert hours(day2) == {OFF: 9.5, SB: 4.5, D: 9, ON: 1}
    assert day1.miles_driven == 550
    assert day2.miles_driven == 450
    assert (day1.on_duty_today_min, day1.cycle_total_min, day1.cycle_available_min) == (
        12 * 60,
        12 * 60,
        58 * 60,
    )
    assert (day2.on_duty_today_min, day2.cycle_total_min, day2.cycle_available_min) == (
        10 * 60,
        22 * 60,
        48 * 60,
    )


def test_g1_grid_segments_cover_the_day_and_merge_nothing_across_changes():
    day1, day2 = plan(0, 1000)

    assert [(s.status, s.start_min, s.end_min) for s in day1.segments] == [
        (OFF, 0, 360),
        (ON, 360, 420),
        (D, 420, 900),
        (OFF, 900, 930),
        (D, 930, 1110),
        (SB, 1110, 1440),
    ]
    assert [(s.status, s.start_min, s.end_min) for s in day2.segments] == [
        (SB, 0, 270),
        (D, 270, 750),
        (OFF, 750, 780),
        (D, 780, 840),
        (ON, 840, 900),
        (OFF, 900, 1440),
    ]


def test_g1_remarks_mark_every_duty_change_with_location():
    day1, day2 = plan(0, 1000)

    assert [(r.time_min, r.kind, r.location) for r in day1.remarks] == [
        (360, EventKind.PICKUP, "mi 0"),
        (420, EventKind.DRIVE, "mi 0"),
        (900, EventKind.BREAK, "mi 400"),
        (930, EventKind.DRIVE, "mi 400"),
        (1110, EventKind.REST, "mi 550"),
    ]
    assert [(r.time_min, r.kind) for r in day2.remarks] == [
        (270, EventKind.DRIVE),
        (750, EventKind.BREAK),
        (780, EventKind.DRIVE),
        (840, EventKind.DROPOFF),
        (900, None),  # off duty: trip complete
    ]
    assert (day1.from_location, day1.to_location) == ("mi 0", "mi 550")
    assert (day2.from_location, day2.to_location) == ("mi 550", "mi 1000")


def test_g2_fuel_day_totals():
    _, day2, day3 = plan(0, 1200)

    assert hours(day2) == {OFF: 0.5, SB: 12, D: 11, ON: 0.5}
    assert hours(day3) == {OFF: 18.5, SB: 2.5, D: 2, ON: 1}


def test_g3_restart_spans_days_and_resets_recap_only_once_complete():
    day1, day2, day3 = plan(0, 500, cycle_h=65)

    assert hours(day1) == {OFF: 6 + 13, SB: 0, D: 4, ON: 1}
    assert hours(day2) == {OFF: 21, SB: 0, D: 3, ON: 0}
    # Restart still running at the end of day 1: the old hours still count.
    assert day1.cycle_total_min == 70 * 60
    assert day1.cycle_available_min == 0
    # Restart completed at 21:00 on day 2, then 3 h of driving.
    assert day2.cycle_total_min == 3 * 60
    assert day3.cycle_total_min == 3 * 60 + 3 * 60 + 60


def test_trip_ending_exactly_at_midnight_adds_no_empty_day():
    # 16:00 start: pickup 16-17, 6 h drive 17-23, dropoff 23-24. Ends on the midnight line.
    logs = plan(0, 300, start=datetime(2026, 9, 21, 16, 0))
    assert len(logs) == 1
    assert logs[0].segments[-1].end_min == 1440

    # One hour later the dropoff runs 00:00-01:00 on day 2.
    logs = plan(0, 300, start=datetime(2026, 9, 21, 17, 0))
    assert len(logs) == 2
    assert [(s.status, s.start_min, s.end_min) for s in logs[1].segments] == [
        (ON, 0, 60),
        (OFF, 60, 1440),
    ]


@settings(max_examples=300, deadline=None)
@given(
    st.floats(min_value=0, max_value=1500),
    st.floats(min_value=1, max_value=3000),
    st.integers(min_value=0, max_value=70 * 60),
    st.integers(min_value=0, max_value=1439),
)
def test_every_sheet_is_a_complete_24_hour_day(to_pickup, to_dropoff, cycle, start_minute):
    start = datetime(2026, 3, 1, start_minute // 60, start_minute % 60)
    events = simulate(leg(to_pickup), leg(to_dropoff), cycle_used_min=cycle)
    logs = build_daily_logs(events, start_at=start, cycle_used_min=cycle, label_at=label)

    total_driven = 0.0
    for i, log in enumerate(logs):
        assert log.day_number == i + 1
        assert sum(log.totals_min.values()) == 1440
        assert log.segments[0].start_min == 0
        assert log.segments[-1].end_min == 1440
        for a, b in zip(log.segments, log.segments[1:], strict=False):
            assert a.end_min == b.start_min
            assert a.status != b.status, "adjacent segments should be merged"
        assert log.on_duty_today_min == log.totals_min[D] + log.totals_min[ON]
        assert log.cycle_available_min == max(0, 70 * 60 - log.cycle_total_min)
        total_driven += log.miles_driven
    assert abs(total_driven - events[-1].end_mi) < 1e-6


def test_recap_uses_the_same_cycle_rounding_as_the_engine():
    (day,) = plan(0, 50, cycle_h=12.1)  # 12 h 06 m rounds up to 12 h 15 m

    assert day.cycle_total_min == 12 * 60 + 15 + day.on_duty_today_min
