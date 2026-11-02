/* ── my usual week: calendar import without a calendar ──
   The times you are usually free, painted once on the profile page as seven
   weekdays of clock ranges. A plan fills from it only when you ask (the Import menu,
   the one-tap button, Fill my times): an answer counts toward "3 of 9 have
   answered", so nothing answers for you unseen.

   The week means a clock in one timezone, its own (`tz`), kept until you change it
   on purpose, so "after 6" stays after 6 across a clock change and on a laptop
   carried abroad. A fill follows the calendar import's rule: free time joins what
   you marked, nothing you marked is removed, and what a calendar striped as busy or
   a plan you are going to holds is left out. Time outside the week is not busy, so
   a fill draws no stripes.

   Beside the hours sit whole days: the weekdays you can usually give a whole day to.
   A plan that asks for days reads only those, so an hour free on a Tuesday never
   says you can do the Tuesday. */

import type { AppEvent, Iv } from './events'
import { gridStartMinOf, normalizeIv, stepOf } from './availability'
import { tzOffsetMin, zonedToUtc } from './tz'
import type { ImportOutcome, UtcBusy } from './calendar-import'

// seven weekdays, Sunday first (Date.getDay()): clock ranges for plans that ask for
// times, and whether the whole day is usually yours for plans that ask for days
export type UsualWeek = { tz: string; days: Iv[][]; wholeDays: boolean[] }

const DAY_MIN = 24 * 60
const DAY_MS = DAY_MIN * 60000
const ISO = /^\d{4}-\d{2}-\d{2}$/
export const emptyWeek = (tz: string): UsualWeek => ({ tz, days: [[], [], [], [], [], [], []], wholeDays: [false, false, false, false, false, false, false] })
export const hasHours = (w: UsualWeek | undefined): boolean => !!w?.days.some((d) => d.length > 0)
export const hasWholeDays = (w: UsualWeek | undefined): boolean => !!w?.wholeDays.some(Boolean)
export const weekHasTime = (w: UsualWeek | undefined): boolean => hasHours(w) || hasWholeDays(w)
/** Whether the week has anything for this kind of plan. */
export const weekFits = (w: UsualWeek | undefined, dayPoll: boolean): boolean => (dayPoll ? hasWholeDays(w) : hasHours(w))

/** What storage hands back, made safe: seven sorted, merged lists inside the day. */
export function cleanUsualWeek(raw: unknown): UsualWeek | undefined {
  const r = raw as { tz?: unknown; days?: unknown } | null
  if (!r || typeof r.tz !== 'string' || !Array.isArray(r.days) || r.days.length !== 7) return undefined
  const days = r.days.map((d) => normalizeIv((Array.isArray(d) ? d : [])
    .filter((iv): iv is Iv => typeof iv?.s === 'number' && typeof iv?.e === 'number')
    .map((iv) => ({ s: Math.max(0, Math.min(iv.s, iv.e)), e: Math.min(DAY_MIN, Math.max(iv.s, iv.e)) }))
    .filter((iv) => iv.e > iv.s)))
  const whole = (r as { wholeDays?: unknown }).wholeDays
  const wholeDays = Array.from({ length: 7 }, (_, i) => Array.isArray(whole) && whole[i] === true)
  return { tz: r.tz, days, wholeDays }
}

const isoOfUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const weekdayOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }

/** The week's free stretches as instants inside [s, e): every local date of the
 *  week's zone that touches the span, its weekday's ranges, merged across midnight. */
export function usualFreeUtc(week: UsualWeek, s: number, e: number): UtcBusy[] {
  if (!(e > s)) return []
  const out: UtcBusy[] = []
  // the local date at s, a day early so a range ending just after s is not missed
  let cur = isoOfUtc(s + tzOffsetMin(week.tz, s) * 60000 - DAY_MS)
  for (let guard = 0; guard < 4000; guard++) {
    const dayStart = zonedToUtc(cur, 0, week.tz)
    if (dayStart >= e) break
    for (const iv of week.days[weekdayOf(cur)] ?? []) {
      const a = Math.max(s, zonedToUtc(cur, iv.s, week.tz))
      const b = Math.min(e, zonedToUtc(cur, iv.e, week.tz))
      if (b > a) out.push({ s: a, e: b })
    }
    cur = isoOfUtc(Date.parse(`${cur}T00:00:00Z`) + DAY_MS)
  }
  out.sort((x, y) => x.s - y.s)
  const merged: UtcBusy[] = []
  for (const b of out) {
    const last = merged[merged.length - 1]
    if (last && b.s <= last.e) last.e = Math.max(last.e, b.e)
    else merged.push({ ...b })
  }
  return merged
}

