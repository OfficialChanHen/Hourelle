'use client'

import { TimezonePill } from '@/components/ui/TimezonePill'
import { fmtMinute, stayLine, type AppEvent, type Session } from '@/lib/events'

/* ── how late people can stay, under an open-ended time ──
   "Most can stay until 11:30 PM, Sam until the end of the day." Read from everyone's
   marks now, so a mark added after lock-in moves it. Says nothing when nobody marked
   the start, and nothing for a slot with a set end. */
export function StayNote({ event, session, className = '' }: { event: AppEvent; session: Session; className?: string }) {
  const stay = stayLine(event, session)
  if (!stay) return null
  const at = (m: number, end: boolean) => (end ? 'the end of the day' : fmtMinute(m))
  return (
    <span className={`flex flex-wrap items-center gap-x-1.5 text-[13px] text-dim ${className}`}>
      <span>
        Most can stay until <span className="font-semibold text-text">{at(stay.most, stay.mostIsEnd)}</span>
        {stay.last && <>, {stay.last.name} until <span className="font-semibold text-text">{at(stay.last.until, stay.last.isEnd)}</span></>}.
      </span>
      {!(stay.mostIsEnd && (!stay.last || stay.last.isEnd)) && <TimezonePill tz={event.timezone} day={session.dayKey} />}
    </span>
  )
}
