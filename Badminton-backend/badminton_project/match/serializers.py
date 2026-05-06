# badminton_app/serializers.py

from rest_framework import serializers
from django.db import transaction
from .models import (
    Country, Tournament, Player, Sponsor, Match, GameScore, Venue,
    TournamentVenue, Court
)

# --- Basic Models ---

class CountrySerializer(serializers.ModelSerializer):
    players_count = serializers.SerializerMethodField()
    venues_count = serializers.SerializerMethodField()

    class Meta:
        model = Country
        fields = ['id', 'name', 'code', 'flag_url', 'players_count', 'venues_count']

    def get_players_count(self, obj):
        return obj.players.count()

    def get_venues_count(self, obj):
        return obj.venues.count()

class CourtSerializer(serializers.ModelSerializer):
    venue_name = serializers.CharField(source='venue.name', read_only=True)

    class Meta:
        model = Court
        fields = [
            'id', 'name', 'court_type', 'surface_type', 
            'is_active', 'venue', 'venue_name', 'created_at'
        ]
        read_only_fields = ['created_at']

class VenueSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True)
    courts = CourtSerializer(many=True, read_only=True)
    courts_count = serializers.SerializerMethodField()
    upcoming_matches_count = serializers.SerializerMethodField()

    class Meta:
        model = Venue
        fields = [
            'id', 'name', 'address', 'city', 'country', 'country_name',
            'phone', 'email', 'website', 'total_courts', 'has_parking',
            'has_cafeteria', 'has_livestream', 'courts', 'courts_count',
            'upcoming_matches_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_courts_count(self, obj):
        return obj.courts.count()

    def get_upcoming_matches_count(self, obj):
        return obj.matches.filter(status='Upcoming').count()
    
class VenueListSerializer(serializers.ModelSerializer):
    """Simplified venue serializer for list views"""
    country_name = serializers.CharField(source='country.name', read_only=True)
    courts_count = serializers.SerializerMethodField()

    class Meta:
        model = Venue
        fields = [
            'id', 'name', 'city', 'country', 'country_name',
            'total_courts', 'courts_count', 'has_parking',
            'has_cafeteria', 'has_livestream'
        ]

    def get_courts_count(self, obj):
        return obj.courts.count()
    
class TournamentVenueSerializer(serializers.ModelSerializer):
    venue_name = serializers.CharField(source='venue.name', read_only=True)
    venue_city = serializers.CharField(source='venue.city', read_only=True)

    class Meta:
        model = TournamentVenue
        fields = [
            'id', 'venue', 'venue_name', 'venue_city',
            'start_date', 'end_date'
        ]

class SponsorSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    tournament_name = serializers.CharField(source='tournament.name', read_only=True)

    class Meta:
        model = Sponsor
        fields = [
            'id', 'name', 'logo_url', 'tournament', 'tournament_name',
            'priority', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
        return ''

class TournamentSerializer(serializers.ModelSerializer):
    venues_detail = TournamentVenueSerializer(source='tournament_venues', many=True, read_only=True)
    sponsors = SponsorSerializer(many=True, read_only=True)
    matches_count = serializers.SerializerMethodField()
    live_matches_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Tournament
        fields = [
            'id', 'name', 'start_date', 'end_date', 'venues_detail',
            'sponsors', 'matches_count', 'live_matches_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_matches_count(self, obj):
        return obj.matches.count()

    def get_live_matches_count(self, obj):
        return obj.matches.filter(status='Live').count()

class PlayerSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True)
    country_code = serializers.CharField(source='country.code', read_only=True)
    matches_count = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = [
            'id', 'name', 'country', 'country_name', 'country_code',
            'photo_url', 'matches_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_matches_count(self, obj):
        # Count matches where player appears in any position
        from django.db.models import Q
        return Match.objects.filter(
            Q(player1_team1=obj) | Q(player2_team1=obj) |
            Q(player1_team2=obj) | Q(player2_team2=obj)
        ).count()
    
   
    def get_photo_url(self, obj):
        if obj.photo and hasattr(obj.photo, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            # Fallback if no request (e.g. in shell)
            return f"http://127.0.0.1:8000{obj.photo.url}"
        # Fallback placeholder
        return f"https://placehold.co/120x120/333/fff?text={obj.name.split()[0][0]}{obj.name.split()[-1][0]}"
    
class GameScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameScore
        fields = ['id', 'game_number', 'team1_score', 'team2_score']

class MatchSerializer(serializers.ModelSerializer):
    # Player details
    player1_team1_detail = PlayerSerializer(source='player1_team1', read_only=True)
    player2_team1_detail = PlayerSerializer(source='player2_team1', read_only=True)
    player1_team2_detail = PlayerSerializer(source='player1_team2', read_only=True)
    player2_team2_detail = PlayerSerializer(source='player2_team2', read_only=True)
    server_detail = PlayerSerializer(source='server', read_only=True)
    
    # Tournament and venue details
    tournament_name = serializers.CharField(source='tournament.name', read_only=True)
    venue_name = serializers.CharField(source='venue.name', read_only=True)
    court_name = serializers.CharField(source='court.name', read_only=True)
    
    # Game scores
    game_scores = GameScoreSerializer(many=True, read_only=True)
    current_game_score = serializers.SerializerMethodField()
    match_winner = serializers.SerializerMethodField()

    event_name = serializers.CharField(source='event.name', read_only=True, default=None)
    
    class Meta:
        model = Match
        fields = [
            'id', 'tournament', 'tournament_name', 'match_type','event', 'event_name',
            'player1_team1', 'player1_team1_detail',
            'player2_team1', 'player2_team1_detail',
            'player1_team2', 'player1_team2_detail',
            'player2_team2', 'player2_team2_detail',
            'server', 'server_detail',
            'scheduled_time', 'status', 'current_game',
            'team1_sets', 'team2_sets',
            'venue', 'venue_name', 'court', 'court_name',
            'game_scores', 'current_game_score', 'match_winner',
            'created_at', 'updated_at','scoring_format'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_current_game_score(self, obj):
        current_score = obj.get_current_game_score()
        if current_score:
            return GameScoreSerializer(current_score).data
        return None

    def get_match_winner(self, obj):
        return obj.get_match_winner()

    def validate(self, data):
        """Custom validation for match data"""
        match_type = data.get('match_type')
        player1_team1 = data.get('player1_team1')
        player2_team1 = data.get('player2_team1')
        player1_team2 = data.get('player1_team2')
        player2_team2 = data.get('player2_team2')
        server = data.get('server')

        # Ensure players exist
        if not player1_team1 or not Player.objects.filter(id=player1_team1).exists():
            raise serializers.ValidationError("player1_team1 is required and must exist.")
        if not player1_team2 or not Player.objects.filter(id=player1_team2).exists():
            raise serializers.ValidationError("player1_team2 is required and must exist.")
        
        # Validate players based on match type
        if match_type == Match.SINGLE:
            if player2_team1 or player2_team2:
                raise serializers.ValidationError(
                    "Singles matches should not have second players for teams."
                )
        elif match_type in [Match.DOUBLES, Match.MIXED_DOUBLES]:
            if not player2_team1 or not player2_team2:
                raise serializers.ValidationError(
                    "Doubles matches require two players per team."
                )

        # Validate server is one of the players
        if server:
            players = [p for p in [player1_team1, player2_team1, player1_team2, player2_team2] if p]
            if server not in players:
                raise serializers.ValidationError(
                    "Server must be one of the match players."
                )

        return data
    
class MatchListSerializer(serializers.ModelSerializer):
    """Simplified match serializer for list views"""
    tournament_name = serializers.CharField(source='tournament.name', read_only=True)
    venue_name = serializers.CharField(source='venue.name', read_only=True)
    court_name = serializers.CharField(source='court.name', read_only=True)
    
    # Simple player names
    player1_team1_name = serializers.CharField(source='player1_team1.name', read_only=True)
    player2_team1_name = serializers.CharField(source='player2_team1.name', read_only=True)
    player1_team2_name = serializers.CharField(source='player1_team2.name', read_only=True)
    player2_team2_name = serializers.CharField(source='player2_team2.name', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id','tournament', 'tournament_name', 'match_type', 'status',
            'player1_team1_name', 'player2_team1_name',
            'player1_team2_name', 'player2_team2_name',
            'scheduled_time', 'team1_sets', 'team2_sets',
            'venue_name', 'court_name','scoring_format'
        ]


class MatchCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating matches with game scores"""
    game_scores = GameScoreSerializer(many=True, required=False)

    class Meta:
        model = Match
        fields = [
            'tournament', 'match_type',
            'player1_team1', 'player2_team1',
            'player1_team2', 'player2_team2',
            'server', 'scheduled_time', 'status',
            'current_game', 'team1_sets', 'team2_sets',
            'venue', 'court', 'game_scores','scoring_format'
        ]

    @transaction.atomic
    def create(self, validated_data):
        game_scores_data = validated_data.pop('game_scores', [])
        match = Match.objects.create(**validated_data)
        
        # Create game scores
        for score_data in game_scores_data:
            GameScore.objects.create(match=match, **score_data)
        
        return match

    @transaction.atomic
    def update(self, instance, validated_data):
        game_scores_data = validated_data.pop('game_scores', [])
        
        # Update match fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update game scores
        if game_scores_data:
            # Delete existing scores and recreate (simpler approach)
            instance.game_scores.all().delete()
            for score_data in game_scores_data:
                GameScore.objects.create(match=instance, **score_data)
        
        return instance
    
