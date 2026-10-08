'use client'


/* ── home: when are we meeting, and what do you owe ──
   Hourelle is about finding the time busy people can meet, so every card here leads
   with the time question before anything else.
     Up next      the three closest plans. On a large screen the closest one is the
                  big taped photo and the other two sit beside it as smaller photos;
                  on a phone the closest is the photo and the next two compact framed
                  rows under it, all in view, nothing to swipe. Each photo carries the plan's name, its stage, the time question first
                  (your times, the best time so far, who is still missing, or the
                  locked time), then place and extras, and one button: the thing to
                  do next.
     Your turn    every plan waiting on you, as sticky notes on a board, each with
                  its own task and button, and your face stuck in a spare spot. A note
                  whose task is done shows once more ticked, then peels and falls off,
                  and the notes after it move up into its place
     Start a plan a name and a week, one click

   Only three plans and a handful of notes are ever drawn, so thirty plans cost the
   same as three. Everything else lives one link away on Plans.

   Scrapbook touches (the photos, tape, sticker faces, sticky notes) are for this
   page's moments only. The arrows, the create form and every button stay flat.

   Anything the server cannot know (the greeting, today's date, which plans this
   browser holds) is filled in after mount, so the server-rendered HTML never
   disagrees with a visitor in another timezone. `useLiveEvents` re-reads the list
   whenever the cloud changes something. */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarPlus, CalendarClock, Calendar, Check, CopyPlus, Link2, ArrowRight, MapPin, Video, UsersRound, UserRound,
  Trash2, UserRoundX, ChevronRight,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Em } from '@/components/ui/Em'
import { coverFor } from '@/components/ui/StoredEventCard'
import { Cover } from '@/components/ui/Cover'
import { PeekCard, peopleIn } from '@/components/ui/PeekCard'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { StickyNote } from '@/components/ui/StickyNote'
import { FaceSticker } from '@/components/ui/FaceSticker'
import { SoftShapes } from '@/components/ui/SoftShapes'
import { Keepsake, rowLooks, type Look } from '@/components/ui/Keepsake'
import { Highlight, PencilArrow, PencilStar, PencilTick, PencilUnderline } from '@/components/ui/Pencil'
import { peelable } from '@/animations/peel'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'
import { HandNote } from '@/components/ui/HandNote'
import { namesLabel } from '@/components/ui/AvatarRow'
import { FaceSvg } from '@/components/ui/FaceSvg'
import { personVar } from '@/lib/colors'
import { defaultFace } from '@/lib/faces'
import { pushFlash } from '@/components/ui/FlashToast'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Tip } from '@/components/ui/Tip'
import { StageStepper } from '@/components/ui/LifecycleStrip'
import { placeVotes, chatLines } from '@/lib/polls'
import { fromDay,
  createEvent, eventTabFor, listEvents, phaseOf, daysUntil, dateRangeText, confirmedSlotText, sameDayLabelFor,
  leadingPlaceOf, youReplied, youVoted, bestWindow, availIvOf, gridStartMinOf, fmtMinute, seenMessageCount,
  type AppEvent, type Participant, type Phase, type SameDayInfo,
  answeredIds, rsvpPool,
} from '@/lib/events'
import { cloudSettled } from '@/lib/remote'
import { answeredLine, goingLine } from '@/lib/answers'
import { overText } from '@/lib/overText'
import { useLiveEvents } from '@/hooks/useLiveEvents'
import { useAccount } from '@/hooks/useAccount'
import { DateField } from '@/components/ui/DateField'

// what part of the day it is, by the reader's clock
function greetingFor(hour: number): string {
  if (hour < 5) return 'Evening'
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

// how many plans Home draws: the closest three, never an even pile
const SHOWN = 3

// a large screen lays the three plans out side by side; a phone lists them. Read on
// the client only, which is fine here: nothing below renders before mount anyway
const WIDE = '(min-width: 1024px)'
function subscribeWide(fn: () => void) {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', fn)
  return () => mq.removeEventListener('change', fn)
}
function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false)
}

type Turn = { line: string; cta: string; href: string }
type Item = { e: AppEvent; phase: Phase }

// "Oct 3", for the by-when on a task
const shortDay = (iso: string) => dateRangeText({ startDate: iso, endDate: iso }).replace(/, \d{4}$/, '')

/** The one thing you still owe this plan, if any, said as the task: your times while
    it is being decided, a place vote when one is open, your reply once it is locked
    in, each with its by-when when the host set one. */
function turnOf(e: AppEvent, phase: Phase): Turn | null {
  const me = e.participants.find((p) => p.you)
  if (!me || e.demo) return null
  if (phase === 'planning') {
    if (!youReplied(e)) return { line: `Mark your times${e.planDeadline ? ` by ${shortDay(e.planDeadline)}` : ''}`, cta: 'Mark my times', href: `/events/${e.id}?tab=availability` }
    if (e.location.mode === 'vote' && e.location.places.length > 0 && !youVoted(e)) return { line: `Vote on the place${e.voteDeadline ? ` by ${shortDay(e.voteDeadline)}` : ''}`, cta: 'Vote', href: `/events/${e.id}?tab=location` }
    return null
  }
  if (phase !== 'past' && me.rsvp === 'pending') return { line: `Say if you’re coming${e.rsvpDeadline ? ` by ${shortDay(e.rsvpDeadline)}` : ''}`, cta: 'Reply', href: `/events/${e.id}` }
  return null
}

