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
import { CalendarRange, Check, ChevronRight, Clock, Copy, Info, MapPin, Search, TriangleAlert, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { FlipGroup } from '@/components/ui/FlipGroup'
import { HandNote } from '@/components/ui/HandNote'
import { PencilArrow } from '@/components/ui/Pencil'
import { TabHeading } from './TabHeading'
import { answeredLine, goingLine } from '@/lib/answers'
import { namesLabel } from '@/components/ui/AvatarRow'
import { Popover, PopoverNote } from '@/components/ui/Popover'
import { SettingField, SettingStepper, SettingToggle, SettingsMenu } from '@/components/ui/Settings'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Announce } from '@/components/ui/Announce'
import { TimezonePill, tzAbbr } from '@/components/ui/TimezonePill'
import {
  answeredIds, availIvOf, bestWindow, rsvpPool, byYouFirst, confirmedSlotText, dayLabel, gridStartMinOf, fmtMinute, fmtMinuteDay, leadingPlaceOf, patchEvent, setMyRsvp, stepOf,
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

  const attendees = useMemo(() => participants.filter((p) => p.rsvp === 'attending' || p.rsvp === 'maybe'), [participants])
  const me = participants.find((p) => p.you)

  // who has marked ANY availability on any day — "no times yet" means never, not
  // "not free on this particular day"
  const markedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const day of Object.values(availIv)) for (const [id, ivs] of Object.entries(day)) if (ivs.length) ids.add(id)
    return ids
  }, [availIv])
  // who declared "none of these days work" — an explicit empty reply, not silence
  const unavailSet = useMemo(() => new Set(event.unavailableIds ?? []), [event.unavailableIds])

  // a locked run of days answers by day, not by clock: which days of the run each
  // person can make. ISO keys compare as strings, so the filter is a plain range.
  const runDays = useMemo(() => {
    const c = event.confirmed
    if (!locked || !c?.endDayKey) return null
    return event.days.filter((d) => d.key >= c.dayKey && d.key <= c.endDayKey!)
  }, [locked, event.confirmed, event.days])

  // event with the live participant list, so child views read the same list this tab edits
  const liveEvent = useMemo(() => ({ ...event, participants }), [event, participants])

  // the route, worked out once for the heading and the view
  const itinPeople = useMemo(
    () => (locked ? attendees : participants.filter((p) => p.rsvp !== 'not_going' && !(unavailSet.has(p.id) && !markedIds.has(p.id)))),
    [locked, attendees, participants, unavailSet, markedIds],
  )
  const itin = useItinerary(liveEvent, itinPeople, dayIv, gridStart)
  const showItin = model === 'itin' && hasItinerary && itin.stopData.length > 0

  // where things stand, said once as a sentence. Deciding: answered out of everyone
  // invited (lib/answers), and how many can stay for the whole best time so far. Locked:
  // going out of who can make the locked time. The counts come from lib/events.
  const answered = useMemo(() => answeredIds(liveEvent), [liveEvent])
  const byDay = event.granularity === 'day'
  const wholeNow = win
    ? participants.filter((p) => p.rsvp !== 'not_going' && !unavailSet.has(p.id) && coverOf(dayIv[p.id], win.s, win.e) === 'full').length
    : 0
  // nothing to read yet: nobody but you has answered (or, once locked, replied)
  const empty = locked
    ? !participants.some((p) => !p.you && p.rsvp !== 'pending')
    : ![...answered].some((id) => id !== me?.id)
  const mineMissing = !locked && !!me && !markedIds.has(me.id) && !unavailSet.has(me.id)
  const allDay = !!win && gridStart + win.s === 0 && gridStart + win.e === 24 * 60
  const whenText = win ? `${win.dayLabel}${byDay || allDay ? '' : `, ${fmtMinute(gridStart + win.s)} to ${fmtMinute(gridStart + win.e)}`}` : ''
  const going = participants.filter((p) => p.rsvp === 'attending').length
  const title = showItin
    ? itinTitle(itin, itinPeople.length)
    : locked
    ? `${goingLine(rsvpPool(liveEvent), true)}.`
    : win
      ? `${answeredLine(answered.size, participants.length)}. ${wholeNow} ${byDay ? 'can make that day' : 'can stay the whole time'}.`
      : `${answeredLine(answered.size, participants.length)}.`
  // the time pill ends the line, so no full stop has to sit after it
  const sub = win ? (
    <p>
      {locked
        ? event.capacity != null ? (going >= event.capacity ? `Full, all ${event.capacity} spots are taken. ` : `${event.capacity - going} of ${event.capacity} spots left. `) : ''
        : 'It can change until the time is locked in. '}
      {locked ? 'Locked for ' : `Best ${byDay ? 'day' : 'time'} so far: `}
      {locked
        ? <span className="font-semibold text-text">{whenText}</span>
        : <button type="button" onClick={() => (onGoToBestWindow ? onGoToBestWindow() : onGoToTab?.('availability'))} className="font-semibold text-accent-text hover:underline">{whenText}</button>}
      {!byDay && !allDay && <> <TimezonePill tz={event.timezone} day={event.confirmed?.dayKey ?? event.startDate} /></>}
    </p>
  ) : !locked ? `Nobody has marked times yet, so there is no best ${byDay ? 'day' : 'time'} to count against.` : undefined

  return (
    <div className="flex flex-col gap-4">
      {/* "are you coming" is a locked-stage question; while planning, the ask is your
          times, and the empty state below asks for them itself */}
      {locked
        ? me?.rsvp === 'pending' && <YourRsvpStrip onPick={changeRsvp} full={full} />
        : mineMissing && !empty && <YourTimesStrip onGo={() => onGoToTab?.('availability')} />}

      <TabHeading
        eyebrow={locked ? 'Who’s coming' : 'Who can come'}
        title={title}
        sub={sub}
        aside={!empty && (
          <>
            <CopySummaryButton event={liveEvent} win={win} locked={locked} gridStart={gridStart} dayIv={dayIv} markedIds={markedIds} />
            {hasItinerary && (
              <SegmentedControl label="Attendance view"
                size="sm"
                value={model}
                onChange={(v) => setModel(v as 'single' | 'itin')}
                options={[{ v: 'single', l: 'Single venue' }, { v: 'itin', l: 'Itinerary' }]}
              />
            )}
          </>
        )}
      />

      {runDays && runDays.length > 1 && (
        <DayRunAttendance days={runDays} participants={participants} availIv={availIv} onPerson={onViewAvailability} />
      )}

      {empty ? (
        <WaitingOnGroup event={event} me={me} mineMissing={mineMissing} locked={locked} onGoToTab={onGoToTab} />
      ) : showItin ? (
        <ItineraryAttendance itin={itin} total={itinPeople.length} onPerson={onViewAvailability} onViewGroup={onViewAvailabilityGroup} />
      ) : (
        <SingleVenue
          event={liveEvent} attendees={attendees} win={win} locked={locked} dayIv={dayIv}
          gridStart={gridStart} step={step} rows={rows}
          quorum={quorum} onQuorum={event.hostedByYou ? changeQuorum : undefined}
          onGoToTab={onGoToTab} onPerson={onViewAvailability} onViewGroup={onViewAvailabilityGroup} markedIds={markedIds} unavailSet={unavailSet}
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
              <Avatar initials={p.initials} color={p.color} face={p.face} size={20} font={8.5} />
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-moment-border bg-moment-bg px-4 py-3">
      <span className="text-[14px] font-semibold text-moment-text">You haven&apos;t marked your times yet.</span>
      <span className="text-[13px] text-dim">The best window can&apos;t count you until you do.</span>
      <button onClick={onGo} className="ml-auto h-8 rounded-full bg-accent px-3 text-[13px] font-semibold text-on-accent">
        Add your availability
      </button>
    </div>
  )
}

/* ── your own reply, right where the counts are ── */
function YourRsvpStrip({ onPick, full }: { onPick: (r: Rsvp) => void; full: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-moment-border bg-moment-bg px-4 py-3">
      <span className="text-[14px] font-semibold text-moment-text">Your turn to reply.</span>
      <span className="text-[13px] text-dim">{full ? 'It is full, spots went to whoever replied first.' : 'Are you coming?'}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => onPick('attending')} disabled={full}
          title={full ? 'All spots are taken' : undefined}
          className="h-11 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent disabled:opacity-40 sm:h-8 sm:px-3"
        >
          Going
        </button>
        <button onClick={() => onPick('maybe')} className="h-11 rounded-full border border-border2 bg-s1 px-3.5 text-[13px] font-semibold text-dim hover:bg-s2 sm:h-8 sm:px-3">Maybe</button>
        <button onClick={() => onPick('not_going')} className="h-11 rounded-full border border-border2 bg-s1 px-3.5 text-[13px] font-semibold text-dim hover:bg-s2 sm:h-8 sm:px-3">Can&apos;t go</button>
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
    lines.push(`${event.title} is on.`, isAllDay(event.confirmed) ? slot : `${slot} ${tzAbbr(event.timezone, event.confirmed?.dayKey)}`)
    if (where) lines.push(where)
    const going = ps.filter((p) => p.rsvp === 'attending').length
    const maybe = ps.filter((p) => p.rsvp === 'maybe').length
    lines.push('', `${going} going${maybe ? `, ${maybe} maybe` : ''}.`)
    const waiting = ps.filter((p) => p.rsvp === 'pending').sort(byYouFirst)
    if (waiting.length) lines.push(`Still to reply: ${firstNames(waiting)}.`)
    // the link is the invitation, and inviting is the host's for now
    if (event.hostedByYou) lines.push('', `Details and RSVP: ${link}`)
  } else {
    lines.push(event.title)
    if (win) lines.push(`Best time so far: ${win.dayLabel}, ${fmtMinute(gridStart + win.s)} – ${fmtMinute(gridStart + win.e)} ${tzAbbr(event.timezone, win.dayKey)}`)
    if (where) lines.push(event.location.mode === 'remote' || lead?.confirmed ? where : `Leading place: ${where}`)
    const open = ps.filter((p) => p.rsvp !== 'not_going' && !(event.unavailableIds ?? []).includes(p.id))
    if (win) {
      const can = open.filter((p) => { const c = coverOf(dayIv[p.id], win.s, win.e); return c === 'full' || c === 'partial' })
      const whole = can.filter((p) => coverOf(dayIv[p.id], win.s, win.e) === 'full').length
      lines.push('', `${can.length} of ${ps.length} can make it${whole < can.length ? `, ${whole} for the whole time` : ''}.`)
    }
    const silent = open.filter((p) => !markedIds.has(p.id)).sort(byYouFirst)
    if (silent.length) lines.push(`Still need times from ${firstNames(silent)}.`)
    if (event.hostedByYou) lines.push('', `Add yours: ${link}`)
  }
  return lines.join('\n')
}
function CopySummaryButton({ event, win, locked, gridStart, dayIv, markedIds }: { event: AppEvent; win: Win | null; locked: boolean; gridStart: number; dayIv: Record<string, Iv[]>; markedIds: Set<string> }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(summaryOf(event, win, locked, gridStart, dayIv, markedIds)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <>
      <button onClick={copy} className={`flex h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold sm:h-9 ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 hover:bg-s2'}`}>
        {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy summary</>}
      </button>
      <Announce text={copied ? 'Summary copied' : ''} />
    </>
  )
}

