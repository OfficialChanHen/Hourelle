// Finish taking someone off an event: delete their chat lines, and their availability
// and votes rows for good measure. No browser may delete a message, so this runs
// here with the service key. It trusts nothing from the request but the ids: the
// event row decides, and only an id the row lists in removedIds and no longer has
// on its roster is cleared. A merge also takes an id off the roster, but never puts
// it in removedIds, so a merged person's lines can never be deleted from here.

import { NextResponse } from 'next/server'
import type { AppEvent } from '@/lib/events'
import { hasServiceKey, serverDb } from '@/lib/server/db'

export const runtime = 'nodejs'

type Body = { eventId?: string; participantIds?: string[] }

export async function POST(req: Request) {
  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const eventId = (body.eventId ?? '').slice(0, 200)
  const asked = (body.participantIds ?? []).filter((x) => typeof x === 'string').slice(0, 50)
  if (!eventId || !asked.length) return NextResponse.json({ error: 'Which people?' }, { status: 400 })
  if (!hasServiceKey) return NextResponse.json({ error: 'The server cannot delete messages without its service key.' }, { status: 503 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  // the removal was written a moment ago and may still be on its way up
  const gone = (ev: AppEvent, id: string) => (ev.removedIds ?? []).includes(id) && !ev.participants.some((p) => p.id === id)
  let ev: AppEvent | null = null
  for (let i = 0; i < 6; i++) {
    if (i) await new Promise((r) => setTimeout(r, 700))
    const { data } = await db.from('events').select('data').eq('id', eventId).maybeSingle()
    ev = (data?.data as AppEvent | undefined) ?? null
    if (ev && asked.every((id) => gone(ev!, id))) break
  }
  if (!ev) return NextResponse.json({ error: 'No such event.' }, { status: 404 })
  const ids = asked.filter((id) => gone(ev!, id))
  if (!ids.length) return NextResponse.json({ cleared: 0 })

  const [m, a, v] = await Promise.all([
    db.from('messages').delete({ count: 'exact' }).eq('event_id', eventId).in('participant_id', ids),
    db.from('availability').delete().eq('event_id', eventId).in('participant_id', ids),
    db.from('votes').delete().eq('event_id', eventId).in('participant_id', ids),
  ])
  const err = m.error ?? a.error ?? v.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ cleared: ids.length, messages: m.count ?? 0 })
}