/* The faces tucked behind a compact row's right edge, leaning out far enough that
   their eyes show. The strip of them that sticks out past the row is one button,
   44px wide and as tall as the row, set wholly beside it so a tap can never open
   the plan by mistake. A tap turns all three over to their initials, one after
   another, and a second tap turns them back. Three faces drawn. */
function PeekingFaces({ people, plan }: { people: Participant[]; plan: string }) {
  const root = useRef<HTMLSpanElement>(null)
  const [flipped, setFlipped] = useState(false)
  const { contextSafe } = useGSAP({ scope: root })
  const shown = people.slice(0, 3)
  const toggle = contextSafe(() => {
    const next = !flipped
    setFlipped(next)
    const turns = root.current?.querySelectorAll('.face-flip')
    if (!turns?.length) return
    if (reducedMotion()) gsap.set(turns, { rotateY: next ? 180 : 0 })
    else gsap.to(turns, { rotateY: next ? 180 : 0, duration: 0.55, ease: 'back.out(1.7)', stagger: 0.07, overwrite: true })
  })
  return (
    <span ref={root}>
      <span aria-hidden className="absolute -right-[22px] top-1/2 -z-10 flex -translate-y-1/2 flex-col">
        {shown.map((p, i) => {
          const c = personVar(p.color)
          return (
            <span key={p.id} className={`block h-7 w-7 ${i ? '-mt-2' : ''}`} style={{ transform: `rotate(${i % 2 ? 10 : 16}deg)`, perspective: 168 }}>
              <span className="face-flip relative block h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
                <span className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                  <FaceSvg face={p.face ?? defaultFace(p.initials, p.color)} color={p.color} size={28} />
                </span>
                <span
                  className="absolute grid place-items-center rounded-full text-[10px] font-semibold leading-none"
                  style={{ inset: 28 / 22, boxShadow: `0 0 0 ${28 / 20}px var(--face-edge)`, filter: 'var(--face-lift)', background: c.bg, color: c.text, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  {p.initials}
                </span>
              </span>
            </span>
          )
        })}
      </span>
      <button
        type="button" onClick={toggle} aria-pressed={flipped}
        aria-label={`Show initials for ${namesLabel(shown.map((p) => (p.you ? 'you' : p.name)))} in ${plan}`}
        className="absolute inset-y-0 -right-11 w-11 rounded-xl outline-offset-2 [-webkit-tap-highlight-color:transparent]"
      />
    </span>
  )
}

/* One plan as a compact framed row (a phone's second and third plans): its
   cover, its name, the time question answered first (the locked time, else the best
   time so far, each with its zone) and what you owe if anything. A few of its faces
   are tucked behind the row's right edge, peeking out the way the photo card's peek
   over its top, so the row keeps its full width for the time. The whole row opens
   the plan, at the task you owe when there is one. */
function CompactPlan({ e, phase }: { e: AppEvent; phase: Phase }) {
  const d = digestOf(e, phase)
  const turn = turnOf(e, phase)
  const slot = confirmedSlotText(e)
  const [from, to] = coverFor(e.id)
  const faces = peopleIn(e)
  return (
    <div className={`relative isolate ${faces.length ? 'mr-6' : ''}`}>
      {faces.length > 0 && <PeekingFaces people={faces} plan={e.title} />}
    <Link href={turn?.href ?? eventTabFor(e)} className="flex items-center gap-3 rounded-[14px] bg-frame p-2 pr-3 shadow-frame">
      <Cover src={e.image} fit={e.imageFit} pos={e.imagePos} from={from} to={to} className="h-[64px] w-[72px] flex-none" rounded="rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-serif text-[17px] leading-tight tracking-[-0.01em]">{e.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-dim">
          {slot
            ? <><span>{slot}</span><TimezonePill tz={e.timezone} day={e.confirmed?.dayKey} /></>
            : d.best
              ? <><span>{d.best.dayLabel}, {fmtMinute(d.gridStart + d.best.s)}</span><TimezonePill tz={e.timezone} day={d.best.dayKey} /><span>so far</span></>
              : <span>Picking a time</span>}
        </div>
        <div className="mt-0.5 text-[13px] text-dim">{countLine(e, d, false)}</div>
        {turn && <div className="mt-0.5 truncate text-[13px] font-semibold text-text">{turn.line}</div>}
      </div>
      <ChevronRight size={17} className="flex-none text-faint" aria-hidden />
    </Link>
    </div>
  )
}

// what the board held last visit, so a note whose task has since been done can go
const NOTES_KEY = 'hourelle.home.notes'
// the most notes drawn; past it the last spot says how many more there are
const NOTES_MAX = 5
type Note = { key: string; title: string; line: string; cta?: string; href?: string; done?: boolean }

/* Your turn: one sticky note per plan waiting on you, laid out on a board in rows of
   two, each a little turned, and your own face stuck in the spot after the last note.
   Never more than five notes; past that the fifth spot says how many more and opens
   Plans.

   A note leaves only when its task is done. The board remembers what it held
   (NOTES_KEY), so a note whose task was done elsewhere since the last visit is drawn
   once more in its old spot, ticked Done with its task struck through. A moment
   after the page settles it peels up from the bottom and falls off the page (a copy
   of it, animations/peel), then the notes after it slide up into the gap (measured
   before and after, then eased from the old spot). With reduced motion done notes
   simply go. */
function NotesBoard({ turns, eventIds, wide }: { turns: { x: Item; t: Turn }[]; eventIds: Set<string>; wide: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const [board, setBoard] = useState<Note[]>([])
  // where each note sat before the board changed, for the slide into the gap
  const from = useRef<Map<string, DOMRect>>(new Map())
  const live = turns.map(({ x, t }) => ({ key: `${x.e.id}:${t.cta}`, title: x.e.title, line: t.line, cta: t.cta, href: t.href }))
  const liveSig = live.map((n) => n.key).join('|')

  // lay out the board: what it held last time in that order (a note whose task is now
  // done kept in place, ticked; a deleted plan's note just gone), then anything new
  // each list of notes is laid out once: an effect that runs twice (React's
  // development check) must not compare the list with the copy it just saved
  const laidOut = useRef<string | null>(null)
  useEffect(() => {
    if (laidOut.current === liveSig) return
    laidOut.current = liveSig
    let before: { key: string; title: string; line: string }[] = []
    try { before = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]') } catch { /* nothing remembered */ }
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(live.map(({ key, title, line }) => ({ key, title, line })))) } catch { /* private window */ }
    const byKey = new Map(live.map((n) => [n.key, n]))
    const next: Note[] = []
    for (const b of before) {
      const n = byKey.get(b.key)
      if (n) { next.push(n); byKey.delete(b.key) }
      else if (eventIds.has(b.key.split(':')[0])) next.push({ ...b, done: true })
    }
    for (const n of byKey.values()) next.push(n)
    setBoard(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSig])

  const { contextSafe } = useGSAP(() => {
    // the notes after a removed one slide up from where they were
    const el = root.current
    if (!el || !from.current.size) return
    for (const cell of el.querySelectorAll<HTMLElement>('[data-note]')) {
      const was = from.current.get(cell.dataset.note!)
      if (!was) continue
      const now = cell.getBoundingClientRect()
      const dx = was.left - now.left, dy = was.top - now.top
      if (dx || dy) gsap.fromTo(cell, { x: dx, y: dy }, { x: 0, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' })
    }
    from.current = new Map()
  }, { scope: root, dependencies: [board] })

  // done notes go one at a time, a moment after the page settles
  const doneKeys = board.filter((n) => n.done).map((n) => n.key).join('|')
  useGSAP(() => {
    const el = root.current
    if (!el || !doneKeys) return
    const remove = (key: string) => {
      from.current = new Map(Array.from(el.querySelectorAll<HTMLElement>('[data-note]')).map((c) => [c.dataset.note!, c.getBoundingClientRect()]))
      setBoard((b) => b.filter((n) => n.key !== key))
    }
    const first = doneKeys.split('|')[0]
    if (reducedMotion()) { const t = gsap.delayedCall(1, () => setBoard((b) => b.filter((n) => !n.done))); return () => { t.kill() } }
    const t = gsap.delayedCall(0.9, contextSafe(() => {
      const cell = el.querySelector<HTMLElement>(`[data-note="${CSS.escape(first)}"]`)
      const note = cell?.querySelector<HTMLElement>('[data-paper]')
      const layer = cell?.querySelector<HTMLElement>('[data-fly]')
      if (!cell || !note || !layer) { remove(first); return }
      const copy = note.cloneNode(true) as HTMLElement
      Object.assign(copy.style, { position: 'absolute', top: '0', left: '0', right: '0' })
      layer.appendChild(copy)
      note.style.visibility = 'hidden'
      peelable(copy, layer).finish(() => remove(first), { fall: true })
    }))
    return () => { t.kill() }
  }, { scope: root, dependencies: [doneKeys] })

  if (!board.length) return null
  const owed = board.filter((n) => !n.done).length
  const shownNotes = board.slice(0, board.length > NOTES_MAX ? NOTES_MAX - 1 : NOTES_MAX)
  const more = board.length - shownNotes.length
  const finished = board.filter((n) => n.done)
  return (
    <section aria-labelledby="home-turn" className="min-w-0">
      <h2 id="home-turn" className="sr-only">Your turn{owed ? `, ${owed} ${owed === 1 ? 'plan' : 'plans'} waiting on you` : ''}</h2>
      {finished.length > 0 && <span className="sr-only" role="status">{finished.map((n) => `${n.title}: done`).join('. ')}</span>}
      <div ref={root} className="grid grid-cols-2 items-start gap-x-4 gap-y-5 sm:gap-x-5 lg:w-[460px]">
        {shownNotes.map((n, i) => (
          <div key={n.key} data-note={n.key} className="relative min-w-0">
            <div data-paper aria-hidden={n.done || undefined}>
              <StickyNote
                tilt={i % 2 ? 1.2 : -1.5}
                kicker={n.done
                  ? <span className="flex items-center gap-1.5 text-sticky-text"><PencilTick ink="accent" size={16} /> Done</span>
                  : <><PencilStar size={16} className="-mt-0.5 mr-1" />Your turn</>}
                className="min-h-[172px]"
              >
                <span className="font-serif text-[18px] leading-[1.15] [overflow-wrap:anywhere]">{n.title}</span>
                <span className={`text-[13px] leading-[1.4] text-sticky-dim ${n.done ? 'line-through decoration-1' : ''}`}>{n.line}</span>
                {!n.done && n.href && (
                  <Link href={n.href} className="mt-auto flex h-11 items-center self-start rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent sm:h-9">
                    {n.cta}
                  </Link>
                )}
              </StickyNote>
            </div>
            <div data-fly aria-hidden className="pointer-events-none absolute inset-0 z-10" />
          </div>
        ))}
        {more > 0 && (
          <Link href="/events" className="block">
            <StickyNote tilt={1.2} className="min-h-[172px]">
              <span className="font-serif text-[30px] leading-none">+{more}</span>
              <span className="text-[13px] leading-[1.4] text-sticky-dim">more waiting on you</span>
              <span className="mt-auto flex h-11 items-center gap-1 self-start text-[13px] font-semibold text-accent-text sm:h-9">See them <ArrowRight size={14} aria-hidden /></span>
            </StickyNote>
          </Link>
        )}
        {/* your face, stuck in the spot after the last note; on a row of its own it
            sits in the middle of it */}
        <FaceSticker size={wide ? 140 : 110} className={(shownNotes.length + (more > 0 ? 1 : 0)) % 2 ? 'min-h-[172px]' : 'col-span-2 py-1'} />
      </div>
    </section>
  )
}

// the date a plan is ordered by: its locked day, else the host's lock-by date
const dayOf = (e: AppEvent) => e.confirmed?.dayKey ?? e.planDeadline ?? '9999-12-31'

export default function HomePage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  // greeting settles after mount so the server-rendered HTML never disagrees
  // with a visitor in another timezone
  const [greeting, setGreeting] = useState('Afternoon')
  // the greeting names whoever is signed in (the stub, when nobody is)
  const account = useAccount()
  const firstName = account.name.split(' ')[0]
  // an account signing in on a browser that has not held its events before reads an
  // empty list for as long as the first pull takes, and used to show "nothing here"
  // for that moment. The shapes stay until the cloud has actually answered.
  const [settled, setSettled] = useState(true)
  useEffect(() => {
    setEvents(listEvents())
    setSettled(cloudSettled())
    setGreeting(greetingFor(new Date().getHours()))
  }, [])
  // someone else's change arrived from the cloud: re-read so the page follows it live
  useLiveEvents(() => { setEvents(listEvents()); setSettled(cloudSettled()) })
  const waiting = !settled && (events?.length ?? 0) === 0
  const loading = events === null || waiting
  const wide = useWide()

  const active: Item[] = (events ?? []).map((e) => ({ e, phase: phaseOf(e) })).filter((x) => x.phase !== 'past')
  // up next: locked-in plans by day (same-day ties to the earlier start), then the
  // ones still being decided, by the host's lock-by date and then newest first
  const upNext = [
    ...active.filter((x) => x.phase !== 'planning')
      .sort((a, b) => dayOf(a.e).localeCompare(dayOf(b.e)) || (a.e.confirmed?.startMin ?? 0) - (b.e.confirmed?.startMin ?? 0)),
    ...active.filter((x) => x.phase === 'planning')
      .sort((a, b) => dayOf(a.e).localeCompare(dayOf(b.e)) || b.e.createdAt - a.e.createdAt),
  ]
  const shown = upNext.slice(0, SHOWN)
  const sameDay = sameDayLabelFor(active.map((x) => x.e))
  // your turn: every plan waiting on you, in the same order, shown or not
  const turns = upNext.map((x) => ({ x, t: turnOf(x.e, x.phase) })).filter((y): y is { x: Item; t: Turn } => y.t !== null)
  // the headline names the plan in front: the closest one
  const hero = shown[0]
  const eventIds = new Set((events ?? []).map((e) => e.id))
  // one plan on a wide screen: what you owe and the create form sit beside it
  // rather than leaving half the row empty
  const solo = wide && shown.length === 1
  // each card's hand-laid details, from its plan id; a neighbour never repeats them.
  // On a phone the card lies straight, in line with the rows under it; the tilt is
  // for the photos laid out side by side on a large screen
  const looks: Look[] = []
  // neighbours lean opposite ways, or a straight card sits between two that mirror (rowLooks)
  looks.push(...rowLooks(shown.map((x) => x.e.id), shown.map((x) => x.e.keepsake)))
  if (!wide) looks.forEach((l) => { l.tilt = 0 })

  return (
    <div className="relative isolate mx-auto max-w-[1240px] px-6 pb-[92px] pt-7 sm:px-[26px] sm:pt-[34px]">
      <SoftShapes variant="home" />

      {/* greeting, then where the plan in front stands, as a sentence */}
      <p className="text-[15px] text-dim" suppressHydrationWarning>{greeting}, {firstName}.</p>
      {loading ? (
        <div className="mt-2 h-[38px] w-[260px] max-w-full animate-pulse rounded-lg bg-s2" />
      ) : (
        <h1 className="mt-0.5 max-w-[680px] font-serif font-normal text-[34px] leading-[1.06] tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-[42px]">
          {headline(hero?.e, hero?.phase)}
        </h1>
      )}

      {/* localStorage only exists after mount: pulse shapes, never a flash of "empty" */}
      {loading ? (
        <div className="mt-9 grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="h-[340px] max-w-[520px] animate-pulse rounded-2xl bg-s2" />
          <div className="h-[200px] animate-pulse rounded-2xl bg-s2" />
        </div>
      ) : (
        <div className={solo ? 'mt-8 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-x-14' : ''}>
          <section aria-labelledby="home-upnext" className={solo ? '' : 'mt-6 sm:mt-8'}>
            <h2 id="home-upnext" className="sr-only">Up next</h2>
            {shown.length === 0 ? (
              <div className="max-w-[480px]">
                <EmptyState
                  icon={CalendarPlus}
                  title="Your next plan goes here"
                  body="Start one and your group can pick a time together."
                  action={{ label: 'Start a plan', href: '/create' }}
                  secondary={{ label: 'Or use a template', href: '/templates' }}
                />
              </div>
            ) : wide ? (
              /* a sideways triangle, laid out by hand: the closest plan large on the
                 left, centred against the other two, which sit to its right a little
                 apart, one higher and further out, one lower and tucked in, turned
                 opposite ways like photos dropped on a table. Nothing overlaps. */
              <>
                <div className={shown.length > 1 ? 'grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center gap-x-12 xl:gap-x-20' : 'max-w-[560px]'}>
                  <UpNext e={shown[0].e} phase={shown[0].phase} sameDay={sameDay(shown[0].e)} size="hero" look={looks[0]} lead />
                  {shown.length > 1 && (
                    <div className="flex flex-col gap-10 xl:gap-12">
                      {shown.slice(1).map((x, i) => (
                        <div key={x.e.id} className={`w-full max-w-[380px] xl:max-w-[400px] ${shown.length === 2 ? '' : i === 0 ? 'ml-6 xl:ml-14' : 'mt-2 xl:ml-2'}`}>
                          <UpNext e={x.e} phase={x.phase} sameDay={sameDay(x.e)} size="small" look={looks[i + 1]} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* the closest plan as the photo card, the next two as compact framed rows
                 under it: everything at a glance, one tap each, nothing to swipe */
              <div className="mx-auto max-w-[480px]">
                <UpNext e={shown[0].e} phase={shown[0].phase} sameDay={sameDay(shown[0].e)} size="hero" look={looks[0]} lead />
                {shown.length > 1 && (
                  <ul className="mt-6 flex flex-col gap-3">
                    {shown.slice(1).map((x) => <li key={x.e.id}><CompactPlan e={x.e} phase={x.phase} /></li>)}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* what you owe, then a new plan: side by side on a large screen */}
          <div className={`grid gap-y-9 ${solo ? 'pt-6' : `mt-8 lg:mt-14 lg:items-start lg:gap-x-16 ${turns.length ? 'lg:grid-cols-[auto_minmax(0,1fr)]' : 'lg:max-w-[720px]'}`}`}>
            <NotesBoard turns={turns} eventIds={eventIds} wide={wide} />
            <QuickCreate />
          </div>
        </div>
      )}
    </div>
  )
}

// the headline: the plan in front and where it stands, one italic word
function headline(e?: AppEvent, phase?: Phase): React.ReactNode {
  if (!e || !phase) return <>Nothing planned <Em>yet</Em>.</>
  if (phase === 'today') return <>{e.title} is <Em>today</Em>.</>
  if (phase === 'planning') return <>{e.title} is <Em>coming together</Em>.</>
  return <>{e.title} is <Em>happening</Em>.</>
}

const first = (name: string) => name.split(' ')[0]

/* Everything Home says about one plan, worked out once per card: one pass over the
   people however many there are, and the names of the people still to answer only
   when there are one to three of them. */
function digestOf(e: AppEvent, phase: Phase) {
  const locked = phase !== 'planning'
  const me = e.participants.find((p) => p.you)
  const total = e.participants.length
  // who has marked times (or said none work), for the planning stage
  const answered = locked ? new Set<string>() : answeredIds(e)
  let going = 0, maybe = 0, out = 0, pending = 0
  const waitingOn: string[] = []
  for (const p of e.participants) {
    if (locked) {
      if (p.rsvp === 'attending') going++
      else if (p.rsvp === 'maybe') maybe++
      else if (p.rsvp === 'not_going') out++
      else { pending++; if (!p.you && waitingOn.length < 4) waitingOn.push(first(p.name)) }
    } else if (!answered.has(p.id) && !p.you && waitingOn.length < 4) waitingOn.push(first(p.name))
  }
  const stillOut = locked ? pending - (me?.rsvp === 'pending' ? 1 : 0) : total - answered.size - (me && !answered.has(me.id) ? 1 : 0)

  // when
  const du = daysUntil(e.confirmed?.dayKey ?? e.startDate)
  const countdown = !locked || du === null || du < 0 ? null : du === 0 ? 'today' : du === 1 ? 'tomorrow' : `in ${du} days`
  const best = !locked && e.granularity !== 'day' && answered.size > 0 ? bestWindow(availIvOf(e), e.days, e.durationMin ?? 60, e.bestMode) : null
  const gridStart = gridStartMinOf(e)

  // where
  const lead = leadingPlaceOf(e)
  const ballot = e.location.mode === 'vote' ? e.location.places.length : 0

  // you
  const votes = placeVotes(e.votes ?? {})
  const myVote = me ? e.location.places.find((pl) => votes[pl.id]?.includes(me.id)) : undefined
  const you = !me ? null
    : locked
      ? { attending: 'You’re going', maybe: 'You said maybe', not_going: 'You can’t make it', pending: 'You haven’t replied' }[me.rsvp]
      : !youReplied(e) ? 'You haven’t marked your times'
        : myVote ? `You voted for ${myVote.name}`
          : ballot > 0 ? 'You haven’t voted on a place'
            : null /* having marked your times is not news */

  // extras, only when there is something to say
  const lines = chatLines(e.messages).length
  const unread = Math.max(0, lines - seenMessageCount(e.id))
  return { locked, total, answered: answered.size, going, maybe, out, pending, waitingOn, stillOut, countdown, best, gridStart, lead, ballot, you, unread }
}

/** How many are in (lib/answers): answered out of everyone while deciding, going out of
 *  who can make the locked time after. The main card adds the rest, a compact row does not. */
function countLine(e: AppEvent, d: ReturnType<typeof digestOf>, detail = true): string {
  return d.locked ? goingLine(rsvpPool(e), detail) : answeredLine(d.answered, d.total)
}

// one line of the details block: a small icon, then a few words
function Row({ icon: Icon, children }: { icon: typeof Calendar; children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><Icon size={15} className="mt-[3px] flex-none text-dim" aria-hidden /><span className="min-w-0">{children}</span></li>
}

/* Up next, one plan: the cover as a taped photo, tilted a little, the faces of the
   people in tucked behind its top edge, then the plan's name, its stage, and a short
   details block that answers the time question first. The one button is the next
   thing to do. It only takes you to the plan, never answers in place, so it can sit
   inside the tilted photo, with sharing and duplicating beside it. `small` is the
   side card on a wide screen: a shorter picture and only the lines that matter
   most. `look` is its hand-laid details (Keepsake), the same every visit. */
function UpNext({ e, phase, sameDay, size, look, lead = false }: { e: AppEvent; phase: Phase; sameDay?: SameDayInfo; size: 'hero' | 'small'; look: Look; lead?: boolean }) {
  const tilt = look.tilt
  const router = useRouter()
  // a click on the card's empty paper opens the plan, like the cover and the name do.
  // Controls keep their own job, and a click on plain text does nothing, so the text
  // can still be selected.
  function openFromPaper(ev: React.MouseEvent) {
    const t = ev.target as Element
    if (t.closest('a, button, input, select, textarea, label, [role="button"]')) return
    if (window.getSelection()?.toString()) return
    if (overText(ev.clientX, ev.clientY)) return
    router.push(eventTabFor(e))
  }
  // the plan in front gets the page's pencil marks: its time highlighted, and a note
  // with an arrow at the button when something is owed. Refs for measuring the arrow.
  const details = useRef<HTMLDivElement>(null)
  const note = useRef<HTMLSpanElement>(null)
  const task = useRef<HTMLAnchorElement>(null)
  const [coverFrom, coverTo] = coverFor(e.id)
  const d = digestOf(e, phase)
  const turn = turnOf(e, phase)
  const action = turn ?? { cta: 'See the plan', href: eventTabFor(e) }
  const slot = confirmedSlotText(e)
  const small = size === 'small'
  // always a count of everyone invited, so how many have answered reads at a glance
  const who = countLine(e, d)
  // only what bears on the time; budget, spots and the host live on the plan page
  const extras = small ? [] : [
    d.unread > 0 && `${d.unread} new ${d.unread === 1 ? 'message' : 'messages'}`,
    d.locked && e.rsvpDeadline && `Reply by ${shortDay(e.rsvpDeadline)}`,
    !d.locked && e.planDeadline && `Deciding by ${shortDay(e.planDeadline)}`,
  ].filter(Boolean) as string[]
  return (
    <PeekCard people={peopleIn(e)} size={small ? 32 : 40} restShow={small ? 20 : 25} upShow={small ? 28 : 36} tilt={tilt}>
      <PhotoFrame tilt={tilt} tape={false} size={small ? 'sm' : 'md'} pad={look.pad} onClick={openFromPaper}>
        <div className="relative">
          <Link href={eventTabFor(e)} tabIndex={-1} aria-label={e.title} className="block">
            <Cover src={e.image} fit={e.imageFit} pos={e.imagePos} from={coverFrom} to={coverTo} className={small ? 'h-[84px]' : 'h-[112px] sm:h-[160px]'} rounded="rounded-lg" />
          </Link>
          <Keepsake look={look} />
        </div>
        <div ref={details} className={`relative ${small ? 'px-2 pb-2 pt-2.5' : 'px-2 pb-1.5 pt-3'}`}>
          {/* its place in the stack and the way on, in the top right */}
          <Link href={eventTabFor(e)} className={`block font-serif leading-[1.15] tracking-[-0.01em] [overflow-wrap:anywhere] hover:underline ${small ? 'text-[18px]' : 'text-[22px] sm:text-[24px]'}`}>
            {e.title}
          </Link>
          <StageStepper phase={phase} labels={small ? 'current' : 'auto'} className={`max-w-[340px] ${small ? 'mb-2.5 mt-2.5' : 'mb-3 mt-3'}`} />
          <ul className={`flex flex-col gap-1.5 leading-[1.45] ${small ? 'text-[13.5px]' : 'text-[14px]'}`}>
            {/* when first: the locked slot and how far off, or the best time so far */}
            {slot ? (
              <Row icon={Calendar}>{lead ? <Highlight>{slot}</Highlight> : slot} <TimezonePill tz={e.timezone} day={e.confirmed?.dayKey} />{d.countdown && <span className="text-dim">, {d.countdown}</span>}</Row>
            ) : d.best ? (
              <Row icon={Calendar}>
                {lead ? <Highlight>{d.best.dayLabel}, {fmtMinute(d.gridStart + d.best.s)}</Highlight> : <>{d.best.dayLabel}, {fmtMinute(d.gridStart + d.best.s)}</>} <TimezonePill tz={e.timezone} day={d.best.dayKey} /> <span className="text-dim">suits {d.best.count} of {d.total} so far</span>
              </Row>
            ) : (
              <Row icon={Calendar}>Picking a time, {dateRangeText(e)}</Row>
            )}
            {/* who is in, and by name when only a few are still out */}
            <Row icon={UsersRound}>
              {who}{d.stillOut >= 1 && d.stillOut <= 3 && d.waitingOn.length > 0 && <span className="text-dim">. Waiting on {namesLabel(d.waitingOn.slice(0, 3))}</span>}
            </Row>
            {/* what you owe is said once: by the margin note on the plan in front, else here */}
            {d.you && !(lead && turn) && <Row icon={UserRound}><span className={turn ? 'font-semibold text-moment-text' : ''}>{d.you}</span></Row>}
            {/* then where */}
            {small ? null : e.location.mode === 'remote' ? (
              <Row icon={Video}>Online{e.location.platform ? ` on ${e.location.platform}` : ''}</Row>
            ) : d.lead?.confirmed ? (
              <Row icon={MapPin}>{d.lead.place.name}{d.lead.place.place && <span className="text-dim">, {d.lead.place.place}</span>}</Row>
            ) : d.lead ? (
              <Row icon={MapPin}>{d.lead.place.name} <span className="text-dim">leads with {d.lead.voters.length} {d.lead.voters.length === 1 ? 'vote' : 'votes'}</span></Row>
            ) : d.ballot > 0 ? (
              <Row icon={MapPin}>{d.ballot} {d.ballot === 1 ? 'place' : 'places'} up for a vote</Row>
            ) : null /* no place in play: the card says nothing about it */}
          </ul>
          {sameDay && !small && (() => {
            const line = (
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-ochre-text">
                <CalendarClock size={14} className="flex-none" /> <span className="truncate">Same day as {sameDay.label}</span>
              </div>
            )
            // one clash names itself; only a count gets the expanding tooltip
            return sameDay.all
              ? <Tip text={`Same day as ${sameDay.all}`} className="mt-1.5 block w-fit max-w-full">{line}</Tip>
              : <div className="mt-1.5">{line}</div>
          })()}
          {extras.length > 0 && (
            // plain spacing when it wraps on a phone; hairlines only from sm up
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-dim sm:gap-x-2">
              {extras.map((x, i) => (
                <span key={x} className="flex items-center gap-2">
                  {i > 0 && <span className="hidden h-3 w-px flex-none bg-border2 sm:inline-block" aria-hidden />}
                  {x}
                </span>
              ))}
            </div>
          )}
          {/* a note in the margin for what you owe, its arrow measured to the button */}
          {lead && turn && (
            <div className="mt-2.5 flex justify-end pr-2 sm:justify-start sm:pl-[34%]">
              <HandNote ref={note} className="-rotate-2">{handNoteFor(turn)}</HandNote>
            </div>
          )}
          {/* the next thing to do, then sharing and duplicating this plan */}
          <div className={`relative z-[3] ${lead && turn ? 'mt-7 sm:mt-3.5' : 'mt-3.5'} flex flex-wrap items-center gap-2`}>
            <Link
              ref={task}
              href={action.href}
              className={`flex items-center gap-1.5 rounded-full bg-accent font-semibold text-on-accent ${small ? 'h-11 px-4 text-[13.5px] sm:h-9' : 'h-11 px-5 text-[14px]'}`}
            >
              {action.cta} <ArrowRight size={15} aria-hidden />
            </Link>
            <PlanActions e={e} phase={phase} />
          </div>
          {lead && turn && <PencilArrow from={note} to={task} within={details} />}
        </div>
      </PhotoFrame>
    </PeekCard>
  )
}

// what the margin note says, by what you owe
function handNoteFor(t: Turn): string {
  if (t.cta === 'Mark my times') return 'your times are missing'
  if (t.cta === 'Vote') return 'your vote is missing'
  return 'you still need to reply'
}

/* sharing, duplicating and removing one plan: small round buttons beside its task
   button, named for the plan. Only the host hands out the invite link; any plan that
   is not a demo can be duplicated, and deleted (yours) or left (someone else's). */
function PlanActions({ e, phase }: { e: AppEvent; phase: Phase }) {
  const [copied, setCopied] = useState(false)
  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/events/${e.id}/join`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600)
      pushFlash(`Link to ${e.title} copied.`)
    }).catch(() => {})
  }
  const round = 'grid h-11 w-11 place-items-center rounded-full border sm:h-9 sm:w-9'
  return (
    <span className="flex items-center gap-2">
      {e.hostedByYou && phase !== 'past' && (
        <button
          type="button" onClick={copyLink} aria-label={copied ? `Link to ${e.title} copied` : `Copy link to ${e.title}`} title={copied ? 'Link copied' : 'Copy the invite link'}
          className={`${round} ${copied ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border2 bg-s1 text-text hover:bg-s2'}`}
        >
          {copied ? <Check size={16} /> : <Link2 size={16} />}
        </button>
      )}
      {!e.demo && (
        <Link href={`/create?from=${e.id}`} aria-label={`Duplicate ${e.title}`} title="Duplicate this plan" className={`${round} border-border2 bg-s1 text-text hover:bg-s2`}>
          <CopyPlus size={16} />
        </Link>
      )}
      {/* the old card's quick delete: the same route, to the plan's delete zone where
          it is confirmed (and can be undone); someone else's plan is left there instead */}
      {!e.demo && (
        <Link
          href={`/events/${e.id}?tab=details&focus=delete`}
          aria-label={e.hostedByYou ? `Delete ${e.title}` : `Leave ${e.title}`}
          title={e.hostedByYou ? 'Delete this plan' : 'Leave this plan'}
          className={`${round} border-border2 bg-s1 text-dim hover:border-brick-border hover:bg-brick-bg hover:text-brick-text`}
        >
          {e.hostedByYou ? <Trash2 size={16} /> : <UserRoundX size={16} />}
        </Link>
      )}
    </span>
  )
}

/* Start a plan: the fastest path to a live plan, a name and the coming week, one
   click. Everything else (place, invites, budget) waits on the plan page or behind
   More options. A form, so it stays flat: a calm framed card, nothing tilted or
   laid over it. */
function QuickCreate() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [today, setToday] = useState('')
  const [need, setNeed] = useState(false)
  // dates fill after mount: the server doesn't know the visitor's today.
  // The coming week is the default window (same as the wizard): a scheduling poll
  // needs days to choose between, and one week is the typical ask.
  useEffect(() => {
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    const d = new Date()
    const week = new Date(d)
    week.setDate(week.getDate() + 6)
    setToday(iso(d))
    setStart(iso(d))
    setEnd(iso(week))
  }, [])
  // beyond the 28-day time-poll cap, the range is trip-shaped: ask which days instead
  // of silently cutting the range short
  const spanDays = start && end && end >= start ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1 : 1
  const asDayPoll = spanDays > 28
  function go() {
    const t = title.trim()
    if (!t) { setNeed(true); return }
    let tz = 'UTC'
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { /* UTC */ }
    const ev = createEvent({
      title: t, description: '', startDate: start, endDate: end < start ? start : end,
      granularity: asDayPoll ? 'day' : '30', timezone: tz, budget: '', durationMin: 60,
      locMode: 'later', planMode: 'vote', picked: [], platform: 'Google Meet', meetingLink: '',
      emails: [], accounts: [],
    })
    // quick means quick: straight to the plan, where the share link waits in the header
    pushFlash('Your plan is live. Share the link so people can join.')
    router.push(`/events/${ev.id}`)
  }
  const dateCls = 'h-12 w-full'
  return (
    <section aria-labelledby="home-start" className="min-w-0 rounded-3xl bg-frame p-5 shadow-frame sm:p-7">
      <h2 id="home-start" className="font-serif text-[24px] leading-tight tracking-[-0.01em] sm:text-[26px]"><PencilUnderline ink="graphite">Start a plan</PencilUnderline></h2>
      <label htmlFor="quick-title" className="mt-4 block text-[13px] font-semibold text-dim">Name</label>
      <input
        id="quick-title"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setNeed(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter') go() }}
        aria-invalid={need || undefined}
        aria-describedby={need ? 'quick-title-err' : undefined}
        placeholder="Friday dinner"
        className={`mt-1.5 h-12 w-full rounded-[12px] border ${need ? 'border-brick-border' : 'border-border'} bg-s2 px-4 text-[16px] outline-none placeholder:text-faint focus:border-accent`}
      />
      {need && <p id="quick-title-err" role="alert" className="mt-1.5 text-[12.5px] font-medium text-brick-text">Give it a name first.</p>}
      {/* the days to pick from, as a pair */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <div className="min-w-0">
          <span aria-hidden className="mb-1.5 block text-[13px] font-semibold text-dim">From</span>
          <DateField value={start} min={today || undefined} label="Earliest day" className={dateCls}
            onChange={(v) => { const d = fromDay(v, today); setStart(d); if (end < d) setEnd(d) }} />
        </div>
        <span className="pb-3.5 text-faint" aria-hidden>→</span>
        <div className="min-w-0">
          <span aria-hidden className="mb-1.5 block text-[13px] font-semibold text-dim">To</span>
          <DateField value={end} min={start || undefined} label="Latest day" className={dateCls} onChange={(v) => setEnd(fromDay(v, start))} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="button" onClick={go} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15px] font-semibold text-on-accent sm:w-auto">
          <CalendarPlus size={17} aria-hidden /> Create
        </button>
        {/* the wizard opens with what was typed here, so nothing is typed twice, and
            with its More options already open, since that is what was asked for */}
        <Link
          href={`/create?${(() => { const q = new URLSearchParams(); if (title.trim()) q.set('title', title.trim()); if (start) q.set('start', start); if (end) q.set('end', end); q.set('more', '1'); return q.toString() })()}`}
          className="inline-flex min-h-11 w-full items-center justify-center text-[13.5px] font-semibold text-accent-text hover:underline sm:min-h-0 sm:w-auto"
        >
          More options
        </Link>
      </div>
      <p className="mt-3 text-[12.5px] leading-[1.5] text-dim">
        {asDayPoll
          ? 'Over four weeks, so this asks which days work instead of times.'
          : 'Uses your time zone. Share the link and people mark when they’re free.'}
      </p>
    </section>
  )
}
