/* ── repeating plans: a group's regular plan, asked again on its own ──
   When a host locks a plan in they can say it repeats: every week, every 2 weeks or
   every month (on the same weekday of the month, "the 1st Tue"). Once it is over, a
   copy opens for the next dates: the same people, place, window and cover, back on
   the availability grid with nobody's answers in it, and still repeating. The
   original stays as it was, a past plan with its own answers.

   The copy is made without the host: by the server (a daily cron, and sooner when
   anyone on the plan opens the app and asks it to; lib/server/repeats.ts), or by this
   browser when there is no backend. Either way it is built here, by nextPlanDoc,
   and the old plan records the copy's id so it is made once. */

import type { AppEvent, ConfirmedSlot, Participant, Repeat } from './events'
import { bornShape, buildDaysFrom, getEvent, insertEvent, listEvents, newEventId, patchEvent, phaseOf, todayKey } from './events'

export type Cadence = Repeat['every']
export const CADENCES: Cadence[] = ['week', '2weeks', 'month']

const DAY_MS = 86400000
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const plus = (key: string, days: number) => iso(ms(key) + days * DAY_MS)

// which of its weekday in the month a date is, 1 to 4, or 5 for a 5th one, which
// reads as "the last" (it always is, and months with four take their 4th)
const nthOf = (key: string) => Math.ceil(Number(key.slice(8, 10)) / 7)

// the nth weekday of a month, the last one when n is 5
function nthWeekday(y: number, m: number, dow: number, n: number): string {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay()
  let d = 1 + ((dow - first + 7) % 7) + (n - 1) * 7
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  while (d > days) d -= 7
  return iso(Date.UTC(y, m, d))
}

/** How a cadence reads, for the plan anchored on `dayKey`. */
export function repeatLabel(every: Cadence, dayKey: string): string {
  if (every === 'week') return 'Every week'
  if (every === '2weeks') return 'Every 2 weeks'
  return `Every month on the ${['1st', '2nd', '3rd', '4th', 'last'][nthOf(dayKey) - 1]} ${DOW[new Date(ms(dayKey)).getUTCDay()]}`
}

/** `dayKey` moved on by the cadence, at least once, to the first date on or after
 *  `today`. A step is always a whole number of weeks, so the weekday holds. */
export function nextOccurrence(dayKey: string, every: Cadence, today: string): string {
  const d = new Date(ms(dayKey))
  const step = (k: number) => every === 'month'
    ? nthWeekday(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDay(), nthOf(dayKey))
    : plus(dayKey, k * (every === 'week' ? 7 : 14))
  let k = 1
  let day = step(k)
  while (day < today && k < 1000) day = step(++k)
  return day
}

/** A repeating plan that is over and has no copy yet. Anyone on it may ask for the
 *  copy; making it is the server's job (or this browser's, with no backend). */
export function isDue(e: AppEvent): boolean {
  return !e.demo && !e.practice && !!e.repeat && !e.repeat.nextId && e.status === 'confirmed' && !!e.confirmed && phaseOf(e) === 'past'
}

/** The next plan in the series, built from the one that just ended: its dates moved
 *  on by the cadence, everything anyone answered left behind. Pure, so the server and
 *  the browser build the same copy. */
export function nextPlanDoc(prev: AppEvent, id: string, today: string, now: number): AppEvent {
  const every = prev.repeat?.every ?? 'week'
  const c = prev.confirmed
  // the plan's first day carries the cadence; everything else keeps its distance from it
  const start = nextOccurrence(prev.startDate, every, today)
  const delta = Math.round((ms(start) - ms(prev.startDate)) / DAY_MS)
  const move = (k: string) => plus(k, delta)
  const days = buildDaysFrom(prev.days.map((d) => move(d.key)), prev.days.length)
  // born with its date set, it comes back set; a poll comes back as a poll
  const set = !!c && bornShape(prev) !== null
  // a place that was locked in is the place now; an open ballot starts again empty
  const isItin = prev.location.planMode === 'itinerary'
  const byId = new Map(prev.location.places.map((p) => [p.id, p]))
  const locked = (c?.placeIds ?? []).map((pid) => byId.get(pid)).filter((p) => !!p)
  const venue = !isItin && locked.length === 1 && prev.location.mode !== 'remote'
  // the people who can be reached again: accounts, and guests who left an address.
  // A guest who joined by the link alone is this device's, on that plan only.
  const participants = prev.participants
    .filter((p) => !p.guest || !!p.email)
    .map((p): Participant => {
      const q: Participant = { ...p, rsvp: p.host ? 'attending' : 'pending' }
      delete q.rsvpAuto
      return q
    })
  const next: AppEvent = {
    ...prev,
    id,
    startDate: move(prev.startDate),
    endDate: move(prev.endDate),
    days,
    avail: Object.fromEntries(days.map((d) => [d.key, prev.times.map(() => [] as string[])])),
    availIv: Object.fromEntries(days.map((d) => [d.key, {}])),
    needIv: undefined,
    importedIv: undefined,
    unavailableIds: [],
    votes: {},
    location: venue ? { ...prev.location, mode: 'set', places: locked } : prev.location,
    itinStops: isItin && c?.placeIds.length ? c.placeIds : prev.itinStops,
    participants,
    removedIds: undefined,
    expenses: undefined,
    messages: [],
    createdAt: now,
    reopenedAt: undefined,
    planDeadline: prev.planDeadline ? move(prev.planDeadline) : undefined,
    voteDeadline: prev.voteDeadline ? move(prev.voteDeadline) : undefined,
    rsvpDeadline: set && prev.rsvpDeadline ? move(prev.rsvpDeadline) : undefined,
    status: set ? 'confirmed' : 'planning',
    confirmed: set && c ? movedSlot(c, move) : undefined,
    confirmedAt: set ? now : undefined,
    repeat: { every },
    repeatOf: prev.id,
  }
  // a document says nothing it does not mean: drop the keys left undefined
  return JSON.parse(JSON.stringify(next)) as AppEvent
}

const movedSlot = (c: ConfirmedSlot, move: (k: string) => string): ConfirmedSlot => ({
  ...c, dayKey: move(c.dayKey), ...(c.endDayKey ? { endDayKey: move(c.endDayKey) } : {}),
})

/** With no backend: open the copy of every due plan in this browser. */
export function openDueRepeatsHere(): AppEvent[] {
  const made: AppEvent[] = []
  for (const prev of listEvents().filter(isDue)) {
    const fresh = getEvent(prev.id)
    if (!fresh?.repeat || fresh.repeat.nextId) continue
    const next = nextPlanDoc(fresh, newEventId(fresh.title), todayKey(), Date.now())
    insertEvent(next)
    patchEvent(fresh.id, { repeat: { ...fresh.repeat, nextId: next.id } })
    made.push(next)
  }
  return made
}
