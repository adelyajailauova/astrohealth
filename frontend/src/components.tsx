import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { STATUS_LABEL, useMeta } from './api'
import type { Status } from './api'

export function SourceList({ ids, compact = false }: { ids: string[]; compact?: boolean }) {
  const meta = useMeta()
  if (!meta) return null
  return (
    <div className="src">
      {compact ? 'Sources: ' : null}
      {ids.map((id, i) => {
        const s = meta.sources[id]
        if (!s) return null
        return (
          <span key={id}>
            {i > 0 ? ' · ' : ''}
            <a href={s.url} target="_blank" rel="noreferrer" title={s.quote}>{s.org}: {s.title}</a>
          </span>
        )
      })}
    </div>
  )
}

export function StatusBadge({ s }: { s: Status | string }) {
  return <span className={`badge ${s}`}>{STATUS_LABEL[s as Status] ?? s}</span>
}

const COLORS: Record<string, string> = {
  normal: 'var(--normal)', watch: 'var(--watch)', alert: 'var(--alert)', critical: 'var(--critical)',
}

/** Clickable human figure; each zone is coloured by its worst finding. */
export function BodyFigure({ zones, selected, onSelect }: {
  zones: Record<string, Status>; selected: string | null; onSelect: (z: string) => void
}) {
  const fill = (z: string) => COLORS[zones[z] ?? 'normal']
  const zoneProps = (z: string) => ({
    onClick: () => onSelect(z),
    style: { cursor: 'pointer', transition: 'fill .4s' },
    fill: fill(z),
    fillOpacity: selected === z ? 0.95 : 0.55,
    stroke: selected === z ? '#fff' : 'none',
    strokeWidth: 2,
    className: zones[z] === 'critical' ? 'pulse-zone' : undefined,
  })
  return (
    <svg viewBox="0 0 220 440" style={{ width: '100%', maxWidth: 260, display: 'block', margin: '0 auto' }}>
      <style>{`.pulse-zone{animation:pulse 1s infinite}`}</style>
      {/* whole-body outline = radiation / systemic zone */}
      <g onClick={() => onSelect('body')} style={{ cursor: 'pointer' }}>
        <path
          d="M110 10 a32 34 0 1 1 -0.1 0 Z M70 88 Q110 76 150 88 L176 100 Q190 108 192 130 L200 230 Q202 246 190 246 Q182 246 180 232 L168 140 L160 140 L162 250 L160 420 Q158 432 144 432 Q132 432 130 420 L118 270 L102 270 L90 420 Q88 432 76 432 Q62 432 60 420 L58 250 L60 140 L52 140 L40 232 Q38 246 30 246 Q18 246 20 230 L28 130 Q30 108 44 100 Z"
          fill="#1b2742" stroke={COLORS[zones.body ?? 'normal']} strokeWidth={selected === 'body' ? 3 : 1.5}
          strokeOpacity={0.9}
        />
      </g>
      <circle cx="110" cy="44" r="26" {...zoneProps('head')} />
      <path d="M80 112 Q78 104 90 102 L104 104 L104 170 Q90 176 82 166 Z" {...zoneProps('lungs')} />
      <path d="M140 112 Q142 104 130 102 L116 104 L116 170 Q130 176 138 166 Z" {...zoneProps('lungs')} />
      <path d="M110 150 C 96 136, 88 124, 100 118 C 106 115, 110 120, 110 124 C 110 120, 114 115, 120 118 C 132 124, 124 136, 110 150 Z"
        {...zoneProps('heart')} fillOpacity={selected === 'heart' ? 1 : 0.85} />
      <rect x="84" y="182" width="52" height="58" rx="14" {...zoneProps('abdomen')} />
      <path d="M66 262 L104 262 L94 410 L74 410 Z" {...zoneProps('legs')} />
      <path d="M116 262 L154 262 L146 410 L126 410 Z" {...zoneProps('legs')} />
      <text x="110" y="436" textAnchor="middle" fill="var(--muted)" fontSize="10">click a body zone</text>
    </svg>
  )
}

