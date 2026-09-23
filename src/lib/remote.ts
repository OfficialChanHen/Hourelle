// Phase 4, steps 2–3: the sync layer between localStorage and Supabase.
// The UI never waits on the network: every read stays a synchronous localStorage
// read, and this module moves data in the background — pull on page load, push
// after each local write, and a realtime subscription for other people's writes.
// When `backendOn` is false every function here is a silent no-op.

import { supabase, backendOn } from './db'
import { writeLocal } from './local'
import { currentAccount } from './session'
import { byDay, byParticipant, fullAvailIvOf, intervalsToGrid, stepOf, type PersonAnswer } from './availability'
import type { AppEvent, ChatMessage } from './events'

// fired on window whenever the cloud changed the local cache, so any open page
// can re-read if it wants live updates (roadmap step 7 wires the listeners)
export const EVENTS_SYNCED = 'hourelle:events-synced'
const KEY = 'hourelle.events.v1'

function readCache(): AppEvent[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as AppEvent[] } catch { return [] }
}
function writeCache(list: AppEvent[], announce: boolean) {
  // a pull that cannot be cached still repaints the open page from the list it just
  // built, so the announcement goes out either way; writeLocal says if it stuck
  writeLocal(KEY, JSON.stringify(list))
  if (announce) window.dispatchEvent(new Event(EVENTS_SYNCED))
}

// fired when the database refuses a write, so the UI can say so instead of leaving
// a local change that silently never reached anyone else
export const PUSH_REJECTED = 'hourelle:push-rejected'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// the host as a column, read off the document: the participant flagged `host`, but
// only when their id is a real account id. Events hosted by the signed-out stub stay
// ownerless, which is what keeps them editable by whoever holds the link.
function hostIdOf(ev: AppEvent): string | null {
  const id = ev.participants.find((p) => p.host)?.id
  return id && UUID.test(id) ? id : null
}

/* ── a document from the cloud is another browser's view of the event ──
   Two fields in it are that browser's, not ours: `hostedByYou`, and the `you`
   marker on whichever participant was them. Taken as-is they would hand an
   invitee the host's powers, or make the host's entry read as "you" to whoever
   opens the link. Both are rebuilt for this identity before the document lands in
   the cache: `you` goes on the account's own entry (or the guest session's) and
   nowhere else; the event is hosted by you only when the host entry carries your
   account id. An ownerless event (stub host, made before signing in) keeps
   whatever this browser already knew — only its own copy can say it was born
   here — unless you are on its list as someone other than the host. */
function localize(doc: AppEvent, prior?: AppEvent): AppEvent {
  const acc = currentAccount()
  let gid: string | null = null
  try { gid = localStorage.getItem(GUEST_KEY_PREFIX + doc.id) } catch { /* private mode */ }
  const meId = acc.signedIn ? acc.id : gid
  const mine = (id: string) => meId !== null && id === meId
  const host = doc.participants.find((p) => p.host)
  const owned = !!host && UUID.test(host.id)
  const hostedByYou = owned
    ? acc.signedIn && host!.id === acc.id
    : !!prior?.hostedByYou && !doc.participants.some((p) => !p.host && mine(p.id))
  return {
    ...doc,
    hostedByYou,
    participants: doc.participants.map((p) => ({ ...p, you: mine(p.id) || undefined })),
  }
}

function rejected(action: string, message: string) {
  console.warn(`hourelle: ${action} refused by the database — ${message}`)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PUSH_REJECTED, { detail: { action, message } }))
  }
}

/* ── push: local change → cloud, fire-and-forget ──
   Writes are optimistic: localStorage already has the change and the UI moved on.
   Since row policies and the field trigger can now say no, a refusal is announced
   rather than swallowed — an offline queue is still a later refinement. */
