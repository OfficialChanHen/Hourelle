/* ── repeating plans: a group's regular time, kept ──
   When a host locks a plan in they can say it repeats: every week, every 2 weeks or
   every month (on the same weekday of the month, "the 1st Tue"). Once that plan is
   over, the host's app opens the next one the way Duplicate would (same people, place
   and cover) but already locked at the same clock time, so the group only answers
   whether they are going. It marks the old plan with its successor, so it opens once,
   and the new plan repeats the same way until the host stops it.

   Everyone starts at no reply: last time's going is not this time's. */

import type { AppEvent, ConfirmedSlot, CreateInput, Repeat } from './events'
import { createEvent, draftFromEvent, getEvent, listEvents, patchEvent, phaseOf, todayKey } from './events'

export type Cadence = Repeat['every']
export const CADENCES: Cadence[] = ['week', '2weeks', 'month']

const DAY_MS = 86400000
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const plus = (key: string, days: number) => iso(ms(key) + days * DAY_MS)
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// which of its weekday in the month a date is, 1 to 4, or 5 for the last one
// past the 4th (a 5th Friday becomes "the last Friday" in months that have four)
const nthOf = (key: string) => Math.ceil(Number(key.slice(8, 10)) / 7)

// the nth weekday of a month, the last one when n is 5
function nthWeekday(y: number, m: number, dow: number, n: number): string {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay()
  let d = 1 + ((dow - first + 7) % 7) + (n - 1) * 7
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  while (d > days) d -= 7
  return iso(Date.UTC(y, m, d))
}

/** How a cadence reads, for the plan locked on `dayKey`. */
export function repeatLabel(every: Cadence, dayKey: string): string {
  if (every === 'week') return 'Every week'
  if (every === '2weeks') return 'Every 2 weeks'
  const n = nthOf(dayKey)
  return `Every month on the ${['1st', '2nd', '3rd', '4th', 'last'][n - 1]} ${DOW[new Date(ms(dayKey)).getUTCDay()]}`
}

/** The locked slot moved on by the cadence to the first one starting on or after
 *  `today`, in the shape the create wizard's set date takes. */
export function nextSlot(c: ConfirmedSlot, every: Cadence, today: string): NonNullable<CreateInput['fixed']> {
  const step = (key: string, k: number): string => {
    if (every !== 'month') return plus(key, k * (every === 'week' ? 7 : 14))
    const d = new Date(ms(c.dayKey))
    return nthWeekday(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDay(), nthOf(c.dayKey))
  }
  let k = 1
  let day = step(c.dayKey, k)
  while (day < today && k < 1000) day = step(c.dayKey, ++k)
  const run = c.endDayKey ? Math.round((ms(c.endDayKey) - ms(c.dayKey)) / DAY_MS) : 0
  return { day, ...(run > 0 ? { endDay: plus(day, run) } : {}), start: hm(c.startMin), end: hm(c.endMin), allDay: c.startMin === 0 && c.endMin === 24 * 60 }
}

/** Your repeating plans that are over and whose next one is not open yet. */
export function dueRepeats(events: AppEvent[]): AppEvent[] {
  return events.filter((e) => e.hostedByYou && !e.demo && !e.practice && !!e.repeat && !e.repeat.nextId
    && e.status === 'confirmed' && !!e.confirmed && phaseOf(e) === 'past')
}

/** Open the next plan of a repeating one, once. Returns the new plan, or null
 *  when there is nothing to do. */
export function openNext(id: string): AppEvent | null {
  const prev = getEvent(id)
  if (!prev?.repeat || prev.repeat.nextId || !prev.confirmed) return null
  const d = draftFromEvent(id)
  if (!d) return null
  const made = createEvent({ ...(d as CreateInput), fixed: nextSlot(prev.confirmed, prev.repeat.every, todayKey()) })
  const patch: Partial<AppEvent> = { repeat: { every: prev.repeat.every }, repeatOf: prev.id }
  patchEvent(made.id, patch)
  patchEvent(prev.id, { repeat: { ...prev.repeat, nextId: made.id } })
  return { ...made, ...patch }
}

/** Open every repeating plan that is due. Safe to call as often as pages load. */
export function openDueRepeats(): AppEvent[] {
  return dueRepeats(listEvents()).map((e) => openNext(e.id)).filter((e): e is AppEvent => !!e)
}
