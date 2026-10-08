'use client'

/* ── the landing's middle, to be read at a glance ──
   Most visitors skim past this, so it is short: three hand-laid cards for how a
   plan comes together, joined by pencil arrows, then one line and a spill of
   stickers for what else is there. Each card holds a still picture of its step,
   never a demo: the real ones are on the Demos shelf, and the walkthroughs live
   on the Help page and the tour. The cards are a moment, so they may tilt; nothing
   on them answers anything. */

import { useRef, useSyncExternalStore } from 'react'
import { CalendarDays, Clock, Link2, Map, MessageCircle, Bell, Route, UserCheck, UserRound, Download } from 'lucide-react'
import { FaceRibbon } from '@/components/ui/FaceRibbon'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { Highlight, PencilArrow } from '@/components/ui/Pencil'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { faceFor } from '@/lib/faces'
import type { PersonColor } from '@/lib/colors'

const PEOPLE: { name: string; color: PersonColor }[] = [
  { name: 'Sam', color: 'blue' }, { name: 'Ana', color: 'amber' }, { name: 'Kai', color: 'green' },
  { name: 'Mia', color: 'purple' }, { name: 'Leo', color: 'coral' }, { name: 'Ivy', color: 'pink' },
]
const FACES = PEOPLE.map((p) => ({ initials: p.name.slice(0, 2).toUpperCase(), name: p.name, color: p.color, face: faceFor(p.name) }))

// how many of six are free in each cell, Mon to Fri over four evening hours;
// Thursday at seven is where everyone lands
const HEAT = [
  [1, 2, 0, 3, 1],
  [2, 3, 1, 5, 2],
  [3, 2, 2, 6, 4],
  [0, 1, 1, 4, 2],
]
const heat = (n: number) => (n === 0 ? 'var(--s1)' : n <= 2 ? 'var(--heat-low)' : n <= 3 ? 'var(--heat-mid)' : n < 6 ? 'var(--heat-high)' : 'var(--heat-full)')

// tilted like hand-laid photos on a wide screen; on a phone, where the cards stack
// one under another, they lie straight (the same call Home makes for its phone card)
const WIDE = '(min-width: 1024px)'
const subscribeWide = (fn: () => void) => {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', fn)
  return () => mq.removeEventListener('change', fn)
}
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false)

const STEPS = [
  { title: 'Send the link', body: 'Share it in any chat. Guests type a name and they are in.', tilt: -2, tape: 'left' as const },
  { title: 'Everyone marks their hours', body: 'A drag across the times they are free. No account needed.', tilt: 1.5, tape: 'right' as const },
  { title: 'Lock the best time', body: 'The time that works for the most people is picked out. One tap locks it.', tilt: -1, tape: 'corner' as const },
]

const EXTRAS: { icon: typeof Clock; text: string }[] = [
  { icon: CalendarDays, text: 'Whole days for trips' },
  { icon: Clock, text: 'Times to the minute' },
  { icon: Download, text: 'Fill from Google or Outlook' },
  { icon: Map, text: 'Vote on a place' },
  { icon: Route, text: 'Routes between stops' },
  { icon: UserCheck, text: 'RSVP in one tap' },
  { icon: MessageCircle, text: 'A chat for each plan, with polls' },
  { icon: Bell, text: 'Reminders by email' },
  { icon: UserRound, text: 'Guests need no account' },
]

