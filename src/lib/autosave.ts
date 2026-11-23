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
    let sent: ReturnType<Commit<T>>
    try { sent = opts.commit(value) } catch { sent = { ok: false, message: 'The change could not be saved.' } }
    const answer = Promise.resolve(sent)
      .then((r): SaveResult => r ?? { ok: true }, (): SaveResult => ({ ok: false, message: 'The change could not be saved.' }))
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
