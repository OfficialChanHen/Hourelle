import type { PersonColor } from './colors'
import { defaultFace, pickFace, sameFace, type Face } from './faces'
import { av } from './people'
import { isMine, purgeRemoved, pushAnswers, pushDelete, pushEvent, pushMessage, pushNewEvent } from './remote'
import { currentAccount } from './session'
import { writeLocal } from './local'
import { isControlMessage, placeVotes } from './polls'
import { slotOver, slotWhen } from './slot'
import type { AccountKind } from './session'
import {
  avail as demoAvail,
  gridDays as demoDays,
  gridTimes as demoTimes,
  participantIds as demoIds,
  notGoingIds as demoNotGoing,
  messages as demoMsgs,
  type ChatMessage,
} from './sample'
import type { CardDetail } from '@/components/ui/Keepsake'

export type { ChatMessage }

export type Rsvp = 'attending' | 'maybe' | 'not_going' | 'pending'
export type EventStatus = 'planning' | 'confirmed'
// the host's locked-in plan: a day, a clock-minute window, and the chosen place(s).
// endDayKey (a day poll, or a date set as a run of days) makes it a run of days — absent means one day.
// On a run, startMin is on the first day and endMin on the last; 0 to 24:00 is whole days.
export type ConfirmedSlot = { dayKey: string; endDayKey?: string; startMin: number; endMin: number; placeIds: string[] }
export type Participant = {
  id: string; initials: string; name: string; color: PersonColor; rsvp: Rsvp
  // the drawn face: the account's own when it chose one, otherwise dealt at join by
  // pickFace so it stands apart from the others here. Absent on older entries, which
  // draw a face from their initials and colour instead.
  face?: Face
  // set when lock-in answered for them from their availability — cleared the moment
  // they answer themselves, so the UI can say "marked going from your times"
  rsvpAuto?: boolean
  you?: boolean; host?: boolean; guest?: boolean
  // a guest's opt-in at join: reminders, and the cross-device claim by magic link —
  // never required to participate
  email?: string
  // set when the host invited them by email: a secret in their personal link, so
  // opening it lands them already named. Possession of the link is the identity.
  inviteToken?: string
  // when they first opened the event. An invitee is on the list from the moment
  // they are invited, so arriving is its own moment, and the room hears about it
  joinedAt?: number
  // when this invitation was made. A guest's id is built from their address, so
  // removing someone and inviting them again rebuilds the same id, and the mail log
  // (keyed on it) would call the second invitation a repeat of the first and send
  // nothing. This separates them: a new invitation is a new moment.
  invitedAt?: number
}
// lat/lng: where it is on the map (absent on custom places typed by hand, and on events saved before the real map)
export type EventPlace = { id: string; name: string; place: string; addedBy?: string; lat?: number; lng?: number } // addedBy: participant id who suggested it
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
  // everyone taken off the list, by the host or by leaving: the server clears their
  // chat lines only for ids that are here and no longer on the roster, so a merge
  // (which also takes an id off the roster) can never be mistaken for a removal
  removedIds?: string[]
  importedIv?: AvailIntervals         // dayKey → participantId → ranges a calendar import showed as busy: drawn striped, kept apart from the answer so painting never loses them
  votes?: Record<string, string[]>    // placeId → participant ids who voted for it
  maxVotes?: number                   // votes each person gets (default 1)
  hideVoters?: boolean                // anonymous ballot: only counts show, never who voted for what
  voteDeadline?: string               // ISO date; voting closes at the end of this day
  planDeadline?: string               // optional host-set date to have the plan locked by; reminders fire the day before and the day of
  rsvpDeadline?: string               // optional host-set date to have RSVPs in by (locked events); same reminder cadence
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
  imageFit?: 'fill' | 'fit'           // a photo cropped to the frame, or shown whole on a blur of itself
  // which part of a cropped photo to keep, as percentages, the way object-position
  // reads them. Absent means the middle, which is what every cover did before this.
  imagePos?: { x: number; y: number }
  // the detail on the plan's card (pins, tape, a clip, photo corners) or 'none';
  // absent means the one its id deals
  keepsake?: CardDetail
  messages: ChatMessage[]
  createdAt: number
  demo?: boolean
  practice?: boolean                  // the account's own sample event, made for the tour; editable like any other
  reopenedAt?: number                 // set when a locked plan reopens; cleared by the next lock-in — feeds the notification
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
  // an endDay past day makes it a run of days, the shape a locked day poll has; its
  // start is on the first day and its end on the last. allDay drops the times.
  fixed?: { day: string; endDay?: string; start: string; end: string; allDay?: boolean }
  rsvpDeadline?: string // optional, fixed-date events only: the RSVP round opens at birth
  image?: string        // the cover, chosen in the wizard or carried over by a duplicate
  imageFit?: 'fill' | 'fit'
  imagePos?: { x: number; y: number }
  keepsake?: CardDetail

  picked: { id: string; name: string; place: string; lat?: number; lng?: number }[]
  platform: string
  meetingLink: string
  emails: string[]
  accounts: AccountInvitee[]
}

// someone with an account, invited by id: their name comes with them, and their
// colour too when they picked it themselves (otherwise the event deals a distinct one)
export type AccountInvitee = { id: string; name: string; color: PersonColor; email?: string; colorChosen?: boolean }

// how the hosting account reads: a person or an organization. Decided by the login
// (Google workspace accounts read as org); every account is a person for now.
export type { AccountKind } from './session'

// the identity the app is acting as. A function, not a constant: signing in and out
// changes the answer mid-visit. Signed out (or with no backend) it is the stub the
// app has always used, so nothing downstream has to care. Rosters show the real name
// with a "(You)" marker rendered from the `you` flag, never a participant named You.
export const me = currentAccount

// who "I" am inside one event: the participant already marked `you` wins, so events
// created before signing in keep working, and only new ones carry the account id
function myIdIn(ev: Pick<AppEvent, 'participants'>): string {
  return ev.participants.find((p) => p.you)?.id ?? currentAccount().id
}

// avatar letters for a display name. Signed-in ids are uuids, so initials have to be
// read off the name rather than borrowed from the id the way the stub could
// the two letters on an avatar: first name + last name when there are two words or
// more, the first two letters of the name when there is only one
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const raw = words.length >= 2 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '').slice(0, 2)
  return (raw || 'A').toUpperCase()
}

/* ── storage ── */
const KEY = 'hourelle.events.v1'

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
// the one write that can realistically fill a browser, so it is the one that has to
// say when it did. writeLocal announces it; the change still goes to the cloud, which
// is why the notice is worded around this browser rather than around the plan.
function writeAll(list: AppEvent[]) {
  if (typeof window === 'undefined') return
  writeLocal(KEY, JSON.stringify(list))
}

export function listEvents(): AppEvent[] {
  // real events only — the built-in demos live on /demos, not mixed into your lists —
  // and only the ones this identity is part of (see isMine): the cache can hold
  // more than that for a moment around sign-in and sign-out
  return readAll().filter(isMine).sort((a, b) => b.createdAt - a.createdAt)
}

/* ── your earlier answers find you ──
   Someone who joined events by name and email, then made an account with that
   email, should find those events waiting — with their marks, votes and messages
   as theirs. Each matching guest entry is adopted into the account id. Runs after
   every pull and every sign-in; a no-op once everything is adopted. */
export function adoptMine(): number {
  const acc = currentAccount()
  if (!acc.signedIn) return 0
  const email = acc.email?.toLowerCase()
  // the adopted entry keeps the colour it was dealt on that event unless the
  // account picked one for itself
  const as = { name: acc.name, initials: initialsOf(acc.name), ...(acc.colorChosen ? { color: acc.color } : {}), ...(acc.face ? { face: acc.face } : {}) }
  let n = 0
  for (const ev of readAll()) {
    // an entry this browser joined as a guest belongs to whoever just signed in here:
    // it becomes the account's, and the guest session ends — the account is the
    // identity from now on, not the name typed on the invite page
    const gid = guestSessionId(ev.id)
    if (gid && ev.participants.some((p) => p.id === gid)) {
      if (!ev.participants.some((p) => p.id === acc.id)) adoptParticipant(ev.id, gid, acc.id, as)
      else patchEvent(ev.id, mergeParticipantsPatch(getEvent(ev.id)!, gid, acc.id)) // both exist: fold the guest in
      leaveGuestSession(ev.id)
      n++
      continue
    }
    if (!email) continue
    const mine = ev.participants.find((p) => p.guest && p.email?.toLowerCase() === email)
    if (!mine) continue
    // the account is already on this event too (invited itself, or joined twice):
    // the guest entry folds into it, answers and all, rather than standing beside it
    if (ev.participants.some((p) => p.id === acc.id)) patchEvent(ev.id, mergeParticipantsPatch(ev, mine.id, acc.id))
    else adoptParticipant(ev.id, mine.id, acc.id, as)
    n++
  }
  return n
}

/* The account changed its name, colour or face: every event it sits on shows the
   new one. Only this browser's copies are touched directly, and only the account's
   own entry in each; each patch syncs up. */
export function restampMe(as: { name?: string; color?: PersonColor; face?: Face }): number {
  const acc = currentAccount()
  let n = 0
  for (const ev of readAll()) {
    if (!ev.participants.some((p) => p.id === acc.id)) continue
    patchEventWith(ev.id, (cur) => ({
      participants: cur.participants.map((p) => (p.id === acc.id ? {
        ...p,
        ...(as.name ? { name: as.name, initials: initialsOf(as.name) } : {}),
        ...(as.color ? { color: as.color } : {}),
        ...(as.face ? { face: as.face } : {}),
      } : p)),
    }))
    n++
  }
  return n
}

/* The face this account chose, on every event this device holds where its entry
   still wears another: a face changed on another device, or an entry made for the
   account by a host who could not know its face. Runs after every pull; a no-op
   once they match, and for an account that never chose a face. */
export function stampMyFace(): number {
  const acc = currentAccount()
  const face = acc.face
  if (!face) return 0
  let n = 0
  for (const ev of readAll()) {
    const mine = ev.participants.find((p) => p.id === acc.id)
    if (!mine || sameFace(mine.face, face)) continue
    patchEventWith(ev.id, (cur) => ({ participants: cur.participants.map((p) => (p.id === acc.id ? { ...p, face } : p)) }))
    n++
  }
  return n
}