/** Synthetic ECG trace driven by the simulated heart rate (no real ECG hardware in this prototype). */
export function EcgStrip({ hr, irregular, status }: { hr: number; irregular: boolean; status: Status }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hrRef = useRef(hr)
  const irrRef = useRef(irregular)
  hrRef.current = hr
  irrRef.current = irregular
  const color = COLORS[status]

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    const W = (cv.width = cv.clientWidth * devicePixelRatio)
    const H = (cv.height = 140 * devicePixelRatio)
    const pxPerSec = 120 * devicePixelRatio
    let x = 0
    let beatT = 0
    let rr = 60 / hrRef.current
    let last = performance.now()
    let prevY = H / 2
    let raf = 0
    const g = (t: number, mu: number, sd: number, a: number) => a * Math.exp(-((t - mu) ** 2) / (2 * sd * sd))
    const wave = (p: number) =>
      g(p, 0.16, 0.025, 0.12) + g(p, 0.27, 0.008, -0.12) + g(p, 0.3, 0.01, 1.0) + g(p, 0.33, 0.01, -0.28) + g(p, 0.55, 0.045, 0.3)
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const steps = Math.max(1, Math.round(dt * pxPerSec))
      for (let i = 0; i < steps; i++) {
        beatT += dt / steps
        if (beatT >= rr) {
          beatT -= rr
          const base = 60 / Math.max(30, hrRef.current)
          rr = irrRef.current ? base * (0.6 + Math.random() * 0.8) : base
        }
        const p = Math.min(1, beatT / Math.min(rr, 0.9))
        const y = H * 0.62 - wave(p) * H * 0.5 + (Math.random() - 0.5) * 1.5
        ctx.fillStyle = '#0b1220'
        ctx.fillRect(x, 0, 8 * devicePixelRatio, H)
        ctx.strokeStyle = color
        ctx.lineWidth = 2 * devicePixelRatio
        ctx.beginPath()
        ctx.moveTo(x - 1, prevY)
        ctx.lineTo(x, y)
        ctx.stroke()
        prevY = y
        x += 1
        if (x >= W) { x = 0 }
      }
      raf = requestAnimationFrame(draw)
    }
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, W, H)
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [color])

  return <canvas ref={ref} style={{ width: '100%', height: 140, borderRadius: 10, display: 'block' }} />
}

const TREND_CFG: Record<string, { keys: string[]; label: string; normal?: [number, number]; domain?: [number, number] }> = {
  hr: { keys: ['hr'], label: 'Heart rate (bpm)', normal: [60, 100], domain: [30, 170] },
  rhythm: { keys: ['hr'], label: 'Heart rate (bpm)', normal: [60, 100], domain: [30, 170] },
  bp: { keys: ['sys', 'dia'], label: 'Blood pressure (mmHg)', normal: [60, 120], domain: [40, 180] },
  spo2: { keys: ['spo2'], label: 'SpO2 (%)', normal: [95, 100], domain: [80, 100] },
  rr: { keys: ['rr'], label: 'Breathing rate (/min)', normal: [12, 18], domain: [5, 35] },
  temp: { keys: ['temp'], label: 'Temperature (°C)', normal: [36.1, 37.2], domain: [35, 40] },
}
const LINE_COLORS = ['#5ab0ff', '#c084fc']

export function TrendChart({ crewId, metric }: { crewId: string; metric: string }) {
  const [data, setData] = useState<any[]>([])
  const cfg = TREND_CFG[metric] ?? TREND_CFG.hr
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch(`/api/history/${crewId}`).then((r) => r.json()).then((d) => {
        if (!alive) return
        const t0 = d.vitals.length ? d.vitals[d.vitals.length - 1].t : 0
        setData(d.vitals.map((p: any) => ({ ...p, x: Math.round(p.t - t0) })))
      })
    load()
    const id = setInterval(load, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [crewId])
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>{cfg.label}</b>
        <span className="muted small">last 5 min · shaded = normal resting range</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#1e2a44" strokeDasharray="3 3" />
          <XAxis dataKey="x" tick={{ fill: '#8b9ab8', fontSize: 11 }} unit="s" type="number" domain={['dataMin', 0]} />
          <YAxis tick={{ fill: '#8b9ab8', fontSize: 11 }} domain={cfg.domain} allowDataOverflow />
          {cfg.normal && <ReferenceArea y1={cfg.normal[0]} y2={cfg.normal[1]} fill="#34d399" fillOpacity={0.08} />}
          <Tooltip contentStyle={{ background: '#0f1626', border: '1px solid #22304d' }} labelFormatter={(l) => `${l}s`} />
          {cfg.keys.map((k, i) => (
            <Line key={k} dataKey={k} stroke={LINE_COLORS[i]} dot={false} isAnimationActive={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
