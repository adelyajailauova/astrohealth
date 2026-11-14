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
  symptoms: string[]; journal: string; date: string; submitted_at?: number
}

export interface Period { start: string; days: number | null; flow: string; symptoms: string[] }
export interface Cycle { enabled: boolean; suppression: boolean; periods: Period[]; demo?: boolean }

export interface User { username: string; role: 'astronaut' | 'staff'; crew_id: string | null; name: string }
export interface Account extends User {}

export interface Wellbeing {
  points: number; streak: number
  sessions: { kind: string; minutes: number; mood_before?: number; mood_after?: number; t: number }[]
}

export interface CrewState {
  id: string; name: string; role: string; scenario: string
  vitals: Vitals; findings: Finding[]; overall: Status
  zones: Record<string, Status>; checkin: Checkin | null; wellbeing: Wellbeing; cycle: Cycle
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
  events: { t: number; crew_id: string; crew: string; metric_name: string; status: Status; label: string; advice: string }[]
  inbox: Record<string, Msg<{ crew_id: string; text: string; from: string }>[]>
}

export interface GroundState {
  t: number; link: LinkInfo
  telemetry: Partial<Msg<{ crew: Record<string, { name: string; vitals: Vitals; overall: Status; zones: Record<string, Status> }> }>>
  reports: Msg<any>[]
  sent: Msg<{ crew_id: string; text: string }>[]
}

export interface AiSummary {
  ready: boolean; unavailable?: boolean; have?: number; need?: number
  level: number; level_name: 'NORMAL' | 'WATCH' | 'ALERT' | 'CRITICAL'; text: string
  risks: { metric: string; horizon: number; value: number; dir: 'above' | 'below' }[]
  forecast: Record<string, { current: number; trend: 'rising' | 'falling' | 'stable'; horizons: Record<string, { pred: number; low: number; high: number }> }>
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

// ---- auth: token kept per browser tab (sessionStorage), so each teammate signs in separately
const TOKEN_KEY = 'astro_token'
export function getToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(t: string | null) {
  try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}
function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}
/** Called when the server says the session is gone (401): the app shows the login screen again. */
let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn }

export class ApiError extends Error {
  status: number
  constructor(status: number, msg: string) { super(msg); this.status = status }
}

async function handle<T>(r: Response): Promise<T> {
  if (r.status === 401) onUnauthorized()
  if (!r.ok) throw new ApiError(r.status, await r.text())
  return r.json()
}
export async function get<T = any>(path: string): Promise<T> {
  return handle<T>(await fetch(path, { headers: authHeaders() }))
}
export async function post<T = any>(path: string, body: unknown): Promise<T> {
  return handle<T>(await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) }))
}

export const UserContext = createContext<User | null>(null)
export const useUser = () => useContext(UserContext)

export function useSocket<T>(path: string | null): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let ws: WebSocket | null = null
    let stop = false
    let retry: ReturnType<typeof setTimeout>
    setData(null)
    if (!path) return
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const token = getToken()
      if (!token) return
      ws = new WebSocket(`${proto}://${location.host}${path}?token=${encodeURIComponent(token)}`)
      ws.onmessage = (e) => setData(JSON.parse(e.data))
      ws.onclose = (e) => {
        if (e.code === 4401) { onUnauthorized(); return }
        if (e.code === 4403) return
        if (!stop) retry = setTimeout(connect, 1500)
      }
    }
    connect()
    return () => { stop = true; clearTimeout(retry); ws?.close() }
  }, [path])
  return data
}

export const MetaContext = createContext<Meta | null>(null)
export const useMeta = () => useContext(MetaContext)

export type Theme = 'light' | 'dark'
export const ThemeContext = createContext<Theme>('light')
export const useTheme = () => useContext(ThemeContext)

/** Read a CSS custom property (for canvas drawing, which can't use var()). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export const STATUS_LABEL: Record<Status, string> = {
  normal: 'Normal', watch: 'Watch', alert: 'Alert', critical: 'Critical',
}

