// Phase 4, step 4: who you are.
// The app reads identity synchronously in dozens of render paths, but auth is
// asynchronous — so the signed-in account is mirrored into a module cache (and
// localStorage, for the reload before auth answers). `currentAccount()` is always
// instant; the network only ever fills the cache in the background.
//
// With no backend configured, or nobody signed in, the cache holds STUB — the
// demo identity the app has always used — so every screen keeps working.

import { supabase, backendOn } from './db'
import { resetAppearance } from './prefs'
import { forgetPlan } from './plan'
import type { PersonColor } from './colors'
import { passwordProblem } from './password'

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

const CACHE_KEY = 'hourelle.account'
export const ACCOUNT_CHANGED = 'hourelle:account-changed'

let cached: Account | null = null
// counts auth events; a profile fetch started under an earlier count is stale and
// is dropped, so a token refresh racing a sign-out can never bring the account back
let authGen = 0

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

/* ── has auth had its say yet? ──
   onAuthStateChange fires once at startup with whatever session was restored, but
   that is a round trip after the first render. On a browser that has never cached
   this account — a fresh phone, a magic link opened somewhere new — a signed-in
   person reads as nobody until it lands, and anything deciding on "not signed in"
   in that window decides wrongly. A cached account is an answer in itself, so only
   a browser with nobody in it ever waits. */
export const AUTH_SETTLED = 'hourelle:auth-settled'
let settled = !backendOn
export function authSettled(): boolean {
  return settled || readCache().signedIn
}
function markSettled(): void {
  if (settled) return
  settled = true
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_SETTLED))
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
  // a profile read that hangs must not leave the rest of the app waiting on an
  // answer for the whole visit
  const fuse = setTimeout(markSettled, 4000)
  const { data } = supabase!.auth.onAuthStateChange((_event, session) => {
    const gen = ++authGen
    if (!session?.user) {
      if (readCache().signedIn) writeCache(STUB)
      markSettled()
      return
    }
    void accountFromSession(session.user.id, session.user.email ?? undefined)
      .then((acc) => { if (gen === authGen) writeCache(acc) })
      .finally(markSettled)
    // an acceptance made before a Google or Microsoft sign-up lands on the profile now
    void syncLegalAcceptance()
  })
  return () => { clearTimeout(fuse); data.subscription.unsubscribe() }
}

/* ── the terms, accepted ──
   Sign-up records the moment and the version here, then writes it to the profile
   as soon as there is a session to write with. Best effort: a database without the
   0011 columns refuses the write and the note simply stays on the device. */
const LEGAL_KEY = 'hourelle.legal'
type LegalNote = { version: string; at: number; synced: boolean }
export function recordLegalAcceptance(version: string): void {
  try { localStorage.setItem(LEGAL_KEY, JSON.stringify({ version, at: Date.now(), synced: false } satisfies LegalNote)) } catch { /* private mode */ }
  void syncLegalAcceptance()
}
// how long a note on the device may vouch for the account being made. Accepting
// the terms and arriving here are seconds apart; anything older belongs to an
// earlier account on this browser, and after a deletion it must not speak for the
// next one.
const NOTE_GOOD_FOR = 30 * 60_000

/** Has the signed-in account accepted the terms? The profile is the record; a note
 *  made on this device moments ago, on its way to the profile, counts too. A database
 *  without the 0011 columns cannot say, and then the answer is yes rather than a
 *  locked door. */
export async function legalAccepted(userId: string): Promise<boolean> {
  if (!backendOn) return true
  const { data, error } = await supabase!.from('profiles').select('terms_accepted_at').eq('id', userId).maybeSingle()
  if (error) return true
  if (data?.terms_accepted_at) return true
  try {
    const note = JSON.parse(localStorage.getItem(LEGAL_KEY) ?? 'null') as LegalNote | null
    if (note && !note.synced && Date.now() - note.at < NOTE_GOOD_FOR) { void syncLegalAcceptance(); return true }
  } catch { /* private mode */ }
  return false
}
export async function syncLegalAcceptance(): Promise<void> {
  if (!backendOn) return
  let note: LegalNote | null = null
  try { note = JSON.parse(localStorage.getItem(LEGAL_KEY) ?? 'null') as LegalNote | null } catch { return }
  if (!note || note.synced) return
  const { data } = await supabase!.auth.getSession()
  if (!data.session) return
  const { error } = await supabase!.from('profiles').update({ terms_version: note.version, terms_accepted_at: new Date(note.at).toISOString() }).eq('id', data.session.user.id)
  if (error) return
  try { localStorage.removeItem(LEGAL_KEY) } catch { /* private mode */ }
}

/* ── the four actions the sign-in page needs ──
   Each returns an error message or null, so the UI can stay dumb about Supabase. */

// where the callback sends the browser once the session exists: home, or the page
// that asked for the log-in (an invite, say), when that page is one of ours
function callbackUrl(next?: string): string {
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : ''
  return `${window.location.origin}/auth/callback${safe ? `?next=${encodeURIComponent(safe)}` : ''}`
}

