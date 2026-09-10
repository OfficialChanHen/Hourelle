// Bug reports and ideas from the Help page.
// The form posts here; this stores the report in Supabase (so nothing is lost) and,
// when Resend is configured, emails a copy to the address in FEEDBACK_TO_EMAIL.
// Runs on the server so the mail key never reaches a browser.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type Body = { kind?: string; message?: string; email?: string; page?: string; accountId?: string }

const KINDS = new Set(['bug', 'idea', 'question'])

export async function POST(req: Request) {
  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 }) }

  const kind = KINDS.has(body.kind ?? '') ? body.kind! : 'bug'
  const message = (body.message ?? '').trim().slice(0, 4000)
  const email = (body.email ?? '').trim().slice(0, 200) || null
  const page = (body.page ?? '').slice(0, 500) || null
  const userAgent = req.headers.get('user-agent')?.slice(0, 400) ?? null
  if (!message) return NextResponse.json({ ok: false, error: 'Say what happened first.' }, { status: 400 })

  // 1. keep it — Supabase, when configured
  let stored = false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anon) {
    const db = createClient(url, anon)
    const { error } = await db.from('feedback').insert({ kind, message, email, page, user_agent: userAgent, account_id: body.accountId || null })
    stored = !error
    if (error) console.warn('feedback: store failed —', error.message)
  }

  // 2. send it — Resend, when configured (a plain HTTPS call; no SDK needed)
  let emailed = false
  const key = process.env.RESEND_API_KEY
  const to = process.env.FEEDBACK_TO_EMAIL
  const from = process.env.FEEDBACK_FROM_EMAIL || 'Aline <onboarding@resend.dev>'
  if (key && to) {
    const subject = `[Aline] ${kind === 'bug' ? 'Bug report' : kind === 'idea' ? 'Idea' : 'Question'}${page ? ` from ${page}` : ''}`
    const text = [
      message, '',
      `— from: ${email ?? 'no email given'}`,
      `— page: ${page ?? 'unknown'}`,
      `— browser: ${userAgent ?? 'unknown'}`,
      `— account: ${body.accountId ?? 'not included'}`,
    ].join('\n')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, ...(email ? { reply_to: email } : {}) }),
    })
    emailed = res.ok
    if (!res.ok) console.warn('feedback: email failed —', res.status, await res.text().catch(() => ''))
  }

  if (!stored && !emailed) {
    // nowhere to put it: tell the page, which falls back to a mail link
    return NextResponse.json({ ok: false, error: 'No inbox is set up yet.' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, stored, emailed })
}
