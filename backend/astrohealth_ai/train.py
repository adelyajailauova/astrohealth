
"""Train the AstroHealth AI module. Run from the backend/ directory:

  python -m astrohealth_ai.train                      # using your simulator.py data
  python -m astrohealth_ai.train --csv data.csv       # using real data

CSV columns: hr,sys,dia,spo2,rr,temp,activity[,is_anomaly][,crew]
One row represents one tick/minute, in chronological order.
"""

import argparse, json, os
import pandas as pd
from . import AstroHealthAI

p = argparse.ArgumentParser()
p.add_argument("--csv")
p.add_argument("--ticks", type=int, default=12000, help="Number of ticks per crew member")
p.add_argument("--seed", type=int, default=0)
p.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "models", "astrohealth_ai.joblib"))
a = p.parse_args()

if a.csv:
    df = pd.read_csv(a.csv)
else:
    from .sim_data import generate
    df = generate(a.ticks, a.seed)
    print(f"Generated {len(df)} rows from app/simulator.py ({df['crew'].nunique()} crew)")

ai = AstroHealthAI().fit(df)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
ai.save(a.out)

fc = pd.DataFrame(ai.report["forecast"])
cols = ["metric", "horizon_min", "mae", "baseline_mae", "ma5_mae", "improvement_vs_baseline_%", "interval_coverage_%"]
print(fc[fc.horizon_min.isin([15, 30])][cols].to_string(index=False))
print("Mean forecast improvement vs persistence baseline:", ai.report["forecast_mean_improvement_%"], "%")
if "anomaly" in ai.report:
    print("Anomaly detection:", json.dumps(ai.report["anomaly"]))
print("Saved ->", os.path.abspath(a.out))
