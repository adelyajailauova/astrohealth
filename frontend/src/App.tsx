import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { fmtDelay, MetaContext, useSocket } from './api'
import type { GroundState, Meta, OnboardState } from './api'
import CrewPage from './pages/Crew'
import EvidencePage from './pages/Evidence'
import GroundPage from './pages/Ground'
import WellbeingPage from './pages/Wellbeing'

function LinkBar({ s }: { s: OnboardState | null }) {
  if (!s) return <span className="pill"><span className="dot" /> connecting…</span>
  const worst = s.crew.reduce((w, c) => (['normal', 'watch', 'alert', 'critical'].indexOf(c.overall) > ['normal', 'watch', 'alert', 'critical'].indexOf(w) ? c.overall : w), 'normal')
  return (
    <div className="linkbar">
      <span className="pill"><span className={`dot ${worst}`} /> crew status: {worst}</span>
      <span className="pill">📍 {s.link.location_name}</span>
      <span className="pill">📡 delay {fmtDelay(s.link.real_delay_s)}{s.link.compression > 1 ? ` (demo ${fmtDelay(s.link.demo_delay_s)})` : ''}</span>
      <span className="pill">{s.link.outage ? <><span className="dot watch" /> LOS – storing</> : <><span className="dot normal" /> link up</>} · queue {s.link.downlink_pending.total}</span>
    </div>
  )
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const onboard = useSocket<OnboardState>('/ws/onboard')
  const ground = useSocket<GroundState>('/ws/ground')
  useEffect(() => { fetch('/api/meta').then((r) => r.json()).then(setMeta) }, [])

  return (
    <MetaContext.Provider value={meta}>
      <BrowserRouter>
        <div className="app">
          <div className="topbar">
            <div className="brand">🛰 Astro<span>Health</span></div>
            <nav className="nav">
              <NavLink to="/" end>Crew console</NavLink>
              <NavLink to="/wellbeing">Check-in & wellbeing</NavLink>
              <NavLink to="/ground">Mission Control</NavLink>
              <NavLink to="/evidence">Evidence</NavLink>
            </nav>
            <div className="spacer" />
            <LinkBar s={onboard} />
          </div>
          <Routes>
            <Route path="/" element={<CrewPage state={onboard} />} />
            <Route path="/wellbeing" element={<WellbeingPage state={onboard} />} />
            <Route path="/ground" element={<GroundPage state={ground} />} />
            <Route path="/evidence" element={<EvidencePage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </MetaContext.Provider>
  )
}
