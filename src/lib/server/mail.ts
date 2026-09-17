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

export type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string; fromName?: string }

/** The sending address stays the verified one; the display name may be the person
 *  the message is really from ("Sam via Hourelle"), which is what a mailbox shows
 *  and one of the things that separates a note from a person from a campaign. */
function fromFor(name?: string): string {
  if (!name) return FROM
  const addr = /<([^>]+)>/.exec(FROM)?.[1] ?? FROM
  return `${name.replace(/["<>]/g, '')} <${addr}>`
}

/** One message through Resend. Resolves an error string, or null when it went. */
export async function sendMail(m: Mail): Promise<string | null> {
  const key = process.env.RESEND_API_KEY
  if (!key) return 'Email is not set up on this server.'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromFor(m.fromName), to: [m.to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}), ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
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

/* ── the HTML shell every message wears ──
   Built the way email has to be built: nested tables, every style inline, no web
   fonts, and a preheader the inbox list shows under the subject. The look is the
   app's paper and its deep green; the serif is whatever serif the client has, since
   Lora will not travel. One column, 560 wide, so it reads the same in Gmail, Mail
   and Outlook, and on a phone. Anything with structure (when, where, who is asking)
   goes in a details card rather than a sentence, so it can be found at a glance. */
type Shell = {
  title: string
  lines: string[]
  cta: { label: string; href: string }
  details?: { label: string; value: string }[]
  preheader?: string
  footer?: string
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function shell({ title, lines, cta, details = [], preheader, footer }: Shell): string {
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
  const serif = "font-family:Georgia,'Iowan Old Style','Times New Roman',serif"
  const rows = details.filter((d) => d.value).map((d, i) => `
            <tr>
              <td style="padding:${i ? 8 : 0}px 12px 0 0;vertical-align:top;${font};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#98978F;font-weight:600;line-height:20px">${esc(d.label)}</td>
              <td style="padding:${i ? 8 : 0}px 0 0;vertical-align:top;${font};font-size:15px;color:#1A1917;line-height:20px">${esc(d.value)}</td>
            </tr>`).join('')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;-webkit-text-size-adjust:100%">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF">
  <tr>
    <td align="center" style="padding:32px 20px 36px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
        <tr>
          <td>
            <h1 style="margin:0;${serif};font-weight:400;font-size:26px;line-height:1.2;letter-spacing:-.01em;color:#1A1917">${esc(title)}</h1>
            ${lines.map((l) => `<p style="margin:14px 0 0;${font};font-size:16px;line-height:1.6;color:#1A1917">${esc(l)}</p>`).join('')}
            ${rows ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;border-left:2px solid #E3E2DE;padding-left:14px">${rows}
            </table>` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0">
              <tr>
                <td style="background:#2E4A3C;border-radius:9px">
                  <a href="${esc(cta.href)}" style="display:inline-block;padding:12px 20px;${font};font-size:15px;font-weight:600;line-height:1;color:#F8F7F3;text-decoration:none">${esc(cta.label)}</a>
                </td>
              </tr>
            </table>
            <p style="margin:18px 0 0;${font};font-size:13px;line-height:1.6;color:#67665F">Or open this link: <a href="${esc(cta.href)}" style="color:#2A4537;text-decoration:underline;word-break:break-all">${esc(cta.href)}</a></p>
            ${footer ? `<p style="margin:28px 0 0;${font};font-size:12.5px;line-height:1.6;color:#98978F">${esc(footer)}</p>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function inviteMail(ev: AppEvent, p: Participant, to: string, site: string, hostEmail?: string | null): Mail {
  const host = hostNameOf(ev), link = joinLink(site, ev, p), when = whenText(ev), place = placeText(ev)
  const ask = ev.confirmed ? 'Open your link to say whether you can make it.' : 'Open your link and mark when you are free. It takes a minute and needs no account.'
  const lines = [`Hi ${firstName(p)}, ${host} is planning ${ev.title} and would like you there.`, ask]
  const facts = [when ? `When: ${when}` : '', place ? `Where: ${place}` : ''].filter(Boolean)
  const text = [lines[0], ...facts, '', ask, '', link, '', `Sent by Hourelle on behalf of ${host}. Reply to this email to reach them.`].join('\n')
  const html = shell({
    title: `${host} invited you to ${ev.title}`,
    lines,
    details: [{ label: 'When', value: when }, { label: 'Where', value: place }],
    cta: { label: ev.confirmed ? 'Say if you can make it' : 'Mark when you are free', href: link },
    preheader: ask,
    footer: `Sent by Hourelle on behalf of ${host}. Reply to this email to reach them.`,
  })
  return { to, subject: `${host} invited you to ${ev.title}`, text, html, replyTo: hostEmail ?? undefined, fromName: `${host} via Hourelle` }
}

export function nudgeMail(ev: AppEvent, p: Participant, to: string, site: string, hostEmail?: string | null): Mail {
  const host = hostNameOf(ev), link = joinLink(site, ev, p)
  const lines = [`Hi ${firstName(p)}, ${host} is still waiting on your times for ${ev.title}.`, 'Mark when you are free so the plan can be settled. Even a rough answer helps.']
  const text = [...lines, '', link].join('\n')
  return { to, subject: `${host} is waiting on your times for ${ev.title}`, text, html: shell({ title: `A quick one from ${host}`, lines, cta: { label: 'Mark when you are free', href: link }, preheader: lines[0], footer: `Sent by Hourelle on behalf of ${host}. Reply to this email to reach them.` }), replyTo: hostEmail ?? undefined, fromName: `${host} via Hourelle` }
}

export function reminderMail(kind: MailKind, ev: AppEvent, p: Participant, to: string, site: string): Mail {
  const link = joinLink(site, ev, p), when = whenText(ev), place = placeText(ev)
  const soon = kind.endsWith('-day') ? 'today' : 'tomorrow'
  const first = firstName(p)
  if (kind === 'event-eve' || kind === 'event-day') {
    const title = `${soon === 'today' ? 'Today' : 'Tomorrow'}: ${ev.title}`
    const lines = [`Hi ${first}, ${ev.title} is ${soon}${when ? `: ${when}` : ''}${place ? `, at ${place}` : ''}.`, 'Everything the group settled on is on the event page.']
    return { to, subject: title, text: [...lines, '', link].join('\n'), html: shell({ title, lines, details: [{ label: 'When', value: when }, { label: 'Where', value: place }], cta: { label: 'Open the event', href: link }, preheader: lines[0] }) }
  }
  if (kind === 'plan-eve' || kind === 'plan-day') {
    const title = `Lock in ${ev.title} by ${soon}`
    const lines = [`Hi ${first}, you set ${soon === 'today' ? 'today' : 'tomorrow'} as the day to have ${ev.title} settled.`, 'Have a look at how the answers came in and lock in a time and place.']
    return { to, subject: title, text: [...lines, '', link].join('\n'), html: shell({ title, lines, cta: { label: 'Lock it in', href: link }, preheader: lines[0] }) }
  }
  if (kind === 'vote-eve' || kind === 'vote-day') {
    const title = `Voting on ${ev.title} closes ${soon}`
    const lines = [`Hi ${first}, the vote on where ${ev.title} happens closes ${soon}, and yours is not in yet.`, 'Pick your place before it does.']
    return { to, subject: title, text: [...lines, '', link].join('\n'), html: shell({ title, lines, cta: { label: 'Cast your vote', href: link }, preheader: lines[0] }) }
  }
  const title = `Say if you can make ${ev.title} by ${soon}`
  const lines = [`Hi ${first}, ${hostNameOf(ev)} asked for answers on ${ev.title} by ${soon}${when ? ` (${when})` : ''}.`, 'A yes, a maybe, or a no all help the host plan.']
  return { to, subject: title, text: [...lines, '', link].join('\n'), html: shell({ title, lines, details: [{ label: 'When', value: when }], cta: { label: 'Answer now', href: link }, preheader: lines[0] }) }
}
