import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ago, post, useMeta } from '../api'
import type { CrewState, Finding, OnboardState, Status } from '../api'
import { BodyFigure, EcgStrip, SourceList, StatusBadge, TrendChart } from '../components'

const ZONE_NAMES: Record<string, string> = {
  heart: 'Heart and circulation', lungs: 'Lungs and oxygen', head: 'Brain, sleep and mood',
  abdomen: 'Metabolism', legs: 'Bones and muscles', body: 'Whole body · radiation',
}

function VitalCards({ c, selected, onSelect }: { c: CrewState; selected: string; onSelect: (m: string) => void }) {
  const f = Object.fromEntries(c.findings.map((x) => [x.metric, x])) as Record<string, Finding>
  const v = c.vitals
  const cards: [string, string, string][] = [
    ['hr', v.hr.toFixed(0), 'bpm'],
    ['bp', `${v.sys}/${v.dia}`, 'mmHg'],
    ['spo2', v.spo2.toFixed(0), '%'],
    ['rr', v.rr.toFixed(0), '/min'],
    ['temp', v.temp.toFixed(1), '°C'],
    ['rhythm', v.irregular ? 'Irregular' : 'Regular', ''],
  ]
  const meta = useMeta()
  return (
    <div className="vitals">
      {cards.map(([m, val, unit]) => (
        <button key={m} className={`vital ${f[m]?.status ?? ''} ${selected === m ? 'selected' : ''}`} onClick={() => onSelect(m)} style={{ textAlign: 'left', color: 'inherit' }}>
          <div className="n">{meta?.metrics[m]?.name}</div>
          <div><span className="v" style={m === 'rhythm' ? { fontSize: 24 } : undefined}>{val}</span><span className="u">{unit}</span></div>
          <div className="st"><span className={`dot ${f[m]?.status}`} />{f[m]?.label}</div>
        </button>
      ))}
    </div>
  )
}

function ZonePanel({ c, zone }: { c: CrewState; zone: string }) {
  const meta = useMeta()
  if (!meta) return null
  const metrics = Object.entries(meta.metrics).filter(([, m]) => m.zone === zone)
  return (
    <div className="card">
      <h2>{ZONE_NAMES[zone]}</h2>
      {metrics.map(([id, m], i) => {
        const f = c.findings.find((x) => x.metric === id)
        return (
          <div key={id} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: i < metrics.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>{m.name}</h3>
              {f ? <StatusBadge s={f.status} /> : <span className="label">No data</span>}
            </div>
            {f ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: -0.6, marginTop: 2 }}>{f.value}</div>
                <div className={`status small ${f.status}`}>{f.label}</div>
                <div className="advice">{f.advice}</div>
                <div className="row" style={{ marginBottom: 4 }}>
                  <span className={`badge ${f.origin}`}>{f.origin === 'source' ? 'Cited threshold' : 'App rule'}</span>
                </div>
                <SourceList ids={f.sources} compact />
              </>
            ) : (
              <div className="small muted">Complete today's check-in to assess this.</div>
            )}
            <details style={{ marginTop: 8 }}>
              <summary className="label" style={{ cursor: 'pointer' }}>Why measure in space</summary>
              <p className="small" style={{ margin: '8px 0 4px' }}>{m.why}</p>
              <p className="small muted" style={{ margin: '4px 0 6px' }}><b style={{ color: 'var(--text)', fontWeight: 500 }}>How:</b> {m.how}</p>
              <SourceList ids={m.sources} compact />
            </details>
          </div>
        )
      })}
      {zone === 'head' && <Link to="/wellbeing"><button className="primary">Open check-in</button></Link>}
    </div>
  )
}

export default function CrewPage({ state }: { state: OnboardState | null }) {
  const meta = useMeta()
  const [crewId, setCrewId] = useState('c1')
  const [zone, setZone] = useState<string>('heart')
  const [metric, setMetric] = useState('hr')
  if (!state || !meta || !state.crew.length) return <div className="label" style={{ marginTop: 40 }}>Connecting to onboard health node</div>
  const c = state.crew.find((x) => x.id === crewId) ?? state.crew[0]
  const urgent = c.findings.filter((f) => f.level >= 2).sort((a, b) => b.level - a.level)
  const inbox = state.inbox[c.id] ?? []
  const rhythm = c.findings.find((f) => f.metric === 'rhythm')
  const selectMetric = (m: string) => { setMetric(m); setZone(meta.metrics[m].zone) }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">{c.role} · {c.vitals.activity}</div>
          <h1 className="page-title">{c.name}</h1>
        </div>
        <div className="row">
          {state.crew.map((x) => (
            <button key={x.id} className={x.id === c.id ? 'active' : ''} onClick={() => setCrewId(x.id)}>
              <span className="row" style={{ gap: 8 }}><span className={`dot ${x.overall}`} />{x.name.split(' ').slice(-1)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid cols-crew" style={{ gridTemplateColumns: '300px minmax(0, 1fr) 380px' }}>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h2>Body status</h2>
            <div className="dotgrid" style={{ padding: '16px 0' }}>
              <BodyFigure zones={c.zones} selected={zone} onSelect={setZone} />
            </div>
            <div className="row" style={{ justifyContent: 'center', marginTop: 12, gap: 14 }}>
              {(['normal', 'watch', 'alert'] as Status[]).map((s) => (
                <span key={s} className="pill"><span className={`dot ${s}`} />{s}</span>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>Messages from Earth</h2>
            {inbox.length === 0 && <div className="small muted">No messages yet.</div>}
            {inbox.slice(0, 4).map((m) => (
              <div key={m.id} className="event">
                <div className="label">{m.payload.from} · {ago(m.received_at ?? m.created_at, state.t)}</div>
                <div style={{ marginTop: 4 }}>{m.payload.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          {urgent.length > 0 ? (
            <div className={`banner ${urgent[0].status}`}>
              <span className={`dot ${urgent[0].status}`} />
              <div>
                <div className={`banner-title status ${urgent[0].status}`}>{meta.metrics[urgent[0].metric].name}: {urgent[0].label}</div>
                <div style={{ marginTop: 2 }}>{urgent[0].advice}</div>
                <div className="label" style={{ marginTop: 8 }}>Report sent to Mission Control automatically · arrives in {state.link.demo_delay_s.toFixed(1)} s</div>
              </div>
            </div>
          ) : (
            <div className="banner"><span className="dot normal" /><div>All monitored vital signs are within limits.</div></div>
          )}
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>Live vitals</h2>
              <span className="label" style={{ color: 'var(--faint)' }}>Smart-shirt sensors · simulated</span>
            </div>
            <VitalCards c={c} selected={metric} onSelect={selectMetric} />
          </div>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>ECG · lead I · synthetic</h2>
              <span className={`small status ${rhythm?.status}`}>{rhythm?.label}</span>
            </div>
            <EcgStrip hr={c.vitals.hr} irregular={c.vitals.irregular} status={rhythm?.status ?? 'normal'} />
          </div>
          <div className="card"><TrendChart crewId={c.id} metric={metric} /></div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <ZonePanel c={c} zone={zone} />
          <div className="card">
            <h2>Demo scenario</h2>
            <div className="row">
              {Object.entries(meta.scenarios).map(([k, label]) => (
                <button key={k} className={c.scenario === k ? 'active' : ''} onClick={() => post('/api/scenario', { crew_id: c.id, scenario: k })}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
