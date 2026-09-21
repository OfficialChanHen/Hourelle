'use client'

// Which plan an account is on, and who asked to hear when Plus goes on sale.
//
// The profile row is the record: only the server writes it (Stripe's webhook, or
// the comp route), and a database trigger refuses a plan written from a browser.
// What is kept here is a copy per account, so a page can paint the right thing
// before the network answers. Per account, because a browser is shared and a note
// left by a deleted account must never speak for the next one.

import { supabase, backendOn } from './db'
import type { PlanKey } from '@/content/plans'

const INTEREST_KEY = 'hourelle.plus.interest'
const WELCOMED_KEY = 'hourelle.welcomed'
const PLAN_KEY = 'hourelle.plan'
export const PLAN_CHANGED = 'hourelle:plan-changed'

export type PlanSource = 'none' | 'stripe' | 'comped'
export type PlanState = { plan: PlanKey; source: PlanSource; until: string | null }
export const FREE: PlanState = { plan: 'free', source: 'none', until: null }

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PLAN_CHANGED))
}

/** What this browser last heard about an account's plan. Free until told otherwise,
 *  which is the safe way round: nothing is unlocked by a note on a device. */
export function cachedPlan(userId: string): PlanState {
  if (typeof window === 'undefined' || !userId) return FREE
  try {
    const raw = localStorage.getItem(`${PLAN_KEY}:${userId}`)
    if (!raw) return FREE
    const p = JSON.parse(raw) as Partial<PlanState>
    return { plan: p.plan === 'plus' ? 'plus' : 'free', source: (p.source as PlanSource) ?? 'none', until: p.until ?? null }
  } catch { return FREE }
}

/** Ask the profile what the plan is, and remember the answer for this account. */
export async function loadPlan(userId: string): Promise<PlanState> {
  if (!backendOn || !userId) return FREE
  const { data, error } = await supabase!.from('profiles').select('plan, plan_source, plan_until').eq('id', userId).maybeSingle()
  // a database without the 0014 columns answers with an error: everyone is Free,
  // which is exactly what the app did before any of this existed
  if (error || !data) return FREE
  const row = data as { plan?: string; plan_source?: string; plan_until?: string | null }
  const state: PlanState = {
    plan: row.plan === 'plus' ? 'plus' : 'free',
    source: (row.plan_source as PlanSource) ?? 'none',
    until: row.plan_until ?? null,
  }
  try { localStorage.setItem(`${PLAN_KEY}:${userId}`, JSON.stringify(state)) } catch { /* private mode */ }
  announce()
  return state
}

/** Everything this browser remembers about one account's plan and its interest in
 *  Plus, forgotten. Called when an account is deleted, so the next one starts clean. */
export function forgetPlan(userId: string): void {
  try {
    localStorage.removeItem(`${PLAN_KEY}:${userId}`)
    localStorage.removeItem(`${INTEREST_KEY}:${userId}`)
    localStorage.removeItem(INTEREST_KEY) // the old device-wide note, from before this was per account
  } catch { /* private mode */ }
  announce()
}

/* ── the waiting list, while Plus is not on sale where you are ── */

export function plusInterested(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false
  try { return localStorage.getItem(`${INTEREST_KEY}:${userId}`) === '1' } catch { return false }
}

export async function recordPlusInterest(userId: string): Promise<void> {
  if (!userId) return
  try { localStorage.setItem(`${INTEREST_KEY}:${userId}`, '1') } catch { /* private mode */ }
  if (!backendOn) return
  const { data } = await supabase!.auth.getSession()
  if (!data.session) return
  await supabase!.from('profiles').update({ plan_interest_at: new Date().toISOString() }).eq('id', data.session.user.id)
}

/* ── the welcome steps, shown once per account ── */

/** The note is keyed by the account id, so a fresh account on a browser that has
 *  seen the steps still gets them. */
export function wasWelcomed(userId: string): boolean {
  try { return localStorage.getItem(`${WELCOMED_KEY}:${userId}`) === '1' } catch { return true }
}
export function markWelcomed(userId: string): void {
  try { localStorage.setItem(`${WELCOMED_KEY}:${userId}`, '1') } catch { /* private mode */ }
}
export function forgetWelcomed(userId: string): void {
  try { localStorage.removeItem(`${WELCOMED_KEY}:${userId}`) } catch { /* private mode */ }
}
