
"""Fallback synthetic data generator with a daily rhythm, intended for experiments only.
The primary training data source is sim_data.py.
"""

import numpy as np
import pandas as pd
from .config import METRICS


def _ar(n, phi, sigma, rng):
    x = np.zeros(n)
    e = rng.normal(0, sigma, n)
    for i in range(1, n):
        x[i] = phi * x[i - 1] + e[i]
    return x


def _smooth(target, k):
    out = np.zeros_like(target, dtype=float)
    for i in range(1, len(target)):
        out[i] = out[i - 1] + (target[i] - out[i - 1]) * k
    return out


def simulate(days: int = 4, seed: int = 0, anomalies: bool = True, start: str = "2026-11-01") -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    n = days * 1440
    m = np.arange(n) % 1440
    sleep_t = ((m >= 1380) | (m < 420)).astype(float)
    exer_t = ((m >= 600) & (m < 690)).astype(float)       # 90 minutes of exercise per day
    sleep, eff = _smooth(sleep_t, 0.1), _smooth(exer_t, 0.15)

    hr = 70 - 8 * sleep + 75 * eff + _ar(n, 0.9, 0.8, rng)
    sys_ = 118 - 6 * sleep + 0.35 * (hr - 70) + _ar(n, 0.97, 0.6, rng)
    dia = 76 - 4 * sleep + 0.12 * (hr - 70) + _ar(n, 0.97, 0.4, rng)
    spo2 = np.minimum(97.8 - 0.4 * sleep - 0.8 * eff + _ar(n, 0.9, 0.15, rng), 100)
    rr = 14 - 1.5 * sleep + 7 * eff + _ar(n, 0.9, 0.3, rng)
    temp = 36.6 + 0.25 * np.sin(2 * np.pi * (m - 600) / 1440) + 0.5 * eff + _ar(n, 0.99, 0.02, rng)

    df = pd.DataFrame({
        "timestamp": pd.date_range(start, periods=n, freq="min"),
        "hr": hr, "sys": sys_, "dia": dia, "spo2": spo2, "rr": rr, "temp": temp,
        "activity": np.where(exer_t > 0, "exercise", np.where(sleep_t > 0, "sleep", "rest")),
        "is_anomaly": 0,
    })

    if anomalies:
        kinds = {"tachy": ("hr", 45), "spo2_drop": ("spo2", -6), "bp_spike": ("sys", 40),
                 "fever": ("temp", 1.3), "resp": ("rr", 9)}
        for d in range(days):
            for _ in range(2):
                s = d * 1440 + int(rng.integers(30, 1440 - 60))
                L = int(rng.integers(8, 21))
                if df.loc[s:s + L, "activity"].eq("exercise").any():
                    continue
                kind = rng.choice(list(kinds))
                col, amp = kinds[kind]
                shape = np.hanning(L + 2)[1:-1]
                df.loc[s:s + L - 1, col] += amp * shape
                if kind == "bp_spike":
                    df.loc[s:s + L - 1, "dia"] += 20 * shape
                df.loc[s:s + L - 1, "is_anomaly"] = 1
    for c in METRICS:
        df[c] = df[c].round(2)
    return df
