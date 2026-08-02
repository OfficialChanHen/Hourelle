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

/* ── push: local change → cloud, fire-and-forget ──
   Writes are optimistic: localStorage already has the change and the UI moved on.
   A failed push only logs — an offline queue is a later refinement. */
export function pushEvent(ev: AppEvent): void {
  if (!backendOn) return
  void supabase!
    .from('events')
    .upsert({ id: ev.id, data: ev })
    .then(({ error }) => { if (error) console.warn('aline: push failed', error.message) })
}

export function pushDelete(id: string): void {
  if (!backendOn) return
  void supabase!
    .from('events')
    .delete()
    .eq('id', id)
    .then(({ error }) => { if (error) console.warn('aline: delete failed', error.message) })
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
