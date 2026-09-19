"""Place search and reverse geocoding. OpenRouteService (Pelias) first, then the
public Photon / Nominatim instances as fallbacks. Results are cached in-process to
spare free-tier quotas."""

import logging
from dataclasses import dataclass
from functools import lru_cache

from .errors import ProviderError
from .http import ORS_BASE, get_json, ors_key

log = logging.getLogger(__name__)

PHOTON_URL = "https://photon.komoot.io/api/"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"


@dataclass(frozen=True)
class Place:
    label: str  # full label for the input box, e.g. "Chicago, IL, USA"
    short: str  # FMCSA remark form, e.g. "Chicago, IL"
    lat: float
    lng: float


def _short(city: str | None, state: str | None, fallback: str) -> str:
    if city and state:
        return f"{city}, {state}"
    return city or fallback


def _from_pelias(feature: dict) -> Place:
    p = feature["properties"]
    lng, lat = feature["geometry"]["coordinates"]
    city = p.get("locality") or p.get("localadmin") or p.get("county") or p.get("name")
    return Place(p.get("label") or p["name"], _short(city, p.get("region_a"), p["name"]), lat, lng)


@lru_cache(maxsize=512)
def autocomplete(text: str) -> tuple[Place, ...]:
    try:
        body = get_json(
            f"{ORS_BASE}/geocode/autocomplete",
            params={"api_key": ors_key(), "text": text, "boundary.country": "US", "size": 6},
        )
        return tuple(_from_pelias(f) for f in body.get("features", []))
    except ProviderError as exc:
        log.warning("ORS autocomplete failed, using Photon: %s", exc)
    body = get_json(PHOTON_URL, params={"q": text, "limit": 6, "lang": "en"})
    places = []
    for f in body.get("features", []):
        p = f["properties"]
        if p.get("countrycode") != "US":
            continue
        lng, lat = f["geometry"]["coordinates"]
        city = p.get("city") or p.get("name")
        state = STATE_ABBR.get(p.get("state", ""), p.get("state"))
        label = ", ".join(x for x in (p.get("name"), p.get("city"), p.get("state")) if x)
        places.append(Place(label, _short(city, state, p.get("name", "")), lat, lng))
    return tuple(places)


@lru_cache(maxsize=256)
def geocode(text: str) -> Place:
    """Best match for free text the user typed without picking a suggestion."""
    try:
        body = get_json(
            f"{ORS_BASE}/geocode/search",
            params={"api_key": ors_key(), "text": text, "boundary.country": "US", "size": 1},
        )
        if body.get("features"):
            return _from_pelias(body["features"][0])
    except ProviderError as exc:
        log.warning("ORS search failed, using Nominatim: %s", exc)
        results = get_json(
            f"{NOMINATIM_URL}/search",
            params={
                "q": text,
                "format": "jsonv2",
                "countrycodes": "us",
                "limit": 1,
                "addressdetails": 1,
            },
        )
        if results:
            return _from_nominatim(results[0])
    raise ProviderError("LOCATION_NOT_FOUND", f'We couldn\'t find "{text}". Try a city and state.')


@lru_cache(maxsize=2048)
def _reverse_cached(lat: float, lng: float) -> str:
    try:
        body = get_json(
            f"{ORS_BASE}/geocode/reverse",
            params={"api_key": ors_key(), "point.lat": lat, "point.lon": lng, "size": 1},
        )
        if body.get("features"):
            return _from_pelias(body["features"][0]).short
    except ProviderError as exc:
        log.warning("ORS reverse failed, using Nominatim: %s", exc)
        result = get_json(
            f"{NOMINATIM_URL}/reverse",
            params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 10, "addressdetails": 1},
        )
        if result and "address" in result:
            return _from_nominatim(result).short
    return f"{lat:.3f}, {lng:.3f}"


def reverse(lat: float, lng: float) -> str:
    """Nearest "City, ST" for a remark. Rounded to ~1 km so nearby stops share a lookup."""
    return _reverse_cached(round(lat, 2), round(lng, 2))


def _from_nominatim(result: dict) -> Place:
    a = result.get("address", {})
    city = a.get("city") or a.get("town") or a.get("village") or a.get("hamlet") or a.get("county")
    iso = a.get("ISO3166-2-lvl4", "")
    state = iso.split("-")[1] if iso.startswith("US-") else a.get("state")
    return Place(
        result.get("display_name", city or ""),
        _short(city, state, result.get("name", "")),
        float(result["lat"]),
        float(result["lon"]),
    )


STATE_ABBR = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
    "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}  # fmt: skip
