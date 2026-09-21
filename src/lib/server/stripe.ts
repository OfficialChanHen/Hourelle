// Stripe, over its REST API with fetch, the way Resend is called in server/mail.
// Server only: the secret key must never reach a browser. Every function answers
// null when Stripe is not configured, so the app runs exactly as it did before
// with no keys set.

const KEY = process.env.STRIPE_SECRET_KEY
export const stripeConfigured = !!KEY
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY ?? '',
  yearly: process.env.STRIPE_PRICE_YEARLY ?? '',
}

// Stripe takes form-encoded bodies, nested keys in brackets
function form(obj: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== '') p.set(k, String(v))
  return p.toString()
}

async function call<T>(path: string, body?: Record<string, string | number | boolean | undefined>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!KEY) return { ok: false, error: 'Payments are not set up on this server.' }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(body ? { body: form(body) } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) return { ok: false, error: data.error?.message || `Stripe said no (${res.status}).` }
  return { ok: true, data }
}

export type Session = { id: string; url: string }

/** A hosted checkout page for one account. The account's id rides along as the
 *  client reference and on the subscription's metadata, so the webhook knows whose
 *  plan to change without trusting anything the browser says. */
export function checkoutSession(o: { price: string; userId: string; email?: string | null; customerId?: string | null; successUrl: string; cancelUrl: string }) {
  return call<Session>('checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': o.price,
    'line_items[0][quantity]': 1,
    client_reference_id: o.userId,
    ...(o.customerId ? { customer: o.customerId } : { customer_email: o.email ?? undefined }),
    'subscription_data[metadata][user_id]': o.userId,
    'metadata[user_id]': o.userId,
    allow_promotion_codes: true,
    success_url: o.successUrl,
    cancel_url: o.cancelUrl,
  })
}

/** The customer portal: changing a card, switching monthly to yearly, cancelling.
 *  Stripe hosts all of it, so none of that lives in this codebase. */
export function portalSession(customerId: string, returnUrl: string) {
  return call<Session>('billing_portal/sessions', { customer: customerId, return_url: returnUrl })
}

export type Subscription = {
  id: string
  status: string
  customer: string
  current_period_end?: number
  cancel_at_period_end?: boolean
  metadata?: Record<string, string>
}
export function getSubscription(id: string) {
  return call<Subscription>(`subscriptions/${id}`)
}

/** A subscription that entitles the account to Plus. Stripe keeps a cancelled one
 *  alive until the period ends, which is right: it was paid for. */
export function entitles(status: string): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

/* ── the webhook's signature ──
   Stripe signs each delivery with the endpoint secret: a timestamp and an HMAC of
   "<timestamp>.<raw body>". Verified by hand here rather than pulling in the SDK,
   the same bargain the rest of this server makes. The comparison is constant time,
   and a delivery older than five minutes is refused so a captured one cannot be
   replayed later. */
import { createHmac, timingSafeEqual } from 'crypto'

export function verifyWebhook(raw: string, header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=', 2) as [string, string]))
  const t = Number(parts.t)
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false
  const mine = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')
  const theirs = parts.v1 ?? ''
  if (mine.length !== theirs.length) return false
  try { return timingSafeEqual(Buffer.from(mine), Buffer.from(theirs)) } catch { return false }
}
