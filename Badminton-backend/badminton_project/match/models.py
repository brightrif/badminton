from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError
import random
from .event_registration import EventRegistration
from .event_models import TournamentEvent
from django.utils.text import slugify

class Country(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=3, unique=True)
    flag_url = models.URLField(blank=True, help_text="URL to country flag image")

    def __str__(self):
        return self.name


class Venue(models.Model):
    name = models.CharField(max_length=200)
    address = models.TextField()
    city = models.CharField(max_length=100)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='venues')
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    total_courts = models.PositiveIntegerField(default=1)
    has_parking = models.BooleanField(default=False)
    has_cafeteria = models.BooleanField(default=False)
    has_livestream = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.city}"

    class Meta:
        unique_together = ['name', 'city']
        indexes = [
            models.Index(fields=['city']),
            models.Index(fields=['country']),
        ]


class Tournament(models.Model):
    name = models.CharField(max_length=255, db_index=True)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    venues = models.ManyToManyField(
        Venue,
        through='TournamentVenue',
        related_name='tournaments',
        blank=True
    )

    def __str__(self):
        return self.name

    class Meta:
        indexes = [models.Index(fields=['name'])]


class TournamentVenue(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='tournament_venues')
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='tournament_venues')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.tournament.name} at {self.venue.name}"

    class Meta:
        unique_together = ['tournament', 'venue']
        verbose_name = "Tournament Venue"
        verbose_name_plural = "Tournament Venues"


class Court(models.Model):
    COURT_TYPE_CHOICES = [
        ('INDOOR', 'Indoor'),
        ('OUTDOOR', 'Outdoor'),
        ('COVERED_OUTDOOR', 'Covered Outdoor'),
    ]
    SURFACE_TYPE_CHOICES = [
        ('WOOD', 'Wooden'),
        ('SYNTHETIC', 'Synthetic'),
        ('CONCRETE', 'Concrete'),
        ('OTHER', 'Other'),
    ]

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='courts')
    name = models.CharField(max_length=100)
    slug = models.SlugField(
        max_length=120,
        unique=True,
        blank=True,
        help_text="URL-friendly identifier used for screen URLs (/screen/court/<slug>). "
                  "Auto-generated from venue + court name if left blank.",
    )
    court_type = models.CharField(max_length=20, choices=COURT_TYPE_CHOICES, default='INDOOR')
    surface_type = models.CharField(max_length=20, choices=SURFACE_TYPE_CHOICES, default='WOOD')
    is_active = models.BooleanField(default=True)
    break_mode = models.BooleanField(
    default=False,
    help_text="When True the court screen switches to the break/sponsor showcase.",
    )
    break_video = models.FileField(
        upload_to='break_videos/',
        blank=True,
        null=True,
        help_text="Optional MP4 ad video shown on the break screen (loops automatically).",
    )
    break_display_mode = models.CharField(
        max_length=10,
        choices=[('sponsors', 'Sponsors'), ('video', 'Video')],
        default='sponsors',
        help_text="What to show on the break screen: sponsor showcase or ad video.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(f"{self.venue.name}-{self.name}")
            slug = base
            n = 1
            while Court.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f"{base}-{n}"
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.venue.name} - {self.name}"

    class Meta:
        unique_together = ['venue', 'name']
        ordering = ['venue', 'name']


