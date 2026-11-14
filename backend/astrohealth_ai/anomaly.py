"""Detect anomalies in astronaut health metrics using Isolation Forest."""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from .config import METRICS, activity_flag

DEV_METRICS = ["hr", "sys", "spo2", "rr"]


class AnomalyDetector:
    """Uses separate models for rest and physical activity."""

    MIN_ROWS = 100

    def __init__(self, contamination=0.02, n_estimators=200, random_state=42, z_thr=3.0, max_samples=2048):
        self.contamination, self.z_thr = contamination, z_thr
        self.n_estimators, self.random_state, self.max_samples = n_estimators, random_state, max_samples
        self.models, self.train_scores, self.stats = {}, {}, {}

    def _features(self, df):
        return df[METRICS].astype(float)

    def fit(self, df: pd.DataFrame, fit_mask=None):
        """Train separate models for rest and activity."""
        act = df["activity"].map(activity_flag).to_numpy()
        X = self._features(df)
        ok = np.ones(len(df), bool) if fit_mask is None else np.asarray(fit_mask, bool)

        # Train a separate Isolation Forest for each activity state
        for a in (0, 1):
            Xa = X[(act == a) & ok]
            if len(Xa) < self.MIN_ROWS:
                continue

            mdl = IsolationForest(n_estimators=self.n_estimators, max_samples=self.max_samples, contamination=self.contamination,
                                  random_state=self.random_state).fit(Xa)
            self.models[a] = mdl
            self.train_scores[a] = np.sort(-mdl.score_samples(Xa))

            # Store normal metric statistics for later deviation analysis
            sub = df[(act == a) & ok]
            self.stats[a] = {m: (float(sub[m].mean()), float(sub[m].std() or 1.0)) for m in METRICS}

        if not self.models:
            raise ValueError(f"Need at least {self.MIN_ROWS} rows to train the anomaly detector")
        return self

    def _pick(self, a):
        return a if a in self.models else next(iter(self.models))

    def score(self, df: pd.DataFrame) -> pd.DataFrame:
        X = self._features(df)
        act = df["activity"].map(activity_flag).to_numpy()
        score = np.zeros(len(df)); flag = np.zeros(len(df), bool)

        # Calculate anomaly scores using the corresponding activity model
        for a in (0, 1):
            idx = np.where(act == a)[0]
            if len(idx) == 0:
                continue
            k = self._pick(a)
            Xa = X.iloc[idx]
            raw = -self.models[k].score_samples(Xa)
            score[idx] = np.searchsorted(self.train_scores[k], raw) / len(self.train_scores[k])
            flag[idx] = self.models[k].predict(Xa) == -1

        return pd.DataFrame({"score": score, "is_anomaly": flag}, index=df.index)

    def detect_last(self, df: pd.DataFrame) -> dict:
        """Evaluate the latest measurement using recent data."""
        res = self.score(df)
        last = df.iloc[-1]
        a = activity_flag(last["activity"])
        st = self.stats[self._pick(a)]
        contrib = []

        # Find metrics that deviate significantly from their normal values
        for m in METRICS:
            z = (float(last[m]) - st[m][0]) / st[m][1]
            if abs(z) >= self.z_thr:
                contrib.append({"metric": m, "value": round(float(last[m]), 2), "z": round(z, 1)})

        contrib.sort(key=lambda c: -abs(c["z"]))

        # Confirm sustained anomalies across recent measurements
        flagged = int(res["is_anomaly"].tail(5).sum())
        return {"is_anomaly": bool(res["is_anomaly"].iloc[-1]), "score": round(float(res["score"].iloc[-1]), 3),
                "flagged_last_5": flagged, "sustained": flagged >= 3, "contributors": contrib}
