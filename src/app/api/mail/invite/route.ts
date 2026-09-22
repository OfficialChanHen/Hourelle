// Email the personal invite links. The host asks (their session proves who they
// are); the event row says who was invited by email; each of them gets a message
// with their own link, once — unless the host explicitly asks to send one again.

import { NextResponse } from 'next/server'
import type { AppEvent } from '@/lib/events'
import { userFromRequest } from '@/lib/server/db'
import { emailsFor, eventRow, inviteMail, lastMailRefusal, mailConfigured, sendOnce, serverDb, siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'

type Body = { eventId?: string; participantIds?: string[]; again?: boolean }

export async function POST(req: Request) {
  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const eventId = (body.eventId ?? '').slice(0, 200)
  if (!eventId) return NextResponse.json({ error: 'Which event?' }, { status: 400 })
  if (!mailConfigured) return NextResponse.json({ error: 'Email is not set up on this server yet.' }, { status: 503 })

  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Log in to send invites.' }, { status: 401 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  // the event was just created and its row may still be on its way up, and so may
  // the people this call is about: the browser writes the roster and asks for the
  // mail in the same breath, without waiting for the write to land. So wait for the
  // row, and then for the names it was asked to write to, rather than mailing an
  // older copy of the roster and reporting that there was nobody to mail.
  type Row = { id: string; data: AppEvent; host_id: string | null }
  const wanted = body.participantIds?.length ? new Set(body.participantIds) : null
  const ready = (r: Row | null) => {
    if (!r) return false
    if (!wanted) return true
    const have = new Set(r.data.participants.map((p) => p.id))
    return [...wanted].every((id) => have.has(id))
  }
  let row: Row | null = null
  for (let i = 0; i < 6 && !ready(row); i++) {
    if (i) await new Promise((r) => setTimeout(r, 700))
    const { data } = await eventRow(db, eventId)
    row = (data as Row | null) ?? null
  }
  if (!row) return NextResponse.json({ error: 'That event has not reached the server yet. Try again in a moment.' }, { status: 409 })
  if (row.host_id !== user.id) return NextResponse.json({ error: 'Only the host can send invites.' }, { status: 403 })

  const ev = row.data
  // guests need an address on their entry; an account invitee's comes from their
  // profile (emailsFor). The host never mails themselves.
  const people = ev.participants.filter((p) => !p.host && (p.guest ? !!p.email : true) && (!wanted || wanted.has(p.id)))
  const emails = await emailsFor(db, people)
  const site = siteUrl(req)

  let sent = 0, already = 0, failed = 0
  for (const p of people) {
    const to = emails.get(p.id)
    if (!to) continue
    // one invitation, one mail. A person removed and invited again is a new
    // invitation, not a repeat of the old one, and their entry says when it was
    // made; without that stamp (anyone invited before this existed) the key stays
    // exactly as it was, so nobody gets yesterday's invite twice.
    const key = p.invitedAt ? `${ev.id}:${p.id}:${p.invitedAt}:invite` : `${ev.id}:${p.id}:invite`
    const r = await sendOnce(db, key, { eventId: ev.id, participantId: p.id, kind: 'invite' }, inviteMail(ev, p, to, site, user.email), !!body.again)
    if (r === 'sent') sent++; else if (r === 'already') already++; else failed++
  }
  // the counts say how many; the reason says why, when any did not go
  return NextResponse.json({ sent, already, failed, total: people.length, ...(failed ? { reason: lastMailRefusal() } : {}) })
}
