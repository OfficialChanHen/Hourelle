// What Stripe tells us, and the only thing that ever turns Plus on for a paying
// account. The browser is never believed about a plan: it asks for a checkout
// page and Stripe reports back here.
//
// The signature is checked against the endpoint secret before the body is read as
// anything but text, and the account is taken from the subscription's metadata,
// which we set when the checkout was made.

import { NextResponse } from 'next/server'
import { serverDb } from '@/lib/server/db'
import { entitles, getSubscription, verifyWebhook } from '@/lib/server/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Obj = Record<string, unknown>
const str = (o: Obj | undefined, k: string): string | undefined => (typeof o?.[k] === 'string' ? (o[k] as string) : undefined)

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const raw = await req.text()
  if (!verifyWebhook(raw, req.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 400 })
  }
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  const event = JSON.parse(raw) as { type: string; data: { object: Obj } }
  const o = event.data.object

  // the account: on the subscription's metadata, or the checkout's own reference
  let userId = str(o.metadata as Obj | undefined, 'user_id') ?? str(o, 'client_reference_id')
  const subId = str(o, 'subscription') ?? (event.type.startsWith('customer.subscription') ? str(o, 'id') : undefined)
  const customerId = str(o, 'customer')

  // a checkout that completed carries the subscription by id only; ask for it
  let status = str(o, 'status')
  let periodEnd = typeof o.current_period_end === 'number' ? (o.current_period_end as number) : undefined
  if (event.type === 'checkout.session.completed' && subId) {
    const r = await getSubscription(subId)
    if (r.ok) { status = r.data.status; periodEnd = r.data.current_period_end; userId = userId ?? r.data.metadata?.user_id }
  }
  if (!userId && customerId) {
    const { data } = await db.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
    userId = (data as { id?: string } | null)?.id
  }
  if (!userId) return NextResponse.json({ received: true, note: 'no account on this event' })

  // a comped account is not Stripe's to change
  const { data: prof } = await db.from('profiles').select('plan_source').eq('id', userId).maybeSingle()
  if ((prof as { plan_source?: string } | null)?.plan_source === 'comped') {
    return NextResponse.json({ received: true, note: 'comped account left alone' })
  }

  const gone = event.type === 'customer.subscription.deleted'
  const on = !gone && !!status && entitles(status)
  const patch: Record<string, unknown> = {
    plan: on ? 'plus' : 'free',
    plan_source: on ? 'stripe' : 'none',
    plan_until: on && periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    stripe_subscription_id: on ? subId ?? null : null,
  }
  const { error } = await db.from('profiles').update(patch).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ received: true, plan: patch.plan })
}
