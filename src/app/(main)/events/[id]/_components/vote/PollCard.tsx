'use client'

/* ── one of the host's questions, as a card ──
   Each option is a full-width button with its share of the votes filled in behind
   it. One pick per person: tapping another option moves yours, tapping your own
   takes it back. The fill is GSAP's, not React's, so a vote arriving from someone
   else slides the bars rather than jumping them. */

import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Check, Trash2, TriangleAlert } from 'lucide-react'
import { AvatarRow } from '@/components/ui/AvatarRow'
import type { Avatar as Person } from '@/lib/people'
import { pollVotes, type Poll } from '@/lib/polls'

const plural = (n: number) => `${n} ${n === 1 ? 'vote' : 'votes'}`

export function PollCard({ poll, votes, me, personOf, hideVoters, readOnly, canRemove, onPick, onRemove }: {
  poll: Poll
  votes: Record<string, string[]> | undefined
  me: string
  personOf: (id: string) => Person | null
  hideVoters: boolean
  readOnly: boolean
  canRemove: boolean
  onPick: (optionId: string) => void
  onRemove: () => void
}) {
  const byOption = pollVotes(votes, poll)
  const counts = poll.options.map((o) => byOption[o.id].length)
  const total = counts.reduce((a, b) => a + b, 0)
  const [confirming, setConfirming] = useState(false)

  // the bars own their width; React never sets it, so a re-render cannot snap them
  const scope = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    const bars = scope.current?.querySelectorAll<HTMLElement>('[data-bar]') ?? []
    bars.forEach((el, i) => {
      const pct = total ? (counts[i] / total) * 100 : 0
      gsap.to(el, { width: `${pct}%`, duration: 0.5, ease: 'power3.out', overwrite: true })
    })
  }, { scope, dependencies: [counts.join(','), total] })

  function attemptRemove() {
    if (total > 0) setConfirming(true)
    else onRemove()
  }

  return (
    <div ref={scope} className="min-w-0 rounded-xl border border-border bg-s1 p-5 shadow-soft">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-[1.4]">{poll.question}</h3>
        {canRemove && !confirming && (
          <button type="button" onClick={attemptRemove} aria-label={`Remove the question ${poll.question}`} title="Remove this question" className="-mr-2.5 -mt-2.5 grid h-11 w-11 flex-none place-items-center rounded-lg text-faint hover:text-brick-text sm:-mr-1.5 sm:-mt-1.5 sm:h-8 sm:w-8">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-brick-border bg-brick-bg px-3 py-2.5">
          <TriangleAlert size={16} className="flex-none text-brick-text" />
          <span className="min-w-0 flex-1 text-[13px] leading-[1.45] text-brick-text">Remove this question? Its {plural(total)} go with it.</span>
          <div className="flex flex-none gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="flex h-11 items-center rounded-[8px] border border-brick-border bg-s1 px-3 text-[13px] font-semibold text-brick-text sm:h-8">Cancel</button>
            <button type="button" onClick={() => { setConfirming(false); onRemove() }} className="flex h-11 items-center rounded-[8px] bg-brick px-3 text-[13px] font-semibold text-on-accent sm:h-8">Remove</button>
          </div>
        </div>
      )}

      <ul className="mt-3.5 flex flex-col gap-2">
        {poll.options.map((o, i) => {
          const ids = byOption[o.id]
          const mine = !!me && ids.includes(me)
          // the pile is capped, so a hundred votes on one option still draws three faces
          const people = hideVoters ? [] : ids.flatMap((id) => { const p = personOf(id); return p ? [p] : [] })
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onPick(o.id)}
                disabled={readOnly}
                aria-pressed={mine}
                aria-label={`${o.text}, ${plural(counts[i])}`}
                className={`relative flex min-h-11 w-full items-center gap-2.5 overflow-hidden rounded-[10px] border bg-s0 px-3 py-2 text-left ${mine ? 'border-accent-border' : 'border-border enabled:hover:border-border2'} disabled:cursor-default`}
              >
                <span data-bar aria-hidden className="absolute inset-y-0 left-0 w-0 bg-accent-bg" />
                <span className="relative flex min-w-0 flex-1 items-center gap-2">
                  {mine && <Check size={15} strokeWidth={2.5} className="flex-none text-accent-text" />}
                  <span className={`min-w-0 break-words text-[14px] leading-[1.35] ${mine ? 'font-semibold text-accent-text' : 'font-medium'}`}>{o.text}</span>
                </span>
                {people.length > 0 && (
                  <span className="relative flex-none" aria-hidden>
                    <AvatarRow people={people} max={3} size={20} font={8.5} overlap={5} ringColor="var(--s0)" />
                  </span>
                )}
                <span className="relative w-7 flex-none text-right text-[13.5px] font-semibold tabular-nums text-dim" aria-hidden>{counts[i]}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-[12.5px] text-dim">{total ? plural(total) : 'No votes yet'}</p>
    </div>
  )
}
