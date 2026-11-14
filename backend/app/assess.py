"""Health assessment engine.

Each rule returns a Finding with a status level and the sources that back it.
`origin` is "source" when the threshold is taken directly from a cited
reference, and "app" when it is our own escalation choice (shown honestly in
the UI so judges and flight surgeons can see what is evidence vs design).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

NORMAL, WATCH, ALERT, CRITICAL = 0, 1, 2, 3
LEVEL_NAMES = {NORMAL: "normal", WATCH: "watch", ALERT: "alert", CRITICAL: "critical"}


@dataclass
class Finding:
    metric: str
    level: int
    label: str
    advice: str
    sources: list[str]
    origin: str = "source"  # "source" | "app"
    value: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["status"] = LEVEL_NAMES[self.level]
        return d


# --- Metric catalogue: what the UI shows when a body zone is opened -----------

METRICS: dict[str, dict] = {
    "hr": {
        "name": "Heart rate", "unit": "bpm", "zone": "heart",
        "why": "Spaceflight alters the heart and blood vessels; NASA lists arrhythmias and fainting at landing as top cardiovascular risks.",
        "how": "Continuous from chest ECG electrodes in the smart shirt (Bio-Monitor style). Resting norms apply only at rest.",
        "sources": ["nasa_cardio", "csa_biomonitor", "mp_pulse"],
    },
    "rhythm": {
        "name": "ECG rhythm", "unit": "", "zone": "heart",
        "why": "Heart arrhythmias are named by NASA HRP as a cardiovascular risk of long missions.",
        "how": "Single-lead ECG from the smart shirt; irregular beat-to-beat intervals are flagged for flight-surgeon review.",
        "sources": ["nasa_cardio", "csa_biomonitor", "nasa_std3001_v1_3004"],
    },
    "bp": {
        "name": "Blood pressure", "unit": "mmHg", "zone": "heart",
        "why": "Fluid shifts in weightlessness change blood pressure regulation; low pressure raises fainting risk during gravity transitions.",
        "how": "Cuff or wearable measurement at rest, seated/strapped, arm at heart level. Compared with the astronaut's pre-flight baseline.",
        "sources": ["nasa_cardio", "nasa_gravity", "mp_hbp", "mp_lbp"],
    },
    "spo2": {
        "name": "Blood oxygen (SpO2)", "unit": "%", "zone": "lungs",
        "why": "Future deep-space cabins will run at reduced pressure, which raises the risk of mild hypoxia (confusion, headache, vision changes).",
        "how": "Pulse oximeter on finger or forehead. Cold skin and poor circulation can lower the reading.",
        "sources": ["nasa_hypoxia", "mp_pulseox"],
    },
    "rr": {
        "name": "Breathing rate", "unit": "/min", "zone": "lungs",
        "why": "Breathing rate rises with hypoxia, CO2 build-up and stress.",
        "how": "Chest-band respiratory sensor in the smart shirt; count breaths for 60 s at rest to cross-check.",
        "sources": ["csa_biomonitor", "mp_vitals"],
    },
    "temp": {
        "name": "Body temperature", "unit": "°C", "zone": "head",
        "why": "In space core temperature rises higher and faster during exercise; fever can signal infection from altered immunity.",
        "how": "Core-temperature headband (ESA T-Mini style) or thermometer at rest, not right after exercise.",
        "sources": ["nasa_wearables", "nasa_immune", "mp_temp"],
    },
    "glucose": {
        "name": "Blood glucose (fasting)", "unit": "mg/dL", "zone": "abdomen",
        "why": "Nutrition is a NASA HRP risk; glucose is a quick check of metabolic state.",
        "how": "Fingerstick meter after at least 8 hours without food, entered in the daily check-in.",
        "sources": ["mp_glucose", "mp_hypoglycemia"],
    },
    "sleep": {
        "name": "Sleep", "unit": "h", "zone": "head",
        "why": "16 sunrises a day and heavy workloads disrupt sleep; NASA links sleep loss to performance decrements.",
        "how": "Wrist actigraphy (Actiwatch style) plus self-report in the morning check-in.",
        "sources": ["nasa_sleep", "nhlbi_sleep"],
    },
    "mood": {
        "name": "Mood & stress", "unit": "/5", "zone": "head",
        "why": "Isolation and confinement raise the risk of anxiety and depression; NASA requires psychosocial monitoring in-mission.",
        "how": "Daily 1–5 self-rating of mood and stress. Private: shared only with the flight surgeon / psychologist.",
        "sources": ["nasa_behavior", "nasa_std3001_v1_3004"],
    },
    "exercise": {
        "name": "Exercise today", "unit": "min", "zone": "legs",
        "why": "Bones lose 1–1.5% density per month; ISS crews exercise ~1.5 h/day to protect bone, muscle and heart.",
        "how": "Logged automatically from exercise-device sessions and heart-rate zones.",
        "sources": ["nasa_bone", "nasa_fitness"],
    },
    "cycle": {
        "name": "Menstrual cycle", "unit": "", "zone": "abdomen",
        "why": "Female astronauts often suppress menstruation on long missions; tracking the cycle or breakthrough bleeding helps the flight surgeon manage supplies, hygiene and health.",
        "how": "Opt-in and private. Log the first day of each period, flow and symptoms; turn on suppression if you use continuous hormonal contraception.",
        "sources": ["npj_amenorrhea", "owh_cycle"],
    },
    "radiation": {
        "name": "Radiation dose", "unit": "mSv", "zone": "body",
        "why": "Radiation is one of the most hazardous aspects of spaceflight; Moon and Mars missions leave Earth's magnetosphere.",
        "how": "Personal active dosimeter worn by each crew member; cumulative career dose compared to the NASA limit.",
        "sources": ["nasa_radiation", "nasa_std3001_v1_4030"],
    },
}


# --- Rules ---------------------------------------------------------------------

def assess_hr(hr: float, activity: str) -> Finding:
    v = f"{hr:.0f} bpm"
    if activity != "rest":
        return Finding("hr", NORMAL, f"During {activity}", "Resting norms do not apply during exercise or sleep transitions.", ["mp_vitals"], "source", v)
    if hr < 40:
        return Finding("hr", ALERT, "Very low (below athlete range)", "Sit/strap in, re-measure in 2 min. Report dizziness or fainting to the flight surgeon.", ["mp_pulse"], "app", v)
    if hr < 60:
        return Finding("hr", NORMAL, "Low – typical for trained athletes", "No action if you feel well.", ["mp_pulse"], "source", v)
    if hr <= 100:
        return Finding("hr", NORMAL, "Normal resting", "No action needed.", ["mp_pulse"], "source", v)
    if hr <= 120:
        return Finding("hr", WATCH, "Elevated at rest (tachycardia)", "Rest 5 min, hydrate, try slow breathing, then re-measure. Persistently high resting HR should be reviewed.", ["mp_pulse"], "source", v)
    return Finding("hr", ALERT, "High at rest", "Stop activity, rest strapped in. Ground notified automatically. Check ECG rhythm.", ["mp_pulse", "nasa_cardio"], "app", v)


def assess_rhythm(irregular: bool) -> Finding:
    if irregular:
        return Finding("rhythm", ALERT, "Irregular rhythm detected", "Stay at rest. ECG strip sent to flight surgeon for interpretation. Report palpitations, chest pain or dizziness.", ["nasa_cardio", "nasa_std3001_v1_3004"], "app", "irregular")
    return Finding("rhythm", NORMAL, "Regular rhythm", "No action needed.", ["nasa_cardio"], "source", "regular")


def assess_bp(sys: float, dia: float, baseline_sys: float, symptoms: set[str]) -> Finding:
    v = f"{sys:.0f}/{dia:.0f}"
    dizzy = bool(symptoms & {"dizziness", "fainting"})
    drop = baseline_sys - sys
    if sys < 90 or dia < 60 or drop >= 20:
        why = "Below normal range" if (sys < 90 or dia < 60) else f"Dropped {drop:.0f} mmHg from baseline"
        if dizzy:
            return Finding("bp", ALERT, f"{why} with symptoms", "Lie/strap down, raise legs, drink fluids. Ground notified. Compression garments before gravity transitions.", ["mp_lbp", "nasa_cardio"], "source", v)
        return Finding("bp", WATCH, why, "Drink fluids, avoid fast posture changes, re-measure in 15 min.", ["mp_lbp", "nasa_cardio"], "source", v)
    if sys >= 140 or dia >= 90:
        return Finding("bp", ALERT, "High (Stage 2 range)", "Rest 5 min and re-measure. If confirmed, flight surgeon reviews. Report headache or vision changes.", ["mp_hbp"], "source", v)
    if sys >= 130 or dia >= 80:
        return Finding("bp", WATCH, "High (Stage 1 range)", "Re-measure at rest; reduce sodium, keep up exercise and sleep.", ["mp_hbp"], "source", v)
    if sys >= 120:
        return Finding("bp", WATCH, "Elevated", "Lifestyle measures: exercise, sleep, salt intake.", ["mp_hbp"], "source", v)
    return Finding("bp", NORMAL, "Normal", "No action needed.", ["mp_hbp", "mp_lbp"], "source", v)


def assess_spo2(spo2: float) -> Finding:
    v = f"{spo2:.0f}%"
    if spo2 <= 88:
        return Finding("spo2", CRITICAL, "Critically low oxygen", "Immediate: put on oxygen mask per procedure, alert crew medical officer. Ground notified with top priority.", ["mp_pulseox", "nasa_hypoxia"], "source", v)
    if spo2 <= 92:
        return Finding("spo2", ALERT, "Low oxygen", "Re-check sensor placement and warmth of fingers. Check cabin O2/pressure. Flight surgeon notified.", ["mp_pulseox", "nasa_hypoxia"], "source", v)
    if spo2 < 95:
        return Finding("spo2", WATCH, "Below normal range", "Re-measure at rest; watch for headache, confusion or vision changes.", ["mp_pulseox", "nasa_hypoxia"], "source", v)
    return Finding("spo2", NORMAL, "Normal", "No action needed.", ["mp_pulseox"], "source", v)


def assess_rr(rr: float, activity: str) -> Finding:
    v = f"{rr:.0f}/min"
    if activity != "rest":
        return Finding("rr", NORMAL, f"During {activity}", "Resting norms do not apply during exercise.", ["mp_vitals"], "source", v)
    if rr < 8 or rr > 24:
        return Finding("rr", ALERT, "Far outside normal", "Check SpO2 and cabin CO2. Crew medical officer to assess.", ["mp_vitals"], "app", v)
    if rr < 12 or rr > 18:
        return Finding("rr", WATCH, "Outside normal resting range", "Rest and re-count for 60 s.", ["mp_vitals"], "source", v)
    return Finding("rr", NORMAL, "Normal", "No action needed.", ["mp_vitals"], "source", v)


def assess_temp(t: float, activity: str) -> Finding:
    v = f"{t:.1f} °C"
    if t > 38.0:
        if activity == "exercise":
            return Finding("temp", WATCH, "High during exercise", "Core temperature rises faster in space during exercise: slow down, hydrate, cool down.", ["nasa_wearables", "mp_temp"], "source", v)
        return Finding("temp", ALERT, "Fever", "Rest, hydrate, check for infection symptoms. Flight surgeon notified.", ["mp_temp", "nasa_immune"], "source", v)
    if t > 37.2:
        return Finding("temp", WATCH, "Above normal range", "Re-measure in 30 min at rest.", ["mp_temp"], "source", v)
    if t < 36.1:
        return Finding("temp", WATCH, "Below normal range", "Check cabin temperature and re-measure.", ["mp_temp"], "source", v)
    return Finding("temp", NORMAL, "Normal", "No action needed.", ["mp_temp"], "source", v)


def assess_glucose(g: float | None) -> Finding | None:
    if g is None:
        return None
    v = f"{g:.0f} mg/dL"
    if g < 70:
        return Finding("glucose", ALERT, "Low (hypoglycemia)", "Take fast-acting carbohydrate now, re-check in 15 min.", ["mp_hypoglycemia"], "source", v)
    if g >= 126:
        return Finding("glucose", ALERT, "High fasting glucose", "Re-test tomorrow fasting; flight surgeon reviews diet and trend.", ["mp_glucose"], "source", v)
    if g >= 100:
        return Finding("glucose", WATCH, "Impaired fasting range", "Review diet and exercise; repeat in 3 days.", ["mp_glucose"], "source", v)
    return Finding("glucose", NORMAL, "Normal fasting", "No action needed.", ["mp_glucose"], "source", v)


def assess_sleep(h: float | None) -> Finding | None:
    if h is None:
        return None
    v = f"{h:.1f} h"
    if h < 5:
        return Finding("sleep", ALERT, "Severe sleep loss", "Request schedule adjustment; avoid critical tasks if possible. Use sleep-hygiene routine tonight.", ["nhlbi_sleep", "nasa_sleep"], "app", v)
    if h < 7:
        return Finding("sleep", WATCH, "Below recommended 7 h", "Dim lights before sleep period, limit late caffeine, try the body-scan meditation.", ["nhlbi_sleep", "nasa_sleep"], "source", v)
    return Finding("sleep", NORMAL, "Recommended 7–9 h", "Keep the routine.", ["nhlbi_sleep"], "source", v)


def assess_mood(mood: int | None, stress: int | None) -> Finding | None:
    if mood is None:
        return None
    v = f"mood {mood}/5, stress {stress}/5"
    if mood <= 1:
        return Finding("mood", ALERT, "Very low mood", "Private conference with the crew psychologist offered. Try a guided breathing session now.", ["nasa_behavior", "nasa_std3001_v1_3004"], "app", v)
    if mood == 2 or (stress or 0) >= 4:
        return Finding("mood", WATCH, "Low mood or high stress", "Recommended: 5-min slow diaphragmatic breathing, journaling, Earth-view break.", ["nasa_behavior", "nccih_relax"], "app", v)
    return Finding("mood", NORMAL, "Good", "Keep it up – journaling helps sustain morale.", ["nasa_behavior"], "source", v)


def assess_exercise(minutes: float) -> Finding:
    v = f"{minutes:.0f} min"
    if minutes >= 90:
        return Finding("exercise", NORMAL, "Daily target met", "Great – bone and muscle protection on track.", ["nasa_fitness"], "source", v)
    return Finding("exercise", WATCH, "Below ISS daily routine (~90 min)", "Schedule resistance + aerobic session today.", ["nasa_fitness", "nasa_bone"], "source", v)


CAREER_LIMIT_MSV = 600.0


def assess_radiation(career_msv: float) -> Finding:
    pct = career_msv / CAREER_LIMIT_MSV * 100
    v = f"{career_msv:.1f} mSv ({pct:.1f}% of limit)"
    if pct >= 80:
        return Finding("radiation", ALERT, "Approaching career limit", "Minimise exposure (ALARA). Mission planning review with ground.", ["nasa_std3001_v1_4030"], "app", v)
    if pct >= 50:
        return Finding("radiation", WATCH, "Over half of career limit", "Follow ALARA: use shielded areas during solar events.", ["nasa_std3001_v1_4030"], "app", v)
    return Finding("radiation", NORMAL, "Within limit", "Keep following ALARA.", ["nasa_std3001_v1_4030"], "source", v)


def assess_cycle(cycle: dict | None, today) -> Finding | None:
    """Menstrual-cycle rules (opt-in). Thresholds from HHS Office on Women's Health."""
    from datetime import date as _date
    if not cycle or not cycle.get("enabled"):
        return None
    periods = sorted(cycle.get("periods", []), key=lambda p: p["start"])
    if cycle.get("suppression"):
        recent = [p for p in periods if (today - _date.fromisoformat(p["start"])).days <= 30]
        if recent:
            return Finding("cycle", WATCH, "Breakthrough bleeding on suppression", "Log flow daily. Flight surgeon reviews the regimen and hygiene supplies.", ["npj_amenorrhea"], "app", "Suppression on")
        return Finding("cycle", NORMAL, "No bleeding – expected with suppression", "No action needed.", ["npj_amenorrhea"], "source", "Suppression on")
    if not periods:
        return Finding("cycle", NORMAL, "No periods logged yet", "Log the first day of your next period.", ["owh_cycle"], "source", "")
    last = periods[-1]
    day = (today - _date.fromisoformat(last["start"])).days + 1
    length = None
    if len(periods) >= 2:
        length = (_date.fromisoformat(last["start"]) - _date.fromisoformat(periods[-2]["start"])).days
    value = f"Cycle day {day}" + (f" · last cycle {length} d" if length else "")
    recent = day <= 14
    if recent and (last.get("flow") == "very_heavy" or (last.get("days") or 0) > 8):
        return Finding("cycle", WATCH, "Signs of heavy bleeding", "Flight surgeon notified privately. Hydrate and report dizziness or fatigue.", ["owh_cycle"], "source", value)
    if day > 90:
        return Finding("cycle", WATCH, "No period for over 90 days", "Discuss with the flight surgeon at the next private conference.", ["owh_cycle"], "source", value)
    if length is not None and (length < 24 or length > 38):
        return Finding("cycle", WATCH, "Cycle length outside 24–38 days", "Keep logging; the flight surgeon reviews the trend.", ["owh_cycle"], "source", value)
    return Finding("cycle", NORMAL, "Regular cycle", "Keep logging the first day of each period.", ["owh_cycle"], "source", value)


