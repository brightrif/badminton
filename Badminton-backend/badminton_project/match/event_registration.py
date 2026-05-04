# ─────────────────────────────────────────────────────────────────────────────
# FILE: match/event_registration.py
#
# Drop into: Badminton-backend/badminton_project/match/event_registration.py
# ─────────────────────────────────────────────────────────────────────────────

from django.db import models
from rest_framework import serializers, viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django_filters.rest_framework import DjangoFilterBackend


# ══════════════════════════════════════════════════════════════════════════════
# MODEL  — uses string references to avoid circular imports
# ══════════════════════════════════════════════════════════════════════════════

class EventRegistration(models.Model):
    """
    Registers a player to a specific tournament event.
    When an event has registrations, match creation shows only those players.
    When an event has zero registrations, all players are shown (backwards-compat).
    """
    # ── String references ('match.TournamentEvent', 'match.Player') avoid
    #    importing from sibling modules during Django's startup sequence. ──────
    event  = models.ForeignKey(
        'match.TournamentEvent',
        on_delete=models.CASCADE,
        related_name='registrations',
    )
    player = models.ForeignKey(
        'match.Player',
        on_delete=models.CASCADE,
        related_name='event_registrations',
    )
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering        = ['event', 'player__name']
        unique_together = [('event', 'player')]

    def __str__(self):
        return f'{self.player.name} → {self.event.name}'


# ══════════════════════════════════════════════════════════════════════════════
# SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class EventRegistrationSerializer(serializers.ModelSerializer):
    player_name    = serializers.CharField(source='player.name',         read_only=True)
    player_country = serializers.CharField(source='player.country.name', read_only=True, default='')
    photo_url      = serializers.SerializerMethodField()

    class Meta:
        model  = EventRegistration
        fields = [
            'id', 'event', 'player', 'player_name',
            'player_country', 'photo_url', 'registered_at',
        ]
        read_only_fields = ['registered_at']

    def get_photo_url(self, obj):
        request = self.context.get('request')
        if obj.player.photo:
            return request.build_absolute_uri(obj.player.photo.url) if request else obj.player.photo.url
        return ''

    def validate(self, data):
        if EventRegistration.objects.filter(
            event=data['event'], player=data['player']
        ).exists():
            raise serializers.ValidationError(
                f"{data['player'].name} is already registered for this event."
            )
        return data


# ══════════════════════════════════════════════════════════════════════════════
# VIEWSET
# ══════════════════════════════════════════════════════════════════════════════

class EventRegistrationViewSet(viewsets.ModelViewSet):
    """
    GET  /api/event-registrations/?event=<id>        — list registrations for event
    POST /api/event-registrations/                    — register { event, player }
    DELETE /api/event-registrations/<id>/             — remove registration

    GET  /api/event-registrations/players_for_event/?event=<id>
         — lightweight player list for the match form dropdowns.
           Returns registered players if any exist, ALL players otherwise.
    """
    queryset               = EventRegistration.objects.select_related(
        'event', 'player', 'player__country'
    ).all()
    serializer_class       = EventRegistrationSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes     = [IsAuthenticated]
    filter_backends        = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields       = ['event', 'player']
    search_fields          = ['player__name']
    ordering               = ['player__name']

    @action(detail=False, methods=['get'], url_path='players_for_event')
    def players_for_event(self, request):
        """
        Used by the match-creation form.
        Returns registered players (filtered) or all players (fallback).
        """
        event_id = request.query_params.get('event')
        if not event_id:
            return Response({'error': 'event query param required.'}, status=400)

        # Import here to avoid any remaining import-order issues
        from .event_models import TournamentEvent
        from .models import Player

        try:
            event = TournamentEvent.objects.get(pk=event_id)
        except TournamentEvent.DoesNotExist:
            return Response({'error': 'Event not found.'}, status=404)

        registrations = EventRegistration.objects.filter(event=event).select_related(
            'player', 'player__country'
        )

        if registrations.exists():
            players = [r.player for r in registrations]
            source  = 'registered'
        else:
            players = list(Player.objects.select_related('country').all())
            source  = 'all'

        data = [
            {
                'id':      p.id,
                'name':    p.name,
                'country': p.country.name if p.country else '',
                'photo_url': (
                    request.build_absolute_uri(p.photo.url)
                    if p.photo else ''
                ),
            }
            for p in players
        ]
        return Response({'source': source, 'count': len(data), 'players': data})


# ══════════════════════════════════════════════════════════════════════════════
# WIRE IT UP  (instructions)
# ══════════════════════════════════════════════════════════════════════════════
#
# 1. Add to match/urls.py:
#
#       from .event_registration import EventRegistrationViewSet
#       router.register(r'event-registrations', EventRegistrationViewSet, basename='event-registration')
#
# 2. Add to match/admin.py:
#
#       from .event_registration import EventRegistration
#       admin.site.register(EventRegistration)
#
# 3. Run migrations:
#
#       python manage.py makemigrations match
#       python manage.py migrate
#
# That's it — no changes needed to models.py or event_models.py.