/* What of an event actually travels inside its document.
   Three things are cut out, each for the same reason: they are written by everyone at
   once, and a document write replaces the whole thing. Messages are their own rows
   (pushMessage), and since migration 0008 so are availability and the ballot
   (pushAnswers). `avail` stays — it is derived from the intervals, it is the only copy
   of an answer on an event old enough to predate `availIv`, and every client recomputes
   it from the same rows, so a stale one costs nothing.

   They are only cut once the database has actually said the rows are there. "Not known
   to be missing" is not the same fact: `rowsMissing` starts false, so cutting on that
   alone throws the answers away on the very first write of the session, before the
   failure that would have told us the tables are absent has even come back. On a
   database without migration 0008 the document IS the storage, and cutting them loses
   real data — availability falls back to the per-cell `avail`, so every minute-precise
   answer snaps out to whole slots, and the ballot and the explicit "none of these days
   work" have nowhere left to live at all. */
let rowsReady = false // the database has answered about `availability` / `votes`
const docOf = (ev: AppEvent) => {
  const doc: Partial<AppEvent> = { ...ev, messages: [] }
  if (rowsReady) {
    delete doc.availIv
    delete doc.votes
    delete doc.unavailableIds
  }
  return doc
}

/* An existing event is UPDATED, never upserted. An upsert is an insert first, and
   the insert policy only admits the host — so a guest marking availability on
   someone else's event would be refused before the update policy ever saw it. */
export function pushEvent(ev: AppEvent): void {
  if (!backendOn) return
  // an update that overtakes the insert matches no rows and is lost in silence
  void afterCreate(ev.id).then(() =>
    supabase!
      .from('events')
      .update({ data: docOf(ev), host_id: hostIdOf(ev) })
      .eq('id', ev.id)
      .then(({ error }) => { if (error) rejected('save', error.message) }),
  )
}

/* ── one event's row, on its way up ──
   Everything else about an event points at that row: the answers, the votes and
   the chat all carry its id as a foreign key, and an update needs something to
   update. A new event is made and then, in the same breath, filled in — the tour's
   practice event seeds five people's times a millisecond after creating the event
   — so without this the answers arrived first and the database refused them for
   pointing at nothing. Worse, the refusal said "violates", which the notice read
   as a permission problem and told the person they were not allowed.

   So an insert is remembered while it is in flight, and everything that follows
   waits for it. It is kept per event and dropped as soon as it lands, so this is
   one promise for the first moment of an event's life and nothing afterwards. */
const creating = new Map<string, Promise<void>>()
function afterCreate(id: string): Promise<void> {
  return creating.get(id) ?? Promise.resolve()
}

/* A brand-new event is inserted: the one path the insert policy is for. */
export function pushNewEvent(ev: AppEvent): void {
  if (!backendOn) return
  const done = Promise.resolve(
    supabase!
      .from('events')
      .insert({ id: ev.id, data: docOf(ev), host_id: hostIdOf(ev) })
      .then(({ error }) => { if (error) rejected('create', error.message) }),
  ).then(() => { creating.delete(ev.id) })
  creating.set(ev.id, done)
}

/* ── one event, by id, for whoever holds its link ──
   The identity-scoped pull deliberately asks for nothing on behalf of a visitor —
   but an invite is a visitor holding a link, and reads are open at the database
   for exactly that reason. Fetches the event and its chat into the cache. */
export async function fetchEvent(id: string): Promise<boolean> {
  if (!backendOn) return false
  const { data, error } = await supabase!.from('events').select('id, data').eq('id', id).maybeSingle()
  if (error || !data) return false
  const ev = data.data as AppEvent
  const list = readCache()
  const i = list.findIndex((e) => e.id === id)
  let merged = i >= 0 ? list.map((e, k) => (k === i ? { ...localize(ev, e), messages: withoutRemoved(e.messages, ev) } : e)) : [...list, { ...localize(ev), messages: [] }]
  const { data: rows } = await supabase!.from('messages').select('*').eq('event_id', id).order('at', { ascending: true })
  if (rows) merged = mergeMessages(merged, rows as MessageRow[])
  merged = mergeAnswers(merged, await loadAnswers([id]), new Set([id]))
  writeCache(merged, true)
  return true
}