def assess_all(v: dict, checkin: dict | None, baseline_sys: float, cycle: dict | None = None) -> list[Finding]:
    symptoms = set((checkin or {}).get("symptoms", [])) | set(v.get("symptoms", []))
    out = [
        assess_hr(v["hr"], v["activity"]),
        assess_rhythm(v["irregular"]),
        assess_bp(v["sys"], v["dia"], baseline_sys, symptoms),
        assess_spo2(v["spo2"]),
        assess_rr(v["rr"], v["activity"]),
        assess_temp(v["temp"], v["activity"]),
        assess_exercise(v["exercise_min"]),
        assess_radiation(v["career_msv"]),
    ]
    if checkin:
        for f in (assess_glucose(checkin.get("glucose")), assess_sleep(checkin.get("sleep_hours")),
                  assess_mood(checkin.get("mood"), checkin.get("stress"))):
            if f:
                out.append(f)
    from datetime import date as _date
    cf = assess_cycle(cycle, _date.today())
    if cf:
        out.append(cf)
    return out


def overall(findings: list[Finding]) -> int:
    return max((f.level for f in findings), default=NORMAL)


def zone_levels(findings: list[Finding]) -> dict[str, int]:
    zones: dict[str, int] = {}
    for f in findings:
        z = METRICS[f.metric]["zone"]
        zones[z] = max(zones.get(z, NORMAL), f.level)
    return zones
