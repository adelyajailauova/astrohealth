
"""Unified entry point for connecting the AI module to the backend."""

import joblib
import pandas as pd

from .anomaly import AnomalyDetector
from .assistant import build_summary
from .config import METRICS
from .evaluation import evaluate_anomaly, evaluate_forecaster
from .forecasting import Forecaster

REQUIRED = METRICS + ["activity"]


def to_frame(samples) -> pd.DataFrame:
    """Convert a list of dictionaries or DataFrame into a time-sorted DataFrame.

    Required columns: hr, sys, dia, spo2, rr, temp, activity.
    The timestamp column is optional.
    """
    df = samples.copy() if isinstance(samples, pd.DataFrame) else pd.DataFrame(samples)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")
    if "timestamp" in df.columns and "crew" not in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp", kind="stable")
    return df.reset_index(drop=True)


class AstroHealthAI:
    def __init__(self, use_time: bool = False, contamination: float = 0.02):
        # Mission time is simulated, so time-of-day features are disabled by default
        self.forecaster = Forecaster(use_time=use_time)
        self.detector = AnomalyDetector(contamination=contamination)
        self.report = {}

    # ---------- Training and evaluation ----------
    @staticmethod
    def _split(df: pd.DataFrame, test_frac: float):
        """Split data chronologically, separately for each crew member if available."""
        groups = [g for _, g in df.groupby("crew", sort=False)] if "crew" in df.columns else [df]
        tr, te = [], []
        for g in groups:
            cut = int(len(g) * (1 - test_frac))
            tr.append(g.iloc[:cut]); te.append(g.iloc[cut:])
        return pd.concat(tr, ignore_index=True), pd.concat(te, ignore_index=True)

    @staticmethod
    def _clean(d: pd.DataFrame):
        if "is_anomaly" not in d.columns:
            return None
        ok = d["is_anomaly"] == 0
        if "transition" in d.columns:
            ok &= d["transition"] == 0
        return ok.to_numpy()

    def fit(self, df: pd.DataFrame, test_frac: float = 0.3):
        df = to_frame(df)
        train, test = self._split(df, test_frac)
        self.forecaster.fit(train)
        self.detector.fit(train, self._clean(train))
        self.report = self.evaluate(test)

        # Retrain the final models using the complete dataset
        self.forecaster.fit(df)
        self.detector.fit(df, self._clean(df))
        return self

    def evaluate(self, df: pd.DataFrame) -> dict:
        df = to_frame(df)
        fc = evaluate_forecaster(self.forecaster, df)
        rep = {"forecast": fc.to_dict("records"),
               "forecast_mean_improvement_%": round(float(fc["improvement_vs_baseline_%"].mean()), 1)}
        if "is_anomaly" in df.columns:
            rep["anomaly"] = evaluate_anomaly(self.detector, df)
        return rep

    # ---------- Runtime methods used by the API ----------
    def forecast(self, samples) -> dict:
        return self.forecaster.predict(to_frame(samples))

    def detect(self, samples) -> dict:
        return self.detector.detect_last(to_frame(samples))

    def summary(self, samples, findings=None, lang: str = "ru", llm_hook=None) -> dict:
        df = to_frame(samples)
        fc, an = self.forecaster.predict(df), self.detector.detect_last(df)
        out = build_summary(fc, an, str(df["activity"].iloc[-1]), findings, lang, llm_hook)
        out.update(forecast=fc, anomaly=an)
        return out

    # ---------- Model persistence ----------
    def save(self, path: str):
        joblib.dump(self, path)

    @staticmethod
    def load(path: str) -> "AstroHealthAI":
        return joblib.load(path)
