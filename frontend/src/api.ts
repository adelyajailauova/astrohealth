import { createContext, useContext, useEffect, useState } from 'react'

export type Status = 'normal' | 'watch' | 'alert' | 'critical'

export interface Finding {
  metric: string
  level: number
  status: Status
  label: string
  advice: string
  sources: string[]
  origin: 'source' | 'app'
  value: string
}

export interface Vitals {
  hr: number; sys: number; dia: number; spo2: number; rr: number; temp: number
  irregular: boolean; activity: string; symptoms: string[]
  exercise_min: number; mission_msv: number; career_msv: number
}

export interface Checkin {
  mood: number; stress: number; sleep_hours: number; glucose: number | null
  symptoms: string[]; journal: string; date: string
}

export interface Wellbeing {
  points: number; streak: number
  sessions: { kind: string; minutes: number; mood_before?: number; mood_after?: number; t: number }[]
}

export interface CrewState {
  id: string; name: string; role: string; scenario: string
  vitals: Vitals; findings: Finding[]; overall: Status
  zones: Record<string, Status>; checkin: Checkin | null; wellbeing: Wellbeing
  baseline: { hr: number; sys: number; dia: number; temp: number }
}

export interface LinkInfo {
  location: string; location_name: string; real_delay_s: number; demo_delay_s: number
  compression: number; delay_source: string | null; outage: boolean
  downlink_pending: { total: number; by_priority: Record<string, number> }
  uplink_pending: { total: number; by_priority: Record<string, number> }
}

export interface Msg<P = any> {
  id: number; kind: string; priority: string; created_at: number; deliver_at: number
  received_at?: number; payload: P
}

export interface OnboardState {
  t: number; link: LinkInfo; crew: CrewState[]
  events: { t: number; crew: string; metric_name: string; status: Status; label: string; advice: string }[]
  inbox: Record<string, Msg<{ crew_id: string; text: string; from: string }>[]>
}

export interface GroundState {
  t: number; link: LinkInfo
  telemetry: Partial<Msg<{ crew: Record<string, { name: string; vitals: Vitals; overall: Status; zones: Record<string, Status> }> }>>
  reports: Msg<any>[]
  sent: Msg<{ crew_id: string; text: string }>[]
}

export interface Source { org: string; title: string; url: string; quote: string }
export interface MetricInfo { name: string; unit: string; zone: string; why: string; how: string; sources: string[] }
export interface Meta {
  metrics: Record<string, MetricInfo>
  sources: Record<string, Source>
  scenarios: Record<string, string>
  locations: Record<string, { name: string; real_delay_s: number; source: string | null }>
  career_limit_msv: number
}

export async function post<T = any>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export function useSocket<T>(path: string): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let ws: WebSocket | null = null
    let stop = false
    let retry: ReturnType<typeof setTimeout>
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}${path}`)
      ws.onmessage = (e) => setData(JSON.parse(e.data))
      ws.onclose = () => { if (!stop) retry = setTimeout(connect, 1500) }
    }
    connect()
    return () => { stop = true; clearTimeout(retry); ws?.close() }
  }, [path])
  return data
}

export const MetaContext = createContext<Meta | null>(null)
export const useMeta = () => useContext(MetaContext)

export const STATUS_LABEL: Record<Status, string> = {
  normal: 'Normal', watch: 'Watch', alert: 'Alert', critical: 'Critical',
}

export function fmtDelay(s: number): string {
  if (s >= 60) return `${(s / 60).toFixed(0)} min`
  return `${s.toFixed(1)} s`
}

export function ago(t: number, now = Date.now() / 1000): string {
  const d = Math.max(0, now - t)
  if (d < 60) return `${d.toFixed(0)}s ago`
  return `${Math.floor(d / 60)}m ago`
}
