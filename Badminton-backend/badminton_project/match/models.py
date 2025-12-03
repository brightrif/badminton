from django.db import models
from django.core.exceptions import ValidationError

class Country(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=3, unique=True)
    flag_url = models.URLField(blank=True, help_text="URL to country flag image")

    def __str__(self):
        return self.name

# Venue model to represent badminton venues
class Venue(models.Model):
    name = models.CharField(max_length=200)
    address = models.TextField()
    city = models.CharField(max_length=100)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='venues')
    
    # Contact and facility info
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    
    # Capacity and facilities
    total_courts = models.PositiveIntegerField(default=1)
    has_parking = models.BooleanField(default=False)
    has_cafeteria = models.BooleanField(default=False)
    has_livestream = models.BooleanField(default=False)
    
    # GPS coordinates for mapping
    #latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    #longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
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

# Venue model ends here 

# Tournament model to represent badminton tournaments
# TournamentVenue model to represent the many-to-many relationship between Tournaments and Venues
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
# Tournament model ends here

# TournamentVenue model to represent the many-to-many relationship between Tournaments and Venues
class TournamentVenue(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='tournament_venues')
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='tournament_venues')
    start_date = models.DateField(null=True, blank=True, help_text="Start date for this venue in the tournament")
    end_date = models.DateField(null=True, blank=True, help_text="End date for this venue in the tournament")

    def __str__(self):
        return f"{self.tournament.name} at {self.venue.name}"

    class Meta:
        unique_together = ['tournament', 'venue']
        verbose_name = "Tournament Venue"
        verbose_name_plural = "Tournament Venues"
# TournamentVenue model ends here

# Court model to represent badminton courts within a venue
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
    name = models.CharField(max_length=100)  # e.g., "Court 1", "Center Court", "Stadium Court"
    court_type = models.CharField(max_length=20, choices=COURT_TYPE_CHOICES, default='INDOOR')
    surface_type = models.CharField(max_length=20, choices=SURFACE_TYPE_CHOICES, default='WOOD')
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.venue.name} - {self.name}"

    class Meta:
        unique_together = ['venue', 'name']
        ordering = ['venue', 'name']
# Court model ends here
##########################################################################################
# Player model to represent badminton players

def player_photo_path(instance, filename):
    # media/players/<player_id>/photo.jpg
    ext = filename.split('.')[-1]
    return f'players/{instance.id}/photo.{ext}'

class Player(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='players')
    # NEW – local file
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

###################################################################################################
# Sponsor model to represent tournament sponsors

def sponsor_logo_path(instance, filename):
    # media/sponsors/<sponsor_id>/logo.png
    ext = filename.split('.')[-1]
    return f'sponsors/{instance.id}/logo.{ext}'


class Sponsor(models.Model):
    name = models.CharField(max_length=100)
    logo = models.ImageField(
        upload_to=sponsor_logo_path,
        blank=True,
        null=True,
        help_text="Upload sponsor logo (optional)"
    )
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='sponsors', null=True, blank=True)
    priority = models.IntegerField(default=0, help_text="Higher priority sponsors appear first")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        unique_together = ['name', 'tournament']

