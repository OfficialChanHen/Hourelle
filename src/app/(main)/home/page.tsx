'use client'


/* ── home: what is next, and what you can do about it ──
   A headline that says where your nearest plan stands, then:
     Up next      the closest locked-in plan, as a taped photo with the group's faces
                  peeking over its top. With nothing locked in, the newest plan being
                  made stands in, so it is never empty.
     Your turn    the one thing you still owe a plan, as a sticky note
     Your plans / You're invited
                  the rest as pills, four of each at most, then a link to all of them
     Quick create a name and a week, one click

   Scrapbook touches (the photo, tape, sticker faces, the sticky note) are for this
   page's moments only. The pills and the create form stay flat and straight.

   Anything the server cannot know (the greeting, today's date, which plans this
   browser holds) is filled in after mount, so the server-rendered HTML never
   disagrees with a visitor in another timezone. `useLiveEvents` re-reads the list
   whenever the cloud changes something. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CalendarClock, Check, CopyPlus, Link2, ArrowRight } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Em } from '@/components/ui/Em'
import { coverFor } from '@/components/ui/StoredEventCard'
import { Cover } from '@/components/ui/Cover'
import { PeekCard, peopleIn } from '@/components/ui/PeekCard'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { StickyNote } from '@/components/ui/StickyNote'
import { SoftShapes } from '@/components/ui/SoftShapes'
import { WavyRule } from '@/components/ui/WavyRule'
import { Avatar } from '@/components/ui/Avatar'
import { namesLabel } from '@/components/ui/AvatarRow'
import { pushFlash } from '@/components/ui/FlashToast'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Tip } from '@/components/ui/Tip'
import { PHASE_BADGE, PHASE_TINT } from '@/components/ui/LifecycleStrip'
import { fromDay,
  createEvent, eventTabFor, listEvents, phaseOf, daysUntil, daysUntilLabel, dateRangeText, confirmedSlotText, sameDayLabelFor,
  leadingPlaceOf, respondedCount, youReplied, youVoted,
  type AppEvent, type Phase, type SameDayInfo,
} from '@/lib/events'
import { cloudSettled } from '@/lib/remote'
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

// how many pills each list shows before "See all"
const PILLS = 4

type Turn = { kind: string; line: string; cta: string; href: string }

/** The one thing you still owe this plan, if any: your times while it is being
    decided, a place vote when one is open, your reply once it is locked in. */
