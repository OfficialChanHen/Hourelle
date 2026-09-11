'use client'

// The browser's side of email: ask the server to send, carrying the session token
// that proves who is asking. Nothing here holds a mail key; the routes do the work.

import { supabase, backendOn } from './db'
import type { NotifyPrefs } from './prefs'

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!backendOn) return null
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
}

async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const headers = await authHeaders()
  if (!headers) return { ok: false, error: 'Log in to send email.' }
  try {
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) return { ok: false, error: data.error || `The server said no (${res.status}).` }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Could not reach the server.' }
  }
}

export type InviteResult = { sent: number; already: number; failed: number; total: number }
/** Email the personal invite links of an event's email invitees (all, or the given
 *  ones). `again` sends to people who already had theirs. */
export function sendInvites(eventId: string, participantIds?: string[], again = false) {
  return post<InviteResult>('/api/mail/invite', { eventId, participantIds, again })
}

export type NudgeResult = { sent: string[]; already: string[]; noEmail: string[]; failed: string[] }
/** Ask the given people for their times. One email per person per day. */
export function sendNudges(eventId: string, participantIds: string[]) {
  return post<NudgeResult>('/api/mail/nudge', { eventId, participantIds })
}

/* ── reminder switches, kept on the account so the reminder job can read them ── */
export async function loadReminderPrefs(userId: string): Promise<NotifyPrefs | null> {
  if (!backendOn) return null
  const { data } = await supabase!.from('profiles').select('reminders').eq('id', userId).maybeSingle()
  return (data?.reminders as NotifyPrefs | undefined) ?? null
}
export async function saveReminderPrefs(userId: string, prefs: NotifyPrefs): Promise<void> {
  if (!backendOn) return
  await supabase!.from('profiles').update({ reminders: prefs }).eq('id', userId)
}

/** Can this browser send email on the host's behalf: a backend, a real login, and
 *  the switch that says a sending domain exists (NEXT_PUBLIC_MAIL_ON=1). Until then
 *  every send button stays hidden and personal links are copied by hand. */
export function canEmail(signedIn: boolean): boolean {
  return backendOn && signedIn && process.env.NEXT_PUBLIC_MAIL_ON === '1'
}
