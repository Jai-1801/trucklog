from datetime import datetime

from rest_framework import serializers

from trips.services.planner import PlaceInput, PlanRequest


class PlaceInputSerializer(serializers.Serializer):
    label = serializers.CharField(required=False, max_length=300)
    short = serializers.CharField(required=False, max_length=120)
    lat = serializers.FloatField(required=False, min_value=-90, max_value=90)
    lng = serializers.FloatField(required=False, min_value=-180, max_value=180)
    query = serializers.CharField(required=False, max_length=300)

    def validate(self, attrs: dict) -> dict:
        has_coords = "lat" in attrs and "lng" in attrs
        has_text = bool((attrs.get("query") or attrs.get("label") or "").strip())
        if not has_coords and not has_text:
            raise serializers.ValidationError("Enter a location.")
        return attrs


class PlanRequestSerializer(serializers.Serializer):
    current_location = PlaceInputSerializer()
    pickup_location = PlaceInputSerializer()
    dropoff_location = PlaceInputSerializer()
    current_cycle_used_hrs = serializers.FloatField(min_value=0, max_value=70)
    start_at = serializers.CharField(required=False, allow_blank=True)

    def validate_start_at(self, value: str) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.strptime(value[:16], "%Y-%m-%dT%H:%M")
        except ValueError as exc:
            raise serializers.ValidationError("Use the format YYYY-MM-DDTHH:MM.") from exc

    def to_plan_request(self) -> PlanRequest:
        data = self.validated_data
        return PlanRequest(
            current=PlaceInput(**data["current_location"]),
            pickup=PlaceInput(**data["pickup_location"]),
            dropoff=PlaceInput(**data["dropoff_location"]),
            cycle_used_hrs=data["current_cycle_used_hrs"],
            start_at=data.get("start_at"),
        )
