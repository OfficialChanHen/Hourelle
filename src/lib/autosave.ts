/* Autosave for a field with no Save button (a plan's name, its spots, its budget).
   Nothing is written while someone is typing: a change waits until they have stopped
   for SETTLE_MS, then it is committed and the status reads "Saving", then "Saved",
   then goes quiet. Typing again hides the status until the next pause. `flush` writes
   a waiting change at once (blur, Enter, leaving the page); `cancel` drops it (Escape,
   or the field typed back to what is already saved). Kept free of React so the timing
   can be tested on its own. */

export type SaveStatus = 'idle' | 'saving' | 'saved'

export const SETTLE_MS = 2000 // the pause that counts as done typing
export const SAVING_MS = 600 // long enough to read, short enough not to feel slow
export const SAVED_MS = 2000

export type Autosave<T> = {
  change: (value: T) => void
  flush: () => void
  cancel: () => void
  dispose: () => void
}

export function createAutosave<T>(opts: {
  commit: (value: T) => void
  onStatus: (status: SaveStatus) => void
  settle?: number
  saving?: number
  saved?: number
}): Autosave<T> {
  const { settle = SETTLE_MS, saving = SAVING_MS, saved = SAVED_MS } = opts
  let pending: { value: T } | null = null
  let waitTimer: ReturnType<typeof setTimeout> | undefined
  let statusTimer: ReturnType<typeof setTimeout> | undefined

  const clear = () => { clearTimeout(waitTimer); clearTimeout(statusTimer) }

  function write(): boolean {
    if (!pending) return false
    const { value } = pending
    pending = null
    clear()
    opts.commit(value)
    return true
  }

  function flush() {
    if (!write()) return
    opts.onStatus('saving')
    statusTimer = setTimeout(() => {
      opts.onStatus('saved')
      statusTimer = setTimeout(() => opts.onStatus('idle'), saved)
    }, saving)
  }

  return {
    change(value) {
      pending = { value }
      clear()
      opts.onStatus('idle')
      waitTimer = setTimeout(flush, settle)
    },
    flush,
    cancel() {
      pending = null
      clear()
      opts.onStatus('idle')
    },
    // the field is going away: keep what was typed, with nobody left to tell
    dispose() {
      write()
      clear()
    },
  }
}
