import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { fmtDelay, MetaContext, ThemeContext, useSocket } from './api'
import type { GroundState, Meta, OnboardState, Theme } from './api'
import CrewPage from './pages/Crew'
import EvidencePage from './pages/Evidence'
import GroundPage from './pages/Ground'
import WellbeingPage from './pages/Wellbeing'

const ORDER = ['normal', 'watch', 'alert', 'critical']

function LinkBar({ s }: { s: OnboardState | null }) {
  if (!s) return <span className="pill"><span className="dot" /> Connecting</span>
  const worst = s.crew.reduce((w, c) => (ORDER.indexOf(c.overall) > ORDER.indexOf(w) ? c.overall : w), 'normal')
  return (
    <div className="linkbar">
      <span className="pill"><span className={`dot ${worst}`} /> Crew {worst}</span>
      <span className="pill">{s.link.location_name}</span>
      <span className="pill">Delay {fmtDelay(s.link.real_delay_s)}{s.link.compression > 1 ? ` · demo ${fmtDelay(s.link.demo_delay_s)}` : ''}</span>
      <span className="pill">{s.link.outage ? <><span className="dot watch" /> LOS · storing</> : <>Link up</>} · Q {s.link.downlink_pending.total}</span>
    </div>
  )
}

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {(['light', 'dark'] as Theme[]).map((t) => (
        <button key={t} className={theme === t ? 'on' : ''} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t}</button>
      ))}
    </div>
  )
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || 'light')
  const onboard = useSocket<OnboardState>('/ws/onboard')
  const ground = useSocket<GroundState>('/ws/ground')
  useEffect(() => { fetch('/api/meta').then((r) => r.json()).then(setMeta) }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch { /* private mode */ }
  }, [theme])

  return (
    <ThemeContext.Provider value={theme}>
      <MetaContext.Provider value={meta}>
        <BrowserRouter>
          <div className="app">
            <header className="topbar">
              <div className="brand"><span className="brand-mark" aria-hidden="true" />AstroHealth</div>
              <nav className="nav">
                <NavLink to="/" end>Crew</NavLink>
                <NavLink to="/wellbeing">Check-in</NavLink>
                <NavLink to="/ground">Mission Control</NavLink>
                <NavLink to="/evidence">Evidence</NavLink>
              </nav>
              <div className="spacer" />
              <LinkBar s={onboard} />
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </header>
            <Routes>
              <Route path="/" element={<CrewPage state={onboard} />} />
              <Route path="/wellbeing" element={<WellbeingPage state={onboard} />} />
              <Route path="/ground" element={<GroundPage state={ground} />} />
              <Route path="/evidence" element={<EvidencePage />} />
            </Routes>
          </div>
        </BrowserRouter>
      </MetaContext.Provider>
    </ThemeContext.Provider>
  )
}
