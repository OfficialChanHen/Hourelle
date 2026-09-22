'use client'

import { useState } from 'react'
import { Check, HelpCircle, MapPin, Route, Undo2, Video, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { dateRangeText, daysUntil, daysUntilLabel, fmtMinute, reopenEvent, setMyRsvp, type AppEvent, type Rsvp } from '@/lib/events'
import { AddToCalendar } from './AddToCalendar'
import { slotWhen } from '@/lib/slot'

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

  const me = event.participants.find((p) => p.you)
  const myRsvp = me?.rsvp
  const [confirmReopen, setConfirmReopen] = useState(false)
  function answer(v: Rsvp) {
    setMyRsvp(event.id, v)
    onChanged()
  }

  const day = event.days.find((d) => d.key === c.dayKey)
  const endDay = c.endDayKey ? event.days.find((d) => d.key === c.endDayKey) : null
  const dayOf = (k: string) => { const d = event.days.find((x) => x.key === k); return d ? `${d.dow}, ${d.date}` : k }
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
            {/* an all-day lock has no clock times to show, and an all-day run of days
                reads as the range alone; a timed run names the time at each end */}
            {c.startMin === 0 && c.endMin === 24 * 60 ? (
              <span className="font-serif text-[27px] leading-[1.05] tracking-[-0.01em]">{dayText}{endDay ? '' : ', all day'}</span>
            ) : (
              <>
                <span className="font-serif text-[27px] leading-[1.05] tracking-[-0.01em]">{slotWhen(c, dayOf, fmtMinute)}</span>
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
              <><MapPin size={15} className="flex-none text-accent-text" /> <span className="min-w-0">Happening across {placeNames.length} spots: {placeNames.join(', ')}</span></>
            ) : placeNames.length > 0 ? (
              <><MapPin size={15} className="flex-none text-accent-text" /> <span className="min-w-0">{placeNames.join(', ')}</span></>
            ) : (
              <><MapPin size={15} className="flex-none" /> Place still open</>
            )}
          </div>
        </div>
        {/* wraps under the date on narrow phones and never exceeds the card */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <AddToCalendar event={event} slot={{ dayKey: c.dayKey, endDayKey: c.endDayKey, startMin: c.startMin, endMin: c.endMin }} />
          {/* reopening is consequential — everyone's RSVPs reset — so it asks once */}
          {event.hostedByYou && !confirmReopen && (
            <button onClick={() => setConfirmReopen(true)} className="flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-dim hover:bg-s2 hover:text-text sm:h-8">
              <Undo2 size={14} /> Reopen planning
            </button>
          )}
          {event.hostedByYou && confirmReopen && (
            <span className="flex flex-wrap items-center gap-2 rounded-[9px] border border-ochre-border bg-ochre-bg px-2.5 py-1.5">
              <span className="text-[12.5px] font-medium text-ochre-text">Unlocks the plan for everyone and clears the RSVPs.</span>
              <button onClick={reopen} className="h-7 rounded-[7px] px-2.5 text-[12.5px] font-semibold text-white" style={{ background: 'var(--ochre)' }}>Reopen</button>
              <button onClick={() => setConfirmReopen(false)} className="h-7 rounded-[7px] border border-border2 bg-s1 px-2.5 text-[12.5px] font-semibold text-dim hover:bg-s2">Keep it locked</button>
            </span>
          )}
        </div>
      </div>

      {/* your RSVP — the one thing the plan asks of you */}
      <div data-tour="rsvp" className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
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
                className={`flex h-11 items-center gap-1.5 rounded-[9px] border px-3.5 text-[13px] font-semibold sm:h-8 sm:px-3 ${on ? o.on : 'border-border2 bg-s1 text-dim hover:bg-s2 hover:text-text'}`}
              >
                <Icon size={14} /> {o.label}
              </button>
            )
          })}
        </div>
        {me?.rsvpAuto ? (
          <span className="text-[12.5px] text-faint">
            {myRsvp === 'attending' ? 'Marked going from your times. Change it if that’s wrong.' : 'Marked from your reply that no days worked. Change it if that’s wrong.'}
          </span>
        ) : event.rsvpDeadline ? (
          // the deadline nudges, it never locks: past due, answers still change freely
          <span className="text-[12.5px] text-faint">
            {(daysUntil(event.rsvpDeadline) ?? 0) < 0
              ? `RSVPs were due ${dateRangeText({ startDate: event.rsvpDeadline, endDate: event.rsvpDeadline })}. You can still change your answer.`
              : `RSVP by ${dateRangeText({ startDate: event.rsvpDeadline, endDate: event.rsvpDeadline })}.`}
          </span>
        ) : null}
      </div>
    </div>
  )
}
