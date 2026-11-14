"""GaryshCare backend: onboard health node + simulated space link to Mission Control."""

from __future__ import annotations

import asyncio
import time
from collections import deque
from contextlib import asynccontextmanager, suppress
from datetime import date, timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import assess as A
from . import auth
from .comms import DEMO_COMPRESSION, LOCATIONS, Link, demo_delay
from .simulator import SCENARIOS, Simulator
from .sources import SOURCES

sim = Simulator()
downlink, uplink = Link(), Link()

history: dict[str, deque] = {cid: deque(maxlen=300) for cid in sim.crew}
last_levels: dict[str, dict[str, int]] = {cid: {} for cid in sim.crew}
pending_levels: dict[str, dict[str, tuple[int, int]]] = {cid: {} for cid in sim.crew}
STABLE_TICKS = 3
checkins: dict[str, dict] = {}
checkin_log: dict[str, list] = {cid: [] for cid in sim.crew}
wellbeing: dict[str, dict] = {cid: {"points": 0, "streak": 0, "sessions": []} for cid in sim.crew}
onboard_inbox: dict[str, list] = {cid: [] for cid in sim.crew}
onboard_events: deque = deque(maxlen=50)
ground_reports: deque = deque(maxlen=100)
ground_telemetry: dict = {}
ground_messages: deque = deque(maxlen=50)
current: dict[str, dict] = {}
cycles: dict[str, dict] = {cid: {"enabled": False, "suppression": False, "periods": []} for cid in sim.crew}
PRIVATE_METRICS = {"mood", "cycle"}
tick = 0


def _seed_demo_history() -> None:
    """Seed 6 days of check-ins so trends and streaks are visible in the demo (labelled demo data)."""
    import random
    random.seed(7)
    for cid in sim.crew:
        for d in range(6, 0, -1):
            day = (date.today() - timedelta(days=d)).isoformat()
            checkin_log[cid].append({
                "date": day, "mood": random.choice([3, 4, 4, 5]), "stress": random.choice([2, 2, 3]),
                "sleep_hours": round(random.uniform(5.8, 7.8), 1), "demo": True,
            })
        wellbeing[cid]["streak"] = 6
        wellbeing[cid]["points"] = 6 * 10
    # demo: one crew member has opted in to cycle tracking (labelled demo data)
    cycles["c2"] = {"enabled": True, "suppression": False, "demo": True, "periods": [
        {"start": (date.today() - timedelta(days=40)).isoformat(), "days": 5, "flow": "medium", "symptoms": ["cramps"]},
        {"start": (date.today() - timedelta(days=11)).isoformat(), "days": 5, "flow": "medium", "symptoms": []},
    ]}


_seed_demo_history()


def evaluate(cid: str) -> dict:
    c = sim.crew[cid]
    snap = sim.snapshot(c)
    findings = A.assess_all(snap, checkins.get(cid), c.base_sys, cycles[cid])
    return {
        "id": cid, "name": c.name, "role": c.role, "scenario": c.scenario,
        "vitals": snap, "findings": [f.to_dict() for f in findings],
        "overall": A.LEVEL_NAMES[A.overall(findings)],
        "zones": {z: A.LEVEL_NAMES[l] for z, l in A.zone_levels(findings).items()},
        "checkin": checkins.get(cid), "wellbeing": wellbeing[cid], "cycle": cycles[cid],
        "baseline": {"hr": c.base_hr, "sys": c.base_sys, "dia": c.base_dia, "temp": c.base_temp},
    }


