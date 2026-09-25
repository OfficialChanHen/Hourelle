import type { ChatMessage } from './sample'

/* ── a quick poll in the chat ──
   "Which game?" has nowhere to go on the place ballot, so it goes in the chat. The
   question and its options travel as the text of an ordinary message, which is an
   append that can never clobber anyone. The picks live in `event.votes` under keys
   of their own, `poll:<poll id>:<option id>`, so each person's pick is their own
   row in the votes table, the same as a vote for a place. Everything that reads
   `event.votes` as the place ballot has to leave these keys out (placeVotes). */

export type PollOption = { id: string; t: string }
export type Poll = { id: string; q: string; o: PollOption[] }

export const POLL_MARKER = '[poll]'
export const POLL_PREFIX = 'poll:'
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 6

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

export function encodePoll(p: Poll): string {
  return POLL_MARKER + JSON.stringify({ id: p.id, q: p.q, o: p.o.map((o) => ({ id: o.id, t: o.t })) })
}

// a poll, or null for a normal message and for anything that only looks like one
export function decodePoll(text: string): Poll | null {
  if (!text.startsWith(POLL_MARKER)) return null
  try {
    const raw = JSON.parse(text.slice(POLL_MARKER.length)) as unknown
    if (!raw || typeof raw !== 'object') return null
    const { id, q, o } = raw as { id?: unknown; q?: unknown; o?: unknown }
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
    return { id, q, o: opts.slice(0, POLL_MAX_OPTIONS) }
  } catch {
    return null
  }
}

// what a message says when it is shown anywhere but as a poll card
export function messagePreview(m: Pick<ChatMessage, 'text'>): string {
  const p = decodePoll(m.text)
  return p ? `Poll: ${p.q}` : m.text
}

// a fresh poll from what the form holds; option ids are short and only unique within it
export function makePoll(question: string, options: string[]): Poll {
  return {
    id: crypto.randomUUID(),
    q: question.trim(),
    o: options.map((t) => t.trim()).filter(Boolean).slice(0, POLL_MAX_OPTIONS).map((t, i) => ({ id: String.fromCharCode(97 + i), t })),
  }
}

/* One tap on an option, worked out from the ballot as saved right now. One pick per
   person: tapping another option moves it, tapping your own takes it back. Only this
   person's id moves, and only under this poll's keys; everything else is left as is. */
export function tapPollOption(votes: Record<string, string[]>, poll: Poll, pid: string, optionId: string): Record<string, string[]> {
  const takeBack = (votes[pollKey(poll.id, optionId)] ?? []).includes(pid)
  const next = { ...votes }
  for (const o of poll.o) {
    const k = pollKey(poll.id, o.id)
    const had = votes[k] ?? []
    const want = !takeBack && o.id === optionId
    if (had.includes(pid) === want) continue
    const ids = had.filter((x) => x !== pid)
    if (want) ids.push(pid)
    if (ids.length) next[k] = ids
    else delete next[k]
  }
  return next
}
