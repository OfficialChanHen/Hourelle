'use client'

// Where the back link on an event page points.
//
// An event is reached from three lists — Home, Events, Demos — and the way back
// should be the one you came from. Next's history has no labels and `router.back()`
// cannot name its destination, so the last list page visited is remembered here.
// Only those three paths are recorded, so opening an event, then another from
// inside it, leaves the trail on the list you were actually browsing. Arriving
// cold (a pasted link, a reload, an email) leaves no trail and the default stands.

const KEY = 'hourelle.last-list'
export type ListPage = 'home' | 'events' | 'demos'
const PATHS: Record<string, ListPage> = { '/home': 'home', '/events': 'events', '/demos': 'demos' }

export function noteListPage(pathname: string): void {
  const page = PATHS[pathname]
  if (!page) return
  try { sessionStorage.setItem(KEY, page) } catch { /* private mode */ }
}

export function lastListPage(): ListPage | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(KEY)
    return v === 'home' || v === 'events' || v === 'demos' ? v : null
  } catch { return null }
}

// The invite a visitor is on, so the log-in page can lead back to it and land
// there afterwards, whichever door they took (the header, the tab bar, the join
// form). Kept only while they go straight from the invite to log in: landing on an
// invite signed in joins the plan, so an invite they walked away from (or one left
// open on a shared computer) must not be where the next log-in ends up.
const INVITE_KEY = 'hourelle.last-invite'

export function noteInvite(path: string): void {
  try { sessionStorage.setItem(INVITE_KEY, path) } catch { /* private mode */ }
}

export function keepInviteOn(pathname: string): void {
  if (pathname === '/auth/signin' || /^\/events\/[^/]+\/join$/.test(pathname)) return
  try { sessionStorage.removeItem(INVITE_KEY) } catch { /* private mode */ }
}

export function lastInvite(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(INVITE_KEY)
    return v && /^\/events\/[^/]+\/join(\?|$)/.test(v) ? v : null
  } catch { return null }
}

// Where the account menu was opened from, for each page it sent you to, so that
// page's back link leads back there instead of to Profile. Kept as page → origin
// while you stay among the account pages (Settings to Pricing and back keeps it),
// and the first origin a page gets holds: Home, then Settings, then Help from the
// menu leads Help back to Settings and Settings back to Home, never in a loop.
// Leaving the account pages any other way forgets it all, so a later visit from
// Profile's own links goes back to Profile as before.
const MENU_KEY = 'hourelle.menu-from'
const ACCOUNT_PAGES = new Set(['/profile', '/settings', '/help', '/about', '/pricing', '/privacy', '/terms'])

function readMenuTrail(): Record<string, string> {
  try {
    const v = JSON.parse(sessionStorage.getItem(MENU_KEY) ?? '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

/** The account menu sent you from `from` (a path with its query) to `to`. */
export function noteMenuTrip(from: string, to: string): void {
  const fromPath = from.split(/[?#]/)[0]
  if (fromPath === to || !from.startsWith('/')) return
  const trail = readMenuTrail()
  if (trail[to]) return
  trail[to] = from
  try { sessionStorage.setItem(MENU_KEY, JSON.stringify(trail)) } catch { /* private mode */ }
}

export function keepMenuTrailOn(pathname: string): void {
  if (ACCOUNT_PAGES.has(pathname)) return
  try { sessionStorage.removeItem(MENU_KEY) } catch { /* private mode */ }
}

/** Where the account menu was opened from on its way to `page`, if it was. */
export function menuOrigin(page: string): string | null {
  if (typeof window === 'undefined') return null
  const v = readMenuTrail()[page]
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : null
}

const PLACE_NAMES: Record<string, string> = {
  '/home': 'Home', '/events': 'Plans', '/templates': 'Templates', '/demos': 'Demos',
  '/notifications': 'Notifications', '/create': 'New plan', '/profile': 'Profile',
  '/settings': 'Settings', '/help': 'Help & contact', '/pricing': 'Pricing',
  '/privacy': 'Privacy', '/terms': 'Terms',
}

/** The name a back link gives a page: `about` and a plan's title come from the caller. */
export function placeName(path: string, names: { about: string; plan?: string | null }): string {
  const p = path.split(/[?#]/)[0]
  if (p === '/about') return names.about
  if (PLACE_NAMES[p]) return PLACE_NAMES[p]
  if (/^\/events\/[^/]+/.test(p)) return names.plan || 'Back to the plan'
  return 'Back'
}
