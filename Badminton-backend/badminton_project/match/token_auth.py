# match/token_auth.py
#
# Isolated module for umpire token creation and verification.
# Keeping this separate from views.py makes it easy to test independently.
#
# Token format:  <match_id>:<timestamp>:<hmac_hex>
# HMAC key:      Django SECRET_KEY (loaded once at import time)
# Algorithm:     SHA-256
# TTL:           12 hours

import hmac
import hashlib
import time
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

TOKEN_TTL_SECONDS = 60 * 60 * 12  # 12 hours


def _get_secret() -> bytes:
    """Return the HMAC signing key as bytes."""
    key = settings.SECRET_KEY          # always loaded from Django settings
    return key.encode('utf-8')


def make_token(match_id: int) -> str:
    """
    Create a signed token for umpire access to `match_id`.

    Returns a string of the form:
        "<match_id>:<unix_timestamp>:<sha256_hex>"
    """
    ts      = int(time.time())
    payload = f"{match_id}:{ts}"
    sig     = hmac.new(_get_secret(), payload.encode('utf-8'), hashlib.sha256).hexdigest()
    token   = f"{payload}:{sig}"

    logger.debug("[make_token] match_id=%s ts=%s token_prefix=%s", match_id, ts, token[:30])
    return token


def verify_token(match_id: int, token: str) -> bool:
    """
    Return True if `token` is a valid, unexpired umpire token for `match_id`.

    Logs a specific reason on every failure so it is easy to diagnose.
    """
    if not token:
        logger.debug("[verify_token] FAIL: empty token")
        return False

    # ── 1. Split ──────────────────────────────────────────────────────────────
    parts = token.split(':')
    if len(parts) != 3:
        logger.debug("[verify_token] FAIL: expected 3 parts, got %d — token=%r", len(parts), token[:40])
        return False

    token_match_id_str, ts_str, received_sig = parts

    # ── 2. Match ID check ─────────────────────────────────────────────────────
    try:
        token_match_id = int(token_match_id_str)
    except ValueError:
        logger.debug("[verify_token] FAIL: match_id not an int: %r", token_match_id_str)
        return False

    if token_match_id != int(match_id):
        logger.debug(
            "[verify_token] FAIL: match_id mismatch — token has %d, expected %d",
            token_match_id, match_id
        )
        return False

    # ── 3. Timestamp / expiry check ───────────────────────────────────────────
    try:
        ts = int(ts_str)
    except ValueError:
        logger.debug("[verify_token] FAIL: timestamp not an int: %r", ts_str)
        return False

    age = time.time() - ts
    if age > TOKEN_TTL_SECONDS:
        logger.debug("[verify_token] FAIL: token expired — age=%.0fs TTL=%ds", age, TOKEN_TTL_SECONDS)
        return False

    if age < 0:
        logger.debug("[verify_token] FAIL: token timestamp is in the future — age=%.0fs", age)
        return False

    # ── 4. HMAC signature check ───────────────────────────────────────────────
    payload      = f"{token_match_id_str}:{ts_str}"
    expected_sig = hmac.new(
        _get_secret(),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    logger.debug(
        "[verify_token] comparing sigs — received=%s… expected=%s…",
        received_sig[:16], expected_sig[:16]
    )

    if not hmac.compare_digest(received_sig, expected_sig):
        logger.debug("[verify_token] FAIL: HMAC signature mismatch")
        return False

    logger.debug("[verify_token] OK — match_id=%d age=%.0fs", match_id, age)
    return True