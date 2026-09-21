// Giving Plus away, and taking it back. This is how the owner comps an account,
// their own included, without touching the database by hand.
//
//   curl -X POST https://hourelle.com/api/admin/plan \
//     -H "Authorization: Bearer $ADMIN_SECRET" -H "Content-Type: application/json" \
//     -d '{"email":"someone@example.com","plan":"plus"}'
//
// A comped account is left alone by the Stripe webhook, so a gift is never undone
// by a subscription event. `plan: "free"` takes the gift back.

import { NextResponse } from 'next/server'
import { hasServiceKey, serverDb } from '@/lib/server/db'

export const runtime = 'nodejs'

type Body = { email?: string; userId?: string; plan?: 'free' | 'plus'; until?: string }

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  }
  if (!hasServiceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, { status: 503 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as Body
  const plan = body.plan === 'free' ? 'free' : 'plus'
  const email = body.email?.trim().toLowerCase()
  if (!email && !body.userId) return NextResponse.json({ error: 'Which account? Give an email or a userId.' }, { status: 400 })

  const q = db.from('profiles').select('id, email, plan, plan_source')
  const { data, error } = await (body.userId ? q.eq('id', body.userId) : q.ilike('email', email!)).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No account with that address.' }, { status: 404 })
  const row = data as { id: string; email: string | null; plan: string; plan_source: string }

  // a paying account is not comped over: cancel it in Stripe instead, or the next
  // webhook would fight this write
  if (plan === 'plus' && row.plan_source === 'stripe') {
    return NextResponse.json({ error: 'That account already pays for Plus. Cancel the subscription in Stripe first.' }, { status: 409 })
  }
  const patch = plan === 'plus'
    ? { plan: 'plus', plan_source: 'comped', plan_until: body.until ?? null }
    : { plan: 'free', plan_source: 'none', plan_until: null }
  const { error: e2 } = await db.from('profiles').update(patch).eq('id', row.id)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ ok: true, account: row.email, was: row.plan, now: patch.plan, source: patch.plan_source })
}
