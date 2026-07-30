'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { getEvent } from '@/lib/events'
import { useGuestMode } from '@/hooks/useGuestMode'

// what an account would add — the same pitch the sign-in page makes
const PERKS = [
  'Host events and watch replies come in',
  'Keep every event on your phone and laptop',
  'Get reminders before deadlines and the day itself',
]

/* ── the guest's walls ──
   With a guest session active, the event they joined is the whole app: event pages
   stay open, and every account surface (home, lists, create, alerts, profile)
   renders this gate instead of its content. Leaving the session brings it all back. */
export function GuestBoundary({ children }: { children: React.ReactNode }) {
  const guestEventId = useGuestMode()
  const pathname = usePathname()
  // event detail pages (and the join flow) are the guest's territory; note that
  // the bare /events list is not — that's the account's filing cabinet
  const inEvent = /^\/events\/[^/]+/.test(pathname)
  if (!guestEventId || inEvent) return <>{children}</>

  const ev = getEvent(guestEventId)
  const back = `/events/${guestEventId}`

  return (
    <div className="mx-auto max-w-[480px] px-6 pb-[104px] pt-[64px]">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">Guest view</p>
        <h1 className="mt-2 font-serif text-[33px] leading-[1.08] tracking-[-0.01em]">This part needs an account</h1>
        <p className="mx-auto mt-3 max-w-[400px] text-[14px] leading-[1.6] text-dim">
          You&apos;re here as a guest{ev ? <> of <span className="font-semibold text-text">{ev.title}</span></> : null}, and that page has
          everything you need to take part. An account adds the rest:
        </p>
      </div>

      <ul className="mx-auto mt-5 flex w-fit flex-col gap-2.5">
        {PERKS.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[13.5px] leading-[1.5] text-dim">
            <span className="mt-0.5 grid h-[17px] w-[17px] flex-none place-items-center rounded-full border border-accent-border bg-accent-bg text-accent-text">
              <Check size={11} />
            </span>
            {b}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-col items-center gap-2.5">
        <Link href="/auth/signin" className="flex h-11 w-full max-w-[300px] items-center justify-center rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent">
          Create an account
        </Link>
        <Link href={back} className="flex h-11 w-full max-w-[300px] items-center justify-center gap-1.5 rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold text-dim hover:bg-s2 hover:text-text">
          <ArrowLeft size={15} /> Back to {ev ? ev.title : 'your event'}
        </Link>
      </div>
    </div>
  )
}
