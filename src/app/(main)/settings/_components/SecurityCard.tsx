'use client'

/* Security — the password and the sessions it protects.
   Two things a person actually comes here to do: change the password, and end every
   session after losing a phone. Deleting the account lives on the profile page with
   the rest of the account, and this card points at it rather than repeating it.
   An account that only ever used the Google button has no password, so the form
   sets a first one instead of changing an existing one. */

import { useEffect, useState } from 'react'
import { Check, Loader2, ShieldCheck } from 'lucide-react'
import { PasswordField } from '@/components/ui/PasswordField'
import { changePassword, signInProviders, signOutEverywhere, updatePassword, type Account } from '@/lib/session'
import { backendOn } from '@/lib/db'
import { passwordOk } from '@/lib/password'
import { PasswordRules } from '@/components/ui/PasswordRules'

export function SecurityCard({ account }: { account: Account }) {
  // which doors this account has. Unknown until the round trip lands; until then the
  // form assumes a password, which is the common case and the safer of the two
  const [providers, setProviders] = useState<string[] | null>(null)
  useEffect(() => { void signInProviders().then(setProviders) }, [])
  const googleOnly = !!providers && providers.length > 0 && !providers.includes('email')

  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const strong = passwordOk(next)
  const mismatch = confirm.length > 0 && confirm !== next
  const canSave = strong && confirm === next && (googleOnly || current.length > 0)

  function reset() {
    setOpen(false); setCurrent(''); setNext(''); setConfirm(''); setErr(null)
  }
  async function save() {
    if (!canSave || busy) return
    setBusy(true); setErr(null)
    const error = googleOnly ? await updatePassword(next) : await changePassword(current, next)
    setBusy(false)
    if (error) { setErr(error); return }
    reset()
    setDone(true)
    setTimeout(() => setDone(false), 2600)
  }

  // ending every session logs this browser out too, so it asks once first
  const [confirmOut, setConfirmOut] = useState(false)
  const [outBusy, setOutBusy] = useState(false)
  const [outErr, setOutErr] = useState<string | null>(null)
  async function endAll() {
    setOutBusy(true); setOutErr(null)
    const error = await signOutEverywhere()
    setOutBusy(false)
    if (error) { setOutErr(error); setConfirmOut(false); return }
    window.location.href = '/'
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-s1">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Password</div>
            <div className="mt-0.5 text-[12.5px] text-dim">
              {googleOnly ? 'You log in with Google.' : `Logs you in as ${account.email ?? 'your account'}.`}
            </div>
          </div>
          {done ? (
            <span className="flex h-9 items-center gap-1.5 rounded-[9px] border border-teal-border bg-teal-bg px-3 text-[13px] font-semibold text-teal-text">
              <Check size={15} /> Saved
            </span>
          ) : (
            <button
              type="button"
              onClick={() => (open ? reset() : setOpen(true))}
              className="flex h-9 flex-none items-center rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold hover:bg-s2"
            >
              {open ? 'Cancel' : googleOnly ? 'Set a password' : 'Change password'}
            </button>
          )}
        </div>

        {open && (
          <form
            onSubmit={(e) => { e.preventDefault(); void save() }}
            className="mt-3 flex max-w-[380px] flex-col gap-2 border-t border-border pt-3"
          >
            {!googleOnly && (
              <PasswordField id="security-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
            )}
            <PasswordField
              id="security-new"
              label="New password"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              // the rule stays on screen while you type, which a placeholder cannot do
              hint={<PasswordRules value={next} />}
            />
            <PasswordField
              id="security-confirm"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              invalid={mismatch}
              hint={mismatch ? <p className="text-[12px] text-brick-text">Both passwords need to match.</p> : undefined}
            />
            {err && <p role="alert" className="mt-1 text-[12.5px] font-medium text-brick-text">{err}</p>}
            <button
              type="submit"
              disabled={!canSave || busy}
              className="mt-2 flex h-10 items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-40"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {googleOnly ? 'Set password' : 'Change password'}
            </button>
          </form>
        )}
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">Where you are logged in</div>
            {confirmOut && <div className="mt-0.5 text-[12.5px] text-dim">This logs out every device, including this one.</div>}
          </div>
          {confirmOut ? (
            <div className="flex flex-none items-center gap-2">
              <button
                type="button"
                onClick={() => void endAll()}
                disabled={outBusy}
                className="flex h-9 items-center gap-1.5 rounded-[9px] bg-brick px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {outBusy && <Loader2 size={14} className="animate-spin" />} Log out everywhere
              </button>
              <button type="button" onClick={() => setConfirmOut(false)} className="h-9 px-1 text-[13px] font-semibold text-dim hover:text-text">
                Keep me in
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOut(true)}
              className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold hover:bg-s2"
            >
              <ShieldCheck size={15} /> Log out everywhere
            </button>
          )}
        </div>
        {outErr && <p role="alert" className="mt-2 text-[12.5px] font-medium text-brick-text">{outErr}</p>}
      </div>

      {!backendOn && (
        <p className="border-t border-border bg-s0 px-5 py-3 text-[12.5px] leading-[1.55] text-faint">
          These need a backend. Add your Supabase keys to .env.local and they start working.
        </p>
      )}
    </div>
  )
}
