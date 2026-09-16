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
