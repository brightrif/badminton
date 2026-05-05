from django.contrib import admin
from django.utils.html import format_html
from .models import Tournament, Player,Sponsor,Match # Import your models here
from .event_models import TournamentEvent
from .event_registration import EventRegistration
from .doubles_team import DoublesTeam
from .bracket import BracketMatch
# Register your models here.
admin.site.site_header = "Badminton Tournament Management"
admin.site.site_title = "Badminton Admin"  
admin.site.register (
    [
        # Add your models here
        # Example: Player, Tournament, Match, etc.
         Tournament,
         Match,TournamentEvent,EventRegistration
    ]
)

@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ('name', 'country', 'photo')
    readonly_fields = ('photo_preview',)

    def photo_preview(self, obj):
        if obj.photo:
            return format_html('<img src="{}" style="max-height:80px;"/>', obj.photo.url)
        return "(no photo)"
    photo_preview.short_description = "Preview"

@admin.register(Sponsor)
class SponsorAdmin(admin.ModelAdmin):
    list_display = ('name', 'tournament', 'logo')
    readonly_fields = ('logo_preview',)

    def logo_preview(self, obj):
        if obj.logo:
            return format_html('<img src="{}" style="max-height:60px;"/>', obj.logo.url)
        return "(no logo)"
    logo_preview.short_description = "Preview"
@admin.register(DoublesTeam)
class DoublesTeamAdmin(admin.ModelAdmin):
    list_display  = ('name', 'event', 'player1', 'player2', 'created_at')
    list_filter   = ('event',)
    search_fields = ('name', 'player1__name', 'player2__name')
 
 
@admin.register(BracketMatch)
class BracketMatchAdmin(admin.ModelAdmin):
    list_display  = ('__str__', 'event', 'round_number', 'position', 'is_bye', 'match')
    list_filter   = ('event', 'round_number', 'is_bye')
    readonly_fields = ('feeds_into', 'feeds_as_slot', 'winner_entry', 'winner_player')