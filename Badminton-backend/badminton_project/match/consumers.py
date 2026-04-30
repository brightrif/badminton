"""
match/consumers.py

WebSocket consumer for real-time match scoring.

Connection URL:
    ws://host/ws/match/<match_id>/?token=<umpire_token>

All clients (big screen viewers + umpire) connect here.
Only the umpire — identified by a valid token — may send score commands.
Everyone receives broadcasts.

Message protocol (JSON):
────────────────────────────────────────────────────────────────────────────

  CLIENT → SERVER (umpire only)
  ──────────────────────────────
  { "action": "point",  "team": 1 }          Add point for team 1
  { "action": "point",  "team": 2 }          Add point for team 2
  { "action": "undo",   "team": 1 }          Undo last point for team 1
  { "action": "undo",   "team": 2 }          Undo last point for team 2
  { "action": "set_server", "player_id": 3 } Change serving player
  { "action": "start_match" }                Transition Upcoming → Live
  { "action": "end_match" }                  Transition Live → Completed

  SERVER → ALL CLIENTS (broadcast)
  ──────────────────────────────────
  All broadcasts include the full updated score state so any client
  can re-render from a single message without needing extra fetches.

  {
    "type": "score_update",          # always present
    "action": "point" | "undo" | "server_change" | "status_change",
    "match_id": 1,
    "status": "Live",
    "current_game": 2,
    "team1_sets": 1,
    "team2_sets": 0,
    "game_number": 2,
    "team1_score": 5,
    "team2_score": 3,
    "server_id": 4,                  # null if not set
    "game_won": false,
    "match_won": false,
    "winner": null,                  # 1 or 2 if match_won
    "error": null                    # error string if something went wrong
  }

────────────────────────────────────────────────────────────────────────────
"""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .models import Match, GameScore
from .views import verify_umpire_token

logger = logging.getLogger(__name__)