def detect_changes(cid: str, state: dict) -> None:
    """Send a report to the ground whenever a metric's status changes (escalation or recovery)."""
    prev = last_levels[cid]
    pend = pending_levels[cid]
    for f in state["findings"]:
        lvl = f["level"]
        old = prev.get(f["metric"], A.NORMAL)
        if lvl == old:
            pend.pop(f["metric"], None)
            continue
        # debounce: a new status must hold for STABLE_TICKS seconds (critical is sent at once)
        cand, n = pend.get(f["metric"], (lvl, 0))
        n = n + 1 if cand == lvl else 1
        pend[f["metric"]] = (lvl, n)
        if lvl < A.CRITICAL and n < STABLE_TICKS:
            continue
        pend.pop(f["metric"], None)
        prev[f["metric"]] = lvl
        if lvl == A.NORMAL and old < A.ALERT:
            continue  # don't spam recoveries from 'watch'
        priority = f["status"] if lvl > A.NORMAL else "normal"
        report = {
            "crew_id": cid, "crew": state["name"], "metric": f["metric"],
            "metric_name": A.METRICS[f["metric"]]["name"], "status": f["status"],
            "label": f["label"] if lvl > A.NORMAL else f"Recovered: {f['label']}",
            "value": f["value"], "advice": f["advice"], "sources": f["sources"], "origin": f["origin"],
            "private": f["metric"] in PRIVATE_METRICS,
            "vitals": state["vitals"],
        }
        downlink.send("report", priority, report, sim.location)
        if lvl >= A.WATCH:
            onboard_events.appendleft({"t": time.time(), **{k: report[k] for k in ("crew_id", "crew", "metric_name", "status", "label", "advice")}})


async def loop() -> None:
    global tick
    while True:
        sim.step(1.0)
        tick += 1
        for cid in sim.crew:
            st = evaluate(cid)
            current[cid] = st
            v = st["vitals"]
            history[cid].append({"t": time.time(), **{k: v[k] for k in ("hr", "sys", "dia", "spo2", "rr", "temp")}})
            detect_changes(cid, st)
        if tick % 2 == 0:
            downlink.send("telemetry", "telemetry", {
                "crew": {cid: {"name": s["name"], "vitals": s["vitals"], "overall": s["overall"], "zones": s["zones"]}
                         for cid, s in current.items()},
            }, sim.location)
        for msg in downlink.due():
            if msg["kind"] == "telemetry":
                ground_telemetry.update(msg)
            else:
                ground_reports.appendleft(msg)
        for msg in uplink.due():
            onboard_inbox[msg["payload"]["crew_id"]].insert(0, msg)
        await asyncio.sleep(1.0)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(loop())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="GaryshCare", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def link_info(crew_id: str | None = None) -> dict:
    loc = LOCATIONS[sim.location]
    return {
        "location": sim.location, "location_name": loc["name"],
        "real_delay_s": loc["real_delay_s"], "demo_delay_s": demo_delay(sim.location),
        "compression": DEMO_COMPRESSION if loc["real_delay_s"] > 10 else 1,
        "delay_source": loc["source"], "outage": downlink.outage,
        "downlink_pending": downlink.pending(crew_id), "uplink_pending": uplink.pending(crew_id),
    }


def onboard_state(user: dict) -> dict:
    """What a signed-in user may see onboard: astronauts only their own record, staff everyone."""
    own = user.get("crew_id")
    visible = (lambda cid: True) if user["role"] == "staff" else (lambda cid: cid == own)
    return {
        "t": time.time(), "link": link_info(None if user["role"] == "staff" else own),
        "crew": [s for cid, s in current.items() if visible(cid)],
        "events": [e for e in onboard_events if visible(e["crew_id"])][:15],
        "inbox": {cid: msgs[:10] for cid, msgs in onboard_inbox.items() if visible(cid)},
    }


def ground_state() -> dict:
    return {
        "t": time.time(), "link": link_info(), "telemetry": ground_telemetry,
        "reports": list(ground_reports)[:60], "sent": list(ground_messages)[:20],
    }


# --- Auth helpers ----------------------------------------------------------------

def current_user(authorization: str | None = Header(default=None)) -> dict:
    token = authorization.removeprefix("Bearer ").strip() if authorization else None
    user = auth.user_for(token)
    if not user:
        raise HTTPException(401, "not signed in")
    return user


