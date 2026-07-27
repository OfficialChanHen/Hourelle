'use client'

import { Check, HelpCircle, MapPin, Route, Undo2, Video, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { daysUntil, daysUntilLabel, fmtMinute, reopenEvent, setMyRsvp, type AppEvent, type Rsvp } from '@/lib/events'
import { AddToCalendar } from './AddToCalendar'

// your answer to the locked-in plan — strict role colors: teal going, ochre maybe, brick out
const RSVP_OPTIONS: { v: Rsvp; label: string; icon: typeof Check; on: string }[] = [
  { v: 'attending', label: 'Going', icon: Check, on: 'border-teal-border bg-teal-bg text-teal-text' },
  { v: 'maybe', label: 'Maybe', icon: HelpCircle, on: 'border-ochre-border bg-ochre-bg text-ochre-text' },
  { v: 'not_going', label: "Can't go", icon: X, on: 'border-brick-border bg-brick-bg text-brick-text' },
]

/* ── the locked-in plan, front and center once the host confirms ── */
export function ConfirmedHero({ event, onChanged }: { event: AppEvent; onChanged: () => void }) {
  const c = event.confirmed
  if (!c) return null

  const myRsvp = event.participants.find((p) => p.you)?.rsvp
  function answer(v: Rsvp) {
    setMyRsvp(event.id, v)
    onChanged()
  }

  const day = event.days.find((d) => d.key === c.dayKey)
  const endDay = c.endDayKey ? event.days.find((d) => d.key === c.endDayKey) : null
  const dayText = (day ? `${day.dow}, ${day.date}` : c.dayKey) + (endDay ? ` – ${endDay.dow}, ${endDay.date}` : '')
  const du = daysUntil(c.dayKey)
  const placeNames = c.placeIds
    .map((id) => event.location.places.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[]
  // "itinerary" only when the locked places really are the built route, in order —
  // a multi-place votes lock is a set of simultaneous spots, not stops
  const itin = event.itinStops ?? []
  const itinLocked = event.location.planMode === 'itinerary' && itin.length > 0 && c.placeIds.length === itin.length && c.placeIds.every((id, i) => id === itin[i])

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
            {/* an all-day lock (day polls) has no clock times to show; a run of days
                reads as the range alone */}
            {c.startMin === 0 && c.endMin === 24 * 60 ? (
              <span className="font-serif text-[27px] leading-[1.05] tracking-[-0.01em]">{dayText}{endDay ? '' : ' · all day'}</span>
            ) : (
              <>
                <span className="font-serif text-[27px] leading-[1.05] tracking-[-0.01em]">{dayText} · {fmtMinute(c.startMin)} – {fmtMinute(c.endMin)}</span>
                <TimezonePill tz={event.timezone} />
              </>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[13.5px] text-dim">
            {event.location.mode === 'remote' ? (
              <><Video size={15} className="flex-none text-accent-text" /> Online on {event.location.platform}</>
            ) : itinLocked ? (
              <><Route size={15} className="flex-none text-accent-text" /> {itin.length}-stop itinerary, on the Location tab</>
            ) : placeNames.length > 1 ? (
              <><MapPin size={15} className="flex-none text-accent-text" /> <span className="min-w-0">Happening across {placeNames.length} spots: {placeNames.join(' · ')}</span></>
            ) : placeNames.length > 0 ? (
              <><MapPin size={15} className="flex-none text-accent-text" /> <span className="min-w-0">{placeNames.join(' · ')}</span></>
            ) : (
              <><MapPin size={15} className="flex-none" /> Place still open</>
            )}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <AddToCalendar event={event} slot={{ dayKey: c.dayKey, endDayKey: c.endDayKey, startMin: c.startMin, endMin: c.endMin }} />
          {event.hostedByYou && (
            <button onClick={reopen} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-dim hover:bg-s2 hover:text-text">
              <Undo2 size={14} /> Reopen planning
            </button>
          )}
        </div>
      </div>

      {/* your RSVP — the one thing the plan asks of you */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
        <span className="text-[13px] text-dim">Are you coming?</span>
        <div className="flex items-center gap-1.5">
          {RSVP_OPTIONS.map((o) => {
            const Icon = o.icon
            const on = myRsvp === o.v
            return (
              <button
                key={o.v}
                onClick={() => answer(o.v)}
                aria-pressed={on}
                className={`flex h-8 items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-semibold ${on ? o.on : 'border-border2 bg-s1 text-dim hover:bg-s2 hover:text-text'}`}
              >
                <Icon size={14} /> {o.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
