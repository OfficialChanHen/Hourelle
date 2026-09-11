'use client'

// Who a host can invite without typing: the people from their earlier events, and
// anyone whose email belongs to an account. Replaces the wizard's hard-coded cast.

import { supabase, backendOn } from './db'
import { listEvents } from './events'
import { currentAccount } from './session'
import type { PersonColor } from './colors'

export type Invitee = {
  id: string
  name: string
  color: PersonColor
  email?: string
  account: boolean // a real account (invited by id) rather than a guest (invited by email)
}

/** The people on this host's events, newest event first, one entry per person.
 *  Guests without an email are skipped: there is no way to invite them again. */
export function recentInvitees(limit = 8): Invitee[] {
  const me = currentAccount()
  const seen = new Set<string>()
  const out: Invitee[] = []
  const events = [...listEvents()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  for (const ev of events) {
    for (const p of ev.participants) {
      if (p.you || p.id === me.id) continue
      if (p.guest && !p.email) continue
      const key = (p.email ?? p.id).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ id: p.id, name: p.name, color: p.color, email: p.email, account: !p.guest })
      if (out.length >= limit) return out
    }
  }
  return out
}

/** An exact email that belongs to an account, or null. Exact only: profiles are
 *  readable, but the app never offers a way to browse them. */
export async function lookupProfileByEmail(email: string): Promise<Invitee | null> {
  if (!backendOn) return null
  const clean = email.trim().toLowerCase()
  if (!clean) return null
  const { data } = await supabase!.from('profiles').select('id, name, color, email').eq('email', clean).maybeSingle()
  return data ? { id: data.id, name: data.name, color: data.color as PersonColor, email: data.email ?? clean, account: true } : null
}
