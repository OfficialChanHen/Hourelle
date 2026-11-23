// The list of who is on a plan, merged at save time.
//
// The roster lives inside the event document, and a save sends the document whole.
// A device whose copy is behind (it missed someone joining while it slept) used to
// write its older list back and take the newcomer off the plan, answers and all:
// their times stayed on the grid, but nothing counted them. So a save no longer
// sends its list as the truth. It sends what it changed: the people it added,
// edited or took off, laid over the list the database holds right now. Everyone
// this save did not touch stays as the database has them.

import type { AppEvent, Participant } from './events'

// key order is not meaning: two copies of one entry built in different orders match
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

/** Apply one save's change to the roster (`before` → `after`, both this device's
 *  copy) on top of the roster the database holds now (`server`). Someone this save
 *  took off goes; someone it added or edited is its version; everyone else is the
 *  server's, including people this device has not heard of yet. */
export function mergeRoster(server: Participant[], before: Participant[], after: Participant[]): Participant[] {
  const was = new Map(before.map((p) => [p.id, p]))
  const now = new Map(after.map((p) => [p.id, p]))
  const touched = (p: Participant) => { const b = was.get(p.id); return !b || stable(b) !== stable(p) }
  const onServer = new Set(server.map((p) => p.id))
  const out: Participant[] = []
  for (const s of server) {
    const mine = now.get(s.id)
    if (!mine) { if (!was.has(s.id)) out.push(s); continue } // taken off by this save, or never known here
    out.push(touched(mine) ? mine : s)
  }
  // new to the server: only what this save brought. An untouched entry the server
  // lacks was taken off (or folded into an account) by someone else; it stays off.
  for (const p of after) if (!onServer.has(p.id) && touched(p)) out.push(p)
  return out
}

/** The same people with the same details, in the same order. */
export function sameRoster(a: Participant[], b: Participant[]): boolean {
  return a.length === b.length && a.every((p, i) => stable(p) === stable(b[i]))
}

/** Removals only ever add up: a stale save never takes an id back out of the list. */
export function mergeRemovedIds(server: string[] | undefined, after: string[] | undefined): string[] | undefined {
  if (!server?.length) return after
  if (!after?.length) return server
  return [...new Set([...server, ...after])]
}

/** The roster half of a save, ready to write over the server's. */
export function mergeSave(
  server: Pick<AppEvent, 'participants' | 'removedIds'>,
  before: Pick<AppEvent, 'participants'>,
  after: AppEvent,
): AppEvent {
  // a server copy with no list to merge into would keep only what this save touched
  if (!Array.isArray(server.participants)) return after
  return {
    ...after,
    participants: mergeRoster(server.participants, before.participants, after.participants),
    removedIds: mergeRemovedIds(server.removedIds, after.removedIds),
  }
}
