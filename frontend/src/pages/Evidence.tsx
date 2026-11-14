import { useMeta } from '../api'
import { SourceList } from '../components'
import { useT } from '../i18n'

/** Every threshold used by the assessment engine, with its source. Mirrors backend/app/assess.py. */
const RULES: { metric: string; rows: [string, string, string, 'source' | 'app'][] }[] = [
  { metric: 'hr', rows: [
    ['Normal', '60–100 bpm at rest', 'mp_pulse', 'source'],
    ['Normal (athlete)', '40–59 bpm', 'mp_pulse', 'source'],
    ['Watch', '101–120 bpm at rest (tachycardia)', 'mp_pulse', 'source'],
    ['Alert', '> 120 or < 40 bpm at rest', 'mp_pulse', 'app'],
  ] },
  { metric: 'rhythm', rows: [['Alert', 'Irregular RR intervals → ECG to flight surgeon', 'nasa_cardio', 'app']] },
  { metric: 'bp', rows: [
    ['Normal', '90/60 – <120/80 mmHg', 'mp_lbp', 'source'],
    ['Watch', 'Elevated 120–129 / <80; Stage 1 130–139 or 80–89', 'mp_hbp', 'source'],
    ['Alert', 'Stage 2 ≥ 140/90', 'mp_hbp', 'source'],
    ['Watch', '< 90/60 or drop ≥ 20 mmHg from baseline', 'mp_lbp', 'source'],
    ['Alert', 'Low BP + dizziness/fainting', 'mp_lbp', 'source'],
  ] },
  { metric: 'spo2', rows: [
    ['Normal', '95–100 %', 'mp_pulseox', 'source'],
    ['Watch', '93–94 %', 'mp_pulseox', 'source'],
    ['Alert', '≤ 92 % → contact provider', 'mp_pulseox', 'source'],
    ['Critical', '≤ 88 % → immediate attention', 'mp_pulseox', 'source'],
  ] },
  { metric: 'rr', rows: [
    ['Normal', '12–18 /min at rest', 'mp_vitals', 'source'],
    ['Alert', '< 8 or > 24 /min', 'mp_vitals', 'app'],
  ] },
  { metric: 'temp', rows: [
    ['Normal', '36.1–37.2 °C', 'mp_temp', 'source'],
    ['Alert', '> 38.0 °C at rest (fever)', 'mp_temp', 'source'],
    ['Watch', '> 38.0 °C during exercise (faster heat rise in space)', 'nasa_wearables', 'source'],
  ] },
  { metric: 'glucose', rows: [
    ['Normal', 'Fasting 70–99 mg/dL', 'mp_glucose', 'source'],
    ['Watch', 'Fasting 100–125 mg/dL', 'mp_glucose', 'source'],
    ['Alert', '≥ 126 mg/dL fasting, or < 70 mg/dL (hypoglycemia)', 'mp_hypoglycemia', 'source'],
  ] },
  { metric: 'sleep', rows: [
    ['Normal', '≥ 7 h', 'nhlbi_sleep', 'source'],
    ['Alert', '< 5 h', 'nhlbi_sleep', 'app'],
  ] },
  { metric: 'mood', rows: [
    ['Watch', 'Mood 2/5 or stress ≥ 4/5 → breathing / meditation offered', 'nasa_behavior', 'app'],
    ['Alert', 'Mood 1/5 → private psychologist conference offered', 'nasa_std3001_v1_3004', 'app'],
  ] },
  { metric: 'exercise', rows: [['Watch', '< 90 min/day (ISS routine ≈ 1.5 h)', 'nasa_fitness', 'source']] },
  { metric: 'radiation', rows: [
    ['Limit', 'Career effective dose < 600 mSv', 'nasa_std3001_v1_4030', 'source'],
    ['Watch / Alert', '≥ 50 % / ≥ 80 % of career limit', 'nasa_std3001_v1_4030', 'app'],
  ] },
]

export default function EvidencePage() {
  const meta = useMeta()
  const t = useT()
  if (!meta) return null
  return (
    <>
    <div className="page-head">
      <div>
        <div className="label">{t('NASA · CSA · NIH · verified November 2026')}</div>
        <h1 className="page-title">{t('Evidence')}</h1>
      </div>
    </div>
    <div className="grid">
      <div className="card">
        <h2>{t('How to read this')}</h2>
        <p style={{ marginTop: 0, maxWidth: 820 }}>
          {t('Every threshold used by the onboard assessment engine is listed here with its source.')}{' '}
          <span className="badge source" style={{ margin: '0 6px' }}>{t('Cited threshold')}</span> {t('means the number is taken directly from the cited page.')}{' '}
          <span className="badge app" style={{ margin: '0 6px' }}>{t('App rule')}</span> {t('marks our own design choice for when to escalate to the ground – to be validated by flight surgeons.')}
        </p>
        <p className="muted small">{t("Clinical ranges are general adult references (NIH MedlinePlus / NHLBI). In a real mission they would be personalised to each astronaut's pre-flight baseline by the flight surgeon. Sensor data in this prototype is simulated.")}</p>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>{t('Indicator')}</th><th>{t('Status')}</th><th>{t('Rule')}</th><th>{t('Type')}</th><th>{t('Source')}</th></tr></thead>
          <tbody>
            {RULES.flatMap((r) => r.rows.map((row, i) => (
              <tr key={r.metric + i}>
                <td>{i === 0 ? <span style={{ fontWeight: 500 }}>{t(meta.metrics[r.metric].name)}</span> : ''}</td>
                <td>{t(row[0])}</td>
                <td>{t(row[1])}</td>
                <td><span className={`badge ${row[3]}`}>{t(row[3] === 'source' ? 'Cited' : 'App rule')}</span></td>
                <td><SourceList ids={[row[2]]} /></td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>{t('All sources (quotes verified against the live pages)')}</h2>
        <p className="small muted" style={{ marginTop: -6 }}>{t('Quotes are kept verbatim in the original language of the source.')}</p>
        <table>
          <tbody>
            {Object.entries(meta.sources).map(([id, s]) => (
              <tr key={id}>
                <td style={{ width: 140 }}><span className="label">{s.org}</span></td>
                <td><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><div className="small muted">“{s.quote}”</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  )
}
