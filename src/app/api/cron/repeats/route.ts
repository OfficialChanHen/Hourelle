// The repeating-plans job. Vercel Cron calls this once a day (see vercel.json): every
// repeating plan that is over gets its next copy, with nobody in the app. The app
// also asks sooner, for the plans in view (api/repeats). See lib/server/repeats.ts.

import { NextResponse } from 'next/server'
import { hasServiceKey, serverDb } from '@/lib/server/db'
import { openRepeats } from '@/lib/server/repeats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  if (!hasServiceKey) return NextResponse.json({ ran: false, reason: 'SUPABASE_SERVICE_ROLE_KEY is not set' })
  const db = serverDb()
  if (!db) return NextResponse.json({ ran: false, reason: 'no database' })
  const { opened, error } = await openRepeats(db, undefined, req)
  if (error) return NextResponse.json({ ran: false, reason: error }, { status: 500 })
  return NextResponse.json({ ran: true, opened: opened.length })
}
