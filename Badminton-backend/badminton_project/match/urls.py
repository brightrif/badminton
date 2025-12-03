# badminton_app/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.documentation import include_docs_urls
from . import views

from django.conf import settings
from django.conf.urls.static import static

# Create a router and register our viewsets
router = DefaultRouter()

# Register all viewsets with the router
router.register(r'countries', views.CountryViewSet, basename='country')
router.register(r'venues', views.VenueViewSet, basename='venue')
router.register(r'courts', views.CourtViewSet, basename='court')
router.register(r'tournaments', views.TournamentViewSet, basename='tournament')
router.register(r'players', views.PlayerViewSet, basename='player')
router.register(r'matches', views.MatchViewSet, basename='match')
router.register(r'sponsors', views.SponsorViewSet, basename='sponsor')
router.register(r'game-scores', views.GameScoreViewSet, basename='gamescore')
router.register(r'tournament-venues', views.TournamentVenueViewSet, basename='tournamentvenue')

# App name for namespacing
app_name = 'badminton'

urlpatterns = [
    # API endpoints
    path('api/', include(router.urls)),
    
    # API documentation (optional - requires djangorestframework)
    #path('api/docs/', include_docs_urls(title='Badminton API Documentation')),
    
    # Custom API endpoints (if you want to add any non-viewset endpoints)
    # Example: path('api/custom-endpoint/', views.custom_view, name='custom-endpoint'),
    
    # Dashboard/Admin style URLs (if you plan to add web views later)
    # path('', views.dashboard, name='dashboard'),
    # path('tournaments/<int:tournament_id>/', views.tournament_detail, name='tournament-detail'),
    # path('matches/live/', views.live_matches, name='live-matches'),
]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# THIS LINE IS CRITICAL
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
# If you want to include the DRF browsable API authentication
# Uncomment the following lines:
# from rest_framework.authtoken.views import obtain_auth_token
# urlpatterns += [
#     path('api-auth/', include('rest_framework.urls')),
#     path('api-token-auth/', obtain_auth_token, name='api_token_auth'),
# ]