# ─────────────────────────────────────────────────────────────────────────────
# FILE: match/doubles_team.py
#
# Drop into: Badminton-backend/badminton_project/match/doubles_team.py
# ─────────────────────────────────────────────────────────────────────────────

from django.db import models
from rest_framework import serializers, viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django_filters.rest_framework import DjangoFilterBackend


# ══════════════════════════════════════════════════════════════════════════════
# MODEL
# ══════════════════════════════════════════════════════════════════════════════

class DoublesTeam(models.Model):
    """
    A named pair of players forming a doubles / mixed-doubles team.
    Scoped to a TournamentEvent so the same two players can form different
    teams in different events (e.g. different draws).

    The Match model stores individual player FKs as before — this model is
    only a convenience layer used during match creation.
    """
    event = models.ForeignKey(
        'match.TournamentEvent',
        on_delete=models.CASCADE,
        related_name='doubles_teams',
    )
    player1 = models.ForeignKey(
        'match.Player',
        on_delete=models.CASCADE,
        related_name='doubles_teams_as_player1',
    )
    player2 = models.ForeignKey(
        'match.Player',
        on_delete=models.CASCADE,
        related_name='doubles_teams_as_player2',
    )
    # Optional display name; auto-generated on save if blank
    name = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['event', 'name']
        unique_together = [('event', 'player1', 'player2')]

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = f"{self.player1.name} / {self.player2.name}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.event.name} — {self.name}"


# ══════════════════════════════════════════════════════════════════════════════
# SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class DoublesTeamSerializer(serializers.ModelSerializer):
    player1_name    = serializers.CharField(source='player1.name', read_only=True)
    player2_name    = serializers.CharField(source='player2.name', read_only=True)
    player1_country = serializers.CharField(source='player1.country.name', read_only=True, default='')
    player2_country = serializers.CharField(source='player2.country.name', read_only=True, default='')
    player1_photo   = serializers.SerializerMethodField()
    player2_photo   = serializers.SerializerMethodField()
    event_name      = serializers.CharField(source='event.name', read_only=True)

    class Meta:
        model  = DoublesTeam
        fields = [
            'id', 'event', 'event_name', 'name',
            'player1', 'player1_name', 'player1_country', 'player1_photo',
            'player2', 'player2_name', 'player2_country', 'player2_photo',
            'created_at',
        ]
        read_only_fields = ['created_at']

    def get_player1_photo(self, obj):
        request = self.context.get('request')
        if obj.player1.photo:
            return request.build_absolute_uri(obj.player1.photo.url) if request else obj.player1.photo.url
        return ''

    def get_player2_photo(self, obj):
        request = self.context.get('request')
        if obj.player2.photo:
            return request.build_absolute_uri(obj.player2.photo.url) if request else obj.player2.photo.url
        return ''

    def validate(self, data):
        player1 = data.get('player1')
        player2 = data.get('player2')
        event   = data.get('event')

        if player1 and player2 and player1 == player2:
            raise serializers.ValidationError("player1 and player2 must be different players.")

        # On create, check uniqueness (player1/player2 order-agnostic)
        if player1 and player2 and event:
            instance_id = self.instance.id if self.instance else None
            qs = DoublesTeam.objects.filter(event=event).exclude(pk=instance_id)
            if qs.filter(player1=player1, player2=player2).exists() or \
               qs.filter(player1=player2, player2=player1).exists():
                raise serializers.ValidationError(
                    "This pair is already registered as a team for this event."
                )

        return data


# ══════════════════════════════════════════════════════════════════════════════
# VIEWSET
# ══════════════════════════════════════════════════════════════════════════════

class DoublesTeamViewSet(viewsets.ModelViewSet):
    """
    GET    /api/doubles-teams/?event=<id>   — list teams for an event
    POST   /api/doubles-teams/              — create { event, player1, player2, name? }
    PATCH  /api/doubles-teams/<id>/         — rename team
    DELETE /api/doubles-teams/<id>/         — remove team

    GET    /api/doubles-teams/teams_for_event/?event=<id>
           — lightweight team list for the match-creation dropdowns.
             Returns teams if any exist for the event, empty list otherwise.
    """
    queryset = DoublesTeam.objects.select_related(
        'event', 'player1', 'player1__country',
        'player2', 'player2__country'
    ).all()
    serializer_class       = DoublesTeamSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes     = [IsAuthenticated]
    filter_backends        = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields       = ['event', 'player1', 'player2']
    search_fields          = ['name', 'player1__name', 'player2__name']
    ordering               = ['name']

    @action(detail=False, methods=['get'], url_path='teams_for_event')
    def teams_for_event(self, request):
        """
        Lightweight team list used by the match-creation form.
        Returns all teams registered for the given event.
        """
        event_id = request.query_params.get('event')
        if not event_id:
            return Response({'error': 'event query param required.'}, status=400)

        from .event_models import TournamentEvent
        try:
            event = TournamentEvent.objects.get(pk=event_id)
        except TournamentEvent.DoesNotExist:
            return Response({'error': 'Event not found.'}, status=404)

        teams = DoublesTeam.objects.filter(event=event).select_related(
            'player1', 'player1__country',
            'player2', 'player2__country',
        )

        data = [
            {
                'id':             t.id,
                'name':           t.name,
                'player1_id':     t.player1_id,
                'player1_name':   t.player1.name,
                'player1_country': t.player1.country.name if t.player1.country else '',
                'player2_id':     t.player2_id,
                'player2_name':   t.player2.name,
                'player2_country': t.player2.country.name if t.player2.country else '',
            }
            for t in teams
        ]

        return Response({
            'event_id':   event.id,
            'event_name': event.name,
            'count':      len(data),
            'teams':      data,
        })


# ══════════════════════════════════════════════════════════════════════════════
# WIRE IT UP — instructions
# ══════════════════════════════════════════════════════════════════════════════
#
# 1. Add to match/urls.py:
#
#       from .doubles_team import DoublesTeamViewSet
#       router.register(r'doubles-teams', DoublesTeamViewSet, basename='doubles-team')
#
# 2. Add to match/admin.py:
#
#       from .doubles_team import DoublesTeam
#       admin.site.register(DoublesTeam)
#
# 3. Run migrations:
#
#       python manage.py makemigrations match
#       python manage.py migrate
#
# That's it — no changes needed to models.py, serializers.py, or scoring logic.