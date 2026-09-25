'use client'

// The front door. Signed in, it is a hallway to /home. For everyone else it is
// the pitch, top to bottom: what Hourelle is, how a plan comes together, what each
// part looks like, three demos to try, and the two ways in. Outside the (main)
// layout on purpose — no app chrome, this page sells rather than serves.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Users } from 'lucide-react'
import { VisitorHeader } from '@/components/VisitorHeader'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { HeroGrid } from '@/components/landing/HeroGrid'
import { DayPollDemo } from '@/components/landing/DayPollDemo'
import { BallotDemo } from '@/components/landing/BallotDemo'
import { ChatDemo } from '@/components/landing/ChatDemo'
import { SiteFooter } from '@/components/SiteFooter'
import { FlashToast } from '@/components/ui/FlashToast'
import { rich } from '@/components/ui/rich'
import { Cover } from '@/components/ui/Cover'
import { CARD_COVER_H, coverFor } from '@/components/ui/StoredEventCard'
import { useAccess } from '@/hooks/useAccess'
import { listDemos, type AppEvent } from '@/lib/events'
import { reducedMotion } from '@/lib/prefs'

gsap.registerPlugin(ScrollTrigger)

const FEATURES = [
  {
    eyebrow: 'When',
    title: 'See the day everyone can meet.',
    body: 'Drag across the times you are free. The darker the green, the more people are free. The best time is picked out for you.',
    points: ['Minute-precise edges, not just half-hour boxes', 'Day polls for trips and weekends', 'Or skip the poll when the date is already set'],
    demo: 'daypoll',
  },
  {
    eyebrow: 'Where',
    title: 'Pick the place together.',
    body: 'Suggest spots on a map and vote. For a whole day out, chain the winners into a route with stops and travel time between them.',
    points: ['One vote or several, your call as host', 'A route that knows how long each leg takes', 'Remote events get a link instead of a pin'],
    demo: 'ballot',
  },
  {
    eyebrow: 'Who',
    title: 'Know who is coming, and talk it over.',
    body: 'See who is coming and who is running late. Each event has its own chat.',
    points: ['Everyone RSVPs in one tap', 'The chat shows when someone joins', 'Works in any phone browser'],
    demo: 'chat',
  },
] as const

// friend plans first: the audience is friends making plans, not office meetings
const DEMO_PICKS: Record<string, string> = {
  'cabin-trip': 'A **day poll** for a long weekend, where whole days are the question.',
  'priyas-send-off': 'A **vote on the place**, closing soon, with the leader changing as votes come in.',
  'trivia-night-anchor': 'A **fixed date and place**. The only question left is **who is coming**.',
}