def require_staff(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "staff":
        raise HTTPException(403, "medical staff only")
    return user


def require_crew_access(user: dict, crew_id: str, write: bool = False) -> None:
    """Astronauts may read and write only their own record; staff may read all but not write astronaut self-reports."""
    if crew_id not in sim.crew:
        raise HTTPException(404, "unknown crew member")
    if user["role"] == "astronaut" and user["crew_id"] != crew_id:
        raise HTTPException(403, "you can only access your own data")
    if write and user["role"] != "astronaut":
        raise HTTPException(403, "only the astronaut can submit their own self-report")


# --- REST ------------------------------------------------------------------------

class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    pin: str = Field(min_length=1, max_length=20)


@app.get("/api/accounts")
def accounts():
    return auth.accounts()


@app.post("/api/login")
def login(body: LoginIn):
    token = auth.login(body.username, body.pin)
    if not token:
        raise HTTPException(401, "wrong account or PIN")
    return {"token": token, "user": auth.user_for(token)}


@app.post("/api/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization:
        auth.logout(authorization.removeprefix("Bearer ").strip())
    return {"ok": True}


@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    return user


@app.get("/api/meta")
def meta():
    return {"metrics": A.METRICS, "sources": SOURCES, "scenarios": SCENARIOS,
            "locations": LOCATIONS, "career_limit_msv": A.CAREER_LIMIT_MSV}


@app.get("/api/state")
def state(user: dict = Depends(current_user)):
    return onboard_state(user)


@app.get("/api/ground/state")
def gstate(_: dict = Depends(require_staff)):
    return ground_state()


@app.get("/api/history/{crew_id}")
def get_history(crew_id: str, user: dict = Depends(current_user)):
    require_crew_access(user, crew_id)
    return {"vitals": list(history[crew_id]), "checkins": checkin_log[crew_id]}


class ScenarioIn(BaseModel):
    crew_id: str
    scenario: str


@app.post("/api/scenario")
def set_scenario(body: ScenarioIn, user: dict = Depends(current_user)):
    require_crew_access(user, body.crew_id)
    if body.scenario not in SCENARIOS:
        raise HTTPException(400, "unknown scenario")
    sim.set_scenario(body.crew_id, body.scenario)
    return {"ok": True}


class LocationIn(BaseModel):
    location: str


@app.post("/api/location")
def set_location(body: LocationIn, _: dict = Depends(require_staff)):
    if body.location not in LOCATIONS:
        raise HTTPException(400)
    sim.location = body.location
    return link_info()


class LinkIn(BaseModel):
    outage: bool


@app.post("/api/link")
def set_link(body: LinkIn, _: dict = Depends(require_staff)):
    downlink.outage = uplink.outage = body.outage
    return link_info()


class CheckinIn(BaseModel):
    crew_id: str
    mood: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    sleep_hours: float = Field(ge=0, le=16)
    glucose: float | None = Field(default=None, ge=20, le=600)
    symptoms: list[str] = []
    journal: str = Field(default="", max_length=2000)


@app.post("/api/checkin")
def checkin(body: CheckinIn, user: dict = Depends(current_user)):
    require_crew_access(user, body.crew_id, write=True)
    data = body.model_dump()
    data["date"] = date.today().isoformat()
    data["submitted_at"] = time.time()
    checkins[body.crew_id] = data
    log = checkin_log[body.crew_id]
    log[:] = [c for c in log if c["date"] != data["date"]] + [
        {k: data[k] for k in ("date", "mood", "stress", "sleep_hours")}]
    wb = wellbeing[body.crew_id]
    first_today = wb.get("checked_on") != data["date"]
    if first_today:
        wb["points"] += 10
        wb["streak"] += 1
        wb["checked_on"] = data["date"]
    st = evaluate(body.crew_id)
    current[body.crew_id] = st
    recs = [f for f in st["findings"] if f["metric"] in ("mood", "sleep", "glucose")]
    suggest_wellbeing = any(f["level"] >= A.WATCH for f in recs if f["metric"] in ("mood", "sleep"))
    return {"findings": recs, "suggest_wellbeing": suggest_wellbeing, "wellbeing": wb,
            "submitted_at": data["submitted_at"], "first_today": first_today,
            "delivery_s": demo_delay(sim.location)}


class WellbeingIn(BaseModel):
    crew_id: str
    kind: str
    minutes: float
    mood_before: int | None = None
    mood_after: int | None = None


@app.post("/api/wellbeing")
def wellbeing_done(body: WellbeingIn, user: dict = Depends(current_user)):
    require_crew_access(user, body.crew_id, write=True)
    wb = wellbeing[body.crew_id]
    wb["points"] += 15
    wb["sessions"].insert(0, {**body.model_dump(), "t": time.time()})
    wb["sessions"] = wb["sessions"][:20]
    if body.mood_after is not None and body.crew_id in checkins:
        checkins[body.crew_id]["mood"] = body.mood_after
    return wb


class CycleSettingsIn(BaseModel):
    crew_id: str
    enabled: bool
    suppression: bool = False


@app.post("/api/cycle/settings")
def cycle_settings(body: CycleSettingsIn, user: dict = Depends(current_user)):
    require_crew_access(user, body.crew_id, write=True)
    cycles[body.crew_id].update(enabled=body.enabled, suppression=body.suppression)
    current[body.crew_id] = evaluate(body.crew_id)
    return cycles[body.crew_id]


class PeriodIn(BaseModel):
    crew_id: str
    start: date
    days: int | None = Field(default=None, ge=1, le=20)
    flow: str = Field(default="medium", pattern="^(light|medium|heavy|very_heavy)$")
    symptoms: list[str] = []


@app.post("/api/cycle/period")
def log_period(body: PeriodIn, user: dict = Depends(current_user)):
    require_crew_access(user, body.crew_id, write=True)
    if body.start > date.today():
        raise HTTPException(400, "start date is in the future")
    c = cycles[body.crew_id]
    entry = {"start": body.start.isoformat(), "days": body.days, "flow": body.flow, "symptoms": body.symptoms}
    c["periods"] = sorted([p for p in c["periods"] if p["start"] != entry["start"]] + [entry], key=lambda p: p["start"])[-24:]
    st = evaluate(body.crew_id)
    current[body.crew_id] = st
    return {"cycle": c, "finding": next((f for f in st["findings"] if f["metric"] == "cycle"), None)}


class GroundMsgIn(BaseModel):
    crew_id: str
    text: str = Field(min_length=1, max_length=500)


@app.post("/api/ground/message")
def ground_message(body: GroundMsgIn, _: dict = Depends(require_staff)):
    if body.crew_id not in sim.crew:
        raise HTTPException(404)
    msg = uplink.send("message", "message", {"crew_id": body.crew_id, "text": body.text,
                                              "from": "Flight Surgeon"}, sim.location)
    ground_messages.appendleft(msg)
    return msg


# --- WebSockets (token passed as ?token=) ----------------------------------------

async def _stream(ws: WebSocket, fn) -> None:
    await ws.accept()
    try:
        while True:
            await ws.send_json(fn())
            await asyncio.sleep(1.0)
    except (WebSocketDisconnect, RuntimeError):
        pass


@app.websocket("/ws/onboard")
async def ws_onboard(ws: WebSocket, token: str | None = None):
    user = auth.user_for(token)
    if not user:
        await ws.close(code=4401)
        return
    await _stream(ws, lambda: onboard_state(user))


@app.websocket("/ws/ground")
async def ws_ground(ws: WebSocket, token: str | None = None):
    user = auth.user_for(token)
    if not user or user["role"] != "staff":
        await ws.close(code=4403)
        return
    await _stream(ws, ground_state)
