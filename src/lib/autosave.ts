/* Autosave for a field with no Save button (a plan's name, its spots, its budget).
   Nothing is written while someone is typing: a change waits until they have stopped
   for SETTLE_MS, then it is committed and the status reads "Saving" until the
   database answers. Only a save the database confirmed reads "Saved" (then goes
   quiet); one it refused, or that never reached it, reads "Not saved" and stays until
   it is tried again or the field changes. Typing again hides the status until the
   next pause. `flush` writes a waiting change at once (blur, Enter, leaving the page);
   `cancel` drops it (Escape, or the field typed back to what is already saved);
   `retry` sends the change that did not save. Kept free of React so the timing can
   be tested on its own. */

import type { SaveResult } from './remote'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

export const SETTLE_MS = 2000 // the pause that counts as done typing
export const SAVING_MS = 600 // shown at least this long, so a fast save is still readable
export const SAVED_MS = 2000

export type Autosave<T> = {
  change: (value: T) => void
  flush: () => void
  cancel: () => void
  retry: () => void
  dispose: () => void
}

// a commit that returns nothing has nobody further to ask, so it counts as saved
export type Commit<T> = (value: T) => Promise<SaveResult> | SaveResult | void

const NOT_SENT = 'The change could not be saved.'
/** What became of one write, however it answered: a result, nothing (saved), a
 *  throw or a rejection (not saved). Shared by autosave and the Save buttons. */
export function answerOf(write: () => ReturnType<Commit<unknown>>): Promise<SaveResult> {
  let sent: ReturnType<Commit<unknown>>
  try { sent = write() } catch { return Promise.resolve({ ok: false, message: NOT_SENT }) }
  return Promise.resolve(sent).then((r): SaveResult => r ?? { ok: true }, (): SaveResult => ({ ok: false, message: NOT_SENT }))
}

/* The field trigger raises sentences meant to be read; a bare policy refusal does
   not, so it gets one. "Violates" alone was too wide a net: a foreign key that is
   not there yet also violates something, and a change that arrived a moment early
   was being reported to the person as a change they were not allowed to make. */
export function saveErrorText(message: string): string {
  if (/row-level security|policy/i.test(message)) return 'You do not have permission to make that change.'
  if (/foreign key|is not present in table/i.test(message)) return 'That change arrived before the plan did. It is still on this device; reload to send it again.'
  return message
}

export function createAutosave<T>(opts: {
  commit: Commit<T>
  onStatus: (status: SaveStatus) => void
  settle?: number
  saving?: number
  saved?: number
}): Autosave<T> {
  const { settle = SETTLE_MS, saving = SAVING_MS, saved = SAVED_MS } = opts
  let pending: { value: T } | null = null
  let failed: { value: T } | null = null
  let waitTimer: ReturnType<typeof setTimeout> | undefined
  let statusTimer: ReturnType<typeof setTimeout> | undefined
  // each save takes a number; an answer to an older one, arriving after the field
  // has changed again, is no longer what the status is about
  let round = 0

  const clear = () => { clearTimeout(waitTimer); clearTimeout(statusTimer) }
  const later = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  function send(value: T) {
    const mine = ++round
    clear()
    failed = null
    opts.onStatus('saving')
    // committed right away, not on a later tick: a flush from pagehide has to write
    // before the page goes
    const answer = answerOf(() => opts.commit(value))
    void Promise.all([answer, later(saving)]).then(([r]) => {
      if (mine !== round) return
      if (!r.ok) { failed = { value }; opts.onStatus('failed'); return }
      opts.onStatus('saved')
      statusTimer = setTimeout(() => { if (mine === round) opts.onStatus('idle') }, saved)
    })
  }

  function flush() {
    if (!pending) return
    const { value } = pending
    pending = null
    send(value)
  }

  return {
    change(value) {
      pending = { value }
      failed = null
      round++
      clear()
      opts.onStatus('idle')
      waitTimer = setTimeout(flush, settle)
    },
    flush,
    cancel() {
      pending = null
      failed = null
      round++
      clear()
      opts.onStatus('idle')
    },
    retry() {
      if (failed) send(failed.value)
    },
    // the field is going away: keep what was typed, with nobody left to tell
    dispose() {
      round++
      clear()
      const last = pending
      pending = null
      if (!last) return
      try { void Promise.resolve(opts.commit(last.value)).catch(() => {}) } catch { /* nobody left to tell */ }
    },
  }
}
