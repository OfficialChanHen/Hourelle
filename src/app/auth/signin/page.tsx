'use client'

import { Suspense, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, CalendarRange, Check, Loader2, MailCheck, TriangleAlert } from 'lucide-react'
import { useGuestMode } from '@/hooks/useGuestMode'
import { backendOn } from '@/lib/db'
import { hasSession, sendPasswordReset, signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/lib/session'
import { PasswordField } from '@/components/ui/PasswordField'

/* ── log in, sign up, or ask for a new password ──
   Split like the sign-in pages people know: the form on the left, the pitch on the
   right in the signature green. The Aline account leads because it finishes without
   leaving the page; Google sits under the divider. Guests never need this screen at
   all, an invite link works without an account. */

const BENEFITS = [
  'Host events and watch replies come in',
  'Keep every event on your phone and laptop',
  'Get reminders before deadlines and the day itself',
  'Fill in when you are free straight from your calendar',
]

const MIN_PASSWORD = 8

const GoogleG = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

type Mode = 'in' | 'up' | 'forgot'

const COPY: Record<Mode, { title: string; sub: string; action: string }> = {
  in: { title: 'Welcome back', sub: 'Log in to keep planning together.', action: 'Log in' },
  up: { title: 'Sign up', sub: 'It takes a minute, and your events follow you everywhere.', action: 'Sign up' },
  forgot: { title: 'Reset your password', sub: 'We will email you a link to set a new one.', action: 'Send the link' },
}

// useSearchParams on a statically rendered page needs a Suspense boundary above it,
// or the whole page bails out of prerendering; the boundary is the page's only job
export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <SignInForm />
    </Suspense>
  )
}

