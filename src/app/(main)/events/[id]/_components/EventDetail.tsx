'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2, User, Link2, Users, Copy, MessageCircle,
  CalendarRange, MapPin, UsersRound, Settings, Check, Trash2, TriangleAlert,
} from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { LifecycleStrip, PHASE_BADGE } from '@/components/ui/LifecycleStrip'
import { Popover } from '@/components/ui/Popover'
import { getEvent, deleteEvent, patchEvent, dateRangeText, phaseOf, type AppEvent, type Rsvp } from '@/lib/events'
import { AvailabilityPanel } from './AvailabilityPanel'
import { LocationPanel } from './LocationPanel'
import { AttendancePanel } from './AttendancePanel'
import { StageSummary } from './StageSummary'
import { ConfirmBar } from './ConfirmBar'
import { ConfirmedHero } from './ConfirmedHero'
import { ChatDrawer } from './ChatDrawer'

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

export function EventDetail({ id, initialTab }: { id: string; initialTab: TabKey | null }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'availability')
  const [event, setEvent] = useState<AppEvent | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [tabFade, setTabFade] = useState({ l: false, r: false })
  const tabResolved = useRef(false)

  // re-read on tab change too: panels persist edits to storage as they happen, and
  // remounting them from a page-load-time snapshot would drop those edits until reload
  useEffect(() => {
    const ev = getEvent(id)
    setEvent(ev)
    // no tab in the URL: planning opens on the grid, a settled event on who's coming
    if (!tabResolved.current) {
      tabResolved.current = true
      if (!initialTab && ev && phaseOf(ev) !== 'planning') setTab('attendance')
    }
  }, [id, tab, initialTab])

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

  const phase = phaseOf(event)
  const badge = PHASE_BADGE[phase]
  const locked = phase !== 'planning'
  const shareLink = `aline.app/e/${event.id}`

  function copy() {
    navigator.clipboard?.writeText(`https://${shareLink}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  function refresh() {
    setEvent(getEvent(id))
  }
  function sendMessage(text: string) {
    if (!event) return
    const next = [...event.messages, { id: 'JM', name: 'You', time: 'now', text, you: true }]
    if (!event.demo) patchEvent(event.id, { messages: next })
    setEvent({ ...event, messages: next })
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-[104px] pt-[34px] sm:px-[26px]">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-serif text-[34.5px] leading-[1.04] tracking-[-0.01em]">{event.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13.5px] text-dim">
            {/* a person hosts with a person icon; an organization keeps the building */}
            <span className="flex items-center gap-1.5">
              {event.hostedByYou ? <User size={15} /> : <Building2 size={15} />} Hosted by {event.hostName}
            </span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        </div>
        {/* ml-auto keeps the actions hugging the right edge when the header wraps */}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {event.hostedByYou && phase === 'planning' && <ConfirmBar event={event} onChanged={refresh} />}
          {/* discussion follows the event, not a tab */}
          <button onClick={() => setChatOpen(true)} className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3 text-[14px] font-semibold hover:bg-s2">
            <MessageCircle size={16} className="text-accent-text" />
            <span className="hidden sm:inline">Discussion</span>
            {event.messages.length > 0 && <span className="flex h-[16px] items-center rounded-[10px] bg-accent px-[6px] text-[10.5px] text-on-accent">{event.messages.length}</span>}
          </button>
          {/* share button opens a dropdown with the URL and a one-tap copy */}
          <Popover
            align="end"
            width={312}
            trigger={(open) => (
              <span className={`flex h-9 items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[14px] font-semibold ${open ? 'bg-s2' : 'hover:bg-s2'}`}>
                <Link2 size={16} /> Share link
              </span>
            )}
          >
            {() => (
              <div className="flex items-center gap-2 p-0.5">
                <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-border bg-s2 px-3">
                  <Link2 size={15} className="flex-none text-dim" />
                  <span className="truncate font-mono text-[12.5px] text-dim">{shareLink}</span>
                </div>
                <button onClick={copy} className={`flex h-9 flex-none items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold ${copied ? 'border border-teal-border bg-teal-bg text-teal-text' : 'bg-accent text-on-accent'}`}>
                  {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                </button>
              </div>
            )}
          </Popover>
        </div>
      </div>

      {/* where the event sits in its life — a quiet strip, then one line of state */}
      <div className="mb-6 border-b border-border pb-5">
        <LifecycleStrip phase={phase} className="max-w-[420px]" />
        {(phase === 'planning' || phase === 'past') && (
          <div className="mt-3"><StageSummary event={event} phase={phase} /></div>
        )}
      </div>

      {/* the locked-in plan leads the page once confirmed */}
      {locked && phase !== 'past' && <ConfirmedHero event={event} onChanged={refresh} />}

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
      {tab === 'availability' && <AvailabilityPanel event={event} locked={locked} />}
      {tab === 'location' && <LocationPanel event={event} locked={locked} confirmed={event.confirmed} />}
      {tab === 'attendance' && <AttendancePanel event={event} />}
      {tab === 'details' && <DetailsTab event={event} onDelete={handleDelete} />}

      {chatOpen && <ChatDrawer event={event} messages={event.messages} onSend={sendMessage} onClose={() => setChatOpen(false)} />}
    </div>
  )
}

/* ── Details tab ── */
function DetailsTab({ event, onDelete }: { event: AppEvent; onDelete: () => void }) {
  const whereText = event.location.mode === 'remote' ? `Online · ${event.location.platform}` : event.location.mode === 'later' ? 'To be decided' : event.location.places.length ? event.location.places.map((p) => p.name).join(' · ') : 'To be decided'
  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <div className="min-w-[320px] flex-[1.5] rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-1 flex items-center gap-2 text-[14.5px] font-semibold"><Settings size={17} className="text-dim" /> Details</div>
        <DetailRow k="Description" v={event.description || <span className="text-faint">No description</span>} />
        <DetailRow k="When" v={<span className="flex items-center gap-1.5">{dateRangeText(event)} <TimezonePill tz={event.timezone} /></span>} />
        <DetailRow k="Where" v={whereText} />
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

