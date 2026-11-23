'use client'

// Where a new account proves its email. Sign-up sends people here with the address
// filled in, and the confirmation email links here too, so someone who closed the tab
// or opened the mail on another device can still type the code. The code is the
// only way to confirm; the mail carries no link that confirms on its own.

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarRange, Loader2, MailCheck, TriangleAlert } from 'lucide-react'
import { cleanCode, codeReady, CODE_MAX } from '@/lib/verify-code'
import { resendSignupCode, verifySignupCode } from '@/lib/session'
import { Wordmark } from '@/components/ui/Wordmark'

// Supabase refuses a second mail within about a minute; the button waits as long
const RESEND_WAIT = 60

// useSearchParams on a statically rendered page needs a Suspense boundary above it
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <VerifyForm />
    </Suspense>
  )
}

function VerifyForm() {
  const router = useRouter()
  const params = useSearchParams()
  const given = params.get('email')?.trim() ?? ''
  const rawNext = params.get('next') ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/home'
  // sign-up has just sent the first mail; a visit from the email link has not asked for one
  const fresh = params.get('sent') === '1'

  const [email, setEmail] = useState(given)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [wait, setWait] = useState(fresh ? RESEND_WAIT : 0)
  const codeBox = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setNote(null); setBusy('verify')
    const err = await verifySignupCode(email, code)
    if (err) { setError(err); setBusy(null); codeBox.current?.select(); return }
    // a fresh account goes through the welcome steps first, then on to wherever it was headed
    router.replace(`/welcome?next=${encodeURIComponent(next)}`)
  }

  async function resend() {
    setError(null); setNote(null); setBusy('resend')
    const err = await resendSignupCode(email)
    setBusy(null)
    if (err) { setError(err); return }
    setNote(`A new code is on its way to ${email.trim()}. The old one no longer works.`)
    setCode(''); setWait(RESEND_WAIT); codeBox.current?.focus()
  }

  const canVerify = !!email.trim() && codeReady(code)

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-s1 p-7 shadow-soft sm:p-8">
        <Link href="/" className="flex w-fit items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-on-accent">
            <CalendarRange size={16} />
          </span>
          <Wordmark className="text-[21px] tracking-[-0.01em]" />
        </Link>

        <h1 className="mt-7 font-serif text-[27px] leading-[1.08] tracking-[-0.01em]">Check your email</h1>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-dim">
          {given ? <>We sent a code to <span className="font-semibold text-text">{given}</span>. </> : 'We sent a code to the email you signed up with. '}
          Type it below to finish signing up.
        </p>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ochre-border bg-ochre-bg px-3.5 py-3">
          <MailCheck size={15} className="mt-0.5 flex-none text-ochre-text" />
          <p className="text-[12.5px] leading-[1.55] text-ochre-text">
            Not there after a minute? Check your spam or junk folder, and mark the mail as not spam so the next ones arrive.
          </p>
        </div>

        <form onSubmit={verify} className="mt-6 flex flex-col gap-2">
          {!given && (
            <>
              <label htmlFor="verify-email" className="text-[12.5px] font-semibold text-dim">Email</label>
              <input
                id="verify-email" type="email" autoComplete="email" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className="mb-1 h-11 rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none placeholder:text-faint focus:border-accent"
              />
            </>
          )}

          <label htmlFor="verify-code" className="text-[12.5px] font-semibold text-dim">Code</label>
          <input
            ref={codeBox}
            id="verify-code" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus={!!given}
            value={code} maxLength={CODE_MAX + 6}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder="123456"
            className="h-14 rounded-[10px] border border-border bg-s0 px-3.5 text-center font-mono text-[24px] tracking-[.3em] outline-none placeholder:text-faint/60 focus:border-accent"
          />

          <button
            type="submit" disabled={!canVerify || busy !== null}
            className="mt-2 flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-40"
          >
            {busy === 'verify' && <Loader2 size={16} className="animate-spin" />}
            Confirm email
          </button>
        </form>

        <p className="mt-3.5 text-[13px] text-dim">
          No code?{' '}
          <button
            type="button" onClick={resend} disabled={!email.trim() || busy !== null || wait > 0}
            className="font-semibold text-accent-text hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline"
          >
            {wait > 0 ? `Send a new one in ${wait}s` : 'Send a new one'}
          </button>
        </p>

        {note && (
          <div role="status" className="mt-4 flex items-start gap-2.5 rounded-xl border border-teal-border bg-teal-bg px-3.5 py-3">
            <MailCheck size={15} className="mt-0.5 flex-none text-teal-text" />
            <p className="text-[12.5px] leading-[1.55] text-teal-text">{note}</p>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-brick-border bg-brick-bg px-3.5 py-3">
            <TriangleAlert size={15} className="mt-0.5 flex-none text-brick-text" />
            <p className="text-[12.5px] leading-[1.55] text-brick-text">{error}</p>
          </div>
        )}

        <p className="mt-6 text-[13px] text-dim">
          Wrong address?{' '}
          <Link href="/auth/signin?mode=up" className="font-semibold text-accent-text hover:underline">Sign up again</Link>
        </p>
      </div>
    </div>
  )
}
