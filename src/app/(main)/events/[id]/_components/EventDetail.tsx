'use client'

import { useState } from 'react'
import {
  Building2, Link2, Clock, Wallet, Users, BarChart3,
  CalendarRange, MapPin, UsersRound, Settings,
} from 'lucide-react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { event, participantIds, notGoingIds } from '@/lib/sample'
import { av } from '@/lib/people'
import { AvailabilityPanel } from './AvailabilityPanel'

const TABS = [
  { key: 'availability', label: 'Availability', icon: CalendarRange },
  { key: 'location', label: 'Location vote', icon: MapPin },
  { key: 'attendance', label: 'Attendance', icon: UsersRound },
  { key: 'details', label: 'Event details', icon: Settings },
] as const
type TabKey = (typeof TABS)[number]['key']

export function EventDetail({ initialTab }: { initialTab: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab)

  return (
    <div className="mx-auto max-w-[1240px] px-[26px] pb-[104px] pt-[34px]">
      {/* header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[31px] leading-[1.04] tracking-[-0.01em]">{event.title}</h1>
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-dim">
            <Building2 size={13} /> Hosted by {event.host_name}
          </div>
        </div>
        <button className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[12.5px] font-semibold hover:border-border2">
          <Link2 size={14} /> Share link
        </button>
      </div>

      {/* 4-column open stat strip */}
      <div className="mb-[26px] grid grid-cols-2 gap-8 border-b border-border pb-7 md:grid-cols-4">
        <Stat icon={Clock} label="Time until event">
          <div className="font-serif text-[31px] leading-none">{event.timeUntil}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-dim">
            {event.when} <TimezonePill tz={event.timezone} />
          </div>
        </Stat>

        <Stat icon={Wallet} label="Budget">
          <div className="font-serif text-[31px] leading-none">{event.budgetTotal}</div>
          <div className="mt-1.5 text-[11px] text-dim">{event.budgetPerPerson}</div>
        </Stat>

        <Stat icon={Users} label="Attendance">
          <div className="mb-1.5 flex flex-wrap gap-x-[9px] gap-y-1.5">
            {participantIds.map((id) => (
              <span
                key={id}
                className="text-[11.5px] font-semibold"
                style={{ color: notGoingIds.includes(id) ? 'var(--brick-text)' : 'var(--teal-text)' }}
              >
                {id}
              </span>
            ))}
          </div>
          <div className="text-[11px] text-dim">
            <span className="text-teal-text">7 going</span> · <span className="text-brick-text">1 not going</span>
          </div>
        </Stat>

        <Stat icon={BarChart3} label="Best availability" iconColor="var(--teal-text)">
          <div className="font-serif text-[25px] leading-[1.05]">Wed, Jul 2</div>
          <div className="mt-1 text-[11px] text-dim">8 of 8 free · 9:00 AM</div>
        </Stat>
      </div>

      {/* tabs — filled accent box for active */}
      <div className="mb-6 flex items-center gap-1.5 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-[15px] py-[9px] text-[12.5px] transition-colors ${
                active ? 'bg-accent font-semibold text-on-accent' : 'font-medium text-dim hover:bg-s2 hover:text-text'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* body */}
      {tab === 'availability' ? <AvailabilityPanel /> : <Placeholder tab={tab} />}
    </div>
  )
}

function Stat({
  icon: Icon, label, iconColor, children,
}: {
  icon: typeof Clock
  label: string
  iconColor?: string
  children: React.ReactNode
}) {
  return (
    <div className="py-0.5">
      <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.13em] text-faint">
        <Icon size={13} style={iconColor ? { color: iconColor } : undefined} />
        {label}
      </div>
      {children}
    </div>
  )
}

function Placeholder({ tab }: { tab: string }) {
  const copy: Record<string, { title: string; body: string }> = {
    location: { title: 'Location vote', body: 'A Leaflet map with vote pins and an itinerary builder lives here.' },
    attendance: { title: 'Attendance', body: 'Multi-stop and single-venue headcounts, exceptions, and rosters live here.' },
    details: { title: 'Event details', body: 'Description, budget (host only), timezone, and the participant roster live here.' },
  }
  const c = copy[tab] ?? copy.location
  return (
    <div className="grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-border2 bg-s1 px-6 text-center">
      <div>
        <p className="font-serif text-[26px] tracking-[-0.01em]">{c.title}</p>
        <p className="mx-auto mt-2 max-w-sm text-[12.5px] text-dim">{c.body}</p>
        <div className="mt-4 inline-flex rounded-md border border-border bg-s2 px-2 py-1 text-[10.5px] font-semibold text-dim">
          Coming next
        </div>
      </div>
    </div>
  )
}
