"""Shared HTTP client for the free map providers: one session, short timeouts,
provider failures turned into ProviderError."""

from typing import Any

import requests
from django.conf import settings

from .errors import ProviderError

TIMEOUT_S = 10
USER_AGENT = "TruckLog/1.0 (+https://github.com/Jai-1801/trucklog)"
ORS_BASE = "https://api.openrouteservice.org"

_session = requests.Session()
_session.headers["User-Agent"] = USER_AGENT


def get_json(url: str, **kwargs: Any) -> Any:
    return _request("GET", url, **kwargs)


def post_json(url: str, **kwargs: Any) -> Any:
    return _request("POST", url, **kwargs)


def ors_key() -> str:
    if not settings.ORS_API_KEY:
        raise ProviderError("PROVIDER_UNAVAILABLE", "Routing is not configured on the server.", 503)
    return settings.ORS_API_KEY


def _request(method: str, url: str, **kwargs: Any) -> Any:
    try:
        response = _session.request(method, url, timeout=TIMEOUT_S, **kwargs)
    except requests.Timeout as exc:
        raise ProviderError(
            "PROVIDER_TIMEOUT", "The map service took too long to answer. Please retry.", 504
        ) from exc
    except requests.RequestException as exc:
        raise ProviderError(
            "PROVIDER_UNAVAILABLE", "The map service is unreachable. Please retry.", 502
        ) from exc

    try:
        body = response.json()
    except ValueError:
        body = None
    if response.status_code >= 400:
        raise UpstreamError(response.status_code, body)
    return body


class UpstreamError(ProviderError):
    """Non-2xx from a provider. Callers inspect `body` to map known cases."""

    def __init__(self, http_status: int, body: Any) -> None:
        super().__init__(
            "PROVIDER_UNAVAILABLE", "The map service returned an error. Please retry.", 502
        )
        self.http_status = http_status
        self.body = body
