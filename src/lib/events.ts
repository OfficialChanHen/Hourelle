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
// the host's locked-in plan: a day, a clock-minute window, and the chosen place(s)
export type ConfirmedSlot = { dayKey: string; startMin: number; endMin: number; placeIds: string[] }
export type Participant = { id: string; initials: string; name: string; color: PersonColor; rsvp: Rsvp; you?: boolean; host?: boolean; guest?: boolean }
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
    hybrid?: boolean           // in-person event that people can also join online via meetingLink
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
  quorum?: number                     // host-set smallest headcount that works; attendance warns below it
  capacity?: number                   // host-set spot limit; going is first come, first served
  expenses?: EventExpense[]           // actual spend logged against the budget
  image?: string                      // cover: 'preset:<id>' or a downscaled data URL the host uploaded
  messages: ChatMessage[]
  createdAt: number
  demo?: boolean
  status?: EventStatus                // undefined reads as 'planning' (back-compat with stored events)
  confirmed?: ConfirmedSlot           // set when the host locks in a time and place
  confirmedAt?: number
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
  capacity?: string    // optional spot limit; going is first come, first served
  windowStart?: string // 'HH:MM' — optional daily time window; empty = the whole day
  windowEnd?: string
  durationMin?: number // optional; drives the best-window search (default 60)
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
  // include the built-in demos (createdAt 0 sorts them last) so new users have something to explore
  const stored = readAll()
  const all = [...stored]
  for (const demo of [DEMO, BIG_DEMO]) if (!stored.some((e) => e.id === demo.id)) all.push(demo)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}
export function getEvent(id: string): AppEvent | null {
  const found = readAll().find((e) => e.id === id)
  if (found) return found
  if (id === DEMO.id) return DEMO
  if (id === BIG_DEMO.id) return BIG_DEMO
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
  taken.add(BIG_DEMO.id)
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

/* ── lifecycle ── */
// where an event sits in its life: still planning, locked in (far out / this week / today), or over.
// Derived, not stored — only the 'planning'/'confirmed' split lives on the event.
export type Phase = 'planning' | 'upcoming' | 'soon' | 'today' | 'past'

export function phaseOf(ev: Pick<AppEvent, 'status' | 'confirmed' | 'endDate'>): Phase {
  const endRef = ev.confirmed?.dayKey ?? ev.endDate
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
  const ranked = [...places].sort((a, b) => votesOf(b.id).length - votesOf(a.id).length)
  if (votesOf(ranked[0].id).length === 0) return null
  const margin = ranked.length > 1 ? votesOf(ranked[0].id).length - votesOf(ranked[1].id).length : null
  return { place: ranked[0], voters: votesOf(ranked[0].id), confirmed: false, margin }
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
  patchEvent(id, { participants: ev.participants.map((p) => (p.you ? { ...p, rsvp } : p)) })
}

export function confirmEvent(id: string, slot: ConfirmedSlot): void {
  patchEvent(id, { status: 'confirmed', confirmed: slot, confirmedAt: Date.now() })
}
export function reopenEvent(id: string): void {
  patchEvent(id, { status: 'planning', confirmed: undefined, confirmedAt: undefined })
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

  // itinerary picks are an ordered stop list (a venue may repeat); the candidate list is the unique set
  const isItin = input.planMode === 'itinerary'
  const pickedPlaces = input.picked.map((p) => ({ id: p.id, name: p.name, place: p.place, addedBy: YOU.id }))
  const uniquePlaces = pickedPlaces.filter((p, i) => pickedPlaces.findIndex((x) => x.id === p.id) === i)

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
    durationMin: input.durationMin && input.durationMin >= 1 ? Math.min(24 * 60, input.durationMin) : 60,
    capacity: input.capacity && Number(input.capacity) >= 1 ? Number(input.capacity) : undefined,
    messages: [],
    createdAt: Date.now(),
    status: 'planning',
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
const bigRsvp = (i: number): Rsvp => (i % 11 === 3 ? 'not_going' : i % 9 === 4 ? 'maybe' : i % 7 === 5 ? 'pending' : 'attending')
const BIG_PARTICIPANTS: Participant[] = [
  { id: 'JM', initials: 'JM', name: 'You', color: 'purple', rsvp: 'attending', you: true, host: true },
  ...BIG_NAMES.map(([ini, name], i): Participant => ({
    id: ini, initials: ini, name, color: GUEST_COLORS[i % GUEST_COLORS.length], rsvp: bigRsvp(i),
  })),
]
const BIG_DAYS = buildDays('2026-09-14', '2026-09-18') // Mon–Fri
const BIG_TIMES = buildTimes('60', 9 * 60, 18 * 60)    // 9 AM – 6 PM
const BIG_GRID_MAX = BIG_TIMES.length * 60
const BIG_AVAIL_IV: AvailIntervals = Object.fromEntries(BIG_DAYS.map((d, di) => {
  const byPid: Record<string, Iv[]> = {}
  BIG_PARTICIPANTS.forEach((p, pi) => {
    if (p.rsvp === 'not_going' || p.rsvp === 'pending') return
    const h = (pi * 7 + di * 5) % 9
    if (h === 8) return // out that day
    const s = (h % 4) * 90
    const e = Math.min(BIG_GRID_MAX, s + 180 + (pi % 3) * 60)
    const second = h % 3 === 0 && e + 60 < BIG_GRID_MAX ? [{ s: e + 60, e: Math.min(BIG_GRID_MAX, e + 180) }] : []
    byPid[p.id] = normalizeIv([{ s, e }, ...second])
  })
  return [d.key, byPid]
}))
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
  endDate: '2026-09-18',
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
