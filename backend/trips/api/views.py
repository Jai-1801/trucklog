import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import exception_handler

from trips.services import geocoding
from trips.services.errors import ProviderError
from trips.services.planner import plan_trip

from .serializers import PlanRequestSerializer

log = logging.getLogger(__name__)


def error_response(code: str, message: str, http_status: int, fields=None) -> Response:
    body = {"error": {"code": code, "message": message}}
    if fields:
        body["error"]["fields"] = fields
    return Response(body, status=http_status)


def api_exception_handler(exc, context):
    """One error shape for every failure: {"error": {"code", "message", "fields"?}}."""
    if isinstance(exc, ProviderError):
        return error_response(exc.code, exc.message, exc.status)
    if isinstance(exc, ValidationError):
        return error_response(
            "VALIDATION_ERROR", "Please check the highlighted fields.", 400, exc.detail
        )
    response = exception_handler(exc, context)
    if response is None:
        log.exception("Unhandled error in %s", context.get("view"))
        return error_response(
            "INTERNAL_ERROR", "Something went wrong on our side. Please retry.", 500
        )
    detail = response.data.get("detail", "Request failed.")
    response.data = {"error": {"code": "REQUEST_ERROR", "message": str(detail)}}
    return response


@api_view(["GET"])
def health(request: Request) -> Response:
    return Response(
        {
            "ok": True,
            "version": settings.GIT_SHA,
            "routing_configured": bool(settings.ORS_API_KEY),
        }
    )


@api_view(["GET"])
def autocomplete(request: Request) -> Response:
    text = request.query_params.get("q", "").strip()
    if len(text) < 2:
        return Response([])
    places = geocoding.autocomplete(text[:100])
    return Response(
        [{"label": p.label, "short": p.short, "lat": p.lat, "lng": p.lng} for p in places]
    )


@api_view(["POST"])
def plan(request: Request) -> Response:
    serializer = PlanRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(plan_trip(serializer.to_plan_request()), status=status.HTTP_200_OK)
