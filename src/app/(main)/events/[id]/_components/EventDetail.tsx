'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { AvatarRow } from '@/components/ui/AvatarRow'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { LifecycleProgress } from '@/components/ui/LifecycleProgress'
import { event, participants } from '@/lib/sample'
import { AvailabilityGrid } from './AvailabilityGrid'
import { ChatDrawer } from './ChatDrawer'

const TABS = [
  { key: 'availability', label: 'Availability' },
  { key: 'location', label: 'Location' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'details', label: 'Details' },
] as const
type TabKey = (typeof TABS)[number]['key']

export function EventDetail({ initialTab }: { initialTab: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [chatOpen, setChatOpen] = useState(false)
  const [seen, setSeen] = useState(false)

  const going = participants.filter((p) => p.rsvp === 'attending')
  const responded = participants.filter((p) => p.rsvp !== 'pending')

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="mx-auto max-w-[1240px] px-6 pb-24 pt-7 lg:px-8">
        {/* breadcrumb */}
        <div className="flex items-center gap-1.5 text-[12px] text-faint">
          <Link href="/home" className="hover:text-dim">Home</Link>
          <span>/</span>
          <Link href="/events" className="hover:text-dim">Events</Link>
          <span>/</span>
          <span className="text-dim">{event.title}</span>
        </div>

        {/* ─── EventHeader ─── */}
        <header className="mt-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Badge variant="ochre" dot>Collecting availability</Badge>
                <Badge variant="accent">{event.daysAway} days away</Badge>
              </div>
              <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-[-0.01em]">{event.title}</h1>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-dim">{event.description}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { setChatOpen(true); setSeen(true) }}
                className="relative inline-flex items-center gap-2 rounded-lg border border-border bg-s1 px-3.5 py-2 text-[13px] font-semibold text-text shadow-soft hover:border-border2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-1L3 20l1-5.5a8.5 8.5 0 0 1 17-3z" /></svg>
                Chat
                {!seen && (
                  <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">3</span>
                )}
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-on-accent shadow-soft transition-transform hover:-translate-y-px">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8M16 6l-4-4-4 4M12 2v13" /></svg>
                Share
              </button>
            </div>
          </div>

          {/* open stat strip — borderless, eyebrow + serif value + caption */}
          <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-4 border-b border-border pb-6">
            <Stat label="When" value={event.dateRange}><TimezonePill tz={event.timezone} /></Stat>
            <Stat label="Hosted by" value={event.host_name} />
            <Stat label="Responses" value={`${responded.length} of ${participants.length}`} caption={`${going.length} going`} />
            <Stat label="Best overlap" value="Sat 10–12" caption="6 of 8 free" />
            <div className="ml-auto flex items-center gap-3 pb-1">
              <AvatarRow people={going.map((p) => ({ initials: p.initials, color: p.color, name: p.name }))} size="md" />
              <span className="text-[12px] text-faint">+ you</span>
            </div>
          </div>
        </header>

        {/* lifecycle */}
        <div className="mt-6 max-w-xl">
          <LifecycleProgress currentStage={event.status} />
        </div>

        {/* ─── TabNav — filled accent box for active, no underlines ─── */}
        <nav className="mt-8 flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-xl px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                  active ? 'bg-accent text-on-accent shadow-soft' : 'text-dim hover:bg-s2 hover:text-text'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>

        {/* ─── Tab body ─── */}
        <section className="mt-6">
          {tab === 'availability' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Availability</p>
                  <p className="mt-1 text-[14px] text-dim">Drag to paint when you&apos;re free. Greener cells mean more of the group overlaps.</p>
                </div>
              </div>
              <AvailabilityGrid />
            </div>
          )}
          {tab !== 'availability' && (
            <Placeholder tab={tab} />
          )}
        </section>
      </div>

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}

function Stat({ label, value, caption, children }: { label: string; value: string; caption?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-faint">{label}</p>
      <p className="mt-1.5 flex items-center gap-2 font-serif text-[26px] leading-none tracking-[-0.01em]">
        {value}
        {children}
      </p>
      {caption && <p className="mt-1 text-[12px] text-dim">{caption}</p>}
    </div>
  )
}

function Placeholder({ tab }: { tab: string }) {
  const copy: Record<string, { title: string; body: string }> = {
    location: { title: 'Location voting', body: 'A Leaflet map with vote pins and an itinerary builder lives here.' },
    attendance: { title: 'Attendance', body: 'Multi-stop and single-venue headcounts, exceptions, and rosters live here.' },
    details: { title: 'Event details', body: 'Description, budget (host only), timezone, and reminder schedule live here.' },
  }
  const c = copy[tab]
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border2 bg-s1 px-6 py-20 text-center">
      <p className="font-serif text-[26px] tracking-[-0.01em]">{c.title}</p>
      <p className="mt-2 max-w-sm text-[13.5px] text-dim">{c.body}</p>
      <div className="mt-5"><Badge variant="neutral">Coming next</Badge></div>
    </div>
  )
}
