import type { ChatMessage } from './sample'

/* ── a poll in the chat ──
   "Which game?" has nowhere to go on the place ballot, so it goes in the chat.

   Everything about a poll travels as chat messages, because a message is an append
   that can never clobber anyone, while the event document is saved whole by whoever
   writes last. Three kinds of line:

     [poll]{"id","q","o":[{id,t}],"s":{n,add,hide,close?}}   the poll itself, shown as a card
     [poll+]{"p":pollId,"id":optionId,"t":text}             someone adds an option
     [poll~]{"p":pollId,"s":{n,add,hide,close?}}            the host changes its settings
     [poll=]{"p":pollId,"q"?:text,"o"?:[{id,t}]}            someone rewords the question or options
     [poll-]{"p":pollId}                                     the poll is taken down

   Who may do what (decided in reducePolls, so every copy agrees):
     - the host may change the settings, reword anything, and always add options
     - whoever wrote something may reword it: the poll's writer its question and the
       options it was posted with, whoever added an option that option
     - everyone else may add options only while "Anyone can add options" is on, which
       a new poll starts with off
     - the poll's writer may take it down, and so may the host; it stays down, and
       nothing sent for it afterwards changes anything

   The last four are control lines: never drawn in the chat, never counted as unread,
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
export type PollState = { id: string; q: string; o: PollOption[]; s: PollSettings; by: string; removed?: { by: string } } // removed: taken down, and by whom

export const POLL_MARKER = '[poll]'
export const POLL_ADD_MARKER = '[poll+]'
export const POLL_SET_MARKER = '[poll~]'
export const POLL_EDIT_MARKER = '[poll=]'
export const POLL_DEL_MARKER = '[poll-]'
export const POLL_PREFIX = 'poll:'
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 6    // what the composer offers when posting
export const POLL_OPTION_LIMIT = 12  // how many a poll can grow to with added options
export const POLL_OPTION_MAX_LEN = 60
export const POLL_QUESTION_MAX_LEN = 140

// nobody but the host adds options until the host says so
export const DEFAULT_POLL_SETTINGS: PollSettings = { n: 1, add: false, hide: false }

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
  return !m.system && (m.text.startsWith(POLL_ADD_MARKER) || m.text.startsWith(POLL_SET_MARKER) || m.text.startsWith(POLL_EDIT_MARKER) || m.text.startsWith(POLL_DEL_MARKER))
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

// one save of the edit form: the question if it changed, and the options that did
export function encodePollEdit(pollId: string, edit: { q?: string; o?: { id: string; t: string }[] }): string {
  const tidy = (t: string, max: number) => t.trim().replace(/\s+/g, ' ').slice(0, max)
  return POLL_EDIT_MARKER + JSON.stringify({
    p: pollId,
    ...(edit.q !== undefined ? { q: tidy(edit.q, POLL_QUESTION_MAX_LEN) } : {}),
    ...(edit.o?.length ? { o: edit.o.map((x) => ({ id: x.id, t: tidy(x.t, POLL_OPTION_MAX_LEN) })) } : {}),
  })
}

export function encodePollDelete(pollId: string): string {
  return POLL_DEL_MARKER + JSON.stringify({ p: pollId })
}

// may this person take the poll down: its writer, or the host
export function canDeletePoll(poll: Pick<PollState, 'by'>, who: string | null, host: boolean): boolean {
  return !!who && (host || who === poll.by)
}

/* May this person reword the question / this option? Who wrote it decides, the same
   rule reducePolls applies. And only until anyone has voted: the question until the
   poll's first vote, an option until its own first vote, so rewording never changes
   what somebody already chose. The votes live in event.votes, which the chat lines
   cannot see, so the vote check is made where they are both on hand: on the card,
   and again at Save with the votes as they are then. */
