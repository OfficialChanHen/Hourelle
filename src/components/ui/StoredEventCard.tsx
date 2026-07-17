'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, RotateCcw } from 'lucide-react'
import { Badge } from './Badge'
import { AvatarRow } from './AvatarRow'
import { TimezonePill } from './TimezonePill'
import { Cover } from './Cover'
import { daysUntil, daysUntilLabel, dateRangeText, phaseOf, type AppEvent } from '@/lib/events'
import { PHASE_BADGE } from './LifecycleStrip'

const COVERS: [string, string][] = [
  ['#E4EDE7', '#CFE0D5'], ['#E7E2EE', '#D9CFE4'], ['#DEE7EC', '#C7DAE2'],
  ['#EFE7D6', '#E4D3B4'], ['#EEE1DD', '#E4CCC7'], ['#E4EADB', '#CDDCBB'],
]
function coverFor(id: string): [string, string] {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COVERS[h % COVERS.length]
}

export function StoredEventCard({ e, reuseHref }: { e: AppEvent; reuseHref?: string }) {
  const router = useRouter()
  const phase = phaseOf(e)
  const badge = PHASE_BADGE[phase]
  const du = daysUntil(e.startDate)
  const going = e.participants.filter((p) => p.rsvp === 'attending').length
  const [from, to] = coverFor(e.id)
  return (
    <Link href={`/events/${e.id}`} className="group block overflow-hidden rounded-[13px] border border-border bg-s1 p-3.5 transition-all hover:-translate-y-0.5 hover:border-border2">
      <Cover src={e.image} from={from} to={to} className="-mx-3.5 -mt-3.5 mb-3 h-[92px]" />
      <div className="mb-[11px] flex items-center justify-between">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {phase !== 'past' && (
          <Badge variant={du !== null && du >= 0 && du <= 14 ? 'accent' : 'neutral'}>{daysUntilLabel(du)}</Badge>
        )}
      </div>
      <h3 className="mb-[9px] text-[15px] font-semibold tracking-[-0.01em]">{e.title}</h3>
      <div className="mb-[11px] flex items-center gap-1.5 text-[13px] text-dim">
        <Calendar size={15} /> <span>{dateRangeText(e)}</span> <TimezonePill tz={e.timezone} />
      </div>
      <div className="flex items-center justify-between">
        <AvatarRow people={e.participants.map((p) => ({ initials: p.initials, name: p.name, color: p.color }))} size={24} max={4} />
        {reuseHref ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); router.push(reuseHref) }}
            onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); router.push(reuseHref) } }}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold text-accent-text hover:bg-accent-bg"
          >
            <RotateCcw size={13} /> Reuse
          </span>
        ) : (
          <span className="text-[12.5px] text-dim">{going > 0 ? `${going} going` : `${e.participants.length} invited`}</span>
        )}
      </div>
    </Link>
  )
}
