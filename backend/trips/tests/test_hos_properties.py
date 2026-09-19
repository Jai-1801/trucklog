"""G5: property tests. An independent auditor replays the engine's events and checks
every rule from scratch, the way an inspector would read a log. It shares no state
or helpers with the engine."""

from hypothesis import given, settings
from hypothesis import strategies as st

from trips.hos.engine import MIN_DRIVE_MI, simulate
from trips.hos.models import DutyEvent, DutyStatus, EventKind, Leg

H = 60
REST_RESET = 10 * H
RESTART_RESET = 34 * H


def audit(events: list[DutyEvent], cycle_used_min: int) -> None:
    driving_since_rest = 0
    driving_since_break = 0
    window_start: int | None = None
    cycle = cycle_used_min
    last_fuel_mi = 0.0

    assert events[0].start_min == 0
    for prev, nxt in zip(events, events[1:], strict=False):
        assert prev.end_min == nxt.start_min, "gap or overlap"
        assert abs(prev.end_mi - nxt.start_mi) < 1e-9, "odometer jump"

    for e in events:
        assert e.duration_min > 0, f"empty event {e}"
        if e.status == DutyStatus.DRIVING:
            assert e.miles > 0
            assert cycle + e.duration_min <= 70 * H, "drove past 70 h cycle"
            if window_start is None:
                window_start = e.start_min
            assert e.end_min - window_start <= 14 * H, "drove past the 14-h window"
            driving_since_rest += e.duration_min
            driving_since_break += e.duration_min
            assert driving_since_rest <= 11 * H, "more than 11 h driving"
            assert driving_since_break <= 8 * H, "8 h driving without a 30-min break"
            assert e.end_mi - last_fuel_mi <= 1000 + 1e-6, "over 1,000 mi without fuel"
            cycle += e.duration_min
            continue

        assert e.miles == 0, "moved while not driving"
        if e.status == DutyStatus.ON_DUTY:
            cycle += e.duration_min
            if window_start is None:
                window_start = e.start_min
        if e.duration_min >= 30:
            driving_since_break = 0
        if e.kind == EventKind.FUEL:
            last_fuel_mi = e.end_mi
        if e.status in (DutyStatus.OFF_DUTY, DutyStatus.SLEEPER) and e.duration_min >= REST_RESET:
            driving_since_rest = 0
            window_start = None
        if e.status == DutyStatus.OFF_DUTY and e.duration_min >= RESTART_RESET:
            cycle = 0


trip_inputs = st.tuples(
    st.floats(min_value=0, max_value=1500),  # current -> pickup miles
    st.floats(min_value=1, max_value=3000),  # pickup -> dropoff miles
    st.floats(min_value=35, max_value=65),  # router average mph
    st.integers(min_value=0, max_value=70 * H),  # cycle used
)


@settings(max_examples=600, deadline=None)
@given(trip_inputs)
def test_every_plan_is_legal(inputs):
    to_pickup_mi, to_dropoff_mi, mph, cycle = inputs
    to_pickup = Leg(to_pickup_mi, to_pickup_mi / mph * 60)
    to_dropoff = Leg(to_dropoff_mi, to_dropoff_mi / mph * 60)

    events = simulate(to_pickup, to_dropoff, cycle_used_min=cycle)

    audit(events, cycle)
    driven_legs = [mi for mi in (to_pickup_mi, to_dropoff_mi) if mi >= MIN_DRIVE_MI]
    assert abs(events[-1].end_mi - sum(driven_legs)) < 1e-6
    assert all(e.start_min % 15 == 0 and e.end_min % 15 == 0 for e in events), "off grid"
    kinds = [e.kind for e in events]
    assert kinds.count(EventKind.PICKUP) == 1
    assert kinds[-1] == EventKind.DROPOFF
    assert kinds.index(EventKind.PICKUP) < kinds.index(EventKind.DROPOFF)


@settings(max_examples=300, deadline=None)
@given(trip_inputs)
def test_rests_only_when_needed(inputs):
    """Legal isn't enough: the plan shouldn't waste time. Every rest must be forced
    by a limit the driver was actually up against."""
    to_pickup_mi, to_dropoff_mi, mph, cycle = inputs
    events = simulate(
        Leg(to_pickup_mi, to_pickup_mi / mph * 60),
        Leg(to_dropoff_mi, to_dropoff_mi / mph * 60),
        cycle_used_min=cycle,
    )

    for i, e in enumerate(events):
        if e.kind not in (EventKind.BREAK, EventKind.REST, EventKind.RESTART, EventKind.FUEL):
            continue
        # A stop is only ever inserted right before more driving.
        assert any(later.status == DutyStatus.DRIVING for later in events[i + 1 :]), (
            f"{e.kind} with no driving after it"
        )
