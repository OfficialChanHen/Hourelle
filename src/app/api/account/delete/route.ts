// Delete an account, and everything that only makes sense with it: the events the
// person hosts, their seat on everyone else's events, their chat messages, and the
// account itself. Needs the service key, because a user cannot delete their own
// auth row from a browser; without it the route says so and the page offers the
// old way (write to us).

import { NextResponse } from 'next/server'
import type { AppEvent } from '@/lib/events'
import { hasServiceKey, serverDb, userFromRequest } from '@/lib/server/db'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  if (!hasServiceKey) return NextResponse.json({ error: 'Deleting accounts is not switched on for this server yet.' }, { status: 503 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })
  const uid = user.id

  // 1. the events they host go with them
  const hosted = await db.from('events').delete().eq('host_id', uid).select('id')
  if (hosted.error) return NextResponse.json({ error: hosted.error.message }, { status: 500 })

  // 2. their seat on other people's events is removed: the participant entry, their
  //    marked times, their votes, and their "none of these days" reply
  const { data: rows, error } = await db.from('events').select('id, data').filter('data->participants', 'cs', JSON.stringify([{ id: uid }]))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let left = 0
  for (const row of (rows ?? []) as { id: string; data: AppEvent }[]) {
    const ev = row.data
    const next: AppEvent = {
      ...ev,
      participants: ev.participants.filter((p) => p.id !== uid),
      availIv: ev.availIv ? Object.fromEntries(Object.entries(ev.availIv).map(([day, byPid]) => [day, Object.fromEntries(Object.entries(byPid).filter(([pid]) => pid !== uid))])) : ev.availIv,
      votes: ev.votes ? Object.fromEntries(Object.entries(ev.votes).map(([place, ids]) => [place, ids.filter((id) => id !== uid)])) : ev.votes,
      unavailableIds: ev.unavailableIds?.filter((id) => id !== uid),
    }
    const { error: e2 } = await db.from('events').update({ data: { ...next, messages: [] } }).eq('id', row.id)
    if (!e2) left++
  }

  // 3. what they said in chat, and 4. the account (its profile cascades)
  await db.from('messages').delete().eq('participant_id', uid)
  const { error: e3 } = await db.auth.admin.deleteUser(uid)
  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })

  return NextResponse.json({ ok: true, hostedDeleted: hosted.data?.length ?? 0, left })
}
