// Phase 4, step 2: the database client.
// One client for the whole app, created only when the env keys exist — without
// them `supabase` is null and every caller falls back to plain localStorage,
// so the app keeps working before a backend is configured.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { writeLocal } from './local'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/* ── where the session is kept ──
   Left to itself, auth-js decides whether localStorage works by writing a probe key
   at startup. A browser that is merely full fails that probe the same way a browser
   that forbids storage does, and the library answers both by keeping the session in
   memory: it never reads the one already saved, reports no session, and the app
   signs the browser out. The token is still sitting there the whole time.

   So the client is handed the storage directly. Reads go straight through; a write
   that fails for want of room is announced like any other (see lib/local) and the
   session the library holds in memory carries the visit anyway. */
const sessionStore = {
  getItem: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k: string, v: string) => { writeLocal(k, v) },
  removeItem: (k: string) => { try { localStorage.removeItem(k) } catch { /* private mode */ } },
}

export const supabase: SupabaseClient | null = url && anon
  ? createClient(url, anon, { auth: { storage: sessionStore } })
  : null

// the one question the rest of the app asks: is a backend wired up?
export const backendOn = supabase !== null
