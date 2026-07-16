'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2, User, Link2, Users, Copy, MessageCircle, Pencil, EllipsisVertical,
  CalendarRange, MapPin, UsersRound, Settings, Check, Trash2, TriangleAlert,
} from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { LifecycleStrip, PHASE_BADGE } from '@/components/ui/LifecycleStrip'
import { Popover } from '@/components/ui/Popover'
import { getEvent, deleteEvent, patchEvent, dateRangeText, fmtMinute, leadingPlaceOf, phaseOf, removeParticipantPatch, respondedCount, type AppEvent, type Rsvp } from '@/lib/events'
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
  // persist a field and update the in-memory event in one move, so everything reading
  // `event` (the header, an open lock-in dropdown) reflects the edit immediately
  function patchLive(patch: Partial<AppEvent>) {
    if (!event) return
    if (!event.demo) patchEvent(event.id, patch)
    setEvent((ev) => (ev ? { ...ev, ...patch } : ev))
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
          <EditableTitle title={event.title} editable={event.hostedByYou} onSave={(t) => patchLive({ title: t })} />
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
          {event.hostedByYou && phase === 'planning' && <ConfirmBar event={event} onChanged={refresh} onGoToDetails={() => setTab('details')} />}
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
      {tab === 'attendance' && <AttendancePanel event={event} onGoToTab={setTab} />}
      {tab === 'details' && <DetailsTab event={event} onDelete={handleDelete} onGoToTab={setTab} onPatch={patchLive} />}

      {chatOpen && <ChatDrawer event={event} messages={event.messages} onSend={sendMessage} onClose={() => setChatOpen(false)} />}
    </div>
  )
}

/* the event name is the host's to change — click the pencil, type, Enter or blur saves */
function EditableTitle({ title, editable, onSave }: { title: string; editable: boolean; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const h1 = 'font-serif text-[34.5px] leading-[1.04] tracking-[-0.01em]'

  if (!editable) return <h1 className={h1}>{title}</h1>
  if (editing) {
    const save = () => {
      const v = ref.current?.value.trim()
      if (v && v !== title) onSave(v)
      setEditing(false)
    }
    return (
      <input
        ref={ref} defaultValue={title} autoFocus maxLength={80}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className={`w-full max-w-[560px] rounded-[10px] border border-border bg-s0 px-3 py-0.5 outline-none focus:border-border2 ${h1}`}
      />
    )
  }
  return (
    <span className="flex items-center gap-2.5">
      <h1 className={`min-w-0 ${h1}`}>{title}</h1>
      <button onClick={() => setEditing(true)} title="Rename this event" className="grid h-8 w-8 flex-none place-items-center rounded-[8px] text-faint hover:bg-s2 hover:text-dim">
        <Pencil size={15} />
      </button>
    </span>
  )
}

type DetailsGoTab = (t: 'availability' | 'location') => void

/* ── Details tab ── */
function DetailsTab({ event, onDelete, onGoToTab, onPatch }: { event: AppEvent; onDelete: () => void; onGoToTab: DetailsGoTab; onPatch: (patch: Partial<AppEvent>) => void }) {
  const isHost = event.hostedByYou
  const locked = event.status === 'confirmed' && !!event.confirmed

  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <div className="min-w-[320px] flex-[1.5] rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-1 flex items-center gap-2 text-[14.5px] font-semibold"><Settings size={17} className="text-dim" /> Details</div>
        <DetailRow k="Description" v={<DescriptionValue event={event} editable={isHost} onPatch={onPatch} />} />
        <DetailRow k="When" v={<WhenValue event={event} locked={locked} onGoToAvailability={() => onGoToTab('availability')} />} />
        <DetailRow k="Where" v={<WhereValue event={event} locked={locked} onGoToLocation={() => onGoToTab('location')} />} />
        <DetailRow
          k="Budget"
          v={isHost ? <BudgetEditor event={event} onPatch={onPatch} /> : <BudgetReadOnly event={event} />}
          last
        />
      </div>

      <ParticipantsCard event={event} isHost={isHost} onPatch={onPatch} />

      {event.hostedByYou && !event.demo && <DangerZone title={event.title} onDelete={onDelete} />}
    </div>
  )
}

