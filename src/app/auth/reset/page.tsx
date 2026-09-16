'use client'

// Where the "set a new password" email lands. The link signs the browser in just
// long enough to change the password, so this page only has to collect the new one
// and hand it to updateUser. Arriving here without that session means the link was
// stale or already used, and the page says so instead of failing on submit.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarRange, Loader2, TriangleAlert } from 'lucide-react'
import { backendOn } from '@/lib/db'
import { hasSession, updatePassword } from '@/lib/session'
import { PasswordField } from '@/components/ui/PasswordField'
import { PasswordRules } from '@/components/ui/PasswordRules'
import { passwordOk } from '@/lib/password'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState<boolean | null>(null) // null while the link is being checked
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // the client picks the recovery token out of the URL as it loads, so give it a
  // moment before deciding the link was bad
  useEffect(() => {
    if (!backendOn) { setReady(false); return }
    let cancelled = false
    const check = async () => {
      for (let i = 0; i < 20; i++) {
        if (await hasSession()) { if (!cancelled) setReady(true); return }
        await new Promise((r) => setTimeout(r, 150))
      }
      if (!cancelled) setReady(false)
    }
    void check()
    return () => { cancelled = true }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const err = await updatePassword(password)
    setBusy(false)
    if (err) { setError(err); return }
    setDone(true)
    setTimeout(() => router.replace('/home'), 1400)
  }

  const strong = passwordOk(password)
  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = strong && confirm === password

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-s1 p-7 shadow-soft sm:p-8">
        <Link href="/home" className="flex w-fit items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-on-accent">
            <CalendarRange size={16} />
          </span>
          <span className="font-serif text-[21px] tracking-[-0.01em]">Hourelle</span>
        </Link>

        {ready === null && <p className="mt-7 text-[13.5px] text-dim">Checking your link…</p>}

        {ready === false && (
          <>
            <h1 className="mt-7 font-serif text-[27px] leading-[1.08] tracking-[-0.01em]">This link has expired</h1>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">
              Reset links only work once, and not for long. Ask for a new one and it will land in your inbox.
            </p>
            <Link href="/auth/signin" className="mt-5 flex h-11 items-center justify-center rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent">
              Back to log in
            </Link>
          </>
        )}

        {ready === true && !done && (
          <>
            <h1 className="mt-7 font-serif text-[27px] leading-[1.08] tracking-[-0.01em]">Set a new password</h1>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">Pick something you have not used here before.</p>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-2">
              <PasswordField
                id="reset-password"
                label="New password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint={<PasswordRules value={password} />}
              />
              <PasswordField
                id="reset-confirm"
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                invalid={mismatch}
                hint={mismatch ? <p className="text-[12px] text-brick-text">Both passwords need to match.</p> : undefined}
              />
              <button
                type="submit" disabled={!canSubmit || busy}
                className="mt-2 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-40"
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                Save new password
              </button>
            </form>

            {error && (
              <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-brick-border bg-brick-bg px-3.5 py-3">
                <TriangleAlert size={15} className="mt-0.5 flex-none text-brick-text" />
                <p className="text-[12.5px] leading-[1.55] text-brick-text">{error}</p>
              </div>
            )}
          </>
        )}

        {done && (
          <>
            <h1 className="mt-7 font-serif text-[27px] leading-[1.08] tracking-[-0.01em]">Password saved</h1>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">You are logged in. Taking you back to your events.</p>
          </>
        )}
      </div>
    </div>
  )
}
