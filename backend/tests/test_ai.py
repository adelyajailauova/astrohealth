import os, random, sys
from collections import deque

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app import assess as A
from app import ai as ai_layer
from app.simulator import Simulator

AI = ai_layer.get_ai()


def run(scenario, ticks, crew="c1", seed=5):
    random.seed(seed)
    sim = Simulator(); sim.set_scenario(crew, scenario)
    hist = deque(maxlen=300); st = None
    for _ in range(ticks):
        sim.step(1.0)
        c = sim.crew[crew]; v = sim.snapshot(c)
        hist.append({"t": 0.0, "activity": v["activity"], **{k: v[k] for k in ("hr", "sys", "dia", "spo2", "rr", "temp")}})
        st = [f.to_dict() for f in A.assess_all(v, None, c.base_sys)]
    return hist, st


def test_warmup_not_ready():
    hist, f = run("normal", 5)
    r = ai_layer.ai_summary(AI, hist, f)
    assert r == {"ready": False, "have": 5, "need": AI.forecaster.lags}


def test_normal_is_quiet():
    hist, f = run("normal", 80)
    r = ai_layer.ai_summary(AI, hist, f, "en")
    assert r["ready"] and not r["anomaly"]["sustained"]
    assert set(r["forecast"]) == {"hr", "sys", "dia", "spo2", "rr", "temp"}


def test_hypoxia_is_detected_and_critical():
    hist, f = run("hypoxia", 120)
    r = ai_layer.ai_summary(AI, hist, f, "ru")
    assert r["anomaly"]["is_anomaly"] and r["anomaly"]["sustained"]
    assert any(c["metric"] == "spo2" for c in r["anomaly"]["contributors"])
    assert r["level_name"] in ("ALERT", "CRITICAL") and "SpO2" in r["text"]


def test_other_clinical_scenarios_flagged():
    for sc in ("arrhythmia", "fever", "orthostatic"):
        hist, f = run(sc, 120)
        assert ai_layer.ai_summary(AI, hist, f)["anomaly"]["sustained"], sc


def test_exercise_is_not_an_anomaly():
    hist, f = run("exercise", 120)
    assert not ai_layer.ai_summary(AI, hist, f)["anomaly"]["sustained"]


def test_private_findings_hidden_from_staff():
    hist, f = run("normal", 80)
    f = f + [{"metric": "mood", "level": 2, "status": "alert", "label": "Very low mood", "advice": "private", "value": ""}]
    staff = ai_layer.ai_summary(AI, hist, f, "en", include_private=False)
    own = ai_layer.ai_summary(AI, hist, f, "en", include_private=True)
    assert "Very low mood" not in staff["text"] and "Very low mood" in own["text"]


def test_forecast_follows_hypoxia_ramp():
    hist, _ = run("hypoxia", 22)          
    r = ai_layer.ai_summary(AI, hist, [], "en")
    assert r["forecast"]["spo2"]["horizons"][15]["pred"] < r["forecast"]["spo2"]["current"]


if __name__ == "__main__":
    for n, fn in list(globals().items()):
        if n.startswith("test_"):
            fn(); print("OK ", n)
