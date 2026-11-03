// "Nudge": the host asks the people who have not marked their times to do so.
// With `ask` it is the other ask: the best time so far works for everyone but these
// one or two people, so can they make it? One of each per person per day (the log
// key carries the date), so a host can press the button twice without anyone getting
// two emails.

import { NextResponse } from 'next/server'
import type { AppEvent } from '@/lib/events'
import { userFromRequest } from '@/lib/server/db'
import { askMail, askSlot, emailsFor, eventRow, lastMailRefusal, mailConfigured, nudgeMail, sendOnce, serverDb, siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'

type Body = { eventId?: string; participantIds?: string[]; ask?: unknown }

export async function POST(req: Request) {
  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const eventId = (body.eventId ?? '').slice(0, 200)
  const ids = (body.participantIds ?? []).slice(0, 200)
  if (!eventId || !ids.length) return NextResponse.json({ error: 'Who should be nudged?' }, { status: 400 })
  if (!mailConfigured) return NextResponse.json({ error: 'Email is not set up on this server yet.' }, { status: 503 })

  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Log in to send nudges.' }, { status: 401 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  const { data } = await eventRow(db, eventId)
  const row = data as { id: string; data: AppEvent; host_id: string | null } | null
  if (!row) return NextResponse.json({ error: 'That plan is not on the server.' }, { status: 404 })
  if (row.host_id !== user.id) return NextResponse.json({ error: 'Only the host can send nudges.' }, { status: 403 })

  const ev = row.data
  const at = body.ask === undefined ? null : askSlot(ev, body.ask)
  if (body.ask !== undefined && !at) return NextResponse.json({ error: 'That time is not on this plan.' }, { status: 400 })
  const wanted = new Set(ids)
  const people = ev.participants.filter((p) => wanted.has(p.id) && !p.host)
  const emails = await emailsFor(db, people)
  const site = siteUrl(req)
  const day = new Date().toISOString().slice(0, 10)

  const sent: string[] = [], noEmail: string[] = [], already: string[] = [], failed: string[] = []
  for (const p of people) {
    const to = emails.get(p.id)
    if (!to) { noEmail.push(p.id); continue }
    const r = at
      ? await sendOnce(db, `${ev.id}:${p.id}:ask:${day}`, { eventId: ev.id, participantId: p.id, kind: 'ask' }, askMail(ev, p, to, site, at, people.length - 1, user.email))
      : await sendOnce(db, `${ev.id}:${p.id}:nudge:${day}`, { eventId: ev.id, participantId: p.id, kind: 'nudge' }, nudgeMail(ev, p, to, site, user.email))
    ;(r === 'sent' ? sent : r === 'already' ? already : failed).push(p.id)
  }
  return NextResponse.json({ sent, already, noEmail, failed, ...(failed.length ? { reason: lastMailRefusal() } : {}) })
}
