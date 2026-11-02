/* ── repeating plans: a club's weekly question, asked again on its own ──
   A host turns on "Repeat every week" on a locked plan. Once that week's plan is
   over, the host's app opens the next one the way Duplicate would (same people,
   place, window and cover, dates moved to the next week) and marks the old one with
   its successor, so it opens once. The new plan repeats too, until the host turns it off.

   Nobody is answered for. Each person's last answer is copied onto the new plan by
   weekday, and the grid offers it as one tap ("Use last week's times"): an answer
   counts toward "3 of 9 have answered", so it has to be theirs to give. */

import type { AppEvent, CreateInput, Iv, LastAnswer } from './events'
import { createEvent, draftFromEvent, getEvent, listEvents, patchEvent, phaseOf, selectedDayKeys } from './events'
import { freeIvOf, gridStartMinOf, normalizeIv, stepOf } from './availability'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const weekdayOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }

/** Each person's answers on `prev`, moved onto the matching weekdays of `next`.
 *  People are matched by id (accounts) or by email (a guest is new on every plan).
 *  Ranges keep their clock times and are cut to the new grid. Someone who said none
 *  of the days work, or answered nothing, gets no entry. */
export function carryAnswers(
  prev: Pick<AppEvent, 'participants' | 'days' | 'times' | 'granularity' | 'avail' | 'availIv' | 'needIv' | 'unavailableIds'>,
  next: Pick<AppEvent, 'participants' | 'days' | 'times' | 'granularity'>,
): Record<string, LastAnswer> {
  // a day poll and a timed grid ask different questions
  if ((prev.granularity === 'day') !== (next.granularity === 'day')) return {}
  const free = freeIvOf(prev), need = prev.needIv ?? {}
  const shift = gridStartMinOf(prev) - gridStartMinOf(next)
  const max = next.times.length * stepOf(next.granularity)
  // the latest day of the old plan on each weekday
  const source = new Map<number, string>()
  for (const d of [...prev.days].sort((a, b) => a.key.localeCompare(b.key))) if (ISO.test(d.key)) source.set(weekdayOf(d.key), d.key)
  const move = (byDay: Record<string, Record<string, Iv[]>>, pid: string) => {
    const out: Record<string, Iv[]> = {}
    for (const d of next.days) {
      if (!ISO.test(d.key)) continue
      const from = source.get(weekdayOf(d.key))
      const list = normalizeIv((from ? byDay[from]?.[pid] ?? [] : [])
        .map((iv) => ({ s: Math.max(0, iv.s + shift), e: Math.min(max, iv.e + shift) }))
        .filter((iv) => iv.e > iv.s))
      if (list.length) out[d.key] = list
    }
    return out
  }
  const out: Record<string, LastAnswer> = {}
  for (const p of next.participants) {
    const email = p.email?.toLowerCase()
    const was = prev.participants.find((q) => q.id === p.id) ?? (email ? prev.participants.find((q) => q.email?.toLowerCase() === email) : undefined)
    if (!was || prev.unavailableIds?.includes(was.id)) continue
    const f = move(free, was.id), n = move(need, was.id)
    if (!Object.keys(f).length && !Object.keys(n).length) continue
    out[p.id] = { free: f, ...(Object.keys(n).length ? { need: n } : {}) }
  }
  return out
}

/** Your repeating plans whose week is over and whose next week is not open yet. */
export function dueRepeats(events: AppEvent[]): AppEvent[] {
  return events.filter((e) => e.hostedByYou && !e.demo && !e.practice && !!e.repeat && !e.repeat.nextId
    && e.status === 'confirmed' && !!e.confirmed && phaseOf(e) === 'past')
}

/** Open next week's plan for a repeating one, once. Returns the new plan, or null
 *  when there is nothing to do. */
export function openNextWeek(id: string): AppEvent | null {
  const prev = getEvent(id)
  if (!prev?.repeat || prev.repeat.nextId) return null
  // the new week starts after every day of this one, never on the day it ended
  const last = [prev.endDate, prev.confirmed?.endDayKey ?? prev.confirmed?.dayKey ?? ''].sort().pop()!
  const d = draftFromEvent(id, { after: last })
  if (!d?.startDate || !d.endDate) return null
  const pickedDays = !d.fixed && d.excludedDows?.length ? selectedDayKeys(d.startDate, d.endDate, d.excludedDows, []) : undefined
  const made = createEvent({ ...(d as CreateInput), pickedDays })
  const lastAnswers = carryAnswers(prev, made)
  const patch: Partial<AppEvent> = { repeat: { every: 'week' }, repeatOf: prev.id, ...(Object.keys(lastAnswers).length ? { lastAnswers } : {}) }
  patchEvent(made.id, patch)
  patchEvent(prev.id, { repeat: { ...prev.repeat, nextId: made.id } })
  return { ...made, ...patch }
}

/** Open every repeating plan that is due. Safe to call as often as pages load. */
export function openDueRepeats(): AppEvent[] {
  return dueRepeats(listEvents()).map((e) => openNextWeek(e.id)).filter((e): e is AppEvent => !!e)
}
