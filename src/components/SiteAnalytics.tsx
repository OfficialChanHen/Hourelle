'use client'

/* Vercel Analytics (cookieless page views), with the address cleaned first
   (lib/analytics.ts). A client component because beforeSend is a function. */
import { Analytics } from '@vercel/analytics/next'
import { redactUrl } from '@/lib/analytics'

export function SiteAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: redactUrl(event.url) })} />
}
