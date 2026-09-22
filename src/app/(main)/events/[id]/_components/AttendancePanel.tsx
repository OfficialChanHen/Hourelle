'use client'


/* ── the Attendance tab: who is actually coming, and when ──
   Two models behind one toggle, because a day out and a day in a room are different
   questions:
     single  one venue. Who is in the room, and for how much of it.
     itin    a route. Where the headcount peaks and dips across the stops.

   Everything is read against a WINDOW: the locked-in slot once the host has
   confirmed, and the best free window while the plan is still open. `coverOf` sorts
   each person into full, partial, none or nodata against that window, and every
   count, bar and group on the tab is built from those four.

   The tab is built to summarise rather than enumerate, because the guest list is
   allowed to be long: people are shown as groups and counts, individual rows are
   reserved for the exceptions, and avatar piles cap with a "+N". Nothing here
   renders a row per person per stop.

   Only the RSVP, the quorum and the itinerary's own settings are editable, and as
   on the other tabs those go to local state first so the demos work in memory. */

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { CalendarRange, Check, ChevronRight, Clock, Copy, Info, MapPin, Search, TriangleAlert, Users, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Popover, PopoverNote, PopoverTitle } from '@/components/ui/Popover'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TimezonePill, tzAbbr } from '@/components/ui/TimezonePill'
import {
  availIvOf, bestWindow, byYouFirst, confirmedSlotText, dayLabel, gridStartMinOf, fmtMinute, fmtMinuteDay, leadingPlaceOf, patchEvent, setMyRsvp, stepOf,
  type AppEvent, type AvailIntervals, type BestMode, type GridDay, type Iv, type Participant, type Rsvp,
} from '@/lib/events'
import { computeItinerary } from '@/lib/itinerary'
import { isAllDay } from '@/lib/slot'
import { coordsOf, type LatLng } from '@/lib/geo'
import { useRoute } from '@/hooks/useRoute'
import { useFollow } from '@/hooks/useFollow'
import { ALL_MODES, type TravelMode } from '@/lib/travel'

type GoTab = (t: 'availability' | 'location') => void
// the window this tab reads attendance against: the confirmed time once locked, else the best free window
type Win = { s: number; e: number; dayKey: string; dayLabel: string }

