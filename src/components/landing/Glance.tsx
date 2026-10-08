'use client'

/* ── the landing's middle, to be read at a glance ──
   Most visitors skim past this, so it is short: three hand-laid cards for how a
   plan comes together, joined by pencil arrows, then one line and a spill of
   stickers for what else is there. Each card holds a still picture of its step,
   never a demo: the real ones are on the Demos shelf, and the walkthroughs live
   on the Help page and the tour. The cards and notes are a moment, so they may tilt
   on a wide screen; nothing on them answers anything. */

import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Link2 } from 'lucide-react'
import { FaceRibbon } from '@/components/ui/FaceRibbon'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { Highlight, PencilArrow, PENCIL_FILTER } from '@/components/ui/Pencil'
import { StickyNote } from '@/components/ui/StickyNote'
import { reducedMotion } from '@/lib/prefs'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { faceFor } from '@/lib/faces'
import type { PersonColor } from '@/lib/colors'

gsap.registerPlugin(ScrollTrigger)

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

const STEPS = [
  // the tape decides which way each card turns (PhotoFrame); tilt is how far. As a
  // row: the outer two lean in toward the middle one, which hangs straight
  { title: 'Send the link', body: 'Share it in any chat. Guests type a name and they are in.', tilt: 2, tape: 'left' as const },
  { title: 'Everyone marks their hours', body: 'A drag across the times they are free. No account needed.', tilt: 0, tape: 'center' as const },
  { title: 'Lock the best time', body: 'The time that works for the most people is picked out. One tap locks it.', tilt: 2, tape: 'right' as const },
]

