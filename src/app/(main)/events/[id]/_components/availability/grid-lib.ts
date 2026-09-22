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
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  // week by week; a sparse day list (weekends only, hand-picked dates) can stretch over
  // months, so weeks with no real day are dropped instead of becoming blank pager pages.
  // 52 weeks is the safety stop — a 90-day poll spread thin still fits inside a year.
  const weekStart = new Date(first)
  while (weekStart <= lastSunday && out.length < 52 * 7) {
    const week: GDay[] = []
    let hasReal = false
    const cur = new Date(weekStart)
    for (let i = 0; i < 7; i++) {
      const key = iso(cur)
      const real = byKey.get(key)
      if (real) hasReal = true
      week.push(real ?? { key, dow: DOW7[cur.getDay()], date: dayLabel(cur), pad: true })
      cur.setDate(cur.getDate() + 1)
    }
    if (hasReal) out.push(...week)
    weekStart.setDate(weekStart.getDate() + 7)
  }
  return out
}

/* ── how long the event needs — drives the best-window search (set in the Settings popover) ── */
export function fmtDur(m: number) { return m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h` }

/* ── the pile on a cell's bottom line ──
   Faces stack the way the participant strip stacks them, then a +N chip of the same
   size, and the whole run has to clear the n/total count in the other corner.

   A phone carries no faces at all. Seven columns divide a small screen into cells around
   37px wide, where a face is a smudge and a lone +N says nothing the count has not
   already said — so a small screen passes a cap of nought and the heat and the count
   carry the cell on their own. Both grids go through here, so both behave the same. */
export const PILE_AV = 20 // face diameter inside a cell
export const PILE_OVER = 4 // how far each tucks under the one before it — the participant strip's fifth
export const PILE_FONT = 9 // initials stay readable at this diameter
export function pileWidth(items: number) {
  return items <= 0 ? 0 : PILE_AV + (items - 1) * (PILE_AV - PILE_OVER)
}
/* what the count needs, sized for the widest it can get: tabular digits at 9.5px bold
   run about 5.4px, the slash about 3, and 6 more separates it from the pile. Measured
   rather than rounded up, because an over-estimate here costs a face on a phone. */
export function countWidth(total: number) {
  return String(total).length * 2 * 5.4 + 3 + 6
}
export function pileFit(n: number, cap: number, colW: number, total: number): { shown: number; chip: number } {
  if (cap <= 0) return { shown: 0, chip: 0 } // this screen does not carry faces at all
  const avail = colW - 8 - countWidth(total)
  let shown = Math.min(n, cap)
  while (shown > 0 && pileWidth(shown + (n > shown ? 1 : 0)) > avail) shown--
  // a lone +N says nothing a count does not already say, so below one face it all goes
  return shown > 0 ? { shown, chip: n - shown } : { shown: 0, chip: 0 }
}
