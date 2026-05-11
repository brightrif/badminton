# match/court_consumer.py

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class CourtConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.slug = self.scope['url_route']['kwargs']['slug']
        self.group_name = f'court_{self.slug}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send current state immediately so reconnecting screens are in sync
        state = await self._get_court_state()
        if state:
            await self.send(text_data=json.dumps({
                'type':         'break_mode',
                'active':       state['break_mode'],
                'display_mode': state['break_display_mode'],   # ← "sponsors" | "video"
                'video_url':    state['break_video_url'],
                'tournament_name': state.get('tournament_name', ''),
                'sponsors':     state.get('sponsors', []),
            }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass  # viewer-only

    async def break_mode_message(self, event):
        """Forward director broadcast to the court screen WebSocket."""
        await self.send(text_data=json.dumps({
            'type':         'break_mode',
            'active':       event.get('active', False),
            'display_mode': event.get('display_mode', 'sponsors'),
            'video_url':    event.get('video_url', ''),
            'tournament_name': event.get('tournament_name', ''),
            'sponsors':     event.get('sponsors', []),
        }))

    @database_sync_to_async
    def _get_court_state(self):
        try:
            from .models import Court, Sponsor

            court = Court.objects.select_related('venue').get(slug=self.slug)

            video_url = ''
            if court.break_video:
                video_url = f"http://localhost:8000{court.break_video.url}"

            tournament_name = ''
            sponsors = []

            ref_match = (
                court.matches.filter(status='Live').order_by('-scheduled_time').first()
                or court.matches.filter(status='Upcoming').order_by('scheduled_time').first()
                or court.matches.filter(status='Completed').order_by('-scheduled_time').first()
            )

            if ref_match and ref_match.tournament:
                tournament_name = ref_match.tournament.name
                for s in Sponsor.objects.filter(tournament=ref_match.tournament).order_by('-priority'):
                    sponsors.append({
                        'id':       s.id,
                        'name':     s.name,
                        'priority': s.priority,
                        'logo_url': f"http://localhost:8000{s.logo.url}" if s.logo else '',
                    })

            return {
                'break_mode':         court.break_mode,
                'break_display_mode': court.break_display_mode,
                'break_video_url':    video_url,
                'tournament_name':    tournament_name,
                'sponsors':           sponsors,
            }
        except Exception as e:
            logger.error("[CourtConsumer] _get_court_state error: %s", e)
            return None