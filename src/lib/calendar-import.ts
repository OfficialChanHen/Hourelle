// Calendar import pipeline. The rule: all math happens on UTC instants, the grid
// only ever sees minutes in the event's timezone. Providers (Google freebusy,
// Microsoft getSchedule) return busy blocks as UTC instants — never parse clock
// strings out of a calendar. The mock below returns the same shape.

import { normalizeIv, type Iv, type GridDay } from './events'

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

// minutes a zone is ahead of UTC at a given instant (IANA, DST-correct)
function tzOffsetMin(tz: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'))
  return (asUtc - utcMs) / 60000
}

// "clockMin minutes into dayIso, in tz" → UTC epoch ms (two-pass to settle DST edges)
export function zonedToUtc(dayIso: string, clockMin: number, tz: string): number {
  const [y, m, d] = dayIso.split('-').map(Number)
  const naive = Date.UTC(y, m - 1, d, 0, clockMin)
  const utc = naive - tzOffsetMin(tz, naive) * 60000
  return naive - tzOffsetMin(tz, utc) * 60000
}

export type UtcBusy = { s: number; e: number } // epoch ms
export type DayImport = { busy: Iv[]; free: Iv[] } // grid minutes, clipped to the day's window

/* Simulated provider: a calendar that lives in America/New_York. Blocks are
   authored as ET clock times, then converted to the UTC instants a real
   freebusy response would contain — so the event-timezone math below is
   exercised exactly as it will be with live OAuth. */
const MOCK_CAL_TZ = 'America/New_York'
export function mockBusyUtc(days: GridDay[]): UtcBusy[] {
  const out: UtcBusy[] = []
  for (const d of days) {
    if (!ISO_DAY.test(d.key)) continue
    const [y, m, dd] = d.key.split('-').map(Number)
    const dow = new Date(y, m - 1, dd).getDay()
    if (dow === 0 || dow === 6) continue // weekends free
    const block = (sMin: number, eMin: number) =>
      out.push({ s: zonedToUtc(d.key, sMin, MOCK_CAL_TZ), e: zonedToUtc(d.key, eMin, MOCK_CAL_TZ) })
    block(9 * 60 + 30, 10 * 60) // standup 9:30–10:00 ET
    block(12 * 60, 13 * 60)     // lunch 12:00–1:00 ET
    if (dow === 3) block(15 * 60, 16 * 60 + 30) // Wed review 3:00–4:30 ET
    if (dow === 5) block(13 * 60, 17 * 60)      // Fri focus block 1:00–5:00 ET
  }
  return out
}

function subtract(iv: Iv, a: number, b: number): Iv[] {
  return [{ s: iv.s, e: Math.min(iv.e, a) }, { s: Math.max(iv.s, b), e: iv.e }].filter((x) => x.e > x.s)
}

// UTC busy instants → per-day grid view in the event timezone.
// gridStartMin = clock minutes at grid row 0; gridMax = grid length in minutes.
export function buildImportPreview(
  busyUtc: UtcBusy[], days: GridDay[], gridStartMin: number, gridMax: number, eventTz: string,
): Record<string, DayImport> {
  const out: Record<string, DayImport> = {}
  for (const d of days) {
    if (!ISO_DAY.test(d.key)) continue
    const dayStart = zonedToUtc(d.key, gridStartMin, eventTz)
    const dayEnd = zonedToUtc(d.key, gridStartMin + gridMax, eventTz)
    const busy = normalizeIv(
      busyUtc
        .map((b) => ({ s: Math.max(b.s, dayStart), e: Math.min(b.e, dayEnd) })) // clip to this grid day
        .filter((b) => b.e > b.s)
        .map((b) => ({ s: (b.s - dayStart) / 60000, e: (b.e - dayStart) / 60000 })), // instants → grid minutes
    )
    let free: Iv[] = [{ s: 0, e: gridMax }]
    for (const b of busy) free = free.flatMap((iv) => subtract(iv, b.s, b.e))
    out[d.key] = { busy, free: normalizeIv(free) }
  }
  return out
}
