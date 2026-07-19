'use client'

import Link from 'next/link'
import { RotateCcw } from 'lucide-react'
import {
  availIvOf, bestWindow, dateRangeText, fmtMinute, gridStartMinOf,
  respondedCount, type AppEvent, type Phase,
} from '@/lib/events'

/* ── one quiet line that says where planning stands ──
   Replaces the old always-on stat strip; the confirmed phases skip it because
   the ConfirmedHero carries the answer instead. */
export function StageSummary({ event, phase, onGoToAvailability }: { event: AppEvent; phase: Phase; onGoToAvailability?: () => void }) {
  if (phase === 'past') {
    const went = event.participants.filter((p) => p.rsvp === 'attending').length
    return (
      <p className="text-[13.5px] text-dim">
        Happened {dateRangeText(event)} · {went} went ·{' '}
        <Link href={`/create?from=${event.id}`} className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
          <RotateCcw size={13} /> Reuse for a new event
        </Link>
      </p>
    )
  }

  if (phase !== 'planning') return null

  const responded = respondedCount(event.avail)
  const total = event.participants.length
  const best = bestWindow(availIvOf(event), event.days, event.durationMin ?? 60, event.bestMode)
  const gridStart = gridStartMinOf(event)

  // the venue currently winning the vote, so the one line reports both fronts —
  // unless the host settled the place, which reads as fact instead
  const settledPlace = event.location.settled ? event.location.places[0] : undefined
  const votesOf = (id: string) => event.votes?.[id] ?? []
  const top = !settledPlace && event.location.mode === 'vote'
    ? [...event.location.places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)[0]
    : undefined
  const leading = top && votesOf(top.id).length > 0 ? top : null

  return (
    <p className="text-[13.5px] text-dim">
      {responded === 0
        ? 'Waiting on availability'
        : <>{responded} of {total} responded{best && <> · best so far <button type="button" onClick={onGoToAvailability} className="font-semibold text-ochre hover:underline">{best.dayLabel} · {fmtMinute(gridStart + best.s)} – {fmtMinute(gridStart + best.e)}</button></>}</>}
      {settledPlace && <> · <span className="font-semibold text-text">{settledPlace.name}</span> is the place</>}
      {leading && <> · <span className="font-semibold text-text">{leading.name}</span> leading the vote</>}
    </p>
  )
}