// the built-in example events, for the /demos shelf. A demo someone joined has a
// live copy in storage (see joinEvent) — that copy wins, so edits show through.
export function listDemos(): AppEvent[] {
  const stored = readAll()
  return DEMOS.map((d) => stored.find((e) => e.id === d.id) ?? d)
}
export function getEvent(raw: string): AppEvent | null {
  const id = DEMO_ALIASES[raw] ?? raw
  return readAll().find((e) => e.id === id) ?? DEMOS.find((d) => d.id === id) ?? null
}
export function deleteEvent(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id))
  pushDelete(id) // the host deleting removes it for everyone
}
// the non-host mirror of delete: take someone else's event off your own lists.
// Only this device's copy goes — the host's plan is untouched, and the invite
// link can always bring it back. Any guest session for it ends too.
/** Take yourself off an event someone else hosts. Your entry leaves the roster
 *  first, answers and votes with it, and that change goes to the cloud; only then
 *  is the event dropped from this browser. Dropping it alone was not enough: the
 *  next pull found you still on the roster and brought the event straight back.
 *  Every entry that is yours goes: the one under your account, the one from a
 *  guest session on this browser, and any guest entry made with your email. */
export function leaveEvent(id: string): void {
  const ev = getEvent(id)
  if (ev && !ev.demo && !ev.hostedByYou) {
    const acc = currentAccount()
    const gid = guestSessionId(id)
    const email = acc.signedIn ? acc.email?.toLowerCase() : undefined
    const mine = ev.participants
      .filter((p) => !p.host && (p.id === gid || (acc.signedIn && p.id === acc.id) || (!!email && p.email?.toLowerCase() === email)))
      .map((p) => p.id)
    if (mine.length) {
      let next: AppEvent = ev
      for (const pid of mine) next = { ...next, ...removeParticipantPatch(next, pid) }
      patchEvent(id, next)
      purgeRemoved(id, mine)
    }
  }
  writeAll(readAll().filter((e) => e.id !== id))
  leaveGuestSession(id)
}
export function patchEvent(id: string, patch: Partial<AppEvent>): void {
  const list = readAll()
  const i = list.findIndex((e) => e.id === id)
  if (i < 0) return // demo / unknown events are not persisted
  const before = list[i]
  list[i] = { ...before, ...patch }
  writeAll(list)
  // availability and the ballot travel as their own rows, one per person, so two
  // people answering at the same moment never overwrite each other. Everything else
  // is the document. Both are background sync; no-ops without a backend.
  pushAnswers(before, list[i])
  pushEvent(list[i])
}

/* A change worked out from the event as this device holds it right now, not as some
   screen last drew it. A panel renders from a snapshot, and the saved copy can move on
   under it (another person's times arriving over the socket, a pull after a reload),
   so a whole map rebuilt from the snapshot, written back, puts back an older answer
   over someone's newer one. Read and write happen together here, with nothing between
   them. Returns the patch it wrote, or null for an event this device does not keep. */
export function patchEventWith(id: string, make: (current: AppEvent) => Partial<AppEvent>): Partial<AppEvent> | null {
  const current = readAll().find((e) => e.id === id)
  if (!current) return null
  const patch = make(current)
  patchEvent(id, patch)
  return patch
}

/* ── slug ── */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'
}
/* Share links are the whole permission model: anyone holding one can read the event,
   so the id has to be unguessable. A title-derived slug ("summer-trip") was not —
   it could be typed at by hand. New ids keep the readable stem for the address bar
   and append 12 random characters, which is about 60 bits: not worth guessing at.
   Old events keep the ids they were born with; nothing here rewrites them. */
const TOKEN_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // no l/o/0/1 to misread aloud
export function linkToken(len = 12): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  // 256 is an exact multiple of the 32-character alphabet, so the modulo stays uniform
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join('')
}

