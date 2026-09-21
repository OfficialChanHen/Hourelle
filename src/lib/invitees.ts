'use client'

// Who a host can invite without typing: the people from their earlier events, and
// anyone whose email belongs to an account. Replaces the wizard's hard-coded cast.

import { supabase, backendOn } from './db'
import { addInvitees, isAccountId, isOwnEmail, listEvents, type Participant } from './events'
import { currentAccount } from './session'
import type { PersonColor } from './colors'

export type Invitee = {
  id: string
  name: string
  color: PersonColor
  email?: string
  account: boolean // a real account (invited by id) rather than a guest (invited by email)
  colorChosen?: boolean // the account picked its colour, so the event keeps it
}

/** The people on this host's events, newest event first, one entry per person.
 *  Guests without an email are skipped: there is no way to invite them again. */
export function recentInvitees(limit = 8): Invitee[] {
  const me = currentAccount()
  const seen = new Set<string>()
  const out: Invitee[] = []
  const events = [...listEvents()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  for (const ev of events) {
    // the samples and the tour's practice event are cast with made-up people: they
    // have no address and no account, and offering them here would send a host to
    // invite somebody who does not exist
    if (ev.demo || ev.practice) continue
    for (const p of ev.participants) {
      if (p.you || p.id === me.id) continue
      // invitable means reachable: an address to write to, or an account to add by id
      if (!p.email && !isAccountId(p.id)) continue
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
  const { data } = await supabase!.from('profiles').select('*').eq('email', clean).maybeSingle()
  const row = data as { id: string; name: string; color: string; email?: string; color_set?: boolean } | null
  return row ? { id: row.id, name: row.name, color: row.color as PersonColor, email: row.email ?? clean, account: true, colorChosen: !!row.color_set } : null
}

/** Invite by email after the event exists: each address is looked up, so a person
 *  with an account joins under their own name rather than a name made from their
 *  email. The host's own address is refused and reported back as `self`. */
export async function inviteByEmail(eventId: string, emails: string[]): Promise<{ added: Participant[]; self: string[] }> {
  const clean = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)))
  const self = clean.filter(isOwnEmail)
  const rest = clean.filter((e) => !self.includes(e))
  const found = await Promise.all(rest.map((e) => lookupProfileByEmail(e)))
  const added = addInvitees(eventId, rest.map((email, i) => {
    const a = found[i]
    return a ? { email, account: { id: a.id, name: a.name, color: a.color, email, colorChosen: a.colorChosen } } : { email }
  }))
  return { added, self }
}
