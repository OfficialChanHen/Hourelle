'use client'

import { useState } from 'react'
import { answeredLine, blockedClause, goingLine, needClause } from '@/lib/answers'
import Link from 'next/link'
import { Check, RotateCcw } from 'lucide-react'
import { useAccount } from '@/hooks/useAccount'
import { canEmail, sendAsk } from '@/lib/mail'
import type { SlotLike } from '@/lib/slot'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Highlight } from '@/components/ui/Pencil'
import { placeVotes } from '@/lib/polls'
import {
  availIvOf, bestBlock, bestWindow, confirmedSlotText, dateRangeText, fmtMinute, gridStartMinOf,
  longestRun, answeredIds, blockersOf, rsvpPool, type AppEvent, type Phase,
} from '@/lib/events'

/* ── where the plan stands, said as a sentence ──
   "4 of 5 have answered. Fri, Oct 2, 7:00 PM to 9:00 PM CDT works for the most
   people so far." Every fact the old stat strip carried (replies, the best time so
   far, where it is) is a clause here, in the order someone would say it. The best
   time is a link down to it on the grid. Once a time is locked the ConfirmedHero
   carries the answer, and this only says how many have replied out of everyone,
   and how many are going. When one or two people who answered are all that stand
   between the group and the best time, it names them ("works for everyone but Sam"),
   and the host can ask them by email whether they could make it. */

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

// the host's one-tap ask to the people blocking the best time; the note says what
// happened, since an email is a real thing to have sent
function AskBlockers({ eventId, ids, at, label }: { eventId: string; ids: string[]; at: SlotLike; label: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [note, setNote] = useState<string | null>(null)
  async function ask() {
    setState('sending')
    const r = await sendAsk(eventId, ids, at)
    if (!r.ok) { setState('idle'); setNote(r.error); return }
    const reached = r.data.sent.length + r.data.already.length
    setState(reached ? 'done' : 'idle')
    setNote(reached ? null : r.data.noEmail.length ? 'No email to reach them.' : 'It could not be sent.')
  }
  if (state === 'done') return <span className="ml-1 inline-flex items-center gap-1 text-[14px] font-semibold text-teal-text"><Check size={13} /> Asked</span>
  return (
    <>
      {' '}<button type="button" onClick={() => void ask()} disabled={state === 'sending'} className="relative inline font-semibold text-accent-text hover:underline after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] disabled:opacity-60">{label}</button>
      {note && <span className="ml-1.5 text-[13px] text-dim">{note}</span>}
    </>
  )
}

export function StageSummary({ event, phase, onGoToAvailability }: { event: AppEvent; phase: Phase; onGoToAvailability?: () => void }) {
  const account = useAccount()
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
  const best = dayPoll ? null : bestWindow(availIvOf(event), event.days, event.durationMin ?? 60, event.bestMode, event.needIv)
  const bestDays = dayPoll
    ? bestBlock(availIvOf(event), event.days, Math.min(2, longestRun(event.days)) || 1, event.bestMode, event.needIv)
    : null
  const dayLabelOf = (k: string) => {
    const d = event.days.find((x) => x.key === k)
    return d ? `${d.dow}, ${d.date}` : k
  }
  const gridStart = gridStartMinOf(event)
  // who stands between the group and the best time: answered, and can't make it
  const canMake = best?.ids ?? bestDays?.ids ?? []
  const blockers = best || bestDays ? blockersOf(event, canMake) : []
  const works = blockedClause(blockers, canMake.length)
  const named = works.includes(' but ')
  const askAt: SlotLike | null = best
    ? { dayKey: best.dayKey, startMin: gridStart + best.s, endMin: gridStart + best.e }
    : bestDays ? { dayKey: bestDays.startKey, ...(bestDays.endKey !== bestDays.startKey ? { endDayKey: bestDays.endKey } : {}), startMin: 0, endMin: 24 * 60 } : null
  const ask = named && askAt && !event.demo && event.hostedByYou && canEmail(account.signedIn) && blockers.every((p) => !p.you && !p.host)
    ? <AskBlockers eventId={event.id} ids={blockers.map((p) => p.id)} at={askAt} label={blockers.length === 1 ? `Ask ${blockers[0].name.split(' ')[0]}` : 'Ask them'} />
    : null
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
        It&apos;s set for <strong className="font-semibold">{confirmedSlotText(event)}</strong> <TimezonePill tz={event.timezone} day={event.confirmed.dayKey} />.
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
          <TimezonePill tz={event.timezone} day={best.dayKey} /> {works}{needClause(best.needIds.length)}.{ask}
        </>
      )}
      {bestDays && (
        <>
          {' '}<BestLink onClick={onGoToAvailability}>
            <Highlight>{bestDays.startKey === bestDays.endKey ? dayLabelOf(bestDays.startKey) : `${dayLabelOf(bestDays.startKey)} to ${dayLabelOf(bestDays.endKey)}`}</Highlight>
          </BestLink>{' '}{works}{needClause(bestDays.needIds.length)}.{ask}
        </>
      )}
      {missingNames && <> Waiting on {missingNames.length === 1 ? missingNames[0] : `${missingNames.slice(0, -1).join(', ')} and ${missingNames[missingNames.length - 1]}`}.</>}
      {where}
    </p>
  )
}