/* ── answers: one row per person, so nobody overwrites anybody ──
   Availability and the ballot used to ride inside the event document, which meant
   marking your times rewrote everyone else's too. Now a person writes only their own
   row (availability) or their own vote (votes), and neither can collide. The rest of
   the app never learns this: rows are folded back into the document shape it already
   reads — `availIv`, `avail`, `votes`, `unavailableIds` — on the way in.

   Both tables are additions to a database that may not have them yet: migration 0008
   is applied by hand. Until it is, every call here fails softly and the app keeps
   working exactly as it did, out of the document. */

type AvailRow = { event_id: string; participant_id: string; intervals: PersonAnswer | null; unavailable: boolean }
type VoteRow = { event_id: string; place_id: string; participant_id: string }

// flips true the first time either table answers "no such table", so a database
// without the migration is asked once rather than on every write
let rowsMissing = false
function noteMissing(message: string | undefined): boolean {
  // 42P01 is undefined_table; PostgREST reports an unknown relation the same way
  if (message && /does not exist|schema cache/i.test(message)) { rowsMissing = true; return true }
  return false
}

/** Every answer row for a set of events, or null when the tables are not there. */
async function loadAnswers(ids: string[]): Promise<{ avail: AvailRow[]; votes: VoteRow[] } | null> {
  if (!backendOn || rowsMissing || !ids.length) return null
  const [a, v] = await Promise.all([
    supabase!.from('availability').select('event_id, participant_id, intervals, unavailable').in('event_id', ids),
    supabase!.from('votes').select('event_id, place_id, participant_id').in('event_id', ids),
  ])
  if (a.error || v.error) {
    if (noteMissing(a.error?.message) || noteMissing(v.error?.message)) return null
    console.warn('hourelle: answers pull failed', a.error?.message ?? v.error?.message)
    return null
  }
  rowsReady = true
  return { avail: (a.data ?? []) as AvailRow[], votes: (v.data ?? []) as VoteRow[] }
}

/** Fold this event's rows into the document shape the app reads. The document is
 *  the floor — an event old enough to predate rows still carries its per-cell
 *  `avail` — and every row overrides that one person's answer. */
function withAnswers(doc: AppEvent, avail: AvailRow[], votes: VoteRow[]): AppEvent {
  const people = byParticipant(fullAvailIvOf(doc))
  const unavailable = new Set<string>()
  for (const r of avail) {
    people.set(r.participant_id, r.intervals ?? {})
    if (r.unavailable) unavailable.add(r.participant_id)
  }
  const availIv = byDay(people)
  // The ballot has no per-person floor to fall back on — it is one map for everyone —
  // so the document answers only while no row exists at all. That is the shape of the
  // transition: before migration 0008 the votes are in the document and there are no
  // rows; after it there are rows and the document has none. The first vote on a
  // fresh event crosses the line in the right direction.
  const ballot: Record<string, string[]> = {}
  for (const v of votes) (ballot[v.place_id] ??= []).push(v.participant_id)
  return {
    ...doc,
    availIv,
    avail: { ...doc.avail, ...intervalsToGrid(availIv, doc.days, doc.times.length, stepOf(doc.granularity)) },
    votes: votes.length ? ballot : doc.votes ?? {},
    unavailableIds: [...unavailable],
  }
}

/** Merge rows into a list of cached events. Events with no rows are left alone. */
function mergeAnswers(list: AppEvent[], answers: { avail: AvailRow[]; votes: VoteRow[] } | null, only?: Set<string>): AppEvent[] {
  if (!answers) return list
  const byEvent = new Map<string, { avail: AvailRow[]; votes: VoteRow[] }>()
  const bucket = (id: string) => { const b = byEvent.get(id) ?? { avail: [], votes: [] }; byEvent.set(id, b); return b }
  for (const r of answers.avail) bucket(r.event_id).avail.push(r)
  for (const r of answers.votes) bucket(r.event_id).votes.push(r)
  return list.map((e) => {
    if (only && !only.has(e.id)) return e
    const b = byEvent.get(e.id) ?? { avail: [], votes: [] }
    return withAnswers(e, b.avail, b.votes)
  })
}

