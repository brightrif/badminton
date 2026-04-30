from django.db import models
from django.core.exceptions import ValidationError
import random


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
    court_type = models.CharField(max_length=20, choices=COURT_TYPE_CHOICES, default='INDOOR')
    surface_type = models.CharField(max_length=20, choices=SURFACE_TYPE_CHOICES, default='WOOD')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.venue.name} - {self.name}"

    class Meta:
        unique_together = ['venue', 'name']
        ordering = ['venue', 'name']


# ─── Fix: use name-based path so new players don't get id=None ───────────────
def player_photo_path(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower()
    # Use name slug; will be overwritten on rename but avoids None
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

    # ── NEW: umpire PIN ───────────────────────────────────────────────────────
    umpire_pin = models.CharField(
        max_length=4,
        default=generate_pin,       # auto-generate on creation
        help_text="4-digit PIN for umpire access. Set in admin before match day."
    )
    # ─────────────────────────────────────────────────────────────────────────

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

    def apply_point(self, team: int) -> dict:
        """
        Add one point to `team` (1 or 2) for the current game.
        Handles game-win detection, set counting, and match completion.
        Returns a dict describing what happened so the consumer can broadcast it.

        This is the SINGLE source of truth for scoring logic — never replicate
        this in the frontend.
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
            'action': 'point',
            'team': team,
            'game_number': self.current_game,
            'team1_score': score.team1_score,
            'team2_score': score.team2_score,
            'team1_sets': self.team1_sets,
            'team2_sets': self.team2_sets,
            'current_game': self.current_game,
            'status': self.status,
            'game_won': False,
            'match_won': False,
            'winner': None,
        }

        # Check for game win
        t1, t2 = score.team1_score, score.team2_score
        game_won = (
            (t1 >= 21 and t1 - t2 >= 2) or
            (t2 >= 21 and t2 - t1 >= 2) or
            t1 == 30 or t2 == 30
        )

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
                result['winner'] = 1 if self.team1_sets == 2 else 2
                result['status'] = 'Completed'
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

            # Save without full_clean so we skip the cross-field validators
            # that are already enforced at creation time
            Match.objects.filter(pk=self.pk).update(
                team1_sets=self.team1_sets,
                team2_sets=self.team2_sets,
                current_game=self.current_game,
                status=self.status,
            )

        return result

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

        # We store the last point team in the broadcast — here we just reduce
        # whichever side is ahead, or team1 if equal (edge case)
        # For accurate undo, the consumer should track last-point-team and pass it.
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
            'action': 'undo',
            'game_number': self.current_game,
            'team1_score': score.team1_score,
            'team2_score': score.team2_score,
            'team1_sets': self.team1_sets,
            'team2_sets': self.team2_sets,
            'current_game': self.current_game,
            'status': self.status,
        }

    def set_server(self, player_id: int) -> dict:
        """Set the serving player by ID. Must be a player in this match."""
        valid_ids = [
            p.id for p in [
                self.player1_team1, self.player2_team1,
                self.player1_team2, self.player2_team2
            ] if p is not None
        ]
        if player_id not in valid_ids:
            raise ValidationError("Player is not part of this match.")

        Match.objects.filter(pk=self.pk).update(server_id=player_id)
        self.server_id = player_id

        return {
            'action': 'server_change',
            'server_id': player_id,
        }

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
        # Only run cross-field validation — not called on every .save()
        # because update() bypasses full_clean intentionally.
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