function turnOf(e: AppEvent, phase: Phase): Turn | null {
  const me = e.participants.find((p) => p.you)
  if (!me || e.demo) return null
  if (phase === 'planning') {
    if (!youReplied(e)) return { kind: 'times', line: 'Mark when you’re free', cta: 'Mark my times', href: `/events/${e.id}?tab=availability` }
    if (e.location.mode === 'vote' && e.location.places.length > 0 && !youVoted(e)) return { kind: 'vote', line: 'Vote on a place', cta: 'Vote', href: `/events/${e.id}?tab=location` }
    return null
  }
  if (phase !== 'past' && me.rsvp === 'pending') return { kind: 'rsvp', line: 'Say if you’re coming', cta: 'Reply', href: `/events/${e.id}` }
  return null
}

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

  const withPhase = (events ?? []).map((e) => ({ e, phase: phaseOf(e) }))
  const active = withPhase.filter((x) => x.phase !== 'past')

  // up next: the closest confirmed plan, nearest day first and same-day ties to the
  // earlier start. With nothing confirmed, the newest planning one stands in.
  const upNext = active
    .filter((x) => x.phase === 'today' || x.phase === 'soon' || x.phase === 'upcoming')
    .sort((a, b) =>
      ((daysUntil(a.e.confirmed?.dayKey ?? a.e.startDate) ?? 0) - (daysUntil(b.e.confirmed?.dayKey ?? b.e.startDate) ?? 0)) ||
      ((a.e.confirmed?.startMin ?? 0) - (b.e.confirmed?.startMin ?? 0)))
  const hero = upNext[0] ?? active.find((x) => x.phase === 'planning')
  // the rest as pills: the next locked-in ones first, then the ones being decided.
  // The hero is already on the page, so it takes no pill of its own.
  const order = new Map(upNext.map((x, i) => [x.e.id, i]))
  const rest = active
    .filter((x) => x.e.id !== hero?.e.id)
    .sort((a, b) => (order.get(a.e.id) ?? 99) - (order.get(b.e.id) ?? 99))
  const yours = rest.filter((x) => x.e.hostedByYou)
  const invited = rest.filter((x) => !x.e.hostedByYou)
  const sameDay = sameDayLabelFor(active.map((x) => x.e))
  // your turn: the first plan waiting on you, hero included, soonest first
  const turns = [...(hero ? [hero] : []), ...rest]
    .map((x) => ({ x, t: turnOf(x.e, x.phase) }))
    .filter((y): y is { x: typeof active[number]; t: Turn } => y.t !== null)
  const turn = turns[0]

  return (
    <div className="relative isolate mx-auto max-w-[1240px] px-6 pb-[92px] pt-7 sm:px-[26px] sm:pt-[34px]">
      <SoftShapes variant="home" />

      {/* greeting, then where the nearest plan stands as a sentence */}
      <p className="text-[15px] text-dim" suppressHydrationWarning>{greeting}, {firstName}.</p>
      {loading ? (
        <div className="mt-2 h-[38px] w-[260px] max-w-full animate-pulse rounded-lg bg-s2" />
      ) : (
        <h1 className="mt-0.5 max-w-[640px] font-serif font-normal text-[34px] leading-[1.06] tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-[42px]">
          {headline(hero?.e, hero?.phase)}
        </h1>
      )}

      {/* localStorage only exists after mount: pulse shapes, never a flash of "empty" */}
      {loading ? (
        <div className="mt-9 grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="h-[300px] max-w-[480px] animate-pulse rounded-2xl bg-s2" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-11 w-[220px] animate-pulse rounded-full bg-s2" />)}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-x-14 gap-y-8 sm:mt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <section aria-labelledby="home-upnext">
            <h2 id="home-upnext" className="sr-only">Up next</h2>
            {hero ? (
              <UpNext e={hero.e} phase={hero.phase} sameDay={sameDay(hero.e)} />
            ) : (
              <EmptyState
                icon={CalendarPlus}
                title="Your next plan goes here"
                body="Start one and your group can pick a time together."
                action={{ label: 'Start a plan', href: '/create' }}
                secondary={{ label: 'Or open a demo', href: '/demos' }}
              />
            )}
          </section>

          <div className="min-w-0">
            {(turn || rest.length > 0) && (
              <>
                <WavyRule className="mb-7 lg:hidden" />
                <div className="flex flex-col items-start gap-7 sm:flex-row">
                  {turn && (
                    <StickyNote kicker="Your turn" className="ml-1 w-[220px] max-w-[calc(100%-8px)] flex-none sm:ml-0 sm:w-[190px]">
                      <span className="font-serif text-[19px] leading-[1.1] [overflow-wrap:anywhere]">{turn.x.e.title}</span>
                      <span className="text-[13px] leading-[1.4] text-sticky-dim">{turn.t.line}</span>
                      <Link href={turn.t.href} className="mt-1 flex h-11 items-center self-start rounded-full bg-accent px-4 text-[13.5px] font-semibold text-on-accent sm:h-9">
                        {turn.t.cta}
                      </Link>
                      {turns.length > 1 && <span className="text-[12px] text-sticky-dim">{turns.length - 1} more {turns.length === 2 ? 'plan is' : 'plans are'} waiting on you</span>}
                    </StickyNote>
                  )}
                  <div className="flex w-full min-w-0 flex-1 flex-col gap-6 sm:w-auto">
                    {yours.length > 0 && <PlanPills title="Your plans" list={yours} total={yours.length} />}
                    {invited.length > 0 && <PlanPills title="You’re invited" list={invited} total={invited.length} />}
                    {(yours.length > PILLS || invited.length > PILLS) && (
                      <Link href="/events" className="-mt-2 inline-flex min-h-11 items-center self-start text-[13.5px] font-semibold text-accent-text hover:underline sm:min-h-0 sm:py-1">
                        See all {active.length} plans
                      </Link>
                    )}
                  </div>
                </div>
              </>
            )}
            {/* plan something in one line: name it, keep or nudge the week, create */}
            <div className={turn || rest.length > 0 ? 'mt-9' : ''}>
              <h2 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[.13em] text-faint">Start a plan</h2>
              <QuickCreate />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// the headline: the nearest plan's name and where it stands, one italic word
function headline(e?: AppEvent, phase?: Phase): React.ReactNode {
  if (!e || !phase) return <>Nothing planned <Em>yet</Em>.</>
  if (phase === 'today') return <>{e.title} is <Em>today</Em>.</>
  if (phase === 'planning') return <>{e.title} is <Em>coming together</Em>.</>
  return <>{e.title} is <Em>happening</Em>.</>
}

/* The other plans as rounded pills, staggered a little, each with one face: the
   host's on an invite, the first person in on your own. Four at most, then a count,
   and one link to the full list under both, so thirty plans still draw a handful of
   things. Flat and straight:
   these are for tapping. */
function PlanPills({ title, list, total }: { title: string; list: { e: AppEvent; phase: Phase }[]; total: number }) {
  const shown = list.slice(0, PILLS)
  return (
    <div className="min-w-0">
      <h2 className="mb-2.5 font-serif text-[16px] italic text-dim">{title}</h2>
      <ul className="flex flex-col items-start gap-2.5">
        {shown.map((x, i) => {
          const face = x.e.hostedByYou
            ? peopleIn(x.e).find((p) => !p.you) ?? x.e.participants[0]
            : x.e.participants.find((p) => p.host) ?? x.e.participants[0]
          const du = daysUntil(x.e.confirmed?.dayKey ?? x.e.startDate)
          const owes = turnOf(x.e, x.phase)
          return (
            <li key={x.e.id} className="flex min-w-0 max-w-full" style={{ marginLeft: i % 2 ? 14 : 0, maxWidth: i % 2 ? 'calc(100% - 14px)' : undefined }}>
              <Link
                href={eventTabFor(x.e)}
                className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-full bg-s1 py-1.5 pl-1.5 pr-4 shadow-soft hover:bg-s0"
              >
                {face && <Avatar initials={face.initials} color={face.color} face={face.face} size={28} />}
                <span className="min-w-0 truncate text-[14px] font-semibold">{x.e.title}</span>
                <span className={`flex-none text-[12.5px] ${owes ? 'font-semibold text-moment-text' : 'text-dim'}`}>
                  {owes ? 'Your turn' : x.phase === 'planning' ? PHASE_BADGE.planning.label : daysUntilLabel(du)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {total > PILLS && <p className="mt-2 text-[13px] text-dim">and {total - PILLS} more</p>}
    </div>
  )
}

/* Up next: the plan's cover as a taped photo, tilted a little, the faces of the
   people in peeking over its top edge, and one sentence under the picture. The main
   button sits on the frame's corner like a sticker; it is not tilted, so it is
   exactly where it looks. Sharing and duplicating sit quietly underneath. */
function UpNext({ e, phase, sameDay }: { e: AppEvent; phase: Phase; sameDay?: SameDayInfo }) {
  const [coverFrom, coverTo] = coverFor(e.id)
  const dest = eventTabFor(e)
  const tint = PHASE_TINT[phase]
  const du = daysUntil(e.confirmed?.dayKey ?? e.startDate)
  const [copied, setCopied] = useState(false)
  const people = peopleIn(e)
  const action = phase === 'planning'
    ? { label: 'Add your times', href: `/events/${e.id}?tab=availability` }
    : { label: 'See the plan', href: `/events/${e.id}` }
  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/events/${e.id}/join`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  // "Sam, Priya and 4 more are in", first names, you first when you are in
  const names = [...people].sort((a, b) => Number(!!b.you) - Number(!!a.you)).map((p) => (p.you ? 'You' : p.name.split(' ')[0]))
  const who = names.length ? namesLabel(names.slice(0, 2), names.length - 2) : ''
  const place = leadingPlaceOf(e)
  const slot = confirmedSlotText(e)
  const responded = respondedCount(e.avail, e.unavailableIds)
  return (
    <div className="max-w-[480px]">
      <div className="relative pb-5 pr-1">
        <PeekCard people={people} size={40} restShow={26} upShow={36} flippable>
          <PhotoFrame tilt={-1.5} tape="corner" settle>
            <Link href={dest} tabIndex={-1} aria-label={e.title} className="block">
              <Cover src={e.image} fit={e.imageFit} pos={e.imagePos} from={coverFrom} to={coverTo} className="h-[150px] sm:h-[210px]" rounded="rounded-lg" />
            </Link>
            <div className="px-1 pb-6 pt-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-dim">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: tint.dot }} />
                  {PHASE_BADGE[phase].label}
                </span>
                {du !== null && (
                  <>
                    <span className="h-3 w-px flex-none bg-border2" aria-hidden />
                    <span className={du >= 0 && du <= 14 ? 'text-accent-text' : ''}>{daysUntilLabel(du)}</span>
                  </>
                )}
                {!e.hostedByYou && (
                  <>
                    <span className="h-3 w-px flex-none bg-border2" aria-hidden />
                    <span className="font-serif text-[14px] italic">Hosted by {e.hostName}</span>
                  </>
                )}
              </div>
              <p className="text-[15px] leading-[1.55]">
                {who && <><strong className="font-semibold">{who}</strong> {names.length === 1 && names[0] !== 'You' ? 'is' : 'are'} in. </>}
                {slot ? (
                  <>{slot} <TimezonePill tz={e.timezone} />{place ? ` at ${place.place.name}` : ''}.</>
                ) : (
                  <>{responded === 0 ? 'No one has answered yet.' : `${responded} of ${e.participants.length} have answered.`} Looking at {dateRangeText(e)}.</>
                )}
              </p>
              {sameDay && (() => {
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
            </div>
          </PhotoFrame>
        </PeekCard>
        <Link
          href={action.href}
          className="absolute bottom-0 right-0 z-[2] flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent shadow-soft"
        >
          {action.label} <ArrowRight size={15} />
        </Link>
      </div>
      {(e.hostedByYou && phase !== 'past') || !e.demo ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {e.hostedByYou && phase !== 'past' && (
            <button
              type="button" onClick={copyLink}
              className={`flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-semibold sm:h-9 ${copied ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border2 bg-s1 text-text hover:bg-s2'}`}
            >
              {copied ? <><Check size={15} /> Link copied</> : <><Link2 size={15} /> Share link</>}
            </button>
          )}
          {!e.demo && (
            <Link
              href={`/create?from=${e.id}`} title="Duplicate this plan"
              className="flex h-11 items-center gap-1.5 rounded-full border border-border2 bg-s1 px-4 text-[13.5px] font-semibold text-text hover:bg-s2 sm:h-9"
            >
              <CopyPlus size={15} /> Duplicate
            </Link>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* the fastest path to a live event: a name, the coming week prefilled, one click.
   Everything else (place, invites, budget) waits on the event page or in /create. */
function QuickCreate() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [today, setToday] = useState('')
  const [need, setNeed] = useState(false)
  // dates fill after mount: the server doesn't know the visitor's today.
  // The coming week is the default window (same as the wizard) — a scheduling poll
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
    // quick means quick: straight to the event, where the share link waits in the header
    pushFlash('Your plan is live. Share the link so people can join.')
    router.push(`/events/${ev.id}`)
  }
  // on a phone the two dates share the row and split it evenly; from sm up each is
  // wide enough for the longest day name
  const dateCls = 'h-11 w-full sm:h-10 sm:w-[158px]'
  return (
    <div className="mb-6 rounded-2xl border border-border bg-s1 p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setNeed(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') go() }}
          aria-label="Plan name"
          aria-invalid={need || undefined}
          aria-describedby={need ? 'quick-title-err' : undefined}
          placeholder="What are you planning?"
          className={`h-11 sm:h-10 min-w-[200px] flex-1 rounded-[10px] border ${need ? 'border-brick-border' : 'border-border'} bg-s2 px-[13px] text-[14.5px] outline-none placeholder:text-faint focus:border-accent`}
        />
        <div className="flex w-full min-w-0 flex-none items-center gap-2 sm:w-auto">
          <span className="min-w-0 flex-1 sm:flex-none">
            <DateField value={start} min={today || undefined} label="Earliest day" className={dateCls}
              onChange={(v) => { const d = fromDay(v, today); setStart(d); if (end < d) setEnd(d) }} />
          </span>
          <span className="flex-none text-faint" aria-hidden>→</span>
          <span className="min-w-0 flex-1 sm:flex-none">
            <DateField value={end} min={start || undefined} label="Latest day" className={dateCls} onChange={(v) => setEnd(fromDay(v, start))} />
          </span>
        </div>
        <button onClick={go} className="flex h-11 sm:h-10 flex-none items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent">
          <CalendarPlus size={16} /> Create
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px] text-dim">
        <span>
          {need
            ? <span id="quick-title-err" role="alert" className="font-medium text-brick-text">Give it a name first.</span>
            : asDayPoll
              ? 'Over four weeks, so this asks which days work instead of times.'
              : 'Uses your time zone. Share the link and people mark when they are free.'}
        </span>
        {/* the wizard opens with what was typed here, so nothing is typed twice, and
            with its More options already open, since that is what was asked for */}
        <Link
          href={`/create?${(() => { const q = new URLSearchParams(); if (title.trim()) q.set('title', title.trim()); if (start) q.set('start', start); if (end) q.set('end', end); q.set('more', '1'); return q.toString() })()}`}
          className="-my-2 py-2 font-semibold text-accent-text hover:underline"
        >
          More options
        </Link>
      </div>
    </div>
  )
}
