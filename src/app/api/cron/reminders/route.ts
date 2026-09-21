// The reminder job. Vercel Cron calls this on a schedule (see vercel.json); it may
// also be called by hand with the secret. Every run looks at every event that has
// something coming up, works out what is due in the event's own timezone, and
// sends each person their reminder once — the email log's unique key is what makes
// "once" true no matter how often the job runs.
//
// Two reminders per happening: the day before ("-eve") and the day of ("-day").
// A daily schedule sends each on the first run after it becomes due; an hourly
// schedule sends it within the hour. Nothing here depends on the hour of day.
//
// `?dry=1` runs the same sums and sends nothing: what is due, to how many, and how
// many of those cannot be reached or have opted out. It is how the job is checked
// without writing to anyone, and it works before the service key or the mail key
// is in place, since it reads only what any visitor could.

import { NextResponse } from 'next/server'
import type { AppEvent } from '@/lib/events'
import { hasServiceKey } from '@/lib/server/db'
import { emailsFor, lastMailRefusal, mailConfigured, prefsFor, reminderMail, sendOnce, serverDb, siteUrl } from '@/lib/server/mail'
import { dueFor } from '@/lib/server/reminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Row = { id: string; data: AppEvent; host_id: string | null }

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  if (!mailConfigured && !dry) return NextResponse.json({ ran: false, reason: 'RESEND_API_KEY is not set' })
  if (!hasServiceKey && !dry) return NextResponse.json({ ran: false, reason: 'SUPABASE_SERVICE_ROLE_KEY is not set' })
  const db = serverDb()
  if (!db) return NextResponse.json({ ran: false, reason: 'no database' })

  // every event with a date that could be due: locked-in ones, and planning ones
  // carrying a deadline. The jsonb filters keep the scan to rows that matter.
  const { data, error } = await db
    .from('events')
    .select('id, data, host_id')
    .or('status.eq.confirmed,data->>planDeadline.not.is.null,data->>voteDeadline.not.is.null')
    .limit(2000)
  if (error) return NextResponse.json({ ran: false, reason: error.message }, { status: 500 })

  const now = new Date()
  const site = siteUrl()
  const totals = { sent: 0, already: 0, failed: 0, skipped: 0, events: 0, due: 0 }
  const cap = 300 // one run's ceiling; the rest goes next run, nothing is lost
  // the dry run's answer: one line per reminder that is due, with names of events
  // only, never addresses
  const preview: { event: string; kind: string; day: string; people: number; noEmail: number; optedOut: number }[] = []

  for (const row of (data ?? []) as Row[]) {
    const ev = row.data
    if (!ev || ev.demo) continue
    const due = dueFor(ev, now)
    if (!due.length) continue
    totals.events++
    const everyone = [...new Map(due.flatMap((d) => d.people).map((p) => [p.id, p])).values()]
    const emails = await emailsFor(db, everyone)
    const prefs = await prefsFor(db, everyone.map((p) => p.id))
    for (const d of due) {
      const line = { event: ev.title, kind: d.kind, day: d.day, people: d.people.length, noEmail: 0, optedOut: 0 }
      for (const p of d.people) {
        const to = emails.get(p.id)
        if (!to) { totals.skipped++; line.noEmail++; continue }
        const pref = prefs.get(p.id)
        // the account's own say: email off means no reminder by mail at all, and each
        // kind can be switched off on its own
        if (pref && (pref.email === false || pref[d.pref] === false)) { totals.skipped++; line.optedOut++; continue }
        totals.due++
        if (dry) continue
        if (totals.sent >= cap) break
        const r = await sendOnce(db, `${ev.id}:${p.id}:${d.kind}:${d.day}`, { eventId: ev.id, participantId: p.id, kind: d.kind }, reminderMail(d.kind, ev, p, to, site))
        totals[r === 'sent' ? 'sent' : r === 'already' ? 'already' : 'failed']++
      }
      if (dry) preview.push(line)
    }
  }
  if (dry) return NextResponse.json({ ran: false, dry: true, at: now.toISOString(), ...totals, mail: mailConfigured, serviceKey: hasServiceKey, site, preview })
  // the run's own log line: Vercel keeps it, so a failed morning is readable there
  return NextResponse.json({ ran: true, at: now.toISOString(), ...totals, ...(totals.failed ? { reason: lastMailRefusal() } : {}) })
}
