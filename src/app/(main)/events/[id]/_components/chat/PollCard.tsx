'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, Minus, Pencil, Plus, SlidersHorizontal, X } from 'lucide-react'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { Popover } from '@/components/ui/Popover'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { DateField } from '@/components/ui/DateField'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { daysUntil, fromDay, todayKey } from '@/lib/events'
import { canEditOption, canEditQuestion, optionKey, pollClosed, pollKey, votesPerPerson, POLL_OPTION_LIMIT, POLL_OPTION_MAX_LEN, POLL_QUESTION_MAX_LEN, type PollSettings, type PollState } from '@/lib/polls'
import type { Avatar as Person } from '@/lib/people'

/* A poll as it sits in the chat, run like the place ballot on the Location tab but
   pared down to what a quick vote needs: the question, then one compact row per
   option, ranked by votes. The whole row is the vote: a tap marks it the way the
   ballot marks a vote (accent border and a check), and a slim fill behind it shows
   its share. Each row carries a small pile of who voted (unless the poll hides it)
   and the count. The ballot's rules hold: with one vote each a tap moves yours, with
   more you can pick up to the limit, and a tap on a pick takes it back. The budget
   line only shows when it says something (more than one vote, a closing day, closed).
   Adding an option is a quiet link that opens a field, there for the host and, once
   the host allows it, for everyone. The host gets the settings behind the sliders
   button. The pencil turns the card into a form for rewording what you may reword:
   the host anything, everyone else what they wrote. While you are tapping, the rows
   keep their places, so a quick second tap lands on the option you meant; they move
   to their new ranking once you pause. Read-only after the closing day and once the
   plan is locked. */

// how long the rows hold still after a tap before they move to their new ranking
const HOLD_MS = 1200

const PILE = 3

type Row = { id: string; t: string; ids: string[]; you: boolean; i: number; by?: string }