export function HowItWorksGlance() {
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
          <PhotoFrame tilt={s.tilt} tape={s.tape} pad="mid">
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

/* What else is there, as a board of sticky notes: a heading and a pencil doodle
   on each, no more. The doodles draw themselves once as the board comes into view
   (static under reduced motion), in the same grain as every other pencil mark. On a
   wide screen the notes sit at small angles, a couple of them pinned; on a phone they
   lie straight in two columns, still loose enough to read as a board. */
const NOTES: { title: string; art: React.ReactNode; tilt: number; pin?: boolean }[] = [
  { title: 'Whole days for trips', art: <DaysArt />, tilt: -1.6 },
  { title: 'Times to the minute', art: <ClockArt />, tilt: 1.1, pin: true },
  { title: 'Fill from your calendar', art: <FillArt />, tilt: -0.6 },
  { title: 'Vote on a place', art: <PinArt />, tilt: 1.6 },
  { title: 'Routes between stops', art: <RouteArt />, tilt: 0.9 },
  { title: 'RSVP in one tap', art: <TickArt />, tilt: -1.3 },
  { title: 'A chat with polls', art: <ChatArt />, tilt: 0.5, pin: true },
  { title: 'Reminders by email', art: <MailArt />, tilt: -1 },
]

export function WhatItDoesGlance() {
  const board = useRef<HTMLUListElement>(null)
  useGSAP(() => {
    const el = board.current
    if (!el || reducedMotion()) return
    const strokes = el.querySelectorAll<SVGGeometryElement>('[data-doodle]')
    gsap.set(strokes, { strokeDasharray: 1, strokeDashoffset: 1 })
    ScrollTrigger.create({
      trigger: el, start: 'top 80%', once: true,
      onEnter: () => {
        el.querySelectorAll('li').forEach((note, n) => {
          gsap.to(note.querySelectorAll('[data-doodle]'), { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out', stagger: 0.12, delay: n * 0.08 })
        })
      },
    })
  }, { scope: board })
  return (
    <>
      <p className="ld-reveal mt-3 max-w-[560px] text-[16px] leading-[1.6] text-dim">It starts with when. The rest is there if your plan needs it.</p>
      <ul ref={board} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5 lg:gap-x-7 lg:gap-y-8">
        {NOTES.map((n) => (
          <li key={n.title} className="min-w-0">
            <StickyNote tilt={n.tilt} pin={n.pin} className="h-full min-h-[138px] !gap-2.5 !px-3.5 !pb-3.5 sm:min-h-[170px] sm:!px-4 sm:!pb-4 lg:min-h-[188px] lg:!px-5">
              <span className="block h-11 text-sticky-dim sm:h-14 lg:h-[74px]" aria-hidden>{n.art}</span>
              <span className="mt-auto font-serif text-[15.5px] font-medium leading-[1.2] tracking-[-0.01em] sm:text-[18px]">{n.title}</span>
            </StickyNote>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ── the doodles: 64x44, pencil lines in the note's dim ink, one stroke of the accent
   each. Every line is a [data-doodle] path with pathLength 1, so it can draw itself. */
function Doodle({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 64 44" className="h-full w-auto overflow-visible" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="currentColor" style={{ filter: `url(#${PENCIL_FILTER})` }}>
      {children}
    </svg>
  )
}
const ink = { 'data-doodle': '', pathLength: 1 } as const
const accent = { ...ink, className: 'stroke-accent', strokeWidth: 2.4 } as const

function DaysArt() {
  return (
    <Doodle>
      <path {...ink} d="M6 8 H58 V40 H6 Z" />
      <path {...ink} d="M6 18 H58 M19 18 V40 M32 18 V40 M45 18 V40 M6 29 H58" />
      <path {...ink} d="M16 4 V11 M48 4 V11" />
      <path {...accent} d="M15 23 C 24 19, 46 19, 54 24 C 55 31, 34 34, 16 33 C 9 31, 9 25, 15 23" />
    </Doodle>
  )
}
function ClockArt() {
  return (
    <Doodle>
      <path {...ink} d="M32 4 C 46 4, 52 14, 52 22 C 52 33, 43 40, 32 40 C 20 40, 12 32, 12 22 C 12 12, 20 4, 32 4" />
      <path {...ink} d="M32 9 V11 M47 22 H45 M32 35 V33 M17 22 H19" />
      <path {...ink} d="M32 22 V13" />
      <path {...accent} d="M32 22 L 41 27" />
    </Doodle>
  )
}
function FillArt() {
  return (
    <Doodle>
      <path {...ink} d="M4 10 H24 V34 H4 Z M4 17 H24" />
      <path {...ink} d="M9 6 V12 M19 6 V12" />
      <path {...accent} d="M27 22 C 32 20, 36 20, 41 22 M37 18 L 41 22 L 37 26" />
      <path {...ink} d="M44 8 H60 V36 H44 Z M44 15 H60 M44 22 H60 M44 29 H60 M52 8 V36" />
    </Doodle>
  )
}
function PinArt() {
  return (
    <Doodle>
      <path {...ink} d="M6 36 C 20 33, 44 39, 58 35" />
      <path {...accent} d="M32 34 C 24 24, 22 19, 22 15 C 22 9, 27 5, 32 5 C 37 5, 42 9, 42 15 C 42 19, 40 24, 32 34" />
      <path {...ink} d="M28 15 L 31 18 L 37 12" />
    </Doodle>
  )
}
function RouteArt() {
  return (
    <Doodle>
      <path {...ink} d="M9 32 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0" />
      <path {...ink} d="M12 30 C 22 26, 21 15, 29 15 M35 15 C 42 16, 41 25, 51 19" />
      <path {...ink} d="M32 15 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0" />
      <path {...accent} d="M55 17 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0" />
    </Doodle>
  )
}
function TickArt() {
  return (
    <Doodle>
      <path {...ink} d="M32 4 C 45 4, 50 13, 50 22 C 50 32, 42 40, 32 40 C 21 40, 14 32, 14 22 C 14 12, 21 4, 32 4" />
      <path {...accent} d="M23 22 L 30 29 L 43 14" />
    </Doodle>
  )
}
function ChatArt() {
  return (
    <Doodle>
      <path {...ink} d="M8 6 H56 C 58 6, 59 7, 59 9 V30 C 59 32, 58 33, 56 33 H22 L 13 40 L 15 33 H8 C 6 33, 5 32, 5 30 V9 C 5 7, 6 6, 8 6" />
      <path {...accent} d="M13 14 H44" />
      <path {...ink} d="M13 20 H34 M13 26 H25" />
    </Doodle>
  )
}
function MailArt() {
  return (
    <Doodle>
      <path {...ink} d="M6 12 H50 V38 H6 Z" />
      <path {...ink} d="M6 12 L 28 28 L 50 12" />
      <path {...accent} d="M54 4 C 59 4, 60 8, 60 11 V16 L 62 19 H46 L 48 16 V11 C 48 8, 49 4, 54 4 M52 21 H56" />
    </Doodle>
  )
}
