import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { get, MetaContext, post, setToken, setUnauthorizedHandler, ThemeContext, UserContext, useSocket, getToken } from './api'
import type { GroundState, Meta, OnboardState, Theme, User } from './api'
import { fmtDelayL, LangContext, LANGS, useLang, useT } from './i18n'
import type { Lang } from './i18n'
import CrewPage from './pages/Crew'
import EvidencePage from './pages/Evidence'
import GroundPage from './pages/Ground'
import WellbeingPage from './pages/Wellbeing'
import LoginPage from './pages/Login'
import { Navigate } from 'react-router-dom'

const ORDER = ['normal', 'watch', 'alert', 'critical']

function LinkBar({ s }: { s: OnboardState | null }) {
  const t = useT()
  const lang = useLang()
  if (!s) return <span className="pill"><span className="dot" /> {t('Connecting')}</span>
  const worst = s.crew.reduce((w, c) => (ORDER.indexOf(c.overall) > ORDER.indexOf(w) ? c.overall : w), 'normal')
  return (
    <div className="linkbar">
      <span className="pill"><span className={`dot ${worst}`} /> {t('Crew')} · {t(worst)}</span>
      <span className="pill">{t(s.link.location_name)}</span>
      <span className="pill">{t('Delay')} {fmtDelayL(lang, s.link.real_delay_s)}{s.link.compression > 1 ? ` · ${t('demo')} ${fmtDelayL(lang, s.link.demo_delay_s)}` : ''}</span>
      <span className="pill">{s.link.outage ? <><span className="dot watch" /> {t('LOS · storing')}</> : t('Link up')} · Q {s.link.downlink_pending.total}</span>
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string
}) {
  return (
    <div className="theme-toggle" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'on' : ''} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

function readLang(): Lang {
  try { const l = localStorage.getItem('lang'); if (l === 'ru' || l === 'en' || l === 'kk') return l } catch { /* ignore */ }
  return 'ru'
}

type Prefs = { theme: Theme; setTheme: (t: Theme) => void; lang: Lang; setLang: (l: Lang) => void }

function Toggles({ theme, setTheme, lang, setLang }: Prefs) {
  const t = useT()
  return (
    <>
      <Segmented value={lang} onChange={setLang} label={t('Language')} options={LANGS} />
      <Segmented value={theme} onChange={setTheme} label={t('Theme')}
        options={(['light', 'dark'] as Theme[]).map((id) => ({ id, label: t(id) }))} />
    </>
  )
}

function Shell({ user, onLogout, ...prefs }: Prefs & { user: User; onLogout: () => void }) {
  const t = useT()
  const staff = user.role === 'staff'
  const onboard = useSocket<OnboardState>('/ws/onboard')
  const ground = useSocket<GroundState>(staff ? '/ws/ground' : null)
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true" />AstroHealth</div>
        <nav className="nav">
          <NavLink to="/" end>{t(staff ? 'Crew' : 'My health')}</NavLink>
          {!staff && <NavLink to="/wellbeing">{t('Check-in')}</NavLink>}
          {staff && <NavLink to="/ground">{t('Mission Control')}</NavLink>}
          <NavLink to="/evidence">{t('Evidence')}</NavLink>
        </nav>
        <div className="spacer" />
        <LinkBar s={onboard} />
        <Toggles {...prefs} />
        <div className="row" style={{ gap: 8 }}>
          <span className="pill" title={user.username}>{t(staff ? 'Medical staff' : 'Astronaut')} · {t(user.name)}</span>
          <button onClick={onLogout} style={{ fontSize: 13, padding: '6px 12px' }}>{t('Sign out')}</button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<CrewPage state={onboard} />} />
        <Route path="/wellbeing" element={staff ? <Navigate to="/" replace /> : <WellbeingPage state={onboard} />} />
        <Route path="/ground" element={staff ? <GroundPage state={ground} /> : <Navigate to="/" replace />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || 'light')
  const [lang, setLang] = useState<Lang>(readLang)
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(() => !!getToken())
  useEffect(() => { fetch('/api/meta').then((r) => r.json()).then(setMeta) }, [])
  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(null); setUser(null) })
    if (!getToken()) return
    get<User>('/api/me').then(setUser).catch(() => setToken(null)).finally(() => setChecking(false))
  }, [])
  const logout = () => { post('/api/logout', {}).catch(() => {}); setToken(null); setUser(null) }
  const prefs = { theme, setTheme, lang, setLang }
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch { /* private mode */ }
  }, [theme])
  useEffect(() => {
    document.documentElement.lang = lang
    try { localStorage.setItem('lang', lang) } catch { /* private mode */ }
  }, [lang])

  return (
    <LangContext.Provider value={lang}>
      <ThemeContext.Provider value={theme}>
        <MetaContext.Provider value={meta}>
          <UserContext.Provider value={user}>
            <BrowserRouter>
              {user ? <Shell key={user.username} user={user} onLogout={logout} {...prefs} /> : (
                <div className="app">
                  <header className="topbar"><div className="spacer" /><Toggles {...prefs} /></header>
                  {!checking && <LoginPage onLogin={setUser} />}
                </div>
              )}
            </BrowserRouter>
          </UserContext.Provider>
        </MetaContext.Provider>
      </ThemeContext.Provider>
    </LangContext.Provider>
  )
}
