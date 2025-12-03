# badminton_app/views.py

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count, Prefetch
from django.utils import timezone
from datetime import datetime, timedelta

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


class CountryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing countries
    """
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
        """Get all players from a specific country"""
        country = self.get_object()
        players = country.players.all()
        serializer = PlayerSerializer(players, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def venues(self, request, pk=None):
        """Get all venues from a specific country"""
        country = self.get_object()
        venues = country.venues.all()
        serializer = VenueListSerializer(venues, many=True)
        return Response(serializer.data)


class VenueViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing venues
    """
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
        """Get all courts for a specific venue"""
        venue = self.get_object()
        courts = venue.courts.filter(is_active=True)
        serializer = CourtSerializer(courts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        """Get all matches for a specific venue"""
        venue = self.get_object()
        matches = venue.matches.all()
        serializer = MatchListSerializer(matches, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_city(self, request):
        """Get venues grouped by city"""
        city = request.query_params.get('city')
        if not city:
            return Response({'error': 'city parameter is required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        venues = self.get_queryset().filter(city__icontains=city)
        serializer = VenueListSerializer(venues, many=True)
        return Response(serializer.data)


class CourtViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing courts
    """
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
        """Get all matches for a specific court"""
        court = self.get_object()
        matches = court.matches.all()
        serializer = MatchListSerializer(matches, many=True)
        return Response(serializer.data)


class TournamentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tournaments
    """
    queryset = Tournament.objects.all()
    serializer_class = TournamentSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'start_date', 'end_date', 'created_at']
    ordering = ['-start_date']

    def get_queryset(self):
        return Tournament.objects.prefetch_related(
            'tournament_venues__venue',
            'sponsors',
            'matches'
        )

    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        """Get all matches for a specific tournament"""
        tournament = self.get_object()
        matches = tournament.matches.all()
        
        # Optional filtering by status
        status_filter = request.query_params.get('status')
        if status_filter:
            matches = matches.filter(status=status_filter)
            
        serializer = MatchListSerializer(matches, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def live_matches(self, request, pk=None):
        """Get all live matches for a specific tournament"""
        tournament = self.get_object()
        live_matches = tournament.matches.filter(status='Live')
        serializer = MatchListSerializer(live_matches, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def venues(self, request, pk=None):
        """Get all venues for a specific tournament"""
        tournament = self.get_object()
        tournament_venues = tournament.tournament_venues.all()
        serializer = TournamentVenueSerializer(tournament_venues, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get currently running tournaments"""
        today = timezone.now().date()
        current_tournaments = self.get_queryset().filter(
            start_date__lte=today,
            end_date__gte=today
        )
        serializer = self.get_serializer(current_tournaments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming tournaments"""
        today = timezone.now().date()
        upcoming_tournaments = self.get_queryset().filter(start_date__gt=today)
        serializer = self.get_serializer(upcoming_tournaments, many=True)
        return Response(serializer.data)


class PlayerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing players
    """
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
        """Get all matches for a specific player"""
        player = self.get_object()
        matches = Match.objects.filter(
            Q(player1_team1=player) | Q(player2_team1=player) |
            Q(player1_team2=player) | Q(player2_team2=player)
        ).select_related('tournament', 'venue', 'court')
        
        # Optional filtering by status
        status_filter = request.query_params.get('status')
        if status_filter:
            matches = matches.filter(status=status_filter)
            
        serializer = MatchListSerializer(matches, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get player statistics"""
        player = self.get_object()
        matches = Match.objects.filter(
            Q(player1_team1=player) | Q(player2_team1=player) |
            Q(player1_team2=player) | Q(player2_team2=player)
        )
        
        stats = {
            'total_matches': matches.count(),
            'completed_matches': matches.filter(status='Completed').count(),
            'live_matches': matches.filter(status='Live').count(),
            'upcoming_matches': matches.filter(status='Upcoming').count(),
            'singles_matches': matches.filter(match_type='Single').count(),
            'doubles_matches': matches.filter(match_type='Doubles').count(),
            'mixed_doubles_matches': matches.filter(match_type='Mixed Doubles').count(),
        }
        
        return Response(stats)

    @action(detail=False, methods=['get'])
    def by_country(self, request):
        """Get players grouped by country"""
        country_id = request.query_params.get('country_id')
        if not country_id:
            return Response({'error': 'country_id parameter is required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        players = self.get_queryset().filter(country_id=country_id)
        serializer = self.get_serializer(players, many=True)
        return Response(serializer.data)


class MatchViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing matches
    """
    queryset = Match.objects.all()
    serializer_class = MatchSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tournament', 'status', 'match_type', 'venue', 'court']
    search_fields = ['player1_team1__name', 'player1_team2__name', 'player2_team1__name', 'player2_team2__name']
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

    @action(detail=False, methods=['get'])
    def live(self, request):
        """Get all live matches"""
        live_matches = self.get_queryset().filter(status='Live')
        serializer = MatchSerializer(live_matches, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming matches"""
        upcoming_matches = self.get_queryset().filter(status='Upcoming')
        serializer = MatchSerializer(upcoming_matches, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's matches"""
        today = timezone.now().date()
        today_matches = self.get_queryset().filter(scheduled_time__date=today)
        serializer = MatchListSerializer(today_matches, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_score(self, request, pk=None):
        """Update match score"""
        match = self.get_object()
        game_scores_data = request.data.get('game_scores', [])
        
        if not game_scores_data:
            return Response({'error': 'game_scores data is required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Delete existing scores and create new ones
        match.game_scores.all().delete()
        
        for score_data in game_scores_data:
            GameScore.objects.create(
                match=match,
                game_number=score_data.get('game_number'),
                team1_score=score_data.get('team1_score'),
                team2_score=score_data.get('team2_score')
            )
        
        # Update match status and sets if provided
        if 'status' in request.data:
            match.status = request.data['status']
        if 'team1_sets' in request.data:
            match.team1_sets = request.data['team1_sets']
        if 'team2_sets' in request.data:
            match.team2_sets = request.data['team2_sets']
        if 'current_game' in request.data:
            match.current_game = request.data['current_game']
        
        match.save()
        
        serializer = self.get_serializer(match)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def start_match(self, request, pk=None):
        """Start a match (change status to Live)"""
        match = self.get_object()
        
        if match.status != 'Upcoming':
            return Response({'error': 'Only upcoming matches can be started'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        match.status = 'Live'
        match.current_game = 1
        match.save()
        
        serializer = self.get_serializer(match)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def finish_match(self, request, pk=None):
        """Finish a match (change status to Completed)"""
        match = self.get_object()
        
        if match.status != 'Live':
            return Response({'error': 'Only live matches can be finished'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        match.status = 'Completed'
        match.save()
        
        serializer = self.get_serializer(match)
        return Response(serializer.data)

##################################################################################################
# sponsor viewset below here 
class SponsorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing sponsors
    """
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
#################################################################################################

class GameScoreViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing game scores
    """
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
    """
    ViewSet for managing tournament venues
    """
    queryset = TournamentVenue.objects.all()
    serializer_class = TournamentVenueSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['tournament', 'venue']
    ordering_fields = ['start_date', 'end_date']
    ordering = ['start_date']

    def get_queryset(self):
        return TournamentVenue.objects.select_related('tournament', 'venue')