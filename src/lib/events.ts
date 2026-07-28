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
export type EventStatus = 'planning' | 'confirmed'
// the host's locked-in plan: a day, a clock-minute window, and the chosen place(s).
// endDayKey (day polls only) makes it a run of whole days — absent means one day.
export type ConfirmedSlot = { dayKey: string; endDayKey?: string; startMin: number; endMin: number; placeIds: string[] }
export type Participant = {
  id: string; initials: string; name: string; color: PersonColor; rsvp: Rsvp
  // set when lock-in answered for them from their availability — cleared the moment
  // they answer themselves, so the UI can say "marked going from your times"
  rsvpAuto?: boolean
  you?: boolean; host?: boolean; guest?: boolean
}
export type EventPlace = { id: string; name: string; place: string; addedBy?: string } // addedBy: participant id who suggested it
export type EventExpense = { id: string; label: string; amount: number; paidBy: string } // amount in whole dollars; paidBy: participant id
export type GridDay = { key: string; dow: string; date: string; best?: boolean }
// minute-precise availability: grid-minutes from the top of the grid, block covers [s, e)
export type Iv = { s: number; e: number }
export type AvailIntervals = Record<string, Record<string, Iv[]>> // dayKey → participantId → merged ranges

export type AppEvent = {
  id: string
  title: string
  hostName: string
  hostedByYou: boolean
  hostKind?: AccountKind // drives the host icon; older events fall back on hostedByYou
  description: string
  timezone: string
  startDate: string
  endDate: string
  granularity: '15' | '30' | '60' | 'day' // 'day': one all-day row per day — a tap-per-day poll for trips and multi-day plans
  budget: string
  budgetMode?: 'total' | 'person'
  location: {
    // how the "where" question is answered: 'vote' runs a live ballot, 'set' is a venue
    // the host picked as fact (no voting UI), 'remote' is online, 'later' defers it
    mode: 'vote' | 'set' | 'remote' | 'later'
    planMode: 'vote' | 'itinerary'
    places: EventPlace[]
    platform: string
    meetingLink: string
    guestsCanSuggest?: boolean // host-granted: lets non-hosts add places to the ballot
    hybrid?: boolean           // in-person event that people can also join online via meetingLink
    settled?: boolean          // legacy (pre-'set'): folded into mode by readAll — never read it elsewhere
  }
  participants: Participant[]
  days: GridDay[]
  times: string[]
  avail: Record<string, string[][]>   // per-cell view, derived from availIv — kept for lists/stats
  availIv?: AvailIntervals            // source of truth once anyone edits with minute precision
  votes?: Record<string, string[]>    // placeId → participant ids who voted for it
  maxVotes?: number                   // votes each person gets (default 1)
  hideVoters?: boolean                // anonymous ballot: only counts show, never who voted for what
  voteDeadline?: string               // ISO date; voting closes at the end of this day
  itinStops?: string[]                // ordered place ids once an itinerary exists
  itinRank?: string[]                 // vote ranking snapshot when the itinerary was built from votes
  itinDwell?: number[]                // minutes spent at each stop (aligned to itinStops order)
  itinStartMin?: number               // clock minutes the itinerary begins
  travelModes?: string[]              // allowed transport modes for route timing (default all)
  durationMin?: number                // how long the event needs — drives the best-window search
  bestMode?: BestMode                 // what the best-window search favors (default 'full')
  quorum?: number                     // host-set smallest headcount that works; attendance warns below it
  capacity?: number                   // host-set spot limit; going is first come, first served
  expenses?: EventExpense[]           // actual spend logged against the budget
  unavailableIds?: string[]           // declared "none of these days work" — an explicit empty reply, not silence
  image?: string                      // cover: 'preset:<id>' or a downscaled data URL the host uploaded
  messages: ChatMessage[]
  createdAt: number
  demo?: boolean
  status?: EventStatus                // undefined reads as 'planning' (back-compat with stored events)
  // the answered "when": set when the host locks in a plan, OR from birth when the date
  // was fixed at creation. A planning event with a slot here is "time set, place still open".
  confirmed?: ConfirmedSlot
  confirmedAt?: number
}

// what the create wizard hands us (a superset is fine). The host is always the
// signed-in account — creating an event requires one, so there is nothing to choose.
export type CreateInput = {
  title: string
  description: string
  startDate: string
  endDate: string
  // explicit day keys when the poll skips days inside the range (weekends only,
  // hand-picked dates); absent or empty = every day from startDate to endDate
  pickedDays?: string[]
  granularity: string
  timezone: string
  budget: string
  capacity?: string    // optional spot limit; going is first come, first served
  windowStart?: string // 'HH:MM' — optional daily time window; empty = the whole day
  windowEnd?: string
  durationMin?: number // optional; drives the best-window search (default 60)
  bestMode?: BestMode  // optional; carried over when reusing an event's shape
  budgetMode?: 'total' | 'person'
  locMode: 'vote' | 'set' | 'remote' | 'later' // 'set': in person with the place already chosen — guests see it as fact
  planMode: 'vote' | 'itinerary'
  // date already set ('YYYY-MM-DD' + 'HH:MM'): the time is a fact from birth. The event
  // is only born confirmed if the place is also answered — a live ballot keeps it planning.
  fixed?: { day: string; start: string; end: string }
  picked: { id: string; name: string; place: string }[]
  platform: string
  meetingLink: string
  emails: string[]
  accounts: string[]
}

// how the hosting account reads: a person or an organization. Decided by the login
// (Google workspace accounts read as org) once auth exists; stubbed as person for now.
export type AccountKind = 'person' | 'org'

// the signed-in identity (stubbed until auth): rosters show the real name with a
// "(You)" marker rendered from the `you` flag, never a participant literally named You
export const YOU = { id: 'JM', name: 'Jordan Miller', color: 'purple' as PersonColor, kind: 'person' as AccountKind }

/* ── storage ── */
const KEY = 'aline.events.v1'

// pre-'set' events stored a settled venue as mode:'vote' + settled:true — fold that into
// the mode on read so every consumer sees one vocabulary (writes then self-heal via patch)
function normalizeStored(e: AppEvent): AppEvent {
  if (e.location?.mode === 'vote' && e.location.settled) {
    return { ...e, location: { ...e.location, mode: 'set', settled: undefined } }
  }
  return e
}

function readAll(): AppEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AppEvent[]).map(normalizeStored) : []
  } catch {
    return []
  }
}
function writeAll(list: AppEvent[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota / private mode */ }
}

export function listEvents(): AppEvent[] {
  // include the built-in demos (createdAt 0 sorts them last) so new users have something to explore
  const stored = readAll()
  const all = [...stored]
  for (const demo of DEMOS) if (!stored.some((e) => e.id === demo.id)) all.push(demo)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}
