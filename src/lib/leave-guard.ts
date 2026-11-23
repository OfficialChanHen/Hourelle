/* ── unsaved changes, asked about once on the way out ──
   A part of a page that holds a draft behind a Save button (your times in Edit mine,
   an open editor on Details, the profile card) registers here while its draft differs
   from what is saved. Leaving for somewhere else inside the app (a link, the back
   button, another plan tab) first asks one question for all of them: Save, Don't save,
   or stay. Closing the tab or the window asks nothing: the draft only ever lived in
   memory, so it goes with the page, which is the "don't save" answer.

   `confirmLeave` is the one door: it resolves true when the way out is clear (nothing
   unsaved, everything saved, or everything dropped) and false when the person stays.
   The dialog itself is drawn by <LeaveGuard>, which listens through `onAsk`. */

export type Guard = {
  /** keep the draft; false when it could not be saved (a field still wrong), which keeps you here */
  save: () => boolean | void | Promise<boolean | void>
  /** drop the draft and go back to what is saved */
  discard?: () => void
}

export type LeaveAnswer = 'save' | 'discard' | 'stay'

const guards = new Map<number, Guard>()
let nextId = 1
let asker: ((done: (a: LeaveAnswer) => void) => void) | null = null
let pending: Promise<boolean> | null = null
const watchers = new Set<() => void>()
const changed = () => { for (const w of watchers) w() }

/** Holds a draft open; returns the release. */
export function holdDraft(g: Guard): () => void {
  const id = nextId++
  guards.set(id, g)
  changed()
  return () => { if (guards.delete(id)) changed() }
}

/** Called whenever a draft is held or let go. */
export function watchDrafts(fn: () => void): () => void {
  watchers.add(fn)
  return () => { watchers.delete(fn) }
}

export const hasUnsaved = () => guards.size > 0

/** The dialog's way in: <LeaveGuard> registers the function that asks and reports the answer. */
export function onAsk(fn: typeof asker): () => void {
  asker = fn
  return () => { if (asker === fn) asker = null }
}

/** Saves every held draft; false if any of them could not be. A draft that saved lets go of itself. */
export async function saveAll(): Promise<boolean> {
  let ok = true
  for (const g of [...guards.values()]) {
    try { if ((await g.save()) === false) ok = false } catch { ok = false }
  }
  return ok
}

export function discardAll(): void {
  const all = [...guards.values()]
  guards.clear()
  changed()
  for (const g of all) g.discard?.()
}

/** Ask before leaving. Resolves true when it is fine to go on. Two calls at once share one question. */
export function confirmLeave(): Promise<boolean> {
  if (!guards.size) return Promise.resolve(true)
  if (pending) return pending
  // no dialog mounted (a test, a page outside the root layout): nothing to ask with,
  // so the draft is kept and the way out stays open, as a closed tab would leave it
  if (!asker) return Promise.resolve(true)
  const ask = asker
  const p = new Promise<boolean>((resolve) => {
    ask(async (a) => {
      if (a === 'stay') { resolve(false); return }
      if (a === 'discard') { discardAll(); resolve(true); return }
      const ok = await saveAll()
      // whatever still holds a draft after saving could not be kept as it is
      if (ok) { guards.clear(); changed() }
      resolve(ok)
    })
  })
  pending = p
  // cleared once settled, not inside the answer: an answer given at once would clear
  // it before it was set, and the next question would get this one's answer
  void p.finally(() => { if (pending === p) pending = null })
  return p
}

/** Whether a click on a link inside the app takes you to another page (not a new tab, a
 *  download, another site or a jump within this page). */
export function leavesPage(href: string, here: string, opts: { target?: string | null; download?: boolean; modified?: boolean } = {}): boolean {
  if (opts.modified || opts.download || (opts.target && opts.target !== '_self')) return false
  let to: URL, from: URL
  try { from = new URL(here); to = new URL(href, from) } catch { return false }
  if (to.origin !== from.origin) return false
  if (to.protocol !== 'http:' && to.protocol !== 'https:') return false
  return to.pathname !== from.pathname || to.search !== from.search
}
