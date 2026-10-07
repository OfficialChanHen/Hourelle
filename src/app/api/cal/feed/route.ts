// Your calendar feed's address: made the first time you ask, the same one after
// that, and a new one when you reset it (the old address stops answering at once).
// The token lives in calendar_feeds, which only the service key can read.

import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { hasServiceKey, serverDb, userFromRequest } from '@/lib/server/db'
import { siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'

// 32 random bytes, url-safe: nothing to guess at
const mint = () => randomBytes(32).toString('base64url')

export async function POST(req: Request) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Log in first.' }, { status: 401 })
  if (!hasServiceKey) return NextResponse.json({ error: 'Coming soon.' }, { status: 503 })
  const db = serverDb()
  if (!db) return NextResponse.json({ error: 'No database is configured.' }, { status: 503 })
  const { reset } = (await req.json().catch(() => ({}))) as { reset?: boolean }

  let token: string | null = null
  if (!reset) {
    const { data, error } = await db.from('calendar_feeds').select('token').eq('user_id', user.id).maybeSingle()
    // most likely migration 0017 has not run here yet
    if (error) return NextResponse.json({ error: 'Coming soon.' }, { status: 503 })
    token = data?.token ?? null
  }
  if (!token) {
    token = mint()
    const { error } = await db.from('calendar_feeds').upsert({ user_id: user.id, token, created_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: 'Coming soon.' }, { status: 503 })
  }
  return NextResponse.json({ url: `${siteUrl(req)}/api/cal/${token}.ics` })
}