function cut(list: Iv[], away: Iv[]): Iv[] {
  let out = list
  for (const a of away) out = out.flatMap((iv) => [{ s: iv.s, e: Math.min(iv.e, a.s) }, { s: Math.max(iv.s, a.e), e: iv.e }].filter((x) => x.e > x.s))
  return out
}

/** What filling one plan from the week does to your answer, worked out without
 *  touching anything, in the shape a calendar import reports. `blockedUtc` is time
 *  taken elsewhere (your locked-in plans); `need` is your if-need-be marks. */
export function planUsualWeek(
  ev: Pick<AppEvent, 'days' | 'times' | 'granularity' | 'timezone' | 'importedIv'>,
  meId: string, mine: Record<string, Iv[]>, week: UsualWeek, need: Record<string, Iv[]> = {}, blockedUtc: UtcBusy[] = [],
): ImportOutcome {
  const dayPoll = ev.granularity === 'day'
  const gridStart = gridStartMinOf(ev)
  const gridMax = ev.times.length * stepOf(ev.granularity)
  const times = { ...mine }
  let addedMin = 0, addedDays = 0, any = false
  for (const d of ev.days) {
    if (!ISO.test(d.key)) continue
    const s = zonedToUtc(d.key, gridStart, ev.timezone)
    const e = zonedToUtc(d.key, gridStart + gridMax, ev.timezone)
    const toGrid = (b: UtcBusy): Iv => ({ s: (Math.max(b.s, s) - s) / 60000, e: (Math.min(b.e, e) - s) / 60000 })
    const taken = [
      ...ev.importedIv?.[d.key]?.[meId] ?? [],
      ...blockedUtc.filter((b) => b.e > s && b.s < e).map(toGrid),
    ]
    const marked = [...(mine[d.key] ?? []), ...(need[d.key] ?? [])]
    if (dayPoll) {
      // the plan's own date, so its weekday is the one the plan means; a day a
      // calendar striped or a plan you are going to holds is not a whole free day
      if (!week.wholeDays[weekdayOf(d.key)]) continue
      any = true
      if (marked.length || taken.length) continue
      times[d.key] = [{ s: 0, e: gridMax }]
      addedDays++
      continue
    }
    let free = normalizeIv(usualFreeUtc(week, s, e).map(toGrid))
    if (free.length) any = true
    free = cut(free, taken)
    const add = cut(free, marked)
    if (!add.length) continue
    addedMin += add.reduce((m, iv) => m + iv.e - iv.s, 0)
    times[d.key] = normalizeIv([...(times[d.key] ?? []), ...add])
  }
  return {
    times, importedIv: ev.importedIv ?? {}, addedMin, addedDays, busyDays: 0, none: !any, allBusy: false,
    timesChanged: dayPoll ? addedDays > 0 : addedMin > 0, stripesChanged: false,
  }
}

/** The same week read in another zone: every range moved by the gap between the two
 *  zones at `at` (now, by default), carried across midnight into the next or the
 *  previous weekday. For someone who has moved, not for a trip. */
export function moveWeekToZone(week: UsualWeek, tz: string, at = Date.now()): UsualWeek {
  const shift = tzOffsetMin(tz, at) - tzOffsetMin(week.tz, at)
  const days: Iv[][] = [[], [], [], [], [], [], []]
  const WEEK = 7 * DAY_MIN
  week.days.forEach((list, wd) => {
    for (const iv of list) {
      // on one line of week minutes, wrapped, then cut back into days
      let s = ((wd * DAY_MIN + iv.s + shift) % WEEK + WEEK) % WEEK
      let left = iv.e - iv.s
      while (left > 0) {
        const d = Math.floor(s / DAY_MIN), off = s - d * DAY_MIN
        const take = Math.min(left, DAY_MIN - off)
        days[d].push({ s: off, e: off + take })
        left -= take
        s = (s + take) % WEEK
      }
    }
  })
  return { tz, days: days.map(normalizeIv), wholeDays: week.wholeDays }
}