function SignInForm() {
  const root = useRef<HTMLDivElement>(null)
  const router = useRouter()
  // ?mode=up lands straight on the create-account form — the header's door goes there
  const wanted = useSearchParams().get('mode')
  const [mode, setMode] = useState<Mode>(wanted === 'up' ? 'up' : 'in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null) // check your mail, in both senses
  const guestEventId = useGuestMode()
  // a guest's way back is their event; everyone else came from the front door
  const backHref = guestEventId ? `/events/${guestEventId}` : '/'

  useGSAP(() => {
    gsap.fromTo(root.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' })
  }, [])

  function go(next: Mode) {
    setMode(next); setError(null); setNote(null); setConfirm('')
    if (next === 'forgot') setPassword('')
  }

  async function google() {
    setError(null); setBusy('google')
    // on success the browser leaves for Google and never comes back to this line
    const err = await signInWithGoogle()
    if (err) { setError(err); setBusy(null) }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setNote(null); setBusy('email')

    if (mode === 'forgot') {
      const err = await sendPasswordReset(email.trim())
      setBusy(null)
      if (err) { setError(err); return }
      // the same answer either way, so this never reveals who has an account
      setNote(`If ${email.trim()} has an account, a link to set a new password is on its way.`)
      return
    }

    if (mode === 'up') {
      const err = await signUpWithEmail(email.trim(), password, name)
      if (err) { setError(err); setBusy(null); return }
      // with email confirmation on, sign-up returns no session and the account is
      // only real once the link is clicked; with it off, we are already signed in
      if (await hasSession()) router.replace('/home')
      else { setNote(`Check ${email.trim()} for a confirmation link. Your account is ready once you open it.`); setBusy(null) }
      return
    }

    const err = await signInWithEmail(email.trim(), password)
    if (err) { setError(err); setBusy(null); return }
    router.replace('/home')
  }

  const longEnough = password.length >= MIN_PASSWORD
  // only speak up once there is something in the second box; scolding mid-word is noise
  const mismatch = mode === 'up' && confirm.length > 0 && confirm !== password
  const canSubmit =
    mode === 'forgot' ? !!email.trim()
      : mode === 'in' ? !!email.trim() && password.length > 0
        : !!email.trim() && !!name.trim() && longEnough && confirm === password

  const copy = COPY[mode]

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div ref={root} className="w-full max-w-[860px]">
        <div className="grid overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft md:grid-cols-[1.05fr_0.95fr]">
          {/* ── the form ── */}
          <div className="p-7 sm:p-9">
            <Link href={backHref} className="flex w-fit items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-on-accent">
                <CalendarRange size={16} />
              </span>
              <span className="font-serif text-[21px] tracking-[-0.01em]">Aline</span>
            </Link>

            <h1 className="mt-7 font-serif font-normal text-[31px] leading-[1.05] tracking-[-0.01em]">{copy.title}</h1>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">{copy.sub}</p>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-2">
              {mode === 'up' && (
                <>
                  <label htmlFor="signin-name" className="text-[12.5px] font-semibold text-dim">Your name</label>
                  <input
                    id="signin-name" type="text" autoComplete="name" value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mb-1 h-11 rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none focus:border-accent-border"
                  />
                </>
              )}

              <label htmlFor="signin-email" className="text-[12.5px] font-semibold text-dim">Email</label>
              <input
                id="signin-email" type="email" autoComplete="email" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className="h-11 rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none placeholder:text-faint focus:border-accent-border"
              />

              {mode !== 'forgot' && (
                <PasswordField
                  id="signin-password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  right={mode === 'in' ? (
                    <button type="button" onClick={() => go('forgot')} className="text-[12.5px] font-semibold text-accent-text hover:underline">
                      Forgot password?
                    </button>
                  ) : undefined}
                  hint={mode === 'up' ? (
                    // the rule stays on screen while you type, which a placeholder cannot do
                    <p className={`flex items-center gap-1.5 text-[12px] ${longEnough ? 'text-teal-text' : 'text-faint'}`}>
                      {longEnough && <Check size={12} />}
                      At least {MIN_PASSWORD} characters
                    </p>
                  ) : undefined}
                />
              )}

              {mode === 'up' && (
                <PasswordField
                  id="signin-confirm"
                  label="Confirm password"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  invalid={mismatch}
                  hint={mismatch ? <p className="text-[12px] text-brick-text">Both passwords need to match.</p> : undefined}
                />
              )}

              <button
                type="submit" disabled={!canSubmit || busy !== null}
                className="mt-2 flex h-11 items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-40"
              >
                {busy === 'email' && <Loader2 size={16} className="animate-spin" />}
                {copy.action}
              </button>
            </form>

            <p className="mt-3.5 text-[13px] text-dim">
              {mode === 'forgot' ? (
                <>Remembered it? <button type="button" onClick={() => go('in')} className="font-semibold text-accent-text hover:underline">Back to log in</button></>
              ) : mode === 'in' ? (
                <>New here? <button type="button" onClick={() => go('up')} className="font-semibold text-accent-text hover:underline">Sign up</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => go('in')} className="font-semibold text-accent-text hover:underline">Log in</button></>
              )}
            </p>

            {mode !== 'forgot' && (
              <>
                <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>

                <button
                  type="button"
                  onClick={google}
                  disabled={busy !== null}
                  className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold hover:bg-s2 disabled:opacity-60"
                >
                  {busy === 'google' ? <Loader2 size={16} className="animate-spin" /> : <GoogleG />}
                  Continue with Google
                </button>
              </>
            )}

            {note && (
              <div className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-teal-border bg-teal-bg px-3.5 py-3">
                <MailCheck size={15} className="mt-0.5 flex-none text-teal-text" />
                <p className="text-[12.5px] leading-[1.55] text-teal-text">{note}</p>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-brick-border bg-brick-bg px-3.5 py-3">
                <TriangleAlert size={15} className="mt-0.5 flex-none text-brick-text" />
                <p className="text-[12.5px] leading-[1.55] text-brick-text">{error}</p>
              </div>
            )}

            {!backendOn && (
              <p className="mt-4 rounded-[10px] border border-border bg-s0 px-3.5 py-3 text-[12.5px] leading-[1.55] text-dim">
                No backend is configured, so accounts are switched off. Everything in Aline still works without one.
              </p>
            )}

            <p className="mt-5 text-[11.5px] leading-[1.6] text-faint">
              By continuing you agree to the <span className="underline underline-offset-2">Terms</span> and the{' '}
              <span className="underline underline-offset-2">Privacy Policy</span>.
            </p>

            <Link href={backHref} className="mt-6 flex w-fit items-center gap-1.5 text-[13px] font-semibold text-accent-text hover:underline">
              <ArrowLeft size={14} /> {guestEventId ? 'Back to your event' : 'Back to the app'}
            </Link>
          </div>

          {/* ── the pitch, in the signature green ── */}
          <div className="hidden flex-col justify-between bg-accent p-9 text-on-accent md:flex">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.15em] opacity-70">Why an account</p>
              <p className="mt-3 font-serif font-normal text-[30px] leading-[1.12] tracking-[-0.01em]">
                Find the day everyone can make.
              </p>
            </div>
            <ul className="flex flex-col gap-3.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[13.5px] leading-[1.5]">
                  <span className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full border border-[rgba(248,245,236,.4)] bg-[rgba(248,245,236,.14)]">
                    <Check size={11} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <p className="border-t border-[rgba(248,245,236,.25)] pt-4 text-[12.5px] leading-[1.6] opacity-80">
              Invited to something? You don&apos;t need any of this. Open the invite link and add your name.
            </p>
          </div>
        </div>

        {/* the guest path never comes through here, say so where phones can see it too */}
        <p className="mt-4 text-center text-[12.5px] leading-[1.55] text-dim md:hidden">
          Here from an invite link? You don&apos;t need an account. Open the link again and just add your name.
        </p>
      </div>
    </div>
  )
}
