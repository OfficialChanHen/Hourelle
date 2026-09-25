'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowUp, Check, Minus, Plus, SlidersHorizontal, Vote, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { Popover } from '@/components/ui/Popover'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { DateField } from '@/components/ui/DateField'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { daysUntil, fromDay, todayKey } from '@/lib/events'
import { optionKey, pollClosed, pollKey, votesPerPerson, POLL_OPTION_LIMIT, POLL_OPTION_MAX_LEN, type PollSettings, type PollState } from '@/lib/polls'
import type { Avatar as Person } from '@/lib/people'

/* A poll as it sits in the chat, run like the place ballot on the Location tab: one
   row per option, ranked by votes, the one ahead marked, each with its count, who
   voted (a capped pile, unless the poll hides it) and the same vote button. The
   ballot's rules too: with one vote each a tap moves yours, with more you can pick
   up to the limit, and a tap on a pick takes it back. People add options at the
   bottom while the poll allows it. The poll's creator and the host get its settings
   behind the sliders button. Read-only after the closing day and once the plan is
   locked. */

const PILE = 6

type Row = { id: string; t: string; by?: string; ids: string[]; you: boolean; i: number }

function closesText(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function PollCard({ poll, votes, me, canVote, locked, canManage, onPick, onAdd, onSettings, avatarOf }: {
  poll: PollState
  votes: Record<string, string[]> | undefined
  me: string | null
  canVote: boolean     // this person can take part: on the event, not a demo
  locked: boolean      // the plan is locked in: the poll is a record now
  canManage: boolean   // the poll's creator or the event's host
  onPick: (optionId: string) => void
  onAdd: (text: string) => void
  onSettings: (s: PollSettings) => void
  avatarOf: (id: string) => Person
}) {
  const s = poll.s
  const past = pollClosed(s)
  const closed = locked || past
  const max = votesPerPerson(poll)

  // one pass over this poll's keys; every row below reads from it
  const { ranked, leadId, mine } = useMemo(() => {
    const rows: Row[] = poll.o.map((o, i) => {
      const ids = votes?.[pollKey(poll.id, o.id)] ?? []
      return { id: o.id, t: o.t, by: o.by, ids, you: !!me && ids.includes(me), i }
    })
    // most votes first, ties in the order they were added
    const ranked = [...rows].sort((a, b) => (b.ids.length - a.ids.length) || (a.i - b.i))
    const top = ranked[0]?.ids.length ?? 0
    // ahead means ahead: a tie at the top marks nobody
    const leadId = top > 0 && (ranked[1]?.ids.length ?? 0) < top ? ranked[0].id : null
    return { ranked, leadId, mine: rows.filter((r) => r.you) }
  }, [poll, votes, me])
  const left = Math.max(0, max - mine.length)

  const { scope: flipScope, capture } = useFlipReorder(ranked.map((r) => r.id).join('|'))
  function pick(id: string) {
    capture()
    onPick(id)
  }

  const canAdd = canVote && !closed && (s.add || canManage) && poll.o.length < POLL_OPTION_LIMIT

  return (
    // what changes inside a card (a count, an option someone added) is not read out
    // as a new line in the chat around it
    <div aria-live="off" className="w-full max-w-[92%] rounded-[14px] border border-border bg-s1 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint sm:text-[11px]">Poll</div>
        {canManage && !locked && (
          <Popover
            align="end"
            width={236}
            label="Poll settings"
            className="-my-2 -mr-2 flex-none sm:-my-1 sm:-mr-1"
            trigger={(open) => (
              <span className={`grid h-11 w-11 place-items-center rounded-[9px] border sm:h-8 sm:w-8 ${open ? 'border-accent bg-accent-bg text-accent-text' : 'border-transparent text-dim hover:border-border2 hover:bg-s2 hover:text-text'}`}>
                <SlidersHorizontal size={15} />
              </span>
            )}
          >
            {() => <PollSettingsPanel settings={s} optionCount={poll.o.length} onChange={onSettings} />}
          </Popover>
        )}
      </div>
      <p className="mt-1 break-words text-[14px] font-semibold leading-[1.35] text-text">{poll.q}</p>

      {/* the vote budget, the way the ballot says it */}
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-dim">
        <Vote size={15} className="flex-none text-accent-text" aria-hidden />
        {closed ? null : !canVote ? (
          <span>{max} {max === 1 ? 'vote' : 'votes'} each</span>
        ) : max > 1 ? (
          <span>{max} votes each, <span className={`font-semibold ${left ? 'text-accent-text' : 'text-brick-text'}`}>{left} left</span></span>
        ) : mine[0] ? (
          <span>1 vote each, yours is on <span className="font-semibold text-text">{mine[0].t}</span></span>
        ) : (
          <span>1 vote each, and you haven&apos;t voted yet</span>
        )}
        {closed ? (
          <span className="rounded-[5px] border border-brick-border bg-brick-bg px-[6px] py-px text-[12px] font-semibold text-brick-text sm:text-[10.5px]">Voting closed</span>
        ) : s.close ? (
          <span className={`rounded-[5px] border px-[6px] py-px text-[12px] font-semibold sm:text-[10.5px] ${(daysUntil(s.close) ?? 9) <= 2 ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-border bg-s2 text-dim'}`}>Closes {closesText(s.close)}</span>
        ) : null}
      </div>

      <div ref={flipScope} role="list" aria-label={poll.q} className="mt-2 flex flex-col gap-2">
        {ranked.map((r, rank) => {
          const n = r.ids.length
          const lead = r.id === leadId
          const adder = r.by && r.by !== poll.by ? avatarOf(r.by) : null
          const blocked = !r.you && max > 1 && left === 0
          return (
            <div key={r.id} role="listitem" data-flip-id={r.id} className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${lead ? 'border-accent-border bg-accent-bg/40' : 'border-border bg-s0'}`}>
              <span className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[13.5px] font-bold ${lead ? 'bg-accent text-on-accent' : 'bg-s2 text-dim'}`} aria-hidden>{rank + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 break-words text-[14px] font-semibold leading-[1.35]">{r.t}</span>
                  {lead && <span className="flex-none rounded-[5px] border border-accent-border bg-accent-bg px-[5px] py-px text-[12px] font-semibold text-accent-text sm:text-[10px]">{closed ? 'Most votes' : 'Leading'}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-[1.45] text-dim">
                  <span>{n} {n === 1 ? 'vote' : 'votes'}</span>
                  {adder && (
                    <span className="inline-flex items-center gap-1 text-faint">
                      <Avatar initials={adder.initials} color={adder.color} size={14} font={7} /> added by {r.by === me ? 'you' : adder.name.split(' ')[0]}
                    </span>
                  )}
                </div>
                {!s.hide && n > 0 && (
                  <div className="mt-1.5">
                    <AvatarRow
                      people={r.ids.slice(0, PILE).map(avatarOf)}
                      more={n > PILE ? `+${n - PILE}` : undefined}
                      max={PILE}
                      size={20}
                      font={8.5}
                      overlap={5}
                      ringColor="var(--s0)"
                    />
                  </div>
                )}
              </div>
              {canVote && !locked && (
                <button
                  type="button"
                  onClick={() => pick(r.id)}
                  aria-pressed={r.you}
                  aria-label={`Vote for ${r.t}`}
                  disabled={past || blocked}
                  title={past ? 'Voting is closed' : r.you ? 'Remove your vote' : blocked ? 'No votes left' : 'Vote for this option'}
                  className={`grid h-11 w-11 flex-none place-items-center rounded-[9px] border sm:h-[34px] sm:w-[34px] ${r.you ? 'border-accent bg-accent text-on-accent' : 'border-border2 bg-s1 text-text enabled:hover:bg-s2 disabled:opacity-40'}`}
                >
                  {r.you ? <Check size={18} /> : <ArrowUp size={18} />}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {canAdd && <AddOption taken={poll.o.map((o) => o.t)} onAdd={(t) => { capture(); onAdd(t) }} />}
    </div>
  )
}

// the field at the foot of the card, like suggesting a place, as plain text
function AddOption({ taken, onAdd }: { taken: string[]; onAdd: (t: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const errId = useId()
  const dup = !!draft.trim() && taken.some((t) => optionKey(t) === optionKey(draft))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim() || dup) return
    onAdd(draft)
    setDraft('')
    // the new row lands above the field: keep the field in sight for the next one.
    // Only the chat's own list scrolls, never the page under a phone's pinned sheet
    requestAnimationFrame(() => {
      const el = input.current
      const log = el?.closest<HTMLElement>('[role="log"]')
      if (!el || !log) return
      const over = el.getBoundingClientRect().bottom - log.getBoundingClientRect().bottom
      if (over > 0) log.scrollTop += over + 12
    })
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Plus size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            ref={input}
            value={draft}
            maxLength={POLL_OPTION_MAX_LEN}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add an option"
            aria-label="Add an option"
            aria-invalid={dup || undefined}
            aria-describedby={dup ? errId : undefined}
            className="h-11 w-full min-w-0 rounded-[10px] border border-border bg-s0 pl-8 pr-3 text-[13.5px] outline-none placeholder:text-faint focus:border-accent sm:h-9"
          />
        </div>
        {draft.trim() && (
          <button
            type="submit"
            disabled={dup}
            className="h-11 flex-none rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-on-accent disabled:opacity-40 sm:h-9"
          >
            Add
          </button>
        )}
      </div>
      {dup && <p id={errId} className="mt-1 px-0.5 text-[12px] text-brick-text">Already an option</p>}
    </form>
  )
}

/* The poll's settings, the same set as the ballot's. Each change goes out as one
   settings line, so a run of taps (a stepper held down) waits a moment and goes as
   one, and whatever is still waiting goes when the panel closes. */
function PollSettingsPanel({ settings, optionCount, onChange }: { settings: PollSettings; optionCount: number; onChange: (s: PollSettings) => void }) {
  const [draft, setDraft] = useState(settings)
  const cap = Math.max(1, optionCount)
  const n = Math.min(draft.n, cap)
  const [custom, setCustom] = useState(() => n > 3)
  const sent = useRef(JSON.stringify(settings))
  const pending = useRef<PollSettings | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const send = useRef(onChange)
  useEffect(() => { send.current = onChange })

  function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const next = pending.current
    pending.current = null
    if (!next || JSON.stringify(next) === sent.current) return
    sent.current = JSON.stringify(next)
    send.current(next)
  }
  // closing the panel unmounts it: anything waiting goes out then
  useEffect(() => flush, [])

  function change(patch: Partial<PollSettings>) {
    const next: PollSettings = { ...draft, ...patch }
    if (!next.close) delete next.close
    setDraft(next)
    pending.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 500)
  }
  const setN = (v: number) => change({ n: Math.min(cap, Math.max(1, v)) })

  const presets = [1, 2, 3].filter((v) => v <= cap).map((v) => ({ v: String(v), l: String(v) }))
  const options = cap > 3 ? [...presets, { v: 'custom', l: 'Custom' }] : presets

  return (
    <div className="flex flex-col gap-3 p-1">
      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[.12em] text-faint sm:text-[11px]">Votes per person</div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Votes per person"
            size="sm"
            value={custom ? 'custom' : String(n)}
            onChange={(v) => {
              if (v === 'custom') { setCustom(true); setN(Math.max(4, n)) }
              else { setCustom(false); setN(Number(v)) }
            }}
            options={options}
          />
          {custom && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setN(n - 1)} disabled={n <= 1} aria-label="Fewer votes" className="grid h-11 w-11 place-items-center rounded-[7px] border border-border2 bg-s1 enabled:hover:bg-s2 disabled:opacity-30 sm:h-7 sm:w-7"><Minus size={13} /></button>
              <input
                type="number" min={1} max={cap} value={n}
                onChange={(e) => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) setN(v) }}
                aria-label="Votes per person"
                className="h-11 w-11 rounded-[7px] border border-border bg-s1 px-1.5 text-center text-[13.5px] font-semibold tabular-nums text-text outline-none focus:border-accent sm:h-7"
              />
              <button type="button" onClick={() => setN(n + 1)} disabled={n >= cap} aria-label="More votes" className="grid h-11 w-11 place-items-center rounded-[7px] border border-border2 bg-s1 enabled:hover:bg-s2 disabled:opacity-30 sm:h-7 sm:w-7"><Plus size={13} /></button>
              <span className="text-[12px] text-faint">of {cap}</span>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border pt-2.5">
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[.12em] text-faint sm:text-[11px]">Voting closes</div>
        <div className="flex items-center gap-1.5">
          <DateField label="Voting closes" value={draft.close ?? ''} min={todayKey()} onChange={(v) => change({ close: fromDay(v, todayKey()) || undefined })} className="h-11 min-w-0 flex-1 !bg-s1 sm:h-8" />
          {draft.close && (
            <button type="button" onClick={() => change({ close: undefined })} title="Remove the closing date" aria-label="Remove the closing date" className="grid h-11 w-11 flex-none place-items-center rounded-[8px] border border-border2 text-dim hover:text-brick-text sm:h-8 sm:w-8"><X size={14} /></button>
          )}
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 border-t border-border pt-2.5 text-[13px] sm:min-h-0">
        <input type="checkbox" checked={draft.add} onChange={() => change({ add: !draft.add })} className="h-4 w-4 sm:h-3.5 sm:w-3.5" style={{ accentColor: 'var(--accent)' }} />
        Anyone can add options
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 border-t border-border pt-2.5 text-[13px] sm:min-h-0">
        <input type="checkbox" checked={draft.hide} onChange={() => change({ hide: !draft.hide })} className="h-4 w-4 sm:h-3.5 sm:w-3.5" style={{ accentColor: 'var(--accent)' }} />
        Hide who voted
      </label>
    </div>
  )
}
