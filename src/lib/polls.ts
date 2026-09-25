/* ── questions the host puts to the group ──
   The place ballot was the only vote the app had, so people used it for anything
   ("which game?"). A poll is the general version: a question, a few options, one
   pick per person.

   The question itself (its wording and options) is part of the event document and
   only the host writes it. The picks are not: they ride in the same `event.votes`
   map as the place ballot, under keys of their own (`poll:<pollId>:<optionId>`), so
   each pick is one row per person in the existing `votes` table and two people
   answering at once never overwrite each other. Anything that means "place votes"
   reads `placeVotes(ev.votes)`, so a pick on a poll never counts as a place vote. */

export type Poll = { id: string; question: string; options: { id: string; text: string }[]; by: string; at: number }

export const POLL_PREFIX = 'poll:'

export function pollKey(pollId: string, optionId: string): string {
  return `${POLL_PREFIX}${pollId}:${optionId}`
}
export function isPollKey(k: string): boolean {
  return k.startsWith(POLL_PREFIX)
}

type Votes = Record<string, string[]>

/** The place ballot alone: the votes map without any poll picks. */
export function placeVotes(votes: Votes | undefined): Votes {
  const out: Votes = {}
  for (const [k, ids] of Object.entries(votes ?? {})) if (!isPollKey(k)) out[k] = ids
  return out
}

/** One poll's picks, by option id. Options nobody picked come back as empty lists. */
export function pollVotes(votes: Votes | undefined, poll: Poll): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const o of poll.options) out[o.id] = votes?.[pollKey(poll.id, o.id)] ?? []
  return out
}

/** `votes` with this person's pick on `poll` moved to `optionId`, or taken back
 *  when `optionId` is null. Nobody else's pick and no other key is touched. */
export function withPollPick(votes: Votes | undefined, poll: Poll, who: string, optionId: string | null): Votes {
  const next: Votes = { ...(votes ?? {}) }
  for (const o of poll.options) {
    const k = pollKey(poll.id, o.id)
    const rest = (next[k] ?? []).filter((id) => id !== who)
    const ids = o.id === optionId ? [...rest, who] : rest
    if (ids.length) next[k] = ids
    else delete next[k]
  }
  return next
}

/** `votes` with every pick on this poll gone, for when the host removes it. */
export function withoutPoll(votes: Votes | undefined, pollId: string): Votes {
  const prefix = `${POLL_PREFIX}${pollId}:`
  const next: Votes = {}
  for (const [k, ids] of Object.entries(votes ?? {})) if (!k.startsWith(prefix)) next[k] = ids
  return next
}

/** A new question. Ids carry no colon, so a poll key splits cleanly. */
export function newPoll(question: string, options: string[], by: string): Poll {
  const at = Date.now()
  return {
    id: `${at.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    question,
    options: options.map((text, i) => ({ id: `o${i + 1}`, text })),
    by,
    at,
  }
}
