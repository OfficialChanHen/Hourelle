'use client'


/* ── home: what is next, and what you can do about it ──
   A headline that says where the plan on screen stands, then:
     Up next      every plan you are in, as a stack of taped photos you page through:
                  locked-in ones by date first, then the ones still being decided.
                  Each photo has the group's faces peeking over it and a short
                  details block under the picture (stage, when, where, who, you).
     Your turn    every plan waiting on you, as a stack of sticky notes, each with
                  its own next step
     Quick create a name and a week, one click

   Both stacks draw only the card on top plus blank paper behind it, so thirty plans
   cost the same as three, and the page never turns into a wall of cards. Everything
   else lives one link away on Plans.

   Scrapbook touches (the photos, tape, sticker faces, sticky notes) are for this
   page's moments only. The arrows, the create form and every button stay flat.

   Anything the server cannot know (the greeting, today's date, which plans this
   browser holds) is filled in after mount, so the server-rendered HTML never
   disagrees with a visitor in another timezone. `useLiveEvents` re-reads the list
   whenever the cloud changes something. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarPlus, CalendarClock, Calendar, Check, CopyPlus, Link2, ArrowRight, MapPin, Video, UsersRound, UserRound,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Em } from '@/components/ui/Em'
import { coverFor } from '@/components/ui/StoredEventCard'
import { Cover } from '@/components/ui/Cover'
import { PeekCard, peopleIn } from '@/components/ui/PeekCard'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { StickyNote } from '@/components/ui/StickyNote'
import { SoftShapes } from '@/components/ui/SoftShapes'
import { WavyRule } from '@/components/ui/WavyRule'
import { Deck } from '@/components/ui/Deck'
import { namesLabel } from '@/components/ui/AvatarRow'
import { pushFlash } from '@/components/ui/FlashToast'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Tip } from '@/components/ui/Tip'
import { LifecycleLine } from '@/components/ui/LifecycleStrip'
import { placeVotes, chatLines } from '@/lib/polls'
import { fromDay,
  createEvent, eventTabFor, listEvents, phaseOf, daysUntil, dateRangeText, confirmedSlotText, sameDayLabelFor,
  leadingPlaceOf, youReplied, youVoted, bestWindow, availIvOf, gridStartMinOf, fmtMinute, seenMessageCount,
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

type Turn = { line: string; cta: string; href: string }
type Item = { e: AppEvent; phase: Phase }

/** The one thing you still owe this plan, if any: your times while it is being
    decided, a place vote when one is open, your reply once it is locked in. */
