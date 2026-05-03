# match/event_views.py

from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django_filters.rest_framework import DjangoFilterBackend

from .event_models import TournamentEvent
from .event_serializers import TournamentEventSerializer


class TournamentEventViewSet(viewsets.ModelViewSet):
    """
    CRUD for tournament event categories.
    GET  /api/events/              — list all events
    GET  /api/events/?tournament=1 — filter by tournament
    POST /api/events/              — create an event
    PATCH/PUT /api/events/{id}/    — update
    DELETE    /api/events/{id}/    — delete (only if no matches linked)
    """
    queryset = TournamentEvent.objects.select_related("tournament").all()
    serializer_class       = TournamentEventSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes     = [IsAuthenticated]
    filter_backends        = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields       = ["tournament", "match_type", "format"]
    search_fields          = ["name"]
    ordering_fields        = ["name", "created_at"]
    ordering               = ["name"]

    def destroy(self, request, *args, **kwargs):
        from rest_framework.response import Response
        from rest_framework import status
        event = self.get_object()
        if event.match_count > 0:
            return Response(
                {"error": f"Cannot delete '{event.name}' — it has {event.match_count} linked match(es). "
                           "Remove or reassign those matches first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


# ── urls.py patch ─────────────────────────────────────────────────────────────
# Add these two lines to your existing match/urls.py router registrations:
#
#   from .event_views import TournamentEventViewSet
#   router.register(r'events', TournamentEventViewSet, basename='event')