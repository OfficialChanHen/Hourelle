'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2, Link2, CalendarDays, Wallet, Users, BarChart3,
  CalendarRange, MapPin, UsersRound, Settings, Copy, Check, Trash2, TriangleAlert,
} from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Avatar } from '@/components/ui/Avatar'
import { getEvent, deleteEvent, bestWindow, availIvOf, fmtMinute, gridStartMinOf, daysUntil, dateRangeText, type AppEvent, type Rsvp } from '@/lib/events'
import { AvailabilityPanel } from './AvailabilityPanel'
import { LocationPanel } from './LocationPanel'
import { AttendancePanel } from './AttendancePanel'

const TABS = [
  { key: 'availability', label: 'Availability', icon: CalendarRange },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'attendance', label: 'Attendance', icon: UsersRound },
  { key: 'details', label: 'Event details', icon: Settings },
] as const
type TabKey = (typeof TABS)[number]['key']

const RSVP: Record<Rsvp, { label: string; color: string; chip: string }> = {
  attending: { label: 'Going', color: 'var(--teal-text)', chip: 'teal' },
  maybe: { label: 'Maybe', color: 'var(--ochre-text)', chip: 'ochre' },
  not_going: { label: 'Not going', color: 'var(--brick-text)', chip: 'brick' },
  pending: { label: 'No reply', color: 'var(--faint)', chip: 'neutral' },
}