export default function Landing() {
  const router = useRouter()
  const { ready, signedIn } = useAccess()
  const root = useRef<HTMLDivElement>(null)
  const [demos, setDemos] = useState<AppEvent[]>([])

  // an account has a home; this page is for people who do not have one yet
  useEffect(() => { if (ready && signedIn) router.replace('/home') }, [ready, signedIn, router])
  useEffect(() => {
    const order = Object.keys(DEMO_PICKS)
    setDemos(listDemos().filter((d) => d.id in DEMO_PICKS).sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id)))
  }, [])

  useGSAP(() => {
    if (!ready || signedIn) return
    // the setting in Settings counts as much as the device's own
    if (reducedMotion()) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // the hero settles in as one gesture
      gsap.timeline()
        .fromTo('.ld-hero > *', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: 'power3.out' })
        .fromTo('.ld-shot', { opacity: 0, y: 28, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' }, '-=0.35')
      // everything below the fold rises into place as it arrives
      // these fire as a section reaches the bottom edge, not once it is already a
      // seventh of the way up. At 86% the last 14% of every screen was reserved for
      // something still at opacity 0, so a section could never peek: you scrolled the
      // grid into view and the space under it stayed blank until you scrolled again.
      gsap.utils.toArray<HTMLElement>('.ld-reveal').forEach((el) => {
        gsap.from(el, { opacity: 0, y: 26, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 99%', once: true } })
      })
      gsap.utils.toArray<HTMLElement>('.ld-stagger').forEach((group) => {
        gsap.from(group.children, { opacity: 0, y: 18, duration: 0.55, stagger: 0.08, ease: 'power2.out', scrollTrigger: { trigger: group, start: 'top 92%', once: true } })
      })
    })
    return () => mm.revert()
  }, { scope: root, dependencies: [ready, signedIn] })

  if (!ready || signedIn) return <div className="min-h-dvh bg-bg" />

  const frame = 'overflow-hidden rounded-2xl border border-border bg-s1 shadow-soft'

  return (
    <div ref={root} className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[10px] focus:border focus:border-accent focus:bg-s1 focus:px-4 focus:py-2.5 focus:text-[14px] focus:font-semibold focus:text-accent-text focus:shadow-soft"
      >
        Skip to content
      </a>
      <VisitorHeader />

      <main id="main" tabIndex={-1} className="relative flex-1">
        {/* the front door has its own layout, so a flash queued on the way here (a
            guest the host removed from an event) needs its own place to land */}
        <FlashToast />
        {/* ── hero ── */}
        <section className="mx-auto w-full max-w-[1240px] px-[22px] pb-8 pt-8 sm:pt-12 lg:pt-16">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center xl:gap-14">
            <div className="ld-hero min-w-0 lg:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">The little hour when people meet</p>
              <h1 className="mt-3 font-serif font-normal text-[46px] leading-[1.0] tracking-[-0.015em] sm:text-[62px] lg:text-[54px] xl:text-[62px]">
                Find the hour everyone can meet.
              </h1>
              <p className="mt-5 max-w-[560px] text-[16px] leading-[1.6] text-dim sm:text-[17px]">
                Making plans with friends? Create an event, then send the invite link. Everyone marks when they are free and votes on where to go. Guests don't need an account.
              </p>
              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Link href="/auth/signin?mode=up" className="flex h-12 items-center justify-center gap-2 rounded-[11px] bg-accent px-6 text-[15px] font-semibold text-on-accent">
                  Sign up <ArrowRight size={16} />
                </Link>
                <Link href="/demos" className="flex h-12 items-center justify-center rounded-[11px] border border-border2 bg-s1 px-6 text-[15px] font-semibold text-dim hover:bg-s2 hover:text-text">
                  Try a demo first
                </Link>
              </div>
              <p className="mt-4 text-[12.5px] text-faint">Invited to something? Just open the link you were sent.</p>
            </div>

            {/* built rather than photographed: a picture cannot follow the theme, and the
                two it needed went stale every time the real grid moved. It sits beside the
                words on a wide screen and under them on a narrow one. It used to lead there,
                which put the headline five pixels below the fold of a 390 by 844 phone: the
                whole first screen was grid, and you had to scroll to find out what any of it
                was for. A picture can argue for the thing once the thing has been named. */}
            <div className={`ld-shot min-w-0 lg:col-span-7 ${frame}`}>
              <HeroGrid />
            </div>
          </div>
        </section>

        {/* ── how it works ── */}
        <section id="how" className="mx-auto w-full max-w-[1240px] scroll-mt-20 px-[22px] pb-8 pt-14 sm:pt-28">
          <div className="ld-reveal max-w-[560px]">
            <h2 className="font-serif font-normal text-[36px] leading-[1.06] tracking-[-0.01em] sm:text-[46px]">How it works</h2>
          </div>
          <HowItWorks />
        </section>

        {/* ── features, alternating ── */}
        <section id="features" className="mx-auto w-full max-w-[1240px] scroll-mt-20 px-[22px] pt-14 sm:pt-28">
          <div className="ld-reveal max-w-[560px]">
            <h2 className="font-serif font-normal text-[36px] leading-[1.06] tracking-[-0.01em] sm:text-[46px]">What it does</h2>
          </div>
          <div className="mt-6 flex flex-col gap-16 sm:gap-24">
            {FEATURES.map((f, i) => (
              <div key={f.eyebrow} className={`grid items-center gap-8 lg:grid-cols-12 lg:gap-12 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <div className="ld-reveal min-w-0 lg:col-span-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">{f.eyebrow}</p>
                  <h3 className="mt-2 font-serif font-normal text-[29px] leading-[1.08] tracking-[-0.01em] sm:text-[34px]">{f.title}</h3>
                  <p className="mt-3.5 text-[15px] leading-[1.6] text-dim">{f.body}</p>
                  <ul className="ld-stagger mt-5 flex flex-col gap-2.5">
                    {f.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-[13.5px] leading-[1.5] text-dim">
                        <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* the feature itself, live: a script plays as it arrives, and it is
                    yours the moment you touch it */}
                <div className="ld-reveal min-w-0 lg:col-span-7">
                  {f.demo === 'daypoll' ? <DayPollDemo /> : f.demo === 'ballot' ? <BallotDemo /> : <ChatDemo />}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── demos ── */}
        <section id="demos" className="mx-auto w-full max-w-[1240px] scroll-mt-20 px-[22px] pt-20 sm:pt-28">
          <div className="ld-reveal flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-[560px]">
              <h2 className="font-serif font-normal text-[36px] leading-[1.06] tracking-[-0.01em] sm:text-[46px]">Demos</h2>
              <p className="mt-3 text-[15px] leading-[1.6] text-dim">Open a finished plan and click through it.</p>
            </div>
            <Link href="/demos" className="flex h-10 items-center gap-1.5 rounded-[10px] border border-border2 bg-s1 px-4 text-[13.5px] font-semibold text-dim hover:bg-s2 hover:text-text">
              All demos <ArrowRight size={14} />
            </Link>
          </div>
          <div className="ld-stagger mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {demos.map((d) => {
              const [from, to] = coverFor(d.id)
              return (
                <Link key={d.id} href={`/events/${d.id}`} className={`group ${frame} transition-transform hover:-translate-y-0.5`}>
                  <Cover src={d.image} from={from} to={to} className={CARD_COVER_H} />
                  <div className="p-5">
                    <p className="font-serif text-[21px] leading-tight tracking-[-0.01em]">{d.title}</p>
                    <p className="mt-1.5 text-[13px] leading-[1.55] text-dim">{rich(DEMO_PICKS[d.id])}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-accent-text">
                      <Users size={13} /> {d.participants.length} people <ArrowRight size={13} className="ml-auto transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── closing ── */}
        <section className="mx-auto w-full max-w-[1240px] px-[22px] pb-16 pt-20 sm:pb-24 sm:pt-28">
          <div className="ld-reveal grid gap-8 rounded-2xl bg-accent p-8 text-on-accent sm:p-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.15em] opacity-70">Free to use</p>
              <h2 className="mt-3 font-serif font-normal text-[34px] leading-[1.06] tracking-[-0.01em] sm:text-[44px]">The next plan takes a minute to start.</h2>
            </div>
            <div className="flex flex-col gap-2.5 lg:items-end">
              <Link href="/auth/signin?mode=up" className="flex h-12 items-center justify-center gap-2 rounded-[11px] bg-on-accent px-6 text-[15px] font-semibold text-accent">
                Sign up <ArrowRight size={16} />
              </Link>
              <Link href="/auth/signin" className="flex h-12 items-center justify-center rounded-[11px] border border-[rgba(248,245,236,.4)] px-6 text-[15px] font-semibold text-on-accent hover:bg-[rgba(248,245,236,.1)]">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