/* Participants: who's in, how they replied, and (for the host) the levers per person */
function ParticipantsCard({ event, isHost, onPatch }: { event: AppEvent; isHost: boolean; onPatch: (patch: Partial<AppEvent>) => void }) {
  const going = event.participants.filter((p) => p.rsvp === 'attending').length
  const noReply = event.participants.filter((p) => p.rsvp === 'pending').length
  return (
    <div className="min-w-[280px] flex-1 rounded-2xl border border-border bg-s1 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[14.5px] font-semibold">
        <Users size={17} className="text-dim" /> Participants
        <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[12px] text-dim">{event.participants.length}</span>
        <span className="ml-auto text-[12.5px] font-normal text-dim">
          {going} going{noReply > 0 && <span className="text-faint"> · {noReply} no reply</span>}
        </span>
      </div>
      <div className="flex flex-col">
        {event.participants.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-2.5 py-2 ${i > 0 ? 'border-t border-border' : ''}`}>
            <Avatar initials={p.initials} color={p.color} size={29} font={10.5} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.name}</span>
            {p.host && <span className="flex-none rounded-md border border-accent-border bg-accent-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-text">Host</span>}
            <span className="flex-none rounded-md px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: RSVP[p.rsvp].color, background: `var(--${RSVP[p.rsvp].chip}-bg, var(--s2))` }}>{RSVP[p.rsvp].label}</span>
            {isHost && !p.you && <ParticipantMenu p={p} event={event} onPatch={onPatch} />}
          </div>
        ))}
      </div>
      <CopyInviteLink id={event.id} />
    </div>
  )
}

/* host actions per person: mark their reply for them, share the link, or remove them */
function ParticipantMenu({ p, event, onPatch }: { p: AppEvent['participants'][number]; event: AppEvent; onPatch: (patch: Partial<AppEvent>) => void }) {
  return (
    <Popover width={216} align="end" className="flex-none" trigger={() => (
      <span className="grid h-7 w-7 place-items-center rounded-[7px] text-faint hover:bg-s2 hover:text-dim"><EllipsisVertical size={14} /></span>
    )}>
      {(close) => <ParticipantMenuBody p={p} event={event} onPatch={onPatch} close={close} />}
    </Popover>
  )
}

function ParticipantMenuBody({ p, event, onPatch, close }: {
  p: AppEvent['participants'][number]; event: AppEvent; onPatch: (patch: Partial<AppEvent>) => void; close: () => void
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const first = p.name.split(' ')[0]
  function markRsvp(r: Rsvp) {
    onPatch({ participants: event.participants.map((x) => (x.id === p.id ? { ...x, rsvp: r } : x)) })
    close()
  }
  function remove() {
    onPatch(removeParticipantPatch(event, p.id))
    close()
  }
  return (
    <div className="flex flex-col p-0.5">
      <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-[.12em] text-faint">Reply for {first}</div>
      {(Object.keys(RSVP) as Rsvp[]).map((r) => (
        <button key={r} onClick={() => markRsvp(r)} className={`flex items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] font-medium hover:bg-s2 ${p.rsvp === r ? 'bg-s2' : ''}`}>
          <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: RSVP[r].color }} />
          {RSVP[r].label}
          {p.rsvp === r && <Check size={13} className="ml-auto text-dim" />}
        </button>
      ))}
      <div className="my-1 border-t border-border" />
      {confirmRemove ? (
        <button onClick={remove} className="rounded-[7px] bg-brick-bg px-2 py-1.5 text-left text-[13px] font-semibold text-brick-text">
          Remove {first}? This clears their replies too.
        </button>
      ) : (
        <button onClick={() => setConfirmRemove(true)} className="rounded-[7px] px-2 py-1.5 text-left text-[13px] font-medium text-brick-text hover:bg-brick-bg">
          Remove from event
        </button>
      )}
    </div>
  )
}

/* the same link the share button offers, where people go looking for it */
function CopyInviteLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(`https://aline.app/e/${id}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  return (
    <button onClick={copy} className={`mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] border text-[13px] font-semibold ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 hover:bg-s2'}`}>
      {copied ? <><Check size={14} /> Copied</> : <><Link2 size={14} /> Copy invite link</>}
    </button>
  )
}

/* When: the locked-in day and time once confirmed; before that, the date range being polled.
   A single-day event already knows its day, so only the time reads as open. */
