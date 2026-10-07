'use client'

// The browser's side of the calendar feed: ask the server for your feed's address,
// or for a new one. The address is a secret, so it is fetched when wanted and never
// stored on this device.

import { supabase, backendOn } from './db'

// The feed needs migration 0017 and the service key on the server. With a backend it
// says "Coming soon" until NEXT_PUBLIC_CALENDAR_FEED_ON=1 says both are in place;
// without one there is no server to serve it, so it is coming soon there too.
export const feedSoon = (backendOn: boolean) => !backendOn || process.env.NEXT_PUBLIC_CALENDAR_FEED_ON !== '1'

export async function feedUrl(reset = false): Promise<{ url: string } | { error: string }> {
  if (!backendOn) return { error: 'Coming soon.' }
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Log in first.' }
  try {
    const res = await fetch('/api/cal/feed', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reset }) })
    const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok || !out.url) return { error: out.error || `The server said no (${res.status}).` }
    return { url: out.url }
  } catch {
    return { error: 'Could not reach the server.' }
  }
}

/** Where each calendar takes a subscription. Google and Apple want webcal://,
 *  Outlook the plain address. */
export function subscribeLinks(url: string): { google: string; outlook: string; apple: string } {
  const webcal = url.replace(/^https?:\/\//, 'webcal://')
  return {
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=Hourelle`,
    apple: webcal,
  }
}
