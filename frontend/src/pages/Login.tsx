import { useEffect, useState } from 'react'
import { ApiError, post, setToken } from '../api'
import type { Account, User } from '../api'
import { useT } from '../i18n'

export default function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const t = useT()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [role, setRole] = useState<'astronaut' | 'staff'>('astronaut')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { fetch('/api/accounts').then((r) => r.json()).then(setAccounts).catch(() => setError(t('Server is not reachable. Is the backend running?'))) }, []) // eslint-disable-line
  const list = accounts.filter((a) => a.role === role)
  useEffect(() => { setUsername(list[0]?.username ?? ''); setPin(''); setError('') }, [role, accounts.length]) // eslint-disable-line

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username) { setError(t('Choose an account')); return }
    if (!pin) { setError(t('Enter your PIN')); return }
    setBusy(true)
    try {
      const r = await post<{ token: string; user: User }>('/api/login', { username, pin })
      setToken(r.token)
      onLogin(r.user)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t('Wrong account or PIN') : t('Server is not reachable. Is the backend running?'))
      setPin('')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '24px 0' }}>
      <form className="card" onSubmit={submit} style={{ width: 'min(420px, 100%)', padding: 28, display: 'grid', gap: 18 }}>
        <div>
          <div className="brand" style={{ marginBottom: 18 }}><span className="brand-mark" aria-hidden="true" />GaryshCare</div>
          <h1 className="page-title" style={{ fontSize: 32 }}>{t('Sign in')}</h1>
          <div className="page-sub">{t('Astronauts see only their own data. Medical staff see the whole crew.')}</div>
        </div>
        <div className="theme-toggle" role="group" aria-label={t('Role')} style={{ justifySelf: 'start' }}>
          {(['astronaut', 'staff'] as const).map((r) => (
            <button type="button" key={r} className={role === r ? 'on' : ''} aria-pressed={role === r} onClick={() => setRole(r)} style={{ fontSize: 12 }}>
              {t(r === 'astronaut' ? 'Astronaut' : 'Medical staff')}
            </button>
          ))}
        </div>
        <label className="grid" style={{ gap: 6 }}>
          <span className="label">{t('Account')}</span>
          <select value={username} onChange={(e) => { setUsername(e.target.value); setError('') }}>
            {list.map((a) => <option key={a.username} value={a.username}>{t(a.name)}</option>)}
          </select>
        </label>
        <label className="grid" style={{ gap: 6 }}>
          <span className="label">PIN</span>
          <input type="password" inputMode="numeric" autoComplete="current-password" value={pin}
            onChange={(e) => { setPin(e.target.value); setError('') }} style={{ fontSize: 20, letterSpacing: 6 }} />
        </label>
        {error && <div className="status alert small" role="alert">{error}</div>}
        <button className="primary" type="submit" disabled={busy} style={{ padding: '12px 16px' }}>{t('Sign in')}</button>
        <div className="small muted">{t('Demo accounts and PINs are listed in the project README.')}</div>
      </form>
    </div>
  )
}