export async function signInWithGoogle(next?: string): Promise<string | null> {
  if (!backendOn) return 'Sign-in needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    // Google sends the browser back here with a one-time code the client swaps
    // for a session — see src/app/auth/callback/page.tsx
    options: { redirectTo: callbackUrl(next) },
  })
  return error?.message ?? null
}

/** The Microsoft door: a personal or work account, through Supabase's Azure provider.
 *  The provider has to be switched on for the project (see docs/phase-10). */
export async function signInWithMicrosoft(next?: string): Promise<string | null> {
  if (!backendOn) return 'Sign-in needs a backend. Add your Supabase keys to .env.local.'
  const { error } = await supabase!.auth.signInWithOAuth({
    provider: 'azure',
    options: { scopes: 'email openid profile', redirectTo: callbackUrl(next) },
  })
  return error?.message ?? null
}

/* ── the two providers the app talks to, by name ── */
export type OAuthProvider = 'google' | 'azure'
export const PROVIDER_LABEL: Record<OAuthProvider, string> = { google: 'Google', azure: 'Microsoft' }

/** The answer sign-up gives when the address already belongs to an account. The
 *  page recognises it and offers the log-in form instead of a plain error. */
export const EMAIL_TAKEN = 'That email already has an account.'

/** Is there an account behind this address? profiles mirrors auth.users (the
 *  handle_new_user trigger copies the email), and it is readable without a session,
 *  so the sign-up form can ask before anything is created. */
export async function emailHasAccount(email: string): Promise<boolean> {
  if (!backendOn) return false
  const clean = email.trim().toLowerCase()
  if (!clean) return false
  const { data } = await supabase!.from('profiles').select('id').eq('email', clean).maybeSingle()
  return !!data
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<string | null> {
  if (!backendOn) return 'Sign-up needs a backend. Add your Supabase keys to .env.local.'
  // one account per email, whichever door made it. Supabase refuses a second one
  // too, but with confirmation emails on it hides the refusal behind a pretend
  // success, and the person is sent to wait for a mail that never comes. Ask first.
  if (await emailHasAccount(email)) return EMAIL_TAKEN
  const weak = passwordProblem(password)
  if (weak) return weak
  const { data, error } = await supabase!.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    // `data` becomes raw_user_meta_data on the new auth.users row, which is where
    // the handle_new_user trigger reads the display name from
    options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
  })
  if (error) return /already|exists|registered/i.test(error.message) ? EMAIL_TAKEN : error.message
  // the pretend success: a user with no identities is how Supabase says "taken"
  if (data.user && data.user.identities?.length === 0) return EMAIL_TAKEN
  return null
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
  authGen++; writeCache(STUB)
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

/** The profile back to its beginnings: the name from sign-up (what Google sent, or
 *  what the form collected, or the part of the email before the @) and the avatar
 *  colour no longer counted as chosen, so every event deals one again. Returns the
 *  restored name, or an error. */
export async function resetProfile(): Promise<{ name: string } | { error: string }> {
  const acc = readCache()
  if (!acc.signedIn) return { error: 'Log in first.' }
  let name = acc.email?.split('@')[0] ?? acc.name
  if (backendOn) {
    const { data } = await supabase!.auth.getUser()
    const meta = (data.user?.user_metadata ?? {}) as { name?: string; full_name?: string }
    name = meta.name?.trim() || meta.full_name?.trim() || name
    const { error } = await supabase!.from('profiles').update({ name, color_set: false }).eq('id', acc.id)
    if (error) return { error: error.message }
  }
  writeCache({ ...acc, name, colorChosen: false })
  return { name }
}

/* ── a calendar, connected through the account you are already in ──
   Supabase hands back the provider's own access token (provider_token) when a
   sign-in asked for a scope, and only then. So an import is a short round trip:
   leave for Google or Microsoft with the calendar scope, come back to the event,
   read the token, ask for busy blocks. The token lasts about an hour and is never
   refreshed; the next import simply makes the trip again.

   Which trip depends on whether that provider is already one of this account's
   doors. If it is, a fresh sign-in through it brings the token. If it is not, the
   trip links it to this account first: a plain sign-in with a provider the account
   has never used would land in a different account, and the import would go to the
   wrong person's grid. Either way the browser comes back to the same account. */
