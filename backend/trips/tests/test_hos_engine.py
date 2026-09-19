"""Golden scenarios from docs/HOS_RULES.md §5. Expected values were worked out by hand;
never edit them to make the engine pass. Fix the engine, or flag the rule."""

from trips.hos.engine import simulate
from trips.hos.models import DutyStatus, EventKind, HosLimits, Leg

D, ON, OFF, SB = DutyStatus.DRIVING, DutyStatus.ON_DUTY, DutyStatus.OFF_DUTY, DutyStatus.SLEEPER

MPH = 50


def leg(miles: float) -> Leg:
    return Leg(distance_mi=miles, duration_min=miles / MPH * 60)


def hm(day: int, clock: str) -> int:
    """Minutes since trip start, for a trip that starts Day 1 at 06:00."""
    h, m = map(int, clock.split(":"))
    return (day - 1) * 1440 + h * 60 + m - 6 * 60


def timeline(events):
    return [(e.status, e.start_min, e.end_min, e.kind) for e in events]


def test_g1_basic_two_day_trip():
    events = simulate(leg(0), leg(1000), cycle_used_min=0)

    assert timeline(events) == [
        (ON, hm(1, "06:00"), hm(1, "07:00"), EventKind.PICKUP),
        (D, hm(1, "07:00"), hm(1, "15:00"), EventKind.DRIVE),
        (OFF, hm(1, "15:00"), hm(1, "15:30"), EventKind.BREAK),
        (D, hm(1, "15:30"), hm(1, "18:30"), EventKind.DRIVE),
        (SB, hm(1, "18:30"), hm(2, "04:30"), EventKind.REST),
        (D, hm(2, "04:30"), hm(2, "12:30"), EventKind.DRIVE),
        (OFF, hm(2, "12:30"), hm(2, "13:00"), EventKind.BREAK),
        (D, hm(2, "13:00"), hm(2, "14:00"), EventKind.DRIVE),
        (ON, hm(2, "14:00"), hm(2, "15:00"), EventKind.DROPOFF),
    ]
    assert events[3].end_mi == 550
    assert events[-1].end_mi == 1000
    assert not any(e.kind == EventKind.FUEL for e in events)


def test_g2_fuel_stop_at_1000_miles():
    events = simulate(leg(0), leg(1200), cycle_used_min=0)

    assert timeline(events)[7:] == [
        (D, hm(2, "13:00"), hm(2, "14:00"), EventKind.DRIVE),
        (ON, hm(2, "14:00"), hm(2, "14:30"), EventKind.FUEL),
        (D, hm(2, "14:30"), hm(2, "16:30"), EventKind.DRIVE),
        (SB, hm(2, "16:30"), hm(3, "02:30"), EventKind.REST),
        (D, hm(3, "02:30"), hm(3, "04:30"), EventKind.DRIVE),
        (ON, hm(3, "04:30"), hm(3, "05:30"), EventKind.DROPOFF),
    ]
    fuel = next(e for e in events if e.kind == EventKind.FUEL)
    assert fuel.start_mi == 1000


def test_g3_cycle_exhaustion_forces_34_hour_restart():
    events = simulate(leg(0), leg(500), cycle_used_min=65 * 60)

    assert timeline(events) == [
        (ON, hm(1, "06:00"), hm(1, "07:00"), EventKind.PICKUP),
        (D, hm(1, "07:00"), hm(1, "11:00"), EventKind.DRIVE),
        (OFF, hm(1, "11:00"), hm(2, "21:00"), EventKind.RESTART),
        (D, hm(2, "21:00"), hm(3, "03:00"), EventKind.DRIVE),
        (ON, hm(3, "03:00"), hm(3, "04:00"), EventKind.DROPOFF),
    ]
    restart = events[2]
    assert restart.end_min - restart.start_min == 34 * 60


def test_g4_pickup_mid_shift_resets_break_clock():
    events = simulate(leg(300), leg(600), cycle_used_min=0)

    assert timeline(events)[:4] == [
        (D, hm(1, "06:00"), hm(1, "12:00"), EventKind.DRIVE),
        (ON, hm(1, "12:00"), hm(1, "13:00"), EventKind.PICKUP),
        (D, hm(1, "13:00"), hm(1, "18:00"), EventKind.DRIVE),
        (SB, hm(1, "18:00"), hm(2, "04:00"), EventKind.REST),
    ]
    assert events[2].end_mi == 550


def test_window_limit_stops_driving_but_not_on_duty_work():
    # With a 5-h window, the 1-h pickup plus 4 h of driving use the whole window.
    # The dropoff (on duty) may then run past the window edge; driving may not.
    short_window = HosLimits(window_min=5 * 60)
    events = simulate(leg(0), leg(250), cycle_used_min=0, limits=short_window)

    assert timeline(events) == [
        (ON, 0, 60, EventKind.PICKUP),
        (D, 60, 300, EventKind.DRIVE),  # window closes at 300
        (SB, 300, 900, EventKind.REST),
        (D, 900, 960, EventKind.DRIVE),
        (ON, 960, 1020, EventKind.DROPOFF),
    ]

    at_window_edge = simulate(leg(0), leg(200), cycle_used_min=0, limits=short_window)
    assert timeline(at_window_edge)[-1] == (ON, 300, 360, EventKind.DROPOFF)


def test_driver_already_at_pickup_skips_first_drive():
    events = simulate(leg(0), leg(50), cycle_used_min=0)

    assert [e.kind for e in events] == [EventKind.PICKUP, EventKind.DRIVE, EventKind.DROPOFF]


def test_cycle_already_exhausted_restarts_before_first_drive():
    events = simulate(leg(100), leg(100), cycle_used_min=70 * 60)

    assert events[0].kind == EventKind.RESTART
    assert events[0].start_min == 0
    assert events[1].kind == EventKind.DRIVE


def test_events_are_contiguous():
    events = simulate(leg(420), leg(2600), cycle_used_min=30 * 60)

    assert events[0].start_min == 0
    for prev, nxt in zip(events, events[1:], strict=False):
        assert prev.end_min == nxt.start_min
        assert prev.end_mi == nxt.start_mi


def test_negligible_leg_counts_as_already_there():
    events = simulate(Leg(distance_mi=0.02, duration_min=0.1), leg(50), cycle_used_min=0)

    assert events[0].kind == EventKind.PICKUP
    assert events[0].start_mi == 0
