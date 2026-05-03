import hmac
import hashlib
import time
from django.conf import settings

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.utils import timezone

from .models import (
    Country, Tournament, Player, Sponsor, Match, GameScore, Venue,
    TournamentVenue, Court
)
from .serializers import (
    CountrySerializer, TournamentSerializer, PlayerSerializer,
    SponsorSerializer, MatchSerializer, MatchListSerializer,
    MatchCreateUpdateSerializer, GameScoreSerializer, VenueSerializer,
    VenueListSerializer, TournamentVenueSerializer, CourtSerializer
)

from .token_auth import make_token, verify_token
# ─── Token helpers ────────────────────────────────────────────────────────────
# We use a simple HMAC token so we need NO extra packages.
# Format:  <match_id>:<timestamp>:<hmac>
# The token is valid for TOKEN_TTL_SECONDS after issue.
# The umpire stores it in localStorage and sends it in the WS handshake.

TOKEN_TTL_SECONDS = 60 * 60 * 12   # 12 hours — covers a full match day


# def _make_token(match_id: int) -> str:
#     ts = int(time.time())
#     payload = f"{match_id}:{ts}"
#     secret = getattr(settings, 'SECRET_KEY', 'fallback-secret')
#     sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
#     return f"{payload}:{sig}"


def verify_umpire_token(match_id: int, token: str) -> bool:
    """
    Returns True if the token is valid for this match_id and not expired.
    Called by the WebSocket consumer before accepting score updates.
    """
    try:
        parts = token.split(':')
        if len(parts) != 3:
            return False
        mid, ts_str, sig = parts
        if int(mid) != match_id:
            return False
        ts = int(ts_str)
        if time.time() - ts > TOKEN_TTL_SECONDS:
            return False
        payload = f"{mid}:{ts_str}"
        secret = getattr(settings, 'SECRET_KEY', 'fallback-secret')
        expected_sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected_sig)
    except Exception:
        return False
# ─────────────────────────────────────────────────────────────────────────────


