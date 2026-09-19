"""API tests with every map provider mocked: no network, no quota."""

import re

import pytest
import responses
from django.test import Client

from trips.services import geocoding, routing
from trips.services.geometry import RouteLocator
from trips.services.http import ORS_BASE
from trips.services.routing import OSRM_URL, RouteLeg

M_PER_MI = 1609.344
CHICAGO = {"label": "Chicago, IL, USA", "short": "Chicago, IL", "lat": 41.88, "lng": -87.63}
ST_LOUIS = {"label": "St. Louis, MO, USA", "short": "St. Louis, MO", "lat": 38.63, "lng": -90.2}
DALLAS = {"label": "Dallas, TX, USA", "short": "Dallas, TX", "lat": 32.78, "lng": -96.8}

ORS_ROUTE_URL = f"{ORS_BASE}/v2/directions/driving-hgv/geojson"


def body(**overrides):
    return {
        "current_location": CHICAGO,
        "pickup_location": ST_LOUIS,
        "dropoff_location": DALLAS,
        "current_cycle_used_hrs": 0,
        "start_at": "2026-09-21T06:00",
        **overrides,
    }


def ors_route(leg_miles=(300, 600), mph=50):
    coords = [
        [-87.63, 41.88],
        [-89.0, 40.2],
        [-90.2, 38.63],
        [-94.0, 35.5],
        [-96.8, 32.78],
    ]
    return {
        "features": [
            {
                "geometry": {"type": "LineString", "coordinates": coords},
                "properties": {
                    "way_points": [0, 2, 4],
                    "segments": [
                        {"distance": mi * M_PER_MI, "duration": mi / mph * 3600} for mi in leg_miles
                    ],
                },
            }
        ]
    }


def pelias(city, state, lng, lat):
    return {
        "features": [
            {
                "geometry": {"coordinates": [lng, lat]},
                "properties": {
                    "label": f"{city}, {state}, USA",
                    "name": city,
                    "locality": city,
                    "region_a": state,
                },
            }
        ]
    }


@pytest.fixture(autouse=True)
def fresh_caches(settings):
    settings.ORS_API_KEY = "test-key"
    for fn in (routing.route, geocoding.autocomplete, geocoding.geocode, geocoding._reverse_cached):
        fn.cache_clear()


def post(payload):
    return Client().post("/api/trips/plan", payload, content_type="application/json")


@responses.activate
def test_plan_happy_path_returns_the_full_contract():
    responses.post(ORS_ROUTE_URL, json=ors_route())
    responses.get(f"{ORS_BASE}/geocode/reverse", json=pelias("Springfield", "MO", -93.3, 37.2))

    response = post(body())

    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total_miles"] == 900
    assert data["summary"]["days"] == 2
    assert data["summary"]["timezone"] == "America/Chicago"
    assert data["summary"]["start_at"] == "2026-09-21T06:00:00-05:00"
    assert [s["type"] for s in data["stops"]] == ["start", "pickup", "rest", "dropoff"]
    assert [s["label"] for s in data["stops"]] == [
        "Chicago, IL",
        "St. Louis, MO",
        "Springfield, MO",
        "Dallas, TX",
    ]
    assert data["stops"][1]["arrive_at"] == "2026-09-21T12:00:00-05:00"
    for day in data["days"]:
        assert sum(day["totals"].values()) == 24
        assert day["segments"][0]["start_min"] == 0
        assert day["segments"][-1]["end_min"] == 1440
    assert data["days"][0]["recap"] == {
        "on_duty_today": 12.0,
        "a_cycle_total": 12.0,
        "b_available_tomorrow": 58.0,
        "c_last_5_days": None,
    }
    assert data["route"]["geometry"]["coordinates"][0] == [-87.63, 41.88]
    assert data["warnings"] == []