/* ── Single venue: where it's happening, who's in the room, and when ── */
function SingleVenue({
  event, attendees, win, locked, dayIv, gridStart, step, rows, quorum, onQuorum, onGoToTab, onPerson, onViewGroup, markedIds, unavailSet,
}: {
  event: AppEvent; attendees: Participant[]; win: Win | null; locked: boolean
  dayIv: Record<string, Iv[]>; gridStart: number; step: number; rows: number
  quorum: number | null; onQuorum?: (q: number | null) => void
  onGoToTab?: GoTab; onPerson?: (pid: string) => void; onViewGroup?: (pids: string[]) => void
  markedIds: Set<string>
  unavailSet: Set<string>
}) {
  const winS = win?.s ?? 0
  const winE = win?.e ?? rows * step
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
  // an online plan is a call: people are on it, not in a room
  const online = event.location.mode === 'remote'

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

  const open = (ids: string[]) => (onViewGroup ? () => onViewGroup(ids) : undefined)
  const none = q && [groups.whole, groups.part.map((x) => x.p), groups.noTimes, groups.maybe, groups.out, groups.noReply].every((g) => !g.some(hit))
  // the people who have not answered: no times yet while deciding, no reply once locked
  const silent = locked ? groups.noReply : groups.noTimes

  // the people on the left, as faces; when they are around, on the right. Below lg the
  // two stack, the people first.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        {event.participants.length > 12 && (
          <label className="flex h-11 items-center gap-2 rounded-[10px] border border-border bg-s1 px-3 focus-within:border-accent sm:h-9 sm:max-w-[280px]">
            <Search size={14} className="flex-none text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name" aria-label="Find a person" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear" className="grid h-7 w-7 flex-none place-items-center rounded-[6px] text-faint hover:text-text"><X size={13} /></button>}
          </label>
        )}
        {none && <p className="text-[13px] text-faint">Nobody here by that name.</p>}

        <GroupCard label={locked && hasVenue ? (online ? 'On the call the whole time' : 'Here the whole time') : 'Free the whole time'} tone="teal" count={groups.whole.length} onOpen={open(groups.whole.map((p) => p.id))}>
          {groups.whole.length
            ? <FaceGroup people={groups.whole.filter(hit)} size={46} cap={8} onPerson={onPerson} />
            : <p className="text-[13.5px] text-dim">{win ? 'Nobody can stay for all of it yet.' : 'Nobody has marked times yet.'}</p>}
        </GroupCard>

        {groups.part.length > 0 && (
          <GroupCard label={locked && hasVenue ? 'Comes and goes' : 'Free part of the time'} tone="ochre" count={groups.part.length} onOpen={open(groups.part.map((x) => x.p.id))}>
            <RosterGroup bare tone="ochre" label="" people={groups.part.filter((x) => hit(x.p)).map((x) => ({ p: x.p, bar: barsOf(x.segs) }))} axis={axis.length ? axis : undefined} onPerson={onPerson} />
          </GroupCard>
        )}

        {groups.maybe.length > 0 && (
          <GroupCard label="Maybe" tone="ochre" count={groups.maybe.length}>
            <FaceGroup people={groups.maybe.filter(hit)} size={34} cap={10} onPerson={onPerson} />
          </GroupCard>
        )}

        {/* said no, and has not answered: two meanings and two different next steps
            (nothing to do about a no; a nudge for the silent), so two small cards */}
        {(groups.out.length > 0 || silent.length > 0) && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            {groups.out.length > 0 && (
              <GroupCard label="Can’t make it" tone="brick" count={groups.out.length} onOpen={open(groups.out.map((p) => p.id))}>
                <FaceGroup people={groups.out.filter(hit)} size={34} cap={6} onPerson={onPerson} />
              </GroupCard>
            )}
            {silent.length > 0 && (
              <GroupCard
                label={locked ? 'No reply yet' : 'No answer yet'} tone="faint" count={silent.length}
                action={event.hostedByYou ? <CopyReminder event={event} /> : undefined}
              >
                <FaceGroup people={silent.filter(hit)} size={34} cap={6} onPerson={onPerson} />
              </GroupCard>
            )}
          </div>
        )}
      </div>

      {/* beside a long list of people, this column stays in view as you scroll: the gap
          under it is the room it travels in, not space to fill */}
      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[78px]">
        <section className="rounded-2xl border border-border bg-s1 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint sm:text-[11px]">When people are here</span>
            <span className="flex items-center gap-1">
              {!locked && <BestWindowInfo mode={event.bestMode ?? 'full'} />}
              {onQuorum && <QuorumControl quorum={quorum} max={event.participants.length} onChange={onQuorum} />}
            </span>
          </div>
          <LeadingPlace event={event} onGoToTab={onGoToTab} />
          {win
            ? <HeadcountBars attendees={pool} dayIv={dayIv} gridStart={gridStart} step={step} winS={winS} winE={winE} quorum={quorum} />
            : <div className="rounded-xl border border-border bg-s0 px-4 py-6 text-center text-[13.5px] text-dim">Add availability to see who is around when.</div>}
          {quorum != null && win && <QuorumStatus quorum={quorum} whole={groups.whole.length} />}
        </section>
        {shift && <ShiftSuggestion shift={shift} />}
        {/* explicit "none of these days work" replies are the signal to widen the window */}
        {!locked && unavailSet.size > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-ochre-border bg-ochre-bg px-3.5 py-2.5 text-[13px] leading-[1.5] text-ochre-text">
            <TriangleAlert size={14} className="mt-0.5 flex-none" />
            <span>{unavailSet.size === 1 ? '1 person isn’t' : `${unavailSet.size} people aren’t`} free on any of these days. Widening the date window could bring them in.</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* One group of people as a card: a coloured eyebrow says which group (teal here the
   whole time, ochre comes and goes, brick can't make it, plain no answer), the count
   sits beside it, and the label opens the grid filtered to these people. */
function GroupCard({ label, tone, count, onOpen, action, children }: {
  label: string; tone: 'teal' | 'ochre' | 'brick' | 'faint'; count: number
  onOpen?: () => void; action?: ReactNode; children: ReactNode
}) {
  const ink = { teal: 'text-teal-text', ochre: 'text-ochre-text', brick: 'text-brick-text', faint: 'text-faint' }[tone]
  const eyebrow = `text-[12px] font-semibold uppercase tracking-[.13em] sm:text-[11px] ${ink}`
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-s1 p-5">
      <div className="mb-4 flex min-h-7 items-center gap-2">
        {onOpen ? (
          <button type="button" onClick={onOpen} title="See them on the availability grid" className={`flex items-center gap-1.5 hover:underline ${eyebrow}`}>
            {label} <CalendarRange size={13} className="text-faint" aria-hidden />
          </button>
        ) : <span className={eyebrow}>{label}</span>}
        <span className="text-[13px] text-dim">{count}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  )
}

/* The people in a group as faces, each with a first name under it, straight and flat
   (this is a list you read, not a moment). A face turns over to its initials; the
   name opens their times on the grid. It stops at `cap` faces with a "+N" that opens
   the whole group as a compact list, so a group of a hundred draws a handful. */
function FaceGroup({ people, size, cap, onPerson }: { people: Participant[]; size: number; cap: number; onPerson?: (pid: string) => void }) {
  const [all, setAll] = useState(false)
  if (!people.length) return null
  if (all) return <RosterGroup bare compact tone="faint" label="" people={people.map((p) => ({ p }))} onPerson={onPerson} />
  const shown = people.slice(0, cap)
  const extra = people.length - shown.length
  const first = (p: Participant) => (p.you ? 'You' : p.name.split(' ')[0])
  // the faces turn over together (one button over the row); each name stays its own
  // button, above it, and opens that person's times
  return (
    <FlipGroup overlay names={namesLabel(shown.map((p) => (p.you ? 'you' : p.name)), extra)}>
    <ul className="flex flex-wrap gap-x-3 gap-y-3.5">
      {shown.map((p) => (
        <li key={p.id} className="flex flex-col items-center gap-1.5" style={{ width: Math.max(size + 8, 52) }}>
          <Avatar initials={p.initials} color={p.color} face={p.face} size={size} font={Math.round(size * 0.34)} title={p.name} flippable />
          <button
            type="button" onClick={onPerson ? () => onPerson(p.id) : undefined} disabled={!onPerson}
            title={onPerson ? `See when ${p.name} is free` : undefined}
            className="relative z-[2] max-w-full truncate rounded-[6px] px-1 text-[12.5px] text-dim before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] enabled:hover:bg-s2 enabled:hover:text-text sm:before:-inset-y-1"
          >
            {first(p)}
          </button>
        </li>
      ))}
      {extra > 0 && (
        <li className="flex flex-col items-center gap-1.5" style={{ width: Math.max(size + 8, 52) }}>
          <button
            type="button" onClick={() => setAll(true)} aria-label={`Show all ${people.length}`}
            className="relative z-[2] grid flex-none place-items-center rounded-full bg-s3 font-semibold text-dim hover:text-text"
            style={{ width: size, height: size, boxShadow: '0 0 0 2px var(--face-edge)', fontSize: Math.max(12, Math.round(size * 0.3)) }}
          >
            +{extra}
          </button>
          <span className="text-[12.5px] text-faint">more</span>
        </li>
      )}
    </ul>
    </FlipGroup>
  )
}

function BestWindowInfo({ mode }: { mode: BestMode }) {
  return (
    <Popover width={240} align="end" label="How the best time is picked" trigger={() => <Info size={13} className="text-faint hover:text-dim" />}>
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

/* host-set minimum headcount — the tab warns when fewer can stay the whole time.
   In the settings kit like every tab's settings: the chip names the value, the
   switch turns the warning on, and the stepper sets the number as you go */
function QuorumControl({ quorum, max, onChange }: { quorum: number | null; max: number; onChange: (q: number | null) => void }) {
  const top = Math.max(2, max, quorum ?? 0)
  return (
    <SettingsMenu title="Attendance settings" button={quorum != null ? `Need ${quorum}` : 'Settings'}>
      {() => (
        <>
          <SettingToggle
            label="Minimum headcount"
            on={quorum != null}
            onChange={(on) => onChange(on ? Math.min(top, Math.max(2, Math.ceil(max / 2))) : null)}
            hint="Warns when fewer can stay the whole time."
          />
          {quorum != null && (
            <SettingField label="At least">
              <SettingStepper label="Minimum headcount" value={quorum} max={top} onChange={(n) => onChange(Math.min(top, Math.max(1, n)))} of={`of ${max}`} />
            </SettingField>
          )}
        </>
      )}
    </SettingsMenu>
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
          <div className="truncate text-[14.5px] font-semibold">Online</div>
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
                key={i} type="button" aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)}
                aria-label={`${fmtMinute(gridStart + winS + i * step)}, ${c} of ${attendees.length} free`}
                className={`grid min-w-0 flex-1 place-items-center text-[12px] font-semibold tabular-nums focus-visible:-outline-offset-2 ${i > 0 ? 'border-l border-bg/60' : ''} ${sel === i ? 'ring-2 ring-inset ring-accent' : ''}`}
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
function RosterGroup({ label, tone, people, cap: capIn, compact, bare, action, onPerson, onOpenGroup, hint, axis }: {
  label: string; tone: keyof typeof TONE | string
  compact?: boolean
  // no heading of its own: it sits inside a GroupCard, which names the group
  bare?: boolean
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
    <button type="button" aria-expanded={all} onClick={() => setAll((a) => !a)} className="relative h-8 self-start rounded-full px-1 text-[12.5px] font-semibold text-accent-text before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:underline">
      {all ? 'Show fewer' : `Show all ${people.length}`}
    </button>
  ) : null
  const hasBars = people.some((x) => x.bar !== undefined)
  return (
    <div>
      {!bare && <div className="mb-2 flex items-center gap-2">
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
      </div>}
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
              <Avatar initials={p.initials} color={p.color} face={p.face} size={24} font={9} />
              <span className="min-w-0 truncate text-[13px]">{p.name}{p.you && <span className="text-faint"> (You)</span>}</span>
            </button>
          ))}
          {more}
        </div>
      ) : (
      <div className="flex flex-col gap-1.5">
        {shown.map(({ p, note, bar }) => (
          <div key={p.id} className="flex items-center gap-2.5">
            {/* the face turns over to show the initials; the name opens their times */}
            <span className={`flex min-w-0 items-center gap-2.5 ${hasBars ? 'w-[42%] sm:w-[160px] flex-none' : 'flex-1'}`}>
              <Avatar initials={p.initials} color={p.color} face={p.face} size={27} font={10} title={p.name} flippable />
              <button
                type="button" onClick={onPerson ? () => onPerson(p.id) : undefined} disabled={!onPerson}
                title={onPerson ? `See when ${p.name} is free` : undefined}
                className={`flex min-h-[27px] min-w-0 flex-1 items-center rounded-[8px] text-left ${onPerson ? '-mx-1 px-1 py-0.5 hover:bg-s2' : ''}`}
              >
                <span className="min-w-0 flex-1 truncate text-[14px]">{p.name}{p.you && <span className="text-faint"> (You)</span>}</span>
              </button>
            </span>
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
    <>
      <button onClick={copy} className={`flex h-11 sm:h-7 items-center gap-1.5 rounded-full border px-2 text-[12px] font-semibold ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 text-dim hover:bg-s2'}`}>
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy a reminder</>}
      </button>
      <Announce text={copied ? 'Reminder copied' : ''} />
    </>
  )
}

/* ── Multi-stop itinerary: O(1) per stop, exceptions not a matrix ──
   Worked out once (useItinerary) and read twice: the tab's heading sentence and the
   view below. Per stop: who is around for all of it, part of it, or none of it. Then
   the people who miss a stop, grouped by which stops they miss, so the list grows with
   the patterns (a handful) rather than the guest list. */
type StopRow = { i: number; name: string; arrive: number; depart: number; present: Participant[]; partial: Participant[]; absent: Participant[] }
type GapGroup = { key: string; names: string[]; label: string; people: Participant[] }
function useItinerary(event: AppEvent, attendees: Participant[], dayIv: Record<string, Iv[]>, gridStart: number) {
  const placeName = (id: string) => event.location.places.find((p) => p.id === id)?.name ?? 'Stop'
  const stops = useMemo(() => event.itinStops ?? [], [event.itinStops])
  const dwell = event.itinDwell ?? []
  const startMin = event.itinStartMin ?? 9 * 60
  // the same road route the Location tab uses (shared cache), so travel minutes agree
  const stopPoints = stops.map((id) => coordsOf(event.location.places.find((p) => p.id === id)))
  const routable: LatLng[] = stopPoints.every((p): p is LatLng => !!p) ? stopPoints : []
  const road = useRoute(routable)

  // schedule + per-stop attendance, computed once (O(stops × people)). The schedule comes from
  // the shared helper, so these clock times match the Location tab exactly.
  const stopData: StopRow[] = useMemo(() => {
    if (!stops.length) return []
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
      return { name: placeName(s.placeId), i, arrive: s.arrive, depart: s.depart, present, partial, absent }
    })
  }, [stops, dwell, startMin, gridStart, attendees, dayIv, event.location.places, event.travelModes, road]) // eslint-disable-line react-hooks/exhaustive-deps

  // people missing at least one stop → grouped by which stops (never an O(people × stops) grid)
  const { everyStop, gapGroups } = useMemo(() => {
    const missesOf = new Map<string, number[]>()
    for (const s of stopData) for (const p of s.absent) missesOf.set(p.id, [...(missesOf.get(p.id) ?? []), s.i])
    const by = new Map<string, GapGroup>()
    for (const p of attendees) {
      const misses = missesOf.get(p.id)
      if (!misses) continue
      const key = misses.join(',')
      if (!by.has(key)) {
        const names = misses.map((n) => stopData[n]?.name ?? `stop ${n + 1}`)
        const label = misses.length === stopData.length ? 'Misses every stop' : `Misses ${joinNames(names)}`
        by.set(key, { key, names, label, people: [] })
      }
      by.get(key)!.people.push(p)
    }
    return {
      everyStop: attendees.filter((p) => !missesOf.has(p.id)),
      gapGroups: [...by.values()].sort((x, y) => y.people.length - x.people.length),
    }
  }, [stopData, attendees])
  return { stopData, everyStop, gapGroups }
}
const joinNames = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '')
type Itin = ReturnType<typeof useItinerary>

