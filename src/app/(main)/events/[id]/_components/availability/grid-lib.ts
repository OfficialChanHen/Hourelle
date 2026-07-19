// pure grid math and shared bits for the availability panel — no react in here
import { dayLabel, type GridDay, type Iv } from '@/lib/events'
import { ISO_DAY } from '@/lib/calendar-import'

export type Band = { s: number; e: number; ids: string[] } // constant-crowd segment inside one cell

export function heat(n: number, total: number) {
  if (n === 0) return 'var(--s2)'
  const r = n / Math.max(total, 1)
  return r <= 0.25 ? 'var(--heat-low)' : r <= 0.5 ? 'var(--heat-mid)' : r < 1 ? 'var(--heat-high)' : 'var(--heat-full)'
}
export function clayFor(n: number) {
  return n <= 2 ? 'var(--you-only)' : n <= 4 ? 'var(--you-some)' : 'var(--you-many)'
}
export function subtract(iv: Iv, a: number, b: number): Iv[] {
  return [{ s: iv.s, e: Math.min(iv.e, a) }, { s: Math.max(iv.s, b), e: iv.e }].filter((x) => x.e > x.s)
}
// split a cell window at every point the crowd changes
export function cellBands(byPid: Record<string, Iv[]>, w0: number, w1: number): Band[] {
  const cuts = new Set([w0, w1])
  for (const ivs of Object.values(byPid)) for (const iv of ivs) {
    if (iv.s > w0 && iv.s < w1) cuts.add(iv.s)
    if (iv.e > w0 && iv.e < w1) cuts.add(iv.e)
  }
  const xs = [...cuts].sort((a, b) => a - b)
  const out: Band[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    const s = xs[i], e = xs[i + 1]
    out.push({ s, e, ids: Object.keys(byPid).filter((id) => byPid[id].some((iv) => iv.s <= s && iv.e >= e)) })
  }
  return out
}
// absorb slivers too thin to read into their taller neighbor (paint only — tooltips stay exact).
// `keep` boundaries are never merged across, so the heat edge stays put where a frame is drawn.
export function mergeSlivers(bands: Band[], minDur: number, keep?: number[]): Band[] {
  const locked = new Set(keep ?? [])
  const out = bands.map((b) => ({ ...b }))
  let again = true
  while (again && out.length > 1) {
    again = false
    for (let i = 0; i < out.length; i++) {
      if (out[i].e - out[i].s >= minDur) continue
      const prev = locked.has(out[i].s) ? undefined : out[i - 1]
      const next = locked.has(out[i].e) ? undefined : out[i + 1]
      const into = !prev ? next : !next ? prev : (prev.e - prev.s >= next.e - next.s ? prev : next)
      if (into) { into.s = Math.min(into.s, out[i].s); into.e = Math.max(into.e, out[i].e); out.splice(i, 1); again = true; break }
    }
  }
  return out
}
export function peakOf(bands: Band[]): Band {
  return bands.reduce((m, b) => (b.ids.length > m.ids.length ? b : m))
}

// a grid day, possibly a filler outside the event's date window (rendered greyed out, inert)
export type GDay = GridDay & { pad?: boolean }
export const DOW7 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// events spanning more than one calendar week pad out to full Sun–Sat weeks, so
// weekday columns line up across pages and the grid width never shifts between
// them. Events that fit inside one calendar week stay compact — no dead columns.
export function padToWeeks(days: GridDay[]): GDay[] {
  if (days.length < 2 || !ISO_DAY.test(days[0].key) || !ISO_DAY.test(days[days.length - 1].key)) return days
  const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
  const sundayOf = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x }
  const first = sundayOf(parse(days[0].key))
  const lastSunday = sundayOf(parse(days[days.length - 1].key))
  if (first.getTime() === lastSunday.getTime()) return days // fits one calendar week — compact
  const byKey = new Map<string, GridDay>(days.map((d) => [d.key, d]))
  const out: GDay[] = []
  const cur = new Date(first)
  const end = new Date(lastSunday); end.setDate(end.getDate() + 6)
  while (cur <= end && out.length < 6 * 7) { // events cap at 21 days, so ≤5 weeks in practice
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    out.push(byKey.get(key) ?? { key, dow: DOW7[cur.getDay()], date: dayLabel(cur), pad: true })
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/* ── how long the event needs — drives the best-window search (set in the Settings popover) ── */
export function fmtDur(m: number) { return m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h` }

