import { useState } from 'react'
import { ago, fmtDelay, post, useMeta } from '../api'
import type { GroundState } from '../api'
import { SourceList, StatusBadge } from '../components'

const ORDER: Record<string, number> = { critical: 0, alert: 1, watch: 2, normal: 3 }

export default function GroundPage({ state }: { state: GroundState | null }) {
  const meta = useMeta()
  const [filter, setFilter] = useState<'all' | 'urgent'>('all')
  const [to, setTo] = useState('c1')
  const [text, setText] = useState('')
  if (!state || !meta) return <div className="muted">Connecting to Mission Control…</div>

  const tel = state.telemetry.payload?.crew ?? {}
  const age = state.telemetry.created_at ? state.t - state.telemetry.created_at : null
  const reports = state.reports.filter((r) => filter === 'all' || (ORDER[r.priority] ?? 3) <= 1)
  const link = state.link

  const send = async () => {
    if (!text.trim()) return
    await post('/api/ground/message', { crew_id: to, text })
    setText('')
  }

  return (
    <>
    <div className="page-head">
      <div>
        <div className="label">Flight surgeon console · {link.location_name}</div>
        <h1 className="page-title">Mission Control</h1>
      </div>
      <div className="label">Telemetry age {age != null ? `${age.toFixed(1)} s` : '—'}</div>
    </div>
    <div className="grid cols-ground" style={{ gridTemplateColumns: 'minmax(0, 1fr) 400px' }}>
      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {Object.entries(tel).map(([cid, c]) => (
            <div key={cid} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 className="row" style={{ gap: 8 }}><span className={`dot ${c.overall}`} />{c.name}</h3><StatusBadge s={c.overall} />
              </div>
              <table className="small" style={{ marginTop: 6 }}>
                <tbody>
                  <tr><td className="muted">HR</td><td>{c.vitals.hr.toFixed(0)} bpm {c.vitals.irregular && <span className="status alert"> · irregular</span>}</td></tr>
                  <tr><td className="muted">BP</td><td>{c.vitals.sys}/{c.vitals.dia}</td></tr>
                  <tr><td className="muted">SpO2</td><td>{c.vitals.spo2.toFixed(0)}%</td></tr>
                  <tr><td className="muted">Temp</td><td>{c.vitals.temp.toFixed(1)} °C</td></tr>
                  <tr><td className="muted">Dose</td><td>{c.vitals.career_msv.toFixed(1)} / {meta.career_limit_msv} mSv</td></tr>
                </tbody>
              </table>
            </div>
          ))}
          {Object.keys(tel).length === 0 && <div className="card muted">Waiting for the first telemetry frame. Light-time delay applies.</div>}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Incoming health reports</h2>
            <div className="row">
              <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
              <button className={filter === 'urgent' ? 'active' : ''} onClick={() => setFilter('urgent')}>Alert & critical</button>
            </div>
          </div>
          <table>
            <thead><tr><th>Priority</th><th>Crew</th><th>Finding</th><th>Recommended onboard</th><th>Timing</th></tr></thead>
            <tbody>
              {reports.map((r) => {
                const p = r.payload
                return (
                  <tr key={r.id}>
                    <td><StatusBadge s={r.priority} />{p.private && <div className="label" style={{ marginTop: 6 }}>Private</div>}</td>
                    <td>{p.crew}</td>
                    <td>
                      <b>{p.metric_name}</b>: {p.label}<div className="small muted">{p.value}</div>
                      <span className={`badge ${p.origin}`} style={{ marginTop: 4 }}>{p.origin === 'source' ? 'cited threshold' : 'app rule'}</span>
                    </td>
                    <td className="small">{p.advice}<SourceList ids={p.sources} /></td>
                    <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                      received {ago(r.received_at ?? 0, state.t)}<br />in transit {((r.received_at ?? 0) - r.created_at).toFixed(1)} s
                    </td>
                  </tr>
                )
              })}
              {reports.length === 0 && <tr><td colSpan={5} className="muted">No reports received.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="card">
          <h2>Space link</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            {Object.entries(meta.locations).map(([k, l]) => (
              <button key={k} className={link.location === k ? 'active' : ''} onClick={() => post('/api/location', { location: k })}>{l.name}</button>
            ))}
          </div>
          <table className="small">
            <tbody>
              <tr><td className="muted">One-way delay (real)</td><td><b>{fmtDelay(link.real_delay_s)}</b></td></tr>
              <tr><td className="muted">Delay in demo</td><td>{fmtDelay(link.demo_delay_s)}{link.compression > 1 && ` (×${link.compression} compressed)`}</td></tr>
              <tr><td className="muted">Telemetry age</td><td>{age != null ? `${age.toFixed(1)} s` : '—'}</td></tr>
              <tr><td className="muted">Downlink queue</td><td>{link.downlink_pending.total} msgs {JSON.stringify(link.downlink_pending.by_priority).replace(/[{}"]/g, '')}</td></tr>
            </tbody>
          </table>
          {link.delay_source && <div style={{ marginTop: 6 }}><SourceList ids={[link.delay_source]} compact /></div>}
          <div className="small muted" style={{ marginTop: 6 }}>Moon delay: 384,400 km ÷ speed of light ≈ 1.3 s. Critical reports jump the queue; telemetry waits.</div>
          <button style={{ marginTop: 10 }} className={link.outage ? 'active' : ''} onClick={() => post('/api/link', { outage: !link.outage })}>
            {link.outage ? 'Restore signal' : 'Simulate loss of signal'}
          </button>
          {link.outage && <div className="status watch small" style={{ marginTop: 6 }}>Loss of signal – onboard keeps assessing and stores reports (store-and-forward).</div>}
        </div>

        <div className="card">
          <h2>Message to crew (uplink)</h2>
          <div className="row" style={{ marginBottom: 8 }}>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {Object.entries(tel).map(([cid, c]) => <option key={cid} value={cid}>{c.name}</option>)}
              {Object.keys(tel).length === 0 && <option value="c1">c1</option>}
            </select>
          </div>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reviewed your ECG. Rest 30 min, repeat the measurement, then call us." />
          <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
            <span className="small muted">arrives in {fmtDelay(link.demo_delay_s)} (demo)</span>
            <button className="primary" onClick={send}>Send</button>
          </div>
          {state.sent.slice(0, 3).map((m) => (
            <div key={m.id} className="event small">
              <span className="muted">{ago(m.created_at, state.t)} → {tel[m.payload.crew_id]?.name ?? m.payload.crew_id}: </span>{m.payload.text}
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  )
}
