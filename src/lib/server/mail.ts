// Everything about sending an email lives here: the one call to Resend, the
// wording of each kind of message, and the bookkeeping that keeps any message from
// going out twice. Server only — the mail key must never reach a browser.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppEvent, Participant } from '@/lib/events'
import { serverDb } from './db'

/* ── where links point ── */
// API routes know the caller's origin; the cron job does not, so it needs a setting
export function siteUrl(req?: Request): string {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL
  if (fixed) return fixed.replace(/\/$/, '')
  if (req) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    if (host) return `${proto}://${host}`
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return vercel ? `https://${vercel}` : 'http://localhost:3000'
}

// a person's own door into the event: their personal link when they were invited
// by email, the plain join link otherwise
export function joinLink(site: string, ev: Pick<AppEvent, 'id'>, p?: Pick<Participant, 'inviteToken'>): string {
  return p?.inviteToken ? `${site}/events/${ev.id}/join?invite=${p.inviteToken}` : `${site}/events/${ev.id}/join`
}

/* ── the send ── */
export const mailConfigured = !!process.env.RESEND_API_KEY

const FROM = process.env.MAIL_FROM_EMAIL || process.env.FEEDBACK_FROM_EMAIL || 'Hourelle <onboarding@resend.dev>'

export type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string }

/** One message through Resend. Resolves an error string, or null when it went. */
export async function sendMail(m: Mail): Promise<string | null> {
  const key = process.env.RESEND_API_KEY
  if (!key) return 'Email is not set up on this server.'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [m.to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}), ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
  })
  if (res.ok) return null
  const detail = await res.text().catch(() => '')
  return `Resend refused the message (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`
}

/* ── the log: one row per message, and the key that stops repeats ── */
export type MailKind = 'invite' | 'nudge' | 'event-eve' | 'event-day' | 'plan-eve' | 'plan-day' | 'vote-eve' | 'vote-day' | 'rsvp-eve' | 'rsvp-day'

/** Send once. The log row is claimed before the message goes out (the unique key
 *  refuses a second claim), so two overlapping runs cannot both send. A failed
 *  send releases the claim so the next run may try again. With no service key the
 *  log is skipped and the message still goes: better a rare repeat than silence. */
export async function sendOnce(db: SupabaseClient | null, key: string, meta: { eventId: string; participantId: string; kind: MailKind }, mail: Mail, allowRepeat = false): Promise<'sent' | 'already' | 'failed'> {
  let claimed = false
  if (db && !allowRepeat) {
    const { error } = await db.from('email_log').insert({ key, event_id: meta.eventId, participant_id: meta.participantId, kind: meta.kind, to_email: mail.to })
    if (error) {
      if (error.code === '23505') return 'already' // unique key: this one went before
      console.warn('email log write failed —', error.message) // no service key, or table missing: send anyway
    } else claimed = true
  }
  const err = await sendMail(mail)
  if (err) {
    console.warn('email failed —', meta.kind, mail.to, err)
    if (claimed && db) await db.from('email_log').delete().eq('key', key)
    return 'failed'
  }
  if (db) {
    if (claimed) await db.from('email_log').update({ ok: true }).eq('key', key)
    else if (allowRepeat) await db.from('email_log').insert({ key: `${key}:${Date.now()}`, event_id: meta.eventId, participant_id: meta.participantId, kind: meta.kind, to_email: mail.to, ok: true })
  }
  return 'sent'
}

/* ── who to write to ── */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The email for each participant: a guest gave theirs at join (or was invited to
 *  it); an account's lives on its profile. Unknown addresses are simply absent. */
