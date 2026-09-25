'use client'

/* ── the Vote tab's questions ──
   Anything the group has to settle besides the place: which game, whose car, what
   to cook. The host adds a question with a few options; everyone picks one.

   The questions sit on the event document and only the host changes them. Picks go
   in `event.votes` under poll keys (see lib/polls), so they save as rows like place
   votes do. Every write goes through `save`, which works the change out from the
   event as this device holds it now, never from what this screen last drew, and a
   pick only ever touches your own entry. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { AppEvent } from '@/lib/events'
import type { Avatar as Person } from '@/lib/people'
import { newPoll, pollKey, withPollPick, withoutPoll, type Poll } from '@/lib/polls'
import { PollCard } from './PollCard'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 6
// examples only, the way a group chat would put it
const OPTION_EXAMPLES = ['Catan', 'Codenames', 'Wavelength', 'Ticket to Ride', 'Just One', 'Azul']

export type SaveWith = (make: (current: AppEvent) => Partial<AppEvent>) => void

/** Whether the section draws anything: a guest with no questions sees nothing extra. */
export function questionsShown(event: AppEvent, locked: boolean): boolean {
  return (event.polls?.length ?? 0) > 0 || (event.hostedByYou && !locked)
}

export function QuestionsSection({ event, locked, save }: { event: AppEvent; locked: boolean; save: SaveWith }) {
  const me = event.participants.find((p) => p.you)?.id ?? ''
  const polls = event.polls ?? []
  const canManage = event.hostedByYou && !locked
  const [adding, setAdding] = useState(false)
  // closing the form hands focus back to the button that opened it
  const addButton = useRef<HTMLButtonElement>(null)
  const wasAdding = useRef(false)
  useEffect(() => {
    if (wasAdding.current && !adding) addButton.current?.focus()
    wasAdding.current = adding
  }, [adding])

  // one lookup for every card, built once per roster rather than once per option
  const people = useMemo(() => new Map(event.participants.map((p) => [p.id, { initials: p.initials, name: p.name, color: p.color } as Person])), [event.participants])
  const personOf = (id: string) => people.get(id) ?? null

  if (!questionsShown(event, locked)) return null

  function pick(poll: Poll, optionId: string) {
    if (!me || locked) return
    save((cur) => {
      // yours as saved right now: the same option again takes it back
      const current = poll.options.find((o) => (cur.votes?.[pollKey(poll.id, o.id)] ?? []).includes(me))?.id ?? null
      return { votes: withPollPick(cur.votes, poll, me, current === optionId ? null : optionId) }
    })
  }
  function addPoll(question: string, options: string[]) {
    const poll = newPoll(question, options, me)
    save((cur) => ({ polls: [...(cur.polls ?? []), poll] }))
    setAdding(false)
  }
  function removePoll(id: string) {
    // the host may clear everyone's picks on it, which is what removing a question means
    save((cur) => ({ polls: (cur.polls ?? []).filter((p) => p.id !== id), votes: withoutPoll(cur.votes, id) }))
  }

  return (
    <section aria-labelledby="questions-heading" className="mt-8 sm:mt-9">
      <h2 id="questions-heading" className="mb-4 text-[12px] font-semibold uppercase tracking-[.13em] text-faint sm:text-[11px]">Questions</h2>

      {polls.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              votes={event.votes}
              me={me}
              personOf={personOf}
              hideVoters={!!event.hideVoters}
              readOnly={locked || !me}
              canRemove={canManage}
              onPick={(optionId) => pick(poll, optionId)}
              onRemove={() => removePoll(poll.id)}
            />
          ))}
        </div>
      )}

      {canManage && (
        adding
          ? <AddQuestionForm onCancel={() => setAdding(false)} onAdd={addPoll} className={polls.length ? 'mt-3' : ''} />
          : (
            <button
              ref={addButton}
              type="button"
              onClick={() => setAdding(true)}
              className={`flex h-11 items-center gap-1.5 rounded-[10px] border border-border2 bg-s1 px-4 text-[14px] font-semibold hover:bg-s2 ${polls.length ? 'mt-3' : ''}`}
            >
              <Plus size={16} /> Add a question
            </button>
          )
      )}
    </section>
  )
}

function AddQuestionForm({ onCancel, onAdd, className = '' }: { onCancel: () => void; onAdd: (question: string, options: string[]) => void; className?: string }) {
  const [question, setQuestion] = useState('')
  // each field keeps its own key, so removing one never shifts what is typed in the others
  const [options, setOptions] = useState(() => [{ k: 1, text: '' }, { k: 2, text: '' }])
  const [nextKey, setNextKey] = useState(3)

  // blanks are dropped and repeats counted once; two real options are the least a vote needs
  const cleaned = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const o of options) {
      const t = o.text.trim()
      if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t) }
    }
    return out
  }, [options])
  const ready = question.trim().length > 0 && cleaned.length >= MIN_OPTIONS

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (ready) onAdd(question.trim(), cleaned)
  }
  function addOption() {
    if (options.length >= MAX_OPTIONS) return
    setOptions((cur) => [...cur, { k: nextKey, text: '' }])
    setNextKey((k) => k + 1)
  }

  const field = 'h-11 w-full min-w-0 rounded-[10px] border border-border bg-s0 px-3 text-[14px] outline-none placeholder:text-faint focus:border-accent'

  return (
    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }} className={`max-w-[560px] rounded-xl border border-border bg-s1 p-5 shadow-soft ${className}`}>
      <label htmlFor="new-question" className="text-[13px] font-semibold">Question</label>
      <input
        id="new-question"
        autoFocus
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Which game?"
        maxLength={120}
        autoComplete="off"
        className={`mt-1.5 ${field}`}
      />

      <fieldset className="mt-4">
        <legend className="text-[13px] font-semibold">Options</legend>
        <div className="mt-1.5 flex flex-col gap-2">
          {options.map((o, i) => (
            <div key={o.k} className="flex items-center gap-2">
              <input
                value={o.text}
                onChange={(e) => { const v = e.target.value; setOptions((cur) => cur.map((x) => (x.k === o.k ? { ...x, text: v } : x))) }}
                placeholder={OPTION_EXAMPLES[i]}
                aria-label={`Option ${i + 1}`}
                maxLength={80}
                autoComplete="off"
                className={field}
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => setOptions((cur) => cur.filter((x) => x.k !== o.k))}
                  aria-label={`Remove option ${i + 1}`}
                  className="grid h-11 w-11 flex-none place-items-center rounded-[10px] text-faint hover:bg-s2 hover:text-brick-text"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < MAX_OPTIONS && (
          <button type="button" onClick={addOption} className="-ml-1 mt-1.5 flex h-11 items-center gap-1.5 rounded-[10px] px-1 text-[13.5px] font-semibold text-accent-text hover:underline">
            <Plus size={15} /> Add option
          </button>
        )}
      </fieldset>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="flex h-11 items-center rounded-[10px] border border-border2 bg-s1 px-4 text-[14px] font-semibold hover:bg-s2 sm:h-10">Cancel</button>
        <button type="submit" disabled={!ready} className="flex h-11 items-center rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-40 sm:h-10">Add question</button>
      </div>
    </form>
  )
}
