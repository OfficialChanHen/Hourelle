'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { CalendarCheck, Check, ChevronDown, Lock, MapPin, Route, Video, Vote, Wallet, X } from 'lucide-react'
import { TimeSelect } from '@/components/ui/TimeSelect'
import { DateField } from '@/components/ui/DateField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { canEmail, sendLockedMail } from '@/lib/mail'
import { useAccount } from '@/hooks/useAccount'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { getEvent } from '@/lib/events'
import {
  availIvOf, bestWindow, confirmedSlotText, confirmEvent, fmtMinute, gridStartMinOf, patchEvent, respondedCount,
  type AppEvent, type ConfirmedSlot,
} from '@/lib/events'

/* ── the host's one clear action while planning: lock in whatever is still open ──
   Usually that's a time and a place; when the date was fixed at creation the time
   shows as a fact and only the place is being locked. A centered modal, not a
   dropdown — the form is the app's most consequential step and needs room; the
   backdrop also ends any stacking fights with the grid's sticky headers. Mounts
   fresh each open, so day and time always prefill from the best window for
   everyone, sized to the event length. */
// prefill + openNonce let other surfaces hand the modal an answer: the grid's
// "Lock these days" shortcut opens it with the winning run already picked
export type LockPrefill = { dayKey: string; endDayKey?: string }
export function ConfirmBar({ event, onChanged, onGoToDetails, onGoToLocation, prefill, openNonce, runLen }: {
  event: AppEvent; onChanged: () => void; onGoToDetails?: () => void; onGoToLocation?: () => void
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
        className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[14px] font-semibold text-on-accent"
      >
        <Lock size={15} /> {event.confirmed ? 'Lock in the place' : 'Lock it in'}
      </button>
      {open && <ConfirmModal event={event} close={() => setOpen(false)} onChanged={onChanged} onGoToDetails={onGoToDetails} onGoToLocation={onGoToLocation} prefill={prefill} runLen={runLen} />}
    </>
  )
}

function ConfirmModal({ event, close, onChanged, onGoToDetails, onGoToLocation, prefill, runLen }: { event: AppEvent; close: () => void; onChanged: () => void; onGoToDetails?: () => void; onGoToLocation?: () => void; prefill?: LockPrefill | null; runLen?: number }) {
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
      <div ref={card} className="flex max-h-[calc(100dvh-32px)] w-full max-w-[400px] flex-col rounded-2xl border border-border bg-s1 shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint">Final plan</div>
            <div id={titleId} className="mt-0.5 text-[15.5px] font-semibold">{event.confirmed ? 'Lock in the place' : 'Lock it in'}</div>
          </div>
          <button onClick={close} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-[8px] text-dim hover:bg-s2 hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="scroll-slim min-h-0 flex-1 overflow-auto px-5 py-4">
          <ConfirmForm event={event} close={close} onChanged={onChanged} onGoToDetails={onGoToDetails} onGoToLocation={onGoToLocation} prefill={prefill} runLen={runLen} />
        </div>
      </div>
    </div>
  )
}

