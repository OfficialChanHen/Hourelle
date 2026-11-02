// The app's nudge: "these plans I can see are over and repeat; open their next one".
// Nothing here trusts the caller. The server reads each plan itself and opens a copy
// only for one that really is due, so asking about a plan that is not changes nothing.
// The cron does the same sweep daily; this makes it happen when someone is around.

import { NextResponse } from 'next/server'
import { hasServiceKey, serverDb } from '@/lib/server/db'
import { openRepeats } from '@/lib/server/repeats'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let ids: string[] = []
  try { ids = ((await req.json()) as { ids?: unknown }).ids as string[] } catch { /* below */ }
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: 'Which plans?' }, { status: 400 })
  ids = ids.filter((id) => typeof id === 'string' && id.length <= 200).slice(0, 20)
  if (!hasServiceKey) return NextResponse.json({ opened: [] })
  const db = serverDb()
  if (!db) return NextResponse.json({ opened: [] })
  const { opened } = await openRepeats(db, ids, req)
  return NextResponse.json({ opened })
}
