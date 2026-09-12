// The pure half of a merge: no database, no network, no framework — just the rules
// for folding one person's two selves into one. Kept apart from the route so it can
// be read, and tested, on its own.

import type { AppEvent, Iv, Participant } from '@/lib/events'

/** Sorted, merged, zero-length dropped — the same rule the client uses. */
export function normalize(list: Iv[]): Iv[] {
  const xs = list.filter((iv) => iv && iv.e > iv.s).sort((a, b) => a.s - b.s)
  const out: Iv[] = []
  for (const iv of xs) {
    const last = out[out.length - 1]
    if (last && iv.s <= last.e) last.e = Math.max(last.e, iv.e)
    else out.push({ s: iv.s, e: iv.e })
  }
  return out
}

/** One document with every mention of `from` rewritten to `into`, and the two seats
 *  folded into one. A reply beats no reply, so the surviving seat keeps whichever
 *  RSVP was actually given. */
export function foldDocument(ev: AppEvent, from: string, into: string): AppEvent {
  const swap = (id: string) => (id === from ? into : id)
  const dedupe = (ids: string[]) => Array.from(new Set(ids.map(swap)))
  const leaving = ev.participants.find((p) => p.id === from)
  const staying = ev.participants.find((p) => p.id === into)
  const participants: Participant[] = staying
    ? ev.participants
        .filter((p) => p.id !== from)
        .map((p) => (p.id === into && p.rsvp === 'pending' && leaving && leaving.rsvp !== 'pending'
          ? { ...p, rsvp: leaving.rsvp, rsvpAuto: leaving.rsvpAuto }
          : p))
    : ev.participants.map((p) => (p.id === from ? { ...p, id: into } : p))
  return {
    ...ev,
    participants,
    // `avail` is the legacy per-cell view; availIv / votes / unavailableIds only
    // survive in documents that predate migration 0008, and are folded if present
    avail: Object.fromEntries(Object.entries(ev.avail ?? {}).map(([day, rows]) => [day, rows.map(dedupe)])),
    availIv: ev.availIv
      ? Object.fromEntries(Object.entries(ev.availIv).map(([day, byPid]) => {
          const merged = normalize([...(byPid[into] ?? []), ...(byPid[from] ?? [])])
          const rest = Object.fromEntries(Object.entries(byPid).filter(([pid]) => pid !== from && pid !== into))
          return [day, merged.length ? { ...rest, [into]: merged } : rest]
        }))
      : ev.availIv,
    votes: ev.votes ? Object.fromEntries(Object.entries(ev.votes).map(([place, ids]) => [place, dedupe(ids)])) : ev.votes,
    unavailableIds: ev.unavailableIds ? dedupe(ev.unavailableIds) : ev.unavailableIds,
    location: { ...ev.location, places: ev.location.places.map((pl) => (pl.addedBy === from ? { ...pl, addedBy: into } : pl)) },
    messages: [],
  }
}

