import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { Badge } from './Badge'
import { AvatarRow } from './AvatarRow'
import { TimezonePill } from './TimezonePill'
import { Cover } from './Cover'
import { daysUntil, dateRangeText, type AppEvent } from '@/lib/events'

const COVERS: [string, string][] = [
  ['#E4EDE7', '#CFE0D5'], ['#E7E2EE', '#D9CFE4'], ['#DEE7EC', '#C7DAE2'],
  ['#EFE7D6', '#E4D3B4'], ['#EEE1DD', '#E4CCC7'], ['#E4EADB', '#CDDCBB'],
]
function coverFor(id: string): [string, string] {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COVERS[h % COVERS.length]
}

export function StoredEventCard({ e }: { e: AppEvent }) {
  const du = daysUntil(e.startDate)
  const daysText = du === null ? 'Dates TBD' : du < 0 ? 'Past' : du === 0 ? 'Today' : `${du} day${du === 1 ? '' : 's'}`
  const going = e.participants.filter((p) => p.rsvp === 'attending').length
  const [from, to] = coverFor(e.id)
  return (
    <Link href={`/events/${e.id}?tab=availability`} className="group block overflow-hidden rounded-[13px] border border-border bg-s1 p-3.5 transition-all hover:-translate-y-0.5 hover:border-border2">
      <Cover from={from} to={to} className="-mx-3.5 -mt-3.5 mb-3 h-[92px]" />
      <div className="mb-[11px] flex items-center justify-between">
        <Badge variant="ochre">Planning</Badge>
        <Badge variant={du !== null && du >= 0 && du <= 14 ? 'accent' : 'neutral'}>{daysText}</Badge>
      </div>
      <h3 className="mb-[9px] text-[15px] font-semibold tracking-[-0.01em]">{e.title}</h3>
      <div className="mb-[11px] flex items-center gap-1.5 text-[13px] text-dim">
        <Calendar size={15} /> <span>{dateRangeText(e)}</span> <TimezonePill tz={e.timezone} />
      </div>
      <div className="flex items-center justify-between">
        <AvatarRow people={e.participants.map((p) => ({ initials: p.initials, name: p.name, color: p.color }))} size={24} max={4} />
        <span className="text-[12.5px] text-dim">{going > 0 ? `${going} going` : `${e.participants.length} invited`}</span>
      </div>
    </Link>
  )
}
