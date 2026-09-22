// A guest who joins with their email gets their personal link, once. The guest has
// no session to prove anything with, so the route trusts nothing from the request
// but two ids: the event row says whether that entry exists, is a guest's, carries
// an email and a link, and the mail goes only to that address. The email log makes
// it once per entry for good, so calling this again sends nothing; without the
// service key there is no log to hold that line, and the route declines.

import { NextResponse } from 'next/server'
import type { AppEvent } from '@/lib/events'
import { hasServiceKey } from '@/lib/server/db'
import { eventRow, joinedMail, lastMailRefusal, mailConfigured, sendOnce, serverDb, siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'

type Body = { eventId?: string; participantId?: string }

export async function POST(req: Request) {
  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const eventId = (body.eventId ?? '').slice(0, 200)
  const pid = (body.participantId ?? '').slice(0, 200)
  if (!eventId || !pid) return NextResponse.json({ error: 'Which entry?' }, { status: 400 })
  if (!mailConfigured) return NextResponse.json({ error: 'Email is not set up on this server yet.' }, { status: 503 })
  if (!hasServiceKey) return NextResponse.json({ error: 'The email log is not available, so this cannot be sent safely.' }, { status: 503 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  // the join was written a moment ago and may still be on its way up
  type Row = { id: string; data: AppEvent }
  let row: Row | null = null
  for (let i = 0; i < 6; i++) {
    if (i) await new Promise((r) => setTimeout(r, 700))
    const { data } = await eventRow(db, eventId)
    row = (data as Row | null) ?? null
    if (row?.data.participants.some((p) => p.id === pid)) break
  }
  const p = row?.data.participants.find((x) => x.id === pid)
  if (!row || !p) return NextResponse.json({ error: 'That entry has not reached the server yet.' }, { status: 409 })
  if (!p.guest || !p.email || !p.inviteToken) return NextResponse.json({ sent: false, reason: 'Nothing to send for this entry.' })

  const r = await sendOnce(db, `${row.id}:${p.id}:joined`, { eventId: row.id, participantId: p.id, kind: 'joined' }, joinedMail(row.data, p, p.email, siteUrl(req)))
  return NextResponse.json({ sent: r === 'sent', already: r === 'already', ...(r === 'failed' ? { reason: lastMailRefusal() } : {}) })
}
