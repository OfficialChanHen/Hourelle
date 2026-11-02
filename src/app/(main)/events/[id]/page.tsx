import type { Metadata } from 'next'
import { EventDetail } from './_components/EventDetail'
import { previewMetadata } from '@/lib/server/preview'

const TABS = ['availability', 'location', 'attendance', 'details'] as const
type TabKey = (typeof TABS)[number]

// a locked plan's link is shared as the plan page itself; it gets the same preview
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return previewMetadata((await params).id)
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; focus?: string }>
}) {
  const { id } = await params
  const { tab, focus } = await searchParams
  // no valid tab in the URL → EventDetail picks one from the event's lifecycle phase
  const initialTab: TabKey | null = TABS.includes(tab as TabKey) ? (tab as TabKey) : null
  return <EventDetail id={id} initialTab={initialTab} spotlightDelete={focus === 'delete'} />
}
