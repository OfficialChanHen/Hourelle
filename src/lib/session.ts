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
  signedIn: boolean
  // the colour was picked on the profile page, not dealt at sign-up: it then wins
  // over the distinct colour a new face is handed when joining an event
  colorChosen?: boolean
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
    if (next.signedIn) localStorage.setItem(CACHE_KEY, JSON.stringify(next))
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
async function accountFromSession(userId: string, email: string | undefined): Promise<Account> {
  // every column, so a profile row from before a later migration still reads
  const { data } = await supabase!.from('profiles').select('*').eq('id', userId).single()
  const row = data as { name?: string; color?: string; color_set?: boolean } | null
  return {
    id: userId,
    name: row?.name ?? email?.split('@')[0] ?? 'Someone',
    color: (row?.color as PersonColor) ?? 'purple',
    kind: 'person',
    email,
    signedIn: true,
    colorChosen: !!row?.color_set,
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
      if (readCache().signedIn) writeCache(STUB)
      return
    }
    void accountFromSession(session.user.id, session.user.email ?? undefined).then(writeCache)
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

/* ── the magic link: how a guest proves an email is theirs ──
   A guest who gave an email can return on any device by proving they own it. The
   link signs them in — passwordless, and creating the account if it is their first
   time — and `next` brings them back to the invite, where the join page sees a
   signed-in visitor whose email matches an entry and hands it over. Same wording
   whether or not the address is known, so this reveals nothing about who joined. */
export async function sendMagicLink(email: string, next: string): Promise<string | null> {
  if (!backendOn) return 'Email links need a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  return error?.message ?? null
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

/* ── security: the password, and the sessions it protects ── */

/** How this account gets in: 'email' for a password, 'google' for the OAuth button.
 *  An account can carry both. Empty when there is no backend or no session. */
export async function signInProviders(): Promise<string[]> {
  if (!backendOn) return []
  const { data } = await supabase!.auth.getUser()
  return data.user?.identities?.map((i) => i.provider) ?? []
}

/** Change the password, proving the old one first. Supabase would let an open
 *  session set a new password without asking, which is how a borrowed laptop
 *  becomes a lockout — so the current one is checked before anything moves. */
export async function changePassword(current: string, next: string): Promise<string | null> {
  if (!backendOn) return 'Changing your password needs a backend. Add your Supabase keys to .env.local.'
  const acc = readCache()
  if (!acc.signedIn || !acc.email) return 'Log in first.'
  const { error: wrong } = await supabase!.auth.signInWithPassword({ email: acc.email, password: current })
  if (wrong) return 'That is not your current password.'
  const { error } = await supabase!.auth.updateUser({ password: next })
  return error?.message ?? null
}

/** End every session this account has anywhere, this browser included. The way back
 *  from a lost phone or a machine you walked away from. */
export async function signOutEverywhere(): Promise<string | null> {
  if (!backendOn) return 'This needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.signOut({ scope: 'global' })
  if (error) return error.message
  writeCache(STUB)
  return null
}

/* ── the account edits itself ── */
export async function updateProfile(patch: { name?: string; color?: PersonColor }): Promise<string | null> {
  const acc = readCache()
  if (!acc.signedIn) return 'Log in first.'
  const name = patch.name?.trim()
  if (patch.name !== undefined && (!name || name.length < 2)) return 'A name needs at least two characters.'
  if (backendOn) {
    const { error } = await supabase!.from('profiles').update({ ...(name ? { name } : {}), ...(patch.color ? { color: patch.color } : {}) }).eq('id', acc.id)
    if (error) return error.message
    // a picked colour is remembered as picked. Its own write, and a refusal is
    // swallowed: a database still on the migration before color_set keeps working
    if (patch.color) await supabase!.from('profiles').update({ color_set: true }).eq('id', acc.id)
  }
  writeCache({ ...acc, ...(name ? { name } : {}), ...(patch.color ? { color: patch.color, colorChosen: true } : {}) })
  return null
}

/* ── Google Calendar: the same Google login, asked for one more thing ──
   Supabase hands back Google's own access token (provider_token) when the sign-in
   asked for a scope, and only then. So an import is a short round trip: leave for
   Google with the free/busy scope, come back to the event, read the token, ask
   Google for busy blocks. The token lasts about an hour and is never refreshed;
   the next import simply makes the trip again. */
export async function connectGoogleCalendar(next: string): Promise<string | null> {
  if (!backendOn) return 'Calendar import needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.freebusy',
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })
  return error?.message ?? null
}
export async function googleProviderToken(): Promise<string | null> {
  if (!backendOn) return null
  const { data } = await supabase!.auth.getSession()
  return data.session?.provider_token ?? null
}

/* ── the end of an account ── */
export async function deleteAccount(): Promise<string | null> {
  if (!backendOn) return 'Deleting an account needs a backend.'
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) return 'Log in first.'
  try {
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) return body.error || `The server said no (${res.status}).`
  } catch {
    return 'Could not reach the server.'
  }
  await supabase!.auth.signOut()
  writeCache(STUB)
  return null
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
