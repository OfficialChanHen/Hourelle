import type { ChatMessage } from './sample'

/* ── a poll in the chat ──
   "Which game?" has nowhere to go on the place ballot, so it goes in the chat.

   Everything about a poll travels as chat messages, because a message is an append
   that can never clobber anyone, while the event document is saved whole by whoever
   writes last. Three kinds of line:

     [poll]{"id","q","o":[{id,t}],"s":{n,add,hide,close?}}   the poll itself, shown as a card
     [poll+]{"p":pollId,"id":optionId,"t":text}             someone adds an option
     [poll~]{"p":pollId,"s":{n,add,hide,close?}}            the creator or the host changes its settings

   The last two are control lines: never drawn in the chat, never counted as unread,
   never heard or announced. reducePolls folds them into each poll's current state.
   Two people adding an option at the same moment are two appends, so both land.

   The picks live in `event.votes` under keys of their own, `poll:<poll id>:<option id>`,
   so each person's pick is their own row in the votes table, the same as a vote for a
   place. Everything that reads `event.votes` as the place ballot has to leave these
   keys out (placeVotes). */

export type PollOption = { id: string; t: string; by?: string } // by: who added it, for options added after posting
export type PollSettings = {
  n: number        // votes per person (capped at the number of options where it is read)
  add: boolean     // anyone can add options
  hide: boolean    // hide who voted
  close?: string   // voting closes after this day, YYYY-MM-DD
}
// what the [poll] line carries
export type Poll = { id: string; q: string; o: PollOption[]; s?: PollSettings }
// a poll as it stands after every control line so far
export type PollState = { id: string; q: string; o: PollOption[]; s: PollSettings; by: string }

export const POLL_MARKER = '[poll]'
export const POLL_ADD_MARKER = '[poll+]'
export const POLL_SET_MARKER = '[poll~]'
export const POLL_PREFIX = 'poll:'
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 6    // what the composer offers when posting
export const POLL_OPTION_LIMIT = 12  // how many a poll can grow to with added options
export const POLL_OPTION_MAX_LEN = 60

export const DEFAULT_POLL_SETTINGS: PollSettings = { n: 1, add: true, hide: false }

export function pollKey(pollId: string, optionId: string): string {
  return `${POLL_PREFIX}${pollId}:${optionId}`
}

export function isPollKey(k: string): boolean {
  return k.startsWith(POLL_PREFIX)
}

// the ballot for places: every key that is not a poll pick
export function placeVotes(votes: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(votes).filter(([k]) => !isPollKey(k)))
}

// the poll picks alone, for keeping them when the place ballot is cleared
export function pollVotes(votes: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(votes).filter(([k]) => isPollKey(k)))
}

/* ── control lines ── */

// a line that changes a poll rather than saying something: never shown, never counted
export function isControlMessage(m: Pick<ChatMessage, 'text' | 'system'>): boolean {
  return !m.system && (m.text.startsWith(POLL_ADD_MARKER) || m.text.startsWith(POLL_SET_MARKER))
}

// the lines people actually see in the chat: what unread counts, sounds and arrivals read
export function chatLines<T extends Pick<ChatMessage, 'text' | 'system'>>(messages: T[]): T[] {
  return messages.some(isControlMessage) ? messages.filter((m) => !isControlMessage(m)) : messages
}

// the same text two ways of typing it: "Uno", " uno ", "UNO"
export function optionKey(t: string): string {
  return t.trim().replace(/\s+/g, ' ').toLowerCase()
}

