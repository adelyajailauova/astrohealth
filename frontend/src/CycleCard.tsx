import { useState } from 'react'
import { post } from './api'
import type { CrewState, Finding } from './api'
import { SourceList, StatusBadge } from './components'
import { useLang, useT } from './i18n'

const FLOWS = ['light', 'medium', 'heavy', 'very_heavy'] as const
const FLOW_LABEL: Record<string, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy', very_heavy: 'Very heavy' }
const CYCLE_SYMPTOMS = ['cramps', 'headache', 'bloating', 'mood changes', 'fatigue', 'breast tenderness']
const today = () => new Date().toISOString().slice(0, 10)

/** Opt-in, private menstrual-cycle tracking. Thresholds: HHS Office on Women's Health (see Evidence). */
export default function CycleCard({ c }: { c: CrewState }) {
  const t = useT()
  const lang = useLang()
  const [start, setStart] = useState(today())
  const [flow, setFlow] = useState<string>('medium')
  const [days, setDays] = useState('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState('')
  const cycle = c.cycle
  const finding: Finding | undefined = c.findings.find((f) => f.metric === 'cycle')
  const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'kk' ? 'kk-KZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short' })

  const settings = (enabled: boolean, suppression = cycle.suppression) =>
    post('/api/cycle/settings', { crew_id: c.id, enabled, suppression }).catch(() => setError(t('Not saved. Try again.')))

  const log = async () => {
    setError('')
    if (!start || start > today()) { setError(t('Choose a date that is not in the future')); return }
    try {
      await post('/api/cycle/period', { crew_id: c.id, start, flow, days: days ? +days : null, symptoms })
      setSaved(start)
      setStart(today()); setFlow('medium'); setDays(''); setSymptoms([])
    } catch { setError(t('Not saved. Try again.')) }
  }

  const periods = [...cycle.periods].sort((a, b) => b.start.localeCompare(a.start))
  let next: string | null = null
  if (!cycle.suppression && periods.length >= 2) {
    const asc = [...periods].reverse().map((p) => new Date(p.start + 'T00:00:00').getTime())
    const gaps = asc.slice(1).map((x, i) => (x - asc[i]) / 86400000)
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
    next = new Date(asc[asc.length - 1] + avg * 86400000).toISOString().slice(0, 10)
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{t('Female health · cycle')}</h2>
        <span className="label">{t('Private')}</span>
      </div>

      {!cycle.enabled ? (
        <div className="grid" style={{ gap: 10, marginTop: 10 }}>
          <p className="small" style={{ margin: 0 }}>{t('Optional. Track your period or breakthrough bleeding if you use menstrual suppression. Only you and the flight surgeon can see it.')}</p>
          <div><button className="primary" onClick={() => settings(true)}>{t('Turn on cycle tracking')}</button></div>
          <SourceList ids={['npj_amenorrhea', 'owh_cycle']} compact />
        </div>
      ) : (
        <div className="grid" style={{ gap: 14, marginTop: 12 }}>
          {finding && (
            <div className={`banner ${finding.status === 'normal' ? '' : finding.status}`} style={{ background: finding.status === 'normal' ? 'var(--surface-2)' : undefined }}>
              <span className={`dot ${finding.status}`} />
              <div style={{ flex: 1 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="banner-title">{t(finding.label)}</span><StatusBadge s={finding.status} />
                </div>
                {finding.value && <div className="small muted">{t(finding.value)}</div>}
                <div className="small advice">{t(finding.advice)}</div>
                <SourceList ids={finding.sources} compact />
              </div>
            </div>
          )}
          {next && <div className="small">{t('Next period expected around')} <b style={{ fontWeight: 500 }}>{fmtDate(next)}</b> <span className="muted">({t('estimate from your log')})</span></div>}

          <label className="row" style={{ gap: 10, cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={cycle.suppression} onChange={(e) => settings(true, e.target.checked)} style={{ width: 18, height: 18, flex: 'none', marginTop: 2, accentColor: 'var(--text)' }} />
            <span className="small">{t('I use menstrual suppression (continuous hormonal contraception)')}</span>
          </label>

          <div className="grid" style={{ gap: 10, padding: 14, background: 'var(--surface-2)', borderRadius: 14 }}>
            <div className="label">{t(cycle.suppression ? 'Log bleeding' : 'Log period start')}</div>
            <div className="row" style={{ gap: 12 }}>
              <label className="grid" style={{ gap: 4 }}><span className="small muted">{t('First day')}</span>
                <input type="date" value={start} max={today()} onChange={(e) => { setStart(e.target.value); setError('') }} style={{ background: 'var(--surface)' }} /></label>
              <label className="grid" style={{ gap: 4 }}><span className="small muted">{t('Days (if ended)')}</span>
                <input type="number" min={1} max={20} value={days} onChange={(e) => setDays(e.target.value)} placeholder={t('optional')} style={{ width: 110, background: 'var(--surface)' }} /></label>
            </div>
            <div>
              <div className="small muted" style={{ marginBottom: 6 }}>{t('Flow')}</div>
              <div className="row">
                {FLOWS.map((f) => <button key={f} className={flow === f ? 'active' : ''} onClick={() => setFlow(f)} style={{ background: flow === f ? undefined : 'var(--surface)' }}>{t(FLOW_LABEL[f])}</button>)}
              </div>
              {flow === 'very_heavy' && <div className="small status watch" style={{ marginTop: 6 }}>{t('Soaking a pad or tampon every 1–2 hours is a sign of heavy bleeding — the flight surgeon will be notified privately.')}</div>}
            </div>
            <div>
              <div className="small muted" style={{ marginBottom: 6 }}>{t('Symptoms')}</div>
              <div className="row">
                {CYCLE_SYMPTOMS.map((s) => (
                  <button key={s} className={symptoms.includes(s) ? 'active' : ''} style={{ background: symptoms.includes(s) ? undefined : 'var(--surface)' }}
                    onClick={() => setSymptoms(symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s])}>{t(s)}</button>
                ))}
              </div>
            </div>
            <div className="row">
              <button className="primary" onClick={log}>{t('Save entry')}</button>
              {saved && <span className="small" role="status"><span className="dot normal" style={{ marginRight: 6 }} />{t('Saved')}: {fmtDate(saved)}</span>}
              {error && <span className="status alert small" role="alert">{error}</span>}
            </div>
          </div>

          {periods.length > 0 && (
            <div>
              <div className="label" style={{ marginBottom: 4 }}>{t('Recent entries')}</div>
              {periods.slice(0, 4).map((p) => (
                <div key={p.start} className="event small row" style={{ justifyContent: 'space-between' }}>
                  <span>{fmtDate(p.start)}{p.days ? ` · ${p.days} ${t('d')}` : ''}</span>
                  <span className="muted">{t(FLOW_LABEL[p.flow] ?? p.flow)}{p.symptoms.length ? ` · ${p.symptoms.map((s) => t(s)).join(', ')}` : ''}</span>
                </div>
              ))}
              {cycle.demo && <div className="small muted" style={{ marginTop: 4 }}>{t('Earlier entries are demo data.')}</div>}
            </div>
          )}
          <div><button onClick={() => settings(false)} style={{ fontSize: 13 }}>{t('Turn off tracking')}</button></div>
        </div>
      )}
    </div>
  )
}
