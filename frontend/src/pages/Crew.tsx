import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { post, useMeta } from '../api'
import type { CrewState, Finding, OnboardState, Status } from '../api'
import { BodyFigure, EcgStrip, SourceList, StatusBadge, TrendChart } from '../components'
import { agoL, unit, useLang, useT } from '../i18n'

const ZONE_NAMES: Record<string, string> = {
  heart: 'Heart and circulation', lungs: 'Lungs and oxygen', head: 'Brain, sleep and mood',
  abdomen: 'Metabolism and reproductive health', legs: 'Bones and muscles', body: 'Whole body · radiation',
}
const TREND_METRICS = new Set(['hr', 'rhythm', 'bp', 'spo2', 'rr', 'temp'])

function VitalTiles({ c, onOpen }: { c: CrewState; onOpen: (m: string) => void }) {
  const t = useT()
  const lang = useLang()
  const meta = useMeta()
  const f = Object.fromEntries(c.findings.map((x) => [x.metric, x])) as Record<string, Finding>
  const v = c.vitals
  const tiles: [string, string, string][] = [
    ['hr', v.hr.toFixed(0), unit(lang, 'bpm')],
    ['bp', `${v.sys}/${v.dia}`, unit(lang, 'mmHg')],
    ['spo2', v.spo2.toFixed(0), '%'],
    ['rr', v.rr.toFixed(0), unit(lang, '/min')],
    ['temp', v.temp.toFixed(1), '°C'],
    ['rhythm', '', ''],
  ]
  return (
    <div className="vitals-big">
      {tiles.map(([m, val, u]) => (
        <button key={m} className={`vital ${f[m]?.status ?? ''}`} onClick={() => onOpen(m)} style={{ textAlign: 'left', color: 'inherit' }}>
          <div className="n">{t(meta?.metrics[m]?.name)}</div>
          {m === 'rhythm' ? (
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: -0.8 }}>{t(v.irregular ? 'Irregular' : 'Regular')}</div>
          ) : (
            <div><span className="v num">{val}</span><span className="u">{u}</span></div>
          )}
          <div className="st"><span className={`dot ${f[m]?.status}`} />{t(f[m]?.label)}</div>
        </button>
      ))}
    </div>
  )
}

function MetricDetail({ id, f }: { id: string; f: Finding | undefined }) {
  const t = useT()
  const meta = useMeta()!
  const m = meta.metrics[id]
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>{t(m.name)}</h3>
        {f ? <StatusBadge s={f.status} /> : <span className="label">{t('No data')}</span>}
      </div>
      {f ? (
        <>
          <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: -0.6, marginTop: 2 }}>{t(f.value)}</div>
          <div className={`status small ${f.status}`}>{t(f.label)}</div>
          <div className="advice">{t(f.advice)}</div>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className={`badge ${f.origin}`}>{t(f.origin === 'source' ? 'Cited threshold' : 'App rule')}</span>
          </div>
          <SourceList ids={f.sources} compact />
        </>
      ) : (
        <div className="small muted">{t("Complete today's check-in to assess this.")}</div>
      )}
      <details style={{ marginTop: 10 }}>
        <summary className="label" style={{ cursor: 'pointer' }}>{t('Why measure in space')}</summary>
        <p className="small" style={{ margin: '8px 0 4px' }}>{t(m.why)}</p>
        <p className="small muted" style={{ margin: '4px 0 6px' }}><span style={{ color: 'var(--text)', fontWeight: 500 }}>{t('How:')}</span> {t(m.how)}</p>
        <SourceList ids={m.sources} compact />
      </details>
    </div>
  )
}

function Drawer({ c, zone, metric, onClose }: { c: CrewState; zone: string; metric: string; onClose: () => void }) {
  const t = useT()
  const meta = useMeta()!
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onClose])
  const ids = Object.keys(meta.metrics).filter((id) => meta.metrics[id].zone === zone)
  const ordered = [metric, ...ids.filter((x) => x !== metric)].filter((x) => ids.includes(x))
  const trend = ordered.find((x) => TREND_METRICS.has(x))
  const rhythm = c.findings.find((f) => f.metric === 'rhythm')
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={t(ZONE_NAMES[zone])}>
        <div className="drawer-head">
          <div>
            <div className="label">{c.name}</div>
            <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.8, marginTop: 4 }}>{t(ZONE_NAMES[zone])}</h2>
          </div>
          <button onClick={onClose}>{t('Close')}</button>
        </div>
        {zone === 'heart' && (
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{t('ECG · lead I · synthetic')}</h2>
              <span className={`small status ${rhythm?.status}`}>{t(rhythm?.label)}</span>
            </div>
            <EcgStrip hr={c.vitals.hr} irregular={c.vitals.irregular} status={rhythm?.status ?? 'normal'} />
          </div>
        )}
        {trend && <div className="card"><TrendChart crewId={c.id} metric={trend} /></div>}
        {ordered.map((id) => <MetricDetail key={id} id={id} f={c.findings.find((x) => x.metric === id)} />)}
        {zone === 'head' && <Link to="/wellbeing"><button className="primary">{t('Open check-in')}</button></Link>}
      </aside>
    </>
  )
}

