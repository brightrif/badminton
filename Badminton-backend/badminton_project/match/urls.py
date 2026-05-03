# match/urls.py  — add these three lines to your existing router registrations

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.conf import settings
from django.conf.urls.static import static

from . import views
from .event_views import TournamentEventViewSet

router = DefaultRouter()

# ── Existing registrations (unchanged) ────────────────────────────────────────
router.register(r'countries',         views.CountryViewSet,         basename='country')
router.register(r'venues',            views.VenueViewSet,           basename='venue')
router.register(r'courts',            views.CourtViewSet,           basename='court')
router.register(r'tournaments',       views.TournamentViewSet,      basename='tournament')
router.register(r'players',           views.PlayerViewSet,          basename='player')
router.register(r'matches',           views.MatchViewSet,           basename='match')
router.register(r'sponsors',          views.SponsorViewSet,         basename='sponsor')
router.register(r'game-scores',       views.GameScoreViewSet,       basename='gamescore')
router.register(r'tournament-venues', views.TournamentVenueViewSet, basename='tournamentvenue')

# ── New: bracket system ───────────────────────────────────────────────────────
router.register(r'events',         TournamentEventViewSet, basename='event')


app_name = 'badminton'

urlpatterns = [
    path('api/', include(router.urls)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)