const CALENDAR_SCOPES: Record<OAuthProvider, string> = {
  google: 'https://www.googleapis.com/auth/calendar.freebusy',
  azure: 'email openid profile Calendars.Read',
}
export async function connectCalendar(provider: OAuthProvider, next: string): Promise<string | null> {
  if (!backendOn) return 'Calendar import needs a backend. Add your Supabase keys to .env.local.'
  const options = { scopes: CALENDAR_SCOPES[provider], redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` }
  if (readCache().signedIn) {
    const ids = await listIdentities()
    if (!ids.some((i) => i.provider === provider)) {
      const { error } = await supabase!.auth.linkIdentity({ provider, options })
      if (!error) return null
      if (/already|exists|registered|taken/i.test(error.message)) {
        return `That ${PROVIDER_LABEL[provider]} account is already its own Hourelle account. Log in with it to import that calendar.`
      }
      return error.message
    }
  }
  const { error } = await supabase!.auth.signInWithOAuth({ provider, options })
  return error?.message ?? null
}
export const connectGoogleCalendar = (next: string) => connectCalendar('google', next)
/** The last provider's own token, when the sign-in that made this session asked for one. */
export async function providerToken(): Promise<string | null> {
  if (!backendOn) return null
  const { data } = await supabase!.auth.getSession()
  return data.session?.provider_token ?? null
}
export const googleProviderToken = providerToken

/* ── the two doors: an email and a password, and the Google button ──
   One account can have both. Supabase calls each way in an "identity", and linking
   adds one to the account already signed in rather than signing you in as someone
   else — which is the whole difference between "connect Google" and "log in with
   Google". Manual linking has to be switched on for the project (Authentication →
   Advanced → Manual linking) or the link call comes back refused. */

export type Identity = { provider: string; email?: string }

export async function listIdentities(): Promise<Identity[]> {
  if (!backendOn) return []
  const { data, error } = await supabase!.auth.getUserIdentities()
  if (error || !data) return []
  return data.identities.map((i) => ({
    provider: i.provider,
    email: (i.identity_data?.email as string | undefined) ?? undefined,
  }))
}

/** Add a provider's button to this account. Comes back through /auth/callback. */
export async function linkProvider(provider: OAuthProvider, next: string): Promise<string | null> {
  const label = PROVIDER_LABEL[provider]
  if (!backendOn) return `Connecting ${label} needs a backend. Add your Supabase keys to .env.local.`
  if (!readCache().signedIn) return 'Log in first.'
  const { error } = await supabase!.auth.linkIdentity({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (!error) return null
  // the one refusal worth explaining: that account is already its own account
  // here, and the way to put them together is the merge below
  if (/already|exists|registered|taken/i.test(error.message)) {
    return `That ${label} account is already its own Hourelle account. Log in with ${label} to use it.`
  }
  return error.message
}
export const linkGoogle = (next: string) => linkProvider('google', next)

/** Take a provider's button off this account. Refused if it is the only way in. */
export async function unlinkProvider(provider: OAuthProvider): Promise<string | null> {
  const label = PROVIDER_LABEL[provider]
  if (!backendOn) return 'This needs a backend.'
  const { data, error } = await supabase!.auth.getUserIdentities()
  if (error || !data) return error?.message ?? 'Could not read this account.'
  if (data.identities.length < 2) return 'This is the only way in to your account. Set a password first.'
  const identity = data.identities.find((i) => i.provider === provider)
  if (!identity) return `${label} is not connected to this account.`
  const { error: e2 } = await supabase!.auth.unlinkIdentity(identity)
  return e2?.message ?? null
}
export const unlinkGoogle = () => unlinkProvider('google')

/* ── the end of an account ──
   The server only deletes behind a sign-in from the last few minutes, so the profile
   page asks the person to prove it is them first: their password, or the Google or
   Microsoft door again. REAUTH_NEEDED is what comes back when that proof is missing. */
export const REAUTH_NEEDED = 'reauth'
export async function reauthWithPassword(password: string): Promise<string | null> {
  if (!backendOn) return 'This needs a backend.'
  const email = readCache().email
  if (!email) return 'This account has no email to sign in with.'
  const { error } = await supabase!.auth.signInWithPassword({ email, password })
  return error ? 'That password is not right.' : null
}
export async function reauthWithProvider(provider: OAuthProvider, next: string): Promise<string | null> {
  if (!backendOn) return 'This needs a backend.'
  const { error } = await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(next) } })
  return error?.message ?? null
}
/** End the account. `confirm` is the phrase the person typed ("delete my account");
 *  the route checks it too, so nothing can delete an account by accident. */
export async function deleteAccount(confirm: string): Promise<string | null> {
  if (!backendOn) return 'Deleting an account needs a backend.'
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) return 'Log in first.'
  try {
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm }) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) return body.error || `The server said no (${res.status}).`
    // the account is gone on the server; the browser lets go of its session too, so
    // what follows is the front door, not a page acting for an account that no longer
    // exists. Its traces on this device go with it: the note that it accepted the
    // terms, which must never vouch for the next account, and the look it chose.
    try { localStorage.removeItem(LEGAL_KEY) } catch { /* private mode */ }
    forgetPlan(data.session!.user.id)
    resetAppearance()
    await supabase!.auth.signOut({ scope: 'local' }).catch(() => {})
    authGen++; writeCache(STUB)
  } catch {
    return 'Could not reach the server.'
  }
  await supabase!.auth.signOut()
  authGen++; writeCache(STUB)
  return null
}

export async function signOut(): Promise<void> {
  if (!backendOn) return
  await supabase!.auth.signOut()
  authGen++; writeCache(STUB)
}

/** Does this project have email confirmation switched on? Only the sign-up
 *  response knows for sure; the page uses this to word its success note. */
export async function hasSession(): Promise<boolean> {
  if (!backendOn) return false
  const { data } = await supabase!.auth.getSession()
  return !!data.session
}