// the heading for the route: how many make all of it, and the biggest gap said plainly
function itinTitle(itin: Itin, total: number): string {
  const all = `${itin.everyStop.length} of ${total} make every stop.`
  const g = itin.gapGroups[0]
  if (!g) return 'Everyone makes every stop.'
  const n = g.people.length
  return g.names.length === itin.stopData.length
    ? `${all} ${n} can’t make any of it.`
    : `${all} ${n} ${n === 1 ? 'misses' : 'miss'} ${joinNames(g.names)}.`
}

function ItineraryAttendance({ itin, total, onPerson, onViewGroup }: {
  itin: Itin; total: number; onPerson?: (pid: string) => void; onViewGroup?: (pids: string[]) => void
}) {
  const { stopData, everyStop, gapGroups } = itin
  const open = (ids: string[]) => (onViewGroup ? () => onViewGroup(ids) : undefined)
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      {/* the route top to bottom: each stop's time, a bar of who is there for all of it
          and for part of it, a capped pile of faces, and a flag where something is off */}
      <section className="min-w-0 rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint sm:text-[11px]">Stop by stop</span>
          <span className="text-[13px] text-dim">{stopData.length} {stopData.length === 1 ? 'stop' : 'stops'}</span>
        </div>
        <ol>
          {stopData.map((s) => {
            const whole = s.present.length - s.partial.length
            return (
              <li key={s.i} className={`grid grid-cols-[30px_minmax(0,1fr)] gap-3.5 py-4 ${s.i > 0 ? 'border-t border-border' : ''}`}>
                <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-accent text-[13px] font-bold text-on-accent">{s.i + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-[15px] font-semibold">{s.name}</span>
                    <span className="text-[13px] text-dim">{fmtMinuteDay(s.arrive)} to {fmtMinuteDay(s.depart)}</span>
                  </div>
                  <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-s2" role="img" aria-label={`${whole} there for all of it, ${s.partial.length} for part of it, out of ${total}`}>
                    <span className="bg-teal" style={{ width: pct(whole) }} />
                    <span className="bg-ochre" style={{ width: pct(s.partial.length) }} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <AvatarPile people={s.present} cap={6} />
                    <span className="text-[13px] text-dim">{s.present.length} of {total} here</span>
                    <span className="ml-auto flex flex-wrap gap-1.5">
                      {s.partial.length > 0 && <Flag tone="ochre">{s.partial.length} for part of it</Flag>}
                      {s.absent.length > 0 && <Flag tone="brick">{s.absent.length} miss it</Flag>}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[12.5px] text-dim" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-teal" />There for all of it</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-ochre" />Part of it</span>
        </div>
      </section>

      {/* who makes all of it, then the gaps, grouped by the stops they miss */}
      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[78px]">
        <GroupCard label="Every stop" tone="teal" count={everyStop.length} onOpen={open(everyStop.map((p) => p.id))}>
          {everyStop.length
            ? <FaceGroup people={everyStop} size={42} cap={8} onPerson={onPerson} />
            : <p className="text-[13.5px] text-dim">Nobody makes all of it yet.</p>}
        </GroupCard>
        {gapGroups.map((g) => (
          <GroupCard key={g.key} label={g.label} tone="ochre" count={g.people.length} onOpen={open(g.people.map((p) => p.id))}>
            <FaceGroup people={g.people} size={34} cap={6} onPerson={onPerson} />
          </GroupCard>
        ))}
      </div>
    </div>
  )
}

function AvatarPile({ people, cap }: { people: Participant[]; cap: number }) {
  const shown = people.slice(0, cap)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center" role={people.length ? 'img' : undefined} aria-label={people.length ? namesLabel(shown.map((p) => p.name), extra) : undefined}>
      {shown.map((p) => <span key={p.id} className="-mr-1.5 flex"><Avatar initials={p.initials} color={p.color} face={p.face} size={25} font={9.5} /></span>)}
      {extra > 0 && <span aria-hidden className="ml-2.5 text-[12.5px] font-semibold text-dim">+{extra}</span>}
      {people.length === 0 && <span className="text-[12.5px] text-faint">nobody yet</span>}
    </div>
  )
}

function Flag({ tone, children }: { tone: 'ochre' | 'brick'; children: React.ReactNode }) {
  const cls = tone === 'ochre' ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-brick-border bg-brick-bg text-brick-text'
  return <span className={`flex items-center gap-1 rounded-[6px] border px-1.5 py-px text-[10.5px] font-semibold ${cls}`}>{tone === 'brick' && <TriangleAlert size={10} />}{children}</span>
}

/* Nobody else has answered yet: the tab's one moment. A taped photo of the group as
   it stands (your face, and dashed spots where the others go), and beside it what
   happens next. When your own times are missing, a margin note points at the button
   that fixes that. The host also gets the invite link, since inviting is theirs. */
function WaitingOnGroup({ event, me, mineMissing, locked, onGoToTab }: {
  event: AppEvent; me?: Participant; mineMissing: boolean; locked: boolean; onGoToTab?: GoTab
}) {
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const note = useRef<HTMLSpanElement>(null)
  const task = useRef<HTMLButtonElement>(null)
  function copy() {
    navigator.clipboard?.writeText(`${window.location.origin}/events/${event.id}/join`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  const slot = 'flex-none rounded-full border-[2.5px] border-dashed border-border2'
  return (
    <div className="flex flex-col gap-8 py-2 md:flex-row md:items-center md:gap-14">
      <PhotoFrame tilt={2} tape="right" className="w-full max-w-[360px] flex-none self-center md:self-auto">
        <div className="flex h-[176px] items-center justify-center gap-3 rounded-lg bg-s2 sm:h-[196px] sm:gap-4">
          <span className={`${slot} h-12 w-12 sm:h-14 sm:w-14`} />
          <span className={`${slot} h-12 w-12 translate-y-2 sm:h-14 sm:w-14`} />
          {me
            ? <Avatar initials={me.initials} color={me.color} face={me.face} size={56} font={19} title={me.name} />
            : <span className={`${slot} h-12 w-12 sm:h-14 sm:w-14`} />}
          <span className={`${slot} h-12 w-12 translate-y-1.5 sm:h-14 sm:w-14`} />
        </div>
        <p className="px-1 pt-3 font-serif text-[15px] italic text-dim">Just you so far.</p>
      </PhotoFrame>

      <div ref={box} className="relative max-w-[460px]">
        <h3 className="font-serif text-[30px] font-normal leading-[1.15] tracking-[-0.01em] sm:text-[36px]">Waiting on the group</h3>
        <p className="mt-3 text-[15px] leading-[1.6] text-dim">
          {locked
            ? 'Nobody else has replied yet. Once they do, who is coming shows up here.'
            : 'Nobody else has marked their times yet. Once they do, who can come shows up here.'}
        </p>
        {/* the margin note, only for what you owe: your own times */}
        {mineMissing && <HandNote ref={note} className="ml-24 mt-5 lg:-rotate-2">your times are missing</HandNote>}
        <div className={`${mineMissing ? 'mt-7' : 'mt-6'} flex flex-col gap-2.5 sm:flex-row`}>
          {mineMissing && (
            <button ref={task} type="button" onClick={() => onGoToTab?.('availability')} className="flex h-11 items-center justify-center rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent sm:h-10">
              Mark my times
            </button>
          )}
          {event.hostedByYou && !event.demo && (
            <button type="button" onClick={copy} className={`flex h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold sm:h-10 ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 hover:bg-s2'}`}>
              {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy invite link</>}
            </button>
          )}
        </div>
        {mineMissing && <PencilArrow from={note} to={task} within={box} max={120} />}
        <Announce text={copied ? 'Invite link copied' : ''} />
      </div>
    </div>
  )
}
