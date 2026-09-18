// The lock-in announcement. The host locks in a time and place; everyone on the
// list hears about it once, with the calendar entry attached, unless their account
// has this kind of mail switched off. A later lock-in is a new plan and goes out
// again: the once-key carries the lock-in's timestamp.

import { NextResponse } from 'next/server'
import type { AppEvent } from '@/lib/events'
import { userFromRequest } from '@/lib/server/db'
import { emailsFor, eventRow, lockedMail, mailConfigured, prefsFor, sendOnce, serverDb, siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'

type Body = { eventId?: string; confirmedAt?: number }

export async function POST(req: Request) {
  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const eventId = (body.eventId ?? '').slice(0, 200)
  if (!eventId) return NextResponse.json({ error: 'Which event?' }, { status: 400 })
  if (!mailConfigured) return NextResponse.json({ error: 'Email is not set up on this server yet.' }, { status: 503 })

  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Log in to send this.' }, { status: 401 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  // the lock-in was written a moment ago and may still be on its way up: wait for
  // the row to carry it before writing to anyone about it
  type Row = { id: string; data: AppEvent; host_id: string | null }
  let row: Row | null = null
  for (let i = 0; i < 8; i++) {
    const { data } = await eventRow(db, eventId)
    const r = (data as Row | null) ?? null
    if (r && r.data.status === 'confirmed' && r.data.confirmed && (!body.confirmedAt || (r.data.confirmedAt ?? 0) >= body.confirmedAt)) { row = r; break }
    await new Promise((res) => setTimeout(res, 700))
  }
  if (!row) return NextResponse.json({ error: 'The lock-in has not reached the server yet. The announcement was not sent.' }, { status: 409 })
  if (row.host_id !== user.id) return NextResponse.json({ error: 'Only the host can announce a lock-in.' }, { status: 403 })

  const ev = row.data
  const people = ev.participants.filter((p) => !p.host && (p.guest ? !!p.email : true))
  const emails = await emailsFor(db, people)
  const prefs = await prefsFor(db, people.map((p) => p.id))
  const site = siteUrl(req)
  const stamp = ev.confirmedAt ?? 0

  let sent = 0, already = 0, failed = 0, skipped = 0
  for (const p of people) {
    const to = emails.get(p.id)
    if (!to) { skipped++; continue }
    const pref = prefs.get(p.id)
    if (pref && (pref.email === false || pref.lockIn === false)) { skipped++; continue }
    const r = await sendOnce(db, `${ev.id}:${p.id}:locked:${stamp}`, { eventId: ev.id, participantId: p.id, kind: 'locked' }, lockedMail(ev, p, to, site, user.email))
    if (r === 'sent') sent++; else if (r === 'already') already++; else failed++
  }
  return NextResponse.json({ sent, already, failed, skipped, total: people.length })
}
