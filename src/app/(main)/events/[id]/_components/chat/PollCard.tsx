'use client'

import { useMemo, useRef } from 'react'
import { Check } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { pollKey, type Poll } from '@/lib/polls'
import type { Avatar as Person } from '@/lib/people'

/* A poll as it sits in the chat: the question, then one full-width row per option
   with a bar for its share of the picks, who picked it (a capped pile) and the count.
   One pick each: tapping another row moves yours, tapping your own takes it back.
   Read-only once the plan is locked, in a demo, or for someone not on the event. */

export function PollCard({ poll, votes, me, canVote, closed, onPick, avatarOf }: {
  poll: Poll
  votes: Record<string, string[]> | undefined
  me: string | null
  canVote: boolean
  closed: boolean
  onPick: (optionId: string) => void
  avatarOf: (id: string) => Person
}) {
  // one pass over this poll's keys; every row below reads from it
  const rows = useMemo(() => poll.o.map((o) => {
    const ids = votes?.[pollKey(poll.id, o.id)] ?? []
    return { o, ids, picked: !!me && ids.includes(me) }
  }), [poll, votes, me])
  const total = rows.reduce((n, r) => n + r.ids.length, 0)
  const count = total === 0 ? 'No votes yet' : `${total} ${total === 1 ? 'vote' : 'votes'}`

  return (
    <div className="w-full max-w-[92%] rounded-[14px] border border-border bg-s1 p-3">
      <div className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint sm:text-[11px]">Poll</div>
      <p className="mt-1 break-words text-[14px] font-semibold leading-[1.35] text-text">{poll.q}</p>
      <div role="group" aria-label={poll.q} className="mt-2.5 flex flex-col gap-1.5">
        {rows.map(({ o, ids, picked }) => {
          const n = ids.length
          const pct = total ? (n / total) * 100 : 0
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={picked}
              aria-label={`${o.t}, ${n} ${n === 1 ? 'vote' : 'votes'}`}
              disabled={!canVote}
              onClick={() => onPick(o.id)}
              className={`relative flex min-h-11 w-full items-center gap-2 overflow-hidden rounded-[10px] border bg-s1 px-2.5 py-1.5 text-left disabled:cursor-default sm:min-h-[38px] ${
                picked ? 'border-accent' : 'border-border enabled:hover:border-border2'
              }`}
            >
              <Fill pct={pct} />
              <span className="relative flex min-w-0 flex-1 items-center gap-1.5">
                {picked && <Check size={14} strokeWidth={2.5} className="flex-none text-accent-text" aria-hidden />}
                <span className={`min-w-0 break-words text-[13px] leading-[1.35] ${picked ? 'font-semibold text-accent-text' : 'text-text'}`}>{o.t}</span>
              </span>
              {n > 0 && (
                <span className="relative flex-none" aria-hidden>
                  <AvatarRow people={ids.slice(0, 3).map(avatarOf)} more={n > 3 ? `+${n - 3}` : undefined} size={18} max={3} overlap={5} font={7.5} />
                </span>
              )}
              <span className="relative min-w-[1.25rem] flex-none text-right text-[12.5px] font-semibold tabular-nums text-dim" aria-hidden>{n}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[12px] text-faint">{closed ? `${count}. Voting closed.` : count}</p>
    </div>
  )
}

// the option's share of the picks, grown to its width rather than jumping to it
function Fill({ pct }: { pct: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useGSAP(() => {
    gsap.to(ref.current, { width: `${pct}%`, duration: 0.4, ease: 'power2.out' })
  }, { dependencies: [pct] })
  return <span ref={ref} aria-hidden className="absolute inset-y-0 left-0 w-0 bg-accent-bg" />
}
