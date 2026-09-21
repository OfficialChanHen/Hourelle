// The way to Plus: the signed-in account asks for a checkout page and is sent to
// Stripe. Nothing about money is handled here, and no price comes from the browser
// — it asks for "monthly" or "yearly" and the server knows what those cost.

import { NextResponse } from 'next/server'
import { serverDb, userFromRequest } from '@/lib/server/db'
import { PRICES, checkoutSession, stripeConfigured } from '@/lib/server/stripe'
import { siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'

type Body = { period?: 'monthly' | 'yearly' }

export async function POST(req: Request) {
  if (!stripeConfigured) return NextResponse.json({ error: 'Payments are not set up on this server yet.' }, { status: 503 })
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as Body
  const price = body.period === 'yearly' ? PRICES.yearly : PRICES.monthly
  if (!price) return NextResponse.json({ error: 'That plan has no price set on this server yet.' }, { status: 503 })

  const db = serverDb()
  // an account that has paid before keeps its customer, so cards and history stay together
  const { data } = db ? await db.from('profiles').select('plan, plan_source, stripe_customer_id').eq('id', user.id).maybeSingle() : { data: null }
  const row = data as { plan?: string; plan_source?: string; stripe_customer_id?: string | null } | null
  if (row?.plan === 'plus' && row.plan_source === 'comped') {
    return NextResponse.json({ error: 'You already have Plus, given to you. There is nothing to pay.' }, { status: 409 })
  }

  const site = siteUrl(req)
  const r = await checkoutSession({
    price,
    userId: user.id,
    email: user.email,
    customerId: row?.stripe_customer_id ?? null,
    successUrl: `${site}/settings?plus=welcome`,
    cancelUrl: `${site}/plans`,
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
  return NextResponse.json({ url: r.data.url })
}
