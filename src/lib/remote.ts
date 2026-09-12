// Phase 4, steps 2–3: the sync layer between localStorage and Supabase.
// The UI never waits on the network: every read stays a synchronous localStorage
// read, and this module moves data in the background — pull on page load, push
// after each local write, and a realtime subscription for other people's writes.
// When `backendOn` is false every function here is a silent no-op.

import { supabase, backendOn } from './db'
import { currentAccount } from './session'
import type { AppEvent, ChatMessage } from './events'

// fired on window whenever the cloud changed the local cache, so any open page
// can re-read if it wants live updates (roadmap step 7 wires the listeners)
export const EVENTS_SYNCED = 'aline:events-synced'
const KEY = 'aline.events.v1'

function readCache(): AppEvent[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as AppEvent[] } catch { return [] }
}
function writeCache(list: AppEvent[], announce: boolean) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota / private mode */ }
  if (announce) window.dispatchEvent(new Event(EVENTS_SYNCED))
}

// fired when the database refuses a write, so the UI can say so instead of leaving
// a local change that silently never reached anyone else
export const PUSH_REJECTED = 'aline:push-rejected'
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
  console.warn(`aline: ${action} refused by the database — ${message}`)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PUSH_REJECTED, { detail: { action, message } }))
  }
}

/* ── push: local change → cloud, fire-and-forget ──
   Writes are optimistic: localStorage already has the change and the UI moved on.
   Since row policies and the field trigger can now say no, a refusal is announced
   rather than swallowed — an offline queue is still a later refinement. */
// messages travel as their own rows (see pushMessage), never inside the document —
// otherwise every save would carry the whole chat and overwrite everyone else's
const docOf = (ev: AppEvent) => ({ ...ev, messages: [] })

/* An existing event is UPDATED, never upserted. An upsert is an insert first, and
   the insert policy only admits the host — so a guest marking availability on
   someone else's event would be refused before the update policy ever saw it. */
export function pushEvent(ev: AppEvent): void {
  if (!backendOn) return
  void supabase!
    .from('events')
    .update({ data: docOf(ev), host_id: hostIdOf(ev) })
    .eq('id', ev.id)
    .then(({ error }) => { if (error) rejected('save', error.message) })
}

/* A brand-new event is inserted: the one path the insert policy is for. */
export function pushNewEvent(ev: AppEvent): void {
  if (!backendOn) return
  void supabase!
    .from('events')
    .insert({ id: ev.id, data: docOf(ev), host_id: hostIdOf(ev) })
    .then(({ error }) => { if (error) rejected('create', error.message) })
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
  let merged = i >= 0 ? list.map((e, k) => (k === i ? { ...localize(ev, e), messages: e.messages } : e)) : [...list, { ...localize(ev), messages: [] }]
  const { data: rows } = await supabase!.from('messages').select('*').eq('event_id', id).order('at', { ascending: true })
  if (rows) merged = mergeMessages(merged, rows as MessageRow[])
  writeCache(merged, true)
  return true
}

/* ── chat: one row per message ──
   Appending a row cannot clobber anyone, which a whole-document write could. The
   client mints the row id (mid) so the realtime echo of our own insert is recognised
   and not shown twice. */
type MessageRow = { id: string; event_id: string; participant_id: string; name: string; body: string; system: boolean; at: number }

function rowToMessage(r: MessageRow): ChatMessage {
  return { mid: r.id, id: r.participant_id, name: r.name, text: r.body, at: Number(r.at), time: '', you: false, system: r.system || undefined }
}

export function pushMessage(eventId: string, m: ChatMessage): void {
  if (!backendOn) return
  void supabase!
    .from('messages')
    // a message id is minted once and never changes, so a second push of the same
    // line (a re-sync, a retry) is a no-op rather than a duplicate-key refusal
    .upsert({ id: m.mid, event_id: eventId, participant_id: m.id, name: m.name, body: m.text, system: !!m.system, at: m.at ?? Date.now() }, { onConflict: 'id', ignoreDuplicates: true })
    .then(({ error }) => { if (error) rejected('message', error.message) })
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
    const merged = [...e.messages, ...incoming.filter((m) => !have.has(m.mid))]
    merged.sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    return { ...e, messages: merged }
  })
}

export function pushDelete(id: string): void {
  if (!backendOn) return
  void supabase!
    .from('events')
    .delete()
    .eq('id', id)
    .then(({ error }) => { if (error) rejected('delete', error.message) })
}

/* ── whose events are these ──
   Reads are open at the database (the link is the permission), so scoping has to
   happen here: only events this identity is part of are pulled, listed, or accepted
   from realtime. "Part of" means: host, a participant by account id, a participant
   by the email the account signed up with (a guest entry made before the account
   existed — this is how those events follow you in), or an event this browser
   holds a guest session for. Without a backend the browser owns everything in it. */
const GUEST_KEY_PREFIX = 'aline.me.'
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
/** Has the first pull of this visit finished (well or badly)? Pages that would
 *  otherwise declare an event missing wait for this before deciding. */
export function cloudSynced(): boolean {
  return !backendOn || pulledOnce
}

export async function syncFromCloud(): Promise<void> {
  if (!backendOn) return
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
    console.warn('aline: pull failed', failed.error.message)
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
  let merged = local.map((e) => { const c = cloud.get(e.id); return c ? { ...localize(c, e), messages: e.messages } : e })
  for (const [id, ev] of cloud) if (!local.some((e) => e.id === id)) merged.push({ ...localize(ev), messages: [] })
  const ids = merged.map((e) => e.id)
  if (ids.length) {
    const { data: rows } = await supabase!.from('messages').select('*').in('event_id', ids).order('at', { ascending: true })
    if (rows) merged = mergeMessages(merged, rows as MessageRow[])
  }
  writeCache(merged, true)

  // events this device made before the backend existed go up whole, chat included.
  // "Not in the pull" is not enough to mean "born here": a visitor who opened an
  // invite has that event cached and is part of nothing, so the pull brings nothing —
  // only an event this identity is actually part of can be one of its own.
  for (const e of local) if (!cloud.has(e.id) && isMine(e)) {
    void supabase!.from('events').upsert({ id: e.id, data: docOf(e), host_id: hostIdOf(e) }).then(({ error }) => { if (error) rejected('save', error.message) })
    for (const m of e.messages) pushMessage(e.id, { ...m, mid: m.mid ?? crypto.randomUUID() })
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
      // the document arrives without its chat: keep the messages this browser has.
      // Reads are open, so the channel carries everyone's events — only the ones
      // already here, or that belong to this identity, are allowed into the cache
      if (i >= 0) list[i] = { ...localize(ev, list[i]), messages: list[i].messages }
      else if (isMine(ev)) list.push({ ...localize(ev), messages: [] })
      else return
      writeCache(list, true)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const row = payload.new as MessageRow
      const list = readCache()
      if (!list.some((e) => e.id === row.event_id)) return // not a room this browser is in
      writeCache(mergeMessages(list, [row]), true)
    })
    .subscribe()
  return () => { void supabase!.removeChannel(channel) }
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