function uniqueSlug(base: string): string {
  const taken = new Set(readAll().map((e) => e.id))
  for (const d of DEMOS) taken.add(d.id)
  for (const old of Object.keys(DEMO_ALIASES)) taken.add(old)
  let id = `${base}-${linkToken()}`
  while (taken.has(id)) id = `${base}-${linkToken()}` // collision is theoretical, handled anyway
  return id
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
// today as a day key in the viewer's own zone: the floor for every date picker, since
// a deadline or a poll day in the past decides nothing
export function todayKey(): string {
  return isoOf(new Date())
}
// a picked day, never earlier than the floor (the picker's min stops the calendar,
// this stops a typed date)
export function fromDay(v: string, floor: string): string {
  return v && v < floor ? floor : v
}
export function dayLabel(d: Date): string {
  return `${MON[d.getMonth()]} ${d.getDate()}`
}

// how many days one poll may ask about. The limit protects the person replying, not
// the grid — so it tracks the effort per day: an hour grid is a real ask per day,
// a day poll is one tap, which is why trips get to stretch to a season.
/* How many days a poll may hold. Two things decide it: the slot size (time slots
   need a bigger grid than whole days) and where the range starts. A range that
   starts on the first of a month may run to the end of a month — one month for
   time slots, three for whole days (Sep 1 to Nov 30) — so a whole calendar month
   is always allowed. Any other start gets the flat 4 weeks, or 12 for whole days. */
export function maxPollDays(gran: string, startDate?: string): number {
  const wholeDays = gran === 'day'
  const s = startDate ? parseLocal(startDate) : null
  if (s && s.getDate() === 1) {
    const last = new Date(s.getFullYear(), s.getMonth() + (wholeDays ? 3 : 1), 0) // day 0 of the month after: the last day
    return Math.round((last.getTime() - s.getTime()) / 86_400_000) + 1
  }
  return wholeDays ? 84 : 28
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
/* ── minute-precision availability ──
   The pure interval maths lives in lib/availability, where the sync layer can reach
   it without importing this module (it imports this one). Re-exported here so every
   caller keeps the single import it already had.
   ALL_DAY: day polls have one row covering the whole day, and the label is a marker
   other code checks (gridStartMinOf), so it stays a single constant. */
export {
  ALL_DAY, stepOf, parseClockLabel, gridStartMinOf, normalizeIv, gridToIntervals,
  intervalsToGrid, availIvOf, fullAvailIvOf, byParticipant, byDay, type PersonAnswer,
} from './availability'
import { ALL_DAY, stepOf, normalizeIv, intervalsToGrid, availIvOf, gridStartMinOf } from './availability'
export function buildTimes(gran: string, fromMin = 0, toMin = 24 * 60): string[] {
  if (gran === 'day') return [ALL_DAY]
  const step = gran === '15' ? 15 : gran === '60' ? 60 : 30
  const out: string[] = []
  for (let m = fromMin; m < toMin; m += step) out.push(timeLabel(m))
  return out
}

// the same clock time, marked when the minute count has run past midnight — the
// itinerary schedules one day, so a stop landing on the next day must say so
export function fmtMinuteDay(min: number, h24 = false): string {
  return min >= 24 * 60 ? `${fmtMinute(min, h24)} next day` : fmtMinute(min, h24)
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
  return n > 1 && n < span ? `${range} (${n} days)` : range
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

/** The clock in the event's own timezone: which day it is there, and how many
 *  minutes into that day. The browser's clock stands in for an event with no
 *  timezone, or one whose zone name this runtime does not know. */
export function nowIn(tz?: string): { dayKey: string; minute: number } {
  const now = new Date()
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
      const g = (t: string) => parts.find((x) => x.type === t)?.value ?? '00'
      return { dayKey: `${g('year')}-${g('month')}-${g('day')}`, minute: (Number(g('hour')) % 24) * 60 + Number(g('minute')) }
    } catch { /* unknown zone: the local clock below */ }
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return { dayKey: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, minute: now.getHours() * 60 + now.getMinutes() }
}

export function phaseOf(ev: Pick<AppEvent, 'status' | 'confirmed' | 'endDate' | 'rsvpDeadline'> & { timezone?: string }): Phase {
  // a multi-day lock ends on its last day, and counts as "today" for its whole run
  const endRef = ev.confirmed?.endDayKey ?? ev.confirmed?.dayKey ?? ev.endDate
  const untilEnd = daysUntil(endRef)
  if (untilEnd !== null && untilEnd < 0) return 'past'
  // a timed slot is over when its end time passes, in the event's own zone, not at
  // midnight: a dinner that ended at nine is done at nine, and a weekend that ends at
  // noon on the Sunday is done at noon on the Sunday
  if (ev.status === 'confirmed' && ev.confirmed) {
    const { dayKey, minute } = nowIn(ev.timezone)
    if (slotOver(ev.confirmed, dayKey, minute)) return 'past'
  }
  if (ev.status !== 'confirmed' || !ev.confirmed) return 'planning'
  const du = daysUntil(ev.confirmed.dayKey)
  if (du === null) return 'upcoming'
  if (du <= 0) return 'today'
  if (du <= 1) return 'soon'
  // 'upcoming' is the RSVP stretch, and it closes itself — the host's RSVP deadline
  // (or the day-before mark above) advances the event to 'soon' with no close button.
  // The deadline is soft: answers stay editable right up to the day.
  const rdu = ev.rsvpDeadline ? daysUntil(ev.rsvpDeadline) : null
  return rdu !== null && rdu < 0 ? 'soon' : 'upcoming'
}

export function daysUntilLabel(du: number | null): string {
  if (du === null) return 'Dates TBD'
  if (du < 0) return 'Past'
  if (du === 0) return 'Today'
  return `${du} day${du === 1 ? '' : 's'}`
}

// the locked-in slot as one glanceable line: "Sat, Jul 26, 5:00 PM – 9:00 PM",
// "Fri, Aug 14 – Sun, Aug 16" for a run of whole days, and
// "Fri, Aug 14, 6:00 PM – Sun, Aug 16, 12:00 PM" for a timed one (see lib/slot)
export function confirmedSlotText(ev: Pick<AppEvent, 'confirmed'>): string | null {
  if (!ev.confirmed || !parseLocal(ev.confirmed.dayKey)) return null
  return slotWhen(ev.confirmed, (k) => { const d = parseLocal(k); return d ? `${DOW[d.getDay()]}, ${dayLabel(d)}` : k }, fmtMinute)
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
      label: `${others.length} other plans`,
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
  // a run of days is read by day coverage below, so its window is the whole first day
  const win = locked
    ? ev.confirmed!.endDayKey
      ? { dayKey: ev.confirmed!.dayKey, s: 0, e: 24 * 60 - gridStart }
      : { dayKey: ev.confirmed!.dayKey, s: ev.confirmed!.startMin - gridStart, e: ev.confirmed!.endMin - gridStart }
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
/* ── the host's escape hatch: two entries that are one person ──
   Someone joined by name before they had an account, or twice from two devices,
   and now the roster counts them twice. Merging folds one entry into another:
   free time is the union of both, votes and marks are combined, messages and
   suggested places follow, and the duplicate disappears. Nothing they answered is
   lost, which is why this beats "remove" for a double. */
export function mergeParticipantsPatch(ev: AppEvent, fromId: string, intoId: string): Partial<AppEvent> {
  if (fromId === intoId) return {}
  const swap = (id: string) => (id === fromId ? intoId : id)
  const dedupe = (ids: string[]) => Array.from(new Set(ids.map(swap)))
  const availIv = ev.availIv
    ? Object.fromEntries(Object.entries(ev.availIv).map(([day, byPid]) => {
        const merged = normalizeIv([...(byPid[intoId] ?? []), ...(byPid[fromId] ?? [])])
        const rest = Object.fromEntries(Object.entries(byPid).filter(([pid]) => pid !== fromId && pid !== intoId))
        return [day, merged.length ? { ...rest, [intoId]: merged } : rest]
      }))
    : ev.availIv
  const avail = Object.fromEntries(Object.entries(ev.avail).map(([day, rows]) => [day, rows.map(dedupe)]))
  const votes = ev.votes ? Object.fromEntries(Object.entries(ev.votes).map(([place, ids]) => [place, dedupe(ids)])) : ev.votes
  const from = ev.participants.find((p) => p.id === fromId)
  return {
    participants: ev.participants
      .filter((p) => p.id !== fromId)
      // a reply beats no reply: the surviving entry keeps its answer unless it had none
      .map((p) => (p.id === intoId && p.rsvp === 'pending' && from && from.rsvp !== 'pending' ? { ...p, rsvp: from.rsvp, rsvpAuto: from.rsvpAuto } : p)),
    availIv, avail, votes,
    unavailableIds: ev.unavailableIds ? dedupe(ev.unavailableIds) : ev.unavailableIds,
    messages: ev.messages.map((m) => (m.id === fromId ? { ...m, id: intoId } : m)),
    location: { ...ev.location, places: ev.location.places.map((pl) => (pl.addedBy === fromId ? { ...pl, addedBy: intoId } : pl)) },
  }
}

/* Taking someone off the event takes everything they put into it: their free times,
   their calendar marks, "none of these days work", their votes and their lines in
   the chat, "joined the event" included. What they added to the ballot stays, since
   other people may have voted for it. The document half is here; the rows that live
   on their own (availability, votes, messages) follow through pushAnswers and
   purgeRemoved in remote.ts. */
export function removeParticipantPatch(ev: AppEvent, pid: string): Partial<AppEvent> {
  const drop = <T,>(byDay?: Record<string, Record<string, T>>) =>
    byDay ? Object.fromEntries(Object.entries(byDay).map(([k, byPid]) => [k, Object.fromEntries(Object.entries(byPid).filter(([id]) => id !== pid))])) : undefined
  return {
    participants: ev.participants.filter((p) => p.id !== pid),
    removedIds: [...new Set([...(ev.removedIds ?? []), pid])],
    unavailableIds: ev.unavailableIds?.filter((id) => id !== pid),
    importedIv: drop(ev.importedIv),
    messages: ev.messages.filter((m) => m.id !== pid),
    avail: Object.fromEntries(Object.entries(ev.avail).map(([k, rows]) => [k, rows.map((ids) => ids.filter((id) => id !== pid))])),
    availIv: drop(ev.availIv),
    votes: ev.votes
      ? Object.fromEntries(Object.entries(ev.votes).map(([k, ids]) => [k, ids.filter((id) => id !== pid)]))
      : undefined,
  }
}

export function setMyRsvp(id: string, rsvp: Rsvp): void {
  const ev = getEvent(id)
  if (!ev) return
  // "my" is whoever this browser acts as: the guest session when one exists, else
  // the stubbed account (the stored `you` participant)
  const gid = guestSessionId(id)
  const meId = gid && ev.participants.some((p) => p.id === gid) ? gid : ev.participants.find((p) => p.you)?.id
  // answering yourself retires the availability-based assumption
  patchEvent(id, { participants: ev.participants.map((p) => (p.id === meId ? { ...p, rsvp, rsvpAuto: undefined } : p)) })
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
  patchEvent(id, { status: 'confirmed', confirmed: slot, confirmedAt: Date.now(), reopenedAt: undefined, ...(participants ? { participants } : {}) })
}
export function reopenEvent(id: string): void {
  // back to planning: the old RSVPs answered a time that no longer exists, so
  // everyone but the host returns to no-reply until the next lock-in asks again
  const ev = getEvent(id)
  const participants = ev?.participants.map((p): Participant => ({ ...p, rsvp: p.host ? 'attending' : 'pending', rsvpAuto: undefined }))
  // reopening changes what everyone agreed to, so it announces itself in the chat —
  // guests who saw "confirmed" find out why it reads "planning" again
  const host = ev?.participants.find((p) => p.host)
  patchEvent(id, {
    status: 'planning', confirmed: undefined, confirmedAt: undefined, reopenedAt: Date.now(),
    ...(participants ? { participants } : {}),
  })
  if (ev && host) appendMessage(id, { id: host.id, name: host.name, time: 'just now', text: 'Reopened planning. RSVPs are cleared until it locks in again.', you: !!host.you, system: true })
}

// seed the create wizard from an existing event: structure carries over, dates and
// responses deliberately do not — the host re-picks them for the new occasion
/* ── duplicating an event: the same plan, moved to the next week that fits ──
   Everything travels: title, description, cover, people, budget, spots, the daily
   window. The dates move to the first day on or after today that falls on the
   original's start weekday, keeping the original's span and the weekdays it
   skipped. An event born with its date set comes back set, at the same clock times
   on that weekday; a poll comes back as a poll, even one that was later locked in,
   since the poll is the plan's shape and the lock-in was one week's answer. The
   place is the one that was locked in when there is one (a venue, or the itinerary
   in its locked order), otherwise the original ballot or itinerary. Replies never
   travel: it is a new plan, and the wizard is where the host checks the people
   list before it exists. */
export type EventDraft = Partial<CreateInput> & { excludedDows?: number[] }
export function draftFromEvent(id: string): EventDraft | null {
  const ev = getEvent(id)
  if (!ev) return null
  const isItin = ev.location.planMode === 'itinerary'
  const byId = new Map(ev.location.places.map((p) => [p.id, p]))
  const c = ev.confirmed
  const lockedPlaces = (c?.placeIds ?? []).map((pid) => byId.get(pid)).filter((p): p is EventPlace => !!p)
  // a locked-in single venue is the place, settled; a locked itinerary keeps its order
  const lockedVenue = !isItin && lockedPlaces.length === 1 && ev.location.mode !== 'remote'
  const picked = lockedPlaces.length
    ? lockedPlaces
    : isItin && ev.itinStops?.length
      ? ev.itinStops.map((sid) => byId.get(sid)).filter((p): p is EventPlace => !!p)
      : ev.location.places
  const locMode: CreateInput['locMode'] = lockedVenue ? 'set' : ev.location.mode

  const today = todayKey()
  const shift = (key: string, days: number) => { const d = parseLocal(key); if (!d) return key; d.setDate(d.getDate() + days); return isoOf(d) }
  // the first day on or after today with the same weekday as the given one
  const nextSameDow = (key: string) => { const d = parseLocal(key), t = parseLocal(today); return d && t ? shift(today, (d.getDay() - t.getDay() + 7) % 7) : key }
  const a = parseLocal(ev.startDate), b = parseLocal(ev.endDate)
  const span = a && b ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000)) : 0
  const startDate = nextSameDow(ev.startDate)
  const endDate = shift(startDate, span)
  // the daily window, when the grid did not cover the whole day
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const gridStart = gridStartMinOf(ev), gridEnd = gridStart + ev.times.length * stepOf(ev.granularity)
  const windowed = ev.granularity !== 'day' && ev.times.length > 0 && (gridStart > 0 || gridEnd < 24 * 60)
  // a weekday missing from every week of the range was turned off on purpose
  const have = new Set(ev.days.map((d) => d.key))
  const dowOf = (k: string) => parseLocal(k)?.getDay() ?? -1
  const all = selectedDayKeys(ev.startDate, ev.endDate, [], [])
  const excludedDows = [0, 1, 2, 3, 4, 5, 6].filter((dow) => { const mine = all.filter((k) => dowOf(k) === dow); return mine.length > 0 && mine.every((k) => !have.has(k)) })
  // born with its date set: one day, and the grid was built around the slot itself.
  // Only that shape comes back set; a poll that was locked in comes back as a poll.
  const bornFixed = !!c && !c.endDayKey && !(c.startMin === 0 && c.endMin === 24 * 60)
    && ev.days.length === 1 && ev.days[0]?.key === c.dayKey && gridStart === c.startMin && gridEnd === c.endMin
  // or born all day, or as a run of days, timed or not: a day grid that is exactly
  // the locked day or run
  const runEnd = c?.endDayKey ?? c?.dayKey
  const cAllDay = !!c && c.startMin === 0 && c.endMin === 24 * 60
  const bornWhole = !!c && ev.granularity === 'day' && (cAllDay || !!c.endDayKey)
    && ev.startDate === c.dayKey && ev.endDate === runEnd && ev.days.length === selectedDayKeys(c.dayKey, runEnd!, [], []).length
  const runSpan = (() => { const x = parseLocal(c?.dayKey ?? ''), y = parseLocal(runEnd ?? ''); return x && y ? Math.round((y.getTime() - x.getTime()) / 86400000) : 0 })()
  const fixed = bornFixed && c ? { day: nextSameDow(c.dayKey), start: hm(c.startMin), end: hm(c.endMin) }
    : bornWhole && c ? { day: nextSameDow(c.dayKey), endDay: shift(nextSameDow(c.dayKey), runSpan), start: cAllDay ? '18:00' : hm(c.startMin), end: cAllDay ? '21:00' : hm(c.endMin), allDay: cAllDay }
    : undefined
  return {
    title: ev.title,
    description: ev.description,
    timezone: ev.timezone,
    granularity: ev.granularity,
    durationMin: ev.durationMin,
    bestMode: ev.bestMode,
    budget: ev.budget,
    budgetMode: ev.budgetMode,
    capacity: ev.capacity?.toString(),
    image: ev.image,
    imageFit: ev.imageFit,
    imagePos: ev.imagePos,
    keepsake: ev.keepsake,
    startDate,
    endDate,
    excludedDows,
    windowStart: windowed && !bornFixed ? hm(gridStart) : undefined,
    windowEnd: windowed && !bornFixed ? hm(Math.min(gridEnd, 24 * 60)) : undefined,
    fixed,
    locMode,
    planMode: lockedVenue ? 'vote' : ev.location.planMode,
    picked: picked.map((p) => ({ id: p.id, name: p.name, place: p.place, lat: p.lat, lng: p.lng })),
    platform: ev.location.platform,
    meetingLink: ev.location.meetingLink,
    // guests come back by the email they were invited with; one who joined by the
    // link without leaving an email cannot be invited again. Accounts come back by id.
    emails: ev.participants.filter((p) => p.guest && p.email).map((p) => p.email!.toLowerCase()),
    accounts: ev.participants.filter((p) => !p.guest && !p.you && p.id !== myIdIn(ev)).map((p) => ({ id: p.id, name: p.name, color: p.color, email: p.email })),
  }
}

// have you answered this poll at all — marked a time, or declared no days work
export function youReplied(ev: AppEvent): boolean {
  const my = myIdIn(ev)
  if (ev.unavailableIds?.includes(my)) return true
  if (ev.availIv) return Object.values(ev.availIv).some((day) => (day[my] ?? []).length > 0)
  return Object.values(ev.avail).some((rows) => rows.some((cell) => cell.includes(my)))
}

// have you cast any location vote (a pick in a chat poll is not one)
export function youVoted(ev: AppEvent): boolean {
  const my = myIdIn(ev)
  return Object.values(placeVotes(ev.votes ?? {})).some((ids) => ids.includes(my))
}

// where a card click should land: whatever the event is still waiting on YOU for —
// your times first, then your vote, then the plan itself
export function eventTabFor(ev: AppEvent): string {
  const base = `/events/${ev.id}`
  const phase = phaseOf(ev)
  if (phase === 'past') return base
  if (phase !== 'planning') return `${base}?tab=details`
  if (ev.participants.some((p) => p.you)) {
    if (!youReplied(ev)) return `${base}?tab=availability`
    if (ev.location.mode === 'vote' && ev.location.places.length > 0 && !youVoted(ev)) return `${base}?tab=location`
  }
  return base
}

export function respondedCount(avail: Record<string, string[][]>, unavailableIds?: string[]): number {
  // declaring "none of these days work" is a reply too — an explicit empty one
  const ids = new Set<string>(unavailableIds ?? [])
  for (const rows of Object.values(avail)) for (const cell of rows) for (const id of cell) ids.add(id)
  return ids.size
}

/* ── a new face gets a colour nobody near them wears ──
   The palette cycles in a fixed order. A colour still unworn on the list is taken
   first; once every colour is in use, the least-worn one comes round again, from
   the front of the palette. Two people who would share initials or a name are kept
   apart above all else, so an "SR" beside another "SR" is never the same chip. A
   colour someone picked on their profile is theirs regardless (see restampMe). */
const GUEST_COLORS: PersonColor[] = ['coral', 'blue', 'amber', 'pink', 'green', 'gray', 'teal', 'purple']
export function pickColor(roster: Pick<Participant, 'color' | 'initials' | 'name'>[], who: { initials: string; name: string }): PersonColor {
  const worn = new Map<PersonColor, number>()
  const clash = new Set<PersonColor>()
  const ini = who.initials.toUpperCase(), nm = who.name.trim().toLowerCase()
  for (const p of roster) {
    worn.set(p.color, (worn.get(p.color) ?? 0) + 1)
    if (p.initials.toUpperCase() === ini || p.name.trim().toLowerCase() === nm) clash.add(p.color)
  }
  let best = GUEST_COLORS[0], bestScore = Infinity
  GUEST_COLORS.forEach((c, i) => {
    // a clash outranks everything, then how many already wear it, then palette order
    const score = (clash.has(c) ? 1e6 : 0) + (worn.get(c) ?? 0) * 1e3 + i
    if (score < bestScore) { best = c; bestScore = score }
  })
  return best
}

/* ── guests from emails ── */
function guestFromEmail(raw: string, roster: Participant[]): Participant {
  const email = raw.trim().toLowerCase() // the key everything later matches on
  const local = email.split('@')[0] || email
  const name = local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || email
  const initials = (name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2) || email[0] || 'G').toUpperCase()
  return { id: `g:${email}`, initials, name, color: pickColor(roster, { initials, name }), face: pickFace(roster, `g:${email}`), rsvp: 'pending', guest: true, email, inviteToken: linkToken(16), invitedAt: Date.now() }
}

