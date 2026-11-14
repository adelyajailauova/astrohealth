"""Bridge between the live backend and the astrohealth_ai module.

Takes the rolling vitals history kept in main.py, runs the trained model and returns
one JSON-friendly summary: forecast, anomaly check and a plain-language explanation.
"""

from __future__ import annotations

import os
import threading
from typing import Iterable

import pandas as pd

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "astrohealth_ai.joblib")
WINDOW = 60                                   # recent samples sent to the model
PRIVATE_METRICS = {"mood", "cycle"}           # self-reported data: never shown to ground staff

_ai = None
_lock = threading.Lock()


def get_ai():
    """Load the trained model once. Returns None if the model file is missing."""
    global _ai
    with _lock:
        if _ai is None and os.path.exists(MODEL_PATH):
            from astrohealth_ai import AstroHealthAI
            _ai = AstroHealthAI.load(MODEL_PATH)
        return _ai


def ai_summary(ai, hist: Iterable[dict], findings: list[dict] | None = None, lang: str = "ru",
               include_private: bool = True) -> dict:
    """Forecast + anomaly + explanation for one crew member.

    Returns {"ready": False, "have": n, "need": n} while the first samples are still being collected.
    """
    rows = list(hist)[-WINDOW:]
    need = ai.forecaster.lags
    if len(rows) < need:
        return {"ready": False, "have": len(rows), "need": need}

    fnd = [f for f in (findings or []) if include_private or f.get("metric") not in PRIVATE_METRICS]
    en = lang == "en"
    if not en:
        # Rule texts are English-only here and the UI already shows them translated in the status
        # banner, so for ru/kk they only raise the level and are left out of the explanation text.
        fnd = [{**f, "label": "", "title": "", "advice": ""} for f in fnd]
    out = ai.summary(pd.DataFrame(rows), fnd, "en" if en else "ru")
    if not en:
        out["text"] = "\n".join(ln for ln in out["text"].split("\n") if not ln.endswith(": ."))
        out["text"] = out["text"].replace("br/min", "/мин")
    out["ready"] = True
    return out