class CountryViewSet(viewsets.ModelViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'code']
    ordering = ['name']

    def get_queryset(self):
        return Country.objects.prefetch_related('players', 'venues')

    @action(detail=True, methods=['get'])
    def players(self, request, pk=None):
        country = self.get_object()
        serializer = PlayerSerializer(country.players.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def venues(self, request, pk=None):
        country = self.get_object()
        serializer = VenueListSerializer(country.venues.all(), many=True)
        return Response(serializer.data)


class VenueViewSet(viewsets.ModelViewSet):
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country', 'has_parking', 'has_cafeteria', 'has_livestream']
    search_fields = ['name', 'city', 'address']
    ordering_fields = ['name', 'city', 'total_courts', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return Venue.objects.select_related('country').prefetch_related('courts')

    def get_serializer_class(self):
        if self.action == 'list':
            return VenueListSerializer
        return VenueSerializer

    @action(detail=True, methods=['get'])
    def courts(self, request, pk=None):
        venue = self.get_object()
        serializer = CourtSerializer(venue.courts.filter(is_active=True), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        venue = self.get_object()
        serializer = MatchListSerializer(venue.matches.all(), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_city(self, request):
        city = request.query_params.get('city')
        if not city:
            return Response({'error': 'city parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        venues = self.get_queryset().filter(city__icontains=city)
        serializer = VenueListSerializer(venues, many=True)
        return Response(serializer.data)


class CourtViewSet(viewsets.ModelViewSet):
    queryset = Court.objects.all()
    serializer_class = CourtSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['venue', 'court_type', 'surface_type', 'is_active']
    search_fields = ['name']
    ordering_fields = ['name', 'court_type', 'created_at']
    ordering = ['venue', 'name']

    def get_queryset(self):
        return Court.objects.select_related('venue')

    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        court = self.get_object()
        serializer = MatchListSerializer(court.matches.all(), many=True)
        return Response(serializer.data)


class TournamentViewSet(viewsets.ModelViewSet):
    queryset = Tournament.objects.all()
    serializer_class = TournamentSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'start_date', 'end_date', 'created_at']
    ordering = ['-start_date']

    def get_queryset(self):
        return Tournament.objects.prefetch_related(
            'tournament_venues__venue', 'sponsors', 'matches'
        )

    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        tournament = self.get_object()
        qs = tournament.matches.all()
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = MatchListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def live_matches(self, request, pk=None):
        tournament = self.get_object()
        serializer = MatchListSerializer(tournament.matches.filter(status='Live'), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def venues(self, request, pk=None):
        tournament = self.get_object()
        serializer = TournamentVenueSerializer(tournament.tournament_venues.all(), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def current(self, request):
        today = timezone.now().date()
        qs = self.get_queryset().filter(start_date__lte=today, end_date__gte=today)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        today = timezone.now().date()
        qs = self.get_queryset().filter(start_date__gt=today)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return Player.objects.select_related('country')

    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        player = self.get_object()
        qs = Match.objects.filter(
            Q(player1_team1=player) | Q(player2_team1=player) |
            Q(player1_team2=player) | Q(player2_team2=player)
        ).select_related('tournament', 'venue', 'court')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = MatchListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        player = self.get_object()
        qs = Match.objects.filter(
            Q(player1_team1=player) | Q(player2_team1=player) |
            Q(player1_team2=player) | Q(player2_team2=player)
        )
        return Response({
            'total_matches': qs.count(),
            'completed_matches': qs.filter(status='Completed').count(),
            'live_matches': qs.filter(status='Live').count(),
            'upcoming_matches': qs.filter(status='Upcoming').count(),
            'singles_matches': qs.filter(match_type='SINGLE').count(),
            'doubles_matches': qs.filter(match_type='DOUBLES').count(),
            'mixed_doubles_matches': qs.filter(match_type='MIXED_DOUBLES').count(),
        })

    @action(detail=False, methods=['get'])
    def by_country(self, request):
        country_id = request.query_params.get('country_id')
        if not country_id:
            return Response({'error': 'country_id parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(self.get_queryset().filter(country_id=country_id), many=True)
        return Response(serializer.data)


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.all()
    serializer_class = MatchSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tournament', 'status', 'match_type', 'venue', 'court']
    search_fields = [
        'player1_team1__name', 'player1_team2__name',
        'player2_team1__name', 'player2_team2__name'
    ]
    ordering_fields = ['scheduled_time', 'created_at']
    ordering = ['-scheduled_time']

    def get_queryset(self):
        return Match.objects.select_related(
            'tournament', 'venue', 'court',
            'player1_team1__country', 'player2_team1__country',
            'player1_team2__country', 'player2_team2__country',
            'server__country'
        ).prefetch_related('game_scores')

    def get_serializer_class(self):
        if self.action == 'list':
            return MatchListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return MatchCreateUpdateSerializer
        return MatchSerializer

    # ── Existing endpoints (unchanged) ───────────────────────────────────────

    @action(detail=False, methods=['get'])
    def live(self, request):
        serializer = MatchSerializer(self.get_queryset().filter(status='Live'), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        serializer = MatchSerializer(self.get_queryset().filter(status='Upcoming'), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        today = timezone.now().date()
        serializer = MatchListSerializer(
            self.get_queryset().filter(scheduled_time__date=today), many=True
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_score(self, request, pk=None):
        """Legacy REST score update (kept for admin / testing use)."""
        match = self.get_object()
        game_scores_data = request.data.get('game_scores', [])
        if not game_scores_data:
            return Response({'error': 'game_scores data is required'}, status=status.HTTP_400_BAD_REQUEST)

        match.game_scores.all().delete()
        for score_data in game_scores_data:
            GameScore.objects.create(
                match=match,
                game_number=score_data.get('game_number'),
                team1_score=score_data.get('team1_score'),
                team2_score=score_data.get('team2_score')
            )
        if 'status' in request.data:
            match.status = request.data['status']
        if 'team1_sets' in request.data:
            match.team1_sets = request.data['team1_sets']
        if 'team2_sets' in request.data:
            match.team2_sets = request.data['team2_sets']
        if 'current_game' in request.data:
            match.current_game = request.data['current_game']
        match.save()
        return Response(MatchSerializer(match).data)

    @action(detail=True, methods=['post'])
    def start_match(self, request, pk=None):
        match = self.get_object()
        if match.status != 'Upcoming':
            return Response({'error': 'Only upcoming matches can be started'}, status=status.HTTP_400_BAD_REQUEST)
        Match.objects.filter(pk=match.pk).update(status='Live', current_game=1)
        match.refresh_from_db()
        return Response(MatchSerializer(match).data)

    @action(detail=True, methods=['post'])
    def finish_match(self, request, pk=None):
        match = self.get_object()
        if match.status != 'Live':
            return Response({'error': 'Only live matches can be finished'}, status=status.HTTP_400_BAD_REQUEST)
        Match.objects.filter(pk=match.pk).update(status='Completed')
        match.refresh_from_db()
        return Response(MatchSerializer(match).data)

    # ── NEW: PIN verification ─────────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='verify_pin',
            authentication_classes=[],
            permission_classes=[AllowAny])
    def verify_pin(self, request, pk=None):
        """
        POST /api/matches/<id>/verify_pin/
        Body: { "pin": "1234" }

        Returns a short-lived HMAC token the umpire stores in localStorage.
        The token is later sent as a query param when opening the WebSocket:
            ws://host/ws/match/<id>/?token=<token>
        """
        match = self.get_object()
        pin = str(request.data.get('pin', '')).strip()

        if not pin:
            return Response(
                {'error': 'PIN is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(match.umpire_pin, pin):
            return Response(
                {'error': 'Invalid PIN.'},
                status=status.HTTP_403_FORBIDDEN
            )

        token = make_token(match.id)
        return Response({
            'token': token,
            'match_id': match.id,
            'expires_in_seconds': TOKEN_TTL_SECONDS,
        })
    # ─────────────────────────────────────────────────────────────────────────


class SponsorViewSet(viewsets.ModelViewSet):
    queryset = Sponsor.objects.all()
    serializer_class = SponsorSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tournament']
    search_fields = ['name']
    ordering_fields = ['name', 'priority', 'created_at']
    ordering = ['priority', 'name']

    def get_queryset(self):
        return Sponsor.objects.select_related('tournament')


class GameScoreViewSet(viewsets.ModelViewSet):
    queryset = GameScore.objects.all()
    serializer_class = GameScoreSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['match', 'game_number']
    ordering_fields = ['game_number']
    ordering = ['game_number']

    def get_queryset(self):
        return GameScore.objects.select_related('match')


class TournamentVenueViewSet(viewsets.ModelViewSet):
    queryset = TournamentVenue.objects.all()
    serializer_class = TournamentVenueSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['tournament', 'venue']
    ordering_fields = ['start_date', 'end_date']
    ordering = ['start_date']

    def get_queryset(self):
        return TournamentVenue.objects.select_related('tournament', 'venue')