/** Invite more people by email after the event exists: each new address becomes a
 *  guest with a personal link, the way the wizard makes them. Addresses already on
 *  the roster (as a guest's email, or an account's) are skipped. Returns the people
 *  actually added, so the caller can email exactly those. */
export function addEmailInvitees(id: string, emails: string[]): Participant[] {
  return addInvitees(id, emails.map((email) => ({ email })))
}

/** Is this address the signed-in account's own? Nobody invites themselves: the host
 *  is already on the roster, and a second entry under their email is the mismatch
 *  that later needs merging. */
export function isOwnEmail(email: string): boolean {
  const acc = currentAccount()
  return acc.signedIn && !!acc.email && acc.email.toLowerCase() === email.trim().toLowerCase()
}

/** Invite people after the event exists. An address that belongs to an account joins
 *  as that person, name and colour included, the way the wizard's invitees do; any
 *  other address becomes a guest with a personal link. The host's own address and
 *  anyone already on the roster are skipped. Returns the entries actually added. */
export function addInvitees(id: string, people: { email: string; account?: AccountInvitee }[]): Participant[] {
  const ev = getEvent(id)
  if (!ev) return []
  const known = new Set(ev.participants.map((p) => p.email?.toLowerCase()).filter(Boolean))
  const ids = new Set(ev.participants.map((p) => p.id))
  const roster = [...ev.participants]
  const added: Participant[] = []
  for (const { email: raw, account } of people) {
    const email = raw.trim().toLowerCase()
    if (!email || known.has(email) || isOwnEmail(email)) continue
    if (account && ids.has(account.id)) continue
    known.add(email)
    let next: Participant
    if (account) {
      const initials = initialsOf(account.name)
      next = { id: account.id, initials, name: account.name, color: account.colorChosen ? account.color : pickColor(roster, { initials, name: account.name }), face: pickFace(roster, account.id), rsvp: 'pending', email, invitedAt: Date.now() }
      ids.add(account.id)
    } else {
      next = guestFromEmail(email, roster)
    }
    roster.push(next)
    added.push(next)
  }
  if (added.length) patchEvent(id, { participants: roster })
  return added
}

/* ── one way to add a line to the discussion ──
   Messages leave the event document here: the local copy is updated for the UI,
   and the message goes to the cloud as its own row, so two people chatting at once
   append instead of overwriting each other. Demo events keep it local. */
export function appendMessage(eventId: string, msg: ChatMessage): ChatMessage {
  const full: ChatMessage = { ...msg, mid: msg.mid ?? crypto.randomUUID(), at: msg.at ?? Date.now() }
  const list = readAll()
  const i = list.findIndex((e) => e.id === eventId)
  if (i >= 0) {
    list[i] = { ...list[i], messages: [...list[i].messages, full] }
    writeAll(list)
    pushMessage(eventId, full)
  }
  return full
}

/* ── identity continuity: one participant becomes another id ──
   Used when an account takes over an entry that was made without one: the guest
   who joined by name, the email invitee, the stubbed host of an event created
   before signing in. Every reference in the document follows the id — marks,
   votes, messages, suggested places — so nothing they did is lost or orphaned. */
export function adoptParticipant(eventId: string, fromId: string, toId: string, as?: Partial<Participant>): void {
  const ev = getEvent(eventId)
  if (!ev || fromId === toId || ev.participants.some((p) => p.id === toId)) return
  const swap = (id: string) => (id === fromId ? toId : id)
  const availIv = ev.availIv
    ? Object.fromEntries(Object.entries(ev.availIv).map(([day, byPid]) => [day, Object.fromEntries(Object.entries(byPid).map(([pid, ivs]) => [swap(pid), ivs]))]))
    : ev.availIv
  const avail = Object.fromEntries(Object.entries(ev.avail).map(([day, rows]) => [day, rows.map((cell) => cell.map(swap))]))
  const votes = ev.votes ? Object.fromEntries(Object.entries(ev.votes).map(([place, ids]) => [place, ids.map(swap)])) : ev.votes
  patchEvent(eventId, {
    participants: ev.participants.map((p) => (p.id === fromId ? { ...p, ...as, id: toId, you: true, guest: undefined } : { ...p, you: undefined })),
    availIv, avail, votes,
    unavailableIds: ev.unavailableIds?.map(swap),
    messages: ev.messages.map((m) => (m.id === fromId ? { ...m, id: toId } : m)),
    location: { ...ev.location, places: ev.location.places.map((pl) => (pl.addedBy === fromId ? { ...pl, addedBy: toId } : pl)) },
  })
}

/* An event this browser hosts but nobody owns: created before signing in, so its
   host is the stub. Once a real account is here, the host becomes that account and
   the row gains a host_id — the "adopt" left open at the end of the step 5 doc. */
export function claimEvent(eventId: string): boolean {
  const ev = getEvent(eventId)
  const acc = currentAccount()
  if (!ev || ev.demo || !acc.signedIn || !ev.hostedByYou) return false
  const host = ev.participants.find((p) => p.host)
  if (!host || host.id === acc.id || UUID_RE.test(host.id)) return false
  // already on the list under your own id: you joined this event, you did not make it
  if (ev.participants.some((p) => p.id === acc.id)) return false
  adoptParticipant(eventId, host.id, acc.id, { name: acc.name, initials: initialsOf(acc.name), ...(acc.colorChosen ? { color: acc.color } : {}), ...(acc.face ? { face: acc.face } : {}) })
  patchEvent(eventId, { hostName: acc.name, hostKind: acc.kind })
  return true
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// a participant id minted by the backend for a real account, as opposed to the
// signed-out stub, a guest's g:name slug, or a demo's initials
export const isAccountId = (id: string) => UUID_RE.test(id)

/* ── guest sessions (share-link joins — a name is all it takes, no account) ──
   The join flow adds a participant and remembers, per event, that this browser acts
   as them. Everything else keeps working through the `you` markers: viewOf() moves
   them onto the guest at read time, and writers re-read raw storage so the remapped
   flags are never persisted — `you` in storage always means the stubbed account. */
const meKey = (eventId: string) => `hourelle.me.${eventId}`

export function guestSessionId(eventId: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(meKey(eventId)) } catch { return null }
}