export function getEvent(id: string): AppEvent | null {
  return readAll().find((e) => e.id === id) ?? DEMOS.find((d) => d.id === id) ?? null
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
  for (const d of DEMOS) taken.add(d.id)
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

// how many days one poll may ask about. The limit protects the person replying, not
// the grid — so it tracks the effort per day: an hour grid is a real ask per day,
// a day poll is one tap, which is why trips get to stretch to a season.
export function maxPollDays(gran: string): number {
  return gran === 'day' ? 90 : 28
}

export function buildDays(start: string, end: string, cap = 28): GridDay[] {
  const s = parseLocal(start) ?? new Date()
  const e = parseLocal(end) ?? s
  const days: GridDay[] = []
  const cur = new Date(s)
  // inclusive of both endpoints; capped so the poll stays answerable (see maxPollDays)
  for (let i = 0; i < cap && cur <= e; i++) {
    days.push({ key: isoOf(cur), dow: DOW[cur.getDay()], date: dayLabel(cur) })
    cur.setDate(cur.getDate() + 1)
  }
  if (days.length === 0) days.push({ key: isoOf(s), dow: DOW[s.getDay()], date: dayLabel(s) })
  return days
}

// an explicit, possibly non-contiguous day list ("weekends only", hand-picked days) —
// dedup, sort, same cap as buildDays (validation upstream keeps lists inside it)
export function buildDaysFrom(keys: string[], cap = 28): GridDay[] {
  const seen = new Set<string>()
  const days: GridDay[] = []
  for (const key of [...keys].sort()) {
    const d = parseLocal(key)
    if (!d || seen.has(key)) continue
    seen.add(key)
    days.push({ key, dow: DOW[d.getDay()], date: dayLabel(d) })
    if (days.length === cap) break
  }
  return days
}

// the day keys a range yields after exclusions — the count matters for validation, so
// this deliberately has no 21-day cap (a hard stop at 400 guards runaway ranges)
export function selectedDayKeys(start: string, end: string, excludedDows: number[], excludedDays: string[]): string[] {
  const s = parseLocal(start)
  const e = parseLocal(end) ?? s
  if (!s || !e) return []
  const dows = new Set(excludedDows)
  const skip = new Set(excludedDays)
  const out: string[] = []
  const cur = new Date(s)
  for (let i = 0; i < 400 && cur <= e; i++) {
    const key = isoOf(cur)
    if (!dows.has(cur.getDay()) && !skip.has(key)) out.push(key)
    cur.setDate(cur.getDate() + 1)
  }
  return out
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
// day polls have one row covering the whole day — the label is a marker other code
// checks (gridStartMinOf), so it stays a single constant
export const ALL_DAY = 'All day'
export function buildTimes(gran: string, fromMin = 0, toMin = 24 * 60): string[] {
  if (gran === 'day') return [ALL_DAY]
  const step = gran === '15' ? 15 : gran === '60' ? 60 : 30
  const out: string[] = []
  for (let m = fromMin; m < toMin; m += step) out.push(timeLabel(m))
  return out
}

/* ── minute-precision availability ── */
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
// what the best-window search favors: 'full' = the most people who can stay the whole
// time; 'crowd' = the fullest room on average, even if few can stay start to finish
export type BestMode = 'full' | 'crowd'

export function bestWindow(availIv: AvailIntervals, days: GridDay[], minLen = 0, bestMode: BestMode = 'full') {
  // ids = people free the whole window; anyIds = everyone who overlaps it at all
  let best: { dayKey: string; s: number; e: number; count: number; ids: string[]; anyIds: string[]; avg: number } | null = null
  let bestWeight = 0
  let bestGap = 0
  // primary and secondary swap with the mode: whole-window people vs person-minutes
  // inside the window. Then the window that opens with people actually there (no dead
  // air before the first arrival), then longer, then earlier.
  const better = (count: number, weight: number, gap: number, s: number, e: number) => {
    if (!best) return true
    const [a1, a2] = bestMode === 'crowd' ? [weight, count] : [count, weight]
    const [b1, b2] = bestMode === 'crowd' ? [bestWeight, best.count] : [best.count, bestWeight]
    if (a1 !== b1) return a1 > b1
    if (a2 !== b2) return a2 > b2
    if (gap !== bestGap) return gap < bestGap
    if (e - s !== best.e - best.s) return e - s > best.e - best.s
    return s < best.s
  }

  for (const d of days) {
    const byPid = availIv[d.key] ?? {}
    const ids = Object.keys(byPid)
    if (!ids.length) continue
    const coverers = (s: number, e: number) => ids.filter((id) => byPid[id].some((iv) => iv.s <= s && iv.e >= e))
    const minutesIn = (s: number, e: number) => {
      let w = 0
      for (const ivs of Object.values(byPid)) for (const iv of ivs) w += Math.max(0, Math.min(iv.e, e) - Math.max(iv.s, s))
      return w
    }

    if (minLen <= 0) {
      const cuts = new Set<number>()
      for (const ivs of Object.values(byPid)) for (const iv of ivs) { cuts.add(iv.s); cuts.add(iv.e) }
      const xs = [...cuts].sort((a, b) => a - b)
      for (let i = 0; i < xs.length - 1; i++) {
        const s = xs[i], e = xs[i + 1]
        const who = coverers(s, e)
        const weight = minutesIn(s, e)
        if (who.length && better(who.length, weight, 0, s, e)) { best = { dayKey: d.key, s, e, count: who.length, ids: who, anyIds: who, avg: weight / (e - s) }; bestWeight = weight; bestGap = 0 }
      }
    } else {
      // candidate starts: every point where either the full-window crowd or the
      // person-minutes slope can change — interval edges and their minLen shifts
      const starts = new Set<number>()
      for (const ivs of Object.values(byPid)) for (const iv of ivs) {
        starts.add(iv.s); starts.add(iv.e)
        if (iv.s - minLen >= 0) starts.add(iv.s - minLen)
        if (iv.e - minLen >= 0) starts.add(iv.e - minLen)
      }
      for (const s of starts) {
        if (s < 0) continue
        const e = s + minLen
        const who = coverers(s, e)
        // weight over the committed duration, not the extension — the event lasts minLen
        const weight = minutesIn(s, e)
        // crowd mode still scores a window nobody can fully cover; full mode skips it
        if (bestMode === 'crowd' ? weight <= 0 : !who.length) continue
        // dead air before anyone arrives: window start to the first free moment in it
        let firstFree = Infinity
        for (const ivs of Object.values(byPid)) for (const iv of ivs) if (iv.e > s && iv.s < e) firstFree = Math.min(firstFree, Math.max(iv.s, s))
        const gap = firstFree === Infinity ? 0 : firstFree - s
        // the window is exactly the event's length — the frame and footers report a
        // slot you could book as-is, never a longer stretch around it
        if (better(who.length, weight, gap, s, e)) {
          const anyIds = ids.filter((id) => byPid[id].some((iv) => iv.s < e && iv.e > s))
          best = { dayKey: d.key, s, e, count: who.length, ids: who, anyIds, avg: weight / minLen }
          bestWeight = weight
          bestGap = gap
        }
      }
    }
  }
  if (!best) return null
  const day = days.find((d) => d.key === best.dayKey)!
  return { ...best, dayLabel: `${day.dow}, ${day.date}` }
}
/* ── best run of consecutive days ──
   Which N-day block can the most people make? A person counts for a day when they
   marked any free time on it. Blocks are consecutive CALENDAR days that are all in
   the poll — so a weekends-only poll naturally forms Sat+Sun blocks and nothing else.
   'full' favors people who can make every day of the block; 'crowd' favors the
   most person-days overall. Earlier blocks win ties. */
export type BestBlock = { startKey: string; endKey: string; count: number; ids: string[]; anyIds: string[]; avgPerDay: number }
export function bestBlock(availIv: AvailIntervals, days: GridDay[], blockLen: number, bestMode: BestMode = 'full'): BestBlock | null {
  if (blockLen < 1 || days.length < blockLen) return null
  const keys = days.map((d) => d.key)
  const nextDay = (k: string) => {
    const d = parseLocal(k)
    if (!d) return ''
    d.setDate(d.getDate() + 1)
    return isoOf(d)
  }
  let best: BestBlock | null = null
  let bestPrimary = 0
  let bestSecondary = 0
  for (let i = 0; i + blockLen <= keys.length; i++) {
    const block = keys.slice(i, i + blockLen)
    if (block.some((k, j) => j > 0 && block[j - 1] !== '' && k !== nextDay(block[j - 1]))) continue
    const perDay = block.map((k) => new Set(Object.entries(availIv[k] ?? {}).filter(([, ivs]) => ivs.length > 0).map(([id]) => id)))
    const anySet = new Set<string>()
    for (const s of perDay) for (const id of s) anySet.add(id)
    const ids = [...anySet].filter((id) => perDay.every((s) => s.has(id)))
    const personDays = perDay.reduce((n, s) => n + s.size, 0)
    if (personDays === 0) continue
    const [p, s] = bestMode === 'crowd' ? [personDays, ids.length] : [ids.length, personDays]
    if (p > bestPrimary || (p === bestPrimary && s > bestSecondary)) {
      best = { startKey: block[0], endKey: block[block.length - 1], count: ids.length, ids, anyIds: [...anySet], avgPerDay: personDays / blockLen }
      bestPrimary = p
      bestSecondary = s
    }
  }
  return best
}

export function availIvOf(ev: AppEvent): AvailIntervals {
  return ev.availIv ?? gridToIntervals(ev.avail, ev.days, stepOf(ev.granularity))
}
// same, but over every stored day — including dormant ones dropped from the current
// range — so writers never lose the replies a later window change should bring back
export function fullAvailIvOf(ev: Pick<AppEvent, 'avail' | 'availIv' | 'granularity'>): AvailIntervals {
  return ev.availIv ?? gridToIntervals(ev.avail, Object.keys(ev.avail).map((key) => ({ key })), stepOf(ev.granularity))
}

export function daysUntil(startDate: string): number | null {
  const s = parseLocal(startDate)
  if (!s) return null
  const now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((s.getTime() - t0.getTime()) / 86400000)
}
export function dateRangeText(ev: { startDate: string; endDate: string; days?: GridDay[] }): string {
  const s = parseLocal(ev.startDate)
  const e = parseLocal(ev.endDate)
  if (!s) return 'Dates TBD'
  if (!e || ev.startDate === ev.endDate) return `${dayLabel(s)}, ${s.getFullYear()}`
  const sameYear = s.getFullYear() === e.getFullYear()
  const range = `${dayLabel(s)} – ${dayLabel(e)}${sameYear ? `, ${e.getFullYear()}` : ''}`
  // a sparse poll (weekends only, hand-picked days) says how many days it really asks
  // about, so a two-month span doesn't read as a two-month marathon
  const span = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  const n = ev.days?.length ?? 0
  return n > 1 && n < span ? `${range} · ${n} days` : range
}

/* ── lifecycle ── */
// Every event answers two independent questions: WHEN and WHERE. Each arrives either
// open (find a time together / vote on a place) or pre-answered (date set / place set),
// which gives the four planning shapes. An event is 'confirmed' only once BOTH are
// closed — so a fixed-date event with a live place ballot stays in planning, with its
// time already reading as fact (a `confirmed` slot on a status:'planning' event).
export type OpenQuestion = 'time' | 'place'
export function openQuestions(ev: Pick<AppEvent, 'status' | 'confirmed' | 'location'>): OpenQuestion[] {
  if (ev.status === 'confirmed' && ev.confirmed) return []
  const out: OpenQuestion[] = []
  if (!ev.confirmed) out.push('time')
  // only a live ballot ('vote') leaves the question open — 'set' is a fact the host
  // stated, 'remote' and 'later' never had a ballot to run
  if (ev.location.mode === 'vote') out.push('place')
  return out
}

// where an event sits in its life: still planning (a question is open), locked in
// (far out / this week / today), or over. Derived, not stored — only the
// 'planning'/'confirmed' split lives on the event.
export type Phase = 'planning' | 'upcoming' | 'soon' | 'today' | 'past'

export function phaseOf(ev: Pick<AppEvent, 'status' | 'confirmed' | 'endDate'>): Phase {
  // a multi-day lock ends on its last day, and counts as "today" for its whole run
  const endRef = ev.confirmed?.endDayKey ?? ev.confirmed?.dayKey ?? ev.endDate
  const untilEnd = daysUntil(endRef)
  if (untilEnd !== null && untilEnd < 0) return 'past'
  if (ev.status !== 'confirmed' || !ev.confirmed) return 'planning'
  const du = daysUntil(ev.confirmed.dayKey)
  if (du === null) return 'upcoming'
  if (du <= 0) return 'today'
  return du <= 7 ? 'soon' : 'upcoming'
}

export function daysUntilLabel(du: number | null): string {
  if (du === null) return 'Dates TBD'
  if (du < 0) return 'Past'
  if (du === 0) return 'Today'
  return `${du} day${du === 1 ? '' : 's'}`
}

// the locked-in slot as one glanceable line: "Sat, Jul 26 · 5:00 PM – 9:00 PM".
// An all-day slot (a day poll's lock) skips the clock times; a run of days reads
// as "Fri, Aug 14 – Sun, Aug 16".
export function confirmedSlotText(ev: Pick<AppEvent, 'confirmed'>): string | null {
  if (!ev.confirmed) return null
  const d = parseLocal(ev.confirmed.dayKey)
  if (!d) return null
  const day = `${DOW[d.getDay()]}, ${dayLabel(d)}`
  const e = ev.confirmed.endDayKey ? parseLocal(ev.confirmed.endDayKey) : null
  if (e) return `${day} – ${DOW[e.getDay()]}, ${dayLabel(e)}`
  const allDay = ev.confirmed.startMin === 0 && ev.confirmed.endMin === 24 * 60
  return allDay ? day : `${day} · ${fmtMinute(ev.confirmed.startMin)} – ${fmtMinute(ev.confirmed.endMin)}`
}

// the longest stretch of touching calendar days in a poll — the ceiling for any
// "days in a row" answer, shared by the grid dial and the planning summary
export function longestRun(days: Pick<GridDay, 'key'>[]): number {
  let best = days.length ? 1 : 0
  let run = 1
  for (let i = 1; i < days.length; i++) {
    const prev = parseLocal(days[i - 1].key)
    if (prev) prev.setDate(prev.getDate() + 1)
    run = prev && isoOf(prev) === days[i].key ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

// which other events land on the same scheduled day. Confirmed events clash on every
// day of their locked run (a Fri–Sun trip conflicts with a Saturday party), single-day
// events on their date; an open multi-day window isn't a clash yet.
// One clash is worth naming; a crowd becomes a count — otherwise every card on a busy
// day leads with the same arbitrary title and "and 3 more" that names nothing. The
// full list rides along for a tooltip, but only when it says more than the label does.
export type SameDayInfo = { label: string; all?: string }
export function sameDayLabelFor(events: AppEvent[]): (e: AppEvent) => SameDayInfo | undefined {
  const daysOf = (e: AppEvent): string[] => {
    if (e.confirmed) {
      const out: string[] = []
      const cur = parseLocal(e.confirmed.dayKey)
      const end = parseLocal(e.confirmed.endDayKey ?? e.confirmed.dayKey)
      if (!cur || !end) return []
      for (let i = 0; i < 90 && cur <= end; i++) { out.push(isoOf(cur)); cur.setDate(cur.getDate() + 1) }
      return out
    }
    return e.startDate === e.endDate ? [e.startDate] : []
  }
  const byDay = new Map<string, AppEvent[]>()
  for (const e of events) {
    for (const d of daysOf(e)) {
      const list = byDay.get(d) ?? []
      list.push(e)
      byDay.set(d, list)
    }
  }
  return (e) => {
    const seen = new Set<string>()
    const others: AppEvent[] = []
    for (const d of daysOf(e)) {
      for (const o of byDay.get(d) ?? []) {
        if (o.id === e.id || seen.has(o.id)) continue
        seen.add(o.id)
        others.push(o)
      }
    }
    if (others.length === 0) return undefined
    if (others.length === 1) return { label: others[0].title }
    return {
      label: `${others.length} other events`,
      all: others.map((o) => o.title).join(', '),
    }
  }
}

/* ── leading place ── */
// the place an event is heading to: the confirmed venue once locked, else the vote front-runner.
// Ranking matches the Location tab so no two tabs ever disagree.
export type LeadingPlace = { place: EventPlace; voters: string[]; confirmed: boolean; margin: number | null }
export function leadingPlaceOf(ev: AppEvent): LeadingPlace | null {
  const places = ev.location.places
  if (ev.location.mode === 'remote' || !places.length) return null
  const votes = ev.votes ?? {}
  const votesOf = (id: string) => votes[id] ?? []
  const confirmedPlace = ev.status === 'confirmed' && ev.confirmed
    ? places.find((p) => ev.confirmed!.placeIds.includes(p.id))
    : undefined
  if (confirmedPlace) return { place: confirmedPlace, voters: votesOf(confirmedPlace.id), confirmed: true, margin: null }
  // a set venue is a fact, not a front-runner — report it as final
  if (ev.location.mode === 'set') return { place: places[0], voters: votesOf(places[0].id), confirmed: true, margin: null }
  const ranked = [...places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)
  if (votesOf(ranked[0].id).length === 0) return null
  const margin = ranked.length > 1 ? votesOf(ranked[0].id).length - votesOf(ranked[1].id).length : null
  return { place: ranked[0], voters: votesOf(ranked[0].id), confirmed: false, margin }
}

// name ordering used wherever people list: first name A→Z, ties broken by last name
export function byFirstLastName(a: Pick<Participant, 'name'>, b: Pick<Participant, 'name'>): number {
  const [af, ...ar] = a.name.split(' ')
  const [bf, ...br] = b.name.split(' ')
  return af.localeCompare(bf) || ar.join(' ').localeCompare(br.join(' '))
}

// same, but with the signed-in person pinned first — the row people look for most
export function byYouFirst(a: Pick<Participant, 'name' | 'you'>, b: Pick<Participant, 'name' | 'you'>): number {
  return Number(!!b.you) - Number(!!a.you) || byFirstLastName(a, b)
}

// canonical roster order, shared by every people list: availability group first
// (whole time → part time → conflict elsewhere → never marked → maybe → not going
// → no reply), then first name, then last name
export function sortByAttendance(ev: AppEvent): Participant[] {
  const availIv = availIvOf(ev)
  const gridStart = gridStartMinOf(ev)
  const locked = ev.status === 'confirmed' && !!ev.confirmed
  const win = locked
    ? { dayKey: ev.confirmed!.dayKey, s: ev.confirmed!.startMin - gridStart, e: ev.confirmed!.endMin - gridStart }
    : bestWindow(availIv, ev.days, ev.durationMin ?? 60, ev.bestMode)
  const dayIv = win ? availIv[win.dayKey] ?? {} : {}
  const marked = new Set<string>()
  for (const day of Object.values(availIv)) for (const [id, ivs] of Object.entries(day)) if (ivs.length) marked.add(id)
  // a locked run of days ranks by day coverage: every day → 0, some days → 1
  const blockKeys: string[] | null = locked && ev.confirmed!.endDayKey
    ? (() => {
        const out: string[] = []
        const cur = parseLocal(ev.confirmed!.dayKey)
        const end = parseLocal(ev.confirmed!.endDayKey!)
        if (!cur || !end) return null
        for (let i = 0; i < 90 && cur <= end; i++) { out.push(isoOf(cur)); cur.setDate(cur.getDate() + 1) }
        return out
      })()
    : null
  const rank = (p: Participant): number => {
    if (p.rsvp === 'pending') return 6
    if (p.rsvp === 'not_going') return 5
    if (p.rsvp === 'maybe') return 4
    if (blockKeys) {
      const covered = blockKeys.filter((k) => (availIv[k]?.[p.id] ?? []).length > 0).length
      if (covered === blockKeys.length) return 0
      if (covered > 0) return 1
      return marked.has(p.id) ? 2 : 3
    }
    const ivs = win ? dayIv[p.id] : undefined
    if (!ivs?.length) return marked.has(p.id) ? 2 : 3
    if (win && ivs.some((iv) => iv.s <= win.s && iv.e >= win.e)) return 0
    if (win && ivs.some((iv) => iv.s < win.e && iv.e > win.s)) return 1
    return 2
  }
  return [...ev.participants].sort((a, b) => rank(a) - rank(b) || byYouFirst(a, b))
}

// everything that references a participant, minus that participant — their availability,
// votes, and roster row go together so no tab is left pointing at a ghost
export function removeParticipantPatch(ev: AppEvent, pid: string): Partial<AppEvent> {
  return {
    participants: ev.participants.filter((p) => p.id !== pid),
    avail: Object.fromEntries(Object.entries(ev.avail).map(([k, rows]) => [k, rows.map((ids) => ids.filter((id) => id !== pid))])),
    availIv: ev.availIv
      ? Object.fromEntries(Object.entries(ev.availIv).map(([k, byPid]) => [k, Object.fromEntries(Object.entries(byPid).filter(([id]) => id !== pid))]))
      : undefined,
    votes: ev.votes
      ? Object.fromEntries(Object.entries(ev.votes).map(([k, ids]) => [k, ids.filter((id) => id !== pid)]))
      : undefined,
  }
}

export function setMyRsvp(id: string, rsvp: Rsvp): void {
  const ev = getEvent(id)
  if (!ev) return
  // answering yourself retires the availability-based assumption
  patchEvent(id, { participants: ev.participants.map((p) => (p.you ? { ...p, rsvp, rsvpAuto: undefined } : p)) })
}

// does this person's availability cover the locked slot in full? A run of days needs
// a mark on every day; a timed slot needs one interval spanning the whole window.
export function slotFits(ev: AppEvent, slot: ConfirmedSlot, pid: string): boolean {
  const availIv = availIvOf(ev)
  if (slot.endDayKey) {
    const cur = parseLocal(slot.dayKey)
    const end = parseLocal(slot.endDayKey)
    if (!cur || !end) return false
    for (let i = 0; i < 90 && cur <= end; i++) {
      if (!(availIv[isoOf(cur)]?.[pid] ?? []).length) return false
      cur.setDate(cur.getDate() + 1)
    }
    return true
  }
  const gridStart = gridStartMinOf(ev)
  const s = slot.startMin - gridStart
  const e = slot.endMin - gridStart
  return (availIv[slot.dayKey]?.[pid] ?? []).some((iv) => iv.s <= s && iv.e >= e)
}

export function confirmEvent(id: string, slot: ConfirmedSlot): void {
  // locking in opens the RSVP round with an assumption instead of a blank: whoever's
  // availability covers the locked slot starts as going (marked so they can undo it),
  // a declared "no days work" reads as can't go, and everyone else starts at no reply
  const ev = getEvent(id)
  const participants = ev?.participants.map((p): Participant => {
    if (p.host) return { ...p, rsvp: 'attending', rsvpAuto: undefined }
    if (slotFits(ev, slot, p.id)) return { ...p, rsvp: 'attending', rsvpAuto: true }
    if (ev.unavailableIds?.includes(p.id)) return { ...p, rsvp: 'not_going', rsvpAuto: true }
    return { ...p, rsvp: 'pending', rsvpAuto: undefined }
  })
  patchEvent(id, { status: 'confirmed', confirmed: slot, confirmedAt: Date.now(), ...(participants ? { participants } : {}) })
}
export function reopenEvent(id: string): void {
  // back to planning: the old RSVPs answered a time that no longer exists, so
  // everyone but the host returns to no-reply until the next lock-in asks again
  const ev = getEvent(id)
  const participants = ev?.participants.map((p): Participant => ({ ...p, rsvp: p.host ? 'attending' : 'pending', rsvpAuto: undefined }))
  // reopening changes what everyone agreed to, so it announces itself in the chat —
  // guests who saw "confirmed" find out why it reads "planning" again
  const host = ev?.participants.find((p) => p.host)
  const note: ChatMessage | null = ev && host
    ? { id: host.id, name: host.name, time: 'just now', text: 'Reopened the plan. RSVPs are cleared until it locks in again.', you: !!host.you }
    : null
  patchEvent(id, {
    status: 'planning', confirmed: undefined, confirmedAt: undefined,
    ...(participants ? { participants } : {}),
    ...(note ? { messages: [...(ev!.messages ?? []), note] } : {}),
  })
}

// seed the create wizard from an existing event: structure carries over, dates and
// responses deliberately do not — the host re-picks them for the new occasion
export function draftFromEvent(id: string): Partial<CreateInput> | null {
  const ev = getEvent(id)
  if (!ev) return null
  const isItin = ev.location.planMode === 'itinerary'
  const byId = new Map(ev.location.places.map((p) => [p.id, p]))
  const picked = isItin && ev.itinStops?.length
    ? ev.itinStops.map((sid) => byId.get(sid)).filter((p): p is EventPlace => !!p)
    : ev.location.places
  return {
    title: ev.title,
    description: ev.description,
    timezone: ev.timezone,
    granularity: ev.granularity,
    durationMin: ev.durationMin,
    bestMode: ev.bestMode,
    budget: ev.budget,
    budgetMode: ev.budgetMode,
    locMode: ev.location.mode,
    planMode: ev.location.planMode,
    picked: picked.map((p) => ({ id: p.id, name: p.name, place: p.place })),
    platform: ev.location.platform,
    meetingLink: ev.location.meetingLink,
    emails: ev.participants.filter((p) => p.guest).map((p) => p.id.replace(/^g:/, '')),
    accounts: ev.participants.filter((p) => !p.guest && !p.you).map((p) => p.id),
  }
}

export function respondedCount(avail: Record<string, string[][]>, unavailableIds?: string[]): number {
  // declaring "none of these days work" is a reply too — an explicit empty one
  const ids = new Set<string>(unavailableIds ?? [])
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

  const participants: Participant[] = [
    { id: YOU.id, initials: YOU.id, name: YOU.name, color: YOU.color, rsvp: 'attending', you: true, host: true },
    ...input.accounts.map((pid) => ({ id: pid, initials: pid, name: av(pid).name, color: av(pid).color, rsvp: 'pending' as Rsvp })),
    ...input.emails.map((email, i) => guestFromEmail(email, i)),
  ]

  // the date is already set: the time is a fact from birth. If the place is answered
  // too the event is born confirmed and goes straight to the RSVP round; with a live
  // ballot it stays in planning until the place is locked.
  const fxS = input.fixed ? parseHM(input.fixed.start) : null
  const fxE = input.fixed ? parseHM(input.fixed.end) : null
  const fixed = input.fixed && fxS !== null && fxE !== null && fxE > fxS
    ? { day: input.fixed.day, s: fxS, e: fxE }
    : null

  // a fixed date carries clock times, so it can't be a day poll — coerce to 30 min
  const gran: AppEvent['granularity'] =
    input.granularity === '15' || input.granularity === '60' ? input.granularity
      : input.granularity === 'day' && !fixed ? 'day'
        : '30'

  // an explicit day list (weekends only, hand-picked dates) beats the plain range
  const dayCap = maxPollDays(gran)
  const sparseList = !fixed && input.pickedDays?.length ? buildDaysFrom(input.pickedDays, dayCap) : null
  const sparse = sparseList?.length ? sparseList : null
  const days = sparse ?? buildDays(fixed ? fixed.day : input.startDate, fixed ? fixed.day : input.endDate, dayCap)
  // optional daily time window, snapped outward to the slot size so it fully covers the ask;
  // no window = the whole day. A fixed date windows the grid around the chosen slot.
  const st = stepOf(gran)
  const winS = fixed ? fixed.s : parseHM(input.windowStart), winE = fixed ? fixed.e : parseHM(input.windowEnd)
  const hasWin = winS !== null && winE !== null && winE > winS
  const fromMin = hasWin ? Math.floor(winS / st) * st : 0
  const toMin = hasWin ? Math.min(24 * 60, Math.ceil(winE / st) * st) : 24 * 60
  const times = buildTimes(gran, fromMin, toMin)
  const avail: Record<string, string[][]> = {}
  for (const d of days) avail[d.key] = times.map(() => [])

  // itinerary picks are an ordered stop list (a venue may repeat); the candidate list is the unique set
  const isItin = input.planMode === 'itinerary'
  const pickedPlaces = input.picked.map((p) => ({ id: p.id, name: p.name, place: p.place, addedBy: YOU.id }))
  const uniquePlaces = pickedPlaces.filter((p, i) => pickedPlaces.findIndex((x) => x.id === p.id) === i)
  const settled = input.locMode === 'set'
  // a fixed date locks the place(s) too, when they're known
  const fixedPlaceIds = settled ? uniquePlaces.map((p) => p.id) : isItin ? input.picked.map((p) => p.id) : []
  // a live ballot means the place question is still open: even with a fixed date the
  // event is born planning (time as fact), and only locks once the place is chosen
  const placeOpen = input.locMode === 'vote' && !isItin

  const ev: AppEvent = {
    id,
    title: input.title.trim() || 'Untitled event',
    hostName: YOU.name,
    hostedByYou: true,
    hostKind: YOU.kind,
    description: input.description.trim(),
    timezone: input.timezone || 'UTC', // wizard validation requires one; fallback for safety
    startDate: fixed ? fixed.day : sparse ? days[0].key : input.startDate,
    endDate: fixed ? fixed.day : sparse ? days[days.length - 1].key : input.endDate,
    granularity: gran,
    budget: input.budget,
    budgetMode: input.budgetMode ?? 'total',
    location: {
      mode: input.locMode,
      planMode: input.planMode,
      places: isItin ? uniquePlaces : pickedPlaces,
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
    // seed the itinerary from the wizard's ordered stops so it shows up on the Location tab
    itinStops: isItin ? input.picked.map((p) => p.id) : [],
    itinRank: [],
    itinDwell: isItin ? input.picked.map(() => 60) : [],
    itinStartMin: hasWin ? (winS as number) : 9 * 60,
    durationMin: fixed ? fixed.e - fixed.s : input.durationMin && input.durationMin >= 1 ? Math.min(24 * 60, input.durationMin) : 60,
    bestMode: input.bestMode,
    capacity: input.capacity && Number(input.capacity) >= 1 ? Number(input.capacity) : undefined,
    messages: [],
    createdAt: Date.now(),
    status: fixed && !placeOpen ? 'confirmed' : 'planning',
    ...(fixed ? {
      confirmed: { dayKey: fixed.day, startMin: fixed.s, endMin: fixed.e, placeIds: fixedPlaceIds },
      ...(placeOpen ? {} : { confirmedAt: Date.now() }),
    } : {}),
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
      { id: 'cavallo', name: 'Cavallo Point Lodge', place: 'Sausalito, CA', addedBy: 'SR' },
      { id: 'terrapin', name: 'Terrapin Crossroads', place: 'San Rafael, CA', addedBy: 'JM' },
      { id: 'presidio', name: 'Odeum at the Presidio', place: 'San Francisco, CA', addedBy: 'DW' },
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
    name: id === 'JM' ? 'Jordan Miller' : av(id).name,
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

/* ── the built-in demo at scale: 24 people, 12 venues, 3 votes each — for seeing the
   busy case, not the happy-demo case. Everything is generated deterministically from
   indices so the event reads the same on every load. ── */
const BIG_NAMES: [string, string][] = [
  ['AT', 'Alex Turner'], ['SR', 'Sam Rivera'], ['DW', 'Dana Wu'], ['KL', 'Kim Lee'],
  ['PR', 'Pat Reyes'], ['LC', 'Lee Chang'], ['MT', 'Mia Torres'], ['BA', 'Ben Adams'],
  ['ZC', 'Zoe Clark'], ['RP', 'Raj Patel'], ['AS', 'Ana Silva'], ['TB', 'Tom Baker'],
  ['IC', 'Ivy Chen'], ['MW', 'Max Weber'], ['SL', 'Sky Larson'], ['GM', 'Gus Moreno'],
  ['FW', 'Fay Wong'], ['EN', 'Eli Novak'], ['UR', 'Uma Reddy'], ['HK', 'Hana Kim'],
  ['OD', 'Omar Diaz'], ['NV', 'Nora Vance'], ['YS', 'Yuki Sato'],
]
const BIG_PLACES: EventPlace[] = [
  { id: 'bandshell', name: 'Golden Gate Park Bandshell', place: 'San Francisco, CA', addedBy: 'JM' },
  { id: 'dolores', name: 'Dolores Park', place: 'San Francisco, CA', addedBy: 'AT' },
  { id: 'presidio-picnic', name: 'Presidio Picnic Grounds', place: 'San Francisco, CA', addedBy: 'SR' },
  { id: 'fort-mason', name: 'Fort Mason Center', place: 'San Francisco, CA', addedBy: 'JM' },
  { id: 'crissy', name: 'Crissy Field East Beach', place: 'San Francisco, CA', addedBy: 'DW' },
  { id: 'lands-end', name: 'Lands End Lookout', place: 'San Francisco, CA', addedBy: 'KL' },
  { id: 'ocean-firepits', name: 'Ocean Beach Firepits', place: 'San Francisco, CA', addedBy: 'MT' },
  { id: 'stern-grove', name: 'Stern Grove', place: 'San Francisco, CA', addedBy: 'ZC' },
  { id: 'alamo', name: 'Alamo Square', place: 'San Francisco, CA', addedBy: 'RP' },
  { id: 'mission-rock', name: 'Mission Rock Terrace', place: 'San Francisco, CA', addedBy: 'IC' },
  { id: 'treasure', name: 'Treasure Island Winery', place: 'San Francisco, CA', addedBy: 'FW' },
  { id: 'berkeley-marina', name: 'Berkeley Marina', place: 'Berkeley, CA', addedBy: 'OD' },
]
// venue ids repeated by expected popularity, so the ballot has a clear leader and a real race
const BIG_WEIGHTED = [
  'bandshell', 'bandshell', 'bandshell', 'bandshell', 'bandshell',
  'dolores', 'dolores', 'dolores', 'dolores',
  'presidio-picnic', 'presidio-picnic', 'presidio-picnic',
  'crissy', 'crissy', 'stern-grove', 'stern-grove',
  'fort-mason', 'lands-end', 'ocean-firepits', 'alamo', 'mission-rock', 'treasure', 'berkeley-marina',
]
// planning stage has no "maybe" — that answer belongs to the post-lock-in RSVP round
const bigRsvp = (i: number): Rsvp => (i % 11 === 3 ? 'not_going' : i % 7 === 5 ? 'pending' : 'attending')
const BIG_PARTICIPANTS: Participant[] = [
  { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true, host: true },
  ...BIG_NAMES.map(([ini, name], i): Participant => ({
    id: ini, initials: ini, name, color: GUEST_COLORS[i % GUEST_COLORS.length], rsvp: bigRsvp(i),
  })),
]
const BIG_DAYS = buildDays('2026-09-14', '2026-09-25') // two work weeks, Monday in and Friday out
const BIG_TIMES = buildTimes('60', 9 * 60, 18 * 60)    // 9 AM – 6 PM
const BIG_GRID_MAX = BIG_TIMES.length * 60
// three people said yes and never opened the grid — the honest "no times yet" group
const BIG_NEVER_MARKED = new Set(['DW', 'TB', 'OD'])
const BIG_AVAIL_IV: AvailIntervals = Object.fromEntries(BIG_DAYS.map((d, di) => {
  const byPid: Record<string, Iv[]> = {}
  BIG_PARTICIPANTS.forEach((p, pi) => {
    if (p.rsvp === 'not_going' || p.rsvp === 'pending' || BIG_NEVER_MARKED.has(p.id)) return
    const h = (pi * 7 + di * 5) % 9
    if (h === 8) return // out that day
    const s = (h % 4) * 90
    const e = Math.min(BIG_GRID_MAX, s + 180 + (pi % 3) * 60)
    const second = h % 3 === 0 && e + 60 < BIG_GRID_MAX ? [{ s: e + 60, e: Math.min(BIG_GRID_MAX, e + 180) }] : []
    byPid[p.id] = normalizeIv([{ s, e }, ...second])
  })
  return [d.key, byPid]
}))
// one hour where everyone who responded lines up (Thu of week two, 12–1) — but only an hour,
// so a 3-hour event's best window still lives elsewhere. The grid shows it full dark.
{
  const day = '2026-09-24'
  const everyone = new Set<string>()
  for (const byPid of Object.values(BIG_AVAIL_IV)) for (const id of Object.keys(byPid)) everyone.add(id)
  const byPid = (BIG_AVAIL_IV[day] ??= {})
  for (const id of everyone) byPid[id] = normalizeIv([...(byPid[id] ?? []), { s: 180, e: 240 }])
}
// the two flavors of "can't make it": Kim Lee declined and never touched the grid,
// Sky Larson declined but marked mornings — real times, none inside the best window
for (const d of BIG_DAYS) (BIG_AVAIL_IV[d.key] ??= {}).SL = [{ s: 0, e: 120 }]
const BIG_VOTES: Record<string, string[]> = {}
BIG_PARTICIPANTS.forEach((p, i) => {
  if (p.rsvp === 'not_going') return
  const picks = new Set([
    BIG_WEIGHTED[(i * 5) % BIG_WEIGHTED.length],
    BIG_WEIGHTED[(i * 7 + 3) % BIG_WEIGHTED.length],
    BIG_WEIGHTED[(i * 11 + 6) % BIG_WEIGHTED.length],
  ])
  for (const v of picks) (BIG_VOTES[v] ??= []).push(p.id)
})

const BIG_DEMO: AppEvent = {
  id: 'harvest-fair',
  title: 'Fall Harvest Fair',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  description: 'The whole crew, one afternoon outdoors. Twelve venues on the ballot, three votes each — may the best park win.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-09-14',
  endDate: '2026-09-25',
  granularity: '60',
  budget: '6000',
  budgetMode: 'total',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: BIG_PLACES,
    platform: '',
    meetingLink: '',
    guestsCanSuggest: true,
  },
  votes: BIG_VOTES,
  maxVotes: 3,
  voteDeadline: '2026-09-10',
  participants: BIG_PARTICIPANTS,
  days: BIG_DAYS,
  times: BIG_TIMES,
  avail: intervalsToGrid(BIG_AVAIL_IV, BIG_DAYS, BIG_TIMES.length, 60),
  availIv: BIG_AVAIL_IV,
  durationMin: 180,
  itinStops: [],
  itinRank: [],
  itinDwell: [],
  itinStartMin: 10 * 60,
  capacity: 20,
  quorum: 15,
  // Hana declared none of the days work — the third flavor of absence, next to
  // Kim's silence-and-decline and Sky's mismatched times
  unavailableIds: ['HK'],
  image: 'preset:harvest',
  messages: [
    { id: 'AT', name: 'Alex Turner', time: 'Tue', text: 'Three votes each people, spend them wisely', you: false },
    { id: 'ZC', name: 'Zoe Clark', time: 'Tue', text: 'Bandshell has power outlets for the speakers, just saying', you: false },
    { id: 'OD', name: 'Omar Diaz', time: 'Wed', text: 'Berkeley Marina if you want wind, which you do not', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
}

/* ── invited demos: events someone else is hosting, so home has a "You're invited" lane.
   Both land on the same Saturday on purpose — the same-day flag needs something to show. ── */
const HW_DAYS = buildDays('2026-07-24', '2026-07-27')
const HW_TIMES = buildTimes('60', 12 * 60, 22 * 60)
// grid minutes measured from noon (times[0]); Sarah is free all day, others trickle in
const HW_IV: AvailIntervals = {
  '2026-07-25': { SR: [{ s: 0, e: 600 }], AT: [{ s: 240, e: 600 }], MN: [{ s: 300, e: 540 }] },
  '2026-07-26': { SR: [{ s: 0, e: 600 }], AT: [{ s: 300, e: 600 }], MN: [{ s: 300, e: 540 }], CL: [{ s: 360, e: 600 }] },
}
const HOUSEWARMING: AppEvent = {
  id: 'sarahs-housewarming',
  title: 'Housewarming at Sarah’s',
  hostName: 'Sarah R',
  hostedByYou: false,
  hostKind: 'person',
  description: 'New place, first party. Come see the balcony everyone is going to fight over.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-07-24',
  endDate: '2026-07-27',
  granularity: '60',
  budget: '',
  location: {
    mode: 'set',
    planMode: 'vote',
    places: [{ id: 'sr-place', name: 'Sarah’s new apartment', place: 'Oakland, CA', addedBy: 'SR' }],
    platform: '',
    meetingLink: '',
  },
  votes: { 'sr-place': ['SR', 'AT', 'MN'] },
  participants: [
    { id: 'SR', initials: 'SR', name: 'Sarah R', color: av('SR').color, rsvp: 'attending', host: true },
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'pending', you: true },
    { id: 'AT', initials: 'AT', name: 'Alex T', color: av('AT').color, rsvp: 'attending' },
    { id: 'MN', initials: 'MN', name: 'Mia N', color: av('MN').color, rsvp: 'attending' },
    { id: 'CL', initials: 'CL', name: 'Chris L', color: av('CL').color, rsvp: 'maybe' },
    { id: 'NK', initials: 'NK', name: 'Nina K', color: av('NK').color, rsvp: 'pending' },
  ],
  days: HW_DAYS,
  times: HW_TIMES,
  avail: intervalsToGrid(HW_IV, HW_DAYS, HW_TIMES.length, 60),
  availIv: HW_IV,
  durationMin: 240,
  image: 'preset:evening',
  messages: [
    { id: 'SR', name: 'Sarah R', time: 'Mon', text: 'Saturday evening it is. Bring nothing but yourselves', you: false },
    { id: 'AT', name: 'Alex T', time: 'Mon', text: 'Bringing something anyway', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'confirmed',
  confirmed: { dayKey: '2026-07-25', startMin: 17 * 60, endMin: 21 * 60, placeIds: ['sr-place'] },
}

const TRAIL_DAYS = buildDays('2026-07-25', '2026-07-25')
const TRAIL_TIMES = buildTimes('60', 8 * 60, 14 * 60)
const TRAIL_IV: AvailIntervals = {
  '2026-07-25': { OB: [{ s: 0, e: 360 }], JM: [{ s: 60, e: 300 }], DW: [{ s: 60, e: 240 }], GH: [{ s: 0, e: 300 }], BH: [{ s: 120, e: 360 }] },
}
const TRAIL_DAY: AppEvent = {
  id: 'shoreline-cleanup',
  title: 'Shoreline Trail Cleanup',
  hostName: 'Omar B',
  hostedByYou: false,
  hostKind: 'person',
  description: 'Gloves and grabbers provided. Coffee after for everyone who shows up.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-07-25',
  endDate: '2026-07-25',
  granularity: '60',
  budget: '',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: [{ id: 'pt-isabel', name: 'Point Isabel Shoreline', place: 'Richmond, CA', addedBy: 'OB' }],
    platform: '',
    meetingLink: '',
  },
  votes: { 'pt-isabel': ['OB', 'GH', 'JM'] },
  participants: [
    { id: 'OB', initials: 'OB', name: 'Omar B', color: av('OB').color, rsvp: 'attending', host: true },
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true },
    { id: 'DW', initials: 'DW', name: 'Dana W', color: av('DW').color, rsvp: 'attending' },
    { id: 'GH', initials: 'GH', name: 'Grace H', color: av('GH').color, rsvp: 'attending' },
    { id: 'BH', initials: 'BH', name: 'Ben H', color: av('BH').color, rsvp: 'maybe' },
  ],
  days: TRAIL_DAYS,
  times: TRAIL_TIMES,
  avail: intervalsToGrid(TRAIL_IV, TRAIL_DAYS, TRAIL_TIMES.length, 60),
  availIv: TRAIL_IV,
  durationMin: 180,
  image: 'preset:coast',
  messages: [
    { id: 'OB', name: 'Omar B', time: 'Tue', text: 'Morning shift so you still have your Saturday', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'confirmed',
  confirmed: { dayKey: '2026-07-25', startMin: 9 * 60, endMin: 12 * 60, placeIds: ['pt-isabel'] },
}

/* ── the four planning shapes, one demo each. Every event answers two questions,
   when and where, and each can arrive open or already answered:
   1. both open        → Design Team Dinner   (find a time, vote on a place)
   2. place answered   → Brunch at Mama's     (venue set, finding the day)
   3. time answered    → Priya's Send-off     (Friday is booked, voting the venue —
                          status stays 'planning' while the confirmed slot is a fact)
   4. both answered    → Trivia Night         (born confirmed, straight to RSVPs) ── */

// 1 · both questions open
const DINNER_DAYS = buildDays('2026-08-03', '2026-08-09')
const DINNER_TIMES = buildTimes('30', 17 * 60, 22 * 60)
const DINNER_IV: AvailIntervals = {
  '2026-08-05': { JM: [{ s: 60, e: 300 }], AT: [{ s: 0, e: 240 }], SR: [{ s: 120, e: 300 }] },
  '2026-08-06': { JM: [{ s: 0, e: 300 }], AT: [{ s: 60, e: 300 }] },
  '2026-08-07': { SR: [{ s: 0, e: 180 }] },
}
const DESIGN_DINNER: AppEvent = {
  id: 'design-team-dinner',
  title: 'Design Team Dinner',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'End of quarter dinner for the design crew. Mark the evenings you can do and vote on where we eat.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-08-03',
  endDate: '2026-08-09',
  granularity: '30',
  budget: '450',
  budgetMode: 'total',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: [
      { id: 'luna', name: 'Luna Trattoria', place: 'San Francisco, CA', addedBy: 'AT' },
      { id: 'golden-lotus', name: 'Golden Lotus', place: 'San Francisco, CA', addedBy: 'JM' },
      { id: 'fable-fern', name: 'Fable & Fern', place: 'San Francisco, CA', addedBy: 'SR' },
    ],
    platform: '',
    meetingLink: '',
    guestsCanSuggest: true,
  },
  votes: { luna: ['AT', 'SR'], 'golden-lotus': ['JM'] },
  maxVotes: 1,
  participants: [
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true, host: true },
    { id: 'AT', initials: 'AT', name: av('AT').name, color: av('AT').color, rsvp: 'attending' },
    { id: 'SR', initials: 'SR', name: av('SR').name, color: av('SR').color, rsvp: 'attending' },
    { id: 'MN', initials: 'MN', name: av('MN').name, color: av('MN').color, rsvp: 'attending' },
    { id: 'CL', initials: 'CL', name: av('CL').name, color: av('CL').color, rsvp: 'pending' },
    { id: 'NK', initials: 'NK', name: av('NK').name, color: av('NK').color, rsvp: 'pending' },
  ],
  days: DINNER_DAYS,
  times: DINNER_TIMES,
  avail: intervalsToGrid(DINNER_IV, DINNER_DAYS, DINNER_TIMES.length, 30),
  availIv: DINNER_IV,
  durationMin: 120,
  image: 'preset:dusk',
  messages: [
    { id: 'AT', name: 'Alex T', time: 'Mon', text: 'Luna has the big table in the back, voting for that', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
}

// 2 · place answered, time open
const BRUNCH_DAYS = buildDays('2026-08-08', '2026-08-16')
const BRUNCH_TIMES = buildTimes('60', 9 * 60, 15 * 60)
const BRUNCH_IV: AvailIntervals = {
  '2026-08-08': { JM: [{ s: 0, e: 240 }], PR: [{ s: 60, e: 300 }], DW: [{ s: 0, e: 120 }] },
  '2026-08-09': { JM: [{ s: 0, e: 360 }], PR: [{ s: 0, e: 180 }], EM: [{ s: 60, e: 240 }], GH: [{ s: 0, e: 240 }] },
  '2026-08-15': { GH: [{ s: 120, e: 360 }] },
}
const BRUNCH: AppEvent = {
  id: 'brunch-at-mamas',
  title: 'Brunch at Mama’s',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'The place is set, we just need the right morning. Mark the days you could make it.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-08-08',
  endDate: '2026-08-16',
  granularity: '60',
  budget: '',
  location: {
    mode: 'set',
    planMode: 'vote',
    places: [{ id: 'mamas', name: 'Mama’s on Washington Square', place: 'San Francisco, CA', addedBy: 'JM' }],
    platform: '',
    meetingLink: '',
  },
  votes: {},
  participants: [
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true, host: true },
    { id: 'PR', initials: 'PR', name: av('PR').name, color: av('PR').color, rsvp: 'attending' },
    { id: 'DW', initials: 'DW', name: av('DW').name, color: av('DW').color, rsvp: 'attending' },
    { id: 'TC', initials: 'TC', name: av('TC').name, color: av('TC').color, rsvp: 'pending' },
    { id: 'EM', initials: 'EM', name: av('EM').name, color: av('EM').color, rsvp: 'attending' },
    { id: 'GH', initials: 'GH', name: av('GH').name, color: av('GH').color, rsvp: 'attending' },
  ],
  days: BRUNCH_DAYS,
  times: BRUNCH_TIMES,
  avail: intervalsToGrid(BRUNCH_IV, BRUNCH_DAYS, BRUNCH_TIMES.length, 60),
  availIv: BRUNCH_IV,
  durationMin: 90,
  image: 'preset:meadow',
  messages: [
    { id: 'GH', name: 'Grace H', time: 'Sun', text: 'They do not take reservations so early beats the line', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
}

// 3 · time answered, place open: the slot is a fact on a status:'planning' event,
// so the place ballot stays live and the lock-in only asks for the venue
const SENDOFF_DAYS = buildDays('2026-08-07', '2026-08-07')
const SENDOFF_TIMES = buildTimes('30', 19 * 60, 22 * 60)
const SENDOFF_IV: AvailIntervals = {
  '2026-08-07': {
    JM: [{ s: 0, e: 180 }], PR: [{ s: 0, e: 180 }], AT: [{ s: 0, e: 180 }],
    MN: [{ s: 60, e: 180 }], EM: [{ s: 0, e: 120 }],
  },
}
const SENDOFF: AppEvent = {
  id: 'priyas-send-off',
  title: 'Priya’s Send-off',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'Friday night is booked for Priya’s last week. Vote on the restaurant so we can reserve a table.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-08-07',
  endDate: '2026-08-07',
  granularity: '30',
  budget: '',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: [
      { id: 'trestle', name: 'Trestle', place: 'San Francisco, CA', addedBy: 'JM' },
      { id: 'zuni', name: 'Zuni Café', place: 'San Francisco, CA', addedBy: 'EM' },
      { id: 'copita', name: 'Copita', place: 'Sausalito, CA', addedBy: 'AT' },
    ],
    platform: '',
    meetingLink: '',
    guestsCanSuggest: true,
  },
  votes: { trestle: ['JM', 'MN'], zuni: ['EM', 'KL'], copita: ['AT'] },
  maxVotes: 1,
  voteDeadline: '2026-08-03',
  participants: [
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true, host: true },
    { id: 'PR', initials: 'PR', name: av('PR').name, color: av('PR').color, rsvp: 'attending' },
    { id: 'AT', initials: 'AT', name: av('AT').name, color: av('AT').color, rsvp: 'attending' },
    { id: 'KL', initials: 'KL', name: av('KL').name, color: av('KL').color, rsvp: 'attending' },
    { id: 'MN', initials: 'MN', name: av('MN').name, color: av('MN').color, rsvp: 'attending' },
    { id: 'EM', initials: 'EM', name: av('EM').name, color: av('EM').color, rsvp: 'attending' },
    { id: 'BH', initials: 'BH', name: av('BH').name, color: av('BH').color, rsvp: 'pending' },
  ],
  days: SENDOFF_DAYS,
  times: SENDOFF_TIMES,
  avail: intervalsToGrid(SENDOFF_IV, SENDOFF_DAYS, SENDOFF_TIMES.length, 30),
  availIv: SENDOFF_IV,
  durationMin: 180,
  image: 'preset:evening',
  messages: [
    { id: 'PR', name: 'Priya R', time: 'Tue', text: 'I get a vote on my own dinner right', you: false },
    { id: 'AT', name: 'Alex T', time: 'Tue', text: 'Copita is worth the bridge, hear me out', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
  confirmed: { dayKey: '2026-08-07', startMin: 19 * 60, endMin: 22 * 60, placeIds: [] },
}

// 4 · both answered: born confirmed, straight to the RSVP round
const TRIVIA_DAYS = buildDays('2026-07-30', '2026-07-30')
const TRIVIA_TIMES = buildTimes('30', 19 * 60, 21 * 60 + 30)
const TRIVIA_IV: AvailIntervals = {
  '2026-07-30': { JM: [{ s: 0, e: 150 }], RW: [{ s: 0, e: 150 }], TC: [{ s: 30, e: 150 }] },
}
const TRIVIA: AppEvent = {
  id: 'trivia-night-anchor',
  title: 'Trivia Night at The Anchor',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'Same bar, same table, last Thursday of the month. July edition is locked in, just say if you are in.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-07-30',
  endDate: '2026-07-30',
  granularity: '30',
  budget: '',
  location: {
    mode: 'set',
    planMode: 'vote',
    places: [{ id: 'anchor', name: 'The Anchor', place: 'Oakland, CA', addedBy: 'JM' }],
    platform: '',
    meetingLink: '',
  },
  votes: {},
  participants: [
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true, host: true },
    { id: 'RW', initials: 'RW', name: av('RW').name, color: av('RW').color, rsvp: 'attending' },
    { id: 'TC', initials: 'TC', name: av('TC').name, color: av('TC').color, rsvp: 'attending' },
    { id: 'NK', initials: 'NK', name: av('NK').name, color: av('NK').color, rsvp: 'maybe' },
    { id: 'DV', initials: 'DV', name: av('DV').name, color: av('DV').color, rsvp: 'not_going' },
    { id: 'OB', initials: 'OB', name: av('OB').name, color: av('OB').color, rsvp: 'pending' },
  ],
  days: TRIVIA_DAYS,
  times: TRIVIA_TIMES,
  avail: intervalsToGrid(TRIVIA_IV, TRIVIA_DAYS, TRIVIA_TIMES.length, 30),
  availIv: TRIVIA_IV,
  durationMin: 150,
  image: 'preset:garden',
  messages: [
    { id: 'RW', name: 'Riley W', time: 'Mon', text: 'We are not losing to the pharmacists again', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'confirmed',
  confirmed: { dayKey: '2026-07-30', startMin: 19 * 60, endMin: 21 * 60 + 30, placeIds: ['anchor'] },
}

/* ── the day-poll demo: a trip asks which days, weekends only, best-run answer ── */
const CABIN_DAYS = buildDaysFrom([
  '2026-09-04', '2026-09-05', '2026-09-06',
  '2026-09-11', '2026-09-12', '2026-09-13',
  '2026-09-18', '2026-09-19', '2026-09-20',
])
const CABIN_FULL: Iv[] = [{ s: 0, e: 24 * 60 }]
const CABIN_IV: AvailIntervals = {
  '2026-09-04': { JM: CABIN_FULL, AT: CABIN_FULL, SR: CABIN_FULL, MN: CABIN_FULL },
  '2026-09-05': { JM: CABIN_FULL, AT: CABIN_FULL, SR: CABIN_FULL, MN: CABIN_FULL, KL: CABIN_FULL },
  '2026-09-06': { JM: CABIN_FULL, AT: CABIN_FULL, SR: CABIN_FULL, KL: CABIN_FULL },
  '2026-09-11': { JM: CABIN_FULL, KL: CABIN_FULL },
  '2026-09-12': { JM: CABIN_FULL, MN: CABIN_FULL, KL: CABIN_FULL },
  '2026-09-19': { AT: CABIN_FULL, SR: CABIN_FULL },
}
const CABIN_TRIP: AppEvent = {
  id: 'cabin-trip',
  title: 'Cabin Trip',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'Three weekends on the table, one cabin at the end. Tap the days you could go.',
  timezone: 'America/Los_Angeles',
  startDate: '2026-09-04',
  endDate: '2026-09-20',
  granularity: 'day',
  budget: '900',
  budgetMode: 'person',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: [
      { id: 'tahoe-cabin', name: 'Donner Lake Cabin', place: 'Truckee, CA', addedBy: 'JM' },
      { id: 'sea-ranch', name: 'Sea Ranch House', place: 'Sea Ranch, CA', addedBy: 'SR' },
    ],
    platform: '',
    meetingLink: '',
    guestsCanSuggest: true,
  },
  votes: { 'tahoe-cabin': ['JM', 'AT', 'KL'], 'sea-ranch': ['SR'] },
  maxVotes: 1,
  participants: [
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true, host: true },
    { id: 'AT', initials: 'AT', name: av('AT').name, color: av('AT').color, rsvp: 'attending' },
    { id: 'SR', initials: 'SR', name: av('SR').name, color: av('SR').color, rsvp: 'attending' },
    { id: 'MN', initials: 'MN', name: av('MN').name, color: av('MN').color, rsvp: 'attending' },
    { id: 'KL', initials: 'KL', name: av('KL').name, color: av('KL').color, rsvp: 'attending' },
    { id: 'BH', initials: 'BH', name: av('BH').name, color: av('BH').color, rsvp: 'pending' },
  ],
  days: CABIN_DAYS,
  times: buildTimes('day'),
  avail: intervalsToGrid(CABIN_IV, CABIN_DAYS, 1, 24 * 60),
  availIv: CABIN_IV,
  durationMin: 60,
  image: 'preset:coast',
  messages: [
    { id: 'SR', name: 'Sarah R', time: 'Wed', text: 'First September weekend looks strong so far', you: false },
    { id: 'KL', name: 'Kyle L', time: 'Wed', text: 'I can do any of them except the 19th', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
}

// every built-in demo, in the order they list after stored events
const DEMOS: AppEvent[] = [DEMO, BIG_DEMO, DESIGN_DINNER, BRUNCH, SENDOFF, TRIVIA, CABIN_TRIP, HOUSEWARMING, TRAIL_DAY]
