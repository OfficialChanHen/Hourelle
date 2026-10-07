// The calendar feed itself: `/api/cal/<token>.ics`, fetched by Google Calendar,
// Outlook or Apple Calendar on their own schedule, with no session. The token finds
// the account; the account's locked-in plans are the entries. What goes in is
// decided by feedStatus: a plan you can't make, or one that reopened, is simply not
// there, so it leaves the subscriber's calendar on the next fetch.

import type { AppEvent } from '@/lib/events'
import { feedStatus, icsFeed, type FeedEntry } from '@/lib/ics'
import { hasServiceKey, serverDb } from '@/lib/server/db'
import { siteUrl } from '@/lib/server/mail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// plans that ended long ago drop off, so the feed stays small for someone with years of them
const KEEP_PAST_MS = 180 * 24 * 60 * 60 * 1000

const notFound = () => new Response('Not found', { status: 404 })

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const token = file.replace(/\.ics$/, '')
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token) || !hasServiceKey) return notFound()
  const db = serverDb()
  if (!db) return notFound()
  const { data: feed } = await db.from('calendar_feeds').select('user_id').eq('token', token).maybeSingle()
  if (!feed) return notFound()
  const uid = feed.user_id as string

  // every plan this account is on with a time locked in. The containment filter is
  // the one account deletion uses to find someone's seats.
  const { data, error } = await db
    .from('events')
    .select('id, data')
    .filter('data->participants', 'cs', JSON.stringify([{ id: uid }]))
    .not('data->confirmed', 'is', null)
    .limit(1000)
  if (error) return new Response('Try again later', { status: 503 })

  const site = siteUrl(req)
  const cutoff = Date.now() - KEEP_PAST_MS
  const entries: FeedEntry[] = []
  for (const row of (data ?? []) as { id: string; data: AppEvent }[]) {
    const ev = row.data
    const status = ev && feedStatus(ev, uid)
    if (!status) continue
    const last = ev.confirmed?.endDayKey ?? ev.confirmed?.dayKey ?? ''
    if (Date.parse(last) < cutoff) continue
    entries.push({ ev, link: `${site}/events/${ev.id}`, status })
  }
  return new Response(icsFeed(entries), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="hourelle.ics"',
      // calendars poll; a shared cache must never hand one person's feed to another
      'Cache-Control': 'private, max-age=300',
    },
  })
}
