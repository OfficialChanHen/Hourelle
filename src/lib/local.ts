'use client'

/* ── the one place that writes to this browser, and tells the truth about it ──
   Every write here used to be `try { setItem } catch {}`, which is the right shape
   for a browser that refuses to store anything (a private window, a locked-down
   profile) and the wrong shape for one that has simply run out of room. Those look
   identical from inside the catch, and the app treated both as nothing worth
   mentioning: an answer would be taken, drawn on screen, and gone on the next load.

   A browser gives an origin about 5MB. What fills it is photographs, which is why
   covers moved to Storage (see lib/covers). This is the other half of that fix: when
   a write does fail, somebody is told, once, in words that say what happened and
   what it means for the thing they just did. */

export const STORAGE_FULL = 'hourelle:storage-full'

/** Out of room, as opposed to not allowed to write at all. Browsers disagree about
 *  how to say it: a name, a legacy code, or Firefox's own. */
function isQuota(e: unknown): boolean {
  const err = e as { name?: string; code?: number } | null
  if (!err) return false
  return err.name === 'QuotaExceededError'
    || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || err.code === 22
    || err.code === 1014
}

// one notice per visit. The cause does not go away on its own, and a toast for every
// keystroke of a drag would be its own kind of broken.
let told = false

/** Write, and say whether it landed. A refusal that is not about space stays quiet,
 *  because a private window refuses everything and the app is built to work anyway. */
export function writeLocal(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (isQuota(e) && !told) {
      told = true
      // a write can happen inside a render (the grid persists from a state updater),
      // and telling a listener to update during one is a React warning. The news
      // waits for the current render to finish.
      queueMicrotask(() => window.dispatchEvent(new Event(STORAGE_FULL)))
    }
    return false
  }
}
