import type { AppEvent, ChatMessage } from './events'

/* ── a removed person's lines stay gone, even if they come back ──
   Someone taken off an event takes their chat lines with them. If they are later
   invited again, or join again under the same name, their id is back on the roster,
   and "not on the roster" alone would let every old line reappear, for everyone and
   for them. So the test is the event's own record: an id the event has ever
   removed, and a line from before that person's current arrival (or any line, while
   they are still off the list). Pure, so the sync code and the chat both use it. */
export function removedLineTest(ev: Pick<AppEvent, 'removedIds' | 'participants'>): (m: ChatMessage) => boolean {
  const removed = new Set(ev.removedIds ?? [])
  if (!removed.size) return () => false
  const back = new Map(ev.participants.filter((p) => removed.has(p.id)).map((p) => [p.id, p.joinedAt ?? Infinity]))
  return (m) => removed.has(m.id) && (m.at ?? 0) < (back.get(m.id) ?? Infinity)
}