type Cover = 'full' | 'partial' | 'none' | 'nodata'
// how fully a person's free time covers a [s, e) window (grid minutes)
function coverOf(ivs: Iv[] | undefined, s: number, e: number): Cover {
  if (e <= s) return 'nodata'
  if (!ivs || ivs.length === 0) return 'nodata'
  if (ivs.some((iv) => iv.s <= s && iv.e >= e)) return 'full'
  if (ivs.some((iv) => iv.s < e && iv.e > s)) return 'partial'
  return 'none'
}
// the spans a person is actually around inside a window — kept as separate segments,
// so free-at-the-start plus free-at-the-end never reads as one solid block
function segmentsOf(ivs: Iv[] | undefined, s: number, e: number): Iv[] {
  return (ivs ?? []).map((iv) => ({ s: Math.max(iv.s, s), e: Math.min(iv.e, e) })).filter((iv) => iv.e > iv.s)
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function fmtDeadline(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DOW[dt.getDay()]}, ${dayLabel(dt)}`
}

export function AttendancePanel({ event, onGoToTab, onViewAvailability, onViewAvailabilityGroup, onGoToBestWindow }: { event: AppEvent; onGoToTab?: GoTab; onViewAvailability?: (pid: string) => void; onViewAvailabilityGroup?: (pids: string[]) => void; onGoToBestWindow?: () => void }) {
  const hasItinerary = (event.itinStops?.length ?? 0) > 0
  const [model, setModel] = useState<'single' | 'itin'>(hasItinerary ? 'itin' : 'single')

  // RSVP and quorum are editable on this tab — local state first so the demo event
  // works in memory, persisted for real events (same pattern as the Location tab)
  const [participants, setParticipants] = useState(event.participants)
  const [quorum, setQuorum] = useState<number | null>(event.quorum ?? null)
  useFollow(event.quorum ?? null, setQuorum)
  // the event re-loads while this tab is open (confirm / reopen in the header) — adopt the
  // fresh participant list during render instead of via an effect
  const [seenParticipants, setSeenParticipants] = useState(event.participants)
  if (seenParticipants !== event.participants) {
    setSeenParticipants(event.participants)
    setParticipants(event.participants)
  }

  // spot limit: going is first come, first served
  const goingCount = participants.filter((p) => p.rsvp === 'attending').length
  const full = event.capacity != null && goingCount >= event.capacity

  function persist(patch: Partial<AppEvent>) { if (!event.demo) patchEvent(event.id, patch) }
  function changeRsvp(r: Rsvp) {
    if (r === 'attending' && full) return // no sneaking past a disabled button
    setParticipants((ps) => ps.map((p) => (p.you ? { ...p, rsvp: r, rsvpAuto: undefined } : p)))
    if (!event.demo) setMyRsvp(event.id, r)
  }
  function changeQuorum(q: number | null) {
    setQuorum(q)
    persist({ quorum: q ?? undefined })
  }

  const availIv = availIvOf(event)
  const gridStart = gridStartMinOf(event)
  const step = stepOf(event.granularity)
  const rows = event.times.length
  const locked = event.status === 'confirmed' && !!event.confirmed
  const best = bestWindow(availIv, event.days, event.durationMin ?? 60, event.bestMode)

  const win: Win | null = useMemo(() => {
    if (locked) {
      const c = event.confirmed!
      const d = event.days.find((x) => x.key === c.dayKey)
      // a run of days is counted by day (runDays below); its window is the first day whole
      return c.endDayKey
        ? { s: 0, e: 24 * 60 - gridStart, dayKey: c.dayKey, dayLabel: d ? `${d.dow}, ${d.date}` : c.dayKey }
        : { s: c.startMin - gridStart, e: c.endMin - gridStart, dayKey: c.dayKey, dayLabel: d ? `${d.dow}, ${d.date}` : c.dayKey }
    }
    return best ? { s: best.s, e: best.e, dayKey: best.dayKey, dayLabel: best.dayLabel } : null
  }, [locked, event.confirmed, event.days, gridStart, best])
  const dayIv = (win?.dayKey && availIv[win.dayKey]) || {}

  const attendees = participants.filter((p) => p.rsvp === 'attending' || p.rsvp === 'maybe')
  const anyResponded = participants.some((p) => p.rsvp !== 'pending')
  const me = participants.find((p) => p.you)

  // who has marked ANY availability on any day — "no times yet" means never, not
  // "not free on this particular day"
  const markedIds = new Set<string>()
  for (const day of Object.values(availIv)) for (const [id, ivs] of Object.entries(day)) if (ivs.length) markedIds.add(id)
  // who declared "none of these days work" — an explicit empty reply, not silence
  const unavailSet = useMemo(() => new Set(event.unavailableIds ?? []), [event.unavailableIds])

  // the planning-stage headline: people actually free (fully or partly) inside the
  // best window right now — not RSVPs, which haven't been asked yet
  const availableNow = win
    ? participants.filter((p) => {
        if (p.rsvp === 'not_going' || unavailSet.has(p.id)) return false
        const c = coverOf(dayIv[p.id], win.s, win.e)
        return c === 'full' || c === 'partial'
      }).length
    : 0
  // planning caption counts mirror the roster groups exactly — declines plus declared
  // "none work" on one side, everyone silent on the other
  const outCount = participants.filter((p) => p.rsvp === 'not_going' || (!locked && unavailSet.has(p.id) && !markedIds.has(p.id))).length
  const noTimesCount = locked ? 0 : participants.filter((p) => p.rsvp !== 'not_going' && !markedIds.has(p.id) && !unavailSet.has(p.id)).length

  // a locked run of days answers by day, not by clock: which days of the run each
  // person can make. ISO keys compare as strings, so the filter is a plain range.
  const runDays = useMemo(() => {
    const c = event.confirmed
    if (!locked || !c?.endDayKey) return null
    return event.days.filter((d) => d.key >= c.dayKey && d.key <= c.endDayKey!)
  }, [locked, event.confirmed, event.days])

  // event with the live participant list, so child views read the same list this tab edits
  const liveEvent = useMemo(() => ({ ...event, participants }), [event, participants])

  return (
    <div className="flex flex-col gap-4">
      {/* "are you coming" is a locked-stage question; while planning, the ask is your times */}
      {locked
        ? me?.rsvp === 'pending' && <YourRsvpStrip onPick={changeRsvp} full={full} />
        : !!me && !markedIds.has(me.id) && !unavailSet.has(me.id) && <YourTimesStrip onGo={() => onGoToTab?.('availability')} />}

      {/* header — friendly summary, share button, and (only when relevant) the model switch */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <RsvpSummary participants={participants} capacity={event.capacity} locked={locked} available={availableNow} planningOut={outCount} planningNoTimes={noTimesCount} />
        <div className="flex flex-wrap items-center gap-2">
          <CopySummaryButton event={liveEvent} win={win} locked={locked} gridStart={gridStart} dayIv={dayIv} markedIds={markedIds} />
          {hasItinerary && (
            <SegmentedControl
              size="sm"
              value={model}
              onChange={(v) => setModel(v as 'single' | 'itin')}
              options={[{ v: 'single', l: 'Single venue' }, { v: 'itin', l: 'Itinerary' }]}
            />
          )}
        </div>
      </div>

      {runDays && runDays.length > 1 && (
        <DayRunAttendance days={runDays} participants={participants} availIv={availIv} onPerson={onViewAvailability} />
      )}

      {!anyResponded ? (
        <EmptyState onGoToTab={onGoToTab} />
      ) : model === 'itin' && hasItinerary ? (
        <ItineraryAttendance event={liveEvent} attendees={locked ? attendees : participants.filter((p) => p.rsvp !== 'not_going' && !(unavailSet.has(p.id) && !markedIds.has(p.id)))} dayIv={dayIv} gridStart={gridStart} onPerson={onViewAvailability} />
      ) : (
        <SingleVenue
          event={liveEvent} attendees={attendees} win={win} locked={locked} dayIv={dayIv}
          gridStart={gridStart} step={step} rows={rows}
          quorum={quorum} onQuorum={event.hostedByYou ? changeQuorum : undefined}
          onGoToTab={onGoToTab} onPerson={onViewAvailability} onViewGroup={onViewAvailabilityGroup} markedIds={markedIds} unavailSet={unavailSet} onGoToBestWindow={onGoToBestWindow}
        />
      )}
    </div>
  )
}

/* ── day-by-day attendance for a locked run of days ──
   One row per day (bar + count), then exceptions only: people who can make some
   days but not all get a row with the days they miss — never a person × day matrix. */
function DayRunAttendance({ days, participants, availIv, onPerson }: {
  days: GridDay[]; participants: Participant[]; availIv: AvailIntervals
  onPerson?: (pid: string) => void
}) {
  const ppl = participants.filter((p) => p.rsvp !== 'not_going')
  const covered = (id: string, k: string) => (availIv[k]?.[id] ?? []).length > 0
  const perDay = days.map((d) => ({ d, n: ppl.filter((p) => covered(p.id, d.key)).length }))
  const everyDay = ppl.filter((p) => days.every((d) => covered(p.id, d.key)))
  const someDays = ppl.filter((p) => !days.every((d) => covered(p.id, d.key)) && days.some((d) => covered(p.id, d.key)))
  const noDays = ppl.length - everyDay.length - someDays.length

  return (
    <div className="rounded-2xl border border-border bg-s1 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Day by day</span>
        <span className="text-[12.5px] text-dim">{everyDay.length} of {ppl.length} can make every day</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {perDay.map(({ d, n }) => (
          <div key={d.key} className="flex items-center gap-2.5">
            <span className="w-[86px] flex-none text-[12.5px] font-medium">{d.dow}, {d.date}</span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-s2">
              <span className="block h-full rounded-full" style={{ width: `${ppl.length ? (n / ppl.length) * 100 : 0}%`, background: 'var(--teal)' }} />
            </span>
            <span className="w-[52px] flex-none text-right text-[12.5px] tabular-nums text-dim">{n} of {ppl.length}</span>
          </div>
        ))}
      </div>
      {(someDays.length > 0 || noDays > 0) && (
        <div className="mt-3.5 flex flex-col gap-1.5 border-t border-border pt-3">
          {someDays.map((p) => (
            <button key={p.id} type="button" onClick={() => onPerson?.(p.id)} title="See their days on the grid" className="flex flex-wrap items-center gap-1.5 rounded-[8px] px-1 py-0.5 text-left hover:bg-s2">
              <Avatar initials={p.initials} color={p.color} size={20} font={8.5} />
              <span className="text-[13px] font-medium">{p.name}</span>
              <span className="text-[12.5px] text-dim">misses</span>
              {days.filter((d) => !covered(p.id, d.key)).map((d) => (
                <span key={d.key} className="rounded-[5px] border border-ochre-border bg-ochre-bg px-[5px] py-px text-[10.5px] font-semibold text-ochre-text">{d.dow} {d.date}</span>
              ))}
            </button>
          ))}
          {noDays > 0 && (
            <span className="px-1 text-[12.5px] text-dim">{noDays} {noDays === 1 ? 'person hasn’t' : 'people haven’t'} marked any of these days.</span>
          )}
        </div>
      )}
    </div>
  )
}

/* while planning, the useful nudge is the grid, not an RSVP */
function YourTimesStrip({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-accent-border bg-accent-bg px-4 py-3">
      <span className="text-[14px] font-semibold text-accent-text">You haven&apos;t marked your times yet.</span>
      <span className="text-[13px] text-dim">The best window can&apos;t count you until you do.</span>
      <button onClick={onGo} className="ml-auto h-8 rounded-[8px] bg-accent px-3 text-[13px] font-semibold text-on-accent">
        Add your availability
      </button>
    </div>
  )
}

/* ── your own reply, right where the counts are ── */
function YourRsvpStrip({ onPick, full }: { onPick: (r: Rsvp) => void; full: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-accent-border bg-accent-bg px-4 py-3">
      <span className="text-[14px] font-semibold text-accent-text">You haven&apos;t replied yet.</span>
      <span className="text-[13px] text-dim">{full ? 'The event is full, spots went to whoever replied first.' : 'Are you coming?'}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => onPick('attending')} disabled={full}
          title={full ? 'All spots are taken' : undefined}
          className="h-11 rounded-[8px] bg-accent px-3.5 text-[13px] font-semibold text-on-accent disabled:opacity-40 sm:h-8 sm:px-3"
        >
          Going
        </button>
        <button onClick={() => onPick('maybe')} className="h-11 rounded-[8px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold text-dim hover:bg-s2 sm:h-8 sm:px-3">Maybe</button>
        <button onClick={() => onPick('not_going')} className="h-11 rounded-[8px] border border-border2 bg-s1 px-3.5 text-[13px] font-semibold text-dim hover:bg-s2 sm:h-8 sm:px-3">Can&apos;t go</button>
      </div>
    </div>
  )
}

/* ── shared: RSVP figure (borderless, open stats). One sentence, not a number soup:
   the big figure is going, the caption walks through everyone else. ── */
function RsvpSummary({ participants, capacity, locked, available, planningOut, planningNoTimes }: {
  participants: Participant[]; capacity?: number; locked: boolean; available: number; planningOut: number; planningNoTimes: number
}) {
  const going = participants.filter((p) => p.rsvp === 'attending').length
  const maybe = participants.filter((p) => p.rsvp === 'maybe').length
  const out = participants.filter((p) => p.rsvp === 'not_going').length
  const noReply = participants.filter((p) => p.rsvp === 'pending').length
  const total = participants.length
  const full = capacity != null && going >= capacity
  const rest: React.ReactNode[] = []
  if (locked) {
    if (maybe > 0) rest.push(<span key="m" className="text-ochre-text">{maybe} maybe</span>)
    if (out > 0) rest.push(<span key="o" className="text-brick-text">{out} can&apos;t</span>)
    if (noReply > 0) rest.push(<span key="n" className="text-faint">{noReply} no reply</span>)
  } else {
    // planning caption uses the same numbers as the roster groups below
    if (planningOut > 0) rest.push(<span key="o" className="text-brick-text">{planningOut} can&apos;t</span>)
    if (planningNoTimes > 0) rest.push(<span key="n" className="text-faint">{planningNoTimes} no times yet</span>)
  }
  return (
    <div>
      <div className="flex items-baseline gap-2">
        {/* planning counts people actually free in the best window; going is RSVP-real only once locked */}
        <span className="font-serif font-normal text-[42.5px] leading-none">{locked ? going : available}</span>
        <span className="text-[14.5px] text-dim">{locked ? 'going' : 'available'}</span>
        {/* spots are claimed by RSVPs, which only exist once the plan is locked —
            during planning the pill would count replies nobody has given yet */}
        {locked && capacity != null && (
          <span className={`rounded-[6px] border px-1.5 py-px text-[11px] font-semibold ${full ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-teal-border bg-teal-bg text-teal-text'}`}>
            {full ? `full, ${capacity} spots` : `${capacity - going} of ${capacity} spots left`}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-dim">
        <span>{total} invited</span>
        {rest.map((r, i) => <span key={i} className="flex items-center gap-1.5"><span className="h-3 w-px flex-none bg-border2" aria-hidden />{r}</span>)}
      </div>
    </div>
  )
}

