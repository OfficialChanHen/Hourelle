// Fold another account into this one.
//
// Two accounts happen easily: you sign up with an email one day and tap the Google
// button on another device the next, and now half your events are somewhere else.
// This route joins them. Everything on the other account — the events it hosts, its
// seat on other people's events, its marked times, its votes, its messages — becomes
// this account's, and the other account is closed.
//
// Proof is the point. The bearer token proves the account you are signed in to; the
// email and password in the body prove the one you are bringing in. The server never
// takes either on trust, and without both nothing moves. Two Google-only accounts
// cannot be joined this way, since neither has a password to prove: sign in to one,
// give the other a password first, or merge the other direction.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { AppEvent, Iv } from '@/lib/events'
import { foldDocument, normalize } from './fold'
import { hasServiceKey, serverDb, userFromRequest } from '@/lib/server/db'

export const runtime = 'nodejs'

type AvailRow = { event_id: string; participant_id: string; intervals: Record<string, Iv[]> | null; unavailable: boolean }
type VoteRow = { event_id: string; place_id: string; participant_id: string }

export async function POST(req: Request) {
  const here = await userFromRequest(req)
  if (!here) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  if (!hasServiceKey) return NextResponse.json({ error: 'Joining accounts is not switched on for this server yet.' }, { status: 503 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const db = serverDb()
  if (!db || !url || !anon) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password ?? ''
  if (!email || !password) return NextResponse.json({ error: 'Enter the email and password of the account you want to bring in.' }, { status: 400 })

  // proof of the other account: its own credentials, checked by Supabase, not by us
  const asVisitor = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: other, error: wrong } = await asVisitor.auth.signInWithPassword({ email, password })
  if (wrong || !other.user) return NextResponse.json({ error: 'That email and password did not match an account.' }, { status: 401 })

  const from = other.user.id
  const into = here.id
  if (from === into) return NextResponse.json({ error: 'That is the account you are already signed in to.' }, { status: 400 })

  // the name the surviving account goes by, for events whose host is changing hands
  const { data: profile } = await db.from('profiles').select('name').eq('id', into).maybeSingle()
  const hostName = (profile as { name?: string } | null)?.name

  // ── 1. every event that mentions the account being folded in ──
  const [bySeat, byHost] = await Promise.all([
    db.from('events').select('id, data, host_id').filter('data->participants', 'cs', JSON.stringify([{ id: from }])),
    db.from('events').select('id, data, host_id').eq('host_id', from),
  ])
  if (bySeat.error) return NextResponse.json({ error: bySeat.error.message }, { status: 500 })
  if (byHost.error) return NextResponse.json({ error: byHost.error.message }, { status: 500 })

  type Row = { id: string; data: AppEvent; host_id: string | null }
  const rows = new Map<string, Row>()
  for (const r of [...((bySeat.data ?? []) as Row[]), ...((byHost.data ?? []) as Row[])]) rows.set(r.id, r)

  let moved = 0
  for (const row of rows.values()) {
    const data = foldDocument(row.data, from, into)
    const patch: { data: AppEvent; host_id?: string; } = { data }
    if (row.host_id === from) {
      patch.host_id = into
      if (hostName) patch.data = { ...data, hostName }
    }
    const { error } = await db.from('events').update(patch).eq('id', row.id)
    if (!error) moved++
  }

  // ── 2. marked times: one row per person, so two rows for one person become one ──
  const eventIds = [...rows.keys()]
  if (eventIds.length) {
    const [mine, theirs] = await Promise.all([
      db.from('availability').select('*').eq('participant_id', from).in('event_id', eventIds),
      db.from('availability').select('*').eq('participant_id', into).in('event_id', eventIds),
    ])
    // a database still on the migration before these tables answers with an error,
    // which is fine: there is nothing in them to move
    if (!mine.error) {
      const keep = new Map<string, AvailRow>()
      for (const r of (theirs.data ?? []) as AvailRow[]) keep.set(r.event_id, r)
      for (const r of (mine.data ?? []) as AvailRow[]) {
        const had = keep.get(r.event_id)
        const days = new Set([...Object.keys(r.intervals ?? {}), ...Object.keys(had?.intervals ?? {})])
        const intervals: Record<string, Iv[]> = {}
        for (const day of days) {
          const merged = normalize([...((had?.intervals ?? {})[day] ?? []), ...((r.intervals ?? {})[day] ?? [])])
          if (merged.length) intervals[day] = merged
        }
        await db.from('availability').upsert(
          { event_id: r.event_id, participant_id: into, intervals, unavailable: !!(r.unavailable || had?.unavailable), updated_at: new Date().toISOString() },
          { onConflict: 'event_id,participant_id' },
        )
      }
      await db.from('availability').delete().eq('participant_id', from)
    }

    // ── 3. votes: a row is one vote, so a place both accounts voted for keeps one ──
    const cast = await db.from('votes').select('*').eq('participant_id', from)
    if (!cast.error && (cast.data ?? []).length) {
      const rowsToMove = ((cast.data ?? []) as VoteRow[]).map((v) => ({ event_id: v.event_id, place_id: v.place_id, participant_id: into }))
      await db.from('votes').upsert(rowsToMove, { onConflict: 'event_id,place_id,participant_id', ignoreDuplicates: true })
      await db.from('votes').delete().eq('participant_id', from)
    }
  }

  // ── 4. what they said in chat keeps its words and changes hands ──
  await db.from('messages').update({ participant_id: into }).eq('participant_id', from)

  // ── 5. and the account itself is closed (its profile goes with it) ──
  const { error: gone } = await db.auth.admin.deleteUser(from)
  if (gone) return NextResponse.json({ error: gone.message }, { status: 500 })

  return NextResponse.json({ ok: true, events: moved, email })
}