export default function CrewPage({ state }: { state: OnboardState | null }) {
  const meta = useMeta()
  const t = useT()
  const lang = useLang()
  const [crewId, setCrewId] = useState('c1')
  const [open, setOpen] = useState<{ zone: string; metric: string } | null>(null)
  if (!state || !meta || !state.crew.length) return <div className="label" style={{ marginTop: 40 }}>{t('Connecting to onboard health node')}</div>
  const c = state.crew.find((x) => x.id === crewId) ?? state.crew[0]
  const urgent = c.findings.filter((f) => f.level >= 1).sort((a, b) => b.level - a.level)
  const watchCount = c.findings.filter((f) => f.level >= 1).length
  const inbox = state.inbox[c.id] ?? []
  const openMetric = (m: string) => setOpen({ zone: meta.metrics[m].zone, metric: m })
  const openZone = (z: string) => {
    const first = Object.keys(meta.metrics).find((id) => meta.metrics[id].zone === z) ?? 'hr'
    setOpen({ zone: z, metric: first })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">{t(c.role)} · {t(c.vitals.activity)}</div>
          <h1 className="page-title">{c.name}</h1>
        </div>
        {state.crew.length > 1 && <div className="row">
          {state.crew.map((x) => (
            <button key={x.id} className={x.id === c.id ? 'active' : ''} onClick={() => setCrewId(x.id)}>
              <span className="row" style={{ gap: 8 }}><span className={`dot ${x.overall}`} />{x.name.split(' ').slice(-1)}</span>
            </button>
          ))}
        </div>}
      </div>

      <div className="grid">
        {urgent.length > 0 ? (
          <div className={`banner ${urgent[0].status}`} onClick={() => openMetric(urgent[0].metric)} style={{ cursor: 'pointer' }}>
            <span className={`dot ${urgent[0].status}`} />
            <div style={{ flex: 1 }}>
              <div className={`banner-title status ${urgent[0].status}`}>{t(meta.metrics[urgent[0].metric].name)}: {t(urgent[0].label)}</div>
              <div style={{ marginTop: 2 }}>{t(urgent[0].advice)}</div>
              <div className="label" style={{ marginTop: 8 }}>
                {urgent[0].level >= 2 ? `${t('Report sent to Mission Control automatically · arrives in')} ${state.link.demo_delay_s.toFixed(1)} ${unit(lang, 's')}` : t('Flight surgeon sees this in the next report')}
                {watchCount > 1 && ` · ${t('more items need attention')}: ${watchCount - 1}`}
              </div>
            </div>
            <span className="label">{t('Details')} →</span>
          </div>
        ) : (
          <div className="banner"><span className="dot normal" /><div>{t('All monitored vital signs are within limits.')}</div></div>
        )}

        {inbox.length > 0 && (
          <div className="banner">
            <span className="dot" style={{ background: 'var(--text)' }} />
            <div>
              <div className="label">{t('Messages from Earth')} · {t(inbox[0].payload.from)} · {agoL(lang, inbox[0].received_at ?? inbox[0].created_at, state.t)}</div>
              <div style={{ marginTop: 4 }}>{inbox[0].payload.text}</div>
            </div>
          </div>
        )}

        <div className="grid cols-crew" style={{ gridTemplateColumns: '340px minmax(0, 1fr)' }}>
          <div className="card">
            <h2>{t('Body status')}</h2>
            <div className="dotgrid" style={{ padding: '18px 0' }}>
              <BodyFigure zones={c.zones} selected={open?.zone ?? null} onSelect={openZone} />
            </div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12, gap: 14 }}>
              {(['normal', 'watch', 'alert'] as Status[]).map((s) => (
                <span key={s} className="pill"><span className={`dot ${s}`} />{t(s)}</span>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>{t('Live vitals')}</h2>
              <span className="label" style={{ color: 'var(--faint)' }}>{t('Smart-shirt sensors · simulated')}</span>
            </div>
            <VitalTiles c={c} onOpen={openMetric} />
            <div className="label" style={{ marginTop: 14, color: 'var(--faint)' }}>{t('Tap a body zone or a reading for details')}</div>
          </div>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{t('Demo scenario')}</h2>
            <div className="row">
              {Object.entries(meta.scenarios).map(([k, label]) => (
                <button key={k} className={c.scenario === k ? 'active' : ''} onClick={() => post('/api/scenario', { crew_id: c.id, scenario: k })}>{t(label)}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {open && <Drawer c={c} zone={open.zone} metric={open.metric} onClose={() => setOpen(null)} />}
    </>
  )
}