export async function emailsFor(db: SupabaseClient | null, people: Participant[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const lookup: string[] = []
  for (const p of people) {
    if (p.email) out.set(p.id, p.email)
    else if (UUID.test(p.id)) lookup.push(p.id)
  }
  if (lookup.length && db) {
    const { data } = await db.from('profiles').select('id, email').in('id', lookup)
    for (const r of data ?? []) if (r.email) out.set(r.id, r.email)
  }
  return out
}

export type ReminderPrefs = { eventDay: boolean; deadlines: boolean; replies: boolean }
/** Accounts can switch reminders off in Settings; guests get them by giving an email. */
export async function prefsFor(db: SupabaseClient | null, ids: string[]): Promise<Map<string, ReminderPrefs>> {
  const out = new Map<string, ReminderPrefs>()
  const uuids = ids.filter((id) => UUID.test(id))
  if (!uuids.length || !db) return out
  const { data } = await db.from('profiles').select('id, reminders').in('id', uuids)
  for (const r of data ?? []) if (r.reminders) out.set(r.id, r.reminders as ReminderPrefs)
  return out
}

export function eventRow(db: SupabaseClient, id: string) {
  return db.from('events').select('id, data, host_id').eq('id', id).maybeSingle()
}
export { serverDb }

/* ── small formatters (the app's own live in lib/events, next to localStorage) ── */
export function fmtMinute(min: number): string {
  const h = Math.floor(min / 60) % 24, mm = ((min % 60) + 60) % 60
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
export function fmtDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
export function tzAbbr(tz: string, when = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(when).find((p) => p.type === 'timeZoneName')?.value ?? tz
  } catch { return tz }
}
export function hostNameOf(ev: AppEvent): string {
  return ev.participants.find((p) => p.host)?.name ?? ev.hostName ?? 'The host'
}
export function whenText(ev: AppEvent): string {
  const c = ev.confirmed
  if (c) {
    const allDay = c.startMin === 0 && c.endMin === 24 * 60
    const days = c.endDayKey ? `${fmtDay(c.dayKey)} – ${fmtDay(c.endDayKey)}` : fmtDay(c.dayKey)
    return allDay ? days : `${days}, ${fmtMinute(c.startMin)} – ${fmtMinute(c.endMin)} ${tzAbbr(ev.timezone)}`
  }
  if (ev.startDate && ev.endDate && ev.startDate !== ev.endDate) return `${fmtDay(ev.startDate)} – ${fmtDay(ev.endDate)}`
  return ev.startDate ? fmtDay(ev.startDate) : ''
}
export function placeText(ev: AppEvent): string {
  const ids = ev.confirmed?.placeIds ?? []
  const names = ids.map((id) => ev.location.places.find((p) => p.id === id)?.name).filter((n): n is string => !!n)
  if (names.length) return names.join(', ')
  if (ev.location.mode === 'remote') return `Online${ev.location.platform ? ` on ${ev.location.platform}` : ''}`
  if (ev.location.mode === 'set' && ev.location.places[0]) return ev.location.places[0].name
  return ''
}

/* ── the messages ── */
function firstName(p: Participant): string { return p.name.split(' ')[0] || 'there' }

// one quiet HTML shell for every message: paper background, one green button
function shell(title: string, lines: string[], cta: { label: string; href: string }): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<div style="background:#F4F1EA;padding:32px 16px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1B1815">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E6E0D4;border-radius:14px;padding:28px 28px 24px">
    <div style="font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:#A39A89;font-weight:600">Hourelle</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.15;margin:10px 0 14px">${esc(title)}</h1>
    ${lines.map((l) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px;color:#3d3830">${esc(l)}</p>`).join('')}
    <a href="${cta.href}" style="display:inline-block;margin-top:8px;background:#2E4A3C;color:#F8F5EC;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px">${esc(cta.label)}</a>
    <p style="font-size:12px;line-height:1.5;color:#A39A89;margin:22px 0 0">If the button does not work, open this link: ${esc(cta.href)}</p>
  </div>
</div>`
}

export function inviteMail(ev: AppEvent, p: Participant, to: string, site: string, hostEmail?: string | null): Mail {
  const host = hostNameOf(ev), link = joinLink(site, ev, p), when = whenText(ev), place = placeText(ev)
  const ask = ev.confirmed ? 'Open your link to say whether you can make it.' : 'Open your link and mark when you are free. It takes a minute and needs no account.'
  const lines = [`Hi ${firstName(p)}, ${host} is planning ${ev.title}${when ? ` for ${when}` : ''}${place ? ` at ${place}` : ''}.`, ask]
  const text = [...lines, '', link, '', 'Sent by Hourelle on behalf of the host.'].join('\n')
  return { to, subject: `${host} invited you to ${ev.title}`, text, html: shell(`${host} invited you to ${ev.title}`, lines, { label: ev.confirmed ? 'Say if you can make it' : 'Mark when you are free', href: link }), replyTo: hostEmail ?? undefined }
}

export function nudgeMail(ev: AppEvent, p: Participant, to: string, site: string, hostEmail?: string | null): Mail {
  const host = hostNameOf(ev), link = joinLink(site, ev, p)
  const lines = [`Hi ${firstName(p)}, ${host} is still waiting on your times for ${ev.title}.`, 'Mark when you are free so the plan can be settled. Even a rough answer helps.']
  const text = [...lines, '', link].join('\n')
  return { to, subject: `${host} is waiting on your times for ${ev.title}`, text, html: shell(`A quick one from ${host}`, lines, { label: 'Mark when you are free', href: link }), replyTo: hostEmail ?? undefined }
}

export function reminderMail(kind: MailKind, ev: AppEvent, p: Participant, to: string, site: string): Mail {
  const link = joinLink(site, ev, p), when = whenText(ev), place = placeText(ev)
  const soon = kind.endsWith('-day') ? 'today' : 'tomorrow'
  const first = firstName(p)
  if (kind === 'event-eve' || kind === 'event-day') {
    const title = `${soon === 'today' ? 'Today' : 'Tomorrow'}: ${ev.title}`
    const lines = [`Hi ${first}, ${ev.title} is ${soon}${when ? `: ${when}` : ''}${place ? `, at ${place}` : ''}.`, 'Everything the group settled on is on the event page.']
    return { to, subject: title, text: [...lines, '', link].join('\n'), html: shell(title, lines, { label: 'Open the event', href: link }) }
  }
  if (kind === 'plan-eve' || kind === 'plan-day') {
    const title = `Lock in ${ev.title} by ${soon}`
    const lines = [`Hi ${first}, you set ${soon === 'today' ? 'today' : 'tomorrow'} as the day to have ${ev.title} settled.`, 'Have a look at how the answers came in and lock in a time and place.']
    return { to, subject: title, text: [...lines, '', link].join('\n'), html: shell(title, lines, { label: 'Lock it in', href: link }) }
  }
  if (kind === 'vote-eve' || kind === 'vote-day') {
    const title = `Voting on ${ev.title} closes ${soon}`
    const lines = [`Hi ${first}, the vote on where ${ev.title} happens closes ${soon}, and yours is not in yet.`, 'Pick your place before it does.']
    return { to, subject: title, text: [...lines, '', link].join('\n'), html: shell(title, lines, { label: 'Cast your vote', href: link }) }
  }
  const title = `Say if you can make ${ev.title} by ${soon}`
  const lines = [`Hi ${first}, ${hostNameOf(ev)} asked for answers on ${ev.title} by ${soon}${when ? ` (${when})` : ''}.`, 'A yes, a maybe, or a no all help the host plan.']
  return { to, subject: title, text: [...lines, '', link].join('\n'), html: shell(title, lines, { label: 'Answer now', href: link }) }
}
