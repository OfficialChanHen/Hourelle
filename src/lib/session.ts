// Phase 4, step 4: who you are.
// The app reads identity synchronously in dozens of render paths, but auth is
// asynchronous — so the signed-in account is mirrored into a module cache (and
// localStorage, for the reload before auth answers). `currentAccount()` is always
// instant; the network only ever fills the cache in the background.
//
// With no backend configured, or nobody signed in, the cache holds STUB — the
// demo identity the app has always used — so every screen keeps working.

import { supabase, backendOn } from './db'
import type { PersonColor } from './colors'

export type AccountKind = 'person' | 'org'
export type Account = {
  id: string
  name: string
  color: PersonColor
  kind: AccountKind
  email?: string
  signedIn: boolean   // a real account, with an email and a way back in
  anonymous?: boolean // a guest session: a genuine uid, but no account behind it
}

// the stubbed identity: what the app is when nobody has signed in
export const STUB: Account = { id: 'JM', name: 'Jordan Miller', color: 'purple', kind: 'person', signedIn: false }

const CACHE_KEY = 'aline.account'
export const ACCOUNT_CHANGED = 'aline:account-changed'

let cached: Account | null = null

function readCache(): Account {
  if (cached) return cached
  if (typeof window === 'undefined') return STUB
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    cached = raw ? (JSON.parse(raw) as Account) : STUB
  } catch {
    cached = STUB
  }
  return cached
}

function writeCache(next: Account) {
  cached = next
  if (typeof window === 'undefined') return
  try {
    // guests are cached too: their uid is the participant id their edits travel under
    if (next.signedIn || next.anonymous) localStorage.setItem(CACHE_KEY, JSON.stringify(next))
    else localStorage.removeItem(CACHE_KEY)
  } catch { /* private mode */ }
  window.dispatchEvent(new Event(ACCOUNT_CHANGED))
}

/** Who the app is acting as, right now, with no awaiting. */
export function currentAccount(): Account {
  return readCache()
}

/* ── the account behind a signed-in session ──
   auth.users holds the credentials; profiles holds the name and color the UI shows.
   One read of profiles turns a session into an Account. */
async function accountFromSession(userId: string, email: string | undefined, anonymous: boolean): Promise<Account> {
  const { data } = await supabase!.from('profiles').select('name, color').eq('id', userId).single()
  return {
    id: userId,
    name: data?.name ?? email?.split('@')[0] ?? 'Someone',
    color: (data?.color as PersonColor) ?? 'purple',
    kind: 'person',
    email,
    // an anonymous session is a real identity to the database but not an account to
    // the person holding it, so the UI keeps saying "not signed in"
    signedIn: !anonymous,
    anonymous,
  }
}

/* ── keep the cache honest for the whole visit ──
   onAuthStateChange fires on sign-in, sign-out, token refresh, and once at startup
   with the restored session — so this one subscription covers every case, including
   coming back to a tab days later. Returns an unsubscribe. */
export function startAuth(): () => void {
  if (!backendOn) return () => {}
  const { data } = supabase!.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      const held = readCache()
      if (held.signedIn || held.anonymous) writeCache(STUB)
      return
    }
    const anon = !!(session.user as { is_anonymous?: boolean }).is_anonymous
    void accountFromSession(session.user.id, session.user.email ?? undefined, anon).then(writeCache)
  })
  return () => data.subscription.unsubscribe()
}

/* ── the four actions the sign-in page needs ──
   Each returns an error message or null, so the UI can stay dumb about Supabase. */

export async function signInWithGoogle(): Promise<string | null> {
  if (!backendOn) return 'Sign-in needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    // Google sends the browser back here with a one-time code the client swaps
    // for a session — see src/app/auth/callback/page.tsx
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
  return error?.message ?? null
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<string | null> {
  if (!backendOn) return 'Sign-up needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.signUp({
    email,
    password,
    // `data` becomes raw_user_meta_data on the new auth.users row, which is where
    // the handle_new_user trigger reads the display name from
    options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
  })
  return error?.message ?? null
}

export async function signInWithEmail(email: string, password: string): Promise<string | null> {
  if (!backendOn) return 'Sign-in needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.signInWithPassword({ email, password })
  return error?.message ?? null
}

/* ── the identity a guest joins under ──
   Step 6 of the roadmap: a guest's claim on a participant stops being a string in
   their own localStorage and becomes a uid the database issued and can verify.
   Signed-in visitors join as themselves; everyone else gets an anonymous session,
   which is a real auth user (with a uid, a token, and a profile row) that simply
   has no email or password behind it. Without a backend this returns null and the
   caller falls back to the old device-local id. */
export async function identityForJoin(name: string): Promise<string | null> {
  if (!backendOn) return null
  const held = currentAccount()
  if (held.signedIn) return held.id // already someone: join as them, not as a stranger
  const { data, error } = await supabase!.auth.signInAnonymously()
  if (error || !data.user) {
    // the likeliest cause is the provider being switched off in the dashboard
    console.warn('aline: anonymous sign-in unavailable —', error?.message)
    return null
  }
  // the trigger already made a profile; give it the name they just typed
  await supabase!.from('profiles').update({ name: name.trim() }).eq('id', data.user.id)
  return data.user.id
}

/* Forgotten passwords. The email carries a recovery link; opening it signs the
   browser in just long enough to set a new password on /auth/reset. Note the
   deliberate silence in the page above: whether or not the address has an account,
   the answer is the same, so this can't be used to discover who has one. */
export async function sendPasswordReset(email: string): Promise<string | null> {
  if (!backendOn) return 'Password reset needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  })
  return error?.message ?? null
}

export async function updatePassword(password: string): Promise<string | null> {
  if (!backendOn) return 'Password reset needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.updateUser({ password })
  return error?.message ?? null
}

export async function signOut(): Promise<void> {
  if (!backendOn) return
  await supabase!.auth.signOut()
  writeCache(STUB)
}

/** Does this project have email confirmation switched on? Only the sign-up
 *  response knows for sure; the page uses this to word its success note. */
export async function hasSession(): Promise<boolean> {
  if (!backendOn) return false
  const { data } = await supabase!.auth.getSession()
  return !!data.session
}