/* one tap, and the group chat has the plan. Written the way a good organiser would
   write it by hand: what and when on their own lines, the count as a sentence, the
   place, who is still missing by name, and the link that lets them fix that. A line
   is left out rather than filled with a placeholder when there is nothing to say. */
function firstNames(ps: Participant[], cap = 5): string {
  const names = ps.slice(0, cap).map((p) => p.name.split(' ')[0])
  const more = ps.length - names.length
  if (more > 0) return `${names.join(', ')} and ${more} more`
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? ''
}
function summaryOf(event: AppEvent, win: Win | null, locked: boolean, gridStart: number, dayIv: Record<string, Iv[]>, markedIds: Set<string>): string {
  const ps = event.participants
  const link = `${window.location.origin}/events/${event.id}${locked ? '' : '/join'}`
  const lines: string[] = []
  const lead = leadingPlaceOf(event)
  const where = event.location.mode === 'remote'
    ? `Online${event.location.platform ? `, on ${event.location.platform}` : ''}`
    : lead ? `${lead.place.name}${lead.place.place ? `, ${lead.place.place}` : ''}` : ''

  if (locked && event.confirmed) {
    const slot = confirmedSlotText(event) ?? ''
    lines.push(`${event.title} is on.`, isAllDay(event.confirmed) ? slot : `${slot} ${tzAbbr(event.timezone)}`)
    if (where) lines.push(where)
    const going = ps.filter((p) => p.rsvp === 'attending').length
    const maybe = ps.filter((p) => p.rsvp === 'maybe').length
    lines.push('', `${going} going${maybe ? `, ${maybe} maybe` : ''}.`)
    const waiting = ps.filter((p) => p.rsvp === 'pending').sort(byYouFirst)
    if (waiting.length) lines.push(`Still to reply: ${firstNames(waiting)}.`)
    lines.push('', `Details and RSVP: ${link}`)
  } else {
    lines.push(event.title)
    if (win) lines.push(`Best time so far: ${win.dayLabel}, ${fmtMinute(gridStart + win.s)} – ${fmtMinute(gridStart + win.e)} ${tzAbbr(event.timezone)}`)
    if (where) lines.push(event.location.mode === 'remote' || lead?.confirmed ? where : `Leading place: ${where}`)
    const open = ps.filter((p) => p.rsvp !== 'not_going' && !(event.unavailableIds ?? []).includes(p.id))
    if (win) {
      const can = open.filter((p) => { const c = coverOf(dayIv[p.id], win.s, win.e); return c === 'full' || c === 'partial' })
      const whole = can.filter((p) => coverOf(dayIv[p.id], win.s, win.e) === 'full').length
      lines.push('', `${can.length} of ${ps.length} can make it${whole < can.length ? `, ${whole} for the whole time` : ''}.`)
    }
    const silent = open.filter((p) => !markedIds.has(p.id)).sort(byYouFirst)
    if (silent.length) lines.push(`Still need times from ${firstNames(silent)}.`)
    lines.push('', `Add yours: ${link}`)
  }
  return lines.join('\n')
}
function CopySummaryButton({ event, win, locked, gridStart, dayIv, markedIds }: { event: AppEvent; win: Win | null; locked: boolean; gridStart: number; dayIv: Record<string, Iv[]>; markedIds: Set<string> }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(summaryOf(event, win, locked, gridStart, dayIv, markedIds)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <button onClick={copy} className={`flex h-11 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold sm:h-9 ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 hover:bg-s2'}`}>
      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy summary</>}
    </button>
  )
}