/* ── writing: the diff between two documents, sent as rows ──
   Every writer in the app already goes through patchEvent, which hands both versions
   here. Normally exactly one person's answer moved — yours. */
export function pushAnswers(before: AppEvent, after: AppEvent): void {
  if (!backendOn || rowsMissing || after.demo) return
  const fail = (what: string) => ({ error }: { error: { message: string } | null }) => {
    if (!error) { rowsReady = true; return }
    if (!noteMissing(error.message)) rejected(what, error.message)
  }

  // availability: your whole answer, upserted. An emptied answer is written as an
  // empty row rather than deleted — a missing row means "has not answered", and the
  // document's legacy `avail` would otherwise bring the old times back.
  const b = byParticipant(fullAvailIvOf(before)), a = byParticipant(fullAvailIvOf(after))
  const bUn = new Set(before.unavailableIds ?? []), aUn = new Set(after.unavailableIds ?? [])
  const me = after.participants.find((p) => p.you)?.id
  const onList = new Set(after.participants.map((p) => p.id))
  for (const pid of new Set([...a.keys(), ...b.keys(), ...aUn, ...bUn])) {
    // someone taken off the event: their row goes, rather than being kept as an empty
    // answer, which is what an emptied answer from someone still on the list is
    if (!onList.has(pid)) {
      if (before.participants.some((p) => p.id === pid)) {
        void afterCreate(after.id).then(() =>
          supabase!.from('availability').delete().match({ event_id: after.id, participant_id: pid }).then(fail('clear their times')),
        )
      }
      continue
    }
    const from = b.get(pid) ?? {}, to = a.get(pid) ?? {}
    if (JSON.stringify(from) === JSON.stringify(to) && bUn.has(pid) === aUn.has(pid)) continue
    // an answer of your own on somebody else's event: once it is saved, the host may
    // want to hear about it
    const answer = pid === me && !after.hostedByYou && (aUn.has(pid) || Object.values(to).some((iv) => iv.length > 0))
    void afterCreate(after.id).then(() =>
      supabase!
        .from('availability')
        .upsert({ event_id: after.id, participant_id: pid, intervals: to, unavailable: aUn.has(pid), updated_at: new Date().toISOString() }, { onConflict: 'event_id,participant_id' })
        .then((r) => { fail('save your times')(r); if (!r.error && answer) tellHost(after.id, pid) }),
    )
  }

  // the ballot: a vote is a row, so casting is an insert and taking it back a delete
  const was = before.votes ?? {}, now = after.votes ?? {}
  for (const placeId of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const had = new Set(was[placeId] ?? []), has = new Set(now[placeId] ?? [])
    const added = [...has].filter((p) => !had.has(p))
    const gone = [...had].filter((p) => !has.has(p))
    if (added.length) {
      void afterCreate(after.id).then(() =>
        supabase!
          .from('votes')
          .upsert(added.map((participant_id) => ({ event_id: after.id, place_id: placeId, participant_id })), { onConflict: 'event_id,place_id,participant_id' })
          .then(fail('vote')),
      )
    }
    for (const participant_id of gone) {
      void supabase!
        .from('votes').delete()
        .match({ event_id: after.id, place_id: placeId, participant_id })
        .then(fail('take back your vote'))
    }
  }
}

/* A row changed somewhere else. Rather than patch the cache from one row — deletes
   arrive thin and a drag sends a burst — the event's answers are re-read once the
   burst settles. One small query, and the result is always right. */