export function EventDetail({ id, initialTab }: { id: string; initialTab: TabKey }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [event, setEvent] = useState<AppEvent | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [tabFade, setTabFade] = useState({ l: false, r: false })

  // re-read on tab change too: panels persist edits to storage as they happen, and
  // remounting them from a page-load-time snapshot would drop those edits until reload
  useEffect(() => { setEvent(getEvent(id)) }, [id, tab])

  // tab bar overflows on narrow screens — track scroll position to show edge fades, and keep
  // the active tab in view when it changes
  const checkTabFade = () => {
    const el = tabsRef.current; if (!el) return
    setTabFade({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  useEffect(() => {
    const el = tabsRef.current; if (!el) return
    const ro = new ResizeObserver(checkTabFade); ro.observe(el) // fires initially → sets the fades
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    // scrolling the active tab into view triggers onScroll → checkTabFade
    tabsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [tab])

  function handleDelete() {
    deleteEvent(id)
    router.push('/events')
  }

  if (event === undefined) {
    return (
      <div className="mx-auto max-w-[1240px] px-[26px] pt-[64px]">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-s2" />
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-s2" />
      </div>
    )
  }
  if (event === null) {
    return (
      <div className="mx-auto max-w-[560px] px-[26px] pt-[72px] text-center">
        <p className="font-serif text-[33.5px] tracking-[-0.01em]">Event not found</p>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-dim">This event doesn&apos;t exist on this device, or the link is wrong.</p>
        <Link href="/create" className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent">Create an event</Link>
      </div>
    )
  }

  const going = event.participants.filter((p) => p.rsvp === 'attending').length
  const pending = event.participants.filter((p) => p.rsvp === 'pending').length
  const notGoing = event.participants.filter((p) => p.rsvp === 'not_going').length
  const best = bestWindow(availIvOf(event), event.days, event.durationMin ?? 60)
  const gridStart = gridStartMinOf(event)
  const du = daysUntil(event.startDate)
  const untilBig = du === null ? 'TBD' : du < 0 ? 'Past' : du === 0 ? 'Today' : `${du} day${du === 1 ? '' : 's'}`
  const shareLink = `aline.app/e/${event.id}`

  function copy() {
    navigator.clipboard?.writeText(`https://${shareLink}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      {/* header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[34.5px] leading-[1.04] tracking-[-0.01em]">{event.title}</h1>
          <div className="mt-2 flex items-center gap-1.5 text-[13.5px] text-dim">
            <Building2 size={15} /> Hosted by {event.hostName}
          </div>
        </div>
        <button onClick={copy} className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[14px] font-semibold hover:border-border2">
          {copied ? <Check size={16} /> : <Link2 size={16} />} {copied ? 'Copied' : 'Share link'}
        </button>
      </div>

      {/* 4-column open stat strip */}
      <div className="mb-[26px] grid grid-cols-2 gap-8 border-b border-border pb-7 md:grid-cols-4">
        <Stat icon={CalendarDays} label="Time until event">
          <div className="font-serif text-[34.5px] leading-none">{untilBig}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-dim">{dateRangeText(event)} <TimezonePill tz={event.timezone} /></div>
        </Stat>

        <Stat icon={Wallet} label="Budget">
          {event.budget ? (
            <>
              <div className="font-serif text-[34.5px] leading-none">${Number(event.budget).toLocaleString()}</div>
              <div className="mt-1.5 text-[12.5px] text-dim">
                {event.budgetMode === 'person'
                  ? (going > 0 ? `per person · ~$${(Number(event.budget) * going).toLocaleString()} for ${going} going` : 'per person')
                  : (going > 0 ? `total · ~$${Math.round(Number(event.budget) / going).toLocaleString()} / person` : 'total')}
              </div>
            </>
          ) : (
            <>
              <div className="font-serif text-[28px] leading-none text-dim">No budget</div>
              <div className="mt-1.5 text-[12.5px] text-faint">Not set</div>
            </>
          )}
        </Stat>

        <Stat icon={Users} label="Attendance">
          <div className="mb-1.5 flex flex-wrap gap-x-[9px] gap-y-1.5">
            {event.participants.map((p) => (
              <span key={p.id} className="text-[13px] font-semibold" style={{ color: RSVP[p.rsvp].color }}>{p.initials}</span>
            ))}
          </div>
          <div className="text-[12.5px] text-dim">
            <span className="text-teal-text">{going} going</span>
            {pending > 0 && <> · <span className="text-faint">{pending} pending</span></>}
            {notGoing > 0 && <> · <span className="text-brick-text">{notGoing} out</span></>}
          </div>
        </Stat>

        <Stat icon={BarChart3} label="Best availability" iconColor="var(--teal-text)">
          {best ? (
            <>
              <div className="font-serif text-[28px] leading-[1.05]">{best.dayLabel.replace(/^\w+, /, '')}</div>
              <div className="mt-1 text-[12.5px] text-dim">{best.count} of {event.participants.length} free · {fmtMinute(gridStart + best.s)} – {fmtMinute(gridStart + best.e)}</div>
            </>
          ) : (
            <>
              <div className="font-serif text-[28px] leading-[1.05] text-dim">TBD</div>
              <div className="mt-1 text-[12.5px] text-faint">Waiting on availability</div>
            </>
          )}
        </Stat>
      </div>

      {/* tabs — horizontally scrollable on narrow screens, with edge fades hinting more */}
      <div className="relative mb-6">
        <div ref={tabsRef} onScroll={checkTabFade} className="scroll-slim flex items-center gap-1.5 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button key={t.key} data-active={active} onClick={() => setTab(t.key)} className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[10px] px-[15px] py-[9px] text-[14px] transition-colors ${active ? 'bg-accent font-semibold text-on-accent' : 'font-medium text-dim hover:bg-s3 hover:text-text'}`}>
                <Icon size={16} /> {t.label}
              </button>
            )
          })}
        </div>
        <div className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent transition-opacity ${tabFade.l ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent transition-opacity ${tabFade.r ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      {/* body */}
      {tab === 'availability' && <AvailabilityPanel event={event} />}
      {tab === 'location' && <LocationPanel event={event} />}
      {tab === 'attendance' && <AttendancePanel event={event} />}
      {tab === 'details' && <DetailsTab event={event} shareLink={shareLink} onCopy={copy} copied={copied} onDelete={handleDelete} />}
    </div>
  )
}

function Stat({ icon: Icon, label, iconColor, children }: { icon: typeof Wallet; label: string; iconColor?: string; children: React.ReactNode }) {
  return (
    <div className="py-0.5">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">
        <Icon size={15} style={iconColor ? { color: iconColor } : undefined} />
        {label}
      </div>
      {children}
    </div>
  )
}

/* ── Location tab ── */

/* ── Details tab ── */
function DetailsTab({ event, shareLink, onCopy, copied, onDelete }: { event: AppEvent; shareLink: string; onCopy: () => void; copied: boolean; onDelete: () => void }) {
  const whereText = event.location.mode === 'remote' ? `Online · ${event.location.platform}` : event.location.mode === 'later' ? 'To be decided' : event.location.places.length ? event.location.places.map((p) => p.name).join(' · ') : 'To be decided'
  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <div className="min-w-[320px] flex-[1.5] rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-1 flex items-center gap-2 text-[14.5px] font-semibold"><Settings size={17} className="text-dim" /> Details</div>
        <DetailRow k="Description" v={event.description || <span className="text-faint">No description</span>} />
        <DetailRow k="When" v={<span className="flex items-center gap-1.5">{dateRangeText(event)} <TimezonePill tz={event.timezone} /></span>} />
        <DetailRow k="Where" v={whereText} />
        <DetailRow k="Time zone" v={event.timezone.split('/').pop()?.replace(/_/g, ' ') ?? event.timezone} />
        <DetailRow k="Budget" v={event.budget ? `$${Number(event.budget).toLocaleString()} ${event.budgetMode === 'person' ? 'per person' : 'total'}` : <span className="text-faint">None</span>} last />
      </div>

      <div className="min-w-[280px] flex-1 rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-3 flex items-center gap-2 text-[14.5px] font-semibold">
          <Users size={17} className="text-dim" /> Participants
          <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[12px] text-dim">{event.participants.length}</span>
        </div>
        <div className="flex flex-col">
          {event.participants.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-2.5 py-2 ${i > 0 ? 'border-t border-border' : ''}`}>
              <Avatar initials={p.initials} color={p.color} size={29} font={10.5} />
              <span className="flex-1 truncate text-[13.5px] font-medium">{p.name}</span>
              {p.host && <span className="rounded-md border border-accent-border bg-accent-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-text">Host</span>}
              <span className="rounded-md px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: RSVP[p.rsvp].color, background: `var(--${RSVP[p.rsvp].chip}-bg, var(--s2))` }}>{RSVP[p.rsvp].label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <div className="flex flex-1 items-center gap-2 truncate rounded-[9px] border border-border bg-s2 px-3 py-2">
            <Link2 size={15} className="flex-none text-dim" />
            <span className="truncate font-mono text-[12.5px] text-dim">{shareLink}</span>
          </div>
          <button onClick={onCopy} className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3 text-[13px] font-semibold hover:bg-s2">
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {event.hostedByYou && !event.demo && <DangerZone title={event.title} onDelete={onDelete} />}
    </div>
  )
}

function DangerZone({ title, onDelete }: { title: string; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (confirming && box.current) gsap.fromTo(box.current, { y: -6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' })
  }, { dependencies: [confirming] })

  return (
    <div className="w-full rounded-2xl border border-border bg-s1 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-brick-border bg-brick-bg text-brick-text"><Trash2 size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold">Delete this event</div>
          <div className="mt-0.5 text-[13.5px] text-dim">Removes it for everyone with the link, along with all availability, votes, and chat.</div>
        </div>
        {!confirming && (
          <button onClick={() => setConfirming(true)} className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] border border-brick-border bg-s1 px-3.5 text-[13.5px] font-semibold text-brick-text hover:bg-brick-bg">
            Delete event
          </button>
        )}
      </div>
      {confirming && (
        <div ref={box} className="mt-4 rounded-[11px] border border-brick-border bg-brick-bg p-4">
          <div className="flex items-start gap-2.5">
            <TriangleAlert size={18} className="mt-px flex-none text-brick-text" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-brick-text">Delete &ldquo;{title}&rdquo;?</div>
              <div className="mt-1 text-[13.5px] leading-[1.5] text-brick-text/90">
                This deletes the event for everyone. All availability responses, location votes, and messages go with it. There is no undo.
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={onDelete} className="flex h-9 items-center gap-1.5 rounded-[9px] px-3.5 text-[13.5px] font-semibold text-white" style={{ background: 'var(--brick)' }}>
                  <Trash2 size={15} /> Yes, delete it
                </button>
                <button onClick={() => setConfirming(false)} className="flex h-9 items-center rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13.5px] font-semibold hover:bg-s2">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function DetailRow({ k, v, last }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex gap-3.5 py-3 ${last ? '' : 'border-b border-border'}`}>
      <span className="w-[92px] flex-none text-[12.5px] text-dim">{k}</span>
      <span className="min-w-0 flex-1 text-[13.5px] font-medium">{v}</span>
    </div>
  )
}

