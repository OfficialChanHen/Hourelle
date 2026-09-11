'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Check } from 'lucide-react'
import { getEvent } from '@/lib/events'
import { useAccess } from '@/hooks/useAccess'

// what an account would add — the same pitch the sign-in page makes
const PERKS = [
  'Host events and watch replies come in',
  'Keep every event on your phone and laptop',
  'Get reminders before deadlines and the day itself',
]

/* ── the walls ──
   Two kinds of visitor are kept to their own rooms.
   A guest (joined by invite) owns one event: its pages stay open, every account
   surface renders the gate. A visitor with no session at all gets the landing page,
   sign-in, the demos, and any invite they were sent — the rest is an account's. */
export function AccessBoundary({ children }: { children: React.ReactNode }) {
  const { ready, signedIn, guestEventId, visitor } = useAccess()
  const pathname = usePathname()
  const router = useRouter()

  // rooms anyone may enter: the demos, an invite, and pages that hold nothing personal
  const eventId = /^\/events\/([^/]+)/.exec(pathname)?.[1]
  const isJoin = /^\/events\/[^/]+\/join/.test(pathname)
  const isDemo = !!eventId && !!getEvent(eventId)?.demo
  const publicRoom = pathname === '/demos' || pathname === '/help' || pathname === '/about' || isJoin || isDemo
  // a guest's territory is any event page (theirs, or a demo they wander into)
  const guestRoom = !!eventId

  const allowed = signedIn || publicRoom || (!!guestEventId && guestRoom)

  // a visitor with no session who lands on an account page (typed /home, followed an
  // old bookmark) is sent to the front door rather than shown a sign-in wall — the
  // landing page already says what an account is for and has both doors on it
  useEffect(() => {
    if (ready && visitor && !allowed) router.replace('/')
  }, [ready, visitor, allowed, router])

  if (allowed) return <>{children}</>

  // the server render cannot know who this is; hold a quiet skeleton until the
  // browser has looked, so a signed-in reload never flashes the gate
  if (!ready || visitor) {
    return (
      <div className="mx-auto max-w-[1240px] px-[26px] pt-[34px]">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-s2" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded bg-s2" />
        <div className="mt-8 grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-s2" />)}
        </div>
      </div>
    )
  }

  const ev = guestEventId ? getEvent(guestEventId) : null
  const back = `/events/${guestEventId}`

  return (
    <div className="mx-auto max-w-[480px] px-6 pb-[104px] pt-[64px]">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">Guest view</p>
        <h1 className="mt-2 font-serif font-normal text-[33px] leading-[1.08] tracking-[-0.01em]">This part needs an account</h1>
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
        <Link href="/auth/signin?mode=up" className="flex h-11 w-full max-w-[300px] items-center justify-center rounded-[10px] bg-accent text-[14px] font-semibold text-on-accent">
          Sign up
        </Link>
        <Link href={back} className="flex h-11 w-full max-w-[300px] items-center justify-center gap-1.5 rounded-[10px] border border-border2 bg-s1 text-[14px] font-semibold text-dim hover:bg-s2 hover:text-text">
          <ArrowLeft size={15} /> {ev ? `Back to ${ev.title}` : 'Back to your event'}
        </Link>
      </div>
    </div>
  )
}
