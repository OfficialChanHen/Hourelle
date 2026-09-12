// The pure shape of an answer: minute intervals, the per-cell grid they project to,
// and the two ways of slicing a whole event's answers.
//
// This lives apart from lib/events so the sync layer can use it too. Availability
// now travels as one row per person (migration 0008), and remote.ts has to turn rows
// into the document shape the app reads — without importing events.ts, which imports
// remote.ts. Only types cross that line.

import type { AppEvent, AvailIntervals, GridDay, Iv } from './events'

export const ALL_DAY = 'All day'

export function stepOf(gran: string): number {
  return gran === 'day' ? 24 * 60 : gran === '15' ? 15 : gran === '60' ? 60 : 30
}

export function parseClockLabel(s: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(s.trim())
  if (!m) return null
  let h = Number(m[1])
  const mm = m[2] ? Number(m[2]) : 0
  const ap = m[3]?.toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h * 60 + mm
}

export function gridStartMinOf(ev: Pick<AppEvent, 'times'>): number {
  if (ev.times[0] === ALL_DAY) return 0
  return parseClockLabel(ev.times[0] ?? '') ?? 8 * 60
}

/** Sorted, merged, zero-length dropped. Every writer and every reader goes through
 *  this, so touching intervals is always safe and never leaves slivers behind. */
export function normalizeIv(list: Iv[]): Iv[] {
  const xs = list.filter((iv) => iv.e > iv.s).sort((a, b) => a.s - b.s)
  const out: Iv[] = []
  for (const iv of xs) {
    const last = out[out.length - 1]
    if (last && iv.s <= last.e) last.e = Math.max(last.e, iv.e)
    else out.push({ s: iv.s, e: iv.e })
  }
  return out
}

// legacy per-cell grid → per-participant intervals (each marked cell becomes a full slot)
export function gridToIntervals(avail: Record<string, string[][]>, days: Pick<GridDay, 'key'>[], step: number): AvailIntervals {
  const out: AvailIntervals = {}
  for (const d of days) {
    const byPid: Record<string, Iv[]> = {}
    ;(avail[d.key] ?? []).forEach((ids, ti) => {
      for (const id of ids) (byPid[id] ??= []).push({ s: ti * step, e: (ti + 1) * step })
    })
    out[d.key] = Object.fromEntries(Object.entries(byPid).map(([id, ivs]) => [id, normalizeIv(ivs)]))
  }
  return out
}

// intervals → per-cell view (any overlap counts); keeps lists/stats working off `avail`
export function intervalsToGrid(availIv: AvailIntervals, days: Pick<GridDay, 'key'>[], rows: number, step: number): Record<string, string[][]> {
  const out: Record<string, string[][]> = {}
  for (const d of days) {
    const byPid = availIv[d.key] ?? {}
    out[d.key] = Array.from({ length: rows }, (_, ti) => {
      const w0 = ti * step, w1 = (ti + 1) * step
      return Object.keys(byPid).filter((id) => byPid[id].some((iv) => iv.s < w1 && iv.e > w0))
    })
  }
  return out
}

export function availIvOf(ev: Pick<AppEvent, 'avail' | 'availIv' | 'days' | 'granularity'>): AvailIntervals {
  return ev.availIv ?? gridToIntervals(ev.avail, ev.days, stepOf(ev.granularity))
}

// same, but over every stored day — including dormant ones dropped from the current
// range — so writers never lose the replies a later window change should bring back
export function fullAvailIvOf(ev: Pick<AppEvent, 'avail' | 'availIv' | 'granularity'>): AvailIntervals {
  return ev.availIv ?? gridToIntervals(ev.avail, Object.keys(ev.avail).map((key) => ({ key })), stepOf(ev.granularity))
}

/* ── the two ways to slice a whole event's answers ──
   The document is indexed day-first because that is how the grid draws. A row is
   indexed person-first because that is who writes it. These two turn one into the
   other, and nothing else needs to know the difference. */

export type PersonAnswer = Record<string, Iv[]> // dayKey → intervals, for one person

export function byParticipant(iv: AvailIntervals): Map<string, PersonAnswer> {
  const out = new Map<string, PersonAnswer>()
  for (const [day, byPid] of Object.entries(iv)) {
    for (const [pid, ivs] of Object.entries(byPid)) {
      if (!ivs?.length) continue
      const person = out.get(pid) ?? {}
      person[day] = normalizeIv(ivs)
      out.set(pid, person)
    }
  }
  return out
}

export function byDay(people: Map<string, PersonAnswer>): AvailIntervals {
  const out: AvailIntervals = {}
  for (const [pid, answer] of people) {
    for (const [day, ivs] of Object.entries(answer)) {
      if (!ivs?.length) continue
      ;(out[day] ??= {})[pid] = normalizeIv(ivs)
    }
  }
  return out
}