/* ── Single venue: where it's happening, who's in the room, and when ── */
function SingleVenue({
  event, attendees, win, locked, dayIv, gridStart, step, rows, quorum, onQuorum, onGoToTab, onPerson, onViewGroup, markedIds, unavailSet, onGoToBestWindow,
}: {
  event: AppEvent; attendees: Participant[]; win: Win | null; locked: boolean
  dayIv: Record<string, Iv[]>; gridStart: number; step: number; rows: number
  quorum: number | null; onQuorum?: (q: number | null) => void
  onGoToTab?: GoTab; onPerson?: (pid: string) => void; onViewGroup?: (pids: string[]) => void; onGoToBestWindow?: () => void
  markedIds: Set<string>
  unavailSet: Set<string>
}) {
  const winS = win?.s ?? 0
  const winE = win?.e ?? rows * step
  // which roster group to show; everyone by default
  const [showGroup, setShowGroup] = useState<'all' | 'whole' | 'part' | 'noTimes' | 'maybe' | 'out' | 'noReply'>('all')
  // a long guest list gets a name filter; it narrows every group at once
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const hit = (p: Participant) => !q || p.name.toLowerCase().includes(q)

  // group attendees by how their availability lines up with the event window — RSVP leads,
  // availability splits "going" into whole-time, part-time, and honest silence: someone who
  // never marked times is NOT assumed present the whole time.
  const groups = useMemo(() => {
    const whole: Participant[] = [], part: { p: Participant; segs: Iv[] | null }[] = []
    const noTimes: Participant[] = [], maybe: Participant[] = [], out: Participant[] = [], noReply: Participant[] = []
    for (const p of event.participants) {
      if (p.rsvp === 'not_going') { out.push(p); continue }
      // a declared "none of these days work" is a decline in planning terms
      if (!locked && unavailSet.has(p.id) && !markedIds.has(p.id)) { out.push(p); continue }
      // RSVP states only mean something once a time is locked. While planning, the grid
      // is the reply: anyone not declined reads by their availability, and "no reply"
      // merges into "no times yet" — they're the same wait.
      if (locked && p.rsvp === 'pending') { noReply.push(p); continue }
      if (locked && p.rsvp === 'maybe') { maybe.push(p); continue }
      if (!locked && p.rsvp === 'pending' && !markedIds.has(p.id)) { noTimes.push(p); continue }
      const cover = win ? coverOf(dayIv[p.id], winS, winE) : 'nodata'
      if (cover === 'nodata') {
        // marked times somewhere, just none in this window → a conflict, not silence
        if (markedIds.has(p.id)) part.push({ p, segs: null })
        else noTimes.push(p)
      } else if (cover === 'partial' || cover === 'none') {
        const segs = segmentsOf(dayIv[p.id], winS, winE)
        part.push({ p, segs: segs.length ? segs : null })
      } else whole.push(p)
    }
    // every group reads the same way: you first, then first name, then last name
    part.sort((a, b) => byYouFirst(a.p, b.p))
    for (const g of [whole, noTimes, maybe, out, noReply]) g.sort(byYouFirst)
    return { whole, part, noTimes, maybe, out, noReply }
  }, [event.participants, dayIv, win, winS, winE, markedIds, locked]) // eslint-disable-line react-hooks/exhaustive-deps

  // who the counts are out of. Once locked it is the RSVPs; while planning nobody has
  // been asked to RSVP yet, so it is everyone who has not said no. Counting RSVPs then
  // left only the host, and the band read "1" in every slot.
  const pool = useMemo(
    () => (locked ? attendees : event.participants.filter((p) => p.rsvp !== 'not_going' && !(unavailSet.has(p.id) && !markedIds.has(p.id)))),
    [locked, attendees, event.participants, unavailSet, markedIds],
  )

  // the roster only says "here" once there is somewhere to be
  const hasVenue = event.location.mode === 'remote' || leadingPlaceOf(event) != null

  // inline timing bars for part-time rows: one block per stretch they're around,
  // positioned within the window — gaps stay visibly empty. Each block carries its
  // own times; ":00" drops so the label fits a narrow segment.
  const span = Math.max(1, winE - winS)
  const short = (m: number) => fmtMinute(m).replace(':00 ', ' ')
  const barsOf = (segs: Iv[] | null) => segs?.map((iv) => ({
    left: `${Math.max(0, ((iv.s - winS) / span) * 100).toFixed(1)}%`,
    width: `${Math.max(2, (((iv.e - iv.s) / span) * 100)).toFixed(1)}%`,
    label: `${short(gridStart + iv.s)}–${short(gridStart + iv.e)}`,
    full: `${fmtMinute(gridStart + iv.s)} – ${fmtMinute(gridStart + iv.e)}`,
  })) ?? null

  // one shared time axis over the part-time tracks: window edges labeled, hour marks
  // labeled when there's room, half-hour ticks silent
  const axis: { pct: number; label?: string }[] = []
  if (win) {
    axis.push({ pct: 0, label: short(gridStart + winS) }, { pct: 100, label: short(gridStart + winE) })
    for (let m = Math.ceil(winS / 30) * 30; m < winE; m += 30) {
      const pct = ((m - winS) / span) * 100
      if (pct <= 2 || pct >= 98) continue
      const labeled = m % 60 === 0 && span >= 120 && pct > 18 && pct < 82
      axis.push({ pct, label: labeled ? short(gridStart + m) : undefined })
    }
  }

  // a nearby start that lets more people stay the whole time. The best window can't be
  // beaten by a shift, so this mostly speaks up when the confirmed time isn't the best one.
  const shift = useMemo(() => {
    if (!win) return null
    const fullCount = (s: number, e: number) => pool.filter((p) => (dayIv[p.id] ?? []).some((iv) => iv.s <= s && iv.e >= e)).length
    const cur = fullCount(winS, winE)
    if (cur >= pool.length) return null
    let found: { d: number; count: number } | null = null
    for (const d of [-120, -90, -60, -45, -30, -15, 15, 30, 45, 60, 90, 120]) {
      const s = winS + d, e = winE + d
      if (s < 0 || e > rows * step) continue
      const c = fullCount(s, e)
      if (c > cur && (!found || c > found.count || (c === found.count && Math.abs(d) < Math.abs(found.d)))) found = { d, count: c }
    }
    return found ? { d: found.d, gain: found.count - cur } : null
  }, [win, winS, winE, pool, dayIv, rows, step])

  return (
    <div className="rounded-2xl border border-border bg-s1 p-5">
      <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3">
        <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{locked ? 'Who’s coming' : 'Who’s available'}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {win && (() => {
            // an all-day lock (day polls) has no clock times to show
            const allDay = gridStart + winS === 0 && gridStart + winE === 24 * 60
            return (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-dim">
                {locked ? (allDay ? 'Confirmed day' : 'Confirmed time') : 'Best window'}:{' '}
                {locked
                  ? <span className="font-semibold text-text">{win.dayLabel}{allDay ? '' : `, ${fmtMinute(gridStart + winS)} – ${fmtMinute(gridStart + winE)}`}</span>
                  : <button type="button" onClick={() => (onGoToBestWindow ? onGoToBestWindow() : onGoToTab?.('availability'))} className="font-semibold text-accent-text hover:underline">{win.dayLabel}, {fmtMinute(gridStart + winS)} – {fmtMinute(gridStart + winE)}</button>}
                {!allDay && <TimezonePill tz={event.timezone} />}
                {!locked && <BestWindowInfo mode={event.bestMode ?? 'full'} />}
              </div>
            )
          })()}
          {onQuorum && <QuorumControl quorum={quorum} onChange={onQuorum} />}
        </div>
      </div>

      <LeadingPlace event={event} onGoToTab={onGoToTab} />

      {win
        ? <HeadcountBars attendees={pool} dayIv={dayIv} gridStart={gridStart} step={step} winS={winS} winE={winE} quorum={quorum} />
        : <div className="rounded-xl border border-border bg-s0 px-4 py-6 text-center text-[13.5px] text-dim">Add availability to see who is around when.</div>}

      {quorum != null && win && <QuorumStatus quorum={quorum} whole={groups.whole.length} />}
      {shift && <ShiftSuggestion shift={shift} />}

      {/* explicit "none of these days work" replies are the signal to widen the window */}
      {!locked && unavailSet.size > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-ochre-border bg-ochre-bg px-3 py-2 text-[13px] leading-[1.5] text-ochre-text">
          <TriangleAlert size={14} className="mt-0.5 flex-none" />
          <span>{unavailSet.size === 1 ? '1 person isn’t' : `${unavailSet.size} people aren’t`} free on any of these days. Widening the date window could bring them in.</span>
        </div>
      )}

      {/* pick one group or read them all — the chips double as a headcount per group */}
      <div className="-mx-5 mt-5 flex items-center gap-1.5 overflow-x-auto px-5 py-1.5 scroll-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {([
          ['all', 'All', event.participants.length],
          ['whole', locked && hasVenue ? 'Whole time' : 'Free whole time', groups.whole.length],
          ['part', locked ? 'Part time' : 'Free part time', groups.part.length],
          ['noTimes', 'No times yet', groups.noTimes.length],
          ['maybe', 'Maybe', groups.maybe.length],
          ['out', "Can't", groups.out.length],
          ['noReply', 'No reply', groups.noReply.length],
        ] as const).filter(([k, , n]) => k === 'all' || n > 0).map(([k, l, n]) => {
          const on = showGroup === k
          return (
            <button
              key={k} onClick={() => setShowGroup(k)}
              // 32 to look at, 44 to touch: the pseudo-element takes the finger
              className={`relative flex h-8 flex-none items-center gap-1 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-semibold before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] sm:h-7 sm:px-2.5 sm:before:hidden ${on ? 'border-accent bg-accent text-on-accent' : 'border-border bg-s1 text-dim hover:border-border2 hover:text-text'}`}
            >
              {l} <span className={on ? 'opacity-80' : 'text-faint'}>{n}</span>
            </button>
          )
        })}
      </div>

      {event.participants.length > 12 && (
        <label className="mt-3 flex h-11 items-center gap-2 rounded-[10px] border border-border bg-s0 px-3 focus-within:border-accent-border sm:h-9 sm:max-w-[280px]">
          <Search size={14} className="flex-none text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name" aria-label="Find a person" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear" className="grid h-7 w-7 flex-none place-items-center rounded-[6px] text-faint hover:text-text"><X size={13} /></button>}
        </label>
      )}

      <div className="mt-4 flex flex-col gap-5">
        {q && [groups.whole, groups.part.map((x) => x.p), groups.noTimes, groups.maybe, groups.out, groups.noReply].every((g) => !g.some(hit)) && (
          <p className="text-[13px] text-faint">Nobody here by that name.</p>
        )}
        {(showGroup === 'all' || showGroup === 'whole') && <RosterGroup compact label={locked && hasVenue ? 'Here the whole time' : 'Free the whole time'} tone="teal" people={groups.whole.filter(hit).map((p) => ({ p }))} onPerson={onPerson} onOpenGroup={onViewGroup ? () => onViewGroup(groups.whole.map((p) => p.id)) : undefined} />}
        {(showGroup === 'all' || showGroup === 'part') && <RosterGroup label={locked && hasVenue ? 'Part of the time' : 'Free part of the time'} tone="ochre" people={groups.part.filter((x) => hit(x.p)).map((x) => ({
          p: x.p,
          bar: barsOf(x.segs),
        }))} axis={axis.length ? axis : undefined} onPerson={onPerson} onOpenGroup={onViewGroup ? () => onViewGroup(groups.part.map((x) => x.p.id)) : undefined} />}
        {(showGroup === 'all' || showGroup === 'noTimes') && <RosterGroup compact label={locked ? 'Going, no times yet' : 'No times yet'} tone="faint" people={groups.noTimes.filter(hit).map((p) => ({ p }))} action={!locked && groups.noTimes.length > 0 ? <CopyReminder event={event} /> : undefined} onPerson={onPerson} onOpenGroup={onViewGroup ? () => onViewGroup(groups.noTimes.map((p) => p.id)) : undefined} />}
        {(showGroup === 'all' || showGroup === 'maybe') && <RosterGroup compact label="Maybe" tone="ochre" people={groups.maybe.filter(hit).map((p) => ({ p }))} onPerson={onPerson} />}
        {(showGroup === 'all' || showGroup === 'out') && <RosterGroup compact label="Can't make it" tone="brick" people={groups.out.filter(hit).map((p) => ({ p }))} onPerson={onPerson} onOpenGroup={onViewGroup ? () => onViewGroup(groups.out.map((p) => p.id)) : undefined} />}
        {(showGroup === 'all' || showGroup === 'noReply') && <RosterGroup compact label="No reply" tone="faint" people={groups.noReply.filter(hit).map((p) => ({ p }))} action={<CopyReminder event={event} />} onPerson={onPerson} />}
      </div>
    </div>
  )
}

