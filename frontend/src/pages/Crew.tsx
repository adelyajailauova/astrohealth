import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ago, post, useMeta } from '../api'
import type { CrewState, Finding, OnboardState, Status } from '../api'
import { BodyFigure, EcgStrip, SourceList, StatusBadge, TrendChart } from '../components'

const ZONE_NAMES: Record<string, string> = {
  heart: 'Heart & circulation', lungs: 'Lungs & oxygen', head: 'Brain, sleep & mood',
  abdomen: 'Metabolism', legs: 'Bones & muscles', body: 'Whole body (radiation)',
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
        <div key={m} className={`vital ${f[m]?.status ?? ''} ${selected === m ? 'selected' : ''}`} onClick={() => onSelect(m)}>
          <div className="n">{meta?.metrics[m]?.name}</div>
          <div><span className="v">{val}</span><span className="u">{unit}</span></div>
          <div className={`small status ${f[m]?.status}`}>{f[m]?.label}</div>
        </div>
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
      {metrics.map(([id, m]) => {
        const f = c.findings.find((x) => x.metric === id)
        return (
          <div key={id} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>{m.name}</h3>
              {f ? <StatusBadge s={f.status} /> : <span className="muted small">no data – do check-in</span>}
            </div>
            {f && (
              <>
                <div><b>{f.value}</b> · <span className={`status ${f.status}`}>{f.label}</span></div>
                <div style={{ margin: '6px 0' }}>➜ {f.advice}</div>
                <div className="row small" style={{ marginBottom: 4 }}>
                  <span className={`badge ${f.origin}`}>{f.origin === 'source' ? 'threshold from source' : 'app escalation rule'}</span>
                </div>
                <SourceList ids={f.sources} compact />
              </>
            )}
            <details style={{ marginTop: 6 }}>
              <summary className="muted small" style={{ cursor: 'pointer' }}>Why measure in space · how to measure</summary>
              <p className="small" style={{ margin: '6px 0' }}><b>Why:</b> {m.why}</p>
              <p className="small" style={{ margin: '6px 0' }}><b>How:</b> {m.how}</p>
              <SourceList ids={m.sources} compact />
            </details>
          </div>
        )
      })}
      {zone === 'head' && (
        <Link to="/wellbeing"><button className="primary">Open check-in & wellbeing →</button></Link>
      )}
    </div>
  )
}

export default function CrewPage({ state }: { state: OnboardState | null }) {
  const meta = useMeta()
  const [crewId, setCrewId] = useState('c1')
  const [zone, setZone] = useState<string>('heart')
  const [metric, setMetric] = useState('hr')
  if (!state || !meta || !state.crew.length) return <div className="muted">Connecting to onboard health node…</div>
  const c = state.crew.find((x) => x.id === crewId) ?? state.crew[0]
  const urgent = c.findings.filter((f) => f.level >= 2).sort((a, b) => b.level - a.level)
  const inbox = state.inbox[c.id] ?? []
  const rhythm = c.findings.find((f) => f.metric === 'rhythm')

  const selectMetric = (m: string) => { setMetric(m); setZone(meta.metrics[m].zone) }

  return (
    <div className="grid" style={{ gridTemplateColumns: '280px 1fr 380px' }} >
      {/* left: crew + body */}
      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="card">
          <h2>Crew</h2>
          <div className="grid" style={{ gap: 8 }}>
            {state.crew.map((x) => (
              <button key={x.id} className={`crewtab ${x.id === c.id ? 'active' : ''}`} onClick={() => setCrewId(x.id)}>
                <span className={`dot ${x.overall}`} />
                <span>{x.name}<small>{x.role}</small></span>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Body status</h2>
          <BodyFigure zones={c.zones} selected={zone} onSelect={setZone} />
          <div className="row small muted" style={{ justifyContent: 'center', marginTop: 8 }}>
            {(['normal', 'watch', 'alert', 'critical'] as Status[]).map((s) => (
              <span key={s} className="row" style={{ gap: 4 }}><span className={`dot ${s}`} />{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* center: vitals */}
      <div className="grid" style={{ alignContent: 'start' }}>
        {urgent.length > 0 ? (
          <div className={`banner ${urgent[0].status}`}>
            <span style={{ fontSize: 24 }}>⚠</span>
            <div>
              <b className={`status ${urgent[0].status}`}>{meta.metrics[urgent[0].metric].name}: {urgent[0].label}</b>
              <div>{urgent[0].advice}</div>
              <div className="small muted">Report queued to Mission Control automatically · arrives in {state.link.demo_delay_s.toFixed(1)} s (demo)</div>
            </div>
          </div>
        ) : (
          <div className="banner"><span className="dot normal" /> <span>All monitored vital signs within limits for <b>{c.name}</b>.</span></div>
        )}
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Live vitals · {c.name}</h2>
            <span className="muted small">activity: {c.vitals.activity} · smart-shirt sensors (simulated)</span>
          </div>
          <VitalCards c={c} selected={metric} onSelect={selectMetric} />
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>ECG · lead I (synthetic)</h2>
            <span className={`status small ${rhythm?.status}`}>{rhythm?.label}</span>
          </div>
          <EcgStrip hr={c.vitals.hr} irregular={c.vitals.irregular} status={rhythm?.status ?? 'normal'} />
        </div>
        <div className="card"><TrendChart crewId={c.id} metric={metric} /></div>
      </div>

      {/* right: zone detail + messages + demo */}
      <div className="grid" style={{ alignContent: 'start' }}>
        <ZonePanel c={c} zone={zone} />
        <div className="card">
          <h2>Messages from Earth</h2>
          {inbox.length === 0 && <div className="muted small">No messages yet.</div>}
          {inbox.slice(0, 4).map((m) => (
            <div key={m.id} className="event">
              <div className="small muted">{m.payload.from} · {ago(m.received_at ?? m.created_at, state.t)}</div>
              <div>{m.payload.text}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Demo: inject scenario for {c.name.split(' ').slice(-1)}</h2>
          <div className="row">
            {Object.entries(meta.scenarios).map(([k, label]) => (
              <button key={k} className={c.scenario === k ? 'active' : ''} onClick={() => post('/api/scenario', { crew_id: c.id, scenario: k })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
