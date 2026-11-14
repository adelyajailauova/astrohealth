"""Demo authentication: two roles, astronaut (sees only own data) and medical staff (sees all).

Prototype only: PINs are fixed demo values (listed in README) and sessions live in memory.
A real system would use the agency's identity provider.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time

USERS: dict[str, dict] = {
    "sato": {"role": "astronaut", "crew_id": "c1", "name": "Cmdr. A. Sato"},
    "moreau": {"role": "astronaut", "crew_id": "c2", "name": "Dr. L. Moreau"},
    "okafor": {"role": "astronaut", "crew_id": "c3", "name": "Eng. R. Okafor"},
    "surgeon": {"role": "staff", "crew_id": None, "name": "Flight Surgeon"},
}
_DEMO_PINS = {"sato": "1111", "moreau": "2222", "okafor": "3333", "surgeon": "9000"}
_SALT = secrets.token_bytes(16)
_HASHES = {u: hashlib.sha256(_SALT + p.encode()).digest() for u, p in _DEMO_PINS.items()}
SESSION_TTL_S = 12 * 3600

_sessions: dict[str, tuple[str, float]] = {}


def login(username: str, pin: str) -> str | None:
    username = username.strip().lower()
    expected = _HASHES.get(username)
    if expected is None or not hmac.compare_digest(expected, hashlib.sha256(_SALT + pin.encode()).digest()):
        return None
    token = secrets.token_urlsafe(24)
    _sessions[token] = (username, time.time() + SESSION_TTL_S)
    return token


def logout(token: str) -> None:
    _sessions.pop(token, None)


def user_for(token: str | None) -> dict | None:
    if not token or token not in _sessions:
        return None
    username, exp = _sessions[token]
    if exp < time.time():
        _sessions.pop(token, None)
        return None
    return {"username": username, **USERS[username]}


def accounts() -> list[dict]:
    """Public account list for the login screen (no secrets)."""
    return [{"username": u, **v} for u, v in USERS.items()]