function BestWindowInfo({ mode }: { mode: BestMode }) {
  return (
    <Popover width={240} align="end" trigger={() => <Info size={13} className="text-faint hover:text-dim" />}>
      {() => (
        <PopoverNote>
          {mode === 'crowd'
            ? <>Favoring <span className="font-semibold text-text">biggest crowd</span>: the slot with the most people around, even part-time.</>
            : <>Favoring <span className="font-semibold text-text">everyone stays</span>: the slot where the most people are free the whole time.</>}
        </PopoverNote>
      )}
    </Popover>
  )
}

/* host-set minimum headcount — the tab warns when fewer can stay the whole time */
function QuorumControl({ quorum, onChange }: { quorum: number | null; onChange: (q: number | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  function save(close: () => void) {
    const n = parseInt(ref.current?.value ?? '', 10)
    onChange(Number.isFinite(n) && n >= 1 ? n : null)
    close()
  }
  return (
    <Popover width={252} align="end" trigger={(open) => (
      <span className={`flex h-11 sm:h-7 items-center gap-1.5 rounded-[8px] border border-border2 px-2.5 text-[12px] font-semibold ${open ? 'bg-s2' : 'bg-s1 hover:bg-s2'}`}>
        <Users size={13} /> {quorum != null ? `Need ${quorum}` : 'Set a minimum'}
      </span>
    )}>
      {(close) => (
        <div className="p-1">
          <PopoverTitle sub="Warns when fewer can stay">Minimum headcount</PopoverTitle>
          <div className="mt-2 flex items-center gap-2 px-1 pb-1">
            <input
              ref={ref} type="number" min={1} max={999} defaultValue={quorum ?? ''} placeholder="e.g. 8"
              className="h-9 w-[86px] rounded-[9px] border border-border bg-s0 px-3 text-[14px] outline-none focus:border-border2"
              onKeyDown={(e) => { if (e.key === 'Enter') save(close) }}
            />
            <button onClick={() => save(close)} className="h-9 flex-none rounded-[9px] bg-accent px-3 text-[13px] font-semibold text-on-accent">Save</button>
            {quorum != null && (
              <button onClick={() => { onChange(null); close() }} className="h-9 flex-none rounded-[9px] px-2 text-[13px] font-semibold text-dim hover:bg-s2">Clear</button>
            )}
          </div>
        </div>
      )}
    </Popover>
  )
}

function QuorumStatus({ quorum, whole }: { quorum: number; whole: number }) {
  if (whole >= quorum) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[13px] text-teal-text">
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-teal" /> {whole} can stay the whole time. That clears your minimum of {quorum}.
      </div>
    )
  }
  return (
    <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-ochre-border bg-ochre-bg px-3 py-2 text-[13px] leading-[1.5] text-ochre-text">
      <TriangleAlert size={14} className="mt-0.5 flex-none" /> Only {whole} can stay the whole time, and you wanted at least {quorum}.
    </div>
  )
}

const SHIFT_LABEL: Record<number, string> = { 15: '15 minutes', 30: '30 minutes', 45: '45 minutes', 60: 'an hour', 90: 'an hour and a half', 120: 'two hours' }
function ShiftSuggestion({ shift }: { shift: { d: number; gain: number } }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-accent-border bg-accent-bg px-3 py-2 text-[13px] leading-[1.5] text-accent-text">
      <Clock size={14} className="mt-0.5 flex-none" />
      <span>Starting {SHIFT_LABEL[Math.abs(shift.d)]} {shift.d > 0 ? 'later' : 'earlier'} would let {shift.gain} more {shift.gain === 1 ? 'person' : 'people'} stay the whole time.</span>
    </div>
  )
}