function cleanText(t: unknown, max: number): string | null {
  if (typeof t !== 'string') return null
  const v = t.trim().replace(/\s+/g, ' ').slice(0, max)
  return v || null
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

// settings as sent, laid over what they replace; anything malformed keeps the old value
function readSettings(raw: unknown, base: PollSettings): PollSettings {
  if (!raw || typeof raw !== 'object') return base
  const { n, add, hide, close } = raw as { n?: unknown; add?: unknown; hide?: unknown; close?: unknown }
  const out: PollSettings = { ...base }
  if (typeof n === 'number' && Number.isInteger(n)) out.n = Math.min(POLL_OPTION_LIMIT, Math.max(1, n))
  if (typeof add === 'boolean') out.add = add
  if (typeof hide === 'boolean') out.hide = hide
  if (close === null || close === '') delete out.close
  else if (typeof close === 'string' && DAY_RE.test(close)) out.close = close
  return out
}

// always whole, with a null closing day rather than none, so a later change that
// removes the day is not read as "keep the old one"
function settingsJson(s: PollSettings) {
  return { n: s.n, add: s.add, hide: s.hide, close: s.close ?? null }
}

export function encodePoll(p: Poll): string {
  return POLL_MARKER + JSON.stringify({ id: p.id, q: p.q, o: p.o.map((o) => ({ id: o.id, t: o.t })), s: settingsJson(p.s ?? DEFAULT_POLL_SETTINGS) })
}

export function encodePollOption(pollId: string, optionId: string, text: string): string {
  return POLL_ADD_MARKER + JSON.stringify({ p: pollId, id: optionId, t: text.trim().replace(/\s+/g, ' ').slice(0, POLL_OPTION_MAX_LEN) })
}

export function encodePollSettings(pollId: string, s: PollSettings): string {
  return POLL_SET_MARKER + JSON.stringify({ p: pollId, s: settingsJson(s) })
}

// a poll, or null for a normal message and for anything that only looks like one
export function decodePoll(text: string): Poll | null {
  if (!text.startsWith(POLL_MARKER)) return null
  try {
    const raw = JSON.parse(text.slice(POLL_MARKER.length)) as unknown
    if (!raw || typeof raw !== 'object') return null
    const { id, q, o, s } = raw as { id?: unknown; q?: unknown; o?: unknown; s?: unknown }
    if (typeof id !== 'string' || !id || typeof q !== 'string' || !q.trim() || !Array.isArray(o)) return null
    const opts: PollOption[] = []
    const seen = new Set<string>()
    for (const x of o) {
      if (!x || typeof x !== 'object') return null
      const { id: oid, t } = x as { id?: unknown; t?: unknown }
      if (typeof oid !== 'string' || !oid || typeof t !== 'string' || seen.has(oid)) return null
      seen.add(oid)
      opts.push({ id: oid, t })
    }
    if (opts.length < POLL_MIN_OPTIONS) return null
    // polls posted before settings existed read as the defaults
    return { id, q, o: opts.slice(0, POLL_MAX_OPTIONS), s: readSettings(s, DEFAULT_POLL_SETTINGS) }
  } catch {
    return null
  }
}

type Control =
  | { kind: 'add'; p: string; id: string; t: string }
  | { kind: 'set'; p: string; s: unknown }

function decodeControl(text: string): Control | null {
  const kind = text.startsWith(POLL_ADD_MARKER) ? 'add' : text.startsWith(POLL_SET_MARKER) ? 'set' : null
  if (!kind) return null
  try {
    const raw = JSON.parse(text.slice((kind === 'add' ? POLL_ADD_MARKER : POLL_SET_MARKER).length)) as unknown
    if (!raw || typeof raw !== 'object') return null
    const { p, id, t, s } = raw as { p?: unknown; id?: unknown; t?: unknown; s?: unknown }
    if (typeof p !== 'string' || !p) return null
    if (kind === 'set') return { kind, p, s }
    const text2 = cleanText(t, POLL_OPTION_MAX_LEN)
    if (typeof id !== 'string' || !id || !text2) return null
    return { kind, p, id, t: text2 }
  } catch {
    return null
  }
}

/* Every poll in the chat, as it stands now. The [poll] lines make the polls; the
   control lines are then applied in the order they were sent. Only the poll's creator
   and the event's host may change settings, and the latest change wins. Anyone may add
   an option while the poll allows it (the creator and the host always may). An option
   that repeats one already there, however it is capitalised, is dropped, and so is
   anything past the limit. A control line for a poll that is not here (its line was
   taken out with its writer) does nothing. One pass each way, so a long chat is cheap. */
export function reducePolls(messages: ChatMessage[], hostIds: ReadonlySet<string>): Map<string, PollState> {
  const polls = new Map<string, PollState>()
  const controls: { m: ChatMessage; i: number }[] = []
  messages.forEach((m, i) => {
    if (m.system) return
    if (isControlMessage(m)) { controls.push({ m, i }); return }
    const p = decodePoll(m.text)
    if (!p || polls.has(p.id)) return
    // options as posted, with repeats dropped the same way added ones are
    const seen = new Set<string>()
    const o = p.o.filter((x) => { const k = optionKey(x.t); if (!k || seen.has(k)) return false; seen.add(k); return true })
    if (o.length < POLL_MIN_OPTIONS) return
    polls.set(p.id, { id: p.id, q: p.q, o, s: p.s ?? DEFAULT_POLL_SETTINGS, by: m.id })
  })
  if (!controls.length) return polls
  // in the order sent; lines with no time keep their place in the list
  controls.sort((a, b) => ((a.m.at ?? 0) - (b.m.at ?? 0)) || a.i - b.i)
  const texts = new Map<string, Set<string>>()
  const textsOf = (p: PollState) => {
    let s = texts.get(p.id)
    if (!s) { s = new Set(p.o.map((x) => optionKey(x.t))); texts.set(p.id, s) }
    return s
  }
  for (const { m } of controls) {
    const c = decodeControl(m.text)
    const p = c && polls.get(c.p)
    if (!c || !p) continue
    const owner = m.id === p.by || hostIds.has(m.id)
    if (c.kind === 'set') {
      if (owner) polls.set(p.id, { ...p, s: readSettings(c.s, p.s) })
      continue
    }
    if (!owner && !p.s.add) continue
    if (p.o.length >= POLL_OPTION_LIMIT || p.o.some((x) => x.id === c.id)) continue
    const k = optionKey(c.t)
    const have = textsOf(p)
    if (have.has(k)) continue
    have.add(k)
    polls.set(p.id, { ...p, o: [...p.o, { id: c.id, t: c.t, by: m.id }] })
  }
  return polls
}

// the closing day has gone by (the day itself still counts as open), read on this device's calendar
export function pollClosed(s: Pick<PollSettings, 'close'>): boolean {
  if (!s.close) return false
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return s.close < today
}

// how many votes each person gets on this poll right now: never more than there are options
export function votesPerPerson(p: Pick<PollState, 'o' | 's'>): number {
  return Math.max(1, Math.min(p.s.n, p.o.length))
}

// what a message says when it is shown anywhere but as a poll card
export function messagePreview(m: Pick<ChatMessage, 'text'>): string {
  if (m.text.startsWith(POLL_ADD_MARKER)) return 'added a poll option'
  if (m.text.startsWith(POLL_SET_MARKER)) return 'changed a poll'
  const p = decodePoll(m.text)
  return p ? `Poll: ${p.q}` : m.text
}

// the options a form holds, tidied, blanks and repeats left out
export function distinctOptions(options: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of options) {
    const t = raw.trim().replace(/\s+/g, ' ')
    const k = optionKey(t)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

// a fresh poll from what the form holds; option ids are short and only unique within it
export function makePoll(question: string, options: string[]): Poll {
  return {
    id: crypto.randomUUID(),
    q: question.trim(),
    o: distinctOptions(options).slice(0, POLL_MAX_OPTIONS).map((t, i) => ({ id: String.fromCharCode(97 + i), t })),
    s: { ...DEFAULT_POLL_SETTINGS },
  }
}

// an id for an option added later: random, so two people adding at once never collide
export function newOptionId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/* One tap on an option, worked out from the ballot as saved right now, by the same
   rules as the place ballot. With one vote each, tapping another option moves your
   vote; with more, you can pick up to the limit and further picks do nothing until
   you take one back. Tapping one of your picks takes it back. Only this person's id
   moves, and only under this poll's keys; everything else is left as is. */
export function tapPollOption(votes: Record<string, string[]>, poll: Pick<PollState, 'id' | 'o' | 's'>, pid: string, optionId: string): Record<string, string[]> {
  if (!poll.o.some((o) => o.id === optionId)) return votes
  const key = pollKey(poll.id, optionId)
  const has = (votes[key] ?? []).includes(pid)
  const max = votesPerPerson(poll)
  const next = { ...votes }
  const drop = (k: string) => {
    const ids = (next[k] ?? []).filter((x) => x !== pid)
    if (ids.length) next[k] = ids
    else delete next[k]
  }
  if (has) {
    drop(key)
    return next
  }
  if (max === 1) {
    // the one vote moves: off every option of this poll, onto this one
    const prefix = pollKey(poll.id, '')
    for (const k of Object.keys(next)) if (k.startsWith(prefix) && next[k].includes(pid)) drop(k)
  } else {
    const mine = poll.o.filter((o) => (votes[pollKey(poll.id, o.id)] ?? []).includes(pid)).length
    if (mine >= max) return votes // out of votes
  }
  next[key] = [...(next[key] ?? []), pid]
  return next
}