@responses.activate
def test_plan_geocodes_free_text_locations():
    responses.get(
        f"{ORS_BASE}/geocode/search",
        json=pelias("Chicago", "IL", -87.63, 41.88),
    )
    responses.post(ORS_ROUTE_URL, json=ors_route())
    responses.get(f"{ORS_BASE}/geocode/reverse", json=pelias("Springfield", "MO", -93.3, 37.2))

    response = post(body(current_location={"query": "chicago"}))

    assert response.status_code == 200
    assert response.json()["places"]["current"]["short"] == "Chicago, IL"


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"current_cycle_used_hrs": 70.5}, "current_cycle_used_hrs"),
        ({"current_cycle_used_hrs": -1}, "current_cycle_used_hrs"),
        ({"pickup_location": {}}, "pickup_location"),
        ({"dropoff_location": {"lat": 95, "lng": 0}}, "dropoff_location"),
        ({"start_at": "tomorrow"}, "start_at"),
    ],
)
def test_plan_rejects_invalid_input_with_field_errors(override, field):
    response = post(body(**override))

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert field in error["fields"]


@responses.activate
def test_unknown_location_is_a_friendly_422():
    responses.get(f"{ORS_BASE}/geocode/search", json={"features": []})

    response = post(body(dropoff_location={"query": "asdfghjkl"}))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "LOCATION_NOT_FOUND"
    assert "asdfghjkl" in response.json()["error"]["message"]


@responses.activate
def test_unroutable_trip_is_a_friendly_422():
    responses.post(ORS_ROUTE_URL, status=404, json={"error": {"code": 2009, "message": "x"}})

    response = post(body(dropoff_location={"label": "London", "lat": 51.5, "lng": -0.12}))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ROUTE_NOT_FOUND"


@responses.activate
def test_ors_outage_falls_back_to_osrm_and_says_so():
    responses.post(ORS_ROUTE_URL, status=503, json={"error": "unavailable"})
    osrm = re.compile(rf"{re.escape(OSRM_URL)}/.*")
    for miles in (300, 600):  # one OSRM call per leg, answered in order
        responses.get(
            osrm,
            json={
                "code": "Ok",
                "routes": [
                    {
                        "distance": miles * M_PER_MI,
                        "duration": miles / 50 * 3600,
                        "geometry": {"coordinates": [[-87.6, 41.9], [-90.2, 38.6]]},
                    }
                ],
            },
        )
    responses.get(f"{ORS_BASE}/geocode/reverse", json=pelias("Springfield", "MO", -93.3, 37.2))

    response = post(body())

    assert response.status_code == 200
    assert response.json()["route"]["provider"] == "osrm"
    assert "car routing" in response.json()["warnings"][0]


def test_trip_over_the_limit_is_refused():
    with responses.RequestsMock() as mock:
        mock.post(ORS_ROUTE_URL, json=ors_route(leg_miles=(2500, 2600)))
        response = post(body())

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "TRIP_TOO_LONG"


@responses.activate
def test_autocomplete_proxies_suggestions_and_ignores_short_queries():
    responses.get(f"{ORS_BASE}/geocode/autocomplete", json=pelias("Chicago", "IL", -87.63, 41.88))

    assert Client().get("/api/geocode/autocomplete?q=c").json() == []
    suggestions = Client().get("/api/geocode/autocomplete?q=chica").json()
    assert suggestions == [
        {"label": "Chicago, IL, USA", "short": "Chicago, IL", "lat": 41.88, "lng": -87.63}
    ]


def test_locator_places_mile_markers_on_the_polyline():
    legs = (
        RouteLeg(10, 12, ((0.0, 0.0), (0.0, 1.0))),  # polyline ~69 mi, routed 10 mi
        RouteLeg(20, 24, ((0.0, 1.0), (0.0, 2.0))),
    )
    locator = RouteLocator(legs, min_drive_mi=0.05)

    assert locator.point_at(0) == (0.0, 0.0)
    assert locator.point_at(5) == pytest.approx((0.0, 0.5))
    assert locator.point_at(10) == pytest.approx((0.0, 1.0))
    assert locator.point_at(20) == pytest.approx((0.0, 1.5))
    assert locator.point_at(999) == (0.0, 2.0)
