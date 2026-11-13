'use client'

import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronDown, Lock, Route, Search, Vote, X } from 'lucide-react'
import { TimeSelect } from '@/components/ui/TimeSelect'
import { DateField } from '@/components/ui/DateField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { canEmail, sendLockedMail } from '@/lib/mail'
import { useAccount } from '@/hooks/useAccount'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { getEvent } from '@/lib/events'
import {
  confirmedSlotText, confirmEvent, fmtMinute, gridStartMinOf, openBest, patchEvent, answeredCount, slotFromRows, stayLine, stepOf,
  type AppEvent, type ConfirmedSlot, type DayRow,
} from '@/lib/events'
import { DayHoursRows } from './DayHoursRows'

/* ── the host's one clear action while planning: lock in whatever is still open ──
   Usually that's a time and a place; when the date was fixed at creation the time
   shows as a fact and only the place is being locked. A centered modal in the same
   shell as the app's other dialogs (eyebrow and title, a body that scrolls, the
   buttons in a bar at the foot), since the backdrop also ends any stacking fights
   with the grid's sticky headers. Mounts fresh each open, so it always starts from
   the best window for everyone, sized to the event length.

   It opens as a summary, not a form: When, Where and RSVP by, each one line with its
   answer already filled in, so the usual lock-in is one look and one press. A row
   with a choice to make has Change, which opens its controls under it; a row with
   nothing to choose (a time set at creation, an online plan) is just the fact. That
   keeps the dialog the same short size whether the plan is one evening or a week of
   days with their own hours, and whether the ballot has two places or twenty. */
// prefill + openNonce let other surfaces hand the modal an answer: the grid's
// "Lock these days" shortcut opens it with the winning run already picked
export type LockPrefill = { dayKey: string; endDayKey?: string }
export function ConfirmBar({ event, onChanged, onGoToLocation, prefill, openNonce, runLen }: {
  event: AppEvent; onChanged: () => void; onGoToLocation?: () => void
  prefill?: LockPrefill | null; openNonce?: number
  // the grid dial's days-in-a-row, so the modal offers a time (1) or a first-to-last run (2+)
  runLen?: number
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (openNonce) setOpen(true) }, [openNonce])
  return (
    <>
      <button
        type="button"
        data-tour="lock"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[14px] font-semibold text-on-accent"
      >
        <Lock size={15} /> {event.confirmed ? 'Lock in the place' : 'Lock it in'}
      </button>
      {/* on the body, so no stacking context the button sits in (the plan header's
          soft shapes make one) can keep the modal under the grid's sticky headers */}
      {open && createPortal(<ConfirmModal event={event} close={() => setOpen(false)} onChanged={onChanged} onGoToLocation={onGoToLocation} prefill={prefill} runLen={runLen} />, document.body)}
    </>
  )
}

type FormProps = { event: AppEvent; close: () => void; onChanged: () => void; onGoToLocation?: () => void; prefill?: LockPrefill | null; runLen?: number }

function ConfirmModal(props: FormProps) {
  const { event, close } = props
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    gsap.timeline()
      .fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' })
      .fromTo(card.current, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, '<')
  }, { scope: root })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useFocusTrap(root)
  const titleId = useId()

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(0,0,0,.25)] p-4"
      onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      {/* explicit viewport cap: the centered grid cell grows with content, so
          max-h-full alone never constrains the card and short phones lose the scroll */}
      <div ref={card} className="flex max-h-[calc(100dvh-32px)] w-full max-w-[420px] flex-col rounded-2xl border border-border bg-s1 shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint">{event.confirmed ? 'Lock in the place' : 'Lock it in'}</div>
            <div id={titleId} className="mt-0.5 truncate text-[15.5px] font-semibold">{event.title}</div>
          </div>
          <button onClick={close} aria-label="Close" className="grid h-11 w-11 flex-none place-items-center rounded-full text-dim hover:bg-s2 hover:text-text sm:h-8 sm:w-8">
            <X size={16} />
          </button>
        </div>
        <ConfirmForm {...props} />
      </div>
    </div>
  )
}

