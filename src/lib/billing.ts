'use client'

// The browser's side of paying: ask the server for a Stripe page and go there.
// No card, no price and no plan is ever handled here; Stripe hosts the checkout
// and the portal, and its webhook is the only thing that turns Plus on.

import { supabase, backendOn } from './db'

async function post(path: string, body: unknown): Promise<{ url: string } | { error: string }> {
  if (!backendOn) return { error: 'Payments need a backend.' }
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Log in first.' }
  try {
    const res = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok || !out.url) return { error: out.error || `The server said no (${res.status}).` }
    return { url: out.url }
  } catch {
    return { error: 'Could not reach the server.' }
  }
}

export type Period = 'monthly' | 'yearly'

/** Off to Stripe's checkout. Resolves an error; on success the browser leaves. */
export async function startCheckout(period: Period): Promise<string | null> {
  const r = await post('/api/billing/checkout', { period })
  if ('error' in r) return r.error
  window.location.href = r.url
  return null
}

/** Off to Stripe's portal: the card, the period, the cancellation. */
export async function openBillingPortal(): Promise<string | null> {
  const r = await post('/api/billing/portal', {})
  if ('error' in r) return r.error
  window.location.href = r.url
  return null
}

/** Is there anywhere to send a card on this deployment? Until the keys are set the
 *  buttons that take money stay hidden and Plus collects interest instead. */
export function canBuy(signedIn: boolean): boolean {
  return backendOn && signedIn && process.env.NEXT_PUBLIC_BILLING_ON === '1'
}