# ─── Fix: use name-based path so new players don't get id=None ───────────────
def player_photo_path(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower()
    safe_name = instance.name.replace(' ', '_').lower() if instance.name else 'unknown'
    return f'players/{safe_name}/photo.{ext}'


class Player(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='players')
    photo = models.ImageField(
        upload_to=player_photo_path,
        blank=True,
        null=True,
        help_text="Upload player photo (optional)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        indexes = [models.Index(fields=['name'])]


def sponsor_logo_path(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower()
    safe_name = instance.name.replace(' ', '_').lower() if instance.name else 'unknown'
    return f'sponsors/{safe_name}/logo.{ext}'


class Sponsor(models.Model):
    name = models.CharField(max_length=100)
    logo = models.ImageField(
        upload_to=sponsor_logo_path,
        blank=True,
        null=True,
        help_text="Upload sponsor logo (optional)"
    )
    tournament = models.ForeignKey(
        Tournament, on_delete=models.CASCADE,
        related_name='sponsors', null=True, blank=True
    )
    priority = models.IntegerField(default=0, help_text="Higher priority sponsors appear first")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        unique_together = ['name', 'tournament']


def generate_pin():
    """Generate a random 4-digit PIN string."""
    return str(random.randint(1000, 9999))


class Match(models.Model):
    SINGLE = 'SINGLE'
    DOUBLES = 'DOUBLES'
    MIXED_DOUBLES = 'MIXED_DOUBLES'

    MATCH_TYPE_CHOICES = [
        (SINGLE, 'Single'),
        (DOUBLES, 'Doubles'),
        (MIXED_DOUBLES, 'Mixed Doubles'),
    ]

    STATUS_CHOICES = [
        ('Live', 'Live'),
        ('Completed', 'Completed'),
        ('Upcoming', 'Upcoming'),
    ]

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='matches')
    event = models.ForeignKey(
        'match.TournamentEvent',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='event_matches',
    )
    match_type = models.CharField(max_length=20, choices=MATCH_TYPE_CHOICES)

    # Team 1
    player1_team1 = models.ForeignKey(
        Player, related_name='matches_as_player1_team1', on_delete=models.PROTECT
    )
    player2_team1 = models.ForeignKey(
        Player, related_name='matches_as_player2_team1',
        on_delete=models.SET_NULL, null=True, blank=True
    )

    # Team 2
    player1_team2 = models.ForeignKey(
        Player, related_name='matches_as_player1_team2', on_delete=models.PROTECT
    )
    player2_team2 = models.ForeignKey(
        Player, related_name='matches_as_player2_team2',
        on_delete=models.SET_NULL, null=True, blank=True
    )

    server = models.ForeignKey(
        Player, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='serving_matches'
    )

    scheduled_time = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Upcoming')

    current_game = models.IntegerField(default=1)
    team1_sets = models.IntegerField(default=0)
    team2_sets = models.IntegerField(default=0)

    # ── Umpire PIN ────────────────────────────────────────────────────────────
    umpire_pin = models.CharField(
        max_length=4,
        default=generate_pin,
        help_text="4-digit PIN for umpire access. Set in admin before match day."
    )

    assigned_umpire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='assigned_matches',
        help_text='Umpire assigned by the director.',
    )

    # ── Scoring format ────────────────────────────────────────────────────────
    SCORING_15_NO_SET   = '15_NO_SET'
    SCORING_15_WITH_SET = '15_WITH_SET'
    SCORING_21_NO_SET   = '21_NO_SET'
    SCORING_21_WITH_SET = '21_WITH_SET'

    SCORING_FORMAT_CHOICES = [
        (SCORING_15_NO_SET,   '15 pts – no settings'),
        (SCORING_15_WITH_SET, '15 pts – settings up to 21'),
        (SCORING_21_NO_SET,   '21 pts – no settings'),
        (SCORING_21_WITH_SET, '21 pts – settings up to 30'),
    ]

    scoring_format = models.CharField(
        max_length=20,
        choices=SCORING_FORMAT_CHOICES,
        default=SCORING_21_WITH_SET,
        help_text="Scoring format for this match."
    )

    venue = models.ForeignKey(
        Venue, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='matches'
    )
    court = models.ForeignKey(
        Court, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='matches'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # NOTE: Django automatically exposes server_id (the raw FK PK) from the
    # server ForeignKey field above. No extra property needed.

    # ── Score helpers ─────────────────────────────────────────────────────────

    def get_current_game_score(self):
        return self.game_scores.filter(game_number=self.current_game).first()

    def get_match_winner(self):
        if self.team1_sets == 2:
            return "team1"
        elif self.team2_sets == 2:
            return "team2"
        return None

    def get_or_create_current_game_score(self):
        """Return (GameScore, created) for the current game."""
        score, created = GameScore.objects.get_or_create(
            match=self,
            game_number=self.current_game,
            defaults={'team1_score': 0, 'team2_score': 0}
        )
        return score, created

    # ── Game-win check ────────────────────────────────────────────────────────

    def _check_game_won(self, t1: int, t2: int) -> bool:
        """Return True when a game is over given the current scoring format."""
        fmt = self.scoring_format
        if fmt == self.SCORING_15_NO_SET:
            return t1 >= 15 or t2 >= 15
        elif fmt == self.SCORING_15_WITH_SET:
            return (
                (t1 >= 15 and t1 - t2 >= 2) or
                (t2 >= 15 and t2 - t1 >= 2) or
                t1 == 21 or t2 == 21
            )
        elif fmt == self.SCORING_21_NO_SET:
            return t1 >= 21 or t2 >= 21
        else:  # SCORING_21_WITH_SET (default / international)
            return (
                (t1 >= 21 and t1 - t2 >= 2) or
                (t2 >= 21 and t2 - t1 >= 2) or
                t1 == 30 or t2 == 30
            )

    # ── Court state / serving logic ───────────────────────────────────────────

    def _is_doubles(self) -> bool:
        return self.match_type in (self.DOUBLES, self.MIXED_DOUBLES)

    def initialize_court_state(self, server_id: int, receiver_id: int) -> None:
        """
        Create (or reset) the DoublesCourtState for this match.

        Called when the umpire sets the first server + receiver before the
        match starts (toss result).

        BWF rule at match start:
          - Server is always in the RIGHT service court.
          - Server's partner is in the LEFT service court.
          - Receiver stands diagonally opposite the server (RIGHT court of
            their side, because score is 0 = even).
          - Receiver's partner stands in the LEFT court.

        server_id   — player who serves first (right court, their team)
        receiver_id — player who receives first (right court, opposing team)
        """
        team1_ids = {self.player1_team1_id, self.player2_team1_id}

        if server_id in team1_ids:
            serving_team = 1
            # Server is team1 right-court; partner is left-court
            t1_right = server_id
            t1_left  = (
                self.player2_team1_id
                if server_id == self.player1_team1_id
                else self.player1_team1_id
            )
            # Receiver is team2 right-court; partner is left-court
            t2_right = receiver_id
            t2_left  = (
                self.player2_team2_id
                if receiver_id == self.player1_team2_id
                else self.player1_team2_id
            )
        else:
            serving_team = 2
            # Server is team2 right-court; partner is left-court
            t2_right = server_id
            t2_left  = (
                self.player2_team2_id
                if server_id == self.player1_team2_id
                else self.player1_team2_id
            )
            # Receiver is team1 right-court; partner is left-court
            t1_right = receiver_id
            t1_left  = (
                self.player2_team1_id
                if receiver_id == self.player1_team1_id
                else self.player1_team1_id
            )

        DoublesCourtState.objects.update_or_create(
            match=self,
            defaults={
                'team1_right_id': t1_right,
                'team1_left_id':  t1_left,
                'team2_right_id': t2_right,
                'team2_left_id':  t2_left,
                'server_id':      server_id,
                'receiver_id':    receiver_id,
                'serving_team':   serving_team,
            }
        )

        # Keep Match.server in sync
        Match.objects.filter(pk=self.pk).update(server_id=server_id)
        self.server_id = server_id

        print(
            f"[court_state] initialized | "
            f"server={server_id} receiver={receiver_id} "
            f"T1 right={t1_right} left={t1_left} "
            f"T2 right={t2_right} left={t2_left}"
        )

    def update_court_state(self, team_scored: int, t1: int, t2: int) -> int:
        """
        Update DoublesCourtState after every point and return new server_id.

        BWF doubles rules:
        ─────────────────
        Serving team scores
          → Same server continues.
          → Server swaps court with their partner (they earned a point so
            they switch sides within their half).
          → Receiving team does NOT move.

        Receiving team scores
          → Service transfers to the team that just scored.
          → No court position swap happens at the moment of service change.
          → New server = player currently in the correct service court of
            the newly serving team, determined by score parity:
              Even score → right-court player serves
              Odd score  → left-court player serves
          → New receiver = player currently in the correct service court of
            the newly receiving team, determined by THEIR score parity:
              Even score → right-court player receives
              Odd score  → left-court player receives

        Returns the new server_id (also updates Match.server).
        Falls back to Match.server_id if no court state exists (safety net).
        """
        try:
            cs = DoublesCourtState.objects.get(match=self)
        except DoublesCourtState.DoesNotExist:
            # No court state initialised — doubles match started without
            # the umpire setting server+receiver. Return current server as-is.
            print(
                f"[court_state] WARNING: no DoublesCourtState for match {self.pk}. "
                f"Cannot auto-update server. Please set server via UmpirePanel."
            )
            return self.server_id

        if team_scored == cs.serving_team:
            # ── Serving team scored → same server, swap courts ────────────────
            if cs.serving_team == 1:
                # Team 1 (serving) players swap; team 2 stays put
                new_t1_right = cs.team1_left_id
                new_t1_left  = cs.team1_right_id
                new_t2_right = cs.team2_right_id
                new_t2_left  = cs.team2_left_id
            else:
                # Team 2 (serving) players swap; team 1 stays put
                new_t1_right = cs.team1_right_id
                new_t1_left  = cs.team1_left_id
                new_t2_right = cs.team2_left_id
                new_t2_left  = cs.team2_right_id

            new_server_id   = cs.server_id    # same server continues
            new_receiver_id = cs.receiver_id  # same receiver
            new_serving_team = cs.serving_team

            print(
                f"[court_state] team{team_scored} scored (serving) | "
                f"server unchanged={new_server_id} | "
                f"T1 right={new_t1_right} left={new_t1_left} | "
                f"T2 right={new_t2_right} left={new_t2_left}"
            )

        else:
            # ── Receiving team scored → service transfers ─────────────────────
            # Positions do NOT change on service transfer — players stay where
            # they are. The new server is just whoever is in the correct court.
            new_t1_right = cs.team1_right_id
            new_t1_left  = cs.team1_left_id
            new_t2_right = cs.team2_right_id
            new_t2_left  = cs.team2_left_id

            new_serving_team = team_scored
            new_score        = t1 if team_scored == 1 else t2
            recv_score       = t2 if team_scored == 1 else t1

            if new_serving_team == 1:
                # Team 1 now serves — pick server by team 1's score parity
                new_server_id = (
                    new_t1_right if new_score % 2 == 0 else new_t1_left
                )
                # Team 2 now receives — pick receiver by team 2's score parity
                new_receiver_id = (
                    new_t2_right if recv_score % 2 == 0 else new_t2_left
                )
            else:
                # Team 2 now serves — pick server by team 2's score parity
                new_server_id = (
                    new_t2_right if new_score % 2 == 0 else new_t2_left
                )
                # Team 1 now receives — pick receiver by team 1's score parity
                new_receiver_id = (
                    new_t1_right if recv_score % 2 == 0 else new_t1_left
                )

            print(
                f"[court_state] team{team_scored} scored (receiving→serving) | "
                f"new server={new_server_id} new receiver={new_receiver_id} | "
                f"score parity={new_score % 2} ({'odd→left' if new_score % 2 else 'even→right'})"
            )

        # ── Persist updated court state ───────────────────────────────────────
        DoublesCourtState.objects.filter(match=self).update(
            team1_right_id  = new_t1_right,
            team1_left_id   = new_t1_left,
            team2_right_id  = new_t2_right,
            team2_left_id   = new_t2_left,
            server_id       = new_server_id,
            receiver_id     = new_receiver_id,
            serving_team    = new_serving_team,
        )

        # Keep Match.server in sync so all existing queries still work
        Match.objects.filter(pk=self.pk).update(server_id=new_server_id)
        self.server_id = new_server_id

        return new_server_id

    # ── apply_point ───────────────────────────────────────────────────────────

    def apply_point(self, team: int) -> dict:
        """
        Add one point to `team` (1 or 2) for the current game.
        Handles game-win detection, set counting, match completion, and
        automatic server/court-state updates.

        This is the SINGLE source of truth for scoring logic — never
        replicate this in the frontend.
        """
        if self.status == 'Completed':
            raise ValidationError("Match is already completed.")
        if team not in (1, 2):
            raise ValueError("team must be 1 or 2")

        score, _ = self.get_or_create_current_game_score()

        if team == 1:
            score.team1_score += 1
        else:
            score.team2_score += 1
        score.save()

        result = {
            'action':        'point',
            'team':          team,
            'game_number':   self.current_game,
            'team1_score':   score.team1_score,
            'team2_score':   score.team2_score,
            'team1_sets':    self.team1_sets,
            'team2_sets':    self.team2_sets,
            'current_game':  self.current_game,
            'status':        self.status,
            'game_won':      False,
            'match_won':     False,
            'winner':        None,
            'scoring_format': self.scoring_format,
        }

        # ── Check for game win ────────────────────────────────────────────────
        t1, t2 = score.team1_score, score.team2_score
        game_won = self._check_game_won(t1, t2)

        if game_won:
            result['game_won'] = True
            if t1 > t2:
                self.team1_sets += 1
                result['game_winner'] = 1
            else:
                self.team2_sets += 1
                result['game_winner'] = 2

            result['team1_sets'] = self.team1_sets
            result['team2_sets'] = self.team2_sets

            # Check match win (best of 3)
            if self.team1_sets == 2 or self.team2_sets == 2:
                self.status = 'Completed'
                result['match_won'] = True
                result['winner']    = 1 if self.team1_sets == 2 else 2
                result['status']    = 'Completed'
            else:
                # Advance to next game
                self.current_game += 1
                result['current_game'] = self.current_game
                # Pre-create the next game score record
                GameScore.objects.get_or_create(
                    match=self,
                    game_number=self.current_game,
                    defaults={'team1_score': 0, 'team2_score': 0}
                )

            # Save match state (bypass full_clean — cross-field validators
            # are already enforced at creation time)
            Match.objects.filter(pk=self.pk).update(
                team1_sets=self.team1_sets,
                team2_sets=self.team2_sets,
                current_game=self.current_game,
                status=self.status,
            )

            # Manually fire the bracket advance signal (.update() bypasses signals)
            if self.status == 'Completed':
                from django.db.models.signals import post_save
                self.refresh_from_db()
                post_save.send(sender=self.__class__, instance=self, created=False)

        # ── Auto-update server / court state (runs on EVERY point) ───────────
        # Only runs once an initial server has been set by the umpire.
        # For doubles: full BWF court-state update via DoublesCourtState.
        # For singles: winner always serves — simple player swap.
        if self.server_id is not None:
            if self._is_doubles():
                # update_court_state handles all BWF position + server logic
                # and also keeps Match.server_id in sync
                self.update_court_state(
                    team_scored=team,
                    t1=score.team1_score,
                    t2=score.team2_score,
                )
            else:
                # Singles — winner serves, no position tracking needed
                new_server_id = (
                    self.player1_team1_id if team == 1
                    else self.player1_team2_id
                )
                if new_server_id != self.server_id:
                    Match.objects.filter(pk=self.pk).update(server_id=new_server_id)
                    self.server_id = new_server_id
                    print(f"[apply_point] singles server → {new_server_id}")

        result['server_id'] = self.server_id
        return result

    # ── undo_point ────────────────────────────────────────────────────────────

    def undo_last_point(self) -> dict:
        """
        Remove the last point from the current game.
        Only works within the current game (does not undo a game transition).
        """
        if self.status == 'Completed':
            raise ValidationError("Cannot undo a completed match.")

        score = self.get_current_game_score()
        if not score:
            raise ValidationError("No score to undo.")
        if score.team1_score == 0 and score.team2_score == 0:
            raise ValidationError("Score is already 0-0 for this game.")

        raise ValidationError(
            "Undo requires last_team context. Use undo_point(team) instead."
        )

    def undo_point(self, team: int) -> dict:
        """Undo the last point for the given team in the current game."""
        if self.status == 'Completed':
            raise ValidationError("Cannot undo in a completed match.")

        score, _ = self.get_or_create_current_game_score()

        if team == 1:
            if score.team1_score <= 0:
                raise ValidationError("Team 1 score is already 0.")
            score.team1_score -= 1
        else:
            if score.team2_score <= 0:
                raise ValidationError("Team 2 score is already 0.")
            score.team2_score -= 1

        score.save()

        return {
            'action':       'undo',
            'game_number':  self.current_game,
            'team1_score':  score.team1_score,
            'team2_score':  score.team2_score,
            'team1_sets':   self.team1_sets,
            'team2_sets':   self.team2_sets,
            'current_game': self.current_game,
            'status':       self.status,
        }

    # ── set_server ────────────────────────────────────────────────────────────

    def set_server(self, player_id: int, receiver_id: int = None) -> dict:
        """
        Set the serving player (and receiver for doubles).

        For singles: only player_id is needed.
        For doubles: both player_id (server) and receiver_id are required.
          This call also initialises the DoublesCourtState so that all
          subsequent points can use full BWF position tracking.

        Raises ValidationError if either player is not part of this match,
        or if receiver_id is missing for a doubles match.
        """
        valid_ids = [
            p.id for p in [
                self.player1_team1, self.player2_team1,
                self.player1_team2, self.player2_team2,
            ] if p is not None
        ]

        if player_id not in valid_ids:
            raise ValidationError("Server player is not part of this match.")

        if self._is_doubles():
            if not receiver_id:
                raise ValidationError(
                    "receiver_id is required for doubles/mixed-doubles matches."
                )
            if receiver_id not in valid_ids:
                raise ValidationError("Receiver player is not part of this match.")

            # Validate server and receiver are on opposite teams
            team1_ids = {self.player1_team1_id, self.player2_team1_id}
            server_team   = 1 if player_id   in team1_ids else 2
            receiver_team = 1 if receiver_id in team1_ids else 2
            if server_team == receiver_team:
                raise ValidationError(
                    "Server and receiver must be on opposite teams."
                )

            # Initialise court state — this also updates Match.server_id
            self.initialize_court_state(player_id, receiver_id)
        else:
            # Singles — just update the server
            Match.objects.filter(pk=self.pk).update(server_id=player_id)
            self.server_id = player_id

        return {
            'action':      'server_change',
            'server_id':   player_id,
            'receiver_id': receiver_id,
        }

    # ── dunder / meta ─────────────────────────────────────────────────────────

    def __str__(self):
        if self.match_type == self.SINGLE:
            return f"{self.tournament} - {self.player1_team1.name} vs {self.player1_team2.name}"
        team1 = [self.player1_team1.name]
        if self.player2_team1:
            team1.append(self.player2_team1.name)
        team2 = [self.player1_team2.name]
        if self.player2_team2:
            team2.append(self.player2_team2.name)
        return f"{self.tournament} - {', '.join(team1)} vs {', '.join(team2)}"

    def clean(self):
        if not self.player1_team1_id or not self.player1_team2_id:
            raise ValidationError("player1_team1 and player1_team2 are required.")
        if self.player1_team1_id == self.player1_team2_id:
            raise ValidationError("player1_team1 and player1_team2 must be different.")
        if self.match_type in [self.DOUBLES, self.MIXED_DOUBLES]:
            if not self.player2_team1_id or not self.player2_team2_id:
                raise ValidationError("Doubles matches require player2_team1 and player2_team2.")
        else:
            if self.player2_team1_id or self.player2_team2_id:
                raise ValidationError("Singles matches should not have second players.")
        if self.umpire_pin and (not self.umpire_pin.isdigit() or len(self.umpire_pin) != 4):
            raise ValidationError("umpire_pin must be exactly 4 digits.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name_plural = "Matches"
        ordering = ['scheduled_time']
        indexes = [models.Index(fields=['tournament', 'scheduled_time'])]
        constraints = [
            models.UniqueConstraint(
                fields=['tournament', 'player1_team1', 'player1_team2', 'scheduled_time'],
                name='unique_match'
            )
        ]


# ─────────────────────────────────────────────────────────────────────────────
# DoublesCourtState
# ─────────────────────────────────────────────────────────────────────────────

class DoublesCourtState(models.Model):
    """
    Live court-position tracker for doubles and mixed-doubles matches.

    One row per match. Created/reset when the umpire calls set_server() at
    the start of each game. Updated on every single point via
    Match.update_court_state().

    Positions:
      team1_right / team1_left  — current court positions for team 1
      team2_right / team2_left  — current court positions for team 2

    server   — player currently serving
    receiver — player currently receiving (diagonal to server)
    serving_team — 1 or 2, which team holds service right now

    Why a separate table?
      Court positions change on every point (serving team swaps after scoring).
      Storing this in the Match model would add 6 extra FK fields and make the
      Match row much noisier. A OneToOne table keeps Match clean and makes the
      position state easy to read, update, and reset per game.
    """

    match = models.OneToOneField(
        Match,
        on_delete=models.CASCADE,
        related_name='court_state'
    )

    # ── Team 1 positions ──────────────────────────────────────────────────────
    team1_right = models.ForeignKey(
        Player, on_delete=models.PROTECT,
        related_name='court_state_t1_right',
        help_text="Team 1 player currently in the RIGHT service court"
    )
    team1_left = models.ForeignKey(
        Player, on_delete=models.PROTECT,
        related_name='court_state_t1_left',
        help_text="Team 1 player currently in the LEFT service court"
    )

    # ── Team 2 positions ──────────────────────────────────────────────────────
    team2_right = models.ForeignKey(
        Player, on_delete=models.PROTECT,
        related_name='court_state_t2_right',
        help_text="Team 2 player currently in the RIGHT service court"
    )
    team2_left = models.ForeignKey(
        Player, on_delete=models.PROTECT,
        related_name='court_state_t2_left',
        help_text="Team 2 player currently in the LEFT service court"
    )

    # ── Service state ─────────────────────────────────────────────────────────
    server = models.ForeignKey(
        Player, on_delete=models.PROTECT,
        related_name='court_state_serving',
        help_text="Player currently serving"
    )
    receiver = models.ForeignKey(
        Player, on_delete=models.PROTECT,
        related_name='court_state_receiving',
        help_text="Player currently receiving"
    )
    serving_team = models.IntegerField(
        choices=[(1, 'Team 1'), (2, 'Team 2')],
        help_text="Which team currently holds service"
    )

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return (
            f"CourtState Match#{self.match_id} | "
            f"Server: {self.server.name} | "
            f"Receiver: {self.receiver.name} | "
            f"T1 [{self.team1_right.name}R / {self.team1_left.name}L] | "
            f"T2 [{self.team2_right.name}R / {self.team2_left.name}L]"
        )

    class Meta:
        verbose_name = "Doubles Court State"
        verbose_name_plural = "Doubles Court States"


# ─────────────────────────────────────────────────────────────────────────────
# GameScore
# ─────────────────────────────────────────────────────────────────────────────

class GameScore(models.Model):
    match = models.ForeignKey(
        Match, on_delete=models.CASCADE, related_name='game_scores'
    )
    game_number = models.IntegerField()
    team1_score = models.IntegerField(default=0)
    team2_score = models.IntegerField(default=0)

    def clean(self):
        if self.team1_score < 0 or self.team2_score < 0:
            raise ValidationError("Scores cannot be negative.")
        if self.team1_score > 30 or self.team2_score > 30:
            raise ValidationError("Badminton scores cannot exceed 30.")

    def __str__(self):
        return f"Match {self.match.id} - Game {self.game_number}: {self.team1_score}-{self.team2_score}"

    class Meta:
        unique_together = ('match', 'game_number')
        ordering = ['match', 'game_number']
        verbose_name = "Game Score"
        verbose_name_plural = "Game Scores"