/* ── discussion read marks: how many messages this browser has seen, per event ──
   Feeds the unread badge on the chat bubble. Per browser today; becomes per-person
   read state on the server once the backend exists. */
const seenKey = (eventId: string) => `hourelle.seen.${eventId}`

export function seenMessageCount(eventId: string): number {
  if (typeof window === 'undefined') return 0
  try { return Number(localStorage.getItem(seenKey(eventId)) ?? 0) || 0 } catch { return 0 }
}
export function markMessagesSeen(eventId: string, count: number): void {
  try { localStorage.setItem(seenKey(eventId), String(count)) } catch { /* private mode */ }
}

/* while this is set, the browser belongs to a guest: the event they joined is the
   whole app. The account surfaces (home, lists, create, alerts, profile) show a
   sign-in gate instead of their content, and the header shrinks to match. Holds
   the joined event id so every gate can lead back. */
const GUEST_MODE_KEY = 'hourelle.guest-mode'
export const GUEST_MODE_CHANGED = 'hourelle:guest-mode'

export function guestModeEventId(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(GUEST_MODE_KEY) } catch { return null }
}
function setGuestMode(eventId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (eventId) localStorage.setItem(GUEST_MODE_KEY, eventId)
    else localStorage.removeItem(GUEST_MODE_KEY)
  } catch { /* private mode */ }
  window.dispatchEvent(new Event(GUEST_MODE_CHANGED))
}

export function leaveGuestSession(eventId: string): void {
  try { localStorage.removeItem(meKey(eventId)) } catch { /* private mode */ }
  setGuestMode(null)
}

/** Was this browser's own entry taken off the event? True when the guest session's
 *  id or the account's is in removedIds and no longer on the roster, so someone
 *  removed and later invited again is not caught by it. */
export function removedFromEvent(ev: AppEvent): boolean {
  const removed = new Set(ev.removedIds ?? [])
  if (!removed.size) return false
  const acc = currentAccount()
  const mine = [guestSessionId(ev.id), acc.signedIn ? acc.id : null].filter((x): x is string => !!x)
  return mine.some((id) => removed.has(id) && !ev.participants.some((p) => p.id === id))
}
/** Forget an event this browser was removed from: its copy here and any guest session. */
export function forgetRemovedEvent(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id))
  if (guestSessionId(id)) leaveGuestSession(id)
}

// resume an existing guest entry instead of creating a new one — the caller must
// have proof it's really them (today: their email matches the entry's; later: the
// magic link). This is what keeps repeat joins from piling up work for the host.
export function claimGuestSession(eventId: string, pid: string): void {
  try { localStorage.setItem(meKey(eventId), pid) } catch { /* private mode */ }
  setGuestMode(eventId)
}

// how this browser sees an event: normally exactly as stored, but with a guest
// session the `you` markers move onto the guest and host powers switch off. Views
// are for rendering only — never write a view's participants or messages back.
export function viewOf(ev: AppEvent): AppEvent {
  return sinceArrival(markYou(ev))
}

/* Someone who joins later starts the chat at the moment they arrived, the way a group
   chat does: what was said before is the room's history, not theirs. The view keeps
   only lines at or after their arrival, so the chat, its unread count and anything
   else reading messages all agree, and an empty chat for a newcomer is simply empty
   rather than a history they are not shown. The host sees everything, and so does
   anyone with no arrival stamp who was already active (see arrivalOf). */
function sinceArrival(ev: AppEvent): AppEvent {
  const me = ev.participants.find((p) => p.you)
  if (ev.demo) return ev
  // nobody here is you: this device is not (or not yet) on the list. The moment
  // after joining, a sync can bring back a list from before your entry landed, and
  // with no arrival to measure from the whole history showed. Nothing shows until
  // you are on it. The host is always on it; a device with no backend keeps its
  // stored markers, so this only ever holds back someone who has not arrived.
  if (!me) return ev.hostedByYou ? ev : { ...ev, messages: [] }
  if (me.host) return ev
  const from = arrivalOf(ev, me)
  return from > 0 ? { ...ev, messages: ev.messages.filter((m) => (m.at ?? 0) >= from) } : ev
}

/** When this person's view of the chat begins: their stamp, or, before one exists,
 *  now for a newcomer and the very start for someone already active (a line in the
 *  chat or an answer on the grid), whose history was theirs all along. */
export function arrivalOf(ev: AppEvent, p: Participant): number {
  if (p.joinedAt) return p.joinedAt
  // back after being removed: a newcomer again, whatever they said the first time
  if ((ev.removedIds ?? []).includes(p.id)) return Date.now()
  // a line in the chat, not a poll's option or settings change, which says nothing aloud
  const spoke = ev.messages.some((m) => m.id === p.id && !isControlMessage(m))
  const answered = Object.values(availIvOf(ev)).some((byPid) => (byPid[p.id] ?? []).length > 0) || (ev.unavailableIds ?? []).includes(p.id)
  return spoke || answered ? 0 : Date.now()
}

function markYou(ev: AppEvent): AppEvent {
  const gid = guestSessionId(ev.id)
  if (gid && ev.participants.some((p) => p.id === gid)) {
    return {
      ...ev,
      hostedByYou: false,
      // pin the host icon before the flip: without this, events stored before hostKind
      // existed would show the host as an organization to every guest
      hostKind: ev.hostKind ?? (ev.hostedByYou ? 'person' : 'org'),
      participants: ev.participants.map((p) => ({ ...p, you: p.id === gid || undefined, host: p.host })),
      messages: ev.messages.map((m) => ({ ...m, you: m.id === gid })),
    }
  }

  // Signed in as a real account, the stored `you` marker cannot be trusted: events
  // made before signing in (and the demos) carry it on the stubbed person, and
  // following it would let you edit their availability and vote as them. You are
  // only "you" where a participant actually carries your account id.
  // a demo is a finished plan to walk through, not to change: nobody is "you" in
  // it and nobody hosts it, so every control that writes stays hidden
  if (ev.demo) {
    return {
      ...ev,
      hostedByYou: false,
      participants: ev.participants.map((p) => (p.you ? { ...p, you: undefined } : p)),
      messages: ev.messages.map((m) => (m.you ? { ...m, you: false } : m)),
    }
  }
  const acc = currentAccount()
  if (!acc.signedIn) return ev // the stub keeps the stored markers
  // `hostedByYou` was written by whichever browser created the event; once documents
  // travel between accounts it has to be read off the roster instead. An owner with
  // a real account id is the host only in their own browser; the stub host of an
  // ownerless event keeps the stored flag (claimEvent turns that into ownership).
  const host = ev.participants.find((p) => p.host)
  const hostIsAccount = !!host && UUID_RE.test(host.id)
  const hostedByYou = hostIsAccount ? host!.id === acc.id : ev.hostedByYou
  // `you` is the account's own entry and nothing else. A document that travelled
  // through the cloud still carries the marker its author's browser put on the host,
  // and the first `you` on the list is who the grid, the vote and the chat write as —
  // so every other marker is cleared, not just the ones on a list you are missing from.
  const mine = (id: string) => id === acc.id
  return {
    ...ev,
    hostedByYou,
    participants: ev.participants.map((p) => (p.you === (mine(p.id) || undefined) ? p : { ...p, you: mine(p.id) || undefined })),
    messages: ev.messages.map((m) => (m.you === mine(m.id) ? m : { ...m, you: mine(m.id) })),
  }
}

/* Put the signed-in account on an event's list. The way out of "you are looking at
   this event but nobody here is you" — one tap instead of a dead end. */
/* The first time someone on the list opens the event, the room is told, the same
   "joined the event" a guest gets on joining by name. An invitee is on the list from
   the moment they are invited (by email or as an account), so opening their link or
   the event claims an entry that already exists, and nothing used to say they had
   arrived. Called by the event page for whoever is viewing: it stamps joinedAt once,
   and speaks only for a genuine first arrival: no line from them in the chat yet and
   no answer of theirs on the grid, so people who were already active before this
   existed are marked as arrived without a late announcement. The host never is. */
export function markArrived(id: string, pid: string): boolean {
  const ev = getEvent(id)
  const p = ev?.participants.find((x) => x.id === pid)
  if (!ev || ev.demo || !p || p.host || p.joinedAt) return false
  // someone already active keeps the whole history: they arrived before stamps did
  const newcomer = arrivalOf(ev, p) > 0
  const at = newcomer ? Date.now() : ev.createdAt || 1
  patchEvent(id, { participants: ev.participants.map((x) => (x.id === pid ? { ...x, joinedAt: at } : x)) })
  if (newcomer) appendMessage(id, { id: pid, name: p.name, time: 'now', text: 'joined the plan', you: false, system: true, at: Date.now() })
  return newcomer
}

export function addMeToEvent(id: string): Participant | null {
  const ev = getEvent(id)
  const acc = currentAccount()
  if (!ev || ev.demo || ev.participants.some((p) => p.id === acc.id)) return null
  const initials = initialsOf(acc.name)
  const me: Participant = {
    id: acc.id,
    initials,
    name: acc.name,
    // a colour you picked is yours; a dealt one gives way to whatever stands apart here
    color: acc.colorChosen ? acc.color : pickColor(ev.participants, { initials, name: acc.name }),
    // the same for the face: the account's own, or one that stands apart here
    face: acc.face ?? pickFace(ev.participants, acc.id),
    rsvp: 'pending',
    you: true,
  }
  patchEvent(id, { participants: [...ev.participants, me] })
  return me
}

