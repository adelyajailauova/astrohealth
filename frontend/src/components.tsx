import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cssVar, STATUS_LABEL, useMeta, useTheme } from './api'
import { unit, useLang, useT } from './i18n'
import type { Status } from './api'

export function SourceList({ ids, compact = false }: { ids: string[]; compact?: boolean }) {
  const meta = useMeta()
  const t = useT()
  if (!meta) return null
  return (
    <div className="src">
      {compact ? t('Source: ') : null}
      {ids.map((id, i) => {
        const s = meta.sources[id]
        if (!s) return null
        return (
          <span key={id}>
            {i > 0 ? ' · ' : ''}
            <a href={s.url} target="_blank" rel="noreferrer" title={s.quote}>{s.org}, {s.title}</a>
          </span>
        )
      })}
    </div>
  )
}

export function StatusBadge({ s }: { s: Status | string }) {
  const t = useT()
  return <span className={`badge ${s}`}>{t(STATUS_LABEL[s as Status] ?? s)}</span>
}

/** Normal is deliberately neutral grey: colour appears only when something deviates. */
const ZONE_FILL: Record<string, string> = {
  normal: 'var(--zone)', watch: 'var(--watch)', alert: 'var(--alert)', critical: 'var(--critical)',
}

export function BodyFigure({ zones, selected, onSelect }: {
  zones: Record<string, Status>; selected: string | null; onSelect: (z: string) => void
}) {
  const zoneProps = (z: string) => ({
    onClick: () => onSelect(z),
    style: { cursor: 'pointer', transition: 'fill .4s' },
    fill: ZONE_FILL[zones[z] ?? 'normal'],
    stroke: selected === z ? 'var(--text)' : 'none',
    strokeWidth: 2,
    className: zones[z] === 'critical' ? 'pulse-zone' : undefined,
    role: 'button',
    'aria-label': z,
  })
  const bodyStatus = zones.body ?? 'normal'
  return (
    <svg viewBox="0 0 220 440" style={{ width: '100%', maxWidth: 240, display: 'block', margin: '0 auto' }}>
      <style>{`.pulse-zone{animation:pulse 1.2s infinite}`}</style>
      <path
        onClick={() => onSelect('body')} style={{ cursor: 'pointer' }}
        d="M110 10 a32 34 0 1 1 -0.1 0 Z M70 88 Q110 76 150 88 L176 100 Q190 108 192 130 L200 230 Q202 246 190 246 Q182 246 180 232 L168 140 L160 140 L162 250 L160 420 Q158 432 144 432 Q132 432 130 420 L118 270 L102 270 L90 420 Q88 432 76 432 Q62 432 60 420 L58 250 L60 140 L52 140 L40 232 Q38 246 30 246 Q18 246 20 230 L28 130 Q30 108 44 100 Z"
        fill="var(--silhouette)"
        stroke={bodyStatus === 'normal' ? (selected === 'body' ? 'var(--text)' : 'var(--line-strong)') : ZONE_FILL[bodyStatus]}
        strokeWidth={selected === 'body' || bodyStatus !== 'normal' ? 2 : 1}
      />
      <circle cx="110" cy="44" r="24" {...zoneProps('head')} />
      <path d="M80 112 Q78 104 90 102 L104 104 L104 170 Q90 176 82 166 Z" {...zoneProps('lungs')} />
      <path d="M140 112 Q142 104 130 102 L116 104 L116 170 Q130 176 138 166 Z" {...zoneProps('lungs')} />
      <path d="M110 150 C 96 136, 88 124, 100 118 C 106 115, 110 120, 110 124 C 110 120, 114 115, 120 118 C 132 124, 124 136, 110 150 Z"
        {...zoneProps('heart')} stroke={selected === 'heart' ? 'var(--text)' : 'var(--silhouette)'} />
      <rect x="84" y="182" width="52" height="58" rx="14" {...zoneProps('abdomen')} />
      <path d="M66 262 L104 262 L94 410 L74 410 Z" {...zoneProps('legs')} />
      <path d="M116 262 L154 262 L146 410 L126 410 Z" {...zoneProps('legs')} />
    </svg>
  )
}