function closesText(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function PollCard({ poll, votes, me, canVote, locked, host, canEdit, onPick, onAdd, onSettings, onEdit, avatarOf }: {
  poll: PollState
  votes: Record<string, string[]> | undefined
  me: string | null
  canVote: boolean     // this person can take part: on the event, not a demo
  locked: boolean      // the plan is locked in: the poll is a record now
  host: boolean        // the event's host: settings, adding, rewording anything
  canEdit: boolean     // may reword what they wrote (not a read-only view)
  onPick: (optionId: string) => void
  onAdd: (text: string) => void
  onSettings: (s: PollSettings) => void
  onEdit: (edit: { q?: string; o?: { id: string; t: string }[] }) => void
  avatarOf: (id: string) => Person
}) {
  const [editing, setEditing] = useState(false)
  const s = poll.s
  const past = pollClosed(s)
  const closed = locked || past
  const max = votesPerPerson(poll)
  const live = canVote && !closed

  // one pass over this poll's keys; every row below reads from it
  const { ranked, leadId, mine, total } = useMemo(() => {
    const rows: Row[] = poll.o.map((o, i) => {
      const ids = votes?.[pollKey(poll.id, o.id)] ?? []
      return { id: o.id, t: o.t, ids, you: !!me && ids.includes(me), i, by: o.by }
    })
    // most votes first, ties in the order they were added
    const ranked = [...rows].sort((a, b) => (b.ids.length - a.ids.length) || (a.i - b.i))
    const top = ranked[0]?.ids.length ?? 0
    // ahead means ahead: a tie at the top marks nobody
    const leadId = top > 0 && (ranked[1]?.ids.length ?? 0) < top ? ranked[0].id : null
    const total = rows.reduce((sum, r) => sum + r.ids.length, 0)
    return { ranked, leadId, mine: rows.filter((r) => r.you), total }
  }, [poll, votes, me])
  const left = Math.max(0, max - mine.length)

  // the order on screen: the ranking, except while you are tapping, when the rows hold
  // the places they had at your first tap (an option added meanwhile goes at the end)
  const [held, setHeld] = useState<string[] | null>(null)
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (releaseTimer.current) clearTimeout(releaseTimer.current) }, [])
  const shown = useMemo(() => {
    if (!held) return ranked
    const byId = new Map(ranked.map((r) => [r.id, r]))
    return [...held.flatMap((id) => byId.get(id) ?? []), ...ranked.filter((r) => !held.includes(r.id))]
  }, [ranked, held])
  const { scope: flipScope, capture } = useFlipReorder(shown.map((r) => r.id).join('|'))
  function release() {
    if (releaseTimer.current) { clearTimeout(releaseTimer.current); releaseTimer.current = null }
    if (!held) return
    capture()
    setHeld(null)
  }
  function pick(id: string) {
    if (!held) setHeld(shown.map((r) => r.id))
    if (releaseTimer.current) clearTimeout(releaseTimer.current)
    releaseTimer.current = setTimeout(() => { releaseTimer.current = null; capture(); setHeld(null) }, HOLD_MS)
    onPick(id)
  }

  const mayEditQ = canEdit && canEditQuestion(poll, me, host)
  const mayEditAny = !locked && canEdit && (mayEditQ || poll.o.some((o) => canEditOption(poll, o, me, host)))
  const canAdd = live && (s.add || host) && poll.o.length < POLL_OPTION_LIMIT
  // one vote each and no deadline: nothing to say, so no line
  const status = closed || max > 1 || !!s.close

  return (
    // what changes inside a card (a count, an option someone added) is not read out
    // as a new line in the chat around it
    <div aria-live="off" className="w-full max-w-[min(92%,360px)] rounded-2xl border border-border bg-s1 p-3">
      <div className="flex items-start gap-2">
        {/* while editing, the question is in its field below: the heading only says so */}
        {editing
          ? <p className="min-w-0 flex-1 text-[12px] font-semibold uppercase tracking-[.12em] text-faint sm:text-[11px]">Editing poll</p>
          : <p className="min-w-0 flex-1 break-words text-[14px] font-semibold leading-[1.35] text-text">{poll.q}</p>}
        {mayEditAny && !editing && (
          <button
            type="button"
            onClick={() => { release(); setEditing(true) }}
            aria-label="Edit poll"
            title="Edit poll"
            className="-my-3 grid h-11 w-11 flex-none place-items-center rounded-[8px] border border-transparent text-faint hover:border-border2 hover:bg-s2 hover:text-text sm:-my-1 sm:h-7 sm:w-7"
          >
            <Pencil size={14} />
          </button>
        )}
        {host && !locked && (
          <Popover
            align="end"
            width={236}
            label="Poll settings"
            className="-my-3 -mr-2 flex-none sm:-my-1 sm:-mr-1"
            trigger={(open) => (
              <span className={`grid h-11 w-11 place-items-center rounded-[8px] border sm:h-7 sm:w-7 ${open ? 'border-accent bg-accent-bg text-accent-text' : 'border-transparent text-faint hover:border-border2 hover:bg-s2 hover:text-text'}`}>
                <SlidersHorizontal size={14} />
              </span>
            )}
          >
            {() => <PollSettingsPanel settings={s} optionCount={poll.o.length} onChange={onSettings} />}
          </Popover>
        )}
      </div>

      {status && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-dim">
          {closed ? (
            <span className="rounded-[5px] border border-brick-border bg-brick-bg px-[6px] py-px text-[12px] font-semibold text-brick-text sm:text-[10.5px]">Voting closed</span>
          ) : (
            <>
              {max > 1 && (canVote
                ? <span>{max} votes each, <span className={`font-semibold ${left ? 'text-accent-text' : 'text-brick-text'}`}>{left} left</span></span>
                : <span>{max} votes each</span>)}
              {s.close && (
                <span className={`rounded-[5px] border px-[6px] py-px text-[12px] font-semibold sm:text-[10.5px] ${(daysUntil(s.close) ?? 9) <= 2 ? 'border-ochre-border bg-ochre-bg text-ochre-text' : 'border-border bg-s2 text-dim'}`}>Closes {closesText(s.close)}</span>
              )}
            </>
          )}
        </div>
      )}

      {editing ? (
        <PollEditForm poll={poll} me={me} host={host} onSave={(edit) => { if (edit) onEdit(edit); setEditing(false) }} />
      ) : (
      <div
        ref={flipScope}
        role="list"
        aria-label={poll.q}
        className="mt-2.5 flex flex-col gap-1.5"
        // a mouse that leaves the list is done tapping: the rows can move now. A finger
        // lifting also "leaves", so touch waits for the pause instead
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') release() }}
      >
        {shown.map((r) => {
          const n = r.ids.length
          const label = `${r.t}, ${n} ${n === 1 ? 'vote' : 'votes'}`
          const blocked = !r.you && max > 1 && left === 0
          const share = total ? Math.round((n / total) * 100) : 0
          const row = `relative flex min-h-11 w-full items-center gap-2.5 overflow-hidden rounded-[10px] border bg-s1 px-3 py-2 text-left sm:min-h-[38px] sm:py-1.5 ${r.you ? 'border-accent' : 'border-border'}`
          const inner = (
            <>
              {/* the share of votes, a slim fill behind the row */}
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 transition-[width] duration-300 motion-reduce:transition-none ${r.you ? 'bg-accent-bg' : 'bg-s2'}`}
                style={{ width: `${share}%` }}
              />
              {(live || r.you) && (
                <span aria-hidden className={`relative grid h-[18px] w-[18px] flex-none place-items-center rounded-full border ${r.you ? 'border-accent bg-accent text-on-accent' : `border-border2 bg-s1 ${blocked ? 'opacity-40' : ''}`}`}>
                  {r.you && <Check size={12} strokeWidth={3} />}
                </span>
              )}
              <span aria-hidden className="relative min-w-0 flex-1 break-words text-[14px] font-medium leading-[1.3] text-text">
                {r.t}
                {/* who put it there, while the poll lets others add options: the poll's
                    own options need no credit, and with adding off nobody else can */}
                {s.add && r.by && r.by !== poll.by && (
                  <span className="block text-[12px] font-normal text-faint sm:text-[11.5px]">Added by {r.by === me ? 'you' : avatarOf(r.by).name.split(' ')[0]}</span>
                )}
              </span>
              {!s.hide && n > 0 && (
                <span aria-hidden className="relative flex-none">
                  <AvatarRow people={r.ids.slice(0, PILE).map(avatarOf)} more={n > PILE ? `+${n - PILE}` : undefined} max={PILE} size={20} font={8.5} overlap={5} decorative />
                </span>
              )}
              <span aria-hidden className={`relative min-w-[1.25rem] flex-none text-right text-[13px] tabular-nums ${r.id === leadId ? 'font-bold text-text' : 'font-medium text-dim'}`}>{n}</span>
            </>
          )
          return (
            <div key={r.id} role="listitem" data-flip-id={r.id}>
              {live ? (
                <button
                  type="button"
                  onClick={() => pick(r.id)}
                  aria-pressed={r.you}
                  aria-label={label}
                  disabled={blocked}
                  title={blocked ? 'No votes left' : undefined}
                  className={`${row} ${r.you ? '' : 'enabled:hover:border-border2'}`}
                >
                  {inner}
                </button>
              ) : (
                <div className={row}>
                  <span className="sr-only">{r.you ? `${label}, your vote` : label}</span>
                  {inner}
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {canAdd && !editing && <AddOption taken={poll.o.map((o) => o.t)} onAdd={(t) => { capture(); onAdd(t) }} />}
    </div>
  )
}

/* Rewording a poll in place. What you may change is a field; what you may not stays as
   plain text, so the form still reads as the whole poll. Save sends one line with only
   what changed; a blank or a repeat of another option keeps Save off and says why.
   Escape (or Cancel) leaves it as it was. */
function PollEditForm({ poll, me, host, onSave }: {
  poll: PollState
  me: string | null
  host: boolean
  onSave: (edit: { q?: string; o?: { id: string; t: string }[] } | null) => void
}) {
  const mayQ = canEditQuestion(poll, me, host)
  const [q, setQ] = useState(poll.q)
  const [opts, setOpts] = useState<Record<string, string>>(() => Object.fromEntries(poll.o.map((o) => [o.id, o.t])))
  const first = useRef<HTMLInputElement>(null)
  const errId = useId()
  useEffect(() => { first.current?.focus() }, [])

  const tidy = (t: string) => t.trim().replace(/\s+/g, ' ')
  const keys = poll.o.map((o) => optionKey(opts[o.id] ?? ''))
  const dupIds = new Set(poll.o.filter((o, i) => keys[i] && keys.indexOf(keys[i]) !== i).map((o) => o.id))
  const blankQ = mayQ && !tidy(q)
  const blankIds = new Set(poll.o.filter((o) => !tidy(opts[o.id] ?? '')).map((o) => o.id))
  const changedQ = mayQ && tidy(q) !== poll.q
  const changedO = poll.o.filter((o) => canEditOption(poll, o, me, host) && tidy(opts[o.id] ?? '') !== o.t)
  const problem = blankQ ? 'The question can’t be empty' : blankIds.size ? 'An option can’t be empty' : dupIds.size ? 'Two options say the same thing' : null
  const ready = !problem && (changedQ || changedO.length > 0)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    onSave({
      ...(changedQ ? { q: tidy(q) } : {}),
      ...(changedO.length ? { o: changedO.map((o) => ({ id: o.id, t: tidy(opts[o.id]) })) } : {}),
    })
  }
  const field = 'h-11 w-full min-w-0 rounded-[10px] border bg-s0 px-3 text-[13.5px] outline-none focus:border-accent sm:h-9'
  // the cursor starts in the first field: the question, or else the first option you wrote
  const focusId = mayQ ? null : poll.o.find((o) => canEditOption(poll, o, me, host))?.id

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onSave(null) } }}
      className="mt-2.5 flex flex-col gap-1.5"
      aria-label="Edit poll"
    >
      {mayQ && (
        <input
          ref={first}
          value={q}
          maxLength={POLL_QUESTION_MAX_LEN}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Question"
          aria-invalid={blankQ || undefined}
          className={`${field} font-semibold ${blankQ ? 'border-brick-border' : 'border-border'}`}
        />
      )}
      {poll.o.map((o) => {
        if (!canEditOption(poll, o, me, host)) return (
          <p key={o.id} className="flex min-h-11 items-center rounded-[10px] border border-border bg-s1 px-3 text-[13.5px] text-dim sm:min-h-9">{o.t}</p>
        )
        const bad = dupIds.has(o.id) || blankIds.has(o.id)
        return (
          <input
            key={o.id}
            ref={o.id === focusId ? first : undefined}
            value={opts[o.id] ?? ''}
            maxLength={POLL_OPTION_MAX_LEN}
            onChange={(e) => setOpts((prev) => ({ ...prev, [o.id]: e.target.value }))}
            aria-label={`Option: ${o.t}`}
            aria-invalid={bad || undefined}
            aria-describedby={bad ? errId : undefined}
            className={`${field} ${bad ? 'border-brick-border' : 'border-border'}`}
          />
        )
      })}
      {problem && <p id={errId} className="px-0.5 text-[12px] text-brick-text">{problem}</p>}
      <div className="mt-1 flex items-center justify-end gap-2">
        <button type="button" onClick={() => onSave(null)} className="h-11 rounded-full border border-border2 bg-s1 px-3.5 text-[13px] font-medium hover:bg-s2 sm:h-8">Cancel</button>
        <button type="submit" disabled={!ready} className="h-11 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent disabled:opacity-40 sm:h-8">Save</button>
      </div>
    </form>
  )
}

// a quiet link at the foot of the card that opens into a field, like suggesting a place
function AddOption({ taken, onAdd }: { taken: string[]; onAdd: (t: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  // Escape hands the cursor back to the link it came from; a click away does not
  const refocus = useRef(false)
  const errId = useId()
  const dup = !!draft.trim() && taken.some((t) => optionKey(t) === optionKey(draft))

  useEffect(() => {
    if (open) input.current?.focus()
    else if (refocus.current) { refocus.current = false; opener.current?.focus() }
  }, [open])

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

  if (!open) return (
    <button
      ref={opener}
      type="button"
      onClick={() => setOpen(true)}
      className="-mb-1.5 mt-1 flex h-11 items-center gap-1.5 rounded-[8px] px-1 text-[13px] font-medium text-dim hover:text-text sm:mb-0 sm:h-8"
    >
      <Plus size={14} aria-hidden /> Add an option
    </button>
  )

  return (
    <form onSubmit={submit} className="mt-2">
      <div className="flex items-center gap-1.5">
        <input
          ref={input}
          value={draft}
          maxLength={POLL_OPTION_MAX_LEN}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (!draft.trim()) setOpen(false) }}
          onKeyDown={(e) => {
            // the chat takes Escape to close; here it only folds the field away
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(''); refocus.current = true; setOpen(false) }
          }}
          aria-label="Add an option"
          aria-invalid={dup || undefined}
          aria-describedby={dup ? errId : undefined}
          className="h-11 w-full min-w-0 flex-1 rounded-[10px] border border-border bg-s0 px-3 text-[13.5px] outline-none placeholder:text-faint focus:border-accent sm:h-9"
        />
        {draft.trim() && (
          <button
            type="submit"
            disabled={dup}
            className="h-11 flex-none rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent disabled:opacity-40 sm:h-9"
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
