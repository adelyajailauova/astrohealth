"""Sensor simulator standing in for a Bio-Monitor-style smart shirt.

There is no hardware in this prototype: values are SIMULATED around each
crew member's pre-flight baseline, and demo scenarios push them toward
clinically meaningful states so the assessment pipeline can be shown.
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field

SCENARIOS = {
    "normal": "Nominal",
    "exercise": "Exercise session",
    "orthostatic": "Low BP / dizziness (gravity transition)",
    "arrhythmia": "Irregular heart rhythm",
    "hypoxia": "Falling SpO2 (hypoxia)",
    "fever": "Fever (infection)",
    "solar": "Solar particle event (radiation)",
}

# Simulated dose rates (mSv/day). Illustrative demo values, not measured data.
DOSE_RATE_MSV_DAY = {"iss": 0.5, "moon": 1.0, "mars": 0.7}


@dataclass
class Crew:
    id: str
    name: str
    role: str
    base_hr: float
    base_sys: float
    base_dia: float
    base_temp: float
    prior_career_msv: float
    exercise_start: float = 95.0
    scenario: str = "normal"
    scenario_t: float = 0.0
    state: dict = field(default_factory=dict)

    def __post_init__(self):
        self.state = {
            "hr": self.base_hr, "sys": self.base_sys, "dia": self.base_dia,
            "spo2": 98.0, "rr": 14.0, "temp": self.base_temp,
            "irregular": False, "activity": "rest", "symptoms": [],
            "exercise_min": self.exercise_start, "mission_msv": 0.0,
        }


def _toward(cur: float, target: float, rate: float, noise: float) -> float:
    return cur + (target - cur) * rate + random.gauss(0, noise)


class Simulator:
    def __init__(self) -> None:
        self.crew: dict[str, Crew] = {
            c.id: c for c in [
                Crew("c1", "Cmdr. A. Sato", "Commander", 58, 116, 74, 36.7, 120.0),
                Crew("c2", "Dr. L. Moreau", "Crew Medical Officer", 64, 112, 72, 36.8, 45.0, exercise_start=100.0),
                Crew("c3", "Eng. R. Okafor", "Flight Engineer", 61, 117, 76, 36.6, 260.0, exercise_start=55.0),
            ]
        }
        self.location = "iss"
        self.t0 = time.time()

    def set_scenario(self, crew_id: str, scenario: str) -> None:
        c = self.crew[crew_id]
        c.scenario = scenario
        c.scenario_t = 0.0

    def step(self, dt: float = 1.0) -> None:
        for c in self.crew.values():
            c.scenario_t += dt
            s = c.state
            sc = c.scenario
            # targets around baseline
            hr_t, sys_t, dia_t = c.base_hr, c.base_sys, c.base_dia
            spo2_t, rr_t, temp_t = 98.0, 14.0, c.base_temp
            s["irregular"] = False
            s["activity"] = "rest"
            s["symptoms"] = []
            dose_mult = 1.0

            if sc == "exercise":
                s["activity"] = "exercise"
                hr_t, rr_t, temp_t, sys_t = 148, 28, c.base_temp + 1.6, c.base_sys + 25
                s["exercise_min"] += dt / 60 * 30  # time-compressed for demo
            elif sc == "orthostatic":
                sys_t, dia_t, hr_t = c.base_sys - 30, c.base_dia - 14, c.base_hr + 28
                if c.scenario_t > 6:
                    s["symptoms"] = ["dizziness"]
            elif sc == "arrhythmia":
                hr_t = 128
                s["irregular"] = True
            elif sc == "hypoxia":
                spo2_t, rr_t, hr_t = 86.0, 23, c.base_hr + 18
            elif sc == "fever":
                temp_t, hr_t, rr_t = 38.7, c.base_hr + 22, 19
            elif sc == "solar":
                dose_mult = 400.0  # exaggerated so the demo shows dose climbing

            s["hr"] = _toward(s["hr"], hr_t, 0.15, 0.8)
            if s["irregular"]:
                s["hr"] += random.uniform(-12, 12)
            s["sys"] = _toward(s["sys"], sys_t, 0.12, 0.8)
            s["dia"] = _toward(s["dia"], dia_t, 0.12, 0.6)
            s["spo2"] = min(100.0, _toward(s["spo2"], spo2_t, 0.06, 0.15))
            s["rr"] = _toward(s["rr"], rr_t, 0.12, 0.3)
            s["temp"] = _toward(s["temp"], temp_t, 0.04, 0.02)
            rate = DOSE_RATE_MSV_DAY[self.location] * dose_mult
            s["mission_msv"] += rate * dt / 86400 * 60  # 1 s = 1 min of mission time

    def snapshot(self, c: Crew) -> dict:
        s = c.state
        return {
            "hr": round(s["hr"], 1), "sys": round(s["sys"]), "dia": round(s["dia"]),
            "spo2": round(s["spo2"], 1), "rr": round(s["rr"], 1), "temp": round(s["temp"], 2),
            "irregular": s["irregular"], "activity": s["activity"], "symptoms": list(s["symptoms"]),
            "exercise_min": round(s["exercise_min"]),
            "mission_msv": round(s["mission_msv"], 3),
            "career_msv": round(c.prior_career_msv + s["mission_msv"], 2),
        }
