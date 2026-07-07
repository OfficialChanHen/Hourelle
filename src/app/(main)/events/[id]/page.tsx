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
  const initialTab: TabKey = TABS.includes(tab as TabKey) ? (tab as TabKey) : 'availability'
  return <EventDetail id={id} initialTab={initialTab} />
}
