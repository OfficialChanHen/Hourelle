'use client'

// The front door. Signed in, it is just a hallway to /home; for everyone else it
// says what Aline is and offers the two ways in — an account, or the demos.
// Outside the (main) layout on purpose: no app chrome, the page is the pitch.

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowRight, CalendarDays, CalendarRange, MapPin, MessageCircle, Users } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAccess } from '@/hooks/useAccess'

const PILLARS = [
  { icon: CalendarRange, title: 'Find the day', body: 'Everyone marks when they are free. The best window shows itself.' },
  { icon: MapPin, title: 'Pick the place', body: 'Suggest spots on a map, vote, or build a route with stops.' },
  { icon: Users, title: 'Know who is coming', body: 'RSVPs, who arrives late, and the headcount at every stop.' },
  { icon: MessageCircle, title: 'Talk it over', body: 'One chat per event, with the people who are actually in it.' },
]

export default function Landing() {
  const router = useRouter()
  const { ready, signedIn } = useAccess()
  const root = useRef<HTMLDivElement>(null)

  // an account has a home; this page is for people who do not have one yet
  useEffect(() => { if (ready && signedIn) router.replace('/home') }, [ready, signedIn, router])

  useGSAP(() => {
    if (!ready || signedIn) return
    gsap.timeline()
      .fromTo('.ld-hero > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power3.out' })
      .fromTo('.ld-pillar', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, '-=0.2')
  }, { scope: root, dependencies: [ready, signedIn] })

  if (!ready || signedIn) return <div className="min-h-dvh bg-bg" />

  return (
    <div ref={root} className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-[64px] w-full max-w-[1100px] items-center px-6">
        <Link href="/" className="flex items-center gap-[9px]">
          <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-accent text-on-accent">
            <CalendarDays size={17} />
          </span>
          <span className="font-serif text-[24.5px] leading-none tracking-[.01em]">Aline</span>
        </Link>
        <div className="flex-1" />
        <nav className="flex items-center gap-2">
          <Link href="/demos" className="hidden h-[34px] items-center rounded-[9px] px-[13px] text-[14px] font-medium text-dim hover:bg-s3 hover:text-text sm:flex">
            Demos
          </Link>
          <ThemeToggle />
          <Link href="/auth/signin" className="flex h-[34px] items-center rounded-[9px] border border-border2 bg-s1 px-[14px] text-[14px] font-semibold hover:bg-s2">
            Sign in
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 pb-16 pt-10 sm:pt-16">
        <div className="ld-hero max-w-[680px]">
          <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-faint">Plans, settled</p>
          <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-[-0.015em] sm:text-[60px]">
            Find the day everyone can make.
          </h1>
          <p className="mt-5 max-w-[540px] text-[16px] leading-[1.6] text-dim sm:text-[17px]">
            One link for the whole plan. People mark when they are free, vote on where to go, say if they are coming, and talk it over. No app to install, and your guests never need an account.
          </p>
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link href="/auth/signin" className="flex h-12 items-center justify-center gap-2 rounded-[11px] bg-accent px-6 text-[15px] font-semibold text-on-accent">
              Create an account <ArrowRight size={16} />
            </Link>
            <Link href="/demos" className="flex h-12 items-center justify-center rounded-[11px] border border-border2 bg-s1 px-6 text-[15px] font-semibold text-dim hover:bg-s2 hover:text-text">
              Try a demo first
            </Link>
          </div>
          <p className="mt-4 text-[12.5px] text-faint">Invited to something? Open the link you were sent. That is all it takes.</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="ld-pillar rounded-2xl border border-border bg-s1 p-5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-accent-border bg-accent-bg text-accent-text">
                <Icon size={17} />
              </span>
              <p className="mt-4 font-serif text-[21px] leading-tight tracking-[-0.01em]">{title}</p>
              <p className="mt-1.5 text-[13.5px] leading-[1.55] text-dim">{body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-8 text-[12.5px] text-faint">
        <span>Aline</span>
        <Link href="/about" className="hover:text-dim">About</Link>
        <Link href="/help" className="hover:text-dim">Help</Link>
        <Link href="/demos" className="hover:text-dim">Demos</Link>
      </footer>
    </div>
  )
}
