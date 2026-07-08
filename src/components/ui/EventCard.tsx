import Link from 'next/link'
import { Calendar, Wallet, Users, Route, MapPin, type LucideIcon } from 'lucide-react'
import { Badge } from './Badge'
import { AvatarRow } from './AvatarRow'
import { TimezonePill } from './TimezonePill'
import { Avatar } from './Avatar'
import { Cover } from './Cover'
import { av } from '@/lib/people'
import type { EventCard as EventCardData } from '@/lib/home'

const metaIcons: Record<string, LucideIcon> = { wallet: Wallet, users: Users, route: Route, 'map-pin': MapPin }

export function EventCard({ e, href = '/events/q3-offsite?tab=availability' }: { e: EventCardData; href?: string }) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-[13px] border border-border bg-s1 p-3.5 transition-all hover:-translate-y-0.5 hover:border-border2"
    >
      <Cover from={e.cover[0]} to={e.cover[1]} className="-mx-3.5 -mt-3.5 mb-3 h-[92px]" />
      <div className="mb-[11px] flex items-center justify-between">
        <Badge variant={e.badge.tone}>{e.badge.text}</Badge>
        <Badge variant={e.days.tone}>{e.days.text}</Badge>
      </div>
      <h3 className="mb-[9px] text-[15px] font-semibold tracking-[-0.01em]">{e.title}</h3>
      <div className="mb-[11px] flex items-center gap-1.5 text-[13px] text-dim">
        <Calendar size={15} /> <span>{e.date}</span> <TimezonePill tz={e.tz === 'PDT' ? 'America/Los_Angeles' : e.tz === 'EDT' ? 'America/New_York' : 'America/Los_Angeles'} />
      </div>

      {e.host && (
        <div className="mb-3 flex items-center gap-1.5 border-b border-border pb-3 text-[13px] text-dim">
          {e.hostId && <Avatar initials={e.hostId} color={av(e.hostId).color} size={21} font={9.5} />}
          <span>{e.host}</span>
        </div>
      )}

      {e.meta ? (
        <>
          <div className="mb-3">
            <AvatarRow people={e.avatars} size={24} max={3} more={e.more} />
          </div>
          <div className="flex items-center gap-[11px] border-t border-border pt-[11px] text-[12.5px] text-dim">
            {e.meta.map((m, i) => {
              const Icon = metaIcons[m.icon] ?? Wallet
              return (
                <span key={i} className="flex items-center gap-1.5">
                  <Icon size={13} /> {m.text}
                </span>
              )
            })}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <AvatarRow people={e.avatars} size={24} max={3} more={e.more} />
          <span className="text-[12.5px] text-dim">{e.going}</span>
        </div>
      )}
    </Link>
  )
}
