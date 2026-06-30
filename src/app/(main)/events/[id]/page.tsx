import { EventDetail } from './_components/EventDetail'

const TABS = ['availability', 'location', 'attendance', 'details'] as const
type TabKey = (typeof TABS)[number]

export default async function EventPage({
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const initialTab: TabKey = TABS.includes(tab as TabKey) ? (tab as TabKey) : 'availability'
  return <EventDetail initialTab={initialTab} />
}