function turnOf(e: AppEvent, phase: Phase): Turn | null {
  const me = e.participants.find((p) => p.you)
  if (!me || e.demo) return null
  if (phase === 'planning') {
    if (!youReplied(e)) return { line: 'Mark when you’re free', cta: 'Mark my times', href: `/events/${e.id}?tab=availability` }
    if (e.location.mode === 'vote' && e.location.places.length > 0 && !youVoted(e)) return { line: 'Vote on a place', cta: 'Vote', href: `/events/${e.id}?tab=location` }
    return null
  }
  if (phase !== 'past' && me.rsvp === 'pending') return { line: 'Say if you’re coming', cta: 'Reply', href: `/events/${e.id}` }
  return null
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
  const [upAt, setUpAt] = useState(0)
  const [turnAt, setTurnAt] = useState(0)

  const active: Item[] = (events ?? []).map((e) => ({ e, phase: phaseOf(e) })).filter((x) => x.phase !== 'past')
  // up next: locked-in plans by day (same-day ties to the earlier start), then the
  // ones still being decided, by the host's lock-by date and then newest first
  const upNext = [
    ...active.filter((x) => x.phase !== 'planning')
      .sort((a, b) => dayOf(a.e).localeCompare(dayOf(b.e)) || (a.e.confirmed?.startMin ?? 0) - (b.e.confirmed?.startMin ?? 0)),
    ...active.filter((x) => x.phase === 'planning')
      .sort((a, b) => dayOf(a.e).localeCompare(dayOf(b.e)) || b.e.createdAt - a.e.createdAt),
  ]
  const sameDay = sameDayLabelFor(active.map((x) => x.e))
  // your turn: every plan waiting on you, in the same order
  const turns = upNext.map((x) => ({ x, t: turnOf(x.e, x.phase) })).filter((y): y is { x: Item; t: Turn } => y.t !== null)
  // a plan leaving the list (answered, deleted elsewhere) never strands the index
  const upI = Math.min(upAt, Math.max(0, upNext.length - 1))
  const turnI = Math.min(turnAt, Math.max(0, turns.length - 1))
  const hero = upNext[upI]
  const turn = turns[turnI]

  return (
    <div className="relative isolate mx-auto max-w-[1240px] px-6 pb-[92px] pt-7 sm:px-[26px] sm:pt-[34px]">
      <SoftShapes variant="home" />

      {/* greeting, then where the plan on screen stands, as a sentence */}
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
          <div className="h-[180px] w-[230px] animate-pulse rounded-xl bg-s2" />
        </div>
      ) : (
        <div className="mt-6 grid gap-x-14 gap-y-8 sm:mt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <section aria-labelledby="home-upnext" className="min-w-0">
            <h2 id="home-upnext" className="sr-only">Up next</h2>
            {hero ? (
              <div className="max-w-[480px]">
                <Deck
                  count={upNext.length} index={upI} onIndex={setUpAt} label="Up next"
                  behind={(d) => (
                    // blank frames under the photo on top, offset like a loose pile
                    <div
                      className="absolute inset-x-0 bottom-5 top-[42px] rounded-[14px] bg-frame shadow-frame"
                      style={{ transform: d === 1 ? 'translate(9px, 7px) rotate(1.5deg)' : 'translate(-6px, 12px) rotate(-2.5deg)' }}
                    />
                  )}
                  footer={<PlanActions key={hero.e.id} e={hero.e} phase={hero.phase} />}
                >
                  <UpNext e={hero.e} phase={hero.phase} sameDay={sameDay(hero.e)} />
                </Deck>
                {active.length > 1 && (
                  <Link href="/events" className="mt-1 inline-flex min-h-11 items-center text-[13.5px] font-semibold text-accent-text hover:underline sm:min-h-0 sm:py-1">
                    See all {active.length} plans
                  </Link>
                )}
              </div>
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
            {turn && (
              <>
                <WavyRule className="mb-7 lg:hidden" />
                <section aria-labelledby="home-turn">
                  <h2 id="home-turn" className="sr-only">Your turn</h2>
                  <Deck
                    count={turns.length} index={turnI} onIndex={setTurnAt} label="Plans waiting on you" itemLabel="note" className="w-[240px] max-w-full"
                    behind={(d) => (
                      <div
                        className="absolute inset-0 rounded-md bg-sticky shadow-sticky"
                        style={{ transform: d === 1 ? 'translate(8px, 6px) rotate(-2.5deg)' : 'translate(-5px, 11px) rotate(3deg)' }}
                      />
                    )}
                  >
                    <StickyNote kicker="Your turn" className="min-h-[150px]">
                      <span className="font-serif text-[19px] leading-[1.1] [overflow-wrap:anywhere]">{turn.x.e.title}</span>
                      <span className="text-[13px] leading-[1.4] text-sticky-dim">{turn.t.line}</span>
                      <Link href={turn.t.href} className="mt-auto flex h-11 items-center self-start rounded-full bg-accent px-4 text-[13.5px] font-semibold text-on-accent sm:h-9">
                        {turn.t.cta}
                      </Link>
                    </StickyNote>
                  </Deck>
                </section>
              </>
            )}
            {/* plan something in one line: name it, keep or nudge the week, create */}
            <div className={turn ? 'mt-9' : ''}>
              <h2 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[.13em] text-faint">Start a plan</h2>
              <QuickCreate />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// the headline: the plan on screen and where it stands, one italic word
function headline(e?: AppEvent, phase?: Phase): React.ReactNode {
  if (!e || !phase) return <>Nothing planned <Em>yet</Em>.</>
  if (phase === 'today') return <>{e.title} is <Em>today</Em>.</>
  if (phase === 'planning') return <>{e.title} is <Em>coming together</Em>.</>
  return <>{e.title} is <Em>happening</Em>.</>
}

const first = (name: string) => name.split(' ')[0]

/* Everything Home says about one plan, worked out once for the card on screen:
   one pass over the people however many there are, and the names of the people
   still to answer only when there are one to three of them. */
function digestOf(e: AppEvent, phase: Phase) {
  const locked = phase !== 'planning'
  const me = e.participants.find((p) => p.you)
  const total = e.participants.length
  // who has marked times (or said none work), for the planning stage
  const answered = new Set<string>(e.unavailableIds ?? [])
  if (!locked) {
    for (const day of Object.values(e.availIv ?? {})) for (const [id, iv] of Object.entries(day)) if (iv.length) answered.add(id)
    for (const rows of Object.values(e.avail)) for (const cell of rows) for (const id of cell) answered.add(id)
  }
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
            : 'You’ve marked your times'

  // extras, only when there is something to say
  const lines = chatLines(e.messages).length
  const unread = Math.max(0, lines - seenMessageCount(e.id))
  const spots = e.capacity ? Math.max(0, e.capacity - (locked ? going : 0)) : null
  return { locked, total, answered: answered.size, going, maybe, out, pending, waitingOn, stillOut, countdown, best, gridStart, lead, ballot, you, unread, spots }
}

// one line of the details block: a small icon, then a few words
function Row({ icon: Icon, children }: { icon: typeof Calendar; children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><Icon size={15} className="mt-[3px] flex-none text-dim" aria-hidden /><span className="min-w-0">{children}</span></li>
}

/* Up next, one plan: the cover as a taped photo, tilted a little, the faces of the
   people in peeking over its top edge, and a short details block under the picture.
   The main button sits on the frame's corner like a sticker; it is not tilted, so
   it is exactly where it looks. */
function UpNext({ e, phase, sameDay }: { e: AppEvent; phase: Phase; sameDay?: SameDayInfo }) {
  const [coverFrom, coverTo] = coverFor(e.id)
  const d = digestOf(e, phase)
  const turn = turnOf(e, phase)
  const action = turn ?? { cta: 'See the plan', href: eventTabFor(e) }
  const slot = confirmedSlotText(e)
  const who = d.locked
    ? [`${d.going} going`, d.maybe && `${d.maybe} maybe`, d.out && `${d.out} can’t make it`, d.pending && `${d.pending} ${d.pending === 1 ? 'hasn’t' : 'haven’t'} replied`].filter(Boolean).join(', ')
    : d.answered >= d.total ? 'Everyone has answered' : `${d.answered} of ${d.total} have answered`
  const extras = [
    d.unread > 0 && `${d.unread} new ${d.unread === 1 ? 'message' : 'messages'}`,
    d.locked && e.rsvpDeadline && `Reply by ${dateRangeText({ startDate: e.rsvpDeadline, endDate: e.rsvpDeadline }).replace(/, \d{4}$/, '')}`,
    !d.locked && e.planDeadline && `Deciding by ${dateRangeText({ startDate: e.planDeadline, endDate: e.planDeadline }).replace(/, \d{4}$/, '')}`,
    d.spots !== null && (d.spots === 0 ? 'No spots left' : `${d.spots} ${d.spots === 1 ? 'spot' : 'spots'} left`),
    e.budget && `Budget $${Number(e.budget).toLocaleString()}${e.budgetMode === 'person' ? ' each' : ''}`,
    !e.hostedByYou && `Hosted by ${e.hostName}`,
  ].filter(Boolean) as string[]
  return (
    <div className="relative pb-5 pr-1">
      <PeekCard people={peopleIn(e)} size={40} restShow={22} upShow={36} tilt={-1.5} flippable>
        <PhotoFrame tilt={-1.5} tape="corner">
          <Link href={eventTabFor(e)} tabIndex={-1} aria-label={e.title} className="block">
            <Cover src={e.image} fit={e.imageFit} pos={e.imagePos} from={coverFrom} to={coverTo} className="h-[118px] sm:h-[170px]" rounded="rounded-lg" />
          </Link>
          <div className="px-1 pb-8 pt-3">
            <LifecycleLine phase={phase} className="mb-2.5 text-[12.5px]" />
            <ul className="flex flex-col gap-1.5 text-[14px] leading-[1.45]">
              {/* when: the locked slot and how far off, or the best time so far */}
              {slot ? (
                <Row icon={Calendar}>{slot} <TimezonePill tz={e.timezone} />{d.countdown && <span className="text-dim">, {d.countdown}</span>}</Row>
              ) : d.best ? (
                <Row icon={Calendar}>
                  {d.best.dayLabel}, {fmtMinute(d.gridStart + d.best.s)} <TimezonePill tz={e.timezone} /> <span className="text-dim">suits {d.best.count} of {d.total} so far</span>
                </Row>
              ) : (
                <Row icon={Calendar}>Picking a time, {dateRangeText(e)}</Row>
              )}
              {/* where */}
              {e.location.mode === 'remote' ? (
                <Row icon={Video}>Online{e.location.platform ? ` on ${e.location.platform}` : ''}</Row>
              ) : d.lead?.confirmed ? (
                <Row icon={MapPin}>{d.lead.place.name}{d.lead.place.place && <span className="text-dim">, {d.lead.place.place}</span>}</Row>
              ) : d.lead ? (
                <Row icon={MapPin}>{d.lead.place.name} <span className="text-dim">leads with {d.lead.voters.length} {d.lead.voters.length === 1 ? 'vote' : 'votes'}</span></Row>
              ) : d.ballot > 0 ? (
                <Row icon={MapPin}>{d.ballot} {d.ballot === 1 ? 'place' : 'places'} up for a vote</Row>
              ) : (
                <Row icon={MapPin}><span className="text-dim">Place not picked yet</span></Row>
              )}
              {/* who, and by name when only a few are still out */}
              <Row icon={UsersRound}>
                {who}{d.stillOut >= 1 && d.stillOut <= 3 && d.waitingOn.length > 0 && <span className="text-dim">. Waiting on {namesLabel(d.waitingOn.slice(0, 3))}</span>}
              </Row>
              {d.you && <Row icon={UserRound}><span className={turn ? 'font-semibold text-moment-text' : ''}>{d.you}</span></Row>}
            </ul>
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
            {extras.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-dim">
                {extras.map((x, i) => (
                  <span key={x} className="flex items-center gap-2">
                    {i > 0 && <span className="h-3 w-px flex-none bg-border2" aria-hidden />}
                    {x.startsWith('Hosted by') ? <span className="font-serif text-[14px] italic">{x}</span> : x}
                  </span>
                ))}
              </div>
            )}
          </div>
        </PhotoFrame>
      </PeekCard>
      <Link
        href={action.href}
        className="absolute bottom-0 right-0 z-[2] flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent shadow-soft"
      >
        {action.cta} <ArrowRight size={15} />
      </Link>
    </div>
  )
}

/* sharing and duplicating the plan on screen: small round buttons beside the arrows */
function PlanActions({ e, phase }: { e: AppEvent; phase: Phase }) {
  const [copied, setCopied] = useState(false)
  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/events/${e.id}/join`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  const round = 'grid h-11 w-11 place-items-center rounded-full border sm:h-9 sm:w-9'
  return (
    <span className="ml-auto flex items-center gap-2">
      {e.hostedByYou && phase !== 'past' && (
        <button
          type="button" onClick={copyLink} aria-label={copied ? 'Link copied' : 'Copy the invite link'} title={copied ? 'Link copied' : 'Copy the invite link'}
          className={`${round} ${copied ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border2 bg-s1 text-text hover:bg-s2'}`}
        >
          {copied ? <Check size={16} /> : <Link2 size={16} />}
        </button>
      )}
      {!e.demo && (
        <Link href={`/create?from=${e.id}`} aria-label="Duplicate this plan" title="Duplicate this plan" className={`${round} border-border2 bg-s1 text-text hover:bg-s2`}>
          <CopyPlus size={16} />
        </Link>
      )}
    </span>
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
