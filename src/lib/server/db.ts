// Server-side Supabase access: who is asking, and a client that can do the
// server's own work. Never imported by browser code.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

export const backendConfigured = !!(url && anon)

/** A client for the server's own reads and writes. With the service key it sees
 *  past row-level security (the email log has no browser policies on purpose);
 *  without it, it is the anon client and can only do what any visitor can. */
export function serverDb(): SupabaseClient | null {
  if (!url || !anon) return null
  return createClient(url, service || anon, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const hasServiceKey = !!service

/** The signed-in user behind a request, from its bearer token — or null. The token
 *  is the session's access token the browser client holds; Supabase verifies it. */
export async function userFromRequest(req: Request): Promise<{ id: string; email: string | null } | null> {
  if (!url || !anon) return null
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}