function ConfirmForm({ event, close, onChanged, onGoToDetails, onGoToLocation, prefill, runLen }: { event: AppEvent; close: () => void; onChanged: () => void; onGoToDetails?: () => void; onGoToLocation?: () => void; prefill?: LockPrefill | null; runLen?: number }) {
  const loc = event.location
  const gridStart = gridStartMinOf(event)
  const duration = event.durationMin ?? 60
  const bw = bestWindow(availIvOf(event), event.days, duration, event.bestMode)

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

  // votes rank the ballot; every venue stays pickable, so the host can lock in
  // as many simultaneous spots as the event needs — the leader is preselected.
  // A set venue skips the choice entirely: it locks in as-is.
  const settled = loc.mode === 'set' && loc.places.length > 0
  const votesOf = (id: string) => event.votes?.[id] ?? []
  const ranked = [...loc.places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)
  const [placeIds, setPlaceIds] = useState<string[]>(() => (settled ? loc.places.map((p) => p.id) : ranked[0] ? [ranked[0].id] : []))

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
  const timeReady = !!dayKey && (dayPoll || runMode || endMin > startMin)
  const blockedReason = !timeReady
    ? 'Pick a day and time first.'
    : !placeReady
      ? hasBallot ? 'Pick at least one place.' : 'Add a place before locking in.'
      : null
  // not a blocker, but worth a pause: locking with zero replies means the "best" day
  // is a guess
  const noReplies = respondedCount(event.avail, event.unavailableIds) === 0

  // locking in opens the RSVP round, so the deadline for it is asked here — optional,
  // and soft: it nudges and shifts emphasis, late answers still count
  const [rsvpBy, setRsvpBy] = useState(event.rsvpDeadline ?? '')
  const d0 = new Date()
  const todayKey = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`

  function togglePlace(id: string) {
    setPlaceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  function changeStart(v: number) {
    setStartMin(v)
    setEndMin((e) => (e <= v ? Math.min(v + duration, 24 * 60 - 5) : e))
  }
  const account = useAccount()
  function lockIn() {
    if (blockedReason) return
    // a run of days (or any day-poll lock) is all-day; only a single-day lock on a
    // minute poll carries clock times
    const allDay = dayPoll || runMode
    const slot: ConfirmedSlot = {
      dayKey,
      ...(runMode && lastDay !== dayKey ? { endDayKey: lastDay } : {}),
      startMin: allDay ? 0 : startMin,
      endMin: allDay ? 24 * 60 : endMin,
      // a set venue locks in as-is even though it never ran as a ballot
      placeIds: settled ? placeIds : !hasBallot ? [] : source === 'itin' ? stops : placeIds,
    }
    confirmEvent(event.id, slot)
    // clamp a stale pick (the chosen day may have moved under it) before storing
    const deadline = rsvpBy && rsvpBy >= todayKey && rsvpBy <= dayKey ? rsvpBy : undefined
    if (deadline !== event.rsvpDeadline) patchEvent(event.id, { rsvpDeadline: deadline })
    // everyone hears about it, calendar entry attached, in the background; the
    // server waits for the lock-in to land before it writes to anyone
    if (canEmail(account.signedIn) && !event.demo) void sendLockedMail(event.id, getEvent(event.id)?.confirmedAt)
    close()
    onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      {timeSet ? (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Day & time</div>
          <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px] text-dim">
            <CalendarCheck size={15} className="flex-none text-accent-text" />
            <span className="min-w-0 truncate">{confirmedSlotText(event)}</span>
            <TimezonePill tz={event.timezone} />
            <span className="flex-none text-faint">already set</span>
          </div>
        </div>
      ) : (
        <>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">{runMode ? 'First day' : 'Day'}</div>
            <div className="relative">
              <select
                value={dayKey}
                onChange={(e) => changeDay(e.target.value)}
                aria-label={runMode ? 'First day' : 'Day'}
                className="h-9 w-full appearance-none rounded-[9px] border border-border bg-s1 pl-3 pr-8 text-[13.5px] font-medium outline-none focus:border-accent"
              >
                {event.days.map((d) => (
                  <option key={d.key} value={d.key}>{d.dow}, {d.date}{bw?.dayKey === d.key ? ' (most are free)' : ''}</option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" />
            </div>
          </div>

          {runMode && lastOptions.length > 1 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Last day</div>
              <div className="relative">
                <select
                  value={lastDay}
                  onChange={(e) => setLastDay(e.target.value)}
                  aria-label="Last day"
                  className="h-9 w-full appearance-none rounded-[9px] border border-border bg-s1 pl-3 pr-8 text-[13.5px] font-medium outline-none focus:border-accent"
                >
                  {lastOptions.map((k) => {
                    const d = event.days.find((x) => x.key === k)
                    return <option key={k} value={k}>{d ? `${d.dow}, ${d.date}` : k}{k === dayKey ? ' (one day)' : ''}</option>
                  })}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" />
              </div>
              <p className="mt-1.5 text-[12px] text-faint">Up to {wantRun} days, matching days in a row on the grid.</p>
            </div>
          )}

          {!dayPoll && !runMode && <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Time</div>
            <div className="flex items-center gap-2">
              <TimeSelect value={startMin} onChange={changeStart} step={15} title="Start time" />
              <span className="text-[13px] text-dim">to</span>
              <TimeSelect value={endMin} onChange={setEndMin} min={startMin + 15} step={15} title="End time" />
            </div>
            {bw && (
              <p className="mt-1.5 text-[12px] text-faint">
                Best window: {event.bestMode === 'crowd'
                  ? Math.round(bw.avg) >= 1
                    ? <>around {Math.round(bw.avg)} of {event.participants.length} there</>
                    : <>{bw.anyIds.length} of {event.participants.length} there for part of it</>
                  : <>{bw.count} of {event.participants.length} free</>} <span className="font-semibold text-ochre">{fmtMinute(gridStart + bw.s)} – {fmtMinute(gridStart + bw.e)}</span>
              </p>
            )}
          </div>}
        </>
      )}

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Place</div>
        {loc.mode === 'remote' ? (
          <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px] text-dim">
            <Video size={15} className="flex-none text-accent-text" /> Online on {loc.platform}
          </div>
        ) : settled ? (
          <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px] text-dim">
            <MapPin size={15} className="flex-none text-accent-text" /> <span className="min-w-0 truncate">{loc.places.map((p) => p.name).join(', ')}</span> <span className="flex-none text-faint">already set</span>
          </div>
        ) : !hasBallot ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[9px] border border-ochre-border bg-ochre-bg px-3 py-2 text-[13px] text-ochre-text">
            <MapPin size={15} className="flex-none" />
            <span className="min-w-0 flex-1">No place yet. The plan needs one before it can lock.</span>
            {onGoToLocation && (
              <button onClick={() => { close(); onGoToLocation() }} className="flex-none text-[12.5px] font-semibold underline underline-offset-2">
                Add one on the Location tab
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* one or the other — the winning ballot places, or the built route */}
            {hasItin && (
              <SegmentedControl
                size="sm"
                stretch
                value={source}
                onChange={(v) => setSource(v as 'votes' | 'itin')}
                options={[{ v: 'votes', l: 'Top voted', icon: Vote }, { v: 'itin', l: 'Itinerary', icon: Route }]}
              />
            )}
            {source === 'itin' && hasItin ? (
              <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px] text-dim">
                <Route size={15} className="flex-none text-accent-text" /> Your {stops.length}-stop itinerary, as built on the Location tab
              </div>
            ) : (
              <div className="scroll-slim flex max-h-[168px] flex-col gap-1 overflow-auto">
                {ranked.map((p, i) => {
                  const on = placeIds.includes(p.id)
                  const n = votesOf(p.id).length
                  return (
                    <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-[9px] border px-2.5 py-2 ${on ? 'border-accent-border bg-accent-bg/40' : 'border-border bg-s1 hover:bg-s2'}`}>
                      <input type="checkbox" checked={on} onChange={() => togglePlace(p.id)} className="h-3.5 w-3.5 flex-none" style={{ accentColor: 'var(--accent)' }} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.name}</span>
                      <span className="flex-none text-[12px] text-faint">{n} vote{n === 1 ? '' : 's'}{i === 0 && n > 0 ? ', leading' : ''}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">RSVP by <span className="normal-case tracking-normal text-faint">(Optional)</span></div>
        <div className="flex items-center gap-2">
          <DateField label="RSVP by" value={rsvpBy} min={todayKey} max={dayKey} onChange={setRsvpBy} className="h-11 flex-1 !bg-s1 sm:h-9" />
          {rsvpBy && (
            <button type="button" onClick={() => setRsvpBy('')} className="flex-none text-[12.5px] font-semibold text-dim hover:text-brick-text hover:underline">
              Clear
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[12px] text-faint">Everyone gets a reminder the day before and the day of. Late answers still count.</p>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Budget</div>
        <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px]">
          <Wallet size={15} className="flex-none text-dim" />
          <span className="min-w-0 flex-1 truncate text-dim">
            {event.budget ? `$${Number(event.budget).toLocaleString()} ${event.budgetMode === 'person' ? 'per person' : 'total'}` : 'No budget set'}
          </span>
          {onGoToDetails && (
            <button
              onClick={() => { close(); onGoToDetails() }}
              title="Adjust it on the Event details tab"
              className="flex-none text-[12.5px] font-semibold text-accent-text hover:underline"
            >
              Change
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-2.5">
        <p className="mb-2.5 text-[12.5px] leading-[1.5] text-faint">Everyone with the link sees this as the final plan. You can reopen planning later.</p>
        {blockedReason && (
          <p className="mb-2 text-[12.5px] font-medium text-brick-text">{blockedReason}</p>
        )}
        {!blockedReason && noReplies && (
          <p className="mb-2 text-[12.5px] font-medium text-ochre-text">No one has marked availability yet, so this is a guess. You can still lock it in.</p>
        )}
        <button
          onClick={lockIn}
          disabled={!!blockedReason}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-40"
        >
          <Check size={16} /> {timeSet ? 'Confirm the place' : 'Confirm the plan'}
        </button>
      </div>
    </div>
  )
}
