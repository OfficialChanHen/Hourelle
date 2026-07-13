import { EventDetail } from './_components/EventDetail'

const TABS = ['availability', 'location', 'attendance', 'details'] as const
type TabKey = (typeof TABS)[number]

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  // no valid tab in the URL → EventDetail picks one from the event's lifecycle phase
  const initialTab: TabKey | null = TABS.includes(tab as TabKey) ? (tab as TabKey) : null
  return <EventDetail id={id} initialTab={initialTab} />
}
