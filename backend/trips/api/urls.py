from django.urls import path

from . import views

urlpatterns = [
    path("health", views.health, name="health"),
    path("geocode/autocomplete", views.autocomplete, name="autocomplete"),
    path("trips/plan", views.plan, name="plan"),
]
