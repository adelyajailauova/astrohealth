"""Store-and-forward space link with light-time delay and priority.

One-way delays:
- ISS: near real-time via relay satellites (shown as ~1 s, approximate).
- Moon: ~1.3 s (384,400 km / speed of light).
- Mars: up to 20 min one way (NASA HRP, Hazard: Distance From Earth).

For the demo, delays above 10 s are compressed 60x (20 min -> 20 s);
the UI always shows the real value next to the demo value.
"""

from __future__ import annotations

import heapq
import itertools
import time

LOCATIONS = {
    "iss": {"name": "International Space Station", "real_delay_s": 1.0, "source": None},
    "moon": {"name": "Lunar surface / Gateway", "real_delay_s": 1.3, "source": None},
    "mars": {"name": "Mars", "real_delay_s": 20 * 60.0, "source": "nasa_distance"},
}
DEMO_COMPRESSION = 60.0
BANDWIDTH_MSG_PER_TICK = 3  # limited downlink: critical messages jump the queue

PRIORITY = {"critical": 0, "alert": 1, "watch": 2, "message": 1, "telemetry": 3, "normal": 3}


def demo_delay(location: str) -> float:
    real = LOCATIONS[location]["real_delay_s"]
    return real / DEMO_COMPRESSION if real > 10 else real


class Link:
    """One direction of the space link (downlink or uplink)."""

    def __init__(self) -> None:
        self._q: list = []
        self._ids = itertools.count(1)
        self.outage = False

    def send(self, kind: str, priority: str, payload: dict, location: str) -> dict:
        now = time.time()
        msg = {
            "id": next(self._ids), "kind": kind, "priority": priority,
            "created_at": now, "deliver_at": now + demo_delay(location), "payload": payload,
        }
        heapq.heappush(self._q, (PRIORITY.get(priority, 3), msg["deliver_at"], msg["id"], msg))
        return msg

    def due(self) -> list[dict]:
        """Messages whose light-time has elapsed, highest priority first, bandwidth-limited."""
        if self.outage:
            return []
        now = time.time()
        ready, later = [], []
        while self._q:
            item = heapq.heappop(self._q)
            (ready if item[3]["deliver_at"] <= now else later).append(item)
        out = []
        for item in ready:
            if len(out) < BANDWIDTH_MSG_PER_TICK or item[0] == 0:
                msg = item[3]
                msg["received_at"] = now
                out.append(msg)
            else:
                later.append(item)
        for item in later:
            heapq.heappush(self._q, item)
        return out

    def pending(self, crew_id: str | None = None) -> dict:
        """Queue size; with crew_id, only that crew member's own reports and messages are counted."""
        counts: dict[str, int] = {}
        total = 0
        for _, _, _, m in self._q:
            if crew_id is not None and m["payload"].get("crew_id") != crew_id:
                continue
            counts[m["priority"]] = counts.get(m["priority"], 0) + 1
            total += 1
        return {"total": total, "by_priority": counts}
