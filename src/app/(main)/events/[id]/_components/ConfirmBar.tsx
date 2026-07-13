'use client'

import { useState } from 'react'
import { Check, ChevronDown, Lock, MapPin, Route, Video } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { TimeSelect } from '@/components/ui/TimeSelect'
import {
  availIvOf, bestWindow, confirmEvent, gridStartMinOf,
  type AppEvent, type ConfirmedSlot,
} from '@/lib/events'

/* ── the host's one clear action while planning: lock in a time and place ──
   Prefilled from the best availability window and the leading vote, so on a
   healthy event confirming is a two-click affair. */
export function ConfirmBar({ event, onChanged }: { event: AppEvent; onChanged: () => void }) {
  const loc = event.location
  const gridStart = gridStartMinOf(event)
  const bw = bestWindow(availIvOf(event), event.days, event.durationMin ?? 60)

  const [dayKey, setDayKey] = useState(() => bw?.dayKey ?? event.days[0]?.key ?? event.startDate)
  const [startMin, setStartMin] = useState(() => (bw ? gridStart + bw.s : 18 * 60))
  const [endMin, setEndMin] = useState(() => (bw ? gridStart + bw.e : 20 * 60))

  // votes decide the pre-check; the host has the final say
  const votesOf = (id: string) => event.votes?.[id] ?? []
  const ranked = [...loc.places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)
  const leadingId = ranked.length && votesOf(ranked[0].id).length > 0 ? ranked[0].id : ranked[0]?.id ?? null
  const [placeIds, setPlaceIds] = useState<string[]>(() => (leadingId ? [leadingId] : []))
  const isItin = loc.planMode === 'itinerary'

  function togglePlace(id: string) {
    setPlaceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function changeStart(v: number) {
    setStartMin(v)
    if (endMin <= v) setEndMin(Math.min(24 * 60 - 15, v + 60))
  }

  function lockIn(close: () => void) {
    const slot: ConfirmedSlot = {
      dayKey,
      startMin,
      endMin,
      placeIds: loc.mode !== 'vote' ? [] : isItin ? (event.itinStops ?? []) : placeIds,
    }
    confirmEvent(event.id, slot)
    close()
    onChanged()
  }

  return (
    <Popover
      align="end"
      width={330}
      trigger={(open) => (
        <span className={`flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[14px] font-semibold text-on-accent ${open ? 'opacity-90' : ''}`}>
          <Lock size={15} /> Lock it in
        </span>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-3 p-1">
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
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Place</div>
            {loc.mode === 'remote' ? (
              <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px] text-dim">
                <Video size={15} className="flex-none text-accent-text" /> Online on {loc.platform}
              </div>
            ) : loc.mode === 'later' || loc.places.length === 0 ? (
              <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px] text-dim">
                <MapPin size={15} className="flex-none" /> Place still open. You can lock the time now and settle the place later.
              </div>
            ) : isItin ? (
              <div className="flex items-center gap-2 rounded-[9px] border border-border bg-s2 px-3 py-2 text-[13px] text-dim">
                <Route size={15} className="flex-none text-accent-text" />
                {(event.itinStops?.length ?? 0) > 0
                  ? `Your ${event.itinStops!.length}-stop itinerary`
                  : 'No stops yet. The itinerary stays editable on the Location tab.'}
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

          <div className="border-t border-border pt-2.5">
            <p className="mb-2.5 text-[12.5px] leading-[1.5] text-faint">Everyone with the link sees this as the final plan. You can reopen planning later.</p>
            <button
              onClick={() => lockIn(close)}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-accent text-[14px] font-semibold text-on-accent"
            >
              <Check size={16} /> Confirm the plan
            </button>
          </div>
        </div>
      )}
    </Popover>
  )
}