###########################################################################################################
class Match(models.Model):
    SINGLE = 'SINGLE'
    DOUBLES = 'DOUBLES'
    MIXED_DOUBLES = 'MIXED_DOUBLES'

    MATCH_TYPE_CHOICES = [
        (SINGLE, 'Single'),
        (DOUBLES, 'Doubles'),
        (MIXED_DOUBLES, 'Mixed Doubles'),
    ]

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='matches')
    match_type = models.CharField(max_length=20, choices=MATCH_TYPE_CHOICES)
    player1_team1 = models.ForeignKey(Player, related_name='matches_as_player1_team1', on_delete=models.PROTECT)
    player2_team1 = models.ForeignKey(Player, related_name='matches_as_player2_team1', on_delete=models.SET_NULL, null=True, blank=True)
    player1_team2 = models.ForeignKey(Player, related_name='matches_as_player1_team2', on_delete=models.PROTECT)
    player2_team2 = models.ForeignKey(Player, related_name='matches_as_player2_team2', on_delete=models.SET_NULL, null=True, blank=True)
    scheduled_time = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, 
                              choices=[('Live', 'Live'), ('Completed', 'Completed'), ('Upcoming', 'Upcoming')], 
                              default='Upcoming')
    server = models.ForeignKey(
        Player,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='serving_matches'
    )
     # Overall match state
    current_game = models.IntegerField(default=1)
    team1_sets = models.IntegerField(default=0)
    team2_sets = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    venue = models.ForeignKey(
        Venue, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='matches'
    )
    court = models.ForeignKey(
        Court, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='matches'
    )

        # In Match model
    def get_current_game_score(self):
        return self.game_scores.filter(game_number=self.current_game).first()

    def get_match_winner(self):
        if self.team1_sets == 2:
            return "team1"
        elif self.team2_sets == 2:
            return "team2"
        return None


    def __str__(self):
        # Dynamically build __str__ based on match type for clarity
        if self.match_type == self.SINGLE:
            return f"{self.tournament} - {self.player1_team1.name} vs {self.player1_team2.name}"
        elif self.match_type == self.DOUBLES or self.match_type == self.MIXED_DOUBLES:
            team1_names = [self.player1_team1.name]
            if self.player2_team1:
                team1_names.append(self.player2_team1.name)

            team2_names = [self.player1_team2.name]
            if self.player2_team2:
                team2_names.append(self.player2_team2.name)

            return (
                f"{self.tournament} - {', '.join(team1_names)} "
                f"vs {', '.join(team2_names)}"
            )
        return f"{self.tournament} - Match ID: {self.id}" # Fallback

    def clean(self):
        if not self.player1_team1 or not self.player1_team2:
            raise ValidationError("player1_team1 and player1_team2 are required for all matches.")
        if self.player1_team1 == self.player1_team2:
            raise ValidationError("player1_team1 and player1_team2 must be different.")
        if self.match_type in [self.DOUBLES, self.MIXED_DOUBLES]:
            if not self.player2_team1 or not self.player2_team2:
                raise ValidationError("Doubles matches require player2_team1 and player2_team2.")
            players = [self.player1_team1, self.player1_team2, self.player2_team1, self.player2_team2]
            if len(set(player.id for player in players if player)) != len([p for p in players if p]):
                raise ValidationError("All players in a doubles match must be unique.")
        else:  # SINGLE
            if self.player2_team1 or self.player2_team2:
                raise ValidationError("Singles matches should not have player2_team1 or player2_team2.")
        if self.server and self.server not in [self.player1_team1, self.player1_team2, self.player2_team1, self.player2_team2]:
            raise ValidationError("Server must be one of the match players.")
        if self.current_game < 1 or self.current_game > 3:
            raise ValidationError("current_game must be between 1 and 3.")
        
        if self.team1_sets < 0 or self.team1_sets > 2 or self.team2_sets < 0 or self.team2_sets > 2:
            raise ValidationError("Set counts must be between 0 and 2.")
        super().clean()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name_plural = "Matches"
        ordering = ['scheduled_time']
        indexes = [
            models.Index(fields=['tournament', 'scheduled_time']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['tournament', 'player1_team1', 'player1_team2', 'scheduled_time'],
                name='unique_match'
            )
        ]
    
#####################################################################################################
class GameScore(models.Model):
    match = models.ForeignKey(
        Match, on_delete=models.CASCADE, related_name='game_scores',
        help_text="The match this game score belongs to."
    )
    game_number = models.IntegerField(
        help_text="The sequential number of the game (e.g., 1 for Game 1, 2 for Game 2)."
    )
    team1_score = models.IntegerField(default=0)
    team2_score = models.IntegerField(default=0)

    class Meta:
        # Ensures that for a given match, there's only one score record per game number
        unique_together = ('match', 'game_number')
        ordering = ['match', 'game_number']
        verbose_name = "Game Score"
        verbose_name_plural = "Game Scores"

    def __str__(self):
        return f"Match {self.match.id} - Game {self.game_number}: {self.team1_score}-{self.team2_score}"
    
    # In GameScore model
    def clean(self):
        if self.team1_score < 0 or self.team2_score < 0:
            raise ValidationError("Scores cannot be negative")
        if self.team1_score > 30 or self.team2_score > 30:
            raise ValidationError("Badminton scores cannot exceed 30")