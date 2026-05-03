# match/event_serializers.py

from rest_framework import serializers
from .event_models import TournamentEvent


class TournamentEventSerializer(serializers.ModelSerializer):
    tournament_name  = serializers.CharField(source="tournament.name", read_only=True)
    match_count      = serializers.IntegerField(read_only=True)
    upcoming_count   = serializers.IntegerField(read_only=True)
    live_count       = serializers.IntegerField(read_only=True)
    completed_count  = serializers.IntegerField(read_only=True)
    format_display   = serializers.CharField(source="get_format_display", read_only=True)
    match_type_display = serializers.CharField(source="get_match_type_display", read_only=True)

    class Meta:
        model  = TournamentEvent
        fields = [
            "id", "tournament", "tournament_name",
            "name", "match_type", "match_type_display",
            "format", "format_display",
            "round_label",
            "match_count", "upcoming_count", "live_count", "completed_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


# ── Also patch MatchCreateUpdateSerializer to accept event ────────────────────
# In your existing match/serializers.py, add 'event' to MatchCreateUpdateSerializer fields:
#
#   class Meta:
#       model = Match
#       fields = [
#           'tournament', 'match_type', 'event',   # ← add 'event' here
#           'player1_team1', 'player2_team1',
#           ...
#       ]
#
# And add 'event' and 'event_name' to MatchListSerializer:
#
#   event      = serializers.PrimaryKeyRelatedField(read_only=True)
#   event_name = serializers.CharField(source='event.name', read_only=True, default=None)
#
#   class Meta:
#       model = Match
#       fields = [
#           'id', 'tournament', 'tournament_name', 'event', 'event_name',
#           'match_type', 'status', ...
#       ]