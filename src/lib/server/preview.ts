// A plan's link preview on the server: the tags a chat app reads when a link is
// pasted, and the plan they describe. What the link may show is decided in
// lib/link-preview; this only fetches the plan and words the tags.
//
// Every crawler that matters here (iMessage, WhatsApp, Discord, Slack, and Meta's
// for Facebook, Messenger and Instagram) is on Next's list of bots that get the
// metadata in the <head> before the page streams, so nothing here has to wait on
// the page itself.

import { cache } from 'react'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import type { AppEvent } from '@/lib/events'
import { previewOf, previewVersion } from '@/lib/link-preview'
import { APP_NAME } from '@/lib/brand'
import { serverDb } from './db'

export const PREVIEW_SIZE = { width: 1200, height: 630 }

/** One plan by id, read the way any visitor with the link may read it. Cached per
 *  request, so the page and its metadata share one query. */
export const previewEvent = cache(async (id: string): Promise<AppEvent | null> => {
  if (!/^[\w-]{1,100}$/.test(id)) return null
  const db = serverDb()
  if (!db) return null
  const { data, error } = await db.from('events').select('data').eq('id', id).maybeSingle()
  if (error || !data) return null
  return (data as { data: AppEvent }).data ?? null
})

// the address this request came in on, so a preview deployment points at its own
// image rather than production's
async function origin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (host) return `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** The tags for a plan's link, or nothing, which leaves the site's own preview. */
export async function previewMetadata(id: string, invite?: string | null): Promise<Metadata> {
  const p = previewOf(await previewEvent(id), invite)
  if (!p) return {}
  const image = {
    url: `${await origin()}/api/preview/${encodeURIComponent(id)}?v=${previewVersion(p)}`,
    ...PREVIEW_SIZE,
    type: 'image/jpeg',
    alt: `${p.title}: ${p.status}`,
  }
  // no og:url: Meta treats it as the link to show, and a personal invite link would
  // turn into the plain one, which asks its person for their name again
  return {
    title: p.title,
    description: p.description,
    openGraph: { type: 'website', siteName: APP_NAME, title: p.title, description: p.description, images: [image] },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [image.url] },
  }
}
