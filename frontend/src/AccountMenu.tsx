import { useEffect, useRef, useState } from 'react'
import type { User } from './api'
import { useT } from './i18n'

function initials(name: string) {
  const parts = name.replace(/^(Cmdr|Dr|Eng)\.\s*/i, '').split(/\s+/).filter(Boolean)
  return parts.slice(-2).map((p) => p[0]).join('').toUpperCase()
}

/** Account button in the header; opens a small window with who is signed in and a sign-out action. */
export default function AccountMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const staff = user.role === 'staff'

  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('mousedown', click)
    addEventListener('keydown', key)
    return () => { removeEventListener('mousedown', click); removeEventListener('keydown', key) }
  }, [open])

  return (
    <div className="account" ref={box}>
      <button className="account-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
        <span className="account-name">{t(user.name)}</span>
        <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div className="account-pop" role="dialog" aria-label={t('Account')}>
          <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
            <span className="avatar lg" aria-hidden="true">{initials(user.name)}</span>
            <div>
              <div style={{ fontWeight: 600, letterSpacing: -0.2 }}>{t(user.name)}</div>
              <div className="label" style={{ marginTop: 2 }}>{t(staff ? 'Medical staff' : 'Astronaut')} · {user.username}</div>
            </div>
          </div>
          <div className="small muted">{t(staff ? 'You can see the whole crew and Mission Control.' : 'You can see only your own health data.')}</div>
          <button className="signout" onClick={() => { setOpen(false); onLogout() }}>{t('Sign out')}</button>
        </div>
      )}
    </div>
  )
}