/* one line of the summary: the label, the answer and a quiet line under it, with
   Change on the right when there is a choice to make. Its controls open under it. */
function Row({ label, value, sub, action, open, onToggle, children }: {
  label: string
  value: ReactNode
  sub?: ReactNode
  // the button's word while closed; none when there is nothing to choose
  action?: string
  open?: boolean
  onToggle?: () => void
  children?: ReactNode
}) {
  const panelId = useId()
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-faint">{label}</div>
          <div className="mt-1 text-[14px] font-medium text-text">{value}</div>
          {sub && <div className="mt-0.5 text-[12.5px] text-dim">{sub}</div>}
        </div>
        {action && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!!open}
            aria-controls={panelId}
            className={`-mr-2 h-11 flex-none rounded-full px-3 text-[13px] font-semibold sm:h-8 ${open ? 'text-text hover:bg-s2' : 'text-accent-text hover:bg-accent-bg/60'}`}
          >
            {open ? 'Done' : action}
          </button>
        )}
      </div>
      {open && children && <div id={panelId} className="mt-3 flex flex-col gap-3">{children}</div>}
    </div>
  )
}

const fieldLabel = 'mb-1.5 block text-[12.5px] font-medium text-dim'
const selectCls = 'h-11 w-full appearance-none rounded-[9px] border border-border bg-s1 pl-3 pr-8 text-[13.5px] font-medium outline-none focus:border-accent sm:h-9'

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className={fieldLabel}>{label}</span>
      <span className="relative block">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>{children}</select>
        <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" />
      </span>
    </label>
  )
}

// past this many places the ballot gets a search, the way the grid's people filter does
const PLACE_SEARCH_AT = 8

