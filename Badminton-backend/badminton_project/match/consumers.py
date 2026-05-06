# match/consumers.py
# Change from previous version:
#   - imports verify_token from token_auth (not views)
#   - added detailed debug logging in connect() so the exact
#     failure reason is visible in the Daphne terminal
print(">>> consumers.py LOADED <<<")
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .models import Match, GameScore
from .token_auth import verify_token   # ← changed import

logger = logging.getLogger(__name__)


class MatchConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.match_id   = int(self.scope['url_route']['kwargs']['match_id'])
        self.group_name = f'match_{self.match_id}'
        self.is_umpire  = False

        # ── Token check ───────────────────────────────────────────────────────
        raw_qs       = self.scope.get('query_string', b'')
        query_string = raw_qs.decode('utf-8') if isinstance(raw_qs, bytes) else raw_qs

        logger.debug("[WS CONNECT] Match=%s | Query: %s", self.match_id, query_string)
        print(f"[WS CONNECT] Match={self.match_id} | Query: {query_string}")

        token = self._parse_token(query_string)

        if token:
            print(f"[WS] Token found, verifying for match_id={self.match_id}…")
            valid = verify_token(self.match_id, token)    # ← uses token_auth now
            print(f"[WS] Token validation result: {valid}")
            if valid:
                self.is_umpire = True
        else:
            print("[WS] No token — connecting as viewer")

        print(f"[WS] Connection accepted - Umpire: {self.is_umpire}")

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        state = await self._get_match_state()
        if state:
            await self.send(text_data=json.dumps({
                **state,
                'type':      'score_update',
                'action':    'init',
                'is_umpire': self.is_umpire,
            }))
        else:
            await self.send(text_data=json.dumps({
                'type':  'error',
                'error': f'Match {self.match_id} not found.',
            }))
            await self.close()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # ── Incoming messages ─────────────────────────────────────────────────────

    async def receive(self, text_data):
        print(f"[consumer] receive raw: {text_data}")
        print(f"[consumer] is_umpire: {self.is_umpire}")

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error("Invalid JSON.")
            return

        if not self.is_umpire:
            print("[consumer] REJECTED — not umpire")
            await self._send_error("Unauthorised. Valid umpire token required.")
            return

        action = data.get('action')
        print(f"[consumer] action: {action}")

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
            print(f"[consumer] _handle_point ERROR: {e}")
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
            print(f"[consumer] _handle_undo ERROR: {e}")
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
            print(f"[consumer] _handle_set_server ERROR: {e}")
            await self._send_error(str(e))

    async def _handle_start_match(self):
        try:
            result = await self._start_match()
            await self._broadcast(result)
        except Exception as e:
            print(f"[consumer] _handle_start_match ERROR: {e}")
            await self._send_error(str(e))

    async def _handle_end_match(self):
        try:
            result = await self._end_match()
            await self._broadcast(result)
        except Exception as e:
            print(f"[consumer] _handle_end_match ERROR: {e}")
            await self._send_error(str(e))

    # ── Database operations ───────────────────────────────────────────────────

    @database_sync_to_async
    def _get_match_state(self):
        try:
            match         = Match.objects.prefetch_related('game_scores').get(pk=self.match_id)
            current_score = match.get_current_game_score()
            return {
                'match_id':     match.id,
                'status':       match.status,
                'current_game': match.current_game,
                'team1_sets':   match.team1_sets,
                'team2_sets':   match.team2_sets,
                'game_number':  match.current_game,
                'team1_score':  current_score.team1_score if current_score else 0,
                'team2_score':  current_score.team2_score if current_score else 0,
                'server_id':    match.server_id,
                'game_won':     False,
                'match_won':    False,
                'winner':       None,
                'error':        None,
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
        print(f"[consumer] _apply_point team={team} match_id={self.match_id}")
        match  = Match.objects.prefetch_related('game_scores').get(pk=self.match_id)
        print(f"[consumer] match status={match.status}")
        result = match.apply_point(team)
        print(f"[consumer] apply_point result={result}")
        result.update(self._build_game_scores(match))
        result['server_id'] = match.server_id
        result['match_id']  = match.id
        result['error']     = None
        return result

    @database_sync_to_async
    def _undo_point(self, team: int) -> dict:
        match  = Match.objects.prefetch_related('game_scores').get(pk=self.match_id)
        result = match.undo_point(team)
        result.update(self._build_game_scores(match))
        result['server_id'] = match.server_id
        result['match_id']  = match.id
        result['error']     = None
        return result

    @database_sync_to_async
    def _set_server(self, player_id: int) -> dict:
        match  = Match.objects.get(pk=self.match_id)
        result = match.set_server(player_id)
        state  = self._build_state_snapshot(match)
        result.update(state)
        result['match_id'] = match.id
        result['error']    = None
        return result

    @database_sync_to_async
    def _start_match(self) -> dict:
        from django.core.exceptions import ValidationError
        match = Match.objects.get(pk=self.match_id)
        if match.status != 'Upcoming':
            raise ValidationError("Match is not Upcoming.")
        Match.objects.filter(pk=self.match_id).update(status='Live', current_game=1)
        match.refresh_from_db()
        GameScore.objects.get_or_create(
            match=match, game_number=1,
            defaults={'team1_score': 0, 'team2_score': 0}
        )
        return {
            'action':   'status_change',
            'match_id': match.id,
            **self._build_state_snapshot(match),
            'error':    None,
        }

    @database_sync_to_async
    def _end_match(self) -> dict:
        from django.core.exceptions import ValidationError
        match = Match.objects.get(pk=self.match_id)
        if match.status != 'Live':
            raise ValidationError("Match is not Live.")
        Match.objects.filter(pk=self.match_id).update(status='Completed')
        match.refresh_from_db()
        # Trigger bracket advance
        from django.db.models.signals import post_save
        post_save.send(sender=Match, instance=match, created=False)
        return {
            'action':   'status_change',
            'match_id': match.id,
            **self._build_state_snapshot(match),
            'error':    None,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _build_game_scores(self, match) -> dict:
        scores  = list(match.game_scores.all())
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
            'status':       match.status,
            'current_game': match.current_game,
            'team1_sets':   match.team1_sets,
            'team2_sets':   match.team2_sets,
            'game_number':  match.current_game,
            'team1_score':  current_score.team1_score if current_score else 0,
            'team2_score':  current_score.team2_score if current_score else 0,
            'server_id':    match.server_id,
            'game_won':     False,
            'match_won':    False,
            'winner':       None,
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
        """Extract token= from raw query string."""
        from urllib.parse import parse_qs, unquote
        # parse_qs handles both encoded and plain query strings
        try:
            params = parse_qs(query_string)
            values = params.get('token', [])
            if values:
                return values[0]   # parse_qs already decodes percent-encoding
        except Exception:
            pass
        return None

    async def _broadcast(self, payload: dict):
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'score_update_message',
                **payload,
            }
        )

    async def _send_error(self, message: str):
        await self.send(text_data=json.dumps({
            'type':  'error',
            'error': message,
        }))

    async def score_update_message(self, event):
        payload = {k: v for k, v in event.items() if k != 'type'}
        payload['type'] = 'score_update'
        await self.send(text_data=json.dumps(payload))