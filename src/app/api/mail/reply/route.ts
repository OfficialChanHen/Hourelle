// "Reply activity": a host who asked for it hears when someone answers. The call
// comes from the browser of the person who answered, a guest as often as not, so
// there is no session to check. The availability row is the proof that an answer
// exists, the host's own switch (off by default) is the permission, and the log
// key, one per person per event, is what keeps this to a single message however
// often the person edits or the request is repeated.

import { NextResponse } from 'next/server'
import type { AppEvent } from '@/lib/events'
import { emailsFor, eventRow, lastMailRefusal, mailConfigured, prefsFor, replyMail, sendOnce, serverDb, siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'

type Body = { eventId?: string; participantId?: string }
type AnswerRow = { participant_id: string; unavailable: boolean | null; intervals: Record<string, unknown[]> | null }

export async function POST(req: Request) {
  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const eventId = (body.eventId ?? '').slice(0, 200)
  const participantId = (body.participantId ?? '').slice(0, 200)
  if (!eventId || !participantId) return NextResponse.json({ error: 'Which answer?' }, { status: 400 })
  if (!mailConfigured) return NextResponse.json({ error: 'Email is not set up on this server yet.' }, { status: 503 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  const { data } = await eventRow(db, eventId)
  const row = data as { id: string; data: AppEvent; host_id: string | null } | null
  if (!row || row.data.demo) return NextResponse.json({ sent: false, reason: 'no such event' }, { status: 404 })
  const ev = row.data
  const host = ev.participants.find((p) => p.host)
  const p = ev.participants.find((x) => x.id === participantId && !x.host)
  // a host with no account has no switch and no address on file
  if (!host || !p || !row.host_id) return NextResponse.json({ sent: false, reason: 'nobody to tell' })

  // the host's own say, and it is off unless they turned it on
  const pref = (await prefsFor(db, [host.id])).get(host.id)
  if (!pref || pref.email === false || pref.replies !== true) return NextResponse.json({ sent: false, reason: 'not wanted' })

  // an answer has to exist before anyone is told about it
  const { data: rows } = await db.from('availability').select('participant_id, unavailable, intervals').eq('event_id', ev.id)
  const answered = ((rows ?? []) as AnswerRow[]).filter((r) => r.participant_id !== host.id && (r.unavailable || Object.values(r.intervals ?? {}).some((v) => v.length > 0)))
  if (!answered.some((r) => r.participant_id === p.id)) return NextResponse.json({ sent: false, reason: 'no answer yet' })

  const to = (await emailsFor(db, [host])).get(host.id)
  if (!to) return NextResponse.json({ sent: false, reason: 'no address' })
  const total = ev.participants.filter((x) => !x.host).length
  const r = await sendOnce(db, `${ev.id}:${p.id}:reply`, { eventId: ev.id, participantId: p.id, kind: 'reply' }, replyMail(ev, p, host, to, siteUrl(req), answered.length, total))
  return NextResponse.json({ sent: r === 'sent', already: r === 'already', ...(r === 'failed' ? { reason: lastMailRefusal() } : {}) })
}