function votedOn(poll: Pick<PollState, 'id'>, optionId: string, votes?: Record<string, string[]>): boolean {
  return (votes?.[pollKey(poll.id, optionId)]?.length ?? 0) > 0
}
export function canEditQuestion(poll: Pick<PollState, 'by' | 'id' | 'o'>, who: string | null, host: boolean, votes?: Record<string, string[]>): boolean {
  if (!who || !(host || who === poll.by)) return false
  return !votes || !poll.o.some((o) => votedOn(poll, o.id, votes))
}
export function canEditOption(poll: Pick<PollState, 'by' | 'id'>, option: PollOption, who: string | null, host: boolean, votes?: Record<string, string[]>): boolean {
  if (!who || !(host || who === (option.by ?? poll.by))) return false
  return !votes || !votedOn(poll, option.id, votes)
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
  | { kind: 'edit'; p: string; q: string | null; o: { id: string; t: string }[] }
  | { kind: 'del'; p: string }

function decodeControl(text: string): Control | null {
  const kind = text.startsWith(POLL_ADD_MARKER) ? 'add' : text.startsWith(POLL_SET_MARKER) ? 'set' : text.startsWith(POLL_EDIT_MARKER) ? 'edit' : text.startsWith(POLL_DEL_MARKER) ? 'del' : null
  if (!kind) return null
  try {
    const marker = kind === 'add' ? POLL_ADD_MARKER : kind === 'set' ? POLL_SET_MARKER : kind === 'edit' ? POLL_EDIT_MARKER : POLL_DEL_MARKER
    const raw = JSON.parse(text.slice(marker.length)) as unknown
    if (!raw || typeof raw !== 'object') return null
    const { p, id, t, s, q, o } = raw as { p?: unknown; id?: unknown; t?: unknown; s?: unknown; q?: unknown; o?: unknown }
    if (typeof p !== 'string' || !p) return null
    if (kind === 'del') return { kind, p }
    if (kind === 'set') return { kind, p, s }
    if (kind === 'edit') {
      const opts: { id: string; t: string }[] = []
      if (Array.isArray(o)) for (const x of o) {
        const { id: oid, t: ot } = (x ?? {}) as { id?: unknown; t?: unknown }
        const clean = cleanText(ot, POLL_OPTION_MAX_LEN)
        if (typeof oid === 'string' && oid && clean) opts.push({ id: oid, t: clean })
      }
      return { kind, p, q: cleanText(q, POLL_QUESTION_MAX_LEN), o: opts }
    }
    const text2 = cleanText(t, POLL_OPTION_MAX_LEN)
    if (typeof id !== 'string' || !id || !text2) return null
    return { kind, p, id, t: text2 }
  } catch {
    return null
  }
}

/* Every poll in the chat, as it stands now. The [poll] lines make the polls; the
   control lines are then applied in the order they were sent. Only the event's host
   may change settings, and the latest change wins. Anyone may add an option while the
   poll allows it (the host always may). Rewording follows who wrote what (see the top
   of this file); a rewording that would repeat another option is dropped. An option
   that repeats one already there, however it is capitalised, is dropped, and so is
   anything past the limit. A poll taken down by its writer or the host is kept, marked
   removed, so its line can say so. A control line for a poll that is not here (its line was
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
    const host = hostIds.has(m.id)
    // a poll taken down stays down: nothing after that changes it
    if (p.removed) continue
    if (c.kind === 'del') {
      if (canDeletePoll(p, m.id, host)) polls.set(p.id, { ...p, removed: { by: m.id } })
      continue
    }
    if (c.kind === 'set') {
      if (host) polls.set(p.id, { ...p, s: readSettings(c.s, p.s) })
      continue
    }
    if (c.kind === 'edit') {
      let next = p
      if (c.q && canEditQuestion(p, m.id, host)) next = { ...next, q: c.q }
      for (const e of c.o) {
        const o = next.o.find((x) => x.id === e.id)
        if (!o || !canEditOption(p, o, m.id, host)) continue
        const k = optionKey(e.t)
        if (next.o.some((x) => x.id !== e.id && optionKey(x.t) === k)) continue
        next = { ...next, o: next.o.map((x) => (x.id === e.id ? { ...x, t: e.t } : x)) }
      }
      if (next !== p) { polls.set(p.id, next); texts.delete(p.id) }
      continue
    }
    if (!host && !p.s.add) continue
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
  if (m.text.startsWith(POLL_EDIT_MARKER)) return 'edited a poll'
  if (m.text.startsWith(POLL_DEL_MARKER)) return 'removed a poll'
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
