import { daysUntil, listEvents, phaseOf, youReplied, type AppEvent } from './events'

/* ── notifications: derived, never stored ──
   Each notification has a stable key, so "seen" can persist across visits: the badge
   counts unseen keys, opening the page marks everything seen, and a key that changes
   (a re-lock, a fresh reopen) counts as new again. */

export type NotificationKind = 'event' | 'votes' | 'availability' | 'reopened' | 'plan-deadline' | 'rsvp-deadline' | 'rsvp-closed'
export type NotificationItem = { e: AppEvent; du: number; kind: NotificationKind; key: string }

// deadline reminders fire the day before and the day of; the band is part of the key,
// so each stage arrives unseen and lights the badge again
const band = (du: number) => (du <= 0 ? 'day' : du === 1 ? 'eve' : 'ahead')

export function deriveNotifications(events: AppEvent[]): NotificationItem[] {
  return events
    .flatMap((e): NotificationItem[] => {
      const phase = phaseOf(e)
      // a lock-in is news: the key carries confirmedAt, so re-locking after a reopen
      // reads as a fresh notification — and the day band makes the event surface again
      // the day before and the day of
      if (e.confirmed && ['today', 'soon', 'upcoming'].includes(phase)) {
        const du = daysUntil(e.confirmed.dayKey) ?? 0
        const out: NotificationItem[] = [{ e, du, kind: 'event', key: `${e.id}:event:${e.confirmedAt ?? e.confirmed.dayKey}:${band(du)}` }]
        if (e.rsvpDeadline) {
          const rdu = daysUntil(e.rsvpDeadline)
          if (rdu !== null && rdu >= 0 && rdu <= 1) out.push({ e, du: rdu, kind: 'rsvp-deadline', key: `${e.id}:rsvp:${e.rsvpDeadline}:${band(rdu)}` })
          // the soft close gets its moment: once the deadline passes, the host hears
          // how the round ended (answers stay open — this is a tally, not a lock)
          if (rdu !== null && rdu < 0 && e.hostedByYou) out.push({ e, du, kind: 'rsvp-closed', key: `${e.id}:rsvp-closed:${e.rsvpDeadline}` })
        }
        return out
      }
      if (phase === 'planning') {
        const out: NotificationItem[] = []
        if (e.reopenedAt) out.push({ e, du: daysUntil(e.startDate) ?? 0, kind: 'reopened', key: `${e.id}:reopened:${e.reopenedAt}` })
        if (e.planDeadline) {
          const pdu = daysUntil(e.planDeadline)
          if (pdu !== null && pdu >= 0 && pdu <= 1) out.push({ e, du: pdu, kind: 'plan-deadline', key: `${e.id}:plan:${e.planDeadline}:${band(pdu)}` })
        }
        if (e.voteDeadline) {
          const du = daysUntil(e.voteDeadline)
          if (du !== null && du >= 0) out.push({ e, du, kind: 'votes', key: `${e.id}:votes:${e.voteDeadline}` })
        }
        if (e.participants.some((p) => p.you) && !youReplied(e)) {
          out.push({ e, du: daysUntil(e.startDate) ?? 0, kind: 'availability', key: `${e.id}:availability` })
        }
        return out
      }
      return []
    })
    .sort((a, b) => a.du - b.du)
}

/* ── seen tracking ── */
const SEEN_KEY = 'aline.notifications.seen.v1'
export const NOTIFICATIONS_CHANGED = 'aline:notifications-changed'

export function seenNotificationKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

// opening the page marks everything current as seen. Storing only the current keys
// also prunes stale ones, so the set never grows past the live notification list.
export function markAllNotificationsSeen(): void {
  if (typeof window === 'undefined') return
  try {
    const keys = deriveNotifications(listEvents()).map((n) => n.key)
    localStorage.setItem(SEEN_KEY, JSON.stringify(keys))
  } catch { /* quota / private mode */ }
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
}

export function unseenNotificationCount(): number {
  if (typeof window === 'undefined') return 0
  const seen = seenNotificationKeys()
  return deriveNotifications(listEvents()).filter((n) => !seen.has(n.key)).length
}
