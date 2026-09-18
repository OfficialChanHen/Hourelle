// Calendar import pipeline. The rule: all math happens on UTC instants, the grid
// only ever sees minutes in the event's timezone. Providers (Google freebusy,
// Microsoft getSchedule) return busy blocks as UTC instants — never parse clock
// strings out of a calendar. The mock below returns the same shape.

import { normalizeIv, type Iv, type GridDay } from './events'
import { tzOffsetMin, zonedToUtc } from './tz'

export { tzOffsetMin, zonedToUtc }
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function localTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}
// minutes to add to an event-timezone clock time to read it in the viewer's local zone,
// measured at the given day/time instant (so DST is handled for that date)
export function localZoneShiftMin(eventTz: string, dayIso: string, clockMin: number): number {
  const utc = zonedToUtc(dayIso, clockMin, eventTz)
  return tzOffsetMin(localTimeZone(), utc) - tzOffsetMin(eventTz, utc)
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

/* The real provider. Google's free/busy answer is a list of busy instants for the
   primary calendar between two times — the same shape the mock returns, so the rest
   of the pipeline does not know the difference. The token is Google's own, handed
   over by Supabase after a sign-in that asked for the free/busy scope. */
export async function googleBusyUtc(token: string, days: GridDay[], gridStartMin: number, gridMax: number, eventTz: string): Promise<{ busy: UtcBusy[]; error?: 'auth' | 'scope' | string }> {
  const keys = days.map((d) => d.key).filter((k) => ISO_DAY.test(k)).sort()
  if (!keys.length) return { busy: [] }
  const timeMin = new Date(zonedToUtc(keys[0], gridStartMin, eventTz)).toISOString()
  const timeMax = new Date(zonedToUtc(keys[keys.length - 1], gridStartMin + gridMax, eventTz)).toISOString()
  let res: Response
  try {
    res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
    })
  } catch {
    return { busy: [], error: 'Could not reach Google Calendar.' }
  }
  if (res.status === 401) return { busy: [], error: 'auth' }
  if (res.status === 403) return { busy: [], error: 'scope' } // the token has no calendar permission, or the API is off
  if (!res.ok) return { busy: [], error: `Google Calendar answered ${res.status}.` }
  const data = (await res.json()) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } }
  const busy = (data.calendars?.primary?.busy ?? []).map((b) => ({ s: Date.parse(b.start), e: Date.parse(b.end) })).filter((b) => b.e > b.s)
  return { busy }
}

/* Microsoft's answer is the calendar itself, not a free/busy summary: every entry in
   the window, read as UTC, with how it shows (busy, tentative, out of office, free).
   Anything that is not free is a busy block. Paged, since a full calendar can be
   more than one screenful. The token is Microsoft's own, handed over by Supabase
   after a sign-in that asked for Calendars.Read. */
export async function outlookBusyUtc(token: string, days: GridDay[], gridStartMin: number, gridMax: number, eventTz: string): Promise<{ busy: UtcBusy[]; error?: 'auth' | 'scope' | string }> {
  const keys = days.map((d) => d.key).filter((k) => ISO_DAY.test(k)).sort()
  if (!keys.length) return { busy: [] }
  const timeMin = new Date(zonedToUtc(keys[0], gridStartMin, eventTz)).toISOString()
  const timeMax = new Date(zonedToUtc(keys[keys.length - 1], gridStartMin + gridMax, eventTz)).toISOString()
  type Entry = { start: { dateTime: string }; end: { dateTime: string }; showAs?: string }
  const busy: UtcBusy[] = []
  let url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(timeMin)}&endDateTime=${encodeURIComponent(timeMax)}&$select=start,end,showAs&$top=200`
  for (let page = 0; url && page < 20; page++) {
    let res: Response
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } })
    } catch {
      return { busy: [], error: 'Could not reach Outlook.' }
    }
    if (res.status === 401) return { busy: [], error: 'auth' }
    if (res.status === 403) return { busy: [], error: 'scope' } // the token has no calendar permission
    if (!res.ok) return { busy: [], error: `Outlook answered ${res.status}.` }
    const data = (await res.json()) as { value?: Entry[]; '@odata.nextLink'?: string }
    // Graph writes the instant without a zone marker; the Prefer header made it UTC
    const instant = (s: string) => Date.parse(`${s.replace(/\.\d+$/, '')}Z`)
    for (const e of data.value ?? []) {
      if (e.showAs === 'free' || e.showAs === 'workingElsewhere') continue
      const s = instant(e.start.dateTime), en = instant(e.end.dateTime)
      if (Number.isFinite(s) && Number.isFinite(en) && en > s) busy.push({ s, e: en })
    }
    url = data['@odata.nextLink'] ?? ''
  }
  return { busy }
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
