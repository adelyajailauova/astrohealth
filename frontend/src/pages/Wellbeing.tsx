import { useEffect, useRef, useState } from 'react'
import { Bar, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { post } from '../api'
import type { Finding, OnboardState } from '../api'
import { SourceList, StatusBadge } from '../components'
import { unit, useLang, useT } from '../i18n'

const MOOD_WORDS = ['Very low', 'Low', 'Okay', 'Good', 'Great']
const SYMPTOMS = ['dizziness', 'fainting', 'headache', 'vision changes', 'palpitations', 'nausea', 'rash', 'trouble sleeping']

function Scale({ value, onChange, words }: { value: number; onChange: (n: number) => void; labels?: string[]; words?: string[] }) {
  const t = useT()
  return (
    <div className="row" style={{ gap: 10 }}>
      <div className="slider">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={value === n ? 'active' : ''} onClick={() => onChange(n)} aria-label={words ? t(words[n - 1]) : String(n)}>{n}</button>
        ))}
      </div>
      {words && value > 0 && <span className="small muted">{t(words[value - 1])}</span>}
    </div>
  )
}

const BODY_SCAN = [
  'Settle into your restraint. Let your arms float. Notice the breath without changing it.',
  'Bring attention to your feet and legs. Notice any tension and let it soften.',
  'Move attention to your belly. Feel it rise on the in-breath and fall on the out-breath.',
  'Notice your chest and shoulders. Let the shoulders drop away from the ears.',
  'Relax your jaw, your face, the space around your eyes.',
  'Picture Earth below the window. Notice one thing you are grateful for today.',
  'Widen attention to the whole body breathing. When ready, open your eyes.',
]

