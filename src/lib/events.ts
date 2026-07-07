import type { PersonColor } from './colors'
import { av } from './people'
import {
  avail as demoAvail,
  gridDays as demoDays,
  gridTimes as demoTimes,
  participantIds as demoIds,
  notGoingIds as demoNotGoing,
  messages as demoMsgs,
  type ChatMessage,
} from './sample'

export type { ChatMessage }

export type Rsvp = 'attending' | 'maybe' | 'not_going' | 'pending'
export type Participant = { id: string; initials: string; name: string; color: PersonColor; rsvp: Rsvp; you?: boolean; host?: boolean; guest?: boolean }
export type EventPlace = { id: string; name: string; place: string }
export type GridDay = { key: string; dow: string; date: string; best?: boolean }
// minute-precise availability: grid-minutes from the top of the grid, block covers [s, e)
export type Iv = { s: number; e: number }
export type AvailIntervals = Record<string, Record<string, Iv[]>> // dayKey → participantId → merged ranges

export type AppEvent = {
  id: string
  title: string
  hostName: string
  hostedByYou: boolean
  description: string
  timezone: string
  startDate: string
  endDate: string
  granularity: '15' | '30' | '60'
  budget: string
  budgetMode?: 'total' | 'person'
  location: {
    mode: 'vote' | 'remote' | 'later'
    planMode: 'vote' | 'itinerary'
    places: EventPlace[]
    platform: string
    meetingLink: string
    guestsCanSuggest?: boolean // host-granted: lets non-hosts add places to the ballot
  }
  participants: Participant[]
  days: GridDay[]
  times: string[]
  avail: Record<string, string[][]>   // per-cell view, derived from availIv — kept for lists/stats
  availIv?: AvailIntervals            // source of truth once anyone edits with minute precision
  votes?: Record<string, string[]>    // placeId → participant ids who voted for it
  maxVotes?: number                   // votes each person gets (default 1)
  itinStops?: string[]                // ordered place ids once an itinerary exists
  itinRank?: string[]                 // vote ranking snapshot when the itinerary was built from votes
  itinDwell?: number[]                // minutes spent at each stop (aligned to itinStops order)
  itinStartMin?: number               // clock minutes the itinerary begins
  travelModes?: string[]              // allowed transport modes for route timing (default all)
  durationMin?: number                // how long the event needs — drives the best-window search
  messages: ChatMessage[]
  createdAt: number
  demo?: boolean
}

// what the create wizard hands us (a superset is fine)
export type CreateInput = {
  title: string
  hostMode: 'you' | 'org'
  orgName: string
  description: string
  startDate: string
  endDate: string
  granularity: string
  timezone: string
  budget: string
  windowStart?: string // 'HH:MM' — optional daily time window; empty = the whole day
  windowEnd?: string
  budgetMode?: 'total' | 'person'
  locMode: 'vote' | 'remote' | 'later'
  planMode: 'vote' | 'itinerary'
  picked: { id: string; name: string; place: string }[]
  platform: string
  meetingLink: string
  emails: string[]
  accounts: string[]
}

export const YOU = { id: 'JM', name: 'You', color: 'purple' as PersonColor }

/* ── storage ── */
const KEY = 'aline.events.v1'

function readAll(): AppEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AppEvent[]) : []
  } catch {
    return []
  }
}
function writeAll(list: AppEvent[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota / private mode */ }
}

export function listEvents(): AppEvent[] {
  // include the built-in demo (createdAt 0 sorts it last) so new users have something to explore
  const stored = readAll()
  const all = stored.some((e) => e.id === DEMO.id) ? stored : [...stored, DEMO]
  return all.sort((a, b) => b.createdAt - a.createdAt)
}
export function getEvent(id: string): AppEvent | null {
  const found = readAll().find((e) => e.id === id)
  if (found) return found
  if (id === DEMO.id) return DEMO
  return null
}
export function deleteEvent(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id))
}
export function patchEvent(id: string, patch: Partial<AppEvent>): void {
  const list = readAll()
  const i = list.findIndex((e) => e.id === id)
  if (i < 0) return // demo / unknown events are not persisted
  list[i] = { ...list[i], ...patch }
  writeAll(list)
}

/* ── slug ── */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'
}
function uniqueSlug(base: string): string {
  const taken = new Set(readAll().map((e) => e.id))
  taken.add(DEMO.id)
  let slug = base
  let n = 2
  while (taken.has(slug)) slug = `${base}-${n++}`
  return slug
}

/* ── date/time helpers ── */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function dayLabel(d: Date): string {
  return `${MON[d.getMonth()]} ${d.getDate()}`
}

export function buildDays(start: string, end: string): GridDay[] {
  const s = parseLocal(start) ?? new Date()
  const e = parseLocal(end) ?? s
  const days: GridDay[] = []
  const cur = new Date(s)
  // inclusive of both endpoints; cap at 21 days so the grid stays usable
  for (let i = 0; i < 21 && cur <= e; i++) {
    days.push({ key: isoOf(cur), dow: DOW[cur.getDay()], date: dayLabel(cur) })
    cur.setDate(cur.getDate() + 1)
  }
  if (days.length === 0) days.push({ key: isoOf(s), dow: DOW[s.getDay()], date: dayLabel(s) })
  return days
}

function timeLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const mm = mins % 60
  const ap = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return mm === 0 ? `${hr} ${ap}` : `${hr}:${String(mm).padStart(2, '0')} ${ap}`
}
export function parseHM(v: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
export function buildTimes(gran: string, fromMin = 0, toMin = 24 * 60): string[] {
  const step = gran === '15' ? 15 : gran === '60' ? 60 : 30
  const out: string[] = []
  for (let m = fromMin; m < toMin; m += step) out.push(timeLabel(m))
  return out
}

/* ── minute-precision availability ── */
export function stepOf(gran: string): number {
  return gran === '15' ? 15 : gran === '60' ? 60 : 30
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
  return parseClockLabel(ev.times[0] ?? '') ?? 8 * 60
}
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
export function gridToIntervals(avail: Record<string, string[][]>, days: GridDay[], step: number): AvailIntervals {
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
export function intervalsToGrid(availIv: AvailIntervals, days: GridDay[], rows: number, step: number): Record<string, string[][]> {
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
export function fmtMinute(min: number, h24 = false): string {
  const h = Math.floor(min / 60) % 24
  const mm = ((min % 60) + 60) % 60
  if (h24) return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  const ap = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(mm).padStart(2, '0')} ${ap}`
}

// interval sweep for the best window. With minLen <= 0 it returns the peak instantaneous
// overlap (a single segment). With minLen > 0 it finds the window of AT LEAST that length
// that the most people are free for the whole time, extended to its natural bounds.
export function bestWindow(availIv: AvailIntervals, days: GridDay[], minLen = 0) {
  let best: { dayKey: string; s: number; e: number; count: number; ids: string[] } | null = null
  const better = (count: number, s: number, e: number) =>
    !best || count > best.count || (count === best.count && e - s > best.e - best.s) || (count === best.count && e - s === best.e - best.s && s < best.s)

  for (const d of days) {
    const byPid = availIv[d.key] ?? {}
    const ids = Object.keys(byPid)
    if (!ids.length) continue
    const coverers = (s: number, e: number) => ids.filter((id) => byPid[id].some((iv) => iv.s <= s && iv.e >= e))

    if (minLen <= 0) {
      const cuts = new Set<number>()
      for (const ivs of Object.values(byPid)) for (const iv of ivs) { cuts.add(iv.s); cuts.add(iv.e) }
      const xs = [...cuts].sort((a, b) => a - b)
      for (let i = 0; i < xs.length - 1; i++) {
        const s = xs[i], e = xs[i + 1]
        const who = coverers(s, e)
        if (who.length && better(who.length, s, e)) best = { dayKey: d.key, s, e, count: who.length, ids: who }
      }
    } else {
      // candidate window starts: interval starts, and interval-ends shifted back by minLen
      const starts = new Set<number>()
      for (const ivs of Object.values(byPid)) for (const iv of ivs) { starts.add(iv.s); if (iv.e - minLen >= iv.s) starts.add(iv.e - minLen) }
      for (const s of starts) {
        if (s < 0) continue
        const e = s + minLen
        const who = coverers(s, e)
        if (!who.length) continue
        // extend the window while the same people are all still free (min of their covering-interval ends)
        let ext = Infinity
        for (const id of who) { const iv = byPid[id].find((v) => v.s <= s && v.e >= e); if (iv) ext = Math.min(ext, iv.e) }
        const eEnd = ext === Infinity ? e : ext
        if (better(who.length, s, eEnd)) best = { dayKey: d.key, s, e: eEnd, count: who.length, ids: who }
      }
    }
  }
  if (!best) return null
  const day = days.find((d) => d.key === best.dayKey)!
  return { ...best, dayLabel: `${day.dow}, ${day.date}` }
}
export function availIvOf(ev: AppEvent): AvailIntervals {
  return ev.availIv ?? gridToIntervals(ev.avail, ev.days, stepOf(ev.granularity))
}

export function daysUntil(startDate: string): number | null {
  const s = parseLocal(startDate)
  if (!s) return null
  const now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((s.getTime() - t0.getTime()) / 86400000)
}
export function dateRangeText(ev: { startDate: string; endDate: string }): string {
  const s = parseLocal(ev.startDate)
  const e = parseLocal(ev.endDate)
  if (!s) return 'Dates TBD'
  if (!e || ev.startDate === ev.endDate) return `${dayLabel(s)}, ${s.getFullYear()}`
  const sameYear = s.getFullYear() === e.getFullYear()
  return `${dayLabel(s)} – ${dayLabel(e)}${sameYear ? `, ${e.getFullYear()}` : ''}`
}

export function respondedCount(avail: Record<string, string[][]>): number {
  const ids = new Set<string>()
  for (const rows of Object.values(avail)) for (const cell of rows) for (const id of cell) ids.add(id)
  return ids.size
}

/* ── guests from emails ── */
const GUEST_COLORS: PersonColor[] = ['coral', 'blue', 'amber', 'pink', 'green', 'gray', 'teal', 'purple']
function guestFromEmail(email: string, i: number): Participant {
  const local = email.split('@')[0] || email
  const name = local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || email
  const initials = (name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2) || email[0] || 'G').toUpperCase()
  return { id: `g:${email}`, initials, name, color: GUEST_COLORS[i % GUEST_COLORS.length], rsvp: 'pending', guest: true }
}

/* ── create ── */
export function createEvent(input: CreateInput): AppEvent {
  const id = uniqueSlug(slugify(input.title))
  const hostedByYou = input.hostMode === 'you'
  const hostName = hostedByYou ? 'Jordan Miller' : input.orgName.trim() || 'Organization'

  const participants: Participant[] = [
    { id: YOU.id, initials: YOU.id, name: YOU.name, color: YOU.color, rsvp: 'attending', you: true, host: hostedByYou },
    ...input.accounts.map((pid) => ({ id: pid, initials: pid, name: av(pid).name, color: av(pid).color, rsvp: 'pending' as Rsvp })),
    ...input.emails.map((email, i) => guestFromEmail(email, i)),
  ]

  const days = buildDays(input.startDate, input.endDate)
  // optional daily time window, snapped outward to the slot size so it fully covers the ask;
  // no window = the whole day
  const st = stepOf(input.granularity)
  const winS = parseHM(input.windowStart), winE = parseHM(input.windowEnd)
  const hasWin = winS !== null && winE !== null && winE > winS
  const fromMin = hasWin ? Math.floor(winS / st) * st : 0
  const toMin = hasWin ? Math.ceil(winE / st) * st : 24 * 60
  const times = buildTimes(input.granularity, fromMin, toMin)
  const avail: Record<string, string[][]> = {}
  for (const d of days) avail[d.key] = times.map(() => [])

  const ev: AppEvent = {
    id,
    title: input.title.trim() || 'Untitled event',
    hostName,
    hostedByYou,
    description: input.description.trim(),
    timezone: input.timezone || 'UTC', // wizard validation requires one; fallback for safety
    startDate: input.startDate,
    endDate: input.endDate,
    granularity: (input.granularity === '15' || input.granularity === '60' ? input.granularity : '30'),
    budget: input.budget,
    budgetMode: input.budgetMode ?? 'total',
    location: {
      mode: input.locMode,
      planMode: input.planMode,
      places: input.picked.map((p) => ({ id: p.id, name: p.name, place: p.place })),
      platform: input.platform,
      meetingLink: input.meetingLink,
      guestsCanSuggest: false,
    },
    participants,
    days,
    times,
    avail,
    availIv: Object.fromEntries(days.map((d) => [d.key, {}])),
    votes: {},
    maxVotes: 1,
    itinStops: [],
    itinRank: [],
    itinDwell: [],
    itinStartMin: 9 * 60,
    durationMin: 60,
    messages: [],
    createdAt: Date.now(),
  }

  const list = readAll()
  list.push(ev)
  writeAll(list)
  return ev
}

/* ── the built-in populated demo (reachable by URL, not listed) ── */
const DEMO: AppEvent = {
  id: 'q3-offsite',
  title: 'Q3 Team Offsite Planning',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  description: 'Two days of strategy, workshops, and a team dinner to align on Q3 goals. Travel is reimbursed for out-of-town folks.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-06-30',
  endDate: '2026-07-04',
  granularity: '60',
  budget: '4200',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: [
      { id: 'cavallo', name: 'Cavallo Point Lodge', place: 'Sausalito, CA' },
      { id: 'terrapin', name: 'Terrapin Crossroads', place: 'San Rafael, CA' },
      { id: 'presidio', name: 'Odeum at the Presidio', place: 'San Francisco, CA' },
    ],
    platform: 'Google Meet',
    meetingLink: '',
    guestsCanSuggest: true, // the demo host opened suggestions up
  },
  votes: {
    cavallo: ['SR', 'KL', 'PR', 'MN', 'CL'],
    terrapin: ['AT', 'JM'],
    presidio: ['DW'],
  },
  maxVotes: 2,
  durationMin: 120,
  itinStartMin: 9 * 60,
  itinDwell: [],
  participants: demoIds.map((id) => ({
    id,
    initials: id,
    name: id === 'JM' ? 'You' : av(id).name,
    color: av(id).color,
    rsvp: (demoNotGoing.includes(id) ? 'not_going' : 'attending') as Rsvp,
    you: id === 'JM',
    host: id === 'JM',
  })),
  days: demoDays.map((d) => ({ key: d.key, dow: d.dow, date: d.date, best: d.best })),
  times: [...demoTimes],
  avail: demoAvail,
  messages: demoMsgs,
  createdAt: 0,
  demo: true,
}
