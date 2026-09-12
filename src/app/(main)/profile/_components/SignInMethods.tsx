'use client'

/* How you log in — and the way to end up with one account instead of two.
   One row per door: the email and password you signed up with, and the Google
   button. Connecting Google adds it to the account you are already in, which is
   what makes both doors open the same place. Below them, the way back from having
   made two accounts by accident: give the other one's email and password and it is
   folded into this one. */

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Link2, Link2Off, Merge } from 'lucide-react'
import { PasswordField } from '@/components/ui/PasswordField'
import { pushFlash } from '@/components/ui/FlashToast'
import { listIdentities, linkGoogle, mergeAccount, unlinkGoogle, type Account, type Identity } from '@/lib/session'
import { backendOn } from '@/lib/db'

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

const Row = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div className={`px-5 py-4 ${first ? '' : 'border-t border-border'}`}>{children}</div>
)

export function SignInMethods({ account }: { account: Account }) {
  const [identities, setIdentities] = useState<Identity[] | null>(null)
  const [busy, setBusy] = useState<'link' | 'unlink' | 'merge' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const read = useCallback(() => { void listIdentities().then(setIdentities) }, [])
  useEffect(() => {
    read()
    // coming back from Google, the callback lands here with ?linked=google. The
    // row below says "connected" on its own once the identities land, so the only
    // thing left to do is say it out loud once and tidy the address bar
    const p = new URLSearchParams(window.location.search)
    if (p.get('linked') === 'google') {
      pushFlash('Google is connected. Both ways in work now.', 'accent')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [read])

  const google = identities?.find((i) => i.provider === 'google')
  const hasPassword = !!identities?.some((i) => i.provider === 'email')
  const onlyDoor = (identities?.length ?? 0) < 2

  async function connect() {
    setBusy('link'); setErr(null); setDone(null)
    const error = await linkGoogle('/profile?linked=google')
    if (error) { setErr(error); setBusy(null) } // no error means the browser is leaving for Google
  }
  async function disconnect() {
    setBusy('unlink'); setErr(null); setDone(null)
    const error = await unlinkGoogle()
    setBusy(null)
    if (error) { setErr(error); return }
    setDone('Google is disconnected.')
    read()
  }

  // bringing another account in
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  async function merge() {
    if (!email.trim() || !password) return
    setBusy('merge'); setErr(null); setDone(null)
    const { error, events } = await mergeAccount(email.trim(), password)
    setBusy(null)
    if (error) { setErr(error); return }
    setEmail(''); setPassword(''); setOpen(false)
    setDone(events ? `Done. ${events} ${events === 1 ? 'event' : 'events'} moved over, and the other account is closed.` : 'Done. The other account is closed and everything on it is here.')
    read()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-s1">
      <Row first>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Email and password</div>
            <div className="mt-0.5 truncate text-[12.5px] text-dim">
              {hasPassword ? account.email ?? 'Set up' : 'Not set up'}
            </div>
          </div>
          {hasPassword && <span className="flex h-7 flex-none items-center gap-1.5 rounded-[8px] border border-teal-border bg-teal-bg px-2.5 text-[12px] font-semibold text-teal-text"><Check size={13} /> On</span>}
        </div>
      </Row>

      <Row>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-border bg-s2"><GoogleMark /></span>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">Google</div>
              <div className="mt-0.5 truncate text-[12.5px] text-dim">
                {identities === null ? 'Checking…' : google ? google.email ?? 'Connected' : 'Not connected'}
              </div>
            </div>
          </div>
          {identities !== null && (google ? (
            <button
              type="button" onClick={() => void disconnect()} disabled={busy !== null || onlyDoor}
              title={onlyDoor ? 'This is the only way in to your account' : undefined}
              className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold hover:bg-s2 disabled:opacity-40"
            >
              {busy === 'unlink' ? <Loader2 size={14} className="animate-spin" /> : <Link2Off size={15} />} Disconnect
            </button>
          ) : (
            <button
              type="button" onClick={() => void connect()} disabled={busy !== null || !backendOn}
              className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13px] font-semibold text-on-accent disabled:opacity-40"
            >
              {busy === 'link' ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={15} />} Connect
            </button>
          ))}
        </div>
      </Row>

      <Row>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Another account of yours</div>
            {open && <div className="mt-0.5 text-[12.5px] text-dim">Its events, answers and messages move here, and it is closed for good.</div>}
          </div>
          <button
            type="button" onClick={() => { setOpen(!open); setErr(null) }} disabled={busy !== null}
            className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold hover:bg-s2 disabled:opacity-40"
          >
            {open ? 'Cancel' : <><Merge size={15} /> Bring it in</>}
          </button>
        </div>

        {open && (
          <form onSubmit={(e) => { e.preventDefault(); void merge() }} className="mt-3 flex max-w-[380px] flex-col gap-2 border-t border-border pt-3">
            <label htmlFor="merge-email" className="block text-[12.5px] font-semibold text-dim">Its email</label>
            <input
              id="merge-email" type="email" autoComplete="off" inputMode="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="h-11 rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none placeholder:text-faint focus:border-accent-border"
            />
            <PasswordField id="merge-password" label="Its password" value={password} onChange={setPassword} autoComplete="off" />
            <p className="mt-1 text-[12px] leading-[1.5] text-faint">A Google-only account has no password to prove.</p>
            <button
              type="submit" disabled={!email.trim() || !password || busy !== null}
              className="mt-2 flex h-10 items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-40"
            >
              {busy === 'merge' && <Loader2 size={15} className="animate-spin" />} Bring it in
            </button>
          </form>
        )}
      </Row>

      {(err || done) && (
        <p role={err ? 'alert' : undefined} className={`border-t border-border px-5 py-3 text-[12.5px] leading-[1.55] ${err ? 'font-medium text-brick-text' : 'text-teal-text'}`}>
          {err ?? done}
        </p>
      )}
    </div>
  )
}
