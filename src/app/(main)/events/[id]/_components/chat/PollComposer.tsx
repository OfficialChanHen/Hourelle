'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { makePoll, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, type Poll } from '@/lib/polls'

/* The form for a new poll, in the chat where the composer was. A question and two to
   six options. It scrolls inside itself, so with a phone keyboard up it gives way to
   the space that is left instead of pushing the chat off the screen. */

const EXAMPLES = ['Catan', 'Codenames', 'Ticket to Ride', 'Wingspan', 'Mafia', 'Uno']
const Q_MAX = 140
const OPT_MAX = 60

const field = 'h-11 w-full min-w-0 rounded-[10px] border border-border bg-s1 px-3 text-[13.5px] outline-none placeholder:text-faint focus:border-accent sm:h-[38px]'

export function PollComposer({ onPost, onCancel }: { onPost: (p: Poll) => void; onCancel: () => void }) {
  const root = useRef<HTMLFormElement>(null)
  const question = useRef<HTMLInputElement>(null)
  const nextKey = useRef(2)
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState<{ key: number; t: string }[]>([{ key: 0, t: '' }, { key: 1, t: '' }])
  // a new option row takes the cursor as it mounts, so "Add option" can be followed by typing
  const focusNext = useRef<number | null>(null)

  const filled = opts.filter((o) => o.t.trim()).length
  const ready = !!q.trim() && filled >= POLL_MIN_OPTIONS

  useEffect(() => { question.current?.focus() }, [])

  useGSAP(() => {
    gsap.from(root.current, { y: 8, opacity: 0, duration: 0.22, ease: 'power2.out' })
  }, { scope: root })

  function add() {
    if (opts.length >= POLL_MAX_OPTIONS) return
    const key = nextKey.current++
    focusNext.current = key
    setOpts([...opts, { key, t: '' }])
  }
  function remove(key: number) {
    if (opts.length <= POLL_MIN_OPTIONS) return
    setOpts(opts.filter((o) => o.key !== key))
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    onPost(makePoll(q, opts.map((o) => o.t)))
  }

  return (
    <form
      ref={root}
      onSubmit={submit}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }}
      aria-label="New poll"
      className="scroll-slim max-h-[75%] min-h-0 shrink overflow-auto overscroll-contain border-t border-border px-[11px] pb-[11px] pt-3"
    >
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-dim">Question</span>
        <input
          ref={question}
          value={q}
          maxLength={Q_MAX}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Which game?"
          className={field}
        />
      </label>

      <fieldset className="mt-3">
        <legend className="mb-1 text-[12px] font-semibold text-dim">Options</legend>
        <div className="flex flex-col gap-1.5">
          {opts.map((o, i) => (
            <div key={o.key} className="flex items-center gap-1.5">
              <input
                ref={(el) => { if (el && focusNext.current === o.key) { focusNext.current = null; el.focus() } }}
                value={o.t}
                maxLength={OPT_MAX}
                onChange={(e) => setOpts(opts.map((x) => (x.key === o.key ? { ...x, t: e.target.value } : x)))}
                placeholder={EXAMPLES[i % EXAMPLES.length]}
                aria-label={`Option ${i + 1}`}
                className={field}
              />
              {opts.length > POLL_MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => remove(o.key)}
                  aria-label={`Remove option ${i + 1}`}
                  className="grid h-11 w-11 flex-none place-items-center rounded-[10px] text-faint hover:bg-s2 hover:text-text sm:h-[38px] sm:w-[38px]"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {opts.length < POLL_MAX_OPTIONS && (
          <button
            type="button"
            onClick={add}
            className="mt-1.5 flex h-11 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-semibold text-accent-text hover:bg-accent-bg sm:h-9"
          >
            <Plus size={15} /> Add option
          </button>
        )}
      </fieldset>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-[12px] px-3.5 text-[13.5px] font-semibold text-dim hover:bg-s2 hover:text-text sm:h-[38px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready}
          className="h-11 rounded-[12px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent disabled:opacity-40 sm:h-[38px]"
        >
          Post poll
        </button>
      </div>
    </form>
  )
}
