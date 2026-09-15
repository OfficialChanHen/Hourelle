'use client'

import Link from 'next/link'
import { RotateCcw } from 'lucide-react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import {
  availIvOf, bestBlock, bestWindow, confirmedSlotText, dateRangeText, fmtMinute, gridStartMinOf,
  longestRun, respondedCount, type AppEvent, type Phase,
} from '@/lib/events'

/* ── where planning stands, as an open stat strip ──
   Borderless columns — eyebrow, serif value, muted caption — instead of one cramped
   line. The confirmed phases skip it because the ConfirmedHero carries the answer. */

/* One stat, and the hairline that separates it from the one before.
   Wide: a row, with a one-pixel rule in the same token as the line under the strip,
   and the old 36px of air split 18 either side of it.
   Narrow: two even columns instead of a ragged wrap, a rule down the middle and one
   across between the rows, and a third stat taking the full width because its value
   is the longest. The row gap has to beat the 4px that separates a label from its
   own value, or the strip reads as one list rather than three facts. */
const SEP = [
  'min-w-0 border-border',
  // narrow: the second column carries the rule, the second row carries the seam
  'max-lg:[&:nth-child(even)]:border-l max-lg:[&:nth-child(even)]:pl-4',
  'max-lg:[&:nth-child(n+3)]:border-t max-lg:[&:nth-child(n+3)]:pt-3.5',
  'max-lg:[&:nth-child(3)]:col-span-2',
  // wide: every stat but the first is preceded by the rule
  'lg:border-l lg:pl-[18px] lg:first:border-l-0 lg:first:pl-0 lg:pr-[18px] lg:last:pr-0',
].join(' ')

function Stat({ label, value, caption, onClick }: { label: string; value: React.ReactNode; caption?: React.ReactNode; onClick?: () => void }) {
  const val = (
    <div className={`mt-1 font-serif text-[22px] leading-[1.12] tracking-[-0.01em] ${onClick ? 'cursor-pointer decoration-[1.5px] underline-offset-4 hover:underline' : ''}`}>
      {value}
    </div>
  )
  return (
    <div className={SEP}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-faint">{label}</div>
      {onClick ? <button type="button" onClick={onClick} className="block text-left">{val}</button> : val}
      {caption && <div className="mt-1 text-[12.5px] text-dim">{caption}</div>}
    </div>
  )
}

export function StageSummary({ event, phase, onGoToAvailability }: { event: AppEvent; phase: Phase; onGoToAvailability?: () => void }) {
  if (phase === 'past') {
    const went = event.participants.filter((p) => p.rsvp === 'attending').length
    return (
      <p className="text-[13.5px] text-dim">
        Happened {dateRangeText(event)} with {went} there.{' '}
        <Link href={`/create?from=${event.id}`} className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
          <RotateCcw size={13} /> Reuse for a new event
        </Link>
      </p>
    )
  }

  if (phase !== 'planning') return null

  const responded = respondedCount(event.avail, event.unavailableIds)
  const total = event.participants.length
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

  // the venue currently winning the vote — unless the host set the place, which
  // reads as fact instead
  const settledPlace = event.location.mode === 'set' ? event.location.places[0] : undefined
  const votesOf = (id: string) => event.votes?.[id] ?? []
  const top = !settledPlace && event.location.mode === 'vote'
    ? [...event.location.places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)[0]
    : undefined
  const leading = top && votesOf(top.id).length > 0 ? top : null

  // the place column, whatever answers the "where" question right now
  const placeStat = settledPlace ? (
    <Stat label="Place" value={settledPlace.name} caption="set by the host" />
  ) : event.location.mode === 'remote' ? (
    <Stat label="Place" value="Online" caption={`on ${event.location.platform || 'a call'}`} />
  ) : leading ? (
    <Stat label="Place" value={leading.name} caption={`leading with ${votesOf(leading.id).length} vote${votesOf(leading.id).length === 1 ? '' : 's'}`} />
  ) : event.location.mode === 'vote' && event.location.places.length > 0 ? (
    <Stat label="Place" value={String(event.location.places.length)} caption={`place${event.location.places.length === 1 ? '' : 's'} on the ballot, no votes yet`} />
  ) : null

  // a date fixed at creation flips the strip: the time reads as fact and the place
  // vote carries the progress
  if (event.confirmed) {
    const voted = new Set(Object.values(event.votes ?? {}).flat()).size
    return (
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3.5 lg:flex lg:flex-wrap lg:items-stretch lg:gap-x-0">
        <Stat label="When" value={confirmedSlotText(event)} caption={<>already set <TimezonePill tz={event.timezone} /></>} />
        {placeStat ?? <Stat label="Place" value="Open" caption="still collecting ideas" />}
        {event.location.mode === 'vote' && event.location.places.length > 0 && (
          <Stat label="Votes" value={`${voted} of ${total}`} caption={voted === 0 ? 'waiting on the first one' : 'have had their say'} />
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3.5 lg:flex lg:flex-wrap lg:items-stretch lg:gap-x-0">
      <Stat
        label="Replies"
        value={`${responded} of ${total}`}
        caption={responded === 0 ? 'waiting on availability' : 'have marked their times'}
      />
      {best && (
        <Stat
          label="Best so far"
          value={best.dayLabel}
          caption={<>{fmtMinute(gridStart + best.s)} – {fmtMinute(gridStart + best.e)} <TimezonePill tz={event.timezone} /></>}
          onClick={onGoToAvailability}
        />
      )}
      {bestDays && (
        <Stat
          label="Best so far"
          value={bestDays.startKey === bestDays.endKey ? dayLabelOf(bestDays.startKey) : `${dayLabelOf(bestDays.startKey)} – ${dayLabelOf(bestDays.endKey)}`}
          onClick={onGoToAvailability}
        />
      )}
      {placeStat}
    </div>
  )
}
