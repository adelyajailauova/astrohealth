import { useEffect, useState } from 'react'
import { get, STATUS_LABEL } from './api'
import type { AiSummary, Status } from './api'
import { unit, useLang, useT } from './i18n'

/** [model key, label (English source string), unit] */
const ROWS: [string, string, string][] = [
  ['hr', 'Heart rate', 'bpm'],
  ['sys', 'Systolic BP', 'mmHg'],
  ['dia', 'Diastolic BP', 'mmHg'],
  ['spo2', 'Blood oxygen (SpO2)', '%'],
  ['rr', 'Breathing rate', '/min'],
  ['temp', 'Body temperature', '°C'],
]
const LEVEL: Record<string, Status> = { NORMAL: 'normal', WATCH: 'watch', ALERT: 'alert', CRITICAL: 'critical' }
const ARROW: Record<string, string> = { rising: '↗', falling: '↘', stable: '→' }
const POLL_MS = 3000

/** AI forecast and explanation for one crew member. Shows a progress bar while the first samples are collected. */
export default function AiForecast({ crewId }: { crewId: string }) {
  const t = useT()
  const lang = useLang()
  const [got, setGot] = useState<{ id: string; data: AiSummary } | null>(null)
  const ai = got?.id === crewId ? got.data : null   // never show another astronaut's data while switching

  useEffect(() => {
    let stop = false
    const load = () => get<AiSummary>(`/api/ai/${crewId}?lang=${lang}`).then((data) => { if (!stop) setGot({ id: crewId, data }) }).catch(() => { /* keep the last result */ })
    load()
    const id = setInterval(load, POLL_MS)
    return () => { stop = true; clearInterval(id) }
  }, [crewId, lang])

  const header = (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ margin: 0 }}>{t('AI forecast')}</h2>
      <span className="label" style={{ color: 'var(--faint)' }}>{t('Next 30 min · model estimate')}</span>
    </div>
  )

  if (!ai || !ai.ready) {
    const pct = ai && !ai.unavailable && ai.need ? Math.round(((ai.have ?? 0) / ai.need) * 100) : 0
    return (
      <div className="card">
        {header}
        {ai?.unavailable ? (
          <div className="small muted">{t('AI model is not available')}</div>
        ) : (
          <>
            <div className="small muted">{t('Collecting data for the forecast')}{ai?.need ? ` · ${ai.have}/${ai.need}` : ''}</div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-3)', marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--text)', transition: 'width .6s' }} />
            </div>
          </>
        )}
      </div>
    )
  }

  const st = LEVEL[ai.level_name] ?? 'normal'
  const lines = ai.text.split('\n')
  const headline = lines[0]
  const disclaimer = lines[lines.length - 1]
  const why = lines.slice(1, -1)
  const risky = new Set(ai.risks.map((r) => r.metric))
  const cell = (m: string, h: string, u: string) => {
    const p = ai.forecast[m]?.horizons[h]
    if (!p) return <td>–</td>
    return (
      <td className={risky.has(m) ? 'status watch' : ''}>
        <b className="num" style={{ fontSize: 18 }}>{p.pred.toFixed(m === 'temp' ? 1 : 0)}</b>
        <span className="small muted"> {unit(lang, u)}</span>
        <div className="small muted">{p.low.toFixed(m === 'temp' ? 1 : 0)}–{p.high.toFixed(m === 'temp' ? 1 : 0)}</div>
      </td>
    )
  }

  return (
    <div className="card">
      {header}
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
        <span className={`dot ${st}`} style={{ marginTop: 7 }} />
        <div>
          <div className={`status ${st}`}>{t(STATUS_LABEL[st])}</div>
          <div style={{ marginTop: 2 }}>{headline}</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table>
          <thead>
            <tr><th>{t('Vital sign')}</th><th>{t('Now')}</th><th>{t('In 15 min')}</th><th>{t('In 30 min')}</th></tr>
          </thead>
          <tbody>
            {ROWS.map(([m, label, u]) => (
              <tr key={m}>
                <td>{ARROW[ai.forecast[m]?.trend] ?? ''} {t(label)}</td>
                <td><b className="num" style={{ fontSize: 18 }}>{ai.forecast[m]?.current.toFixed(m === 'temp' ? 1 : 0)}</b><span className="small muted"> {unit(lang, u)}</span></td>
                {cell(m, '15', u)}
                {cell(m, '30', u)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {why.length > 0 && (
        <>
          <div className="label" style={{ margin: '14px 0 4px' }}>{t('Why the AI thinks so')}</div>
          {why.map((l, i) => <div key={i} className="advice">{l}</div>)}
        </>
      )}
      <div className="small muted" style={{ marginTop: 10 }}>{disclaimer}</div>
    </div>
  )
}
