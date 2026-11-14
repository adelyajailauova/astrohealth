
"""Forecast health metrics 5–30 minutes ahead.

For each metric, the model predicts the change (delta) relative to the latest
measurement at each forecast horizon. Features include recent lag values,
mean, standard deviation, trend slope, activity flag and (if available)
time of day. Confidence intervals are estimated from validation residuals.
"""

import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .config import METRICS, HORIZONS_MIN, STEP_MIN, HARD_BOUNDS, TREND_EPS, activity_flag


class _MultiModel:
    """Unified interface: fit(X, Y[n, horizons]) / predict(X) -> [n, horizons].

    HGB uses absolute error loss (conditional median) because future scenario
    changes are unpredictable and squared loss can worsen MAE.
    """

    def __init__(self, kind="hgb", alpha=10.0):
        self.kind, self.alpha, self.m = kind, alpha, []

    def fit(self, X, Y):
        if self.kind == "ridge":
            self.m = [make_pipeline(StandardScaler(), Ridge(alpha=self.alpha)).fit(X, Y)]
        else:
            self.m = [HistGradientBoostingRegressor(loss="absolute_error", max_iter=150, learning_rate=0.08,
                                                    max_depth=4, random_state=0).fit(X, Y[:, k]) for k in range(Y.shape[1])]
        return self

    def predict(self, X):
        if self.kind == "ridge":
            return self.m[0].predict(X)
        return np.column_stack([m.predict(X) for m in self.m])


class Forecaster:
    """Forecasting model: 'hgb' (default, more accurate) or 'ridge' (fast, linear).

    use_time adds time-of-day features when a timestamp column is available.
    """

    def __init__(self, metrics=METRICS, horizons_min=HORIZONS_MIN, lags=20, step_min=STEP_MIN,
                 alpha=10.0, model="hgb", use_time=True):
        self.metrics = list(metrics)
        self.horizons_min = list(horizons_min)
        self.steps = [max(1, int(round(h / step_min))) for h in horizons_min]
        self.lags, self.alpha, self.model_kind, self.use_time = lags, alpha, model, use_time
        self.time_on = False
        self.models, self.sigma = {}, {}

    # ---------- Feature preparation ----------
    def _feats(self, values, act):
        w = sliding_window_view(values, self.lags)
        last = w[:, -1:]
        xs = np.arange(self.lags) - (self.lags - 1) / 2
        slope = ((w - w.mean(1, keepdims=True)) * xs).sum(1, keepdims=True) / (xs ** 2).sum()
        return np.hstack([last, w[:, :-1] - last, w.mean(1, keepdims=True) - last,
                          w.std(1, keepdims=True), slope, act[self.lags - 1:, None]])

    def _time(self, df):
        ts = pd.to_datetime(df["timestamp"])
        m = (ts.dt.hour * 60 + ts.dt.minute).to_numpy(float)[self.lags - 1:]
        return np.column_stack([np.sin(2 * np.pi * m / 1440), np.cos(2 * np.pi * m / 1440), m / 1440])

    def _X(self, df, metric):
        v = df[metric].to_numpy(float)
        a = df["activity"].map(activity_flag).to_numpy(float)
        X = self._feats(v, a)
        if self.time_on:
            if "timestamp" not in df.columns:
                raise ValueError("Model was trained with time-of-day: 'timestamp' column is required")
            X = np.hstack([X, self._time(df)])
        return v, X

    def dataset(self, df, metric):
        """Build features, target deltas, last values and 5-step moving averages."""
        v, X = self._X(df, metric)
        k = len(v) - self.lags - max(self.steps) + 1
        if k <= 0:
            raise ValueError(f"Too little data: need > {self.lags + max(self.steps)} rows")
        t = np.arange(k) + self.lags - 1
        Y = np.column_stack([v[t + s] - v[t] for s in self.steps])
        ma5 = np.array([v[i - 4:i + 1].mean() for i in t])
        return X[:k], Y, v[t], ma5

    def _clip(self, metric, x):
        lo, hi = HARD_BOUNDS[metric]
        return np.clip(x, lo, hi)

    # ---------- Model training ----------
    def fit(self, df: pd.DataFrame, val_frac: float = 0.15):
        self.time_on = bool(self.use_time and "timestamp" in df.columns)
        for m in self.metrics:
            X, Y, _, _ = self.dataset(df, m)
            cut = int(len(X) * (1 - val_frac))
            tmp = _MultiModel(self.model_kind, self.alpha).fit(X[:cut], Y[:cut])
            self.sigma[m] = (Y[cut:] - tmp.predict(X[cut:])).std(0)
            self.models[m] = _MultiModel(self.model_kind, self.alpha).fit(X, Y)
        return self

    # ---------- Forecast generation ----------
    def predict(self, df: pd.DataFrame) -> dict:
        if len(df) < self.lags:
            raise ValueError(f"Need at least {self.lags} recent samples, got {len(df)}")
        tail = df.tail(self.lags).reset_index(drop=True)
        out = {}
        for m in self.metrics:
            v, X = self._X(tail, m)
            delta = self.models[m].predict(X[-1:])[0]
            cur = float(v[-1])
            hz = {}
            for k, h in enumerate(self.horizons_min):
                p = float(self._clip(m, cur + delta[k]))
                s = float(self.sigma[m][k])
                hz[h] = {"pred": round(p, 2), "low": round(float(self._clip(m, p - 1.96 * s)), 2),
                         "high": round(float(self._clip(m, p + 1.96 * s)), 2)}
            ref = hz[15]["pred"] if 15 in hz else hz[self.horizons_min[len(self.horizons_min) // 2]]["pred"]
            d = ref - cur
            trend = "stable" if abs(d) < TREND_EPS[m] else ("rising" if d > 0 else "falling")
            out[m] = {"current": round(cur, 2), "trend": trend, "horizons": hz}
        return out
