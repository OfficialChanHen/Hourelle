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
export function StageSummary({ event, phase }: { event: AppEvent; phase: Phase }) {
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
  const best = bestWindow(availIvOf(event), event.days, event.durationMin ?? 60)
  const gridStart = gridStartMinOf(event)

  return (
    <p className="text-[13.5px] text-dim">
      {responded === 0
        ? 'Waiting on availability'
        : <>{responded} of {total} responded{best && <> · best so far <span className="font-semibold text-text">{best.dayLabel} · {fmtMinute(gridStart + best.s)} – {fmtMinute(gridStart + best.e)}</span></>}</>}
    </p>
  )
}
