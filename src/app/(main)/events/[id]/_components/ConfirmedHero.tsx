'use client'

import { MapPin, Route, Undo2, Video } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { daysUntil, daysUntilLabel, fmtMinute, reopenEvent, type AppEvent } from '@/lib/events'
import { AddToCalendar } from './AddToCalendar'

/* ── the locked-in plan, front and center once the host confirms ── */
export function ConfirmedHero({ event, onChanged }: { event: AppEvent; onChanged: () => void }) {
  const c = event.confirmed
  if (!c) return null

  const day = event.days.find((d) => d.key === c.dayKey)
  const dayText = day ? `${day.dow}, ${day.date}` : c.dayKey
  const du = daysUntil(c.dayKey)
  const placeNames = c.placeIds
    .map((id) => event.location.places.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[]

  function reopen() {
    reopenEvent(event.id)
    onChanged()
  }

  return (
    <div className="mb-6 rounded-2xl border border-teal-border bg-s1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Locked in</span>
            <Badge variant={du !== null && du >= 0 && du <= 14 ? 'accent' : 'neutral'}>{daysUntilLabel(du)}</Badge>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-serif text-[27px] leading-[1.05] tracking-[-0.01em]">{dayText} · {fmtMinute(c.startMin)} – {fmtMinute(c.endMin)}</span>
            <TimezonePill tz={event.timezone} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[13.5px] text-dim">
            {event.location.mode === 'remote' ? (
              <><Video size={15} className="flex-none text-accent-text" /> Online on {event.location.platform}</>
            ) : event.location.planMode === 'itinerary' && (event.itinStops?.length ?? 0) > 0 ? (
              <><Route size={15} className="flex-none text-accent-text" /> {event.itinStops!.length}-stop itinerary, on the Location tab</>
            ) : placeNames.length > 0 ? (
              <><MapPin size={15} className="flex-none text-accent-text" /> <span className="min-w-0">{placeNames.join(' · ')}</span></>
            ) : (
              <><MapPin size={15} className="flex-none" /> Place still open</>
            )}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <AddToCalendar event={event} slot={{ dayKey: c.dayKey, startMin: c.startMin, endMin: c.endMin }} />
          {event.hostedByYou && (
            <button onClick={reopen} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-dim hover:bg-s2 hover:text-text">
              <Undo2 size={14} /> Reopen planning
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