class MatchConsumer(AsyncWebsocketConsumer):

    # ── Connection lifecycle ──────────────────────────────────────────────────

    async def connect(self):
        self.match_id = int(self.scope['url_route']['kwargs']['match_id'])
        self.group_name = f'match_{self.match_id}'
        self.is_umpire = False

        # Check for umpire token in query string
        query_string = self.scope.get('query_string', b'').decode()
        token = self._parse_token(query_string)
        if token and verify_umpire_token(self.match_id, token):
            self.is_umpire = True

        # Join the match channel group (all clients, umpire or viewer)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send current state immediately on connect so the client is in sync
        state = await self._get_match_state()
        if state:
            await self.send(text_data=json.dumps({
                **state,
                'type': 'score_update',
                'action': 'init',
                'is_umpire': self.is_umpire,
            }))
        else:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'error': f'Match {self.match_id} not found.',
            }))
            await self.close()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # ── Incoming messages (umpire only) ───────────────────────────────────────

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error("Invalid JSON.")
            return

        if not self.is_umpire:
            await self._send_error("Unauthorised. Valid umpire token required.")
            return

        action = data.get('action')

        if action == 'point':
            await self._handle_point(data)
        elif action == 'undo':
            await self._handle_undo(data)
        elif action == 'set_server':
            await self._handle_set_server(data)
        elif action == 'start_match':
            await self._handle_start_match()
        elif action == 'end_match':
            await self._handle_end_match()
        else:
            await self._send_error(f"Unknown action: '{action}'")

    # ── Action handlers ───────────────────────────────────────────────────────

    async def _handle_point(self, data):
        team = data.get('team')
        if team not in (1, 2):
            await self._send_error("'team' must be 1 or 2.")
            return
        try:
            result = await self._apply_point(team)
            await self._broadcast(result)
        except Exception as e:
            await self._send_error(str(e))

    async def _handle_undo(self, data):
        team = data.get('team')
        if team not in (1, 2):
            await self._send_error("'team' must be 1 or 2.")
            return
        try:
            result = await self._undo_point(team)
            await self._broadcast(result)
        except Exception as e:
            await self._send_error(str(e))

    async def _handle_set_server(self, data):
        player_id = data.get('player_id')
        if not player_id:
            await self._send_error("'player_id' is required.")
            return
        try:
            result = await self._set_server(int(player_id))
            await self._broadcast(result)
        except Exception as e:
            await self._send_error(str(e))

    async def _handle_start_match(self):
        try:
            result = await self._start_match()
            await self._broadcast(result)
        except Exception as e:
            await self._send_error(str(e))

    async def _handle_end_match(self):
        try:
            result = await self._end_match()
            await self._broadcast(result)
        except Exception as e:
            await self._send_error(str(e))

    # ── Database operations (run in thread pool) ──────────────────────────────

    @database_sync_to_async
    def _get_match_state(self):
        try:
            match = Match.objects.prefetch_related('game_scores').get(pk=self.match_id)
            current_score = match.get_current_game_score()
            return {
                'match_id': match.id,
                'status': match.status,
                'current_game': match.current_game,
                'team1_sets': match.team1_sets,
                'team2_sets': match.team2_sets,
                'game_number': match.current_game,
                'team1_score': current_score.team1_score if current_score else 0,
                'team2_score': current_score.team2_score if current_score else 0,
                'server_id': match.server_id,
                'game_won': False,
                'match_won': False,
                'winner': None,
                'error': None,
                # Full game history so big screen can show all sets
                'game_scores': [
                    {
                        'game_number': gs.game_number,
                        'team1_score': gs.team1_score,
                        'team2_score': gs.team2_score,
                    }
                    for gs in match.game_scores.all()
                ],
            }
        except Match.DoesNotExist:
            return None

    @database_sync_to_async
    def _apply_point(self, team: int) -> dict:
        match = Match.objects.prefetch_related('game_scores').get(pk=self.match_id)
        result = match.apply_point(team)
        # Attach full game history for broadcast
        result.update(self._build_game_scores(match))
        result['server_id'] = match.server_id
        result['match_id'] = match.id
        result['error'] = None
        return result

    @database_sync_to_async
    def _undo_point(self, team: int) -> dict:
        match = Match.objects.prefetch_related('game_scores').get(pk=self.match_id)
        result = match.undo_point(team)
        result.update(self._build_game_scores(match))
        result['server_id'] = match.server_id
        result['match_id'] = match.id
        result['error'] = None
        return result

    @database_sync_to_async
    def _set_server(self, player_id: int) -> dict:
        match = Match.objects.get(pk=self.match_id)
        result = match.set_server(player_id)
        state = self._build_state_snapshot(match)
        result.update(state)
        result['match_id'] = match.id
        result['error'] = None
        return result

    @database_sync_to_async
    def _start_match(self) -> dict:
        match = Match.objects.get(pk=self.match_id)
        if match.status != 'Upcoming':
            from django.core.exceptions import ValidationError
            raise ValidationError("Match is not in Upcoming status.")
        Match.objects.filter(pk=self.match_id).update(status='Live', current_game=1)
        match.refresh_from_db()
        # Ensure game 1 score record exists
        GameScore.objects.get_or_create(
            match=match, game_number=1,
            defaults={'team1_score': 0, 'team2_score': 0}
        )
        return {
            'action': 'status_change',
            'match_id': match.id,
            **self._build_state_snapshot(match),
            'error': None,
        }

    @database_sync_to_async
    def _end_match(self) -> dict:
        match = Match.objects.get(pk=self.match_id)
        if match.status != 'Live':
            from django.core.exceptions import ValidationError
            raise ValidationError("Match is not Live.")
        Match.objects.filter(pk=self.match_id).update(status='Completed')
        match.refresh_from_db()
        return {
            'action': 'status_change',
            'match_id': match.id,
            **self._build_state_snapshot(match),
            'error': None,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _build_game_scores(self, match) -> dict:
        """Attach full game score history to a result dict."""
        scores = list(match.game_scores.all())
        current = next((s for s in scores if s.game_number == match.current_game), None)
        return {
            'game_scores': [
                {
                    'game_number': gs.game_number,
                    'team1_score': gs.team1_score,
                    'team2_score': gs.team2_score,
                }
                for gs in scores
            ],
            'team1_score': current.team1_score if current else 0,
            'team2_score': current.team2_score if current else 0,
        }

    def _build_state_snapshot(self, match) -> dict:
        match.refresh_from_db()
        current_score = match.get_current_game_score()
        return {
            'status': match.status,
            'current_game': match.current_game,
            'team1_sets': match.team1_sets,
            'team2_sets': match.team2_sets,
            'game_number': match.current_game,
            'team1_score': current_score.team1_score if current_score else 0,
            'team2_score': current_score.team2_score if current_score else 0,
            'server_id': match.server_id,
            'game_won': False,
            'match_won': False,
            'winner': None,
            'game_scores': [
                {
                    'game_number': gs.game_number,
                    'team1_score': gs.team1_score,
                    'team2_score': gs.team2_score,
                }
                for gs in match.game_scores.all()
            ],
        }

    def _parse_token(self, query_string: str) -> str | None:
        """Extract token= from query string. e.g. '?token=abc:123:def'"""
        for part in query_string.lstrip('?').split('&'):
            if part.startswith('token='):
                return part[len('token='):]
        return None

    async def _broadcast(self, payload: dict):
        """Send payload to all clients in the match group."""
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'score_update_message',   # maps to score_update_message() below
                **payload,
            }
        )

    async def _send_error(self, message: str):
        """Send an error only to this connection (not broadcast)."""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'error': message,
        }))

    # ── Channel layer event handlers (receive from group) ─────────────────────

    async def score_update_message(self, event):
        """
        Called when any member of the group calls group_send with
        type='score_update_message'. Forward to this WebSocket connection.
        """
        # Remove the internal 'type' key before sending to client
        payload = {k: v for k, v in event.items() if k != 'type'}
        payload['type'] = 'score_update'
        await self.send(text_data=json.dumps(payload))