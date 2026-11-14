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
import AccountMenu from './AccountMenu'
import { Navigate } from 'react-router-dom'

const ORDER = ['normal', 'watch', 'alert', 'critical']

function LinkBar({ s, staff }: { s: OnboardState | null; staff: boolean }) {
  const t = useT()
  const lang = useLang()
  if (!s) return <div className="statusbar"><span className="seg"><span className="dot" /> {t('Connecting')}</span></div>
  const worst = s.crew.reduce((w, c) => (ORDER.indexOf(c.overall) > ORDER.indexOf(w) ? c.overall : w), 'normal')
  return (
    <div className="statusbar" role="status" aria-label={t('Mission status')}>
      <span className={`seg state ${worst}`}><span className={`dot ${worst}`} />{t(staff ? 'Crew' : 'My status')} · {t(worst)}</span>
      <span className="seg">{t(s.link.location_name)}</span>
      <span className="seg">{t('Delay')} <b>{fmtDelayL(lang, s.link.real_delay_s)}</b>{s.link.compression > 1 ? ` · ${t('demo')} ${fmtDelayL(lang, s.link.demo_delay_s)}` : ''}</span>
      <span className={`seg ${s.link.outage ? 'state watch' : ''}`}>
        {s.link.outage ? <><span className="dot watch" />{t('LOS · storing')}</> : <><span className="dot normal" />{t('Link up')}</>} · Q {s.link.downlink_pending.total}
      </span>
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
        <div className="brand"><img className="brand-logo" src="/brand/garyshcare-icon.jpg" alt="" />GaryshCare</div>
        <nav className="nav">
          <NavLink to="/" end>{t(staff ? 'Crew' : 'My health')}</NavLink>
          {!staff && <NavLink to="/wellbeing">{t('Check-in')}</NavLink>}
          {staff && <NavLink to="/ground">{t('Mission Control')}</NavLink>}
          <NavLink to="/evidence">{t('Evidence')}</NavLink>
        </nav>
        <div className="spacer" />
        <LinkBar s={onboard} staff={staff} />
        <Toggles {...prefs} />
        <AccountMenu user={user} onLogout={onLogout} />
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
            <div className="photo-credit">Photo: NASA · ISS030-E-055569</div>
            <BrowserRouter>
              {user ? <Shell key={user.username} user={user} onLogout={logout} {...prefs} /> : (
                <div className="app login-shell">
                  <header className="topbar" style={{ position: 'relative', zIndex: 1 }}><div className="spacer" /><Toggles {...prefs} /></header>
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
