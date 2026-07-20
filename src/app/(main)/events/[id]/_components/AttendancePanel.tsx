'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { CalendarRange, Check, ChevronRight, Clock, Copy, Info, MapPin, TriangleAlert, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Popover } from '@/components/ui/Popover'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { tzAbbr } from '@/components/ui/TimezonePill'
import {
  availIvOf, bestWindow, byYouFirst, dayLabel, gridStartMinOf, fmtMinute, leadingPlaceOf, patchEvent, setMyRsvp, stepOf,
  type AppEvent, type Iv, type Participant, type Rsvp,
} from '@/lib/events'
import { computeItinerary } from '@/lib/itinerary'
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
    setParticipants((ps) => ps.map((p) => (p.you ? { ...p, rsvp: r } : p)))
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
      return { s: c.startMin - gridStart, e: c.endMin - gridStart, dayKey: c.dayKey, dayLabel: d ? `${d.dow}, ${d.date}` : c.dayKey }
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

  // event with the live participant list, so child views read the same list this tab edits
  const liveEvent = useMemo(() => ({ ...event, participants }), [event, participants])

  return (
    <div className="flex flex-col gap-4">
      {/* "are you coming" is a locked-stage question; while planning, the ask is your times */}
      {locked
        ? me?.rsvp === 'pending' && <YourRsvpStrip onPick={changeRsvp} full={full} />
        : !markedIds.has('JM') && <YourTimesStrip onGo={() => onGoToTab?.('availability')} />}

      {/* header — friendly summary, share button, and (only when relevant) the model switch */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <RsvpSummary participants={participants} capacity={event.capacity} locked={locked} />
        <div className="flex flex-wrap items-center gap-2">
          <CopySummaryButton event={liveEvent} win={win} locked={locked} gridStart={gridStart} />
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

      {!anyResponded ? (
        <EmptyState onGoToTab={onGoToTab} />
      ) : model === 'itin' && hasItinerary ? (
        <ItineraryAttendance event={liveEvent} attendees={attendees} dayIv={dayIv} gridStart={gridStart} onPerson={onViewAvailability} />
      ) : (
        <SingleVenue
          event={liveEvent} attendees={attendees} win={win} locked={locked} dayIv={dayIv}
          gridStart={gridStart} step={step} rows={rows}
          quorum={quorum} onQuorum={event.hostedByYou ? changeQuorum : undefined}
          onGoToTab={onGoToTab} onPerson={onViewAvailability} onViewGroup={onViewAvailabilityGroup} markedIds={markedIds} onGoToBestWindow={onGoToBestWindow}
        />
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
          className="h-8 rounded-[8px] bg-accent px-3 text-[13px] font-semibold text-on-accent disabled:opacity-40"
        >
          Going
        </button>
        <button onClick={() => onPick('maybe')} className="h-8 rounded-[8px] border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2">Maybe</button>
        <button onClick={() => onPick('not_going')} className="h-8 rounded-[8px] border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2">Can&apos;t go</button>
      </div>
    </div>
  )
}

/* ── shared: RSVP figure (borderless, open stats). One sentence, not a number soup:
   the big figure is going, the caption walks through everyone else. ── */
function RsvpSummary({ participants, capacity, locked }: { participants: Participant[]; capacity?: number; locked: boolean }) {
  const going = participants.filter((p) => p.rsvp === 'attending').length
  const maybe = participants.filter((p) => p.rsvp === 'maybe').length
  const out = participants.filter((p) => p.rsvp === 'not_going').length
  const noReply = participants.filter((p) => p.rsvp === 'pending').length
  const total = participants.length
  const full = capacity != null && going >= capacity
  const rest: React.ReactNode[] = []
  // "maybe" belongs to the locked-stage RSVP round; planning has no such state
  if (locked && maybe > 0) rest.push(<span key="m" className="text-ochre-text">{maybe} maybe</span>)
  if (out > 0) rest.push(<span key="o" className="text-brick-text">{out} can&apos;t</span>)
  if (noReply > 0) rest.push(<span key="n" className="text-faint">{noReply} no reply</span>)
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-[42.5px] leading-none">{going}</span>
        <span className="text-[14.5px] text-dim">{locked ? 'going' : 'available'}</span>
        {capacity != null && (
          <span className={`rounded-[6px] border px-1.5 py-px text-[11px] font-semibold ${full ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-teal-border bg-teal-bg text-teal-text'}`}>
            {full ? `full · ${capacity} spots` : `${capacity - going} of ${capacity} spots left`}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-dim">
        <span>{total} invited</span>
        {rest.map((r, i) => <span key={i} className="flex items-center gap-1.5"><span className="text-faint">·</span>{r}</span>)}
      </div>
    </div>
  )
}

/* one-tap summary for the group chat: headcount, window, and the place, as plain text */
function CopySummaryButton({ event, win, locked, gridStart }: { event: AppEvent; win: Win | null; locked: boolean; gridStart: number }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    const going = event.participants.filter((p) => p.rsvp === 'attending').length
    const parts = [`${event.title}: ${going} of ${event.participants.length} ${locked ? 'going' : 'available'}`]
    if (win) parts.push(`${locked ? 'confirmed for' : 'best window'} ${win.dayLabel}, ${fmtMinute(gridStart + win.s)}–${fmtMinute(gridStart + win.e)} ${tzAbbr(event.timezone)}`)
    const lead = leadingPlaceOf(event)
    if (lead) parts.push(lead.confirmed ? `at ${lead.place.name}` : `leading place: ${lead.place.name}`)
    navigator.clipboard?.writeText(parts.join(' · ')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <button onClick={copy} className={`flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 hover:bg-s2'}`}>
      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy summary</>}
    </button>
  )
}

/* ── Single venue: where it's happening, who's in the room, and when ── */
function SingleVenue({
  event, attendees, win, locked, dayIv, gridStart, step, rows, quorum, onQuorum, onGoToTab, onPerson, onViewGroup, markedIds, onGoToBestWindow,
}: {
  event: AppEvent; attendees: Participant[]; win: Win | null; locked: boolean
  dayIv: Record<string, Iv[]>; gridStart: number; step: number; rows: number
  quorum: number | null; onQuorum?: (q: number | null) => void
  onGoToTab?: GoTab; onPerson?: (pid: string) => void; onViewGroup?: (pids: string[]) => void; onGoToBestWindow?: () => void
  markedIds: Set<string>
}) {
  const winS = win?.s ?? 0
  const winE = win?.e ?? rows * step
  // which roster group to show; everyone by default
  const [showGroup, setShowGroup] = useState<'all' | 'whole' | 'part' | 'noTimes' | 'maybe' | 'out' | 'noReply'>('all')

  // group attendees by how their availability lines up with the event window — RSVP leads,
  // availability splits "going" into whole-time, part-time, and honest silence: someone who
  // never marked times is NOT assumed present the whole time.
  const groups = useMemo(() => {
    const whole: Participant[] = [], part: { p: Participant; segs: Iv[] | null }[] = []
    const noTimes: Participant[] = [], maybe: Participant[] = [], out: Participant[] = [], noReply: Participant[] = []
    for (const p of event.participants) {
      if (p.rsvp === 'not_going') { out.push(p); continue }
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
      const labeled = m % 60 === 0 && span >= 120 && pct > 14 && pct < 86
      axis.push({ pct, label: labeled ? short(gridStart + m) : undefined })
    }
  }

  // a nearby start that lets more people stay the whole time. The best window can't be
  // beaten by a shift, so this mostly speaks up when the confirmed time isn't the best one.
  const shift = useMemo(() => {
    if (!win) return null
    const fullCount = (s: number, e: number) => attendees.filter((p) => (dayIv[p.id] ?? []).some((iv) => iv.s <= s && iv.e >= e)).length
    const cur = fullCount(winS, winE)
    if (cur >= attendees.length) return null
    let found: { d: number; count: number } | null = null
    for (const d of [-120, -90, -60, -45, -30, -15, 15, 30, 45, 60, 90, 120]) {
      const s = winS + d, e = winE + d
      if (s < 0 || e > rows * step) continue
      const c = fullCount(s, e)
      if (c > cur && (!found || c > found.count || (c === found.count && Math.abs(d) < Math.abs(found.d)))) found = { d, count: c }
    }
    return found ? { d: found.d, gain: found.count - cur } : null
  }, [win, winS, winE, attendees, dayIv, rows, step])

  return (
    <div className="rounded-2xl border border-border bg-s1 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{locked ? 'Who’s coming' : 'Who’s available'}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {win && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-dim">
              {locked ? 'Confirmed time' : 'Best window'} ·{' '}
              {locked
                ? <span>{win.dayLabel}, {fmtMinute(gridStart + winS)}–{fmtMinute(gridStart + winE)}</span>
                : <button type="button" onClick={() => (onGoToBestWindow ? onGoToBestWindow() : onGoToTab?.('availability'))} className="font-semibold text-ochre hover:underline">{win.dayLabel}, {fmtMinute(gridStart + winS)}–{fmtMinute(gridStart + winE)}</button>}
              {!locked && <BestWindowInfo />}
            </div>
          )}
          {onQuorum && <QuorumControl quorum={quorum} onChange={onQuorum} />}
        </div>
      </div>

      <LeadingPlace event={event} onGoToTab={onGoToTab} />

      {win
        ? <HeadcountBars attendees={attendees} dayIv={dayIv} gridStart={gridStart} step={step} rows={rows} winS={winS} winE={winE} locked={locked} quorum={quorum} onGoToTab={onGoToTab} onGoToBestWindow={onGoToBestWindow} />
        : <div className="rounded-xl border border-border bg-s0 px-4 py-6 text-center text-[13.5px] text-dim">Add availability to see who is around when.</div>}

      {quorum != null && win && <QuorumStatus quorum={quorum} whole={groups.whole.length} />}
      {shift && <ShiftSuggestion shift={shift} />}

      {/* pick one group or read them all — the chips double as a headcount per group */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
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
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${on ? 'border-accent bg-accent text-on-accent' : 'border-border bg-s1 text-dim hover:border-border2 hover:text-text'}`}
            >
              {l} <span className={on ? 'opacity-80' : 'text-faint'}>{n}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {(showGroup === 'all' || showGroup === 'whole') && <RosterGroup label={locked && hasVenue ? 'Here the whole time' : 'Free the whole time'} tone="teal" people={groups.whole.map((p) => ({ p }))} onPerson={onPerson} onOpenGroup={onViewGroup ? () => onViewGroup(groups.whole.map((p) => p.id)) : undefined} />}
        {(showGroup === 'all' || showGroup === 'part') && <RosterGroup label={locked && hasVenue ? 'Part of the time' : 'Free part of the time'} tone="ochre" people={groups.part.map((x) => ({
          p: x.p,
          bar: barsOf(x.segs),
        }))} axis={axis.length ? axis : undefined} onPerson={onPerson} onOpenGroup={onViewGroup ? () => onViewGroup(groups.part.map((x) => x.p.id)) : undefined} />}
        {(showGroup === 'all' || showGroup === 'noTimes') && <RosterGroup label={locked ? 'Going, no times yet' : 'No times yet'} tone="faint" hint={locked ? "They said yes but haven't marked when they're free, so the best window can't count them." : "They haven't marked when they're free, so the best window can't count them."} people={groups.noTimes.map((p) => ({ p }))} action={!locked && groups.noTimes.length > 0 ? <CopyReminder event={event} /> : undefined} onPerson={onPerson} onOpenGroup={onViewGroup ? () => onViewGroup(groups.noTimes.map((p) => p.id)) : undefined} />}
        {(showGroup === 'all' || showGroup === 'maybe') && <RosterGroup label="Maybe" tone="ochre" people={groups.maybe.map((p) => ({ p }))} onPerson={onPerson} />}
        {/* two flavors of decline, told apart by the grid: never entered times vs
            entered times that all miss this window */}
        {(showGroup === 'all' || showGroup === 'out') && <RosterGroup label="Can't make it" tone="brick" people={groups.out.map((p) => ({
          p,
          note: markedIds.has(p.id) ? 'has times, none in this window' : 'never entered times',
        }))} onPerson={onPerson} onOpenGroup={onViewGroup ? () => onViewGroup(groups.out.map((p) => p.id)) : undefined} />}
        {(showGroup === 'all' || showGroup === 'noReply') && <RosterGroup label="No reply" tone="faint" people={groups.noReply.map((p) => ({ p }))} action={<CopyReminder event={event} />} onPerson={onPerson} />}
      </div>
    </div>
  )
}

function BestWindowInfo() {
  return (
    <Popover width={264} align="end" trigger={() => <Info size={13} className="text-faint hover:text-dim" />}>
      {() => (
        <p className="p-1 text-[12.5px] leading-[1.55] text-dim">
          The best window is the time when the most people are free for the whole event. It updates as people fill in the Availability tab.
        </p>
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
      <span className={`flex h-7 items-center gap-1.5 rounded-[8px] border border-border2 px-2.5 text-[12px] font-semibold ${open ? 'bg-s2' : 'bg-s1 hover:bg-s2'}`}>
        <Users size={13} /> {quorum != null ? `Need ${quorum}` : 'Set a minimum'}
      </span>
    )}>
      {(close) => (
        <div className="p-1">
          <div className="text-[13px] font-semibold">How many people make it worth it?</div>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-dim">This tab warns you when fewer than this can stay the whole time.</p>
          <div className="mt-2.5 flex items-center gap-2">
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
          {lead.place.place}{!(event.location.settled || (lead.confirmed && voters.length === 0)) && <> · {voters.length} {voters.length === 1 ? 'vote' : 'votes'}</>}
          {lead.margin != null && lead.margin > 0 && <span> · ahead by {lead.margin}</span>}
          {lead.margin === 0 && <span className="text-ochre-text"> · tied for first</span>}
        </span>
      </span>
      {!event.hideVoters && <AvatarPile people={voters} cap={5} />}
      <ChevronRight size={16} className="flex-none text-faint" />
    </button>
  )
}

/* Headcount through the day — how many attendees are free per slot; tap a bar for the numbers */
function HeadcountBars({
  attendees, dayIv, gridStart, step, rows, winS, winE, locked, quorum, onGoToTab, onGoToBestWindow,
}: {
  attendees: Participant[]; dayIv: Record<string, Iv[]>; gridStart: number; step: number; rows: number
  winS: number; winE: number; locked: boolean; quorum: number | null; onGoToTab?: GoTab; onGoToBestWindow?: () => void
}) {
  const [sel, setSel] = useState<number | null>(null)
  const counts = useMemo(() => Array.from({ length: rows }, (_, ti) => {
    const s = ti * step, e = (ti + 1) * step
    return attendees.filter((p) => (dayIv[p.id] ?? []).some((iv) => iv.s < e && iv.e > s)).length
  }), [attendees, dayIv, rows, step])
  const peak = Math.max(1, ...counts)
  const total = Math.max(1, attendees.length)
  const quorumPct = quorum != null ? Math.min(100, (quorum / peak) * 100) : null

  return (
    <div>
      <div className="relative">
        {sel != null && (
          <div
            className="pointer-events-none absolute -top-1.5 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[8px] border border-border bg-s1 px-2.5 py-1.5 text-[12px] shadow-soft"
            style={{ left: `${Math.min(88, Math.max(12, ((sel + 0.5) / rows) * 100))}%` }}
          >
            <span className="font-semibold">{fmtMinute(gridStart + sel * step)}</span> · {counts[sel]} of {total} free
          </div>
        )}
        <div className="flex h-16 items-end gap-[2px]">
          {counts.map((c, i) => {
            const frac = c / total
            const bg = frac === 0 ? 'var(--s2)' : frac >= 0.85 ? 'var(--teal)' : frac >= 0.5 ? '#9DBBA4' : frac >= 0.25 ? '#CFE0D2' : '#EBF1EB'
            return (
              <button
                key={i} onClick={() => setSel(sel === i ? null : i)}
                aria-label={`${fmtMinute(gridStart + i * step)}, ${c} of ${total} free`}
                className={`flex-1 rounded-t-[2px] ${sel === i ? 'outline outline-1 outline-[--accent]' : ''}`}
                style={{ height: `${Math.max(6, (c / peak) * 100)}%`, background: bg }}
                title={`${fmtMinute(gridStart + i * step)} · ${c} free`}
              />
            )
          })}
        </div>
        {quorumPct != null && (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ochre" style={{ bottom: `${quorumPct}%` }}>
            <span className="absolute right-0 top-0 rounded-[4px] bg-s1/85 px-1 text-[10px] font-semibold text-ochre-text">need {quorum}</span>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
        <span>{fmtMinute(gridStart)}</span>
        <span className="text-dim">{locked ? 'Confirmed' : 'Best window'}{' '}
          {locked
            ? <span>{fmtMinute(gridStart + winS)}–{fmtMinute(gridStart + winE)}</span>
            : <button type="button" onClick={() => (onGoToBestWindow ? onGoToBestWindow() : onGoToTab?.('availability'))} className="font-semibold text-ochre hover:underline">{fmtMinute(gridStart + winS)}–{fmtMinute(gridStart + winE)}</button>}
        </span>
        <span>{fmtMinute(gridStart + rows * step)}</span>
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

function RosterGroup({ label, tone, people, cap = 12, action, onPerson, onOpenGroup, hint, axis }: {
  label: string; tone: keyof typeof TONE | string
  people: { p: Participant; note?: string; bar?: { left: string; width: string; label: string; full: string }[] | null }[]
  cap?: number
  action?: ReactNode
  onPerson?: (pid: string) => void
  onOpenGroup?: () => void
  hint?: string
  axis?: { pct: number; label?: string }[]
}) {
  if (!people.length) return null
  const t = TONE[tone] ?? TONE.faint
  const shown = people.slice(0, cap)
  const extra = people.length - shown.length
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
          {/* tick and time sit side by side on one line; labeled ticks run the full
              height, half-hour ticks stay short and quiet */}
          <div className="relative h-[14px] min-w-0 flex-1">
            {axis.map((t, i) => {
              const end = t.pct >= 99
              return (
                <span
                  key={i}
                  className={`absolute inset-y-0 flex items-center gap-1 ${end ? 'flex-row-reverse' : ''}`}
                  style={end ? { right: 0 } : { left: `calc(${t.pct}% - 0.5px)` }}
                >
                  <span className={`w-px self-stretch ${t.label ? 'bg-faint' : 'my-[3px] bg-border2'}`} />
                  {t.label && <span className="whitespace-nowrap text-[11px] font-medium leading-none text-dim">{t.label}</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}
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
        {extra > 0 && <div className="pl-[34px] text-[12.5px] text-faint">and {extra} more</div>}
      </div>
    </div>
  )
}

/* a ready-made nudge for the group chat, aimed at the people who haven't replied */
function CopyReminder({ event }: { event: AppEvent }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    const deadline = event.voteDeadline ? ` Voting closes ${fmtDeadline(event.voteDeadline)}.` : ''
    const msg = `Quick reminder about ${event.title}! Please mark when you're free and vote on a place: https://aline.app/e/${event.id}${deadline}`
    navigator.clipboard?.writeText(msg).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <button onClick={copy} className={`flex h-7 items-center gap-1.5 rounded-[7px] border px-2 text-[12px] font-semibold ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 text-dim hover:bg-s2'}`}>
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

  // schedule + per-stop attendance, computed once (O(stops × people)). The schedule comes from
  // the shared helper, so these clock times match the Location tab exactly.
  const stopData = useMemo(() => {
    const inputStops = stops.map((placeId, i) => ({ placeId, dwell: dwell[i] ?? 60 }))
    const modes = ((event.travelModes as TravelMode[] | undefined) ?? []).filter((m) => ALL_MODES.includes(m))
    const { schedule } = computeItinerary(event.location.places, inputStops, startMin, modes)
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
  }, [stops, dwell, startMin, gridStart, attendees, dayIv, event.location.places, event.travelModes]) // eslint-disable-line react-hooks/exhaustive-deps

  // people missing at least one stop → the exceptions list (never an O(people × stops) grid)
  const exceptions = useMemo(() => attendees
    .map((p) => ({ p, misses: stopData.filter((s) => s.absent.some((a) => a.id === p.id)).map((s) => s.i + 1) }))
    .filter((x) => x.misses.length > 0), [attendees, stopData])
  const attendAll = attendees.length - exceptions.length
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
              <span className="flex flex-none items-center gap-1 text-[12px] text-faint"><Clock size={11} /> {fmtMinute(s.arrive)}</span>
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

      {/* exceptions — only people with gaps get a row */}
      <div className="rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Gaps</div>
        {exceptions.length === 0 ? (
          <div className="flex items-center gap-2 text-[14px] text-teal-text"><span className="h-1.5 w-1.5 rounded-full bg-teal" /> Everyone going makes every stop.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {exceptions.map(({ p, misses }) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <button
                  type="button" onClick={onPerson ? () => onPerson(p.id) : undefined} disabled={!onPerson}
                  title={onPerson ? `See when ${p.name} is free` : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] text-left ${onPerson ? '-mx-1 px-1 py-0.5 hover:bg-s2' : ''}`}
                >
                  <Avatar initials={p.initials} color={p.color} size={27} font={10} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{p.name}</span>
                </button>
                <div className="flex flex-wrap justify-end gap-1">
                  {misses.map((n) => <span key={n} className="grid h-5 w-5 place-items-center rounded-full border border-brick-border bg-brick-bg text-[10.5px] font-semibold text-brick-text" title={`Misses stop ${n}`}>{n}</span>)}
                </div>
              </div>
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
