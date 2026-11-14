
"""AI Medical Assistant: generates summaries from forecasts, anomalies and findings.

Works without external services using predefined templates.
An optional llm_hook can rewrite the summary using an external LLM.
The assistant does not diagnose or replace a physician.
"""

from typing import Callable, Optional
from .config import NAMES, UNITS, REF_RANGES, activity_flag

LEVELS = {0: "NORMAL", 1: "WATCH", 2: "ALERT", 3: "CRITICAL"}

T = {
    "en": {
        "status": {"NORMAL": "All monitored parameters look stable.",
                   "WATCH": "Some parameters need attention.",
                   "ALERT": "Attention required: unusual or critical changes detected.",
                   "CRITICAL": "CRITICAL: immediate attention required."},
        "anom": "Unusual pattern detected (anomaly score {s:.2f}): {c}.",
        "anom_sust": " The deviation is sustained over the last minutes.",
        "anom_none": "No unusual patterns detected in the recent data.",
        "risk": "Forecast: {n} may be {d} the reference range in {h} min (≈{v:.1f} {u}).",
        "trend": "Trend: {n} is {t} (now {c:.1f} {u}).",
        "trends": {"rising": "rising", "falling": "falling", "stable": "stable"},
        "above": "above", "below": "below",
        "finding": "{n}: {t}. {a}",
        "rec": "Recommendation: ",
        "rec_alert": "notify the flight surgeon / ground medical team and recheck the measurement.",
        "rec_crit": "follow the emergency procedure now and alert the crew medical officer and ground.",
        "rec_watch": "recheck in 5–10 minutes and continue monitoring.",
        "rec_ok": "continue routine monitoring.",
        "disc": "This summary is decision support only and does not replace a physician.",
    },
    "ru": {
        "status": {"NORMAL": "Все контролируемые показатели стабильны.",
                   "WATCH": "Некоторые показатели требуют внимания.",
                   "ALERT": "Требуется внимание: обнаружены необычные или критичные изменения.",
                   "CRITICAL": "КРИТИЧНО: требуется немедленное внимание."},
        "anom": "Обнаружен необычный паттерн (оценка аномальности {s:.2f}): {c}.",
        "anom_sust": " Отклонение держится последние несколько минут.",
        "anom_none": "В недавних данных необычных паттернов не обнаружено.",
        "risk": "Прогноз: через {h} мин {n} может быть {d} референсного диапазона (≈{v:.1f} {u}).",
        "trend": "Тренд: {n} — {t} (сейчас {c:.1f} {u}).",
        "trends": {"rising": "растёт", "falling": "снижается", "stable": "стабилен"},
        "above": "выше", "below": "ниже",
        "finding": "{n}: {t}. {a}",
        "rec": "Рекомендация: ",
        "rec_alert": "сообщить врачу/наземной медицинской службе и перепроверить измерение.",
        "rec_crit": "действовать по аварийной процедуре и немедленно оповестить врача экипажа и Землю.",
        "rec_watch": "перепроверить через 5–10 минут и продолжить наблюдение.",
        "rec_ok": "продолжать плановый мониторинг.",
        "disc": "Сводка носит вспомогательный характер и не заменяет консультацию врача.",
    },
}


def forecast_risks(forecast: dict, activity: str, ranges=REF_RANGES) -> list[dict]:
    """Identify forecasted values outside reference ranges."""
    rng = ranges["active" if activity_flag(activity) else "rest"]
    risks = []
    for m, f in forecast.items():
        lo, hi = rng[m]
        for h, p in f["horizons"].items():
            if p["pred"] > hi or p["pred"] < lo:
                risks.append({"metric": m, "horizon": h, "value": p["pred"],
                              "dir": "above" if p["pred"] > hi else "below"})
                break
    return risks


def build_summary(forecast: dict, anomaly: dict, activity: str = "rest", findings: Optional[list] = None,
                  lang: str = "ru", llm_hook: Optional[Callable[[str], str]] = None) -> dict:
    t = T[lang]
    names = NAMES[lang]
    fnd = [_as_dict(f) for f in (findings or [])]
    risks = forecast_risks(forecast, activity)

    # Determine the overall health alert level
    level = max([f["level"] for f in fnd], default=0)
    if anomaly["sustained"]:
        level = max(level, 2)
    elif anomaly["is_anomaly"] or risks:
        level = max(level, 1)
    lvl = LEVELS.get(level, "NORMAL")

    lines = [t["status"][lvl]]
    for f in fnd:
        if f["level"] >= 1:
            lines.append(t["finding"].format(n=names.get(f["metric"], f["metric"]), t=f["title"], a=f.get("advice", "")).strip())

    if anomaly["is_anomaly"]:
        c = ", ".join(f"{names[x['metric']]} {x['value']} {UNITS[x['metric']]} (z={x['z']:+.1f})" for x in anomaly["contributors"]) \
            or ("комбинация показателей" if lang == "ru" else "unusual combination of parameters")
        lines.append(t["anom"].format(s=anomaly["score"], c=c) + (t["anom_sust"] if anomaly["sustained"] else ""))
    else:
        lines.append(t["anom_none"])

    for r in risks:
        lines.append(t["risk"].format(n=names[r["metric"]], d=t[r["dir"]], h=r["horizon"], v=r["value"], u=UNITS[r["metric"]]))

    for m in ("hr", "spo2", "sys"):
        if m in forecast and forecast[m]["trend"] != "stable":
            lines.append(t["trend"].format(n=names[m], t=t["trends"][forecast[m]["trend"]], c=forecast[m]["current"], u=UNITS[m]))

    # Add recommendations based on the overall alert level
    rec = {"CRITICAL": t["rec_crit"], "ALERT": t["rec_alert"], "WATCH": t["rec_watch"], "NORMAL": t["rec_ok"]}[lvl]
    lines.append(t["rec"] + rec)
    lines.append(t["disc"])

    text = "\n".join(lines)

    # Optionally rewrite the summary using an external LLM
    if llm_hook:
        try:
            text = llm_hook(text)
        except Exception:
            pass

    return {"level": level, "level_name": lvl, "text": text, "risks": risks}


def _as_dict(f) -> dict:
    """Convert a Finding object or dictionary into a standard format."""
    d = f if isinstance(f, dict) else {k: getattr(f, k, None) for k in ("metric", "level", "label", "advice", "value")}
    d = dict(d)
    d["title"] = d.get("title") or d.get("label") or ""
    d["level"] = int(d.get("level") or 0)
    return d