function WhenValue({ event, locked, onGoToAvailability }: { event: AppEvent; locked: boolean; onGoToAvailability: () => void }) {
  if (locked) {
    const c = event.confirmed!
    const d = event.days.find((x) => x.key === c.dayKey)
    const year = c.dayKey.slice(0, 4)
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {`${d ? `${d.dow}, ${d.date}` : c.dayKey}, ${year} · ${fmtMinute(c.startMin)} – ${fmtMinute(c.endMin)}`}
        <TimezonePill tz={event.timezone} />
      </span>
    )
  }
  if (event.startDate === event.endDate) {
    const dow = event.days[0]?.dow
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {dow ? `${dow}, ` : ''}{dateRangeText(event)} ·
        <button onClick={onGoToAvailability} title="Mark when you're free on the Availability tab" className="font-medium text-accent-text hover:underline">time to be decided</button>
        <TimezonePill tz={event.timezone} />
      </span>
    )
  }
  return <span className="flex flex-wrap items-center gap-1.5">{dateRangeText(event)} <TimezonePill tz={event.timezone} /></span>
}

/* Where: the confirmed venue once locked; before that, the vote leader for a single venue,
   or a pointer to the itinerary on the Location tab. */
function WhereValue({ event, locked, onGoToLocation }: { event: AppEvent; locked: boolean; onGoToLocation: () => void }) {
  const [copied, setCopied] = useState(false)
  const loc = event.location
  if (loc.mode === 'remote') {
    const link = loc.meetingLink.trim()
    const copyLink = () => {
      navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
    }
    return (
      <div className="flex flex-col gap-1.5">
        <span>Online · {loc.platform || 'platform to be decided'}</span>
        {link ? (
          <span className="flex max-w-[420px] items-center gap-2">
            <span className="min-w-0 flex-1 truncate rounded-[7px] border border-border bg-s0 px-2.5 py-1 font-mono text-[12px] text-dim">{link}</span>
            <button onClick={copyLink} className={`flex h-7 flex-none items-center gap-1 rounded-[7px] border px-2 text-[12px] font-semibold ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 text-dim hover:bg-s2'}`}>
              {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </span>
        ) : event.hostedByYou ? (
          <button onClick={onGoToLocation} className="text-left text-[12.5px] font-medium text-accent-text hover:underline">
            Add a meeting link on the Location tab so it lands in every reminder
          </button>
        ) : (
          <span className="text-[12.5px] text-faint">Link to follow</span>
        )}
      </div>
    )
  }

  const itineraryLink = (n: number) => (
    <button onClick={onGoToLocation} className="text-left font-medium text-accent-text hover:underline">
      {n}-stop itinerary · see it on the Location tab
    </button>
  )
  const placeLink = (name: string, caption?: string) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <button onClick={onGoToLocation} title="Open it on the Location tab" className="text-left font-medium text-accent-text hover:underline">{name}</button>
      {caption && <span className="text-dim">· {caption}</span>}
    </span>
  )

  if (locked) {
    const names = event.confirmed!.placeIds
      .map((id) => loc.places.find((p) => p.id === id)?.name)
      .filter((n): n is string => !!n)
    if (names.length === 1) return placeLink(names[0])
    if (names.length > 1) return itineraryLink(names.length)
    return <>To be decided</>
  }
  const stops = event.itinStops?.length ?? 0
  if (loc.planMode === 'itinerary' && stops > 0) return itineraryLink(stops)
  const lead = leadingPlaceOf(event)
  if (lead) return placeLink(lead.place.name, 'leading the vote')
  if (loc.places.length === 1) return placeLink(loc.places[0].name)
  return <>To be decided</>
}

/* Description: hosts edit it in place; everyone else just reads it */
function DescriptionValue({ event, editable, onPatch }: { event: AppEvent; editable: boolean; onPatch: (patch: Partial<AppEvent>) => void }) {
  const [desc, setDesc] = useState(event.description)
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  function save() {
    const v = (ref.current?.value ?? '').trim()
    setDesc(v)
    setEditing(false)
    onPatch({ description: v })
  }

  if (!editable) return <>{desc || <span className="text-faint">No description</span>}</>
  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          ref={ref} defaultValue={desc} rows={3} autoFocus maxLength={500}
          placeholder="What is this event about?"
          className="w-full resize-y rounded-[9px] border border-border bg-s0 px-3 py-2 text-[13.5px] leading-[1.5] outline-none focus:border-border2"
        />
        <div className="flex items-center gap-2">
          <button onClick={save} className="h-8 rounded-[8px] bg-accent px-3 text-[12.5px] font-semibold text-on-accent">Save</button>
          <button onClick={() => setEditing(false)} className="h-8 rounded-[8px] border border-border2 bg-s1 px-3 text-[12.5px] font-semibold text-dim hover:bg-s2">Cancel</button>
        </div>
      </div>
    )
  }
  return (
    <span className="flex items-start gap-2">
      <span className="min-w-0 flex-1">{desc || <span className="text-faint">No description</span>}</span>
      <button onClick={() => setEditing(true)} title="Edit description" className="grid h-7 w-7 flex-none place-items-center rounded-[7px] text-faint hover:bg-s2 hover:text-dim">
        <Pencil size={13} />
      </button>
    </span>
  )
}