const answerRefresh = new Map<string, ReturnType<typeof setTimeout>>()
function refreshAnswers(eventId: string): void {
  if (rowsMissing) return
  const pending = answerRefresh.get(eventId)
  if (pending) clearTimeout(pending)
  answerRefresh.set(eventId, setTimeout(() => {
    answerRefresh.delete(eventId)
    void loadAnswers([eventId]).then((answers) => {
      if (!answers) return
      const list = readCache()
      if (!list.some((e) => e.id === eventId)) return // not a room this browser is in
      writeCache(mergeAnswers(list, answers, new Set([eventId])), true)
    })
  }, 220))
}

/* ── chat: one row per message ──
   Appending a row cannot clobber anyone, which a whole-document write could. The
   client mints the row id (mid) so the realtime echo of our own insert is recognised
   and not shown twice. */
type MessageRow = { id: string; event_id: string; participant_id: string; name: string; body: string; system: boolean; at: number }

function rowToMessage(r: MessageRow): ChatMessage {
  return { mid: r.id, id: r.participant_id, name: r.name, text: r.body, at: Number(r.at), time: '', you: false, system: r.system || undefined }
}

/* Someone came off an event: ask the server to clear their chat lines, which no
   browser may delete. The server checks the event row first (the ids have to be in
   its removedIds and off its roster), so this can only ever finish a removal that
   already happened. Fire and forget: the removal itself has succeeded either way. */
export function purgeRemoved(eventId: string, participantIds: string[]): void {
  if (!backendOn || !participantIds.length) return
  void afterCreate(eventId).then(() =>
    fetch('/api/events/purge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, participantIds }) }).catch(() => {}),
  )
}

export function pushMessage(eventId: string, m: ChatMessage): void {
  if (!backendOn) return
  void afterCreate(eventId).then(() =>
    supabase!
    .from('messages')
    // a message id is minted once and never changes, so a second push of the same
    // line (a re-sync, a retry) is a no-op rather than a duplicate-key refusal
    .upsert({ id: m.mid, event_id: eventId, participant_id: m.id, name: m.name, body: m.text, system: !!m.system, at: m.at ?? Date.now() }, { onConflict: 'id', ignoreDuplicates: true })
    .then(({ error }) => { if (error) rejected('message', error.message) }),
  )
}

/* Lines from people taken off the event stay out of every copy. The server deletes
   their rows, but a pull, a refresh or an insert racing the removal can bring one
   back, and a document echo arrives with the new list before the delete does. The
   test is the event's own: in removedIds and off the roster (a merge never puts an
   id in removedIds, so merged history is kept). */
function withoutRemoved(messages: ChatMessage[], ev: Pick<AppEvent, 'removedIds' | 'participants'>): ChatMessage[] {
  const gone = (ev.removedIds ?? []).filter((id) => !ev.participants.some((p) => p.id === id))
  if (!gone.length) return messages
  const g = new Set(gone)
  return messages.filter((m) => !g.has(m.id))
}

// merge a batch of rows into the cached events, newest last, without duplicates
function mergeMessages(list: AppEvent[], rows: MessageRow[]): AppEvent[] {
  const byEvent = new Map<string, ChatMessage[]>()
  for (const r of rows) {
    const arr = byEvent.get(r.event_id) ?? []
    arr.push(rowToMessage(r))
    byEvent.set(r.event_id, arr)
  }
  return list.map((e) => {
    const incoming = byEvent.get(e.id)
    if (!incoming) return e
    const have = new Set(e.messages.map((m) => m.mid).filter(Boolean))
    const merged = withoutRemoved([...e.messages, ...incoming.filter((m) => !have.has(m.mid))], e)
    merged.sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    return { ...e, messages: merged }
  })
}

export function pushDelete(id: string): void {
  if (!backendOn) return
  void afterCreate(id).then(() =>
    supabase!
    .from('events')
    .delete()
    .eq('id', id)
    .then(({ error }) => { if (error) rejected('delete', error.message) }),
  )
}

/* ── whose events are these ──
   Reads are open at the database (the link is the permission), so scoping has to
   happen here: only events this identity is part of are pulled, listed, or accepted
   from realtime. "Part of" means: host, a participant by account id, a participant
   by the email the account signed up with (a guest entry made before the account
   existed — this is how those events follow you in), or an event this browser
   holds a guest session for. Without a backend the browser owns everything in it. */
const GUEST_KEY_PREFIX = 'hourelle.me.'
export function guestSessionEventIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(GUEST_KEY_PREFIX)).map((k) => k.slice(GUEST_KEY_PREFIX.length))
  } catch { return [] }
}
export function isMine(ev: AppEvent): boolean {
  if (!backendOn) return true
  try {
    const gid = localStorage.getItem(GUEST_KEY_PREFIX + ev.id)
    if (gid && ev.participants.some((p) => p.id === gid)) return true
  } catch { /* private mode */ }
  const acc = currentAccount()
  if (!acc.signedIn) return false
  const email = acc.email?.toLowerCase()
  return ev.participants.some((p) => p.id === acc.id || (!!email && p.email?.toLowerCase() === email))
}

