// Calendar import pipeline. The rule: all math happens on UTC instants, the grid
// only ever sees minutes in the event's timezone. Providers (Google freebusy,
// Microsoft getSchedule) return busy blocks as UTC instants — never parse clock
// strings out of a calendar. The mock below returns the same shape.

import { normalizeIv, type AppEvent, type AvailIntervals, type Iv, type GridDay } from './events'
import { gridStartMinOf, stepOf } from './availability'
import { tzOffsetMin, zonedToUtc } from './tz'

export { tzOffsetMin, zonedToUtc }
export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

// Real calendar import depends on switches outside the code (the Google Calendar API
// and its scope, the Azure provider, Manual linking in Supabase). With a backend it
// stays "Coming soon" until NEXT_PUBLIC_CALENDAR_IMPORT_ON=1 says they are flipped;
// without one the sample calendar stands in and it always works.
export const importSoon = (backendOn: boolean) => backendOn && process.env.NEXT_PUBLIC_CALENDAR_IMPORT_ON !== '1'

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
export type BusyAnswer = { busy: UtcBusy[]; error?: 'auth' | 'scope' | string }

// the instants a plan's grid covers, first row of its first day to the last row of its last
export function gridSpanUtc(days: GridDay[], gridStartMin: number, gridMax: number, eventTz: string): { s: number; e: number } | null {
  const keys = days.map((d) => d.key).filter((k) => ISO_DAY.test(k)).sort()
  if (!keys.length) return null
  return { s: zonedToUtc(keys[0], gridStartMin, eventTz), e: zonedToUtc(keys[keys.length - 1], gridStartMin + gridMax, eventTz) }
}

// Google turns away a free/busy question over too long a span, so a long one goes
// as several shorter ones, asked one after another and joined
const CHUNK_MS = 56 * 24 * 60 * 60 * 1000
async function chunked(s: number, e: number, ask: (s: number, e: number) => Promise<BusyAnswer>): Promise<BusyAnswer> {
  const busy: UtcBusy[] = []
  for (let at = s; at < e; at += CHUNK_MS) {
    const r = await ask(at, Math.min(e, at + CHUNK_MS))
    if (r.error) return { busy: [], error: r.error }
    busy.push(...r.busy)
  }
  return { busy }
}

export async function googleBusyRange(token: string, s: number, e: number): Promise<BusyAnswer> {
  return chunked(s, e, async (from, to) => {
    let res: Response
    try {
      res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), items: [{ id: 'primary' }] }),
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
  })
}

export async function googleBusyUtc(token: string, days: GridDay[], gridStartMin: number, gridMax: number, eventTz: string): Promise<BusyAnswer> {
  const span = gridSpanUtc(days, gridStartMin, gridMax, eventTz)
  return span ? googleBusyRange(token, span.s, span.e) : { busy: [] }
}

/* Microsoft's answer is the calendar itself, not a free/busy summary: every entry in
   the window, read as UTC, with how it shows (busy, tentative, out of office, free).
   Anything that is not free is a busy block. Paged, since a full calendar can be
   more than one screenful. The token is Microsoft's own, handed over by Supabase
   after a sign-in that asked for Calendars.Read. */