/* people who have marked availability on days the event still spans — dormant data for
   removed days stays in storage but shouldn't count here */
function respondedInRange(event: AppEvent): number {
  return respondedCount(Object.fromEntries(event.days.map((d) => [d.key, event.avail[d.key] ?? []])))
}

/* the other side of the budget math, so the entered number reads in both directions */
function BudgetConverse({ amount, mode, responded }: { amount: number; mode: 'total' | 'person'; responded: number }) {
  if (amount <= 0 || responded <= 0) return null
  return (
    <span className="text-[12.5px] leading-[1.5] text-faint">
      <span className="mr-1 italic">or</span>
      <span className="text-dim">
        {mode === 'person'
          ? `$${(amount * responded).toLocaleString()} total for ${responded} currently available`
          : `$${Math.round(amount / responded).toLocaleString()}/person for ${responded} currently available`}
      </span>
    </span>
  )
}

/* what everyone who isn't the host sees: the number, the converse math, and who owns it */
function BudgetReadOnly({ event }: { event: AppEvent }) {
  if (!event.budget) return <span className="text-faint">None yet</span>
  const amount = Number(event.budget)
  const mode = event.budgetMode ?? 'total'
  return (
    <div className="flex flex-col gap-1">
      <span>${amount.toLocaleString()} {mode === 'person' ? 'per person' : 'total'}</span>
      <BudgetConverse amount={amount} mode={mode} responded={respondedInRange(event)} />
      <span className="text-[12px] text-faint">Set by the host</span>
    </div>
  )
}

/* Budget: hosts adjust the amount and flip between per-person and total; the caption
   works out the other side of the math from whoever has marked availability so far */
function BudgetEditor({ event, onPatch }: { event: AppEvent; onPatch: (patch: Partial<AppEvent>) => void }) {
  const [budget, setBudget] = useState(event.budget)
  const [mode, setMode] = useState<'total' | 'person'>(event.budgetMode ?? 'total')

  function changeBudget(v: string) {
    const clean = v.replace(/[^\d]/g, '').slice(0, 7)
    setBudget(clean)
    onPatch({ budget: clean })
  }
  function changeMode(m: 'total' | 'person') {
    setMode(m)
    onPatch({ budgetMode: m })
  }

  const amount = Number(budget || 0)
  const responded = respondedInRange(event)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 w-[110px] items-center rounded-[8px] border border-border bg-s0 px-2.5 focus-within:border-border2">
          <span className="text-[13px] text-dim">$</span>
          <input
            value={budget} onChange={(e) => changeBudget(e.target.value)}
            inputMode="numeric" placeholder="0"
            className="w-full min-w-0 bg-transparent px-1 text-[13.5px] font-medium outline-none"
          />
        </label>
        {/* same segmented treatment as the budget step in the create wizard */}
        <div className="flex flex-wrap rounded-[9px] border border-border bg-s1 p-0.5">
          {([{ v: 'total', l: 'Total' }, { v: 'person', l: 'Per person' }] as const).map((o) => (
            <button
              key={o.v} type="button" onClick={() => changeMode(o.v)}
              className="flex h-7 items-center rounded-[7px] px-3 text-[13px] font-semibold transition-colors"
              style={mode === o.v ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { color: 'var(--dim)' }}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>
      <BudgetConverse amount={amount} mode={mode} responded={responded} />
      {amount > 0 && responded === 0 && (
        <span className="text-[12.5px] text-faint">No one has marked availability yet, so there is no estimate.</span>
      )}
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
      <div className="flex items-start gap-3">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-brick-border bg-brick-bg text-brick-text"><Trash2 size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold">Delete this event</div>
          <div className="mt-0.5 text-[13.5px] text-dim">Removes it for everyone with the link, along with all availability, votes, and chat.</div>
          {!confirming && (
            <button onClick={() => setConfirming(true)} className="mt-3 flex h-9 items-center rounded-[9px] border border-brick-border bg-s1 px-3.5 text-[13.5px] font-semibold text-brick-text hover:bg-brick-bg">
              Delete event
            </button>
          )}
        </div>
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
                <button onClick={onDelete} className="flex h-9 items-center rounded-[9px] px-3.5 text-[13.5px] font-semibold text-white" style={{ background: 'var(--brick)' }}>
                  Yes, delete it
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

