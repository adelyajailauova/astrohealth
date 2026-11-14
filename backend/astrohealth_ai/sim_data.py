
"""Generate training data using your backend/app/simulator.py.

The simulator randomly switches between scenarios (normal, exercise, orthostatic,
arrhythmia, hypoxia, fever, solar). One tick represents one mission minute,
consistent with simulator.py/main.py.

is_anomaly=1 indicates a clinical scenario that has fully developed
(scenario_t >= 10 ticks).
transition=1 marks transition ticks (ramp-up/recovery), which are excluded
from normal data and evaluation.

Run this script from the backend/ directory (requires importing app.simulator).
"""

import numpy as np
import pandas as pd

CLINICAL = {"orthostatic", "arrhythmia", "hypoxia", "fever"}
WEIGHTS = {"normal": 0.38, "exercise": 0.17, "orthostatic": 0.1, "arrhythmia": 0.1,
           "hypoxia": 0.1, "fever": 0.1, "solar": 0.05}
ONSET_TICKS = 10      # The condition is still developing before this point
RECOVERY_TICKS = 25   # Metrics return to normal after a clinical scenario ends


def generate(ticks: int = 12000, seed: int = 0) -> pd.DataFrame:
    import random
    from app.simulator import Simulator
    random.seed(seed)
    rng = np.random.default_rng(seed)
    sim = Simulator()
    names, p = list(WEIGHTS), np.array(list(WEIGHTS.values()))
    rem = {cid: 0 for cid in sim.crew}
    rows = {cid: [] for cid in sim.crew}
    last_clinical = {cid: -10**9 for cid in sim.crew}   # Tick of the most recent clinical scenario

    for tick in range(ticks):
        for cid in sim.crew:
            if rem[cid] <= 0:
                sim.set_scenario(cid, str(rng.choice(names, p=p / p.sum())))
                rem[cid] = int(rng.integers(40, 200))
            rem[cid] -= 1

        sim.step(1.0)

        for cid, c in sim.crew.items():
            s = sim.snapshot(c)
            clinical = c.scenario in CLINICAL

            if clinical:
                last_clinical[cid] = tick

            # Exclude ramp-up and recovery periods from normal data and confirmed anomalies
            transition = (clinical and c.scenario_t < ONSET_TICKS) or (not clinical and tick - last_clinical[cid] <= RECOVERY_TICKS)

            rows[cid].append({"crew": cid, "tick": tick, "scenario": c.scenario,
                              **{k: s[k] for k in ("hr", "sys", "dia", "spo2", "rr", "temp", "activity")},
                              "is_anomaly": int(clinical and c.scenario_t >= ONSET_TICKS), "transition": int(transition)})

    df = pd.concat([pd.DataFrame(r) for r in rows.values()], ignore_index=True)
    df["timestamp"] = pd.Timestamp("2026-01-01") + pd.to_timedelta(df["tick"], unit="min")
    return df
