'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, CalendarRange, Check, MailCheck } from 'lucide-react'
import { useGuestMode } from '@/hooks/useGuestMode'

/* ── the sign-in shell: real layout, no real auth behind it yet ──
   Split like the sign-in pages people know: the form on the left, the pitch on the
   right in the signature green. Both actions land on an honest "not wired up yet"
   note instead of pretending, and guests never need this page at all — an invite
   link works without an account. */

const BENEFITS = [
  'Host events and watch replies come in',
  'Keep every event on your phone and laptop',
  'Get reminders before deadlines and the day itself',
  'Fill in when you are free straight from your calendar',
]

const GoogleG = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

export default function SignInPage() {
  const root = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  // which stub the visitor tried, so the note can speak to it
  const [tried, setTried] = useState<'google' | 'email' | null>(null)
  // a guest's way back is their event, not the (gated) home page
  const guestEventId = useGuestMode()
  const backHref = guestEventId ? `/events/${guestEventId}` : '/home'

  useGSAP(() => {
    gsap.fromTo(root.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' })
  }, [])

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

            <h1 className="mt-7 font-serif text-[31px] leading-[1.05] tracking-[-0.01em]">Welcome back</h1>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">Sign in to keep planning together.</p>

            <button
              type="button"
              onClick={() => setTried('google')}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold hover:bg-s2"
            >
              <GoogleG /> Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (email.trim()) setTried('email') }}
              className="flex flex-col gap-2"
            >
              <label htmlFor="signin-email" className="text-[12.5px] font-semibold text-dim">Email</label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-[10px] border border-border bg-s0 px-3.5 text-[14px] outline-none placeholder:text-faint focus:border-accent-border"
              />
              <button type="submit" className="mt-1 h-11 rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-40" disabled={!email.trim()}>
                Email me a sign-in link
              </button>
            </form>

            {tried && (
              <div className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-ochre-border bg-ochre-bg px-3.5 py-3">
                <MailCheck size={15} className="mt-0.5 flex-none text-ochre-text" />
                <p className="text-[12.5px] leading-[1.55] text-ochre-text">
                  {tried === 'google' ? 'Google sign-in' : `A link to ${email.trim()}`} is not wired up yet.
                  Everything in Aline works without an account for now.
                </p>
              </div>
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
              <p className="mt-3 font-serif text-[30px] leading-[1.12] tracking-[-0.01em]">
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

        {/* the guest path never comes through here — say so where phones can see it too */}
        <p className="mt-4 text-center text-[12.5px] leading-[1.55] text-dim md:hidden">
          Here from an invite link? You don&apos;t need an account. Open the link again and just add your name.
        </p>
      </div>
    </div>
  )
}
