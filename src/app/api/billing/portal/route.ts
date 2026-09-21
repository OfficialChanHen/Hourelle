// Changing a card, switching monthly to yearly, cancelling: all of it is Stripe's
// own portal, so none of it is built here.

import { NextResponse } from 'next/server'
import { serverDb, userFromRequest } from '@/lib/server/db'
import { portalSession, stripeConfigured } from '@/lib/server/stripe'
import { siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!stripeConfigured) return NextResponse.json({ error: 'Payments are not set up on this server yet.' }, { status: 503 })
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })
  const { data } = await db.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle()
  const customer = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
  if (!customer) return NextResponse.json({ error: 'There is no billing account to manage yet.' }, { status: 409 })
  const r = await portalSession(customer, `${siteUrl(req)}/settings`)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
  return NextResponse.json({ url: r.data.url })
}