// A guest joins under a device-local id: no account, nothing minted on the server.
// Their claim to the entry is this browser (hourelle.me.<eventId>) and, if they gave
// one, their email — proven by magic link when they return on another device.
export function joinEvent(id: string, name: string, email?: string, face?: Face): Participant | null {
  const ev = getEvent(id)
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!ev || !clean) return null
  const initials = (clean.split(' ').map((w) => w[0]).join('').slice(0, 2) || 'G').toUpperCase()
  // an existing name is never claimable from here — a repeat name joins as a new
  // participant (g:sam-2), which blocks impersonation by construction. Reclaiming an
  // identity across devices is what the email/magic-link layer is for (see roadmap).
  const base = `g:${slugify(clean)}`
  let pid = base
  for (let n = 2; ev.participants.some((p) => p.id === pid); n++) pid = `${base}-${n}`
  const cleanEmail = email?.trim().toLowerCase()
  // an email comes with a personal link, the same kind an invited guest gets: it is
  // mailed to them once, and opening it on any device lands them back as themselves
  const guest: Participant = {
    id: pid, initials, name: clean, color: pickColor(ev.participants, { initials, name: clean }),
    // the face they picked on the join page, or one dealt to stand apart
    face: face ?? pickFace(ev.participants, pid),
    rsvp: 'pending', guest: true, joinedAt: Date.now(),
    ...(cleanEmail ? { email: cleanEmail, inviteToken: linkToken(16) } : {}),
  }
  if (ev.demo) {
    // a demo only lives in code, and patchEvent skips ids it can't find — materialize
    // a live copy first so the guest's marks persist. Same id: the stored copy wins
    // on every read and the built-in steps aside.
    const live = { ...ev, demo: undefined, participants: [...ev.participants, guest] }
    writeAll([...readAll(), live])
    pushNewEvent(live)
  } else {
    patchEvent(id, { participants: [...ev.participants, guest] })
  }
  try { localStorage.setItem(meKey(id), pid) } catch { /* private mode */ }
  setGuestMode(id)
  // visibility over gates: everyone in the chat sees who arrived
  appendMessage(id, { id: pid, name: clean, time: 'now', text: 'joined the plan', you: false, system: true })
  return guest
}

// the participant a personal invite link points at, if the token is real
export function participantByInvite(ev: AppEvent, token: string): Participant | undefined {
  return token ? ev.participants.find((p) => p.inviteToken === token) : undefined
}

/* ── create ── */
export function createEvent(input: CreateInput): AppEvent {
  const id = uniqueSlug(slugify(input.title))

  const host = currentAccount()
  // the list is built one person at a time so each colour is picked against
  // everyone already on it
  const participants: Participant[] = [
    // the host's face is the one their account shows everywhere else
    { id: host.id, initials: initialsOf(host.name), name: host.name, color: host.color, face: host.face ?? defaultFace(initialsOf(host.name), host.color), rsvp: 'attending', you: true, host: true },
  ]
  for (const a of input.accounts) {
    const initials = initialsOf(a.name)
    participants.push({ id: a.id, initials, name: a.name, color: a.colorChosen ? a.color : pickColor(participants, { initials, name: a.name }), face: pickFace(participants, a.id), rsvp: 'pending' as Rsvp, ...(a.email ? { email: a.email } : {}) })
  }
  for (const email of input.emails) participants.push(guestFromEmail(email, participants))

  // the date is already set: the time is a fact from birth. If the place is answered
  // too the event is born confirmed and goes straight to the RSVP round; with a live
  // ballot it stays in planning until the place is locked.
  const fxEnd = input.fixed?.endDay && input.fixed.endDay > input.fixed.day ? input.fixed.endDay : input.fixed?.day
  const fxRun = !!input.fixed && fxEnd !== input.fixed.day
  const fxAllDay = !!input.fixed?.allDay
  const fxS = input.fixed ? (fxAllDay ? 0 : parseHM(input.fixed.start)) : null
  const fxE = input.fixed ? (fxAllDay ? 24 * 60 : parseHM(input.fixed.end)) : null
  // on one day the end has to come after the start; across days it always does
  const fixed = input.fixed && fxS !== null && fxE !== null && (fxRun || fxE > fxS)
    ? { day: input.fixed.day, endDay: fxEnd ?? input.fixed.day, s: fxS, e: fxE, whole: fxAllDay || fxRun }
    : null

  // a timed day carries clock times, so it can't be a day poll: coerce to 30 min. A run
  // of days, timed or not, is a day poll's grid: the question it leaves is who is
  // there on which day, and the times at its two ends live on the slot.
  const gran: AppEvent['granularity'] = fixed?.whole ? 'day'
    : input.granularity === '15' || input.granularity === '60' ? input.granularity
      : input.granularity === 'day' && !fixed ? 'day'
        : '30'

  // an explicit day list (weekends only, hand-picked dates) beats the plain range
  const dayCap = maxPollDays(gran, fixed ? fixed.day : input.startDate)
  const sparseList = !fixed && input.pickedDays?.length ? buildDaysFrom(input.pickedDays, dayCap) : null
  const sparse = sparseList?.length ? sparseList : null
  const days = sparse ?? buildDays(fixed ? fixed.day : input.startDate, fixed ? fixed.endDay : input.endDate, dayCap)
  // optional daily time window, snapped outward to the slot size so it fully covers the ask;
  // no window = the whole day. A fixed date windows the grid around the chosen slot.
  const st = stepOf(gran)
  const winS = fixed ? (fixed.whole ? null : fixed.s) : parseHM(input.windowStart), winE = fixed ? (fixed.whole ? null : fixed.e) : parseHM(input.windowEnd)
  const hasWin = winS !== null && winE !== null && winE > winS
  const fromMin = hasWin ? Math.floor(winS / st) * st : 0
  const toMin = hasWin ? Math.min(24 * 60, Math.ceil(winE / st) * st) : 24 * 60
  const times = buildTimes(gran, fromMin, toMin)
  const avail: Record<string, string[][]> = {}
  for (const d of days) avail[d.key] = times.map(() => [])

  // itinerary picks are an ordered stop list (a venue may repeat); the candidate list is the unique set
  const isItin = input.planMode === 'itinerary'
  const pickedPlaces = input.picked.map((p) => ({ id: p.id, name: p.name, place: p.place, addedBy: host.id }))
  const uniquePlaces = pickedPlaces.filter((p, i) => pickedPlaces.findIndex((x) => x.id === p.id) === i)
  const settled = input.locMode === 'set'
  // a fixed date locks the place(s) too, when they're known
  const fixedPlaceIds = settled ? uniquePlaces.map((p) => p.id) : isItin ? input.picked.map((p) => p.id) : []
  // a live ballot means the place question is still open: even with a fixed date the
  // event is born planning (time as fact), and only locks once the place is chosen
  const placeOpen = input.locMode === 'vote' && !isItin

  const ev: AppEvent = {
    id,
    title: input.title.trim() || 'Untitled plan',
    hostName: host.name,
    hostedByYou: true,
    hostKind: host.kind,
    description: input.description.trim(),
    timezone: input.timezone || 'UTC', // wizard validation requires one; fallback for safety
    startDate: fixed ? fixed.day : sparse ? days[0].key : input.startDate,
    endDate: fixed ? fixed.endDay : sparse ? days[days.length - 1].key : input.endDate,
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
    itinStartMin: hasWin ? (winS as number) : fixed && !fxAllDay ? fixed.s : 9 * 60,
    durationMin: fixed?.whole ? 24 * 60 : fixed ? fixed.e - fixed.s : input.durationMin && input.durationMin >= 1 ? Math.min(24 * 60, input.durationMin) : 60,
    bestMode: input.bestMode,
    capacity: input.capacity && Number(input.capacity) >= 1 ? Number(input.capacity) : undefined,
    ...(input.image ? { image: input.image, imageFit: input.imageFit, imagePos: input.imagePos } : {}),
    ...(input.keepsake ? { keepsake: input.keepsake } : {}),
    messages: [],
    createdAt: Date.now(),
    status: fixed && !placeOpen ? 'confirmed' : 'planning',
    ...(fixed ? {
      confirmed: { dayKey: fixed.day, ...(fixed.endDay !== fixed.day ? { endDayKey: fixed.endDay } : {}), startMin: fixed.s, endMin: fixed.e, placeIds: fixedPlaceIds },
      ...(placeOpen ? {} : { confirmedAt: Date.now() }),
      // the deadline rides along even while a ballot keeps the event planning — it
      // starts mattering the moment the place locks
      ...(input.rsvpDeadline ? { rsvpDeadline: input.rsvpDeadline } : {}),
    } : {}),
  }

  const list = readAll()
  list.push(ev)
  writeAll(list)
  pushNewEvent(ev) // background sync; no-op without a backend
  return ev
}

