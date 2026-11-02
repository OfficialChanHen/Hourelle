// Opening the next plan of a repeating series, on the server, so nobody has to be
// in the app when one ends. The daily cron sweeps every repeating plan; the app also
// asks about the plans it has in view (api/repeats), which opens a copy within a
// page load of anyone on the plan coming back. Both land here.
//
// Made once: the old plan is claimed first, by writing the copy's id into it only
// where no copy's id is there yet. Whoever loses that race writes nothing. Then the
// copy is inserted, gets its own cover, and the people with an address get their
// link to it. Needs the service key: the insert policy only admits a host.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppEvent } from '@/lib/events'
import { linkToken, todayKey } from '@/lib/events'
import { isDue, nextPlanDoc } from '@/lib/repeat'
import { emailsFor, inviteMail, mailConfigured, sendOnce, siteUrl } from './mail'

type Row = { id: string; data: AppEvent; host_id: string | null }
export type Opened = { from: string; id: string; title: string }

// the covers bucket (lib/covers.ts is a browser module, so the name is repeated here)
const COVER_BUCKET = 'covers'
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'

/** Open the copy of every due repeating plan, or of the given ones only. */
export async function openRepeats(db: SupabaseClient, ids?: string[], req?: Request): Promise<{ opened: Opened[]; error?: string }> {
  let q = db.from('events').select('id, data, host_id').not('data->repeat', 'is', null).is('data->repeat->>nextId', null).eq('status', 'confirmed')
  if (ids) q = q.in('id', ids.slice(0, 50))
  const { data, error } = await q.limit(500)
  if (error) return { opened: [], error: error.message }
  const opened: Opened[] = []
  for (const row of (data ?? []) as Row[]) {
    const prev = row.data
    if (!prev || !isDue(prev)) continue
    const next = nextPlanDoc(prev, `${slug(prev.title)}-${linkToken()}`, todayKey(), Date.now())
    // claim the old plan: only one caller sees a row come back
    const claimed = { ...prev, repeat: { ...prev.repeat!, nextId: next.id } }
    const { data: won, error: claimError } = await db.from('events').update({ data: claimed }).eq('id', row.id).is('data->repeat->>nextId', null).select('id')
    if (claimError || !won?.length) continue
    const { error: insertError } = await db.from('events').insert({ id: next.id, data: next, host_id: row.host_id })
    if (insertError) {
      // give the claim back, so the next run tries again
      await db.from('events').update({ data: prev }).eq('id', row.id)
      continue
    }
    if (next.image) await copyCover(db, next)
    if (mailConfigured) await invite(db, next, req)
    opened.push({ from: prev.id, id: next.id, title: next.title })
  }
  return { opened }
}

// the copy's cover is a copy of the file too, in its own folder, so deleting an old
// plan of the series never takes the newer ones' picture with it
async function copyCover(db: SupabaseClient, ev: AppEvent) {
  const marker = `/storage/v1/object/public/${COVER_BUCKET}/`
  const at = ev.image!.indexOf(marker)
  if (at < 0) return
  const from = decodeURIComponent(ev.image!.slice(at + marker.length).split('?')[0])
  const to = `${ev.id}/${linkToken(16)}.jpg`
  const { error } = await db.storage.from(COVER_BUCKET).copy(from, to)
  if (error) return
  const url = db.storage.from(COVER_BUCKET).getPublicUrl(to).data.publicUrl
  await db.from('events').update({ data: { ...ev, image: url } }).eq('id', ev.id)
}

// everyone with an address gets the new plan's link, once
async function invite(db: SupabaseClient, ev: AppEvent, req?: Request) {
  const people = ev.participants.filter((p) => !p.host && (p.guest ? !!p.email : true))
  const emails = await emailsFor(db, people)
  const site = siteUrl(req)
  for (const p of people) {
    const to = emails.get(p.id)
    if (to) await sendOnce(db, `${ev.id}:${p.id}:invite`, { eventId: ev.id, participantId: p.id, kind: 'invite' }, inviteMail(ev, p, to, site, null))
  }
}