/* Leading place: the venue this headcount is for — tap through to the Location tab */
function LeadingPlace({ event, onGoToTab }: { event: AppEvent; onGoToTab?: GoTab }) {
  if (event.location.mode === 'remote') {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-s0 px-4 py-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-border bg-s2 text-dim"><MapPin size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold">Online event</div>
          <div className="text-[12.5px] text-dim">{event.location.platform || 'Meeting link on the Details tab'}</div>
        </div>
      </div>
    )
  }
  if (!event.location.places.length) return null

  const lead = leadingPlaceOf(event)
  if (!lead) {
    return (
      <button onClick={() => onGoToTab?.('location')} className="mb-4 w-full rounded-xl border border-dashed border-border2 bg-s0 px-4 py-3 text-left text-[13px] leading-[1.5] text-dim transition-colors hover:bg-s2">
        No votes yet. Once people vote on the Location tab, the leading place shows up here. <span className="font-semibold text-accent-text">Go vote</span>
      </button>
    )
  }

  const voters = lead.voters
    .map((id) => event.participants.find((p) => p.id === id))
    .filter((p): p is Participant => !!p)

  return (
    <button onClick={() => onGoToTab?.('location')} className="mb-4 flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-s0 px-4 py-3 text-left transition-colors hover:bg-s2">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-accent-border bg-accent-bg text-accent-text"><MapPin size={16} /></span>
      {/* real min width: on phones the avatar pile wraps below instead of crushing the name */}
      <span className="min-w-[180px] flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14.5px] font-semibold">{lead.place.name}</span>
          {lead.confirmed
            ? <span className="flex-none rounded-[6px] border border-teal-border bg-teal-bg px-1.5 py-px text-[10.5px] font-semibold text-teal-text">Confirmed</span>
            : <span className="flex-none rounded-[6px] border border-accent-border bg-accent-bg px-1.5 py-px text-[10.5px] font-semibold text-accent-text">Leading</span>}
        </span>
        {/* a settled or confirmed venue was never voted on — the address alone says it */}
        <span className="block truncate text-[12.5px] text-dim">
          {lead.place.place}{!(event.location.mode === 'set' || (lead.confirmed && voters.length === 0)) && <> ({voters.length} {voters.length === 1 ? 'vote' : 'votes'}
          {lead.margin != null && lead.margin > 0 && <span>, ahead by {lead.margin}</span>}{lead.margin === 0 && <span className="text-ochre-text">, tied for first</span>})</>}
                  </span>
      </span>
      {!event.hideVoters && <AvatarPile people={voters} cap={5} />}
      <ChevronRight size={16} className="flex-none text-faint" />
    </button>
  )
}

/* Headcount through the window, as one band. It was a bar chart, and a bar chart of
   a two-hour window at half-hour slots is four blocks, so it read as a picture of
   blocks rather than of people. Now the window is one strip cut into its slots,
   each shaded on the same green ramp the grid uses and carrying its count, so the
   question "when is everyone here" reads left to right in one line. A quorum marks
   the slots that fall short of it. Tap a slot for the time and the count. */
function HeadcountBars({
  attendees, dayIv, gridStart, step, winS, winE, quorum,
}: {
  attendees: Participant[]; dayIv: Record<string, Iv[]>; gridStart: number; step: number
  winS: number; winE: number; quorum: number | null
}) {
  const [sel, setSel] = useState<number | null>(null)
  const spanRows = Math.max(1, Math.ceil((winE - winS) / step))
  const counts = useMemo(() => Array.from({ length: spanRows }, (_, ti) => {
    const s = winS + ti * step, e = Math.min(winE, s + step)
    return attendees.filter((p) => (dayIv[p.id] ?? []).some((iv) => iv.s < e && iv.e > s)).length
  }), [attendees, dayIv, spanRows, step, winS, winE])
  const total = Math.max(1, attendees.length)
  // counts print inside the band while each slot is wide enough to hold one
  const labeled = spanRows <= 12
  const shade = (c: number) => {
    const f = c / total
    return f === 0 ? { bg: 'var(--s2)', fg: 'var(--faint)' }
      : f >= 1 ? { bg: 'var(--heat-full)', fg: 'var(--heat-count-full)' }
      : f >= 0.66 ? { bg: 'var(--heat-high)', fg: 'var(--heat-count)' }
      : f >= 0.33 ? { bg: 'var(--heat-mid)', fg: 'var(--heat-count)' }
      : { bg: 'var(--heat-low)', fg: 'var(--heat-count)' }
  }
  // hour marks under the band, once the window is long enough to need them
  const span = Math.max(1, winE - winS)
  const hours: number[] = []
  if (span >= 180) for (let m = Math.ceil((gridStart + winS + 1) / 60) * 60; m < gridStart + winE; m += 60) hours.push(m)

  return (
    <div>
      <div className="relative">
        {sel != null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[8px] border border-border bg-s1 px-2.5 py-1.5 text-[12px] shadow-soft"
            style={{ left: `${Math.min(88, Math.max(12, ((sel + 0.5) / spanRows) * 100))}%` }}
          >
            <span className="font-semibold">{fmtMinute(gridStart + winS + sel * step)}</span>: {counts[sel]} of {attendees.length} free
          </div>
        )}
        <div className="flex h-11 overflow-hidden rounded-[10px] border border-border">
          {counts.map((c, i) => {
            const { bg, fg } = shade(c)
            const short = quorum != null && c < quorum
            return (
              <button
                key={i} type="button" onClick={() => setSel(sel === i ? null : i)}
                aria-label={`${fmtMinute(gridStart + winS + i * step)}, ${c} of ${attendees.length} free`}
                className={`grid min-w-0 flex-1 place-items-center text-[12px] font-semibold tabular-nums ${i > 0 ? 'border-l border-bg/60' : ''} ${sel === i ? 'ring-2 ring-inset ring-accent' : ''}`}
                style={{ background: bg, color: short ? 'var(--brick-text)' : fg }}
              >
                {labeled ? c : ''}
              </button>
            )
          })}
        </div>
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] tabular-nums text-faint">
        <span className="absolute left-0">{fmtMinute(gridStart + winS)}</span>
        {hours.map((m) => {
          const pct = ((m - gridStart - winS) / span) * 100
          return pct > 14 && pct < 86 ? <span key={m} className="absolute hidden -translate-x-1/2 sm:block" style={{ left: `${pct}%` }}>{fmtMinute(m).replace(':00 ', ' ')}</span> : null
        })}
        <span className="absolute right-0">{fmtMinute(gridStart + winE)}</span>
      </div>
    </div>
  )
}

const TONE: Record<string, { dot: string; text: string }> = {
  teal: { dot: 'var(--teal)', text: 'text-teal-text' },
  ochre: { dot: 'var(--ochre)', text: 'text-ochre-text' },
  brick: { dot: 'var(--brick)', text: 'text-brick-text' },
  faint: { dot: 'var(--faint)', text: 'text-faint' },
}

/* A group of people, read one of two ways. Rows, when each person has something of
   their own to show (the part-time bars). Chips, when the only thing to know is who:
   a group that is simply "free the whole time" is the longest and the least
   interesting, and a row each for it pushed the people with gaps off the screen.
   Either way it stops at a sensible number and offers the rest on request. */
