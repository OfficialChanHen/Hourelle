// Phase 4, step 2: the database client.
// One client for the whole app, created only when the env keys exist — without
// them `supabase` is null and every caller falls back to plain localStorage,
// so the app keeps working before a backend is configured.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null

// the one question the rest of the app asks: is a backend wired up?
export const backendOn = supabase !== null