function Practice({ crewId, kind, onDone }: { crewId: string; kind: 'breathing' | 'bodyscan'; onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [moodBefore, setMoodBefore] = useState(3)
  const [moodAfter, setMoodAfter] = useState<number | null>(null)
  const [inhale, setInhale] = useState(4)
  const [exhale, setExhale] = useState(6)
  const [minutes, setMinutes] = useState(kind === 'breathing' ? 3 : 5)
  const start = useRef(0)
  const t = useT()
  const lang = useLang()

  useEffect(() => {
    if (!running) return
    start.current = performance.now() - elapsed * 1000
    const id = setInterval(() => {
      const e = (performance.now() - start.current) / 1000
      setElapsed(e)
      if (e >= minutes * 60) setRunning(false)
    }, 100)
    return () => clearInterval(id)
  }, [running]) // eslint-disable-line

  const finished = elapsed >= minutes * 60
  const cycle = inhale + exhale
  const phaseT = elapsed % cycle
  const inPhase = phaseT < inhale
  const scale = inPhase ? 1 + 0.9 * (phaseT / inhale) : 1.9 - 0.9 * ((phaseT - inhale) / exhale)
  const step = BODY_SCAN[Math.min(BODY_SCAN.length - 1, Math.floor((elapsed / (minutes * 60)) * BODY_SCAN.length))]

  const save = async () => {
    await post('/api/wellbeing', { crew_id: crewId, kind, minutes: Math.round(elapsed / 6) / 10, mood_before: moodBefore, mood_after: moodAfter })
    setElapsed(0); setMoodAfter(null); onDone()
  }

  return (
    <div>
      {!running && elapsed === 0 && (
        <div className="grid" style={{ gap: 10 }}>
          <div className="row"><span className="muted" style={{ width: 140 }}>{t('Mood right now')}</span><Scale value={moodBefore} onChange={setMoodBefore} words={MOOD_WORDS} /></div>
          {kind === 'breathing' && (
            <div className="row">
              <span className="muted" style={{ width: 140 }}>{t('Pace')}</span>
              <label>{t('in')} <input type="number" min={3} max={8} value={inhale} onChange={(e) => setInhale(+e.target.value)} style={{ width: 56 }} /> {unit(lang, 's')}</label>
              <label>{t('out')} <input type="number" min={3} max={10} value={exhale} onChange={(e) => setExhale(+e.target.value)} style={{ width: 56 }} /> {unit(lang, 's')}</label>
              <span className="small muted">= {(60 / (inhale + exhale)).toFixed(1)} {t('breaths/min')}</span>
            </div>
          )}
          <div className="row"><span className="muted" style={{ width: 140 }}>{t('Duration')}</span>
            {[3, 5, 10].map((m) => <button key={m} className={minutes === m ? 'active' : ''} onClick={() => setMinutes(m)}>{m} {unit(lang, 'min')}</button>)}
          </div>
          <div><button className="primary" onClick={() => setRunning(true)}>{t('Start')}</button></div>
        </div>
      )}

      {(running || (elapsed > 0 && !finished)) && (
        <div>
          {kind === 'breathing' ? (
            <div className="breath-wrap">
              <div className="breath-ticks" />
              <div className="breath" style={{ transform: `scale(${scale})`, transitionDuration: '100ms' }} />
              <div className="breath-label">{t(inPhase ? 'Breathe in, belly rises' : 'Breathe out slowly')}</div>
            </div>
          ) : (
            <div className="breath-wrap" style={{ height: 200 }}>
              <p style={{ fontSize: 18, maxWidth: 520, textAlign: 'center', lineHeight: 1.5 }}>{t(step)}</p>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')} / {minutes}:00</span>
            <div className="row">
              <button onClick={() => setRunning(!running)}>{t(running ? 'Pause' : 'Resume')}</button>
              <button onClick={() => { setRunning(false); setElapsed(minutes * 60) }}>{t('Finish now')}</button>
            </div>
          </div>
        </div>
      )}

      {finished && !running && (
        <div className="grid" style={{ gap: 10 }}>
          <div>{t('Session complete. How do you feel now?')}</div>
          <Scale value={moodAfter ?? 0} onChange={setMoodAfter} words={MOOD_WORDS} />
          <div><button className="primary" disabled={moodAfter == null} onClick={save}>{t('Save (+15 pts)')}</button></div>
        </div>
      )}
    </div>
  )
}

export default function WellbeingPage({ state }: { state: OnboardState | null }) {
  const [crewId, setCrewId] = useState('c1')
  const [mood, setMood] = useState(3)
  const [stress, setStress] = useState(3)
  const [sleep, setSleep] = useState(6.5)
  const [glucose, setGlucose] = useState('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [journal, setJournal] = useState('')
  const [result, setResult] = useState<{ findings: Finding[]; suggest_wellbeing: boolean } | null>(null)
  const [tab, setTab] = useState<'breathing' | 'bodyscan'>('breathing')
  const [hist, setHist] = useState<any[]>([])
  const [refresh, setRefresh] = useState(0)
  const t = useT()
  const lang = useLang()

  useEffect(() => {
    fetch(`/api/history/${crewId}`).then((r) => r.json()).then((d) => setHist(d.checkins.map((c: any) => ({ ...c, day: c.date.slice(5) }))))
    setResult(null)
  }, [crewId, refresh])

  if (!state) return <div className="label" style={{ marginTop: 40 }}>{t('Connecting')}</div>
  const c = state.crew.find((x) => x.id === crewId) ?? state.crew[0]

  const submit = async () => {
    const r = await post('/api/checkin', {
      crew_id: crewId, mood, stress, sleep_hours: sleep, glucose: glucose ? +glucose : null, symptoms, journal,
    })
    setResult(r)
    setRefresh((x) => x + 1)
  }

  return (
    <>
    <div className="page-head">
      <div>
        <div className="label">{t('Daily routine · private to you and the flight surgeon')}</div>
        <h1 className="page-title">{t('Check-in')}</h1>
      </div>
    </div>
    <div className="grid cols-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{t('Daily check-in')}</h2>
            <select value={crewId} onChange={(e) => setCrewId(e.target.value)}>
              {state.crew.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            <div className="row"><span className="muted" style={{ width: 150 }}>{t('Mood')}</span><Scale value={mood} onChange={setMood} words={MOOD_WORDS} /></div>
            <div className="row"><span className="muted" style={{ width: 150 }}>{t('Stress (1 low – 5 high)')}</span><Scale value={stress} onChange={setStress} /></div>
            <div className="row"><span className="muted" style={{ width: 150 }}>{t('Sleep last night')}</span>
              <input type="range" min={0} max={10} step={0.5} value={sleep} onChange={(e) => setSleep(+e.target.value)} /> <b>{sleep} {unit(lang, 'h')}</b>
            </div>
            <div className="row"><span className="muted" style={{ width: 150 }}>{t('Fasting glucose')}</span>
              <input type="number" placeholder={t('optional')} value={glucose} onChange={(e) => setGlucose(e.target.value)} style={{ width: 110 }} /> {unit(lang, 'mg/dL')}
            </div>
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>{t('Symptoms today')}</div>
              <div className="row">
                {SYMPTOMS.map((s) => (
                  <button key={s} className={symptoms.includes(s) ? 'active' : ''}
                    onClick={() => setSymptoms(symptoms.includes(s) ? symptoms.filter((x) => x !== s) : [...symptoms, s])}>{t(s)}</button>
                ))}
              </div>
              {symptoms.includes('vision changes') && (
                <div className="small status watch" style={{ marginTop: 6 }}>{t('Vision changes are linked to SANS – flight surgeon will review an eye exam.')}
                  <SourceList ids={['nasa_sans']} /></div>
              )}
            </div>
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>{t('Private journal (NASA encourages journaling for morale)')}</div>
              <textarea rows={3} value={journal} onChange={(e) => setJournal(e.target.value)} placeholder={t('One thing that went well today…')} />
            </div>
            <div><button className="primary" onClick={submit}>{t('Submit check-in (+10 pts)')}</button></div>
          </div>
          {result && (
            <div style={{ marginTop: 14 }}>
              {result.findings.map((f) => (
                <div key={f.metric} className="event">
                  <div className="row"><StatusBadge s={f.status} /><b style={{ fontWeight: 500 }}>{t(f.label)}</b><span className="muted small">{t(f.value)}</span></div>
                  <div className="small advice">{t(f.advice)}</div>
                  <SourceList ids={f.sources} compact />
                </div>
              ))}
              {result.suggest_wellbeing && (
                <div className="banner watch" style={{ marginTop: 12 }}>
                  <span className="dot watch" />
                  <div>{t('Your check-in suggests stress or short sleep. A 3-minute slow-breathing session is recommended now.')}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>{t('Mood and sleep trend')}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={hist} margin={{ left: -20, right: 10 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" domain={[0, 10]} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: 'none', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,.12)', fontSize: 12 }} itemStyle={{ color: 'var(--text)' }} />
              <Bar yAxisId="l" dataKey="sleep_hours" name={t('Sleep (h)')} fill="var(--surface-3)" radius={[6, 6, 0, 0]} />
              <Line yAxisId="l" dataKey="mood" name={t('Mood (1-5)')} stroke="var(--chart-1)" strokeWidth={1.75} dot={false} />
              <Line yAxisId="l" dataKey="stress" name={t('Stress (1-5)')} stroke="var(--watch)" strokeWidth={1.75} dot={false} strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="small muted">{t('Earlier days are seeded demo data. Recommended sleep: 7–9 h.')}</div>
          <SourceList ids={['nhlbi_sleep']} compact />
        </div>
      </div>

      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{t('Wellbeing practices')}</h2>
            <div className="row">
              <span className="pill">{c.wellbeing.points} {t('pts')}</span>
              <span className="pill">{c.wellbeing.streak}{t('-day streak')}</span>
            </div>
          </div>
          <div className="row" style={{ margin: '12px 0' }}>
            <button className={tab === 'breathing' ? 'active' : ''} onClick={() => setTab('breathing')}>{t('Slow diaphragmatic breathing')}</button>
            <button className={tab === 'bodyscan' ? 'active' : ''} onClick={() => setTab('bodyscan')}>{t('Body-scan meditation')}</button>
          </div>
          <Practice key={tab + crewId} crewId={crewId} kind={tab} onDone={() => setRefresh((x) => x + 1)} />
        </div>

        <div className="card">
          <h2>{t('Why these practices · evidence')}</h2>
          <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.6, margin: 0 }}>
            <li><b style={{ fontWeight: 500 }}>{t('NASA requirement:')}</b> {t('missions must provide evidence-based asynchronous behavioral health protocols on electronic devices.')}</li>
            <li><b style={{ fontWeight: 500 }}>{t('Breathing:')}</b> {t('NIH NCCIH reports preliminary evidence that diaphragmatic breathing may help reduce stress (incl. cortisol and blood pressure); HRV-biofeedback breathing reduced self-reported stress and anxiety.')}</li>
            <li><b style={{ fontWeight: 500 }}>{t('Meditation:')}</b> {t('studied for anxiety, stress, depression and sleep; usually low-risk.')}</li>
            <li><b style={{ fontWeight: 500 }}>{t('Journaling and Earth view:')}</b> {t('NASA encourages journaling; windows reduce monotony and confinement.')}</li>
          </ul>
          <div style={{ marginTop: 8 }}><SourceList ids={['nasa_std3001_v1_3004', 'nccih_relax', 'nccih_meditation', 'nasa_behavior']} /></div>
          <div className="banner" style={{ marginTop: 10 }}>
            <span className="dot" />
            <div className="small">{t('Not a medical treatment. NCCIH notes ~8% of people report negative effects (mostly anxiety). If you feel worse, stop and request a private conference with the crew psychologist.')}</div>
          </div>
        </div>

        <div className="card">
          <h2>{t('Recent sessions')}</h2>
          {c.wellbeing.sessions.length === 0 && <div className="muted small">{t('No sessions yet.')}</div>}
          {c.wellbeing.sessions.slice(0, 5).map((s, i) => (
            <div key={i} className="event small row" style={{ justifyContent: 'space-between' }}>
              <span>{t(s.kind === 'breathing' ? 'Slow breathing' : 'Body scan')} · {s.minutes} {unit(lang, 'min')}</span>
              <span className="label">{t('Mood')} {s.mood_before ?? '–'} → {s.mood_after ?? '–'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  )
}
