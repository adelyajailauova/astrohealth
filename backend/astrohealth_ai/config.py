
"""Shared configuration for the AstroHealth AI module.

IMPORTANT: REF_RANGES contains approximate thresholds.
During integration, verify them against METRICS and assess_* in the main backend.
"""

METRICS = ["hr", "sys", "dia", "spo2", "rr", "temp"]
STEP_MIN = 1                       # One measurement per minute
HORIZONS_MIN = [5, 10, 15, 20, 25, 30]

UNITS = {"hr": "bpm", "sys": "mmHg", "dia": "mmHg", "spo2": "%", "rr": "br/min", "temp": "°C"}

NAMES = {
    "en": {"hr": "heart rate", "sys": "systolic BP", "dia": "diastolic BP", "spo2": "SpO2",
           "rr": "respiratory rate", "temp": "body temperature", "rhythm": "ECG rhythm", "bp": "blood pressure",
           "glucose": "blood glucose", "sleep": "sleep", "mood": "mood & stress", "exercise": "exercise",
           "radiation": "radiation dose", "cycle": "cycle"},
    "ru": {"hr": "пульс", "sys": "систолическое давление", "dia": "диастолическое давление",
           "spo2": "сатурация (SpO2)", "rr": "частота дыхания", "temp": "температура тела",
           "rhythm": "ритм ЭКГ", "bp": "давление", "glucose": "глюкоза", "sleep": "сон",
           "mood": "настроение и стресс", "exercise": "тренировка", "radiation": "доза радиации", "cycle": "цикл"},
}

# Reference ranges (min, max), aligned with backend/app/assess.py
# Rest: HR 40–100, BP <130/80, SpO2 >=95, RR 12–18, T 36.1–37.2; Activity: T <=38.0
REF_RANGES = {
    "rest":   {"hr": (40, 100), "sys": (90, 130), "dia": (60, 80), "spo2": (95, 100), "rr": (12, 18), "temp": (36.1, 37.2)},
    "active": {"hr": (40, 190), "sys": (90, 170), "dia": (60, 100), "spo2": (95, 100), "rr": (8, 35), "temp": (36.1, 38.0)},
}

# Physiological limits that predictions cannot exceed
HARD_BOUNDS = {"hr": (25, 220), "sys": (60, 230), "dia": (30, 140), "spo2": (50, 100), "rr": (4, 60), "temp": (33.0, 42.0)}

# Changes over 15 minutes below these thresholds are considered stable
TREND_EPS = {"hr": 3.0, "sys": 4.0, "dia": 3.0, "spo2": 0.5, "rr": 1.0, "temp": 0.1}

REST_LABELS = {"rest", "sleep", "sleeping", "resting", "idle", ""}


def activity_flag(a) -> int:
    """Return 0 for rest/sleep and 1 for any physical activity."""
    return 0 if str(a).strip().lower() in REST_LABELS else 1