function RosterGroup({ label, tone, people, cap: capIn, compact, action, onPerson, onOpenGroup, hint, axis }: {
  label: string; tone: keyof typeof TONE | string
  compact?: boolean
  people: { p: Participant; note?: string; bar?: { left: string; width: string; label: string; full: string }[] | null }[]
  cap?: number
  action?: ReactNode
  onPerson?: (pid: string) => void
  onOpenGroup?: () => void
  hint?: string
  axis?: { pct: number; label?: string }[]
}) {
  const [all, setAll] = useState(false)
  if (!people.length) return null
  const t = TONE[tone] ?? TONE.faint
  const cap = capIn ?? (compact ? 24 : 12)
  const shown = all ? people : people.slice(0, cap)
  const extra = people.length - shown.length
  const more = extra > 0 || all ? (
    <button type="button" onClick={() => setAll((a) => !a)} className="relative h-8 self-start rounded-full px-1 text-[12.5px] font-semibold text-accent-text before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:underline">
      {all ? 'Show fewer' : `Show all ${people.length}`}
    </button>
  ) : null
  const hasBars = people.some((x) => x.bar !== undefined)
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
        {onOpenGroup ? (
          // availability groups link to the grid filtered to just these people
          <button type="button" onClick={onOpenGroup} title="See this group on the availability calendar" className={`flex items-center gap-1.5 text-[13.5px] font-semibold hover:underline ${t.text}`}>
            {label} <CalendarRange size={13} className="text-faint" />
          </button>
        ) : (
          <span className={`text-[13.5px] font-semibold ${t.text}`}>{label}</span>
        )}
        <span className="text-[12.5px] text-faint">{people.length}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {hint && <p className="mb-2 max-w-[440px] text-[12px] leading-[1.5] text-faint">{hint}</p>}
      {/* shared clock for every track below — the spacer mirrors the name column so the
          ticks land exactly over the rails */}
      {axis && hasBars && (
        <div className="mb-1 flex items-end gap-2.5">
          {/* mirrors the name buttons below, including their -mx-1 hover inset */}
          <div className={`w-[42%] flex-none sm:w-[160px] ${onPerson ? '-mx-1 px-1' : ''}`} />
          {/* times sit above their ticks; labeled ticks stay tall and dark, half-hour
              ticks short and quiet */}
          <div className="relative h-[22px] min-w-0 flex-1">
            {axis.map((t, i) => (
              <span key={i} className={`absolute bottom-0 w-px ${t.label ? 'h-[7px] bg-faint' : 'h-1 bg-border2'}`} style={{ left: `calc(${t.pct}% - 0.5px)` }} />
            ))}
            {/* the two ends hold their own edge: the first label starts at its tick and
                the last one ends at its tick, so a long end time ("12:30 AM") stays
                inside the card instead of hanging half past it. Interior labels center
                on their ticks, sit out below sm, and are dropped where they would
                collide with an end label. */}
            {axis.filter((t) => t.label).map((t, i) => {
              const start = t.pct <= 1, end = t.pct >= 99
              return (
                <span
                  key={`l${i}`}
                  className={`absolute top-0 whitespace-nowrap text-[11px] font-medium leading-none text-dim ${start ? '' : end ? '-translate-x-full' : '-translate-x-1/2 hidden sm:block'}`}
                  style={{ left: `${t.pct}%` }}
                >
                  {t.label}
                </span>
              )
            })}
          </div>
        </div>
      )}
      {compact && !hasBars ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {shown.map(({ p }) => (
            <button
              key={p.id} type="button" onClick={onPerson ? () => onPerson(p.id) : undefined} disabled={!onPerson}
              title={onPerson ? `See when ${p.name} is free` : undefined}
              className="relative flex h-8 max-w-full items-center gap-2 rounded-full border border-border bg-s0 pl-1 pr-3 before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] enabled:hover:border-border2 enabled:hover:bg-s2 sm:before:hidden"
            >
              <Avatar initials={p.initials} color={p.color} size={24} font={9} />
              <span className="min-w-0 truncate text-[13px]">{p.name}{p.you && <span className="text-faint"> (You)</span>}</span>
            </button>
          ))}
          {more}
        </div>
      ) : (
      <div className="flex flex-col gap-1.5">
        {shown.map(({ p, note, bar }) => (
          <div key={p.id} className="flex items-center gap-2.5">
            <button
              type="button" onClick={onPerson ? () => onPerson(p.id) : undefined} disabled={!onPerson}
              title={onPerson ? `See when ${p.name} is free` : undefined}
              className={`flex min-w-0 items-center gap-2.5 rounded-[8px] text-left ${hasBars ? 'w-[42%] sm:w-[160px] flex-none' : 'flex-1'} ${onPerson ? '-mx-1 px-1 py-0.5 hover:bg-s2' : ''}`}
            >
              <Avatar initials={p.initials} color={p.color} size={27} font={10} />
              <span className="min-w-0 flex-1 truncate text-[14px]">{p.name}{p.you && <span className="text-faint"> (You)</span>}</span>
            </button>
            {hasBars && (
              <div className="relative h-5 min-w-0 flex-1 rounded-[6px] bg-s2">
                {bar && bar.length > 0
                  ? bar.map((b, i) => (
                      // narrow segments clip their label — the shared axis above carries
                      // the position, and the tooltip keeps the exact minutes on desktop
                      <div key={i} title={b.full} className="absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-[6px] border border-ochre bg-ochre-border" style={{ left: b.left, width: b.width }}>
                        <span className="truncate px-1 text-[11px] font-semibold text-ochre-text">{b.label}</span>
                      </div>
                    ))
                  : <span className="absolute inset-0 flex items-center px-2 text-[11.5px] text-brick-text">busy during this time</span>}
              </div>
            )}
            {note && <span className="hidden flex-none items-center gap-1 text-[12.5px] text-dim sm:flex"><Clock size={12} /> {note}</span>}
          </div>
        ))}
        {more && <div className="pl-[34px]">{more}</div>}
      </div>
      )}
    </div>
  )
}

/* a ready-made nudge for the group chat, aimed at the people who haven't replied */
function CopyReminder({ event }: { event: AppEvent }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    const voting = event.location.mode === 'vote' && event.location.places.length > 1
    const deadline = event.voteDeadline ? `\nVoting closes ${fmtDeadline(event.voteDeadline)}.` : ''
    const msg = `${event.title} still needs your times. It takes a minute: mark when you're free${voting ? ' and vote on a place' : ''}.\n${window.location.origin}/events/${event.id}/join${deadline}`
    navigator.clipboard?.writeText(msg).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <button onClick={copy} className={`flex h-11 sm:h-7 items-center gap-1.5 rounded-[7px] border px-2 text-[12px] font-semibold ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 text-dim hover:bg-s2'}`}>
      {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy a reminder</>}
    </button>
  )
}

