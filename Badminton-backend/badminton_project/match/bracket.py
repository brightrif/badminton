# ─────────────────────────────────────────────────────────────────────────────
# FILE: match/bracket.py
#
# Drop into: Badminton-backend/badminton_project/match/bracket.py
#
# Contains:
#   - BracketMatch model
#   - BracketMatchSerializer
#   - BracketMatchViewSet  (set_entries, schedule_match actions)
#   - generate_bracket()  helper
#   - auto_advance signal  (fires when a Match completes)
#   - bracket / generate_bracket / reset_bracket actions injected onto
#     TournamentEventViewSet (monkey-patched at bottom)
# ─────────────────────────────────────────────────────────────────────────────

import math
from django.db import models, transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication


# ══════════════════════════════════════════════════════════════════════════════
# MODEL
# ══════════════════════════════════════════════════════════════════════════════

class BracketMatch(models.Model):
    """
    One slot in a knockout bracket.

    For 16 entries:
        Round 1 (R16) → 8 slots   (director assigns entry pairs here)
        Round 2 (QF)  → 4 slots   (auto-filled from R1 winners)
        Round 3 (SF)  → 2 slots
        Round 4 (F)   → 1 slot

    feeds_into / feeds_as_slot wire the bracket so the system knows which
    next-round slot each winner advances into.
    """
    event        = models.ForeignKey(
        'match.TournamentEvent',
        on_delete=models.CASCADE,
        related_name='bracket_matches',
    )
    round_number = models.PositiveSmallIntegerField()
    position     = models.PositiveSmallIntegerField()  # 1-based within round

    # ── Doubles entries (DoublesTeam FK) ──────────────────────────────────────
    entry1 = models.ForeignKey(
        'match.DoublesTeam',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='bracket_slots_as_entry1',
    )
    entry2 = models.ForeignKey(
        'match.DoublesTeam',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='bracket_slots_as_entry2',
    )

    # ── Singles entries (Player FK) ───────────────────────────────────────────
    entry1_player = models.ForeignKey(
        'match.Player',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='bracket_slots_as_entry1',
    )
    entry2_player = models.ForeignKey(
        'match.Player',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='bracket_slots_as_entry2',
    )

    # ── Linked Match (created when director schedules this slot) ──────────────
    match = models.OneToOneField(
        'match.Match',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='bracket_slot',
    )

    # ── Winner tracking (set by auto_advance signal) ──────────────────────────
    winner_entry = models.ForeignKey(
        'match.DoublesTeam',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='bracket_wins',
    )
    winner_player = models.ForeignKey(
        'match.Player',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='bracket_wins',
    )

    # ── Bracket wiring ────────────────────────────────────────────────────────
    feeds_into = models.ForeignKey(
        'self',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='fed_by',
    )
    feeds_as_slot = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="1 = winner fills entry1 of feeds_into, 2 = fills entry2",
    )

    is_bye     = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering        = ['round_number', 'position']
        unique_together = [('event', 'round_number', 'position')]

    # ── Display helpers ───────────────────────────────────────────────────────

    @property
    def entry1_name(self):
        # For bye slots: show the team name if assigned, else TBD
        if self.entry1_id:
            return self.entry1.name if self.entry1 else "TBD"
        if self.entry1_player_id:
            return self.entry1_player.name if self.entry1_player else "TBD"
        return "TBD"

    @property
    def entry2_name(self):
        # Bye slots only have entry1; entry2 is always "—"
        if self.is_bye:
            return "—"
        if self.entry2_id:
            return self.entry2.name if self.entry2 else "TBD"
        if self.entry2_player_id:
            return self.entry2_player.name if self.entry2_player else "TBD"
        return "TBD"

    def __str__(self):
        return (
            f"{self.event.name} R{self.round_number}P{self.position}: "
            f"{self.entry1_name} vs {self.entry2_name}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class MatchDetailInlineSerializer(serializers.Serializer):
    id             = serializers.IntegerField()
    status         = serializers.CharField()
    team1_sets     = serializers.IntegerField()
    team2_sets     = serializers.IntegerField()
    scheduled_time = serializers.DateTimeField()
    court_name     = serializers.SerializerMethodField()
    venue_name     = serializers.SerializerMethodField()

    def get_court_name(self, obj):
        return obj.court.name if obj.court else None

    def get_venue_name(self, obj):
        return obj.venue.name if obj.venue else None


class BracketMatchSerializer(serializers.ModelSerializer):
    entry1_name  = serializers.CharField(read_only=True)
    entry2_name  = serializers.CharField(read_only=True)
    match_detail = serializers.SerializerMethodField()

    class Meta:
        model  = BracketMatch
        fields = [
            'id', 'round_number', 'position',
            'entry1', 'entry1_name',
            'entry2', 'entry2_name',
            'entry1_player', 'entry2_player',
            'match', 'match_detail',
            'winner_entry', 'winner_player',
            'feeds_into', 'feeds_as_slot',
            'is_bye',
        ]
        read_only_fields = [
            'feeds_into', 'feeds_as_slot',
            'winner_entry', 'winner_player',
        ]

    def get_match_detail(self, obj):
        if obj.match:
            return MatchDetailInlineSerializer(obj.match).data
        return None


# ══════════════════════════════════════════════════════════════════════════════
# BRACKET GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def _next_power_of_2(n):
    if n < 2:
        return 2
    return 2 ** math.ceil(math.log2(n))


@transaction.atomic
def create_bracket_slots(event):
    """
    Build all BracketMatch rows for a knockout event.

    Steps:
    1. Count registered entries (teams for doubles, players for singles)
    2. Pad to next power of 2  → draw_size
    3. Create all slots for all rounds
    4. Wire feeds_into / feeds_as_slot (standard seeding order)
    5. Mark excess R1 slots as BYE and auto-advance their walkovers
    """
    from .doubles_team import DoublesTeam

    if BracketMatch.objects.filter(event=event).exists():
        raise ValueError("Bracket already generated for this event.")

    is_doubles  = event.match_type in ('DOUBLES', 'MIXED_DOUBLES')
    entry_count = (
        DoublesTeam.objects.filter(event=event).count() if is_doubles
        else event.registrations.count()
    )

    if entry_count < 2:
        raise ValueError("Need at least 2 entries to generate a bracket.")

    draw_size    = _next_power_of_2(entry_count)
    total_rounds = int(math.log2(draw_size))
    bye_count    = draw_size - entry_count

    # ── 1. Create all slot objects ────────────────────────────────────────────
    slots = {}
    for rnd in range(1, total_rounds + 1):
        slot_count = draw_size >> rnd      # draw_size / 2^rnd; final = 1
        if slot_count == 0:
            slot_count = 1
        for pos in range(1, slot_count + 1):
            bm = BracketMatch.objects.create(
                event        = event,
                round_number = rnd,
                position     = pos,
            )
            slots[(rnd, pos)] = bm

    # ── 2. Wire bracket structure ─────────────────────────────────────────────
    for rnd in range(1, total_rounds):
        slot_count = draw_size >> rnd
        for pos in range(1, slot_count + 1):
            bm          = slots[(rnd, pos)]
            next_pos    = (pos + 1) // 2
            feeds_slot  = 2 - (pos % 2)   # odd position → slot 1, even → slot 2
            next_bm     = slots.get((rnd + 1, next_pos))
            if next_bm:
                BracketMatch.objects.filter(pk=bm.pk).update(
                    feeds_into_id = next_bm.pk,
                    feeds_as_slot = feeds_slot,
                )
                bm.feeds_into_id = next_bm.pk
                bm.feeds_as_slot = feeds_slot

    # ── 3. Mark BYE slots (last bye_count R1 positions) ──────────────────────
    # For 12 teams: positions 5-8 in R1 are bye slots.
    # Director assigns ONE team to each; that team auto-advances to R2.
    if bye_count > 0:
        r1_count = draw_size >> 1
        for pos in range(r1_count - bye_count + 1, r1_count + 1):
            bm = slots.get((1, pos))
            if bm:
                BracketMatch.objects.filter(pk=bm.pk).update(is_bye=True)
                bm.is_bye = True

    return list(slots.values())


# ══════════════════════════════════════════════════════════════════════════════
# MATCH CREATION  (director schedules a slot)
# ══════════════════════════════════════════════════════════════════════════════

@transaction.atomic
def _create_match_for_slot(bm, scheduled_time, venue_id=None, court_id=None,
                            scoring_format='21_WITH_SET'):
    from .models import Match, Venue, Court

    event      = bm.event
    is_doubles = event.match_type in ('DOUBLES', 'MIXED_DOUBLES')

    if is_doubles:
        if not bm.entry1_id or not bm.entry2_id:
            raise ValueError("Both team entries must be set before scheduling.")
        # Reload to get related objects
        bm_fresh = BracketMatch.objects.select_related(
            'entry1__player1', 'entry1__player2',
            'entry2__player1', 'entry2__player2',
        ).get(pk=bm.pk)
        kwargs = dict(
            tournament     = event.tournament,
            event          = event,
            match_type     = event.match_type,
            scoring_format = scoring_format,
            player1_team1  = bm_fresh.entry1.player1,
            player2_team1  = bm_fresh.entry1.player2,
            player1_team2  = bm_fresh.entry2.player1,
            player2_team2  = bm_fresh.entry2.player2,
            scheduled_time = scheduled_time,
            status         = 'Upcoming',
        )
    else:
        if not bm.entry1_player_id or not bm.entry2_player_id:
            raise ValueError("Both player entries must be set before scheduling.")
        kwargs = dict(
            tournament     = event.tournament,
            event          = event,
            match_type     = 'SINGLE',
            scoring_format = scoring_format,
            player1_team1  = bm.entry1_player,
            player1_team2  = bm.entry2_player,
            scheduled_time = scheduled_time,
            status         = 'Upcoming',
        )

    if venue_id:
        kwargs['venue'] = Venue.objects.get(pk=venue_id)
    if court_id:
        kwargs['court'] = Court.objects.get(pk=court_id)

    match = Match(**kwargs)
    match.save()

    BracketMatch.objects.filter(pk=bm.pk).update(match=match)
    return match


# ══════════════════════════════════════════════════════════════════════════════
# AUTO-ADVANCE SIGNAL
# ══════════════════════════════════════════════════════════════════════════════

@receiver(post_save, sender='match.Match')
def auto_advance_bracket(sender, instance, **kwargs):
    """
    When a Match status flips to Completed:
    1. Find the BracketMatch that owns it
    2. Record the winner
    3. Push winner into the correct entry slot of the next round
    4. If both entries of next slot are now filled, create its Match record
       (status=Upcoming, scheduled_time placeholder — director sets time/court later)
    """
    if instance.status != 'Completed':
        return

    try:
        bm = BracketMatch.objects.select_related(
            'feeds_into',
            'entry1', 'entry2',
            'entry1_player', 'entry2_player',
        ).get(match=instance)
    except BracketMatch.DoesNotExist:
        return

    if bm.is_bye:
        return

    team1_won  = instance.team1_sets > instance.team2_sets
    is_doubles = bm.entry1_id is not None or bm.entry2_id is not None

    # ── Record winner ─────────────────────────────────────────────────────────
    if is_doubles:
        winner_team = bm.entry1 if team1_won else bm.entry2
        BracketMatch.objects.filter(pk=bm.pk).update(winner_entry=winner_team)
    else:
        winner_player = bm.entry1_player if team1_won else bm.entry2_player
        BracketMatch.objects.filter(pk=bm.pk).update(winner_player=winner_player)

    if not bm.feeds_into_id:
        return  # Final — tournament over

    # ── Push winner into next slot ────────────────────────────────────────────
    next_bm = BracketMatch.objects.get(pk=bm.feeds_into_id)

    if bm.feeds_as_slot == 1:
        if is_doubles:
            BracketMatch.objects.filter(pk=next_bm.pk).update(entry1=winner_team)
            next_bm.entry1 = winner_team
        else:
            BracketMatch.objects.filter(pk=next_bm.pk).update(entry1_player=winner_player)
            next_bm.entry1_player = winner_player
    else:
        if is_doubles:
            BracketMatch.objects.filter(pk=next_bm.pk).update(entry2=winner_team)
            next_bm.entry2 = winner_team
        else:
            BracketMatch.objects.filter(pk=next_bm.pk).update(entry2_player=winner_player)
            next_bm.entry2_player = winner_player

    # ── Auto-create the next Match if both entries are now filled ─────────────
    next_bm.refresh_from_db()
    both_filled = (
        (next_bm.entry1_id and next_bm.entry2_id) if is_doubles
        else (next_bm.entry1_player_id and next_bm.entry2_player_id)
    )

    if both_filled and not next_bm.match_id:
        from django.utils import timezone
        try:
            _create_match_for_slot(
                next_bm,
                scheduled_time = timezone.now(),   # placeholder; director updates
                scoring_format = instance.scoring_format,
            )
        except Exception:
            pass   # Don't break scoring if bracket creation fails


# ══════════════════════════════════════════════════════════════════════════════
# VIEWSET
# ══════════════════════════════════════════════════════════════════════════════
def _can_manually_assign(bm):
    """
    All R1 slots are manually assignable — both real match slots and bye slots.
    R2+ slots are auto-filled from match results only.
    """
    return bm.round_number == 1
class BracketMatchViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/bracket-matches/          — list all
    GET  /api/bracket-matches/<id>/     — detail
    POST /api/bracket-matches/<id>/set_entries/    — assign R1 teams/players
    POST /api/bracket-matches/<id>/schedule_match/ — set time/court for a slot
    """
    queryset = BracketMatch.objects.select_related(
        'event', 'entry1', 'entry2', 'entry1_player', 'entry2_player',
        'match__court', 'match__venue', 'feeds_into',
    ).all()
    serializer_class       = BracketMatchSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes     = [IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='set_entries')
    def set_entries(self, request, pk=None):
        """
        Assign entries to a Round 1 slot.
        Body (doubles): { entry1: <team_id>, entry2: <team_id> }
        Body (singles): { entry1_player: <player_id>, entry2_player: <player_id> }
        """
        bm = self.get_object()

        if not _can_manually_assign(bm):
            return Response(
                {'error': 'This slot is auto-filled from match results and cannot be manually assigned.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .doubles_team import DoublesTeam
        from .models import Player

        with transaction.atomic():
            e1  = request.data.get('entry1')
            e2  = request.data.get('entry2')
            e1p = request.data.get('entry1_player')
            e2p = request.data.get('entry2_player')

            updates = {}
            if e1 is not None:
                DoublesTeam.objects.get(pk=e1)   # validate exists
                updates['entry1_id'] = int(e1)
            if e2 is not None:
                DoublesTeam.objects.get(pk=e2)
                updates['entry2_id'] = int(e2)
            if e1p is not None:
                Player.objects.get(pk=e1p)
                updates['entry1_player_id'] = int(e1p)
            if e2p is not None:
                Player.objects.get(pk=e2p)
                updates['entry2_player_id'] = int(e2p)

            if not updates:
                return Response({'error': 'No entry data provided.'},
                                status=status.HTTP_400_BAD_REQUEST)

            # ── Apply is_bye flag from frontend request ───────────────────────
            # This allows any R1 slot to be switched between real match / bye
            is_bye_request = bool(request.data.get('is_bye', False))
            updates['is_bye'] = is_bye_request

            # ── If switching FROM bye TO real match: undo R2 pre-advancement ──
            if not is_bye_request and bm.is_bye and bm.feeds_into_id:
                if bm.feeds_as_slot == 1:
                    BracketMatch.objects.filter(pk=bm.feeds_into_id).update(
                        entry1=None, entry1_player=None
                    )
                else:
                    BracketMatch.objects.filter(pk=bm.feeds_into_id).update(
                        entry2=None, entry2_player=None
                    )

            # ── Also clear entry2 on this slot if switching to bye mode ───────
            if is_bye_request:
                updates['entry2_id']        = None
                updates['entry2_player_id'] = None

            BracketMatch.objects.filter(pk=bm.pk).update(**updates)
            bm.refresh_from_db()

            # ── If this is now a bye slot, auto-advance the team to R2 ────────
            if bm.is_bye and bm.feeds_into_id:
                is_doubles_event = bm.event.match_type in ('DOUBLES', 'MIXED_DOUBLES')
                if is_doubles_event and bm.entry1_id:
                    if bm.feeds_as_slot == 1:
                        BracketMatch.objects.filter(pk=bm.feeds_into_id).update(
                            entry1_id=bm.entry1_id
                        )
                    else:
                        BracketMatch.objects.filter(pk=bm.feeds_into_id).update(
                            entry2_id=bm.entry1_id
                        )
                elif not is_doubles_event and bm.entry1_player_id:
                    if bm.feeds_as_slot == 1:
                        BracketMatch.objects.filter(pk=bm.feeds_into_id).update(
                            entry1_player_id=bm.entry1_player_id
                        )
                    else:
                        BracketMatch.objects.filter(pk=bm.feeds_into_id).update(
                            entry2_player_id=bm.entry1_player_id
                        )

        return Response(BracketMatchSerializer(bm).data)

    @action(detail=True, methods=['post'], url_path='schedule_match')
    def schedule_match(self, request, pk=None):
        """
        Create (or update) the Match record for this bracket slot.
        Body: { scheduled_time, venue (opt), court (opt), scoring_format (opt) }
        """
        bm = self.get_object()

        scheduled_time = request.data.get('scheduled_time')
        venue_id       = request.data.get('venue')
        court_id       = request.data.get('court')
        scoring_format = request.data.get('scoring_format', '21_WITH_SET')

        if not scheduled_time:
            return Response({'error': 'scheduled_time is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if bm.match_id:
                # Update existing
                from .models import Venue, Court
                m = bm.match
                m.scheduled_time = scheduled_time
                update_fields = ['scheduled_time']
                if venue_id:
                    m.venue = Venue.objects.get(pk=venue_id)
                    update_fields.append('venue')
                if court_id:
                    m.court = Court.objects.get(pk=court_id)
                    update_fields.append('court')
                Match_model = type(m)
                Match_model.objects.filter(pk=m.pk).update(
                    **{f: getattr(m, f) for f in update_fields}
                )
                bm.refresh_from_db()
                return Response(BracketMatchSerializer(bm).data)

            try:
                _create_match_for_slot(
                    bm,
                    scheduled_time = scheduled_time,
                    venue_id       = venue_id,
                    court_id       = court_id,
                    scoring_format = scoring_format,
                )
            except ValueError as e:
                return Response({'error': str(e)},
                                status=status.HTTP_400_BAD_REQUEST)

        bm.refresh_from_db()
        return Response(BracketMatchSerializer(bm).data,
                        status=status.HTTP_201_CREATED)


# ══════════════════════════════════════════════════════════════════════════════
# INJECT ACTIONS ONTO TournamentEventViewSet
# ══════════════════════════════════════════════════════════════════════════════

def bracket(self, request, pk=None):
    """GET /api/events/<id>/bracket/"""
    from .doubles_team import DoublesTeam

    event = self.get_object()
    bms   = BracketMatch.objects.filter(event=event).select_related(
        'entry1', 'entry2', 'entry1_player', 'entry2_player',
        'match__court', 'match__venue',
        'winner_entry', 'winner_player',
    ).order_by('round_number', 'position')

    is_doubles  = event.match_type in ('DOUBLES', 'MIXED_DOUBLES')
    entry_count = (
        DoublesTeam.objects.filter(event=event).count() if is_doubles
        else event.registrations.count()
    )

    entries = (
        [{'id': t.id, 'display_name': t.name}
         for t in DoublesTeam.objects.filter(event=event)]
        if is_doubles else
        [{'id': r.player_id, 'display_name': r.player.name}
         for r in event.registrations.select_related('player')]
    )

    return Response({
        'id':              event.id,
        'name':            event.name,
        'tournament_name': event.tournament.name,
        'format':          event.format,
        'match_type':      event.match_type,
        'is_drawn':        bms.exists(),
        'entry_count':     entry_count,
        'entries':         entries,
        'bye_count':       bms.filter(round_number=1, is_bye=True).count(),
        'bracket_matches': BracketMatchSerializer(bms, many=True).data,
    })


def generate_bracket(self, request, pk=None):
    """POST /api/events/<id>/generate_bracket/"""
    event = self.get_object()

    if event.format != 'KNOCKOUT':
        return Response(
            {'error': 'Only KNOCKOUT events support bracket generation.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if BracketMatch.objects.filter(event=event).exists():
        return Response({'error': 'Bracket already generated for this event.'},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        slots = create_bracket_slots(event)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {'message': f'Bracket generated — {len(slots)} slots created.',
         'slot_count': len(slots)},
        status=status.HTTP_201_CREATED,
    )


def reset_bracket(self, request, pk=None):
    """DELETE /api/events/<id>/reset_bracket/"""
    event   = self.get_object()
    played  = BracketMatch.objects.filter(
        event=event, match__status='Completed'
    ).exists()
    if played:
        return Response(
            {'error': 'Cannot reset — some matches have already been played.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    deleted, _ = BracketMatch.objects.filter(event=event).delete()
    return Response({'message': f'Bracket reset. {deleted} slots removed.'})


from .event_views import TournamentEventViewSet

TournamentEventViewSet.bracket = action(
    detail=True, methods=['get'], url_path='bracket'
)(bracket)

TournamentEventViewSet.generate_bracket = action(
    detail=True, methods=['post'], url_path='generate_bracket'
)(generate_bracket)

TournamentEventViewSet.reset_bracket = action(
    detail=True, methods=['delete'], url_path='reset_bracket'
)(reset_bracket)