/* ── pull: cloud → local cache, once per page load and again on every sign-in ──
   The cloud copy wins for any event it knows about; events that exist only on
   this device (created while offline or before the backend) get pushed up. */
let pulledOnce = false
/** Has the first pull for this identity finished? A page that would otherwise say
 *  "nothing here" while the account's events are still on their way asks this and
 *  waits instead. False for a browser with no backend, which has nothing coming. */
export function cloudSettled(): boolean {
  return !backendOn || pulledOnce
}
/** Has the first pull of this visit finished (well or badly)? Pages that would
 *  otherwise declare an event missing wait for this before deciding. */
export function cloudSynced(): boolean {
  return !backendOn || pulledOnce
}

export async function syncFromCloud(): Promise<void> {
  if (!backendOn) return
  lastPull = Date.now()
  const acc = currentAccount()
  const guestIds = guestSessionEventIds()
  type Row = { id: string; data: AppEvent }
  // four narrow questions instead of "everything": mine as host, mine by account
  // id, mine by email, and the events this browser joined as a guest
  const asks: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>[] = []
  const events = () => supabase!.from('events').select('id, data')
  if (acc.signedIn) {
    asks.push(events().eq('host_id', acc.id))
    // jsonb containment (@>) on the participants array. The value has to be JSON text:
    // handed a JS array, the client would write a Postgres array literal instead and
    // the database answers "invalid input syntax for type json"
    asks.push(events().filter('data->participants', 'cs', JSON.stringify([{ id: acc.id }])))
    if (acc.email) asks.push(events().filter('data->participants', 'cs', JSON.stringify([{ email: acc.email.toLowerCase() }])))
  }
  if (guestIds.length) asks.push(events().in('id', guestIds))
  const results = await Promise.all(asks)
  // the identity may have changed while the network was out — a sign-out mid-pull
  // must not land the old account's events in the new cache
  if (currentAccount().id !== acc.id) return
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    console.warn('hourelle: pull failed', failed.error.message)
    pulledOnce = true
    window.dispatchEvent(new Event(EVENTS_SYNCED)) // let waiting pages stop waiting
    return
  }
  pulledOnce = true

  const cloud = new Map<string, AppEvent>()
  for (const r of results) for (const row of r.data ?? []) cloud.set(row.id, row.data)
  const local = readCache()
  // the cloud document carries no chat; keep whatever this browser already holds,
  // then lay the message rows over it
  let merged = local.map((e) => { const c = cloud.get(e.id); return c ? { ...localize(c, e), messages: withoutRemoved(e.messages, c) } : e })
  for (const [id, ev] of cloud) if (!local.some((e) => e.id === id)) merged.push({ ...localize(ev), messages: [] })
  const ids = merged.map((e) => e.id)
  if (ids.length) {
    const { data: rows } = await supabase!.from('messages').select('*').in('event_id', ids).order('at', { ascending: true })
    if (rows) merged = mergeMessages(merged, rows as MessageRow[])
    // availability and the ballot are rows of their own now; the events they belong
    // to are already here, so this is one more query, not one per event
    merged = mergeAnswers(merged, await loadAnswers(ids))
  }
  writeCache(merged, true)

  // events this device made before the backend existed go up whole, chat included.
  // "Not in the pull" is not enough to mean "born here": a visitor who opened an
  // invite has that event cached and is part of nothing, so the pull brings nothing —
  // only an event this identity is actually part of can be one of its own.
  //
  // And only one this identity HOSTS. Such an event was always made by its host;
  // being on the list (a guest session, an invite) is no claim to it, and the
  // database would refuse the insert anyway. It used to try: a guest session left
  // behind on an event that was since deleted sent the event up (refused), then every
  // chat line in it (refused again, for pointing at an event that is not there), and
  // the notice said "that change arrived before the event did" on every page load.
  // An event of someone else's that the pull does not bring back no longer exists,
  // so this device forgets it, guest session and all.
  const me = currentAccount()
  const hosted = (e: AppEvent) => !!e.hostedByYou || (me.signedIn && hostIdOf(e) === me.id)
  const gone: string[] = []
  for (const e of local) if (!cloud.has(e.id) && isMine(e)) {
    if (!hosted(e)) { gone.push(e.id); continue }
    void supabase!.from('events').upsert({ id: e.id, data: docOf(e), host_id: hostIdOf(e) }).then(({ error }) => { if (error) rejected('save', error.message) })
    for (const m of e.messages) pushMessage(e.id, { ...m, mid: m.mid ?? crypto.randomUUID() })
    // an event that has only ever lived here has answers only in its document
    pushAnswers({ ...e, availIv: {}, votes: {}, unavailableIds: [] }, e)
  }
  if (gone.length) forgetGone(gone)
}

/* Forget events that no longer exist: this device's copy, and the guest session on
   them (and guest mode, if it pointed at one). Written against the storage keys
   directly, since lib/events imports this module and not the other way round. */
function forgetGone(ids: string[]): void {
  const drop = new Set(ids)
  writeCache(readCache().filter((e) => !drop.has(e.id)), true)
  try {
    for (const id of ids) localStorage.removeItem(GUEST_KEY_PREFIX + id)
    const mode = localStorage.getItem('hourelle.guest-mode')
    if (mode && drop.has(mode)) {
      localStorage.removeItem('hourelle.guest-mode')
      window.dispatchEvent(new Event('hourelle:guest-mode'))
    }
  } catch { /* private mode */ }
}

/* ── catching up after a gap ──
   The channel below carries a change only while the socket is up, and nothing
   replays what was missed: a phone that was locked, a laptop that slept, a tab that
   lost the network comes back with a live socket and a stale cache, and the other
   device's edits show only after a reload. So the pull runs again whenever this
   browser comes back into view, back online, or the channel reconnects after a
   drop. The tab-focus bounce is common, so a fresh pull is skipped for a while. */
let lastPull = 0
let socketDown = false
const RETURN_GAP_MS = 8_000
function pullAgain(minGapMs: number): void {
  if (!backendOn || Date.now() - lastPull < minGapMs) return
  void syncFromCloud()
}
export function resyncOnReturn(): () => void {
  if (!backendOn) return () => {}
  const onVisible = () => { if (document.visibilityState === 'visible') pullAgain(RETURN_GAP_MS) }
  const onOnline = () => pullAgain(0)
  // a page restored from the back-forward cache is the same as one that was hidden
  const onShow = (e: PageTransitionEvent) => { if (e.persisted) pullAgain(0) }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  window.addEventListener('pageshow', onShow)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('pageshow', onShow)
  }
}

/* ── realtime: someone else's write lands in this browser's cache ──
   One channel on the events table; every insert/update/delete rewrites the
   matching cache row and announces EVENTS_SYNCED. Returns an unsubscribe. */
export function startRealtime(): () => void {
  if (!backendOn) return () => {}
  const channel = supabase!
    .channel('events-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
      const list = readCache()
      if (payload.eventType === 'DELETE') {
        const gone = (payload.old as { id?: string }).id
        writeCache(list.filter((e) => e.id !== gone), true)
        return
      }
      const ev = (payload.new as { data: AppEvent }).data
      const i = list.findIndex((e) => e.id === ev.id)
      /* The document arrives without the things that no longer live in it, and a
         document echo must not take them away from the cache. Chat has always been
         one; since 0008 so are availability, the ballot and the explicit empty reply,
         which were folded in from their own rows and are nowhere in this payload.
         Dropping them sent availability back to the per-cell `avail`, which is
         whole-slot only — a time marked to 8:20 snapped back out to the whole 8:00
         slot the moment this echo of your own write arrived. Keep what the cache has
         unless the document actually carries a copy (a database without the rows).
         Reads are open, so the channel carries everyone's events — only the ones
         already here, or that belong to this identity, are allowed into the cache. */
      if (i >= 0) {
        const had = list[i]
        list[i] = {
          ...localize(ev, had),
          messages: withoutRemoved(had.messages, ev),
          availIv: ev.availIv ?? had.availIv,
          votes: ev.votes ?? had.votes,
          unavailableIds: ev.unavailableIds ?? had.unavailableIds,
        }
      } else if (isMine(ev)) {
        list.push({ ...localize(ev), messages: [] })
        refreshAnswers(ev.id) // an event new to this browser has its answers in rows
      } else return
      writeCache(list, true)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const row = payload.new as MessageRow
      const list = readCache()
      if (!list.some((e) => e.id === row.event_id)) return // not a room this browser is in
      writeCache(mergeMessages(list, [row]), true)
    })
    // a line taken out of the chat (its writer was removed from the event) leaves every
    // open copy too; matched by the message's own id, which a merge never rewrites
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
      const mid = (payload.old as { id?: string }).id
      if (!mid) return
      const list = readCache()
      if (!list.some((e) => e.messages.some((m) => m.mid === mid))) return
      writeCache(list.map((e) => (e.messages.some((m) => m.mid === mid) ? { ...e, messages: e.messages.filter((m) => m.mid !== mid) } : e)), true)
    })
    // someone marked their times or moved a vote. Both tables are published whole, so
    // a delete still names its event; the refresh itself is debounced.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, (payload) => {
      const id = (payload.new as { event_id?: string }).event_id ?? (payload.old as { event_id?: string }).event_id
      if (id) refreshAnswers(id)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, (payload) => {
      const id = (payload.new as { event_id?: string }).event_id ?? (payload.old as { event_id?: string }).event_id
      if (id) refreshAnswers(id)
    })
    // the socket coming back is the moment the cache may have fallen behind
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (socketDown) { socketDown = false; pullAgain(0) }
      } else socketDown = true // TIMED_OUT, CHANNEL_ERROR or CLOSED: the next join catches up
    })
  return () => { void supabase!.removeChannel(channel) }
}

/* ── reply activity ──
   The host may have asked to hear when someone answers (Settings, off by default).
   Asked once per event per visit from here; the route keeps it to once per person
   per event for good, whatever this browser remembers. Best effort, never waited
   for: the answer is saved either way, and there is no session to carry, since
   the person answering is a guest as often as not. */
const told = new Set<string>()
function tellHost(eventId: string, participantId: string): void {
  if (process.env.NEXT_PUBLIC_MAIL_ON !== '1' || told.has(eventId)) return
  told.add(eventId)
  void fetch('/api/mail/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, participantId }) }).catch(() => { /* the host hears next time */ })
}

/* ── sign-out: the account's events leave with it ──
   Everything pulled for the account is dropped; only events this browser joined
   as a guest stay, since those were never the account's to begin with. Without
   this, the next person at the keyboard would find the last one's plans. */
export function forgetCloudEvents(): void {
  if (!backendOn) return
  const keep = new Set(guestSessionEventIds())
  writeCache(readCache().filter((e) => keep.has(e.id)), true)
}