/* ── Multi-stop itinerary: O(1) per stop, exceptions not a matrix ── */
function ItineraryAttendance({
  event, attendees, dayIv, gridStart, onPerson,
}: { event: AppEvent; attendees: Participant[]; dayIv: Record<string, Iv[]>; gridStart: number; onPerson?: (pid: string) => void }) {
  const placeName = (id: string) => event.location.places.find((p) => p.id === id)?.name ?? 'Stop'
  const stops = event.itinStops ?? []
  const dwell = event.itinDwell ?? []
  const startMin = event.itinStartMin ?? 9 * 60
  // the same road route the Location tab uses (shared cache), so travel minutes agree
  const stopPoints = stops.map((id) => coordsOf(event.location.places.find((p) => p.id === id)))
  const routable: LatLng[] = stopPoints.every((p): p is LatLng => !!p) ? stopPoints : []
  const road = useRoute(routable)

  // schedule + per-stop attendance, computed once (O(stops × people)). The schedule comes from
  // the shared helper, so these clock times match the Location tab exactly.
  const stopData = useMemo(() => {
    const inputStops = stops.map((placeId, i) => ({ placeId, dwell: dwell[i] ?? 60 }))
    const modes = ((event.travelModes as TravelMode[] | undefined) ?? []).filter((m) => ALL_MODES.includes(m))
    const { schedule } = computeItinerary(event.location.places, inputStops, startMin, modes, road?.legs)
    return schedule.map((s, i) => {
      const sG = s.arrive - gridStart, eG = s.depart - gridStart
      const present: Participant[] = [], partial: Participant[] = [], absent: Participant[] = []
      for (const p of attendees) {
        const c = coverOf(dayIv[p.id], sG, eG)
        if (c === 'none') absent.push(p)
        else { present.push(p); if (c === 'partial') partial.push(p) }
      }
      return { placeId: s.placeId, name: placeName(s.placeId), i, arrive: s.arrive, depart: s.depart, present, partial, absent }
    })
  }, [stops, dwell, startMin, gridStart, attendees, dayIv, event.location.places, event.travelModes, road]) // eslint-disable-line react-hooks/exhaustive-deps

  // people missing at least one stop → the exceptions list (never an O(people × stops) grid)
  const exceptions = useMemo(() => attendees
    .map((p) => ({ p, misses: stopData.filter((s) => s.absent.some((a) => a.id === p.id)).map((s) => s.i + 1) }))
    .filter((x) => x.misses.length > 0), [attendees, stopData])
  const attendAll = attendees.length - exceptions.length
  // people who miss the same stops, together; the biggest group first
  const gapGroups = useMemo(() => {
    const nameOf = (n: number) => stopData[n - 1]?.name ?? `stop ${n}`
    const joined = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0])
    const by = new Map<string, { key: string; label: string; people: Participant[] }>()
    for (const { p, misses } of exceptions) {
      const key = misses.join(',')
      if (!by.has(key)) {
        const label = misses.length === stops.length ? 'Misses every stop'
          : misses.length > 2 ? `Misses ${misses.length} stops: ${joined(misses.map(nameOf))}`
          : `Misses ${joined(misses.map(nameOf))}`
        by.set(key, { key, label, people: [] })
      }
      by.get(key)!.people.push(p)
    }
    return [...by.values()].sort((x, y) => y.people.length - x.people.length)
  }, [exceptions, stopData, stops.length])
  const peak = Math.max(1, ...stopData.map((s) => s.present.length))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[14.5px]"><span className="font-serif text-[24.5px]">{attendAll}</span> <span className="text-dim">of {attendees.length} attend all {stops.length} stops</span></div>
          <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Headcount by stop</div>
        </div>
        {/* headcount strip — one bar per stop, full vs part-time */}
        <div className="flex items-end gap-2">
          {stopData.map((s) => {
            const h = (s.present.length / peak) * 100
            const partFrac = s.present.length ? s.partial.length / s.present.length : 0
            return (
              <div key={s.i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex h-20 w-full items-end justify-center">
                  <div className="relative w-full max-w-[38px] overflow-hidden rounded-t-[3px] bg-s2" style={{ height: `${Math.max(8, h)}%` }}>
                    <div className="absolute inset-x-0 top-0 bg-ochre" style={{ height: `${partFrac * 100}%` }} />
                    <div className="absolute inset-x-0 bottom-0 bg-teal" style={{ height: `${(1 - partFrac) * 100}%` }} />
                  </div>
                </div>
                <span className="grid h-4 w-4 flex-none place-items-center rounded-full bg-accent text-[10px] font-bold text-on-accent">{s.i + 1}</span>
                <span className="w-full truncate text-center text-[10.5px] text-dim">{s.present.length}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* per-stop cards — bounded work, capped pile, flag chips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stopData.map((s) => (
          <div key={s.i} className="rounded-xl border border-border bg-s1 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-[12.5px] font-bold text-on-accent">{s.i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{s.name}</span>
              <span className="flex flex-none items-center gap-1 text-[12px] text-faint"><Clock size={11} /> {fmtMinuteDay(s.arrive)}</span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-s2">
              <div className="h-full rounded-full bg-teal" style={{ width: `${(s.present.length / Math.max(1, attendees.length)) * 100}%` }} />
            </div>
            <div className="mb-2.5 text-[12.5px] text-dim">{s.present.length} of {attendees.length} here</div>
            <div className="flex items-center justify-between">
              <AvatarPile people={s.present} cap={6} />
              <div className="flex flex-wrap justify-end gap-1">
                {s.partial.length > 0 && <Flag tone="ochre">{s.partial.length} partial</Flag>}
                {s.absent.length > 0 && <Flag tone="brick">{s.absent.length} out</Flag>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* the gaps, grouped by which stops are missed. It was a row per person with
          the stop numbers they miss as bare circles, which made the reader match
          numbers to names and grew with the guest list. People who miss the same
          stops are one group, named by those stops, so the list grows with the
          patterns (a handful) rather than the people. */}
      <div className="rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Who misses a stop</div>
        {exceptions.length === 0 ? (
          <div className="flex items-center gap-2 text-[14px] text-teal-text"><span className="h-1.5 w-1.5 rounded-full bg-teal" /> Everyone makes every stop.</div>
        ) : (
          <div className="flex flex-col gap-5">
            {gapGroups.map((g) => (
              <RosterGroup key={g.key} compact tone="brick" label={g.label} people={g.people.map((p) => ({ p }))} onPerson={onPerson} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AvatarPile({ people, cap }: { people: Participant[]; cap: number }) {
  const shown = people.slice(0, cap)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((p) => <span key={p.id} className="-mr-1.5"><Avatar initials={p.initials} color={p.color} size={25} font={9.5} ring /></span>)}
      {extra > 0 && <span className="ml-2.5 text-[12.5px] font-semibold text-dim">+{extra}</span>}
      {people.length === 0 && <span className="text-[12.5px] text-faint">nobody yet</span>}
    </div>
  )
}

function Flag({ tone, children }: { tone: 'ochre' | 'brick'; children: React.ReactNode }) {
  const cls = tone === 'ochre' ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-brick-border bg-brick-bg text-brick-text'
  return <span className={`flex items-center gap-1 rounded-[6px] border px-1.5 py-px text-[10.5px] font-semibold ${cls}`}>{tone === 'brick' && <TriangleAlert size={10} />}{children}</span>
}

function EmptyState({ onGoToTab }: { onGoToTab?: GoTab }) {
  return (
    <div className="grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-border2 bg-s1 px-6 py-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-border bg-s2 text-dim"><MapPin size={22} /></span>
        <p className="font-serif text-[27px] tracking-[-0.01em]">No responses yet</p>
        <p className="mt-1.5 text-[14px] text-dim">This tab fills in as people reply. It starts with two quick steps.</p>
        <div className="mx-auto mt-4 flex max-w-[360px] flex-col gap-2 text-left">
          <StepRow n={1} text="Mark when you're free" cta="Open availability" onClick={() => onGoToTab?.('availability')} />
          <StepRow n={2} text="Vote on a place" cta="Open location" onClick={() => onGoToTab?.('location')} />
        </div>
      </div>
    </div>
  )
}

function StepRow({ n, text, cta, onClick }: { n: number; text: string; cta: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-border bg-s0 px-3.5 py-2.5 text-left transition-colors hover:bg-s2">
      <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-[12px] font-bold text-on-accent">{n}</span>
      <span className="min-w-0 flex-1 text-[13.5px] font-medium">{text}</span>
      <span className="flex-none text-[12.5px] font-semibold text-accent-text">{cta}</span>
    </button>
  )
}
