'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { CalendarCheck, Check, ChevronDown, Lock, MapPin, Route, Video, Vote, Wallet, X } from 'lucide-react'
import { TimeSelect } from '@/components/ui/TimeSelect'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TimezonePill } from '@/components/ui/TimezonePill'
import {
  availIvOf, bestWindow, confirmedSlotText, confirmEvent, fmtMinute, gridStartMinOf,
  type AppEvent, type ConfirmedSlot,
} from '@/lib/events'

/* ── the host's one clear action while planning: lock in whatever is still open ──
   Usually that's a time and a place; when the date was fixed at creation the time
   shows as a fact and only the place is being locked. A centered modal, not a
   dropdown — the form is the app's most consequential step and needs room; the
   backdrop also ends any stacking fights with the grid's sticky headers. Mounts
   fresh each open, so day and time always prefill from the best window for
   everyone, sized to the event length. */
export function ConfirmBar({ event, onChanged, onGoToDetails }: { event: AppEvent; onChanged: () => void; onGoToDetails?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[14px] font-semibold text-on-accent"
      >
        <Lock size={15} /> {event.confirmed ? 'Lock in the place' : 'Lock it in'}
      </button>
      {open && <ConfirmModal event={event} close={() => setOpen(false)} onChanged={onChanged} onGoToDetails={onGoToDetails} />}
    </>
  )
}

function ConfirmModal({ event, close, onChanged, onGoToDetails }: { event: AppEvent; close: () => void; onChanged: () => void; onGoToDetails?: () => void }) {
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

  return (
    <div
      ref={root}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(0,0,0,.25)] p-4"
      onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      {/* explicit viewport cap: the centered grid cell grows with content, so
          max-h-full alone never constrains the card and short phones lose the scroll */}
      <div ref={card} className="flex max-h-[calc(100dvh-32px)] w-full max-w-[400px] flex-col rounded-2xl border border-border bg-s1 shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint">Final plan</div>
            <div className="mt-0.5 text-[15.5px] font-semibold">{event.confirmed ? 'Lock in the place' : 'Lock it in'}</div>
          </div>
          <button onClick={close} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-[8px] text-dim hover:bg-s2 hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="scroll-slim min-h-0 flex-1 overflow-auto px-5 py-4">
          <ConfirmForm event={event} close={close} onChanged={onChanged} onGoToDetails={onGoToDetails} />
        </div>
      </div>
    </div>
  )
}

function ConfirmForm({ event, close, onChanged, onGoToDetails }: { event: AppEvent; close: () => void; onChanged: () => void; onGoToDetails?: () => void }) {
  const loc = event.location
  const gridStart = gridStartMinOf(event)
  const duration = event.durationMin ?? 60
  const bw = bestWindow(availIvOf(event), event.days, duration, event.bestMode)

  // a date fixed at creation is a fact, not a choice — the form only asks for the place
  const timeSet = event.confirmed ?? null

  // best window for everyone, cut to the event length
  const [dayKey, setDayKey] = useState(() => timeSet?.dayKey ?? bw?.dayKey ?? event.days[0]?.key ?? event.startDate)
  const [startMin, setStartMin] = useState(() => timeSet?.startMin ?? (bw ? gridStart + bw.s : 18 * 60))
  const [endMin, setEndMin] = useState(() => {
    if (timeSet) return timeSet.endMin
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

  function togglePlace(id: string) {
    setPlaceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  function changeStart(v: number) {
    setStartMin(v)
    setEndMin((e) => (e <= v ? Math.min(v + duration, 24 * 60 - 5) : e))
  }
  function lockIn() {
    const slot: ConfirmedSlot = {
      dayKey,
      startMin,
      endMin,
      // a set venue locks in as-is even though it never ran as a ballot
      placeIds: settled ? placeIds : !hasBallot ? [] : source === 'itin' ? stops : placeIds,
    }
    confirmEvent(event.id, slot)
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
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Day</div>
            <div className="relative">
              <select
                value={dayKey}
                onChange={(e) => setDayKey(e.target.value)}
                className="h-9 w-full appearance-none rounded-[9px] border border-border bg-s1 pl-3 pr-8 text-[13.5px] font-medium outline-none focus:border-accent-border"
              >
                {event.days.map((d) => (
                  <option key={d.key} value={d.key}>{d.dow}, {d.date}{bw?.dayKey === d.key ? ' · most are free' : ''}</option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Time</div>
            <div className="flex items-center gap-2">
              <TimeSelect value={startMin} onChange={changeStart} step={15} />
              <span className="text-[13px] text-dim">to</span>
              <TimeSelect value={endMin} onChange={setEndMin} min={startMin + 15} step={15} />
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
          </div>
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
            <MapPin size={15} className="flex-none text-accent-text" /> <span className="min-w-0 truncate">{loc.places.map((p) => p.name).join(' · ')}</span> <span className="flex-none text-faint">already set</span>
          </div>
        ) : !hasBallot ? (
          <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px] text-dim">
            <MapPin size={15} className="flex-none" />
            {timeSet
              ? 'Nothing on the ballot yet. Confirming now closes the place question as "to be decided".'
              : 'Place still open. You can lock the time now and settle the place later.'}
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
                      <span className="flex-none text-[12px] text-faint">{n} vote{n === 1 ? '' : 's'}{i === 0 && n > 0 ? ' · leading' : ''}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}
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
        <button
          onClick={lockIn}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-accent text-[14px] font-semibold text-on-accent"
        >
          <Check size={16} /> {timeSet ? 'Confirm the place' : 'Confirm the plan'}
        </button>
      </div>
    </div>
  )
}
