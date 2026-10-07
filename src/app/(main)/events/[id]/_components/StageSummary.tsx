'use client'

import { answeredLine, goingLine } from '@/lib/answers'
import Link from 'next/link'
import { RotateCcw } from 'lucide-react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Highlight } from '@/components/ui/Pencil'
import { placeVotes } from '@/lib/polls'
import {
  availIvOf, bestBlock, bestWindow, confirmedSlotText, dateRangeText, fmtMinute, gridStartMinOf,
  longestRun, answeredIds, rsvpPool, type AppEvent, type Phase,
} from '@/lib/events'

/* ── where the plan stands, said as a sentence ──
   "4 of 5 have answered. Fri, Oct 2, 7:00 PM to 9:00 PM CDT works for the most
   people so far." Every fact the old stat strip carried (replies, the best time so
   far, where it is) is a clause here, in the order someone would say it. The best
   time is a link down to it on the grid. Once a time is locked the ConfirmedHero
   carries the answer, and this only says how many have replied out of everyone,
   and how many are going. */

const P = 'text-[15px] leading-[1.6] text-text sm:text-[16px]'

// the best time so far, as a link to it on the grid. Inline, with an invisible
// layer that reaches a finger's height without moving the lines around it.
function BestLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  if (!onClick) return <strong className="font-semibold">{children}</strong>
  return (
    <button type="button" onClick={onClick} className="relative inline text-left font-semibold underline decoration-border2 decoration-[1.5px] underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] hover:decoration-accent">
      {children}
    </button>
  )
}

export function StageSummary({ event, phase, onGoToAvailability }: { event: AppEvent; phase: Phase; onGoToAvailability?: () => void }) {
  if (phase === 'past') {
    const went = event.participants.filter((p) => p.rsvp === 'attending').length
    return (
      <p className={P}>
        Happened {dateRangeText(event)} with {went} there.{' '}
        <Link href={`/create?from=${event.id}`} className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
          <RotateCcw size={13} /> Reuse for a new plan
        </Link>
      </p>
    )
  }

  const total = event.participants.length

  if (phase !== 'planning') {
    return <p className={P}>{goingLine(rsvpPool(event), true)}.</p>
  }

  const answeredSet = answeredIds(event)
  const responded = answeredSet.size
  // a day poll answers in days, not clock times: its "best so far" is the leading run
  // of days (or single day), matching the grid dial's default
  const dayPoll = event.granularity === 'day'
  const best = dayPoll ? null : bestWindow(availIvOf(event), event.days, event.durationMin ?? 60, event.bestMode)
  const bestDays = dayPoll
    ? bestBlock(availIvOf(event), event.days, Math.min(2, longestRun(event.days)) || 1, event.bestMode)
    : null
  const dayLabelOf = (k: string) => {
    const d = event.days.find((x) => x.key === k)
    return d ? `${d.dow}, ${d.date}` : k
  }
  const gridStart = gridStartMinOf(event)
  // who is still missing, by first name when it is one to three people
  const missing = event.participants.filter((p) => !answeredSet.has(p.id))
  const missingNames = missing.length >= 1 && missing.length <= 3 && responded > 0
    ? missing.map((p) => (p.you ? 'you' : p.name.split(' ')[0]))
    : null

  // the venue currently winning the vote, unless the host set the place, which
  // reads as fact instead
  const settledPlace = event.location.mode === 'set' ? event.location.places[0] : undefined
  const votesOf = (id: string) => event.votes?.[id] ?? []
  const top = !settledPlace && event.location.mode === 'vote'
    ? [...event.location.places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)[0]
    : undefined
  const leading = top && votesOf(top.id).length > 0 ? top : null
  const ballot = event.location.mode === 'vote' ? event.location.places.length : 0

  // where, whatever answers it right now
  const where = settledPlace ? (
    <> It&apos;s at <strong className="font-semibold">{settledPlace.name}</strong>.</>
  ) : event.location.mode === 'remote' ? (
    <> It&apos;s online, on {event.location.platform || 'a call'}.</>
  ) : leading ? (
    <> <strong className="font-semibold">{leading.name}</strong> leads the place vote.</>
  ) : null

  // a date fixed at creation flips it: the time reads as fact and the place vote
  // carries the progress
  if (event.confirmed) {
    const voted = new Set(Object.values(placeVotes(event.votes ?? {})).flat()).size
    return (
      <p className={P}>
        It&apos;s set for <strong className="font-semibold">{confirmedSlotText(event)}</strong> <TimezonePill tz={event.timezone} />.
        {' '}{goingLine(rsvpPool(event), true)}.
        {where ?? ' The place is still open.'}
        {ballot > 0 && (voted === 0 ? ' No one has voted yet.' : ` ${voted} of ${total} have voted.`)}
      </p>
    )
  }

  return (
    <p className={P}>
      {answeredLine(responded, total)}.
      {best && (
        <>
          {' '}<BestLink onClick={onGoToAvailability}><Highlight>{best.dayLabel}, {fmtMinute(gridStart + best.s)} to {fmtMinute(gridStart + best.e)}</Highlight></BestLink>{' '}
          <TimezonePill tz={event.timezone} /> works for the most people so far.
        </>
      )}
      {bestDays && (
        <>
          {' '}<BestLink onClick={onGoToAvailability}>
            <Highlight>{bestDays.startKey === bestDays.endKey ? dayLabelOf(bestDays.startKey) : `${dayLabelOf(bestDays.startKey)} to ${dayLabelOf(bestDays.endKey)}`}</Highlight>
          </BestLink>{' '}works for the most people so far.
        </>
      )}
      {missingNames && <> Waiting on {missingNames.length === 1 ? missingNames[0] : `${missingNames.slice(0, -1).join(', ')} and ${missingNames[missingNames.length - 1]}`}.</>}
      {where}
    </p>
  )
}
