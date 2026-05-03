# match/event_models.py
#
# TournamentEvent — a named category that groups matches.
# Purpose: pre-fills match_type when director creates a match.
# No bracket engine, no calculations. Director feeds everything manually.

from django.db import models
from .models import Tournament


class TournamentEvent(models.Model):

    FORMAT_CHOICES = [
        ("KNOCKOUT",    "Knockout"),
        ("ROUND_ROBIN", "Round Robin"),
        ("",            "Not set"),
    ]

    MATCH_TYPE_CHOICES = [
        ("SINGLE",        "Singles"),
        ("DOUBLES",       "Doubles"),
        ("MIXED_DOUBLES", "Mixed Doubles"),
    ]

    tournament  = models.ForeignKey(
        Tournament, on_delete=models.CASCADE, related_name="events"
    )
    # e.g. "MD Level 1", "WD Level 2 (F3 & F4)", "XD Championship"
    name        = models.CharField(max_length=120)
    # Pre-fills match creation form
    match_type  = models.CharField(max_length=20, choices=MATCH_TYPE_CHOICES, default="SINGLE")
    # Informational only — director sets for their reference
    format      = models.CharField(max_length=20, choices=FORMAT_CHOICES, blank=True, default="")
    # Optional stage label shown in match list, e.g. "Quarter Final"
    round_label = models.CharField(max_length=80, blank=True, default="")

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering        = ["tournament", "name"]
        unique_together = [("tournament", "name")]

    def __str__(self):
        return f"{self.tournament.name} — {self.name}"

    @property
    def match_count(self):
        return self.matches.count()

    @property
    def upcoming_count(self):
        return self.matches.filter(status="Upcoming").count()

    @property
    def live_count(self):
        return self.matches.filter(status="Live").count()

    @property
    def completed_count(self):
        return self.matches.filter(status="Completed").count()