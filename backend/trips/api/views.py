from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response


@api_view(["GET"])
def health(request: Request) -> Response:
    return Response(
        {
            "ok": True,
            "version": settings.GIT_SHA,
            "routing_configured": bool(settings.ORS_API_KEY),
        }
    )