function ConfirmForm({ event, close, onChanged, onGoToLocation, prefill, runLen }: FormProps) {
  const loc = event.location
  const gridStart = gridStartMinOf(event)
  const duration = event.durationMin ?? 60
  const bw = openBest(event)
  // the last minute anyone can mark: an open end's soft end never runs past it
  const gridEnd = gridStart + event.times.length * stepOf(event.granularity)

  // a date fixed at creation is a fact, not a choice — the form only asks for the place
  const timeSet = event.confirmed ?? null
  // a day poll locks a whole day: no clock times to pick
  const dayPoll = event.granularity === 'day'
  // the grid's days-in-a-row dial decides what gets locked: 1 day locks a time (or a
  // single day on day polls), 2+ locks a first-to-last run of whole days
  const wantRun = runLen ?? (dayPoll ? 2 : 1)
  const runFrom = (start: string): string[] => {
    const i = event.days.findIndex((d) => d.key === start)
    if (i < 0) return [start]
    const out = [start]
    for (let j = i + 1; j < event.days.length; j++) {
      const [y, m, dd] = out[out.length - 1].split('-').map(Number)
      const next = new Date(y, m - 1, dd + 1)
      const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
      if (event.days[j].key !== nextKey) break
      out.push(nextKey)
    }
    return out
  }
  const runMode = wantRun >= 2
  // length unknown: a start and an open end, never a set end
  const openLen = !!event.openLength && !dayPoll
  // how late most of the group can stay from a start, the open end's soft end: from
  // their marks, else two hours, never past the grid
  const softEnd = (k: string, start: number) => {
    const stay = stayLine(event, { dayKey: k, startMin: start, endMin: start })
    return Math.min(stay ? stay.most : start + 120, gridEnd, 24 * 60)
  }

  // best window for everyone, cut to the event length; a handed-in prefill (the grid's
  // "Lock these days" shortcut) beats the computed default
  const [dayKey, setDayKey] = useState(() => prefill?.dayKey ?? timeSet?.dayKey ?? bw?.dayKey ?? event.days[0]?.key ?? event.startDate)
  // a run defaults to the full wanted length; the guard below never offers more
  const [lastDay, setLastDay] = useState(() => prefill?.endDayKey ?? (runMode ? runFrom(prefill?.dayKey ?? dayKey).slice(0, wantRun).at(-1)! : (prefill?.dayKey ?? dayKey)))
  // the guard: last-day choices stop at the dialed N days in a row (and at any gap)
  const lastOptions = runMode ? runFrom(dayKey).slice(0, wantRun) : []
  function changeDay(v: string) {
    setDayKey(v)
    // keep the run valid and inside the wanted length
    setLastDay((l) => {
      const opts = runFrom(v).slice(0, wantRun)
      return opts.includes(l) && l >= v ? l : opts[opts.length - 1]
    })
  }
  const [startMin, setStartMin] = useState(() => timeSet?.startMin ?? (dayPoll ? 0 : bw ? gridStart + bw.s : 18 * 60))
  const [endMin, setEndMin] = useState(() => {
    if (timeSet) return timeSet.endMin
    if (dayPoll) return 24 * 60
    const s = bw ? gridStart + bw.s : 18 * 60
    return Math.min(s + duration, 24 * 60 - 5)
  })
  function changeStart(v: number) {
    setStartMin(v)
    setEndMin((e) => (e <= v ? Math.min(v + duration, 24 * 60 - 5) : e))
  }

  // a run on a timed poll: whole days, or its own hours each day. Each day starts at
  // its own best time; a host's change or skip is kept per day, so moving the run's
  // ends never loses it.
  const [hoursMode, setHoursMode] = useState<'whole' | 'hours'>('hours')
  const setHours = runMode && !dayPoll && hoursMode === 'hours'
  const [rowEdits, setRowEdits] = useState<Record<string, Partial<Omit<DayRow, 'dayKey'>>>>({})
  const runKeys = runMode ? runFrom(dayKey).filter((k) => k <= lastDay) : []
  const rows: DayRow[] = runKeys.map((k) => {
    const day = event.days.find((d) => d.key === k)
    const b = day ? openBest(event, [day]) : null
    const start = b ? gridStart + b.s : startMin
    const end = openLen ? softEnd(k, start) : b ? gridStart + b.e : Math.min(start + duration, 24 * 60 - 5)
    return { dayKey: k, startMin: start, endMin: end, skip: false, ...rowEdits[k] }
  }).map((r) => (openLen && rowEdits[r.dayKey]?.startMin !== undefined ? { ...r, endMin: softEnd(r.dayKey, r.startMin) } : r))
  const keptCount = rows.filter((r) => !r.skip).length
  const dayLabelOf = (k: string) => { const d = event.days.find((x) => x.key === k); return d ? `${d.dow}, ${d.date}` : k }

  // votes rank the ballot; every venue stays pickable, so the host can lock in
  // as many simultaneous spots as the event needs — the leader is preselected.
  // A set venue skips the choice entirely: it locks in as-is.
  const settled = loc.mode === 'set' && loc.places.length > 0
  const votesOf = (id: string) => event.votes?.[id] ?? []
  const ranked = [...loc.places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)
  const [placeIds, setPlaceIds] = useState<string[]>(() => (settled ? loc.places.map((p) => p.id) : ranked[0] ? [ranked[0].id] : []))
  const [placeQ, setPlaceQ] = useState('')

  // an event can have both a ballot and an itinerary — the host locks in one, not both
  const stops = event.itinStops ?? []
  const hasBallot = loc.mode === 'vote' && loc.places.length > 0
  const hasItin = loc.mode === 'vote' && stops.length > 0
  const [source, setSource] = useState<'votes' | 'itin'>(loc.planMode === 'itinerary' && hasItin ? 'itin' : 'votes')

  // the guard on planning → confirmed: a plan only locks with a real when AND a real
  // where. Online counts as a place; "decide later" and an empty or unchecked ballot
  // don't — the host adds or picks one first.
  const placeReady = loc.mode === 'remote'
    || settled
    || (source === 'itin' ? hasItin : hasBallot && placeIds.length > 0)
  const timeReady = !!dayKey && (dayPoll || runMode || openLen || endMin > startMin)
  const blockedReason = !timeReady
    ? 'Pick a day and time first.'
    : setHours && keptCount === 0
      ? 'Keep at least one day.'
    : setHours && !openLen && rows.some((r) => !r.skip && r.endMin <= r.startMin)
      ? 'Each day needs an end after its start.'
    : !placeReady
      ? hasBallot ? 'Pick at least one place.' : 'Add a place before locking in.'
      : null
  // not a blocker, but worth a pause: locking with zero replies means the "best" day
  // is a guess
  const noReplies = answeredCount(event) === 0

  // locking in opens the RSVP round, so the deadline for it is asked here — optional,
  // and soft: it nudges and shifts emphasis, late answers still count
  const [rsvpBy, setRsvpBy] = useState(event.rsvpDeadline ?? '')
  const d0 = new Date()
  const todayKey = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`
  const rsvpText = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }

  // which row has its controls open; one at a time keeps the dialog short
  const [openRow, setOpenRow] = useState<'when' | 'where' | 'rsvp' | null>(null)
  const toggle = (r: 'when' | 'where' | 'rsvp') => setOpenRow((o) => (o === r ? null : r))

  function togglePlace(id: string) {
    setPlaceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  // a run of days (or any day-poll lock) is all-day; only a single-day lock on a
  // minute poll carries clock times
  const allDay = dayPoll || (runMode && !setHours)
  // a set venue locks in as-is even though it never ran as a ballot
  const lockedPlaces = settled ? placeIds : !hasBallot ? [] : source === 'itin' ? stops : placeIds
  // the slot the dialog will lock, read back as the When line
  const draft: ConfirmedSlot | null = timeSet
    ? { ...timeSet, placeIds: lockedPlaces }
    : setHours
      ? slotFromRows(rows, lockedPlaces, openLen)
      : {
          dayKey,
          ...(runMode && lastDay !== dayKey ? { endDayKey: lastDay } : {}),
          startMin: allDay ? 0 : startMin,
          endMin: allDay ? 24 * 60 : openLen ? softEnd(dayKey, startMin) : endMin,
          placeIds: lockedPlaces,
          ...(openLen && !allDay ? { openEnd: true } : {}),
        }

  const account = useAccount()
  function lockIn() {
    if (blockedReason || !draft) return
    confirmEvent(event.id, draft)
    // clamp a stale pick (the chosen day may have moved under it) before storing
    const deadline = rsvpBy && rsvpBy >= todayKey && rsvpBy <= dayKey ? rsvpBy : undefined
    if (deadline !== event.rsvpDeadline) patchEvent(event.id, { rsvpDeadline: deadline })
    // everyone hears about it, calendar entry attached, in the background; the
    // server waits for the lock-in to land before it writes to anyone
    if (canEmail(account.signedIn) && !event.demo) void sendLockedMail(event.id, getEvent(event.id)?.confirmedAt)
    close()
    onChanged()
  }

  /* ── When ── */
  const whenText = draft ? confirmedSlotText({ confirmed: draft }) : null
  const draftAllDay = !!draft && !draft.sessions && draft.startMin === 0 && draft.endMin === 24 * 60
  const skipped = rows.length - keptCount
  // one quiet line on why this answer: the best window when it is the one picked, how
  // late people can stay on an open end, or what a run of days holds
  const whenSub: ReactNode = (() => {
    if (timeSet) return 'Set when the plan was made.'
    if (runMode) {
      if (!setHours) return 'Whole days.'
      return skipped ? `Own hours each day, ${skipped} skipped.` : 'Own hours each day.'
    }
    if (openLen) {
      const stay = stayLine(event, { dayKey, startMin, endMin: startMin })
      if (!stay) return 'No one has marked this start yet.'
      return <>Most can stay until {stay.mostIsEnd ? 'the end of the day' : fmtMinute(stay.most)}.</>
    }
    if (!bw || bw.dayKey !== dayKey) return null
    if (!dayPoll && (startMin !== gridStart + bw.s || endMin !== gridStart + bw.e)) return null
    const who = event.bestMode === 'crowd'
      ? Math.round(bw.avg) >= 1 ? `around ${Math.round(bw.avg)} of ${event.participants.length} there` : `${bw.anyIds.length} of ${event.participants.length} there for part of it`
      : `${bw.count} of ${event.participants.length} free`
    return `The best time so far, ${who}.`
  })()

  const whenControls = timeSet ? null : (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select label={runMode ? 'First day' : 'Day'} value={dayKey} onChange={changeDay}>
          {event.days.map((d) => (
            <option key={d.key} value={d.key}>{d.dow}, {d.date}{bw?.dayKey === d.key ? ' (best)' : ''}</option>
          ))}
        </Select>
        {runMode && lastOptions.length > 1 && (
          <Select label="Last day" value={lastDay} onChange={setLastDay}>
            {lastOptions.map((k) => <option key={k} value={k}>{dayLabelOf(k)}{k === dayKey ? ' (one day)' : ''}</option>)}
          </Select>
        )}
      </div>

      {runMode && !dayPoll && (
        <>
          <SegmentedControl label="Hours" size="sm" stretch value={hoursMode} onChange={(v) => setHoursMode(v as 'whole' | 'hours')}
            options={[{ v: 'hours', l: 'Own hours each day' }, { v: 'whole', l: 'Whole days' }]} />
          {setHours && (
            // a long run scrolls inside its own box, so the footer stays in view
            <div className="scroll-slim max-h-[264px] overflow-auto">
              <DayHoursRows
                rows={rows}
                openEnd={openLen}
                dayLabel={dayLabelOf}
                keptCount={keptCount}
                onChange={(k, patch) => setRowEdits((m) => ({ ...m, [k]: { ...m[k], ...patch } }))}
              />
            </div>
          )}
        </>
      )}

      {!dayPoll && !runMode && (
        <div>
          <span className={fieldLabel}>Time</span>
          <div className="flex flex-wrap items-center gap-2">
            <TimeSelect value={startMin} onChange={changeStart} step={15} title="Start time" />
            {openLen
              ? <span className="text-[13px] text-dim">open end</span>
              : <>
                  <span className="text-[13px] text-dim">to</span>
                  <TimeSelect value={endMin} onChange={setEndMin} min={startMin + 15} step={15} title="End time" />
                </>}
          </div>
        </div>
      )}
    </>
  )

  /* ── Where ── */
  const picked = ranked.filter((p) => placeIds.includes(p.id))
  const whereValue: ReactNode = loc.mode === 'remote'
    ? `Online on ${loc.platform}`
    : settled
      ? loc.places.map((p) => p.name).join(', ')
      : !hasBallot
        ? <span className="text-ochre-text">No place yet</span>
        : source === 'itin' && hasItin
          ? `Your ${stops.length}-stop itinerary`
          : picked.length === 0
            ? <span className="text-brick-text">None picked</span>
            : picked.length === 1 ? picked[0].name : `${picked[0].name} and ${picked.length - 1} more`
  const whereSub: ReactNode = loc.mode === 'remote' || settled
    ? null
    : !hasBallot
      // the one way past "no place yet" is on another tab
      ? onGoToLocation
        ? <button type="button" onClick={() => { close(); onGoToLocation() }} className="font-semibold text-accent-text hover:underline">Add one on the Location tab</button>
        : 'Add one on the Location tab.'
      : source === 'itin' && hasItin
        ? 'As built on the Location tab.'
        : picked.length === 1 && picked[0].id === ranked[0]?.id && votesOf(picked[0].id).length > 0
          ? `Leading with ${votesOf(picked[0].id).length} vote${votesOf(picked[0].id).length === 1 ? '' : 's'}.`
          : null
  const q = placeQ.trim().toLowerCase()
  const shown = q ? ranked.filter((p) => p.name.toLowerCase().includes(q)) : ranked
  const whereControls = hasBallot && !settled ? (
    <>
      {hasItin && (
        <SegmentedControl label="Place from" size="sm" stretch value={source} onChange={(v) => setSource(v as 'votes' | 'itin')}
          options={[{ v: 'votes', l: 'Top voted', icon: Vote }, { v: 'itin', l: 'Itinerary', icon: Route }]} />
      )}
      {source === 'votes' && (
        <div className="flex flex-col gap-1.5">
          {ranked.length > PLACE_SEARCH_AT && (
            <div className="flex items-center gap-1.5 rounded-[9px] border border-border bg-s0 px-2.5 focus-within:border-accent">
              <Search size={13} className="flex-none text-faint" />
              <input value={placeQ} onChange={(e) => setPlaceQ(e.target.value)} placeholder="Find a place" aria-label="Find a place"
                className="h-11 w-full min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-faint sm:h-9" />
            </div>
          )}
          <ul className="scroll-slim flex max-h-[220px] flex-col overflow-auto" aria-label="Places">
            {shown.map((p) => {
              const n = votesOf(p.id).length
              return (
                <li key={p.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[9px] px-2 py-2 hover:bg-s2 sm:min-h-0">
                    <input type="checkbox" checked={placeIds.includes(p.id)} onChange={() => togglePlace(p.id)} className="h-4 w-4 flex-none sm:h-3.5 sm:w-3.5" style={{ accentColor: 'var(--accent)' }} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.name}</span>
                    <span className="flex-none text-[12px] text-faint">{n} vote{n === 1 ? '' : 's'}</span>
                  </label>
                </li>
              )
            })}
            {shown.length === 0 && <li className="px-2 py-1.5 text-[12.5px] text-faint">No place matches.</li>}
          </ul>
        </div>
      )}
    </>
  ) : null

  return (
    <>
      <div className="scroll-slim min-h-0 flex-1 overflow-auto px-5 py-4">
        <div className="divide-y divide-border">
          <Row
            label="When"
            value={whenText
              ? <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">{whenText}{!draftAllDay && <TimezonePill tz={event.timezone} day={draft?.dayKey ?? dayKey} />}</span>
              : <span className="text-brick-text">Pick a day</span>}
            sub={whenSub}
            action={whenControls ? 'Change' : undefined}
            open={openRow === 'when'}
            onToggle={() => toggle('when')}
          >
            {whenControls}
          </Row>
          <Row
            label="Where"
            value={whereValue}
            sub={whereSub}
            action={whereControls ? 'Change' : undefined}
            open={openRow === 'where'}
            onToggle={() => toggle('where')}
          >
            {whereControls}
          </Row>
          <Row
            label="RSVP by"
            value={rsvpBy ? rsvpText(rsvpBy) : <span className="text-dim">No date</span>}
            sub={rsvpBy ? 'Reminders go out the day before and the day of.' : null}
            action={rsvpBy ? 'Change' : 'Add'}
            open={openRow === 'rsvp'}
            onToggle={() => toggle('rsvp')}
          >
            <div className="flex items-center gap-2">
              <DateField label="RSVP by" value={rsvpBy} min={todayKey} max={dayKey} onChange={setRsvpBy} className="h-11 flex-1 !bg-s1 sm:h-9" />
              {rsvpBy && (
                <button type="button" onClick={() => setRsvpBy('')} className="h-11 flex-none rounded-full px-2.5 text-[12.5px] font-semibold text-dim hover:bg-s2 hover:text-brick-text sm:h-8">
                  Clear
                </button>
              )}
            </div>
          </Row>
        </div>
        <p className="mt-4 text-[12.5px] leading-[1.5] text-faint">Everyone with the link sees this as final. You can reopen planning later.</p>
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-5 py-3.5">
        {blockedReason
          ? <p className="text-[12.5px] font-medium text-brick-text" role="status">{blockedReason}</p>
          : noReplies && <p className="text-[12.5px] font-medium text-ochre-text">No one has marked their times yet, so this is a guess.</p>}
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button type="button" onClick={close} className="flex h-11 items-center rounded-full border border-border2 bg-s1 px-4 text-[14px] font-medium hover:bg-s2 sm:h-9">
            Cancel
          </button>
          <button
            type="button"
            onClick={lockIn}
            disabled={!!blockedReason}
            className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-50 sm:h-9"
          >
            <Lock size={15} /> {timeSet ? 'Lock in the place' : 'Lock it in'}
          </button>
        </div>
      </div>
    </>
  )
}