export function HowItWorksGlance() {
  const wide = useWide()
  const row = useRef<HTMLOListElement>(null)
  // tiny anchors in the gaps between cards, for the arrows to run between
  const ends = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)]
  const starts = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)]
  return (
    <ol ref={row} className="ld-stagger relative mt-10 grid gap-10 sm:gap-8 lg:grid-cols-3 lg:gap-14">
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative min-w-0">
          {i > 0 && <span ref={starts[i - 1]} aria-hidden className="absolute -left-3 top-[88px] hidden h-px w-px lg:block" />}
          {i < STEPS.length - 1 && <span ref={ends[i]} aria-hidden className="absolute -right-3 top-[60px] hidden h-px w-px lg:block" />}
          <PhotoFrame tilt={wide ? s.tilt : 0} tape={s.tape} pad="mid">
            <div className="h-[116px] rounded-lg bg-s2/60 p-3 sm:h-[132px] sm:p-3.5">{i === 0 ? <LinkPicture /> : i === 1 ? <GridPicture /> : <LockedPicture />}</div>
          </PhotoFrame>
          <h3 className="mt-5 font-serif text-[22px] leading-tight tracking-[-0.01em] sm:text-[24px]">{s.title}</h3>
          <p className="mt-1.5 max-w-[340px] text-[14.5px] leading-[1.55] text-dim">{s.body}</p>
        </li>
      ))}
      {/* the pencil runs from one card to the next on a wide screen */}
      {/* wide screens only: stacked on a phone, the cards follow each other already */}
      <span aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        {[0, 1].map((i) => <PencilArrow key={i} from={ends[i]} to={starts[i]} within={row} ink="graphite" max={160} />)}
      </span>
    </ol>
  )
}

function LinkPicture() {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex h-9 items-center gap-2 rounded-[9px] border border-border bg-s1 px-2.5">
        <Link2 size={14} className="flex-none text-accent-text" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-dim">hourelle.com/e/friday-dinner</span>
      </div>
      <FaceRibbon people={FACES} size={30} />
    </div>
  )
}

function GridPicture() {
  return (
    <div aria-hidden className="grid h-full gap-[3px]" style={{ gridTemplateColumns: '28px repeat(5, minmax(0, 1fr))', gridTemplateRows: 'auto repeat(4, minmax(0, 1fr))' }}>
      <span />
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => <span key={d} className="text-center text-[11px] font-semibold text-dim">{d}</span>)}
      {HEAT.map((r, hi) => (
        <div key={hi} className="contents">
          <span className="pr-1 text-right text-[11px] leading-none text-faint self-center">{6 + hi}p</span>
          {r.map((n, di) => (
            <span
              key={di}
              className={`rounded-[4px] border border-border ${n === 6 ? 'ring-2 ring-ochre ring-offset-1 ring-offset-s2' : ''}`}
              style={{ background: heat(n) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function LockedPicture() {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-teal-text">Locked in</p>
      <p className="mt-1 font-serif text-[22px] leading-tight tracking-[-0.01em]">Thursday</p>
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
        <Highlight>7:00 to 9:00 PM</Highlight> <TimezonePill tz="America/Chicago" />
      </p>
      <p className="mt-1.5 text-[12.5px] text-dim">6 of 6 who can make it are going</p>
    </div>
  )
}

/** What else is there, as stickers that spill across the width. */
export function WhatItDoesGlance() {
  const wide = useWide()
  return (
    <>
      <p className="ld-reveal mt-3 max-w-[560px] text-[16px] leading-[1.6] text-dim">It starts with when. The rest is there if your plan needs it.</p>
      <ul className="ld-stagger mt-6 flex flex-wrap gap-x-2 gap-y-2.5 sm:mt-7 sm:gap-x-3 sm:gap-y-3.5">
        {EXTRAS.map(({ icon: Icon, text }, i) => (
          <li
            key={text}
            className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-s1 px-2.5 text-[12.5px] font-medium sm:h-10 sm:gap-2 sm:px-4 sm:text-[14px] [filter:var(--face-lift)]"
            // a little loose on a wide screen, like stickers pressed on by hand
            style={wide ? { transform: `rotate(${[-1.2, 0.8, -0.4, 1.1, -0.9, 0.5][i % 6]}deg)` } : undefined}
          >
            <Icon size={14} className="hidden flex-none text-accent-text sm:block" aria-hidden />
            {text}
          </li>
        ))}
      </ul>
    </>
  )
}