export async function outlookBusyRange(token: string, s: number, e: number): Promise<BusyAnswer> {
  return chunked(s, e, async (from, to) => {
    type Entry = { start: { dateTime: string }; end: { dateTime: string }; showAs?: string }
    const busy: UtcBusy[] = []
    let url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(new Date(from).toISOString())}&endDateTime=${encodeURIComponent(new Date(to).toISOString())}&$select=start,end,showAs&$top=200`
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
      const instant = (x: string) => Date.parse(`${x.replace(/\.\d+$/, '')}Z`)
      for (const en of data.value ?? []) {
        if (en.showAs === 'free' || en.showAs === 'workingElsewhere') continue
        const bs = instant(en.start.dateTime), be = instant(en.end.dateTime)
        if (Number.isFinite(bs) && Number.isFinite(be) && be > bs) busy.push({ s: bs, e: be })
      }
      url = data['@odata.nextLink'] ?? ''
    }
    return { busy }
  })
}

export async function outlookBusyUtc(token: string, days: GridDay[], gridStartMin: number, gridMax: number, eventTz: string): Promise<BusyAnswer> {
  const span = gridSpanUtc(days, gridStartMin, gridMax, eventTz)
  return span ? outlookBusyRange(token, span.s, span.e) : { busy: [] }
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

/* ── what one import does to one person's answer on one plan ──
   Worked out without touching anything, so the plan's own Import button and the
   Plans page's fill-them-all both apply exactly the same rule:
   - a timed poll: the calendar's free times join whatever is already marked, never
     removing a mark; `addedMin` counts only minutes that are genuinely new
   - a day poll: a day with nothing on the calendar is marked as one you can make, a
     day with something on it is left for you to decide
   - either way the busy stretches are striped (`importedIv`), and the stripes only
     ever grow, so what a calendar said stays visible under whatever is painted later */
export type ImportOutcome = {
  times: Record<string, Iv[]>  // your answer, per day, after the import
  importedIv: AvailIntervals   // the striped busy marker, everyone's, after the import
  addedMin: number             // new free minutes (timed polls)
  addedDays: number            // newly marked days (day polls)
  busyDays: number             // days the calendar has anything on
  none: boolean                // nothing on the calendar at all in the plan's window
  allBusy: boolean             // every hour (or every day) has something on it
  timesChanged: boolean
  stripesChanged: boolean
}

export function planImport(ev: Pick<AppEvent, 'days' | 'times' | 'granularity' | 'timezone' | 'importedIv'>, meId: string, mine: Record<string, Iv[]>, busyUtc: UtcBusy[]): ImportOutcome {
  const dayPoll = ev.granularity === 'day'
  const gridMax = ev.times.length * stepOf(ev.granularity)
  const data = buildImportPreview(busyUtc, ev.days, gridStartMinOf(ev), gridMax, ev.timezone)
  const busyDays = Object.entries(data).filter(([, di]) => di.busy.length > 0)
  const none = busyDays.length === 0
  const allBusy = !none && Object.values(data).every((di) => (dayPoll ? di.busy.length > 0 : di.free.length === 0))
  const wasImported = ev.importedIv ?? {}
  const importedIv: AvailIntervals = { ...wasImported }
  for (const [day, di] of busyDays) importedIv[day] = { ...(importedIv[day] ?? {}), [meId]: normalizeIv([...(importedIv[day]?.[meId] ?? []), ...(dayPoll ? [{ s: 0, e: gridMax }] : di.busy)]) }
  const stripesChanged = JSON.stringify(importedIv) !== JSON.stringify(wasImported)
  const times = { ...mine }
  let addedMin = 0, addedDays = 0
  if (dayPoll) {
    for (const [day, di] of Object.entries(data)) {
      if (di.busy.length || mine[day]?.length) continue
      times[day] = [{ s: 0, e: gridMax }]
      addedDays++
    }
  } else {
    for (const [day, di] of Object.entries(data)) {
      let add = di.free
      for (const iv of mine[day] ?? []) add = add.flatMap((a) => subtract(a, iv.s, iv.e))
      addedMin += add.reduce((m, iv) => m + (iv.e - iv.s), 0)
      times[day] = normalizeIv([...(times[day] ?? []), ...di.free])
    }
  }
  return { times, importedIv, addedMin, addedDays, busyDays: busyDays.length, none, allBusy, timesChanged: dayPoll ? addedDays > 0 : addedMin > 0, stripesChanged }
}

/* Your own locked-in plans are busy time too, even ones never added to a calendar:
   Hourelle knows about them, so two plans cannot both claim your Friday evening. Only
   plans you said you are going to; a plan you have not replied to yet holds nothing. */
export function lockedPlanBusyUtc(events: AppEvent[], exceptId?: string): UtcBusy[] {
  const out: UtcBusy[] = []
  for (const ev of events) {
    const c = ev.confirmed
    if (ev.id === exceptId || ev.demo || !c || !ISO_DAY.test(c.dayKey)) continue
    if (ev.participants.find((p) => p.you)?.rsvp !== 'attending') continue
    const s = zonedToUtc(c.dayKey, c.startMin, ev.timezone)
    const e = zonedToUtc(c.endDayKey ?? c.dayKey, c.endMin, ev.timezone)
    if (e > s) out.push({ s, e })
  }
  return out
}