/** Synthetic ECG on "paper" grid, driven by the simulated heart rate (no real ECG hardware). */
export function EcgStrip({ hr, irregular, status }: { hr: number; irregular: boolean; status: Status }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hrRef = useRef(hr)
  const irrRef = useRef(irregular)
  hrRef.current = hr
  irrRef.current = irregular
  const theme = useTheme()

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    const dpr = devicePixelRatio
    const W = (cv.width = Math.round(cv.clientWidth * dpr))
    const H = (cv.height = Math.round(150 * dpr))
    const bg = cssVar('--surface-2')
    const minor = cssVar('--line')
    const major = cssVar('--line-strong')
    const trace = status === 'normal' ? cssVar('--text') : cssVar(status === 'watch' ? '--watch' : '--alert')
    const step = Math.max(4, Math.round(8 * dpr))

    const paintGrid = (x0: number, w: number) => {
      ctx.fillStyle = bg
      ctx.fillRect(x0, 0, w, H)
      for (let gx = Math.ceil(x0 / step) * step; gx < x0 + w; gx += step) {
        ctx.fillStyle = Math.round(gx / step) % 5 === 0 ? major : minor
        ctx.fillRect(gx, 0, 1, H)
      }
      for (let gy = 0; gy < H; gy += step) {
        ctx.fillStyle = Math.round(gy / step) % 5 === 0 ? major : minor
        ctx.fillRect(x0, gy, w, 1)
      }
    }
    paintGrid(0, W)

    const pxPerSec = 110 * dpr
    let x = 0, beatT = 0, rr = 60 / hrRef.current, last = performance.now(), prevY = H * 0.6, raf = 0
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
        const y = H * 0.64 - wave(p) * H * 0.5
        paintGrid(x, Math.round(10 * dpr))
        ctx.strokeStyle = trace
        ctx.lineWidth = 1.75 * dpr
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(x - 1, prevY)
        ctx.lineTo(x, y)
        ctx.stroke()
        prevY = y
        x += 1
        if (x >= W) x = 0
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [status, theme])

  return <canvas ref={ref} style={{ width: '100%', height: 150, borderRadius: 14, display: 'block' }} />
}

const TREND_CFG: Record<string, { keys: string[]; label: string; normal?: [number, number]; domain?: [number, number] }> = {
  hr: { keys: ['hr'], label: 'Heart rate, bpm', normal: [60, 100], domain: [30, 170] },
  rhythm: { keys: ['hr'], label: 'Heart rate, bpm', normal: [60, 100], domain: [30, 170] },
  bp: { keys: ['sys', 'dia'], label: 'Blood pressure, mmHg', normal: [60, 120], domain: [40, 180] },
  spo2: { keys: ['spo2'], label: 'SpO2, %', normal: [95, 100], domain: [80, 100] },
  rr: { keys: ['rr'], label: 'Breathing rate, /min', normal: [12, 18], domain: [5, 35] },
  temp: { keys: ['temp'], label: 'Temperature, °C', normal: [36.1, 37.2], domain: [35, 40] },
}
const LINE_COLORS = ['var(--chart-1)', 'var(--chart-2)']
const AXIS = { fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)' }

export function TrendChart({ crewId, metric }: { crewId: string; metric: string }) {
  const [data, setData] = useState<any[]>([])
  const t = useT()
  const lang = useLang()
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
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="label">{t(cfg.label)}</span>
        <span className="label" style={{ color: 'var(--faint)' }}>{t('Last 5 min · band = normal at rest')}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="x" tick={AXIS} axisLine={false} tickLine={false} unit={unit(lang, 's')} type="number" domain={['dataMin', 0]} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={cfg.domain} allowDataOverflow />
          {cfg.normal && <ReferenceArea y1={cfg.normal[0]} y2={cfg.normal[1]} fill="var(--band)" fillOpacity={1} />}
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,.12)', fontSize: 12 }}
            labelStyle={{ color: 'var(--muted)' }} itemStyle={{ color: 'var(--text)' }}
            labelFormatter={(l) => `${l} ${unit(lang, 's')}`} />
          {cfg.keys.map((k, i) => (
            <Line key={k} dataKey={k} stroke={LINE_COLORS[i]} dot={false} isAnimationActive={false} strokeWidth={1.75} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
