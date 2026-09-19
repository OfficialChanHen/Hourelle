'use client'


/* ── home: what is next, and what you can do about it ──
   Three bands, in the order a host actually needs them:
     Up next     the closest locked-in plans, as a swipeable spotlight. With nothing
                 locked in, the newest plan being made stands in so it is never empty.
     Your events the ones you host
     You're invited  the ones you were asked to

   Hero events keep their card in the bands below. The spotlight is a shortcut, not
   a filing cabinet, and an invitation should always be findable where invitations
   live.

   Anything the server cannot know — the greeting, today's date, which events this
   browser holds — is filled in after mount, so the server-rendered HTML never
   disagrees with a visitor in another timezone. `useLiveEvents` re-reads the list
   whenever the cloud changes something. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, CalendarPlus, CalendarClock, Check, CopyPlus, Link2, ArrowRight } from 'lucide-react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, A11y } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { coverFor, StoredEventCard } from '@/components/ui/StoredEventCard'
import { Cover } from '@/components/ui/Cover'
import { pushFlash } from '@/components/ui/FlashToast'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Tip } from '@/components/ui/Tip'
import { LifecycleStrip, PHASE_BADGE, PHASE_TINT } from '@/components/ui/LifecycleStrip'
import { fromDay,
  createEvent, eventTabFor, listEvents, phaseOf, daysUntil, daysUntilLabel, dateRangeText, confirmedSlotText, sameDayLabelFor,
  type AppEvent, type Phase, type SameDayInfo,
} from '@/lib/events'
import { useLiveEvents } from '@/hooks/useLiveEvents'
import { useAccount } from '@/hooks/useAccount'

// what part of the day it is, by the reader's clock
function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const [events, setEvents] = useState<AppEvent[] | null>(null)
  // greeting settles after mount so the server-rendered HTML never disagrees
  // with a visitor in another timezone
  const [greeting, setGreeting] = useState('Good afternoon')
  // the greeting names whoever is signed in (the stub, when nobody is)
  const account = useAccount()
  const firstName = account.name.split(' ')[0]
  useEffect(() => {
    setEvents(listEvents())
    setGreeting(greetingFor(new Date().getHours()))
  }, [])
  // someone else's change arrived from the cloud: re-read so the page follows it live
  useLiveEvents(() => setEvents(listEvents()))

  const withPhase = (events ?? []).map((e) => ({ e, phase: phaseOf(e) }))
  const active = withPhase.filter((x) => x.phase !== 'past')

  // up next: the closest confirmed plans, nearest day first and same-day ties to the
  // earlier start — up to five slides. With nothing confirmed, the newest planning
  // event stands in so the spot never sits empty.
  const upNext = active
    .filter((x) => x.phase === 'today' || x.phase === 'soon' || x.phase === 'upcoming')
    .sort((a, b) =>
      ((daysUntil(a.e.confirmed?.dayKey ?? a.e.startDate) ?? 0) - (daysUntil(b.e.confirmed?.dayKey ?? b.e.startDate) ?? 0)) ||
      ((a.e.confirmed?.startMin ?? 0) - (b.e.confirmed?.startMin ?? 0)))
    .slice(0, 5)
  const heroes = upNext.length > 0 ? upNext : active.filter((x) => x.phase === 'planning').slice(0, 1)
  // hero events keep their card below too — Up next is a spotlight, not a filing
  // cabinet, and an invited event should always be findable under You're invited
  const yours = active.filter((x) => x.e.hostedByYou)
  const invited = active.filter((x) => !x.e.hostedByYou)
  const sameDay = sameDayLabelFor(active.map((x) => x.e))

  return (
    <div className="relative mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      {/* greeting */}
      <div className="mb-5">
        <h1 className="mb-[9px] font-serif font-normal text-[37px] leading-[1.02] tracking-[-0.01em]" suppressHydrationWarning>{greeting}, {firstName}</h1>
        <div className="flex items-center gap-1.5 text-[13.5px] text-dim">
          <Calendar size={15} /> {active.length > 0 ? `${active.length} event${active.length === 1 ? '' : 's'} in motion` : 'No events yet'}
        </div>
      </div>

      {/* plan something in one line: name it, keep or nudge the week, create */}
      <QuickCreate />

      {/* Up next — the closest confirmed plans, one card at a time */}
      {/* localStorage only exists after mount — pulse shapes, never a flash of "empty" */}
      {events === null && (
        <>
          <SectionHeader color="var(--accent-text)" title="Up next" />
          <div className="h-[240px] animate-pulse rounded-2xl bg-s2" />
          <div className="mt-[26px] grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-[220px] animate-pulse rounded-[13px] bg-s2" />
            ))}
          </div>
        </>
      )}

      {events !== null && (
      <>
      {/* accent: the spotlight — what's asking for you now */}
      <SectionHeader color="var(--accent-text)" title="Up next" count={heroes.length > 1 ? heroes.length : undefined} />
      {heroes.length > 1 ? (
        <Swiper modules={[Navigation, Pagination, A11y]} slidesPerView={1} spaceBetween={18} navigation pagination={{ clickable: true }} className="upnext-swiper !pb-9">
          {/* !h-auto lets the flex wrapper stretch every slide to the tallest one,
              and the card fills it — otherwise each slide sizes to its own content */}
          {heroes.map((x) => (
            <SwiperSlide key={x.e.id} className="!h-auto">
              <HeroCard e={x.e} phase={x.phase} sameDay={sameDay(x.e)} />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : heroes.length === 1 ? (
        <HeroCard e={heroes[0].e} phase={heroes[0].phase} sameDay={sameDay(heroes[0].e)} />
      ) : (
        <EmptyState
          icon={CalendarPlus}
          title="Nothing going on yet"
          body="Create an event and it takes over this spot."
          action={{ label: 'Create an event', href: '/create' }}
          secondary={{ label: 'Or poke around the demo events', href: '/demos' }}
        />
      )}

      {/* Your events — everything you host that isn't over */}
      {yours.length > 0 && (
        <>
          {/* teal: plans you're running */}
          <SectionHeader color="var(--teal-text)" title="Your events" count={yours.length} className="mt-[26px]" />
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {yours.map((x) => <StoredEventCard key={x.e.id} e={x.e} sameDay={sameDay(x.e)} />)}
          </div>
        </>
      )}

      {/* You're invited — events someone else is hosting */}
      {invited.length > 0 && (
        <>
          {/* ochre: asks from other people, waiting on your answer */}
          <SectionHeader color="var(--ochre-text)" title="You're invited" count={invited.length} className="mt-[26px]" />
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {invited.map((x) => <StoredEventCard key={x.e.id} e={x.e} sameDay={sameDay(x.e)} />)}
          </div>
        </>
      )}
      </>
      )}
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
    pushFlash('Your event is live. Share the link so people can join.')
    router.push(`/events/${ev.id}`)
  }
  const dateCls = 'h-11 sm:h-10 rounded-[10px] border border-border bg-s2 px-2.5 text-[13.5px] outline-none focus:border-accent-border'
  return (
    <div className="mb-6 rounded-2xl border border-border bg-s1 p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setNeed(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') go() }}
          placeholder="What are you planning?"
          className={`h-11 sm:h-10 min-w-[200px] flex-1 rounded-[10px] border ${need ? 'border-brick-border' : 'border-border'} bg-s2 px-[13px] text-[14.5px] outline-none placeholder:text-faint focus:border-accent-border`}
        />
        <div className="flex flex-none items-center gap-2">
          <input type="date" value={start} min={today || undefined} aria-label="Earliest day" className={dateCls}
            onChange={(e) => { const v = fromDay(e.target.value, today); setStart(v); if (end < v) setEnd(v) }} />
          <span className="text-faint">→</span>
          <input type="date" value={end} min={start || undefined} aria-label="Latest day" className={dateCls} onChange={(e) => setEnd(fromDay(e.target.value, start))} />
        </div>
        <button onClick={go} className="flex h-11 sm:h-10 flex-none items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent">
          <CalendarPlus size={16} /> Create
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px] text-dim">
        <span>
          {need
            ? <span className="font-medium text-brick-text">Give it a name first.</span>
            : asDayPoll
              ? 'Over four weeks, so this asks which days work instead of times.'
              : 'Uses your time zone. Share the link and people mark when they are free.'}
        </span>
        {/* the wizard opens with what was typed here, so nothing is typed twice */}
        <Link
          href={`/create${(() => { const q = new URLSearchParams(); if (title.trim()) q.set('title', title.trim()); if (start) q.set('start', start); if (end) q.set('end', end); const s = q.toString(); return s ? `?${s}` : '' })()}`}
          className="-my-2 py-2 font-semibold text-accent-text hover:underline"
        >
          More options
        </Link>
      </div>
    </div>
  )
}

/* the hero: wide card with the lifecycle strip and one contextual action.
   The whole card opens the event's details; only elements with their own job don't. */
function HeroCard({ e, phase, sameDay }: { e: AppEvent; phase: Phase; sameDay?: SameDayInfo }) {
  const router = useRouter()
  const badge = PHASE_BADGE[phase]
  const tint = PHASE_TINT[phase]
  // same fallback gradient as the section cards, so the hero wears the same cover
  const [coverFrom, coverTo] = coverFor(e.id)
  const dest = eventTabFor(e)
  const du = daysUntil(e.confirmed?.dayKey ?? e.startDate)
  const [copied, setCopied] = useState(false)
  const action = phase === 'planning'
    ? { label: 'Add your availability', href: `/events/${e.id}?tab=availability` }
    : { label: 'See the plan', href: `/events/${e.id}` }
  function copyLink(ev: React.MouseEvent) {
    ev.stopPropagation()
    navigator.clipboard?.writeText(`${window.location.origin}/events/${e.id}/join`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  // a photo of the host's own runs behind the whole hero, and the text sits on a
  // paper panel over it: the picture gets the card, the words keep their contrast
  const photo = !!e.image?.startsWith('data:')
  return (
    <div
      onClick={() => router.push(dest)}
      className={`relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-s1 transition-colors hover:border-border2 ${photo ? 'justify-end' : ''}`}
      style={tint.border ? { borderColor: tint.border } : undefined}
    >
      {/* the cover soaks up any height difference between carousel siblings, so the
          text block reads the same on every slide */}
      {photo
        ? <div className="absolute inset-0"><Cover src={e.image} fit={e.imageFit} from={coverFrom} to={coverTo} className="h-full w-full" /></div>
        : <Cover src={e.image} fit={e.imageFit} from={coverFrom} to={coverTo} className={`flex-1 ${e.image ? 'min-h-[110px]' : 'min-h-[64px]'}`} />}
      <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 p-5 ${photo ? 'relative m-3 mt-[170px] rounded-xl border border-border bg-s1/[.94] shadow-soft backdrop-blur-sm sm:mt-[210px]' : ''}`}>
        {/* real min width: on phones the CTAs wrap below instead of crushing the title */}
        <div className="min-w-[220px] flex-1">
          {/* one quiet line instead of a chip row: dot for the phase, words for the rest */}
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-medium text-dim">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: tint.dot }} />
              {badge.label}
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
                <span>Hosted by {e.hostName}</span>
              </>
            )}
            {e.participants.some((p) => p.you && p.rsvp === 'pending') && (
              <>
                <span className="h-3 w-px flex-none bg-border2" aria-hidden />
                <span className="text-accent-text">your reply is waiting</span>
              </>
            )}
            {/* the host's side of the RSVP round: how many answers are still out */}
            {(() => {
              const n = e.hostedByYou && phase !== 'planning' && phase !== 'past'
                ? e.participants.filter((p) => p.rsvp === 'pending').length
                : 0
              return n > 0 && (
                <>
                  <span className="h-3 w-px flex-none bg-border2" aria-hidden />
                  <span>waiting on {n} {n === 1 ? 'reply' : 'replies'}</span>
                </>
              )
            })()}
          </div>
          <Link href={dest} onClick={(ev) => ev.stopPropagation()} className="block font-serif text-[27px] leading-[1.08] tracking-[-0.01em] hover:underline">{e.title}</Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-dim">
            <Calendar size={14} /> {confirmedSlotText(e) ?? dateRangeText(e)} <TimezonePill tz={e.timezone} />
          </div>
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
          <LifecycleStrip phase={phase} className="mt-4 max-w-[380px]" />
        </div>
        <div className="flex w-full flex-none flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:items-center">
          <Link href={action.href} onClick={(ev) => ev.stopPropagation()} className="flex h-11 sm:h-10 w-full flex-none items-center justify-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent sm:w-auto">
            {action.label} <ArrowRight size={15} />
          </Link>
          {e.hostedByYou && (
            <button
              type="button" onClick={copyLink}
              className={`flex h-11 sm:h-10 w-full flex-none items-center justify-center gap-1.5 rounded-[10px] border px-4 text-[14px] font-semibold sm:w-auto ${copied ? 'border-accent-border bg-accent-bg text-accent-text' : 'border-border2 bg-s1 text-text hover:bg-s2'}`}
            >
              {copied ? <><Check size={15} /> Link copied</> : <><Link2 size={15} /> Share link</>}
            </button>
          )}
          {!e.demo && (
            <Link
              href={`/create?from=${e.id}`} onClick={(ev) => ev.stopPropagation()} title="Duplicate this event"
              className="flex h-11 sm:h-10 w-full flex-none items-center justify-center gap-1.5 rounded-[10px] border border-border2 bg-s1 px-4 text-[14px] font-semibold text-text hover:bg-s2 sm:w-auto"
            >
              <CopyPlus size={15} /> Duplicate
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// editorial section start: a color-coded eyebrow — the kicker itself carries the
// section's hue, no icons and no extra marks (the cards already speak in dots)
function SectionHeader({ title, count, color, className = '' }: { title: string; count?: number; color?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className} mb-[12px]`}>
      <div className="flex items-center gap-2.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[.13em]" style={{ color: color ?? 'var(--faint)' }}>{title}</span>
        {count != null && <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[11.5px] text-dim">{count}</span>}
      </div>
    </div>
  )
}
