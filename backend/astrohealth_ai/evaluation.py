
"""Evaluate forecasting models and anomaly detection performance."""

import numpy as np
import pandas as pd


def _err(true, pred):
    e = pred - true
    return float(np.abs(e).mean()), float(np.sqrt((e ** 2).mean())), float((np.abs(e) / np.maximum(np.abs(true), 1e-9)).mean() * 100)


def evaluate_forecaster(fc, df: pd.DataFrame) -> pd.DataFrame:
    """Compare forecasts against persistence and moving average baselines."""
    rows = []
    for m in fc.metrics:
        X, Y, last, ma5 = fc.dataset(df, m)
        delta = fc.models[m].predict(X)
        for k, h in enumerate(fc.horizons_min):
            true = last + Y[:, k]
            pm = fc._clip(m, last + delta[:, k])
            mae, rmse, mape = _err(true, pm)
            b_mae, b_rmse, b_mape = _err(true, last)
            ma_mae, _, _ = _err(true, ma5)
            s = fc.sigma[m][k]
            cover = float((np.abs(true - pm) <= 1.96 * s).mean() * 100)
            rows.append({"metric": m, "horizon_min": h, "mae": mae, "rmse": rmse, "mape_%": mape,
                         "baseline_mae": b_mae, "baseline_rmse": b_rmse, "ma5_mae": ma_mae,
                         "improvement_vs_baseline_%": (1 - mae / b_mae) * 100 if b_mae else 0.0,
                         "interval_coverage_%": cover})
    return pd.DataFrame(rows).round(3)


def evaluate_anomaly(det, df: pd.DataFrame) -> dict:
    """Evaluate anomaly detection using labeled data (is_anomaly: 0/1)."""
    y = df["is_anomaly"].to_numpy(bool)
    p = det.score(df)["is_anomaly"].to_numpy(bool)

    # Exclude transition periods from evaluation
    if "transition" in df.columns:
        keep = df["transition"].to_numpy() == 0
        y, p = y[keep], p[keep]

    tp, fp, fn = int((y & p).sum()), int((~y & p).sum()), int((y & ~p).sum())
    pr = tp / (tp + fp) if tp + fp else 0.0
    rc = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * pr * rc / (pr + rc) if pr + rc else 0.0

    # Count anomaly events detected at least once
    ev_found = ev_total = 0
    i = 0
    while i < len(y):
        if y[i]:
            j = i
            while j < len(y) and y[j]:
                j += 1
            ev_total += 1
            ev_found += int(p[i:j].any())
            i = j
        else:
            i += 1

    # Check sustained alerts (at least 3 flags in 5 measurements)
    sus = pd.Series(p).astype(int).rolling(5, min_periods=1).sum().to_numpy() >= 3
    sus_found, i = 0, 0
    while i < len(y):
        if y[i]:
            j = i
            while j < len(y) and y[j]:
                j += 1
            sus_found += int(sus[i:j].any())
            i = j
        else:
            i += 1

    sus_fp = int((~y & sus).sum())

    return {"precision": round(pr, 3), "recall": round(rc, 3), "f1": round(f1, 3),
            "events_total": ev_total, "events_detected": ev_found,
            "false_flags_per_1440_ticks": round(fp / (len(y) / 1440), 2),
            "sustained_events_detected": sus_found,
            "sustained_false_alarm_ticks_per_1440": round(sus_fp / (len(y) / 1440), 2)}