/* ── the built-in populated demo (reachable by URL, not listed) ── */
const DEMO: AppEvent = {
  id: 'q3-offsite',
  title: 'Q3 Team Offsite',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'A day out of the office for the whole team. Workshops in the morning, then lunch on the grass at Tunnel Tops. Travel is reimbursed for anyone coming from out of town.',
  timezone: 'America/Los_Angeles',
  startDate: '2029-08-20',
  endDate: '2029-08-24',
  granularity: '60',
  budget: '4200',
  planDeadline: '2029-08-16',
  image: 'preset:coast',
  location: {
    mode: 'vote',
    // the offsite runs as a route, not a single room — the demo that shows the
    // itinerary builder off: three stops in order, each with its own dwell time
    planMode: 'itinerary',
    places: [
      { id: 'cavallo', name: 'Cavallo Point Lodge', place: 'Sausalito, CA', addedBy: 'SR', lat: 37.8339, lng: -122.478 },
      { id: 'tunnel-tops', name: 'Presidio Tunnel Tops', place: 'San Francisco, CA', addedBy: 'JM', lat: 37.8027, lng: -122.4566 },
      { id: 'presidio', name: 'Presidio Officers’ Club', place: 'San Francisco, CA', addedBy: 'DW', lat: 37.7986, lng: -122.4589 },
    ],
    platform: 'Google Meet',
    meetingLink: '',
    guestsCanSuggest: true, // the demo host opened suggestions up
  },
  votes: {
    cavallo: ['SR', 'KL', 'PR', 'MN', 'CL'],
    'tunnel-tops': ['AT', 'JM'],
    presidio: ['DW'],
  },
  maxVotes: 2,
  durationMin: 120,
  itinStartMin: 9 * 60,
  // morning workshops in Sausalito, a picnic lunch on the Tunnel Tops lawn, the
  // wrap-up at the Officers' Club — stop order follows the route, dwell minutes align by index
  itinStops: ['cavallo', 'tunnel-tops', 'presidio'],
  itinDwell: [180, 120, 90],
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
  { id: 'bandshell', name: 'Golden Gate Park Bandshell', place: 'San Francisco, CA', addedBy: 'JM', lat: 37.7702, lng: -122.4669 },
  { id: 'dolores', name: 'Dolores Park', place: 'San Francisco, CA', addedBy: 'AT', lat: 37.7596, lng: -122.4269 },
  { id: 'presidio-picnic', name: 'Presidio Picnic Grounds', place: 'San Francisco, CA', addedBy: 'SR', lat: 37.8007, lng: -122.4569 },
  { id: 'fort-mason', name: 'Fort Mason Center', place: 'San Francisco, CA', addedBy: 'JM', lat: 37.8065, lng: -122.4318 },
  { id: 'crissy', name: 'Crissy Field East Beach', place: 'San Francisco, CA', addedBy: 'DW', lat: 37.8047, lng: -122.457 },
  { id: 'lands-end', name: 'Lands End Lookout', place: 'San Francisco, CA', addedBy: 'KL', lat: 37.7804, lng: -122.5115 },
  { id: 'ocean-firepits', name: 'Ocean Beach Firepits', place: 'San Francisco, CA', addedBy: 'MT', lat: 37.7595, lng: -122.5107 },
  { id: 'stern-grove', name: 'Stern Grove', place: 'San Francisco, CA', addedBy: 'ZC', lat: 37.7362, lng: -122.4771 },
  { id: 'alamo', name: 'Alamo Square', place: 'San Francisco, CA', addedBy: 'RP', lat: 37.7764, lng: -122.4346 },
  { id: 'mission-rock', name: 'Mission Rock Terrace', place: 'San Francisco, CA', addedBy: 'IC', lat: 37.7717, lng: -122.3874 },
  { id: 'treasure', name: 'Treasure Island Winery', place: 'San Francisco, CA', addedBy: 'FW', lat: 37.8235, lng: -122.3712 },
  { id: 'berkeley-marina', name: 'Berkeley Marina', place: 'Berkeley, CA', addedBy: 'OD', lat: 37.8654, lng: -122.3149 },
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
const BIG_DAYS = buildDays('2029-09-10', '2029-09-21') // two work weeks, Monday in and Friday out
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
  const day = '2029-09-20'
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
  id: 'harvest-potluck',
  title: 'Harvest Potluck',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'Open to anyone nearby. Bring a dish that feeds six and a blanket to sit on. Twelve parks on the ballot and three votes each.',
  timezone: 'America/Los_Angeles',
  startDate: '2029-09-10',
  endDate: '2029-09-21',
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
  voteDeadline: '2029-09-06',
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
    { id: 'AT', name: 'Alex Turner', time: 'Tue', text: 'Three votes each, spend them wisely', you: false },
    { id: 'ZC', name: 'Zoe Clark', time: 'Tue', text: 'Bandshell has outlets if anyone brings a slow cooker', you: false },
    { id: 'UR', name: 'Uma Reddy', time: 'Wed', text: 'Signing up for dessert so nobody else has to', you: false },
    { id: 'OD', name: 'Omar Diaz', time: 'Wed', text: 'Berkeley Marina if you want wind in the salad, which you do not', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
}

/* ── invited demos: plans someone else is hosting, so the shelf shows the guest's side.
   Both land on the same Saturday on purpose — the same-day flag needs something to show. ── */

// Conference: locked in, one room all day, and people who come late or leave early
// (grid minutes from 9 AM, times[0])
const CONF_DAYS = buildDays('2029-08-18', '2029-08-18')
const CONF_TIMES = buildTimes('60', 9 * 60, 17 * 60)
const CONF_ALL: Iv[] = [{ s: 0, e: 480 }]
const CONF_IV: AvailIntervals = {
  '2029-08-18': {
    LM: CONF_ALL, JM: CONF_ALL, SR: CONF_ALL, IO: CONF_ALL, DW: CONF_ALL,
    HS: [{ s: 120, e: 480 }], SK: [{ s: 60, e: 480 }], YA: [{ s: 0, e: 300 }],
    KL: [{ s: 0, e: 360 }], CL: [{ s: 180, e: 480 }],
  },
}
const CONFERENCE: AppEvent = {
  id: 'indie-makers-conference',
  title: 'Indie Makers Conference',
  hostName: 'Lucía M',
  hostedByYou: false,
  hostKind: 'person',
  description: 'One day of short talks from people who run small studios. Lunch is provided. Come for part of the day if that is what works.',
  timezone: 'America/Los_Angeles',
  startDate: '2029-08-18',
  endDate: '2029-08-18',
  granularity: '60',
  budget: '',
  location: {
    mode: 'set',
    planMode: 'vote',
    places: [{ id: 'fort-mason-pavilion', name: 'Festival Pavilion, Fort Mason Center', place: 'San Francisco, CA', addedBy: 'LM', lat: 37.8058, lng: -122.4318 }],
    platform: '',
    meetingLink: '',
  },
  votes: {},
  participants: [
    { id: 'LM', initials: 'LM', name: av('LM').name, color: av('LM').color, rsvp: 'attending', host: true },
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true },
    { id: 'SR', initials: 'SR', name: av('SR').name, color: av('SR').color, rsvp: 'attending' },
    { id: 'IO', initials: 'IO', name: av('IO').name, color: av('IO').color, rsvp: 'attending' },
    { id: 'DW', initials: 'DW', name: av('DW').name, color: av('DW').color, rsvp: 'attending' },
    { id: 'HS', initials: 'HS', name: av('HS').name, color: av('HS').color, rsvp: 'attending' },
    { id: 'SK', initials: 'SK', name: av('SK').name, color: av('SK').color, rsvp: 'attending' },
    { id: 'YA', initials: 'YA', name: av('YA').name, color: av('YA').color, rsvp: 'attending' },
    { id: 'KL', initials: 'KL', name: av('KL').name, color: av('KL').color, rsvp: 'attending' },
    { id: 'CL', initials: 'CL', name: av('CL').name, color: av('CL').color, rsvp: 'maybe' },
    { id: 'BH', initials: 'BH', name: av('BH').name, color: av('BH').color, rsvp: 'not_going' },
    { id: 'NK', initials: 'NK', name: av('NK').name, color: av('NK').color, rsvp: 'pending' },
  ],
  days: CONF_DAYS,
  times: CONF_TIMES,
  avail: intervalsToGrid(CONF_IV, CONF_DAYS, CONF_TIMES.length, 60),
  availIv: CONF_IV,
  durationMin: 480,
  image: 'preset:city',
  messages: [
    { id: 'LM', name: 'Lucía M', time: 'Mon', text: 'Doors open at 8:30 and the first talk starts at 9', you: false },
    { id: 'HS', name: 'Hiro S', time: 'Tue', text: 'My flight lands at 10, so I will be there from 11', you: false },
    { id: 'YA', name: 'Yasmin A', time: 'Tue', text: 'Leaving after lunch. A seat near the door would be kind', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'confirmed',
  confirmed: { dayKey: '2029-08-18', startMin: 9 * 60, endMin: 17 * 60, placeIds: ['fort-mason-pavilion'] },
}

// Game night: date and place fixed from the start, so it goes straight to RSVPs,
// due by a deadline. You have not answered yet.
const GAME_DAYS = buildDays('2029-08-18', '2029-08-18')
const GAME_TIMES = buildTimes('30', 19 * 60, 22 * 60 + 30)
const GAME_IV: AvailIntervals = {
  '2029-08-18': { RW: [{ s: 0, e: 210 }], TC: [{ s: 0, e: 210 }], GH: [{ s: 30, e: 210 }], EM: [{ s: 0, e: 150 }] },
}
const GAME_NIGHT: AppEvent = {
  id: 'board-game-night',
  title: 'Board Game Night',
  hostName: 'Riley W',
  hostedByYou: false,
  hostKind: 'person',
  description: 'Third Saturday of the month at Victory Point. Bring a game or just show up, the shelves are full.',
  timezone: 'America/Los_Angeles',
  startDate: '2029-08-18',
  endDate: '2029-08-18',
  granularity: '30',
  budget: '',
  location: {
    mode: 'set',
    planMode: 'vote',
    places: [{ id: 'victory-point', name: 'Victory Point Cafe', place: 'Berkeley, CA', addedBy: 'RW', lat: 37.8665, lng: -122.2923 }],
    platform: '',
    meetingLink: '',
  },
  votes: {},
  participants: [
    { id: 'RW', initials: 'RW', name: av('RW').name, color: av('RW').color, rsvp: 'attending', host: true },
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'pending', you: true },
    { id: 'TC', initials: 'TC', name: av('TC').name, color: av('TC').color, rsvp: 'attending' },
    { id: 'GH', initials: 'GH', name: av('GH').name, color: av('GH').color, rsvp: 'attending' },
    { id: 'EM', initials: 'EM', name: av('EM').name, color: av('EM').color, rsvp: 'attending' },
    { id: 'NK', initials: 'NK', name: av('NK').name, color: av('NK').color, rsvp: 'maybe' },
    { id: 'DV', initials: 'DV', name: av('DV').name, color: av('DV').color, rsvp: 'not_going' },
    { id: 'OB', initials: 'OB', name: av('OB').name, color: av('OB').color, rsvp: 'pending' },
  ],
  days: GAME_DAYS,
  times: GAME_TIMES,
  avail: intervalsToGrid(GAME_IV, GAME_DAYS, GAME_TIMES.length, 30),
  availIv: GAME_IV,
  durationMin: 210,
  image: 'preset:evening',
  messages: [
    { id: 'RW', name: 'Riley W', time: 'Mon', text: 'Table is booked for eight. Tell me by Wednesday if you are in', you: false },
    { id: 'TC', name: 'Tom C', time: 'Mon', text: 'Bringing Wingspan unless someone objects', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'confirmed',
  confirmed: { dayKey: '2029-08-18', startMin: 19 * 60, endMin: 22 * 60 + 30, placeIds: ['victory-point'] },
  rsvpDeadline: '2029-08-15',
}

/* ── the planning shapes. Every plan answers two questions, when and where, and
   each can arrive open or already answered:
   1. both open        → Design Team Dinner   (find a time, vote on a place)
   2. place answered   → Coffee with Ifeoma   (café set, finding the morning)
   3. time answered    → Priya's Birthday     (Friday is booked, voting the venue —
                          status stays 'planning' while the confirmed slot is a fact)
   4. both answered    → Board Game Night     (born confirmed, straight to RSVPs, above) ── */

// 1 · both questions open
const DINNER_DAYS = buildDays('2029-07-30', '2029-08-05')
const DINNER_TIMES = buildTimes('30', 17 * 60, 22 * 60)
const DINNER_IV: AvailIntervals = {
  '2029-08-01': { JM: [{ s: 60, e: 300 }], AT: [{ s: 0, e: 240 }], SR: [{ s: 120, e: 300 }] },
  '2029-08-02': { JM: [{ s: 0, e: 300 }], AT: [{ s: 60, e: 300 }] },
  '2029-08-03': { SR: [{ s: 0, e: 180 }] },
}
const DESIGN_DINNER: AppEvent = {
  id: 'design-team-dinner',
  title: 'Design Team Dinner',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'End of quarter dinner for the design crew. Mark the evenings you can do and vote on where we eat.',
  timezone: 'America/Los_Angeles',
  startDate: '2029-07-30',
  endDate: '2029-08-05',
  granularity: '30',
  budget: '450',
  budgetMode: 'total',
  planDeadline: '2029-07-29',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: [
      { id: 'luna', name: 'Luna Trattoria', place: 'San Francisco, CA', addedBy: 'AT', lat: 37.7987, lng: -122.4078 },
      { id: 'golden-lotus', name: 'Golden Lotus', place: 'San Francisco, CA', addedBy: 'JM', lat: 37.7941, lng: -122.4078 },
      { id: 'fable-fern', name: 'Fable & Fern', place: 'San Francisco, CA', addedBy: 'SR', lat: 37.7648, lng: -122.4225 },
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

// 2 · place answered, time open: a 1:1 on a 15-minute grid (minutes from 8 AM)
const COFFEE_DAYS = buildDays('2029-08-06', '2029-08-10')
const COFFEE_TIMES = buildTimes('15', 8 * 60, 11 * 60)
const COFFEE_IV: AvailIntervals = {
  '2029-08-06': { JM: [{ s: 60, e: 120 }] },
  '2029-08-07': { JM: [{ s: 0, e: 90 }], IO: [{ s: 30, e: 90 }] },
  '2029-08-08': { IO: [{ s: 0, e: 60 }] },
  '2029-08-09': { JM: [{ s: 45, e: 180 }], IO: [{ s: 105, e: 180 }] },
}
const COFFEE: AppEvent = {
  id: 'coffee-catch-up',
  title: 'Coffee with Ifeoma',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'A catch-up before work. The café is picked, we only need a morning that works.',
  timezone: 'America/Los_Angeles',
  startDate: '2029-08-06',
  endDate: '2029-08-10',
  granularity: '15',
  budget: '',
  location: {
    mode: 'set',
    planMode: 'vote',
    places: [{ id: 'mint-plaza', name: 'Blue Bottle Coffee, Mint Plaza', place: 'San Francisco, CA', addedBy: 'JM', lat: 37.7825, lng: -122.4079 }],
    platform: '',
    meetingLink: '',
  },
  votes: {},
  participants: [
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true, host: true },
    { id: 'IO', initials: 'IO', name: av('IO').name, color: av('IO').color, rsvp: 'attending' },
  ],
  days: COFFEE_DAYS,
  times: COFFEE_TIMES,
  avail: intervalsToGrid(COFFEE_IV, COFFEE_DAYS, COFFEE_TIMES.length, 15),
  availIv: COFFEE_IV,
  durationMin: 30,
  image: 'preset:garden',
  messages: [
    { id: 'IO', name: 'Ifeoma O', time: 'Sun', text: 'Tuesday early is best for me, I have standup at 9:30', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
}

// 3 · time answered, place open: the slot is a fact on a status:'planning' event,
// so the place ballot stays live and the lock-in only asks for the venue
const BIRTHDAY_DAYS = buildDays('2029-08-03', '2029-08-03')
const BIRTHDAY_TIMES = buildTimes('30', 19 * 60, 22 * 60)
const BIRTHDAY_IV: AvailIntervals = {
  '2029-08-03': {
    JM: [{ s: 0, e: 180 }], PR: [{ s: 0, e: 180 }], AT: [{ s: 0, e: 180 }],
    MN: [{ s: 60, e: 180 }], EM: [{ s: 0, e: 120 }],
  },
}
const BIRTHDAY: AppEvent = {
  id: 'priyas-birthday',
  title: 'Priya’s Birthday',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'Friday night is booked for Priya’s birthday. Vote on the restaurant so we can reserve a table.',
  timezone: 'America/Los_Angeles',
  startDate: '2029-08-03',
  endDate: '2029-08-03',
  granularity: '30',
  budget: '',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: [
      { id: 'trestle', name: 'Trestle', place: 'San Francisco, CA', addedBy: 'JM', lat: 37.7973, lng: -122.4074 },
      { id: 'zuni', name: 'Zuni Café', place: 'San Francisco, CA', addedBy: 'EM', lat: 37.7738, lng: -122.4218 },
      { id: 'copita', name: 'Copita', place: 'Sausalito, CA', addedBy: 'AT', lat: 37.8592, lng: -122.4854 },
    ],
    platform: '',
    meetingLink: '',
    guestsCanSuggest: true,
  },
  votes: { trestle: ['JM', 'MN'], zuni: ['EM', 'KL'], copita: ['AT'] },
  maxVotes: 1,
  voteDeadline: '2029-07-30',
  participants: [
    { id: 'JM', initials: 'JM', name: 'Jordan Miller', color: 'purple', rsvp: 'attending', you: true, host: true },
    { id: 'PR', initials: 'PR', name: av('PR').name, color: av('PR').color, rsvp: 'attending' },
    { id: 'AT', initials: 'AT', name: av('AT').name, color: av('AT').color, rsvp: 'attending' },
    { id: 'KL', initials: 'KL', name: av('KL').name, color: av('KL').color, rsvp: 'attending' },
    { id: 'MN', initials: 'MN', name: av('MN').name, color: av('MN').color, rsvp: 'attending' },
    { id: 'EM', initials: 'EM', name: av('EM').name, color: av('EM').color, rsvp: 'attending' },
    { id: 'BH', initials: 'BH', name: av('BH').name, color: av('BH').color, rsvp: 'pending' },
  ],
  days: BIRTHDAY_DAYS,
  times: BIRTHDAY_TIMES,
  avail: intervalsToGrid(BIRTHDAY_IV, BIRTHDAY_DAYS, BIRTHDAY_TIMES.length, 30),
  availIv: BIRTHDAY_IV,
  durationMin: 180,
  image: 'preset:party',
  messages: [
    { id: 'PR', name: 'Priya R', time: 'Tue', text: 'I get a vote on my own birthday, right', you: false },
    { id: 'AT', name: 'Alex T', time: 'Tue', text: 'Copita is worth the bridge, hear me out', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
  confirmed: { dayKey: '2029-08-03', startMin: 19 * 60, endMin: 22 * 60, placeIds: [] },
}

/* ── the day-poll demo: a trip asks which days, weekends only, best-run answer ── */
const CABIN_DAYS = buildDaysFrom([
  '2029-08-31', '2029-09-01', '2029-09-02',
  '2029-09-07', '2029-09-08', '2029-09-09',
  '2029-09-14', '2029-09-15', '2029-09-16',
])
const CABIN_FULL: Iv[] = [{ s: 0, e: 24 * 60 }]
const CABIN_IV: AvailIntervals = {
  '2029-08-31': { JM: CABIN_FULL, AT: CABIN_FULL, SR: CABIN_FULL, MN: CABIN_FULL },
  '2029-09-01': { JM: CABIN_FULL, AT: CABIN_FULL, SR: CABIN_FULL, MN: CABIN_FULL, KL: CABIN_FULL },
  '2029-09-02': { JM: CABIN_FULL, AT: CABIN_FULL, SR: CABIN_FULL, KL: CABIN_FULL },
  '2029-09-07': { JM: CABIN_FULL, KL: CABIN_FULL },
  '2029-09-08': { JM: CABIN_FULL, MN: CABIN_FULL, KL: CABIN_FULL },
  '2029-09-15': { AT: CABIN_FULL, SR: CABIN_FULL },
}
const CABIN_TRIP: AppEvent = {
  id: 'cabin-trip',
  title: 'Cabin Trip',
  hostName: 'Jordan Miller',
  hostedByYou: true,
  hostKind: 'person',
  description: 'Three weekends on the table and one cabin at the end. Tap the days you could go.',
  timezone: 'America/Los_Angeles',
  startDate: '2029-08-31',
  endDate: '2029-09-16',
  granularity: 'day',
  budget: '900',
  budgetMode: 'person',
  location: {
    mode: 'vote',
    planMode: 'vote',
    places: [
      { id: 'tahoe-cabin', name: 'Donner Lake Cabin', place: 'Truckee, CA', addedBy: 'JM', lat: 39.3236, lng: -120.2542 },
      { id: 'sea-ranch', name: 'Sea Ranch House', place: 'Sea Ranch, CA', addedBy: 'SR', lat: 38.715, lng: -123.43 },
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
  image: 'preset:meadow',
  messages: [
    { id: 'SR', name: 'Sarah R', time: 'Wed', text: 'First September weekend looks strong so far', you: false },
    { id: 'KL', name: 'Kyle L', time: 'Wed', text: 'I can do any of them except the 15th', you: false },
  ],
  createdAt: 0,
  demo: true,
  status: 'planning',
}

// every built-in demo, one per template, in the templates' order
const DEMOS: AppEvent[] = [DESIGN_DINNER, GAME_NIGHT, BIRTHDAY, BIG_DEMO, CABIN_TRIP, DEMO, COFFEE, CONFERENCE]

// demos that were retired or renamed, and the one that took each one's place, so an
// old link still opens a plan rather than "Plan not found"
const DEMO_ALIASES: Record<string, string> = {
  'harvest-fair': 'harvest-potluck',
  'trivia-night-anchor': 'board-game-night',
  'sarahs-housewarming': 'board-game-night',
  'brunch-at-mamas': 'coffee-catch-up',
  'priyas-send-off': 'priyas-birthday',
  'shoreline-cleanup': 'indie-makers-conference',
}
