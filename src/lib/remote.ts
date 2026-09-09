// Phase 4, steps 2–3: the sync layer between localStorage and Supabase.
// The UI never waits on the network: every read stays a synchronous localStorage
// read, and this module moves data in the background — pull on page load, push
// after each local write, and a realtime subscription for other people's writes.
// When `backendOn` is false every function here is a silent no-op.

import { supabase, backendOn } from './db'
import type { AppEvent } from './events'

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
export function pushEvent(ev: AppEvent): void {
  if (!backendOn) return
  void supabase!
    .from('events')
    .upsert({ id: ev.id, data: ev, host_id: hostIdOf(ev) })
    .then(({ error }) => { if (error) rejected('save', error.message) })
}

export function pushDelete(id: string): void {
  if (!backendOn) return
  void supabase!
    .from('events')
    .delete()
    .eq('id', id)
    .then(({ error }) => { if (error) rejected('delete', error.message) })
}

/* ── pull: cloud → local cache, once per page load ──
   The cloud copy wins for any event it knows about; events that exist only on
   this device (created while offline or before the backend) get pushed up. */
export async function syncFromCloud(): Promise<void> {
  if (!backendOn) return
  const { data, error } = await supabase!.from('events').select('id, data')
  if (error || !data) { if (error) console.warn('aline: pull failed', error.message); return }

  const cloud = new Map(data.map((r) => [r.id as string, r.data as AppEvent]))
  const local = readCache()
  const merged = local.map((e) => cloud.get(e.id) ?? e)
  for (const [id, ev] of cloud) if (!local.some((e) => e.id === id)) merged.push(ev)
  writeCache(merged, true)

  for (const e of local) if (!cloud.has(e.id)) pushEvent(e)
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
      if (i >= 0) list[i] = ev
      else list.push(ev)
      writeCache(list, true)
    })
    .subscribe()
  return () => { void supabase!.removeChannel(channel) }
}
