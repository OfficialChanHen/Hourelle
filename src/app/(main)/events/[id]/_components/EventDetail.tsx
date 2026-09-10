'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2, User, Link2, Copy, MessageCircle, Pencil, EllipsisVertical, CopyPlus,
  Check, Trash2, TriangleAlert, Receipt, Plus, X, ImagePlus, Video, UserRoundX,
} from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Cover, COVER_PRESETS } from '@/components/ui/Cover'
import { pushFlash } from '@/components/ui/FlashToast'
import { TimezonePill } from '@/components/ui/TimezonePill'
import { DaysPicker } from '@/components/ui/DaysPicker'
import { TimeSelect } from '@/components/ui/TimeSelect'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { LifecycleStrip, PHASE_BADGE } from '@/components/ui/LifecycleStrip'
import { Popover, PopoverItem, PopoverSep, PopoverTitle } from '@/components/ui/Popover'
import { getEvent, deleteEvent, leaveEvent, patchEvent, appendMessage, claimEvent, availIvOf, bestWindow, buildDays, buildDaysFrom, buildTimes, byYouFirst, dateRangeText, fmtMinute, fullAvailIvOf, gridStartMinOf, leadingPlaceOf, leaveGuestSession, markMessagesSeen, maxPollDays, phaseOf, removeParticipantPatch, respondedCount, seenMessageCount, selectedDayKeys, stepOf, viewOf, type AppEvent, type Rsvp } from '@/lib/events'
import { AddToCalendar } from './AddToCalendar'
import { AvailabilityPanel } from './AvailabilityPanel'
import { LocationPanel } from './LocationPanel'
import { AttendancePanel } from './AttendancePanel'
import { StageSummary } from './StageSummary'
import { ConfirmBar } from './ConfirmBar'
import { ConfirmedHero } from './ConfirmedHero'
import { ChatDrawer } from './ChatDrawer'
import { useIsIOS } from '@/hooks/useIsIOS'
import { useLiveEvents } from '@/hooks/useLiveEvents'

const TABS = [
  { key: 'availability', label: 'Availability', short: 'Availability' },
  { key: 'location', label: 'Location', short: 'Location' },
  { key: 'attendance', label: 'Attendance', short: 'Attendance' },
  { key: 'details', label: 'Event details', short: 'Details' },
] as const
type TabKey = (typeof TABS)[number]['key']

const RSVP: Record<Rsvp, { label: string; color: string; chip: string }> = {
  attending: { label: 'Going', color: 'var(--teal-text)', chip: 'teal' },
  maybe: { label: 'Maybe', color: 'var(--ochre-text)', chip: 'ochre' },
  not_going: { label: 'Not going', color: 'var(--brick-text)', chip: 'brick' },
  pending: { label: 'No reply', color: 'var(--faint)', chip: 'neutral' },
}
// while planning, nobody has been asked "are you coming" yet — replies speak to
// availability, so the same states wear planning-stage words. "Maybe" only exists
// once a time is locked; the label here is a fallback for stray stored data.
const PLAN_RSVP_LABEL: Record<Rsvp, string> = {
  attending: 'Available', maybe: 'Unsure', not_going: 'Can’t make it', pending: 'No reply',
}
const rsvpLabel = (r: Rsvp, locked: boolean) => (locked ? RSVP[r].label : PLAN_RSVP_LABEL[r])

export function EventDetail({ id, initialTab, spotlightDelete = false }: { id: string; initialTab: TabKey | null; spotlightDelete?: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'availability')
  // switching tabs writes ?tab= into the address bar, so a reload (or a copied URL)
  // comes back to the tab you were on. replaceState rather than router.replace:
  // it keeps the URL honest without a navigation or a re-render of the page.
  const goTab = (next: TabKey) => {
    setTab(next)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url)
  }
  const [event, setEvent] = useState<AppEvent | null | undefined>(undefined)
  // clicking a person or group elsewhere jumps to the availability grid filtered to
  // them; cleared during render once the user moves off that tab
  const [availFocus, setAvailFocus] = useState<string[] | null>(null)
  if (tab !== 'availability' && availFocus) setAvailFocus(null)
  // nonce: each best-window click re-centers the grid, even mid-visit
  const [bestFocus, setBestFocus] = useState(0)
  if (tab !== 'availability' && bestFocus) setBestFocus(0)
  const [copied, setCopied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  // unread discussion count: what arrived since the drawer was last open, not the
  // lifetime total. Read after mount (localStorage), marked seen while the drawer is up
  const [seenMsgs, setSeenMsgs] = useState<number | null>(null)
  useEffect(() => { setSeenMsgs(seenMessageCount(id)) }, [id])
  const msgCount = event?.messages.length ?? 0
  useEffect(() => {
    if (!chatOpen) return
    setSeenMsgs(msgCount)
    markMessagesSeen(id, msgCount)
  }, [chatOpen, msgCount, id])
  const unread = seenMsgs === null ? 0 : Math.max(0, msgCount - seenMsgs)
  // frozen at the moment the drawer opens, so the "New" rule inside it holds
  // still even as reading marks everything seen
  const [unreadMark, setUnreadMark] = useState<number | undefined>(undefined)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [tabFade, setTabFade] = useState({ l: false, r: false })
  const tabResolved = useRef(false)
  const isIOS = useIsIOS()

  // re-read on tab change too: panels persist edits to storage as they happen, and
  // remounting them from a page-load-time snapshot would drop those edits until reload
  useEffect(() => {
    // viewOf: with a guest session this browser sees the event as that guest —
    // `you` markers on them, host powers off. Raw storage is untouched.
    // an event this browser hosts but nobody owns, opened by a real account: it is
    // yours now — the host entry takes your identity and the row gains a host_id
    if (claimEvent(id)) pushFlash('This event is now on your account', 'accent')
    const raw = getEvent(id)
    const ev = raw ? viewOf(raw) : raw
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

  // the grid's "Lock these days" shortcut: hands the winning run to the confirm modal
  // and opens it (nonce bumps so a repeat ask reopens). Lives above the early returns —
  // hooks must run on every render.
  const [lockAsk, setLockAsk] = useState<{ dayKey: string; endDayKey?: string; nonce: number } | null>(null)
  // the grid dial's days-in-a-row, reported by the availability panel so the lock-in
  // modal offers a time (1) or a first-to-last run (2+). Null until the grid reports.
  const [runLen, setRunLen] = useState<number | null>(null)

  function handleDelete() {
    const title = event?.title
    deleteEvent(id)
    pushFlash(title ? `${title} was deleted` : 'Event deleted', 'brick')
    // back to wherever they came from; a straight-to-URL visit falls back to home
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/home')
  }
  // the non-host way out: this device's copy goes, the host's plan stays
  function handleLeave() {
    const title = event?.title
    leaveEvent(id)
    pushFlash(title ? `${title} was removed from your events` : 'Removed from your events', 'brick')
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/home')
  }

  // Step 7: a change from anyone else lands in the cache and is announced, so the open
  // event follows it live — new chat messages, votes and availability appear without a
  // reload. The panels keep their own in-progress edits in local state, so a message
  // arriving mid-drag updates the page around you rather than under you.
  useLiveEvents(refresh)

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
        <p className="font-serif font-normal text-[33.5px] tracking-[-0.01em]">Event not found</p>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-dim">This event doesn&apos;t exist on this device, or the link is wrong.</p>
        <Link href="/create" className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent">Create an event</Link>
      </div>
    )
  }

  const phase = phaseOf(event)
  const badge = PHASE_BADGE[phase]
  const locked = phase !== 'planning'
  // the viewer, wherever the `you` marker sits — the guest when a session is active
  const me = event.participants.find((p) => p.you)
  // a real, working URL: the join page asks for a name, then everything just works.
  // `event` only exists after the mount effect, so window is safe to read here.
  const joinUrl = `${window.location.origin}/events/${event.id}/join`
  const shareLink = `${window.location.host}/events/${event.id}/join`

  function copy() {
    navigator.clipboard?.writeText(joinUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  function refresh() {
    const raw = getEvent(id)
    setEvent(raw ? viewOf(raw) : raw)
  }
  // persist a field and update the in-memory event in one move, so everything reading
  // `event` (the header, an open lock-in dropdown) reflects the edit immediately
  function patchLive(patch: Partial<AppEvent>) {
    if (!event) return
    if (!event.demo) patchEvent(event.id, patch)
    setEvent((ev) => (ev ? { ...ev, ...patch } : ev))
  }
  function goToAvailabilityFor(pid: string) {
    setAvailFocus([pid])
    goTab('availability')
  }
  function goToAvailabilityGroup(pids: string[]) {
    setAvailFocus(pids.length ? pids : null)
    goTab('availability')
  }
  function goToBestWindow() {
    setBestFocus((n) => n + 1)
    goTab('availability')
  }
  function sendMessage(text: string) {
    if (!event) return
    const sender = event.participants.find((p) => p.you)
    if (!sender) return // nobody here is you — the grid's "Add me" is the way in
    const msg = { id: sender.id, name: sender.name, time: 'now', at: Date.now(), text, you: true }
    // stored `you` means the stubbed account; a guest's line carries only their id and
    // viewOf remaps it. Messages go out as their own rows, so nobody's chat is overwritten.
    const saved = event.demo ? msg : appendMessage(event.id, { ...msg, you: !sender.guest })
    setEvent({ ...event, messages: [...event.messages, { ...saved, you: true }] })
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-[104px] pt-5 sm:px-[26px] sm:pt-[34px]">
      {/* the host's cover, when one is set — photo or preset scene; shorter on phones
          so the tabs and content stay within the first screen */}
      {event.image && <Cover src={event.image} from="#E4EDE7" to="#CFE0D5" className="mb-4 h-[92px] border border-border sm:mb-5 sm:h-[170px]" rounded="rounded-2xl" />}
      {/* header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <EditableTitle title={event.title} editable={event.hostedByYou} onSave={(t) => patchLive({ title: t })} />
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13.5px] text-dim">
            {/* the icon reads the hosting account's kind — person or organization (set by
                the login later); events stored before hostKind fall back on hostedByYou */}
            <span className="flex items-center gap-1.5">
              {(event.hostKind ?? (event.hostedByYou ? 'person' : 'org')) === 'org' ? <Building2 size={15} /> : <User size={15} />} Hosted by {event.hostName}
            </span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {/* the join flow put a name on this browser — say whose answers these are,
                and offer the way out (back to viewing as yourself) */}
            {me?.guest && (
              <span className="flex items-center gap-1.5 rounded-lg border border-accent-border bg-accent-bg px-2 py-0.5 text-[12px] font-medium text-accent-text">
                You&apos;re here as {me.name}
                <button
                  onClick={() => { leaveGuestSession(event.id); refresh() }}
                  className="font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  Leave
                </button>
              </span>
            )}
          </div>
        </div>
        {/* ml-auto keeps the actions hugging the right edge when the header wraps */}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {event.hostedByYou && phase === 'planning' && <ConfirmBar event={event} onChanged={refresh} onGoToDetails={() => goTab('details')} onGoToLocation={() => goTab('location')} prefill={lockAsk} openNonce={lockAsk?.nonce} runLen={runLen ?? undefined} />}
          {/* discussion lives in the floating bubble alone — one entry point, less header */}
          {/* share button opens a dropdown with the URL and a one-tap copy; on phones it
              folds into the ⋯ menu so the title and lock-in keep the row */}
          <Popover
            align="end"
            width={312}
            className="hidden sm:block"
            trigger={(open) => (
              <span className={`flex h-9 items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-3.5 text-[14px] font-semibold ${open ? 'bg-s2' : 'hover:bg-s2'}`}>
                <Link2 size={16} /> Share link
              </span>
            )}
          >
            {() => (
              <>
                <PopoverTitle>Invite link</PopoverTitle>
                <div className="flex items-center gap-2 p-1">
                  <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-border bg-s2 px-3">
                    <Link2 size={15} className="flex-none text-dim" />
                    <span className="truncate font-mono text-[12.5px] text-dim">{shareLink}</span>
                  </div>
                  <button onClick={copy} className={`flex h-9 flex-none items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold ${copied ? 'border border-teal-border bg-teal-bg text-teal-text' : 'bg-accent text-on-accent'}`}>
                    {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                  </button>
                </div>
              </>
            )}
          </Popover>
          <Popover
            align="end"
            width={216}
            className="sm:hidden"
            trigger={(open) => (
              <span aria-label="More actions" className={`grid h-9 w-9 place-items-center rounded-[9px] border border-border2 bg-s1 ${open ? 'bg-s2' : 'hover:bg-s2'}`}>
                <EllipsisVertical size={16} />
              </span>
            )}
          >
            {() => (
              <PopoverItem onClick={copy} icon={copied ? <Check size={15} className="text-teal-text" /> : <Link2 size={15} />}>
                {copied ? 'Link copied' : 'Copy invite link'}
              </PopoverItem>
            )}
          </Popover>
        </div>
      </div>

      {/* where the event sits in its life — a quiet strip, then one line of state */}
      <div className="mb-4 border-b border-border pb-4 sm:mb-6 sm:pb-5">
        <LifecycleStrip phase={phase} className="max-w-[420px]" />
        {(phase === 'planning' || phase === 'past') && (
          <div className="mt-3"><StageSummary event={event} phase={phase} onGoToAvailability={goToBestWindow} /></div>
        )}
      </div>

      {/* the locked-in plan leads the page once confirmed */}
      {locked && phase !== 'past' && <ConfirmedHero event={event} onChanged={refresh} />}

      {/* tabs — horizontally scrollable on narrow screens, with edge fades hinting more */}
      <div className="relative mb-4 sm:mb-6">
        <div ref={tabsRef} onScroll={checkTabFade} className="scroll-slim flex items-center gap-1 overflow-x-auto pb-1 sm:gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              // words alone carry the tabs — the filled box says which one is active
              <button key={t.key} data-active={active} onClick={() => goTab(t.key)} className={`flex flex-none items-center whitespace-nowrap rounded-[10px] px-3 py-3 text-[13.5px] transition-colors sm:px-[15px] sm:py-[9px] sm:text-[14px] ${active ? 'bg-accent font-semibold text-on-accent' : 'font-medium text-dim hover:bg-s3 hover:text-text'}`}>
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>
        <div className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent transition-opacity ${tabFade.l ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent transition-opacity ${tabFade.r ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      {/* body */}
      {tab === 'availability' && (
        <AvailabilityPanel
          event={event}
          locked={locked}
          initialFilter={availFocus}
          focusBest={bestFocus}
          onLockDays={event.hostedByYou && phase === 'planning'
            ? (startKey, endKey) => setLockAsk((p) => ({ dayKey: startKey, endDayKey: endKey !== startKey ? endKey : undefined, nonce: (p?.nonce ?? 0) + 1 }))
            : undefined}
          onRunChange={setRunLen}
          onPatch={patchLive}
        />
      )}
      {tab === 'location' && <LocationPanel event={event} locked={locked} confirmed={event.confirmed} onPatch={patchLive} />}
      {tab === 'attendance' && <AttendancePanel event={event} onGoToTab={goTab} onViewAvailability={goToAvailabilityFor} onViewAvailabilityGroup={goToAvailabilityGroup} onGoToBestWindow={goToBestWindow} />}
      {tab === 'details' && <DetailsTab event={event} onDelete={handleDelete} onLeave={handleLeave} onGoToTab={goTab} onGoToBestWindow={goToBestWindow} onPatch={patchLive} onViewAvailability={goToAvailabilityFor} spotlightDelete={spotlightDelete} />}

      {/* discussion follows you down the page — the classic chat bubble, above the
          mobile tab bar; it is the one and only way in, unread badge included */}
      {!chatOpen && (
        <button
          onClick={() => { setUnreadMark(unread > 0 ? seenMsgs ?? 0 : undefined); setChatOpen(true) }}
          aria-label={unread > 0 ? `Open discussion, ${unread} unread` : 'Open discussion'}
          // on iOS the bubble is clear liquid glass (frost, rim, sheen — no fill);
          // elsewhere it stays the solid accent dot
          className={`fixed bottom-[84px] right-4 z-40 grid h-12 w-12 place-items-center rounded-full md:bottom-6 md:right-6 ${isIOS ? 'liquid-glass text-accent-text' : 'bg-accent text-on-accent shadow-soft'}`}
        >
          <MessageCircle size={21} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-s1 bg-brick px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      )}

      {chatOpen && <ChatDrawer event={event} messages={event.messages} unreadFrom={unreadMark} onSend={sendMessage} onClose={() => setChatOpen(false)} readOnly={!!event.demo} />}
    </div>
  )
}

/* the event name is the host's to change — click the pencil, type, Enter or blur saves */
function EditableTitle({ title, editable, onSave }: { title: string; editable: boolean; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const h1 = 'font-serif text-[27px] leading-[1.04] tracking-[-0.01em] sm:text-[34.5px]'

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
function DetailsTab({ event, onDelete, onLeave, onGoToTab, onGoToBestWindow, onPatch, onViewAvailability, spotlightDelete = false }: {
  event: AppEvent; onDelete: () => void; onLeave: () => void; onGoToTab: DetailsGoTab; onGoToBestWindow: () => void
  onPatch: (patch: Partial<AppEvent>) => void; onViewAvailability: (pid: string) => void; spotlightDelete?: boolean
}) {
  const isHost = event.hostedByYou
  const locked = event.status === 'confirmed' && !!event.confirmed

  return (
    // two columns on large screens: details + expenses stacked left, participants right.
    // Below lg the same order stacks, so the open-ended roster comes last and the
    // compact cards stay reachable without scrolling past it.
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
      <div className="grid min-w-0 gap-3.5">
      <div className="rounded-2xl border border-border bg-s1 p-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Details</div>
        {isHost && <DetailRow k="Cover" v={<CoverPicker event={event} onPatch={onPatch} />} />}
        <DetailRow k="Description" v={<DescriptionValue event={event} editable={isHost} onPatch={onPatch} />} />
        <DetailRow k="When" v={<WhenValue event={event} editable={isHost && !locked} onGoToAvailability={() => onGoToTab('availability')} onGoToBestWindow={onGoToBestWindow} onPatch={onPatch} />} />
        <DetailRow k="Where" v={<WhereValue event={event} locked={locked} onGoToLocation={() => onGoToTab('location')} editable={isHost} onPatch={onPatch} />} />
        {/* optional deadlines — each reminds everyone the day before and the day of.
            Plan-by belongs to planning, RSVP-by to the locked plan. */}
        {!locked && (isHost || event.planDeadline) && (
          <DetailRow k="Plan by" v={<DeadlineValue value={event.planDeadline} editable={isHost} onChange={(v) => onPatch({ planDeadline: v })} hint="Reminders go out the day before and the day of." max={event.endDate} />} />
        )}
        {locked && (isHost || event.rsvpDeadline) && (
          <DetailRow k="RSVP by" v={<DeadlineValue value={event.rsvpDeadline} editable={isHost} onChange={(v) => onPatch({ rsvpDeadline: v })} hint="Everyone gets a reminder the day before and the day of. Late answers still count." max={event.confirmed?.dayKey} />} />
        )}
        <DetailRow k="Spots" v={<CapacityValue event={event} editable={isHost} onPatch={onPatch} />} />
        <DetailRow
          k="Budget"
          v={isHost ? <BudgetEditor event={event} onPatch={onPatch} /> : <BudgetReadOnly event={event} />}
          last
        />
        {/* logistics people come here for: put the plan on a calendar, or reuse its shape */}
        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
          <AddToCalendar
            event={event}
            slot={event.confirmed ? { dayKey: event.confirmed.dayKey, endDayKey: event.confirmed.endDayKey, startMin: event.confirmed.startMin, endMin: event.confirmed.endMin } : null}
            align="start"
          />
          <Link href={`/create?from=${event.id}`} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-s1 px-[11px] text-[13px] font-medium hover:border-border2">
            <CopyPlus size={15} /> Plan another like this
          </Link>
        </div>
      </div>

      {/* spending is real once the plan is locked — while planning, the budget row above is the whole money story */}
      {locked && <ExpensesCard event={event} isHost={isHost} onPatch={onPatch} />}
      </div>

      <ParticipantsCard event={event} isHost={isHost} onPatch={onPatch} onViewAvailability={onViewAvailability} />

      {event.hostedByYou && !event.demo && <div className="min-w-0 lg:col-span-2"><DangerZone title={event.title} onDelete={onDelete} spotlight={spotlightDelete} /></div>}
      {/* someone else's event: you can't delete it, but you can take it off your side */}
      {!event.hostedByYou && !event.demo && <div className="min-w-0 lg:col-span-2"><LeaveZone title={event.title} onLeave={onLeave} spotlight={spotlightDelete} /></div>}
    </div>
  )
}

/* Participants: who's in, how they replied, and (for the host) the levers per person.
   While planning, the chip and the header counts come from actual replies: marked a
   time in the current window (or vouched for by the host) → Available, said no days
   work (or the host marked them out) → Can't make it, silence → No reply. One group each. */
type PlanGroup = 'available' | 'cant' | 'none'
const PLAN_GROUP: Record<PlanGroup, { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: 'var(--teal-text)', bg: 'var(--teal-bg)' },
  cant: { label: 'Can’t make it', color: 'var(--brick-text)', bg: 'var(--brick-bg)' },
  none: { label: 'No reply', color: 'var(--faint)', bg: 'var(--s2)' },
}
function ParticipantsCard({ event, isHost, onPatch, onViewAvailability }: {
  event: AppEvent; isHost: boolean; onPatch: (patch: Partial<AppEvent>) => void; onViewAvailability: (pid: string) => void
}) {
  const locked = event.status === 'confirmed' && !!event.confirmed
  // who actually marked a free time on a day the event still spans
  const availIv = availIvOf(event)
  const marked = new Set<string>()
  for (const d of event.days) for (const [pid, ivs] of Object.entries(availIv[d.key] ?? {})) if (ivs.length) marked.add(pid)
  // available = marked a time in the current window, or the host vouched for them
  const groupOf = (p: AppEvent['participants'][number]): PlanGroup =>
    p.rsvp === 'not_going' || event.unavailableIds?.includes(p.id) ? 'cant'
    : marked.has(p.id) || p.rsvp === 'attending' ? 'available' : 'none'

  const going = event.participants.filter((p) => p.rsvp === 'attending').length
  const noReply = event.participants.filter((p) => p.rsvp === 'pending').length
  const nAvail = event.participants.filter((p) => groupOf(p) === 'available').length
  const nCant = event.participants.filter((p) => groupOf(p) === 'cant').length
  const nNone = event.participants.length - nAvail - nCant

  // no group titles on this card, so availability ordering would read as random —
  // the status chip per row carries the state; names carry the order
  const sorted = [...event.participants].sort(byYouFirst)

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-s1 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Participants</span>
        <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[11.5px] text-dim">{event.participants.length}</span>
        <span className="ml-auto text-[12.5px] font-normal text-dim">
          {locked
            ? <>{going} going{noReply > 0 && <span className="text-faint"> · {noReply} no reply</span>}</>
            : <>{nAvail} available{nCant > 0 && <> · {nCant} can&rsquo;t make it</>}{nNone > 0 && <span className="text-faint"> · {nNone} no reply</span>}</>}
        </span>
      </div>
      <div className="flex flex-col">
        {sorted.map((p, i) => {
          const chip = locked
            ? { label: RSVP[p.rsvp].label, color: RSVP[p.rsvp].color, bg: `var(--${RSVP[p.rsvp].chip}-bg, var(--s2))` }
            : PLAN_GROUP[groupOf(p)]
          return (
            <div key={p.id} className={`flex items-center gap-2.5 py-2 ${i > 0 ? 'border-t border-border' : ''}`}>
              <button
                type="button" onClick={() => onViewAvailability(p.id)} title={`See when ${p.name} is free`}
                className="-mx-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] px-1 py-0.5 text-left hover:bg-s2"
              >
                <Avatar initials={p.initials} color={p.color} size={29} font={10.5} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.name}{p.you && <span className="font-normal text-faint"> (You)</span>}</span>
              </button>
              {p.host && <span className="flex-none rounded-md border border-accent-border bg-accent-bg px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-text">Host</span>}
              <span className="flex-none rounded-md px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: chip.color, background: chip.bg }}>{chip.label}</span>
              {isHost && !p.you && <ParticipantMenu p={p} event={event} onPatch={onPatch} />}
            </div>
          )
        })}
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
  const locked = event.status === 'confirmed' && !!event.confirmed
  // while planning there is no "maybe" yet; the host can vouch for someone as
  // available, mark them out, or reset them to no reply
  const options = (Object.keys(RSVP) as Rsvp[]).filter((r) => locked || r !== 'maybe')
  function markRsvp(r: Rsvp) {
    // resetting to no reply also takes back a declared "none of these days work"
    const clearUnavail = !locked && r !== 'not_going' && event.unavailableIds?.includes(p.id)
    onPatch({
      participants: event.participants.map((x) => (x.id === p.id ? { ...x, rsvp: r, rsvpAuto: undefined } : x)),
      ...(clearUnavail ? { unavailableIds: event.unavailableIds!.filter((id) => id !== p.id) } : {}),
    })
    close()
  }
  function remove() {
    onPatch(removeParticipantPatch(event, p.id))
    close()
  }
  // an email invitee has a link of their own: opening it lands them already named
  const [linkCopied, setLinkCopied] = useState(false)
  function copyPersonalLink() {
    const url = `${window.location.origin}/events/${event.id}/join?invite=${p.inviteToken}`
    navigator.clipboard?.writeText(url).then(() => { setLinkCopied(true); setTimeout(close, 900) }).catch(() => {})
  }
  return (
    <>
      <PopoverTitle sub={p.name}>{locked ? 'Reply' : 'Mark'} for</PopoverTitle>
      {p.guest && p.inviteToken && (
        <>
          <PopoverItem onClick={copyPersonalLink} icon={linkCopied ? <Check size={15} /> : <Link2 size={15} />}>
            {linkCopied ? 'Link copied' : 'Copy their personal link'}
          </PopoverItem>
          <PopoverSep />
        </>
      )}
      {options.map((r) => (
        <PopoverItem
          key={r}
          onClick={() => markRsvp(r)}
          icon={<span className="block h-1.5 w-1.5 rounded-full" style={{ background: RSVP[r].color }} />}
          trailing={p.rsvp === r ? <Check size={13} /> : undefined}
        >
          {rsvpLabel(r, locked)}
        </PopoverItem>
      ))}
      <PopoverSep />
      {confirmRemove ? (
        <div className="rounded-[9px] bg-brick-bg px-2.5 py-2">
          <p className="mb-2 text-[12.5px] leading-[1.45] text-brick-text">Remove {first}? This clears their replies too.</p>
          <div className="flex items-center gap-1.5">
            <button onClick={remove} className="h-7 flex-1 rounded-[7px] text-[12.5px] font-semibold text-white" style={{ background: 'var(--brick)' }}>
              Remove
            </button>
            <button onClick={() => setConfirmRemove(false)} className="h-7 flex-1 rounded-[7px] border border-brick-border bg-s1 text-[12.5px] font-semibold text-brick-text">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <PopoverItem onClick={() => setConfirmRemove(true)} tone="brick">Remove from event</PopoverItem>
      )}
    </>
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

/* When: the day and time as fact once they exist — locked in, or fixed at creation
   (which can happen while the place is still being voted). While the event is still
   planning, the host can move a fixed slot; once locked (case 4), the fact is read-only
   and "Reopen planning" is the way back. Before any time exists: the date range being
   polled with the leading time so far beneath it. */
function WhenValue({ event, editable, onGoToAvailability, onGoToBestWindow, onPatch }: {
  event: AppEvent; editable: boolean
  onGoToAvailability: () => void; onGoToBestWindow: () => void; onPatch: (patch: Partial<AppEvent>) => void
}) {
  const [editing, setEditing] = useState(false)
  if (event.confirmed) {
    const c = event.confirmed
    if (editing && editable) return <FixedWhenEditor event={event} onPatch={onPatch} onDone={() => setEditing(false)} />
    const d = event.days.find((x) => x.key === c.dayKey)
    const endD = c.endDayKey ? event.days.find((x) => x.key === c.endDayKey) : null
    const allDay = c.startMin === 0 && c.endMin === 24 * 60
    const year = (c.endDayKey ?? c.dayKey).slice(0, 4)
    const dayPart = `${d ? `${d.dow}, ${d.date}` : c.dayKey}${endD ? ` – ${endD.dow}, ${endD.date}` : ''}, ${year}`
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {allDay ? dayPart : `${dayPart} · ${fmtMinute(c.startMin)} – ${fmtMinute(c.endMin)}`}
        {!allDay && <TimezonePill tz={event.timezone} />}
        {editable && (
          <button onClick={() => setEditing(true)} title="Change the day or time" className="grid h-7 w-7 flex-none place-items-center rounded-[7px] text-faint hover:bg-s2 hover:text-dim">
            <Pencil size={13} />
          </button>
        )}
      </span>
    )
  }
  if (editing) return <WhenEditor event={event} onPatch={onPatch} onDone={() => setEditing(false)} />

  const oneDay = event.startDate === event.endDate
  const dow = oneDay ? event.days[0]?.dow : null
  const dayPoll = event.granularity === 'day'
  const best = dayPoll ? null : bestWindow(availIvOf(event), event.days, event.durationMin ?? 60, event.bestMode)
  const gridStart = gridStartMinOf(event)
  return (
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        {dow ? `${dow}, ` : ''}{dateRangeText(event)}
        {editable && (
          <button onClick={() => setEditing(true)} title="Change the dates or event length" className="grid h-7 w-7 flex-none place-items-center rounded-[7px] text-faint hover:bg-s2 hover:text-dim">
            <Pencil size={13} />
          </button>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-dim">
        {best ? (
          <>
            Best time so far
            <button onClick={onGoToBestWindow} title="See it on the Availability tab" className="font-medium text-accent-text hover:underline">
              {best.dayLabel} · {fmtMinute(gridStart + best.s)} – {fmtMinute(gridStart + best.e)}
            </button>
          </>
        ) : (
          <button onClick={onGoToAvailability} title={dayPoll ? 'Mark the days you can make on the Availability tab' : "Mark when you're free on the Availability tab"} className="font-medium text-accent-text hover:underline">
            {dayPoll ? 'Days to be decided' : 'Time to be decided'}
          </button>
        )}
        {!dayPoll && <TimezonePill tz={event.timezone} />}
      </span>
    </div>
  )
}

/* dates and event length are editable while planning. Replies are stored per day, so a
   dropped day keeps its data dormant and gets it back if the day returns to the range. */
const DURATIONS: [number, string][] = [
  [30, '30 minutes'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours'],
  [180, '3 hours'], [240, '4 hours'], [360, '6 hours'], [480, '8 hours'],
]
// which days the event currently skips, read back from its day list: a weekday with
// every occurrence missing reads as a turned-off weekday, other gaps as single days —
// so editing the dates never silently resurrects days the host turned off
function deriveExclusions(ev: AppEvent): { dows: number[]; days: string[] } {
  const have = new Set(ev.days.map((d) => d.key))
  const all = selectedDayKeys(ev.startDate, ev.endDate, [], [])
  const dowOf = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getDay() }
  const missing = all.filter((k) => !have.has(k))
  const byDow = (list: string[]) => list.reduce<Record<number, number>>((acc, k) => { const d = dowOf(k); acc[d] = (acc[d] ?? 0) + 1; return acc }, {})
  const total = byDow(all)
  const gone = byDow(missing)
  const dows = Object.keys(total).map(Number).filter((d) => total[d] > 0 && gone[d] === total[d])
  const dowSet = new Set(dows)
  return { dows, days: missing.filter((k) => !dowSet.has(dowOf(k))) }
}

function WhenEditor({ event, onPatch, onDone }: { event: AppEvent; onPatch: (patch: Partial<AppEvent>) => void; onDone: () => void }) {
  const [start, setStart] = useState(event.startDate)
  const [end, setEnd] = useState(event.endDate)
  const [dur, setDur] = useState(event.durationMin ?? 60)
  const [excluded, setExcluded] = useState(() => deriveExclusions(event))
  const durations = DURATIONS.some(([m]) => m === dur) ? DURATIONS : [...DURATIONS, [dur, `${dur} minutes`] as [number, string]]
  const inputCls = 'h-9 rounded-[9px] border border-border bg-s0 px-3 text-[13.5px] font-medium outline-none focus:border-border2'

  const endEff = end < start ? start : end
  const selKeys = selectedDayKeys(start, endEff, excluded.dows, excluded.days)
  const dayCap = maxPollDays(event.granularity)
  const selErr = selKeys.length === 0
    ? 'Every day is turned off. Turn at least one back on.'
    : selKeys.length > dayCap
      ? `That's ${selKeys.length} days to poll. Keep it to ${dayCap} or fewer by turning off the days that don't apply.`
      : ''

  function save() {
    if (selErr) return
    const days = excluded.dows.length || excluded.days.length ? buildDaysFrom(selKeys, dayCap) : buildDays(start, endEff, dayCap)
    // keep every existing day's replies (even out-of-range ones stay dormant); new days start empty
    const avail = { ...event.avail }
    for (const d of days) if (!avail[d.key]) avail[d.key] = event.times.map(() => [])
    // seed from the full store (dormant days too) — starting from an empty object here
    // would shadow legacy grid replies the moment availIv gets written
    const availIv = { ...fullAvailIvOf(event) }
    for (const d of days) if (!availIv[d.key]) availIv[d.key] = {}
    onPatch({ startDate: days[0].key, endDate: days[days.length - 1].key, days, avail, availIv, durationMin: dur })
    onDone()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date" value={start} className={inputCls}
          onChange={(ev) => { setStart(ev.target.value); if (end < ev.target.value) setEnd(ev.target.value) }}
        />
        <span className="text-[13px] text-dim">to</span>
        <input type="date" value={end} min={start} onChange={(ev) => setEnd(ev.target.value)} className={inputCls} />
      </div>
      <DaysPicker
        startDate={start}
        endDate={endEff}
        excludedDows={excluded.dows}
        excludedDays={excluded.days}
        onChange={(p) => setExcluded((x) => ({ dows: p.excludedDows ?? x.dows, days: p.excludedDays ?? x.days }))}
      />
      {selErr && <p className="text-[12.5px] font-medium text-brick-text">{selErr}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-dim">Needs about</span>
        <select value={dur} onChange={(ev) => setDur(Number(ev.target.value))} className={inputCls}>
          {durations.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
      </div>
      <p className="max-w-[420px] text-[12px] leading-[1.5] text-faint">
        Replies are saved per day. If you drop a day and bring it back later, the replies for it come back too.
      </p>
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={!!selErr} className="h-8 rounded-[8px] bg-accent px-3 text-[12.5px] font-semibold text-on-accent disabled:opacity-40">Save</button>
        <button onClick={onDone} className="h-8 rounded-[8px] border border-border2 bg-s1 px-3 text-[12.5px] font-semibold text-dim hover:bg-s2">Cancel</button>
      </div>
    </div>
  )
}

/* a fixed slot is still movable while the event plans (the place vote may be live).
   Moving it rebuilds the one-day grid around the new window and clears the
   can-you-come replies — they answered a slot that no longer exists. */
function FixedWhenEditor({ event, onPatch, onDone }: { event: AppEvent; onPatch: (patch: Partial<AppEvent>) => void; onDone: () => void }) {
  const c = event.confirmed!
  const [day, setDay] = useState(c.dayKey)
  const [startMin, setStartMin] = useState(c.startMin)
  const [endMin, setEndMin] = useState(c.endMin)
  const inputCls = 'h-9 rounded-[9px] border border-border bg-s0 px-3 text-[13.5px] font-medium outline-none focus:border-border2'
  const changed = day !== c.dayKey || startMin !== c.startMin || endMin !== c.endMin

  function changeStart(v: number) {
    setStartMin(v)
    setEndMin((e) => (e <= v ? Math.min(v + (c.endMin - c.startMin), 24 * 60 - 5) : e))
  }
  function save() {
    if (!changed) { onDone(); return }
    if (!day || endMin <= startMin) return
    const st = stepOf(event.granularity)
    const times = buildTimes(event.granularity, Math.floor(startMin / st) * st, Math.min(24 * 60, Math.ceil(endMin / st) * st))
    onPatch({
      confirmed: { ...c, dayKey: day, startMin, endMin },
      startDate: day,
      endDate: day,
      days: buildDays(day, day),
      times,
      durationMin: endMin - startMin,
      avail: { [day]: times.map(() => []) },
      availIv: { [day]: {} },
      unavailableIds: [],
    })
    onDone()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={day} onChange={(ev) => setDay(ev.target.value)} className={inputCls} />
        <TimeSelect value={startMin} onChange={changeStart} step={15} />
        <span className="text-[13px] text-dim">to</span>
        <TimeSelect value={endMin} onChange={setEndMin} min={startMin + 15} step={15} />
      </div>
      {changed && (
        <p className="max-w-[420px] text-[12px] leading-[1.5] text-faint">
          Moving the time clears everyone&apos;s can-you-come replies, so they answer for the new slot.
        </p>
      )}
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={!day || endMin <= startMin} className="h-8 rounded-[8px] bg-accent px-3 text-[12.5px] font-semibold text-on-accent disabled:opacity-40">Save</button>
        <button onClick={onDone} className="h-8 rounded-[8px] border border-border2 bg-s1 px-3 text-[12.5px] font-semibold text-dim hover:bg-s2">Cancel</button>
      </div>
    </div>
  )
}

/* an optional deadline date: the host sets or clears it, everyone else reads it as fact.
   Bounded to [today, max] — a deadline in the past or after the event decides nothing */
function DeadlineValue({ value, editable, onChange, hint, max }: {
  value?: string; editable: boolean; onChange: (v?: string) => void; hint: string; max?: string
}) {
  const d0 = new Date()
  const todayKey = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`
  // ISO day keys compare as strings, so the clamp is a pair of bounds checks
  const clamp = (v: string) => (v < todayKey ? todayKey : max && v > max ? max : v)
  if (!editable) return <span>{value ? dateRangeText({ startDate: value, endDate: value }) : 'Not set'}</span>
  return (
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={value ?? ''}
          min={todayKey}
          max={max}
          onChange={(e) => onChange(e.target.value ? clamp(e.target.value) : undefined)}
          className="h-9 cursor-pointer rounded-[9px] border border-border bg-s0 px-3 text-[13.5px] font-medium outline-none focus:border-border2"
        />
        {value && (
          <button onClick={() => onChange(undefined)} className="-my-2 py-2 text-[12.5px] font-semibold text-dim hover:text-brick-text hover:underline">
            Clear
          </button>
        )}
      </span>
      {value && <span className="text-[12px] text-faint">{hint}</span>}
    </div>
  )
}

/* Where: the confirmed venue once locked; before that, the vote leader for a single venue,
   or a pointer to the itinerary on the Location tab. */
/* Spots: the host caps the guest list; everyone sees the number, only the host edits it */
function CapacityValue({ event, editable, onPatch }: { event: AppEvent; editable: boolean; onPatch: (patch: Partial<AppEvent>) => void }) {
  const [v, setV] = useState(event.capacity?.toString() ?? '')
  const going = event.participants.filter((p) => p.rsvp === 'attending').length
  if (!editable) {
    if (event.capacity == null) return <span className="text-faint">No limit</span>
    return <span>{going} of {event.capacity} spots taken</span>
  }
  function change(raw: string) {
    const clean = raw.replace(/[^\d]/g, '').slice(0, 4)
    setV(clean)
    const n = Number(clean)
    onPatch({ capacity: clean && n >= 1 ? n : undefined })
  }
  return (
    <input
      value={v} onChange={(e) => change(e.target.value)} inputMode="numeric" placeholder="No limit"
      className="h-8 w-[110px] rounded-[8px] border border-border bg-s0 px-2.5 text-[13.5px] font-medium outline-none focus-within:border-border2"
    />
  )
}

function WhereValue({ event, locked, onGoToLocation, editable, onPatch }: {
  event: AppEvent; locked: boolean; onGoToLocation: () => void
  editable: boolean; onPatch: (patch: Partial<AppEvent>) => void
}) {
  const [copied, setCopied] = useState(false)
  const [editingOnline, setEditingOnline] = useState(false)
  const linkRef = useRef<HTMLInputElement>(null)
  const loc = event.location
  const link = loc.meetingLink.trim()
  const copyLink = () => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }
  const linkRow = (
    <span className="flex max-w-[420px] items-center gap-2">
      <span className="min-w-0 flex-1 truncate rounded-[7px] border border-border bg-s0 px-2.5 py-1 font-mono text-[12px] text-dim">{link}</span>
      <button onClick={copyLink} className={`flex h-7 flex-none items-center gap-1 rounded-[7px] border px-2 text-[12px] font-semibold ${copied ? 'border-teal-border bg-teal-bg text-teal-text' : 'border-border2 bg-s1 text-dim hover:bg-s2'}`}>
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
    </span>
  )

  if (loc.mode === 'remote') {
    return (
      <div className="flex flex-col gap-1.5">
        <span>Online · {loc.platform || 'platform to be decided'}</span>
        {link ? linkRow : event.hostedByYou ? (
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
  // a set of simultaneous venues (art walk, split-activity picnic), not a route
  const spotsLink = (n: number) => (
    <button onClick={onGoToLocation} className="text-left font-medium text-accent-text hover:underline">
      Happening across {n} spots · see them on the Location tab
    </button>
  )
  const placeLink = (name: string, caption?: string) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <button onClick={onGoToLocation} title="Open it on the Location tab" className="text-left font-medium text-accent-text hover:underline">{name}</button>
      {caption && <span className="text-dim">· {caption}</span>}
    </span>
  )

  // in person: work out the main line, then layer the optional online option under it
  let main: React.ReactNode = <>To be decided</>
  const stops = event.itinStops?.length ?? 0
  const lead = leadingPlaceOf(event)
  if (locked) {
    const ids = event.confirmed!.placeIds
    const names = ids
      .map((id) => loc.places.find((p) => p.id === id)?.name)
      .filter((n): n is string => !!n)
    // "itinerary" only when the locked places really are the built route, in order —
    // a multi-place votes lock is a set of simultaneous spots, not stops
    const itin = event.itinStops ?? []
    const itinLocked = loc.planMode === 'itinerary' && itin.length > 0 && ids.length === itin.length && ids.every((id, i) => id === itin[i])
    if (names.length === 1) main = placeLink(names[0])
    else if (names.length > 1) main = itinLocked ? itineraryLink(names.length) : spotsLink(names.length)
  } else if (loc.planMode === 'itinerary' && stops > 0) main = itineraryLink(stops)
  // a settled venue reads as fact (leadingPlaceOf reports it confirmed), never as a front-runner
  else if (lead) main = placeLink(lead.place.name, lead.confirmed ? undefined : 'leading the vote')
  else if (loc.places.length === 1) main = placeLink(loc.places[0].name)

  const hybridOn = !!loc.hybrid && !!link
  function saveOnline() {
    const v = (linkRef.current?.value ?? '').trim()
    onPatch({ location: { ...loc, hybrid: !!v, meetingLink: v || loc.meetingLink } })
    setEditingOnline(false)
  }
  return (
    <div className="flex flex-col gap-1.5">
      {main}
      {hybridOn && (
        <>
          <span className="flex items-center gap-1.5 text-[12.5px] text-dim">
            <Video size={13} /> Also joinable online
            {editable && (
              <button onClick={() => onPatch({ location: { ...loc, hybrid: false } })} className="font-semibold text-brick-text hover:underline">Remove</button>
            )}
          </span>
          {linkRow}
        </>
      )}
      {!hybridOn && editable && (
        editingOnline ? (
          <span className="flex flex-wrap items-center gap-2">
            <input
              ref={linkRef} defaultValue={link} autoFocus placeholder="Paste a meeting link"
              onKeyDown={(e) => { if (e.key === 'Enter') saveOnline() }}
              className="h-8 w-[240px] max-w-full rounded-[8px] border border-border bg-s0 px-2.5 font-mono text-[12.5px] outline-none focus:border-border2"
            />
            <button onClick={saveOnline} className="h-8 rounded-[8px] bg-accent px-2.5 text-[12.5px] font-semibold text-on-accent">Save</button>
            <button onClick={() => setEditingOnline(false)} className="h-8 rounded-[8px] border border-border2 bg-s1 px-2.5 text-[12.5px] font-semibold text-dim hover:bg-s2">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setEditingOnline(true)} className="text-left text-[12.5px] font-medium text-accent-text hover:underline">
            Add an online option for people who can&apos;t be there in person
          </button>
        )
      )}
    </div>
  )
}

/* Cover: pick a preset scene or upload a photo. Uploads are downscaled and recompressed
   before storing, so a phone photo doesn't blow the localStorage budget. */
function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const MAX = 1280
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * scale))
        c.height = Math.max(1, Math.round(img.height * scale))
        const ctx = c.getContext('2d')
        if (!ctx) throw new Error('no canvas')
        ctx.fillStyle = '#fff' // transparent PNGs land on paper, not black
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.82))
      } catch (e) { reject(e) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
    img.src = url
  })
}

function CoverPicker({ event, onPatch }: { event: AppEvent; onPatch: (patch: Partial<AppEvent>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState(false)
  // one-time-use controls start collapsed: the current cover plus a "Change" link,
  // swatches and upload only when asked for
  const [editing, setEditing] = useState(false)
  async function pickFile(f: File | undefined) {
    if (!f) return
    try {
      onPatch({ image: await downscaleImage(f) })
      setErr(false)
    } catch {
      setErr(true)
    }
  }
  if (!editing) {
    const preset = COVER_PRESETS.find((p) => event.image === `preset:${p.id}`)
    return (
      <div className="flex items-center gap-2.5">
        {event.image
          ? <Cover src={event.image} from={preset?.from ?? '#E4EDE7'} to={preset?.to ?? '#CFE0D5'} className="h-9 w-14 flex-none rounded-[8px] border border-border" />
          : <span className="text-[13px] leading-none text-dim">No cover</span>}
        <button onClick={() => setEditing(true)} className="text-[13px] font-semibold leading-none text-accent-text hover:underline">
          {event.image ? 'Change' : 'Add one'}
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {COVER_PRESETS.map((p) => {
          const on = event.image === `preset:${p.id}`
          return (
            <button
              key={p.id} type="button" title={p.name}
              onClick={() => onPatch({ image: on ? undefined : `preset:${p.id}` })}
              className="overflow-hidden rounded-[8px]"
              style={{ boxShadow: on ? '0 0 0 2px var(--accent)' : '0 0 0 1px var(--border)' }}
            >
              <Cover src={`preset:${p.id}`} from={p.from} to={p.to} className="h-9 w-14" />
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => fileRef.current?.click()} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-border2 bg-s1 px-2.5 text-[12.5px] font-semibold hover:bg-s2">
          <ImagePlus size={14} /> {event.image?.startsWith('data:') ? 'Replace photo' : 'Upload a photo'}
        </button>
        {event.image && (
          <button onClick={() => onPatch({ image: undefined })} className="h-8 rounded-[8px] px-2 text-[12.5px] font-semibold text-brick-text hover:bg-brick-bg">Remove</button>
        )}
        <button onClick={() => setEditing(false)} className="h-8 rounded-[8px] px-2 text-[12.5px] font-semibold text-dim hover:bg-s2">Done</button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {err && <span className="text-[12px] text-brick-text">That file did not work. Try a JPG or PNG.</span>}
    </div>
  )
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

/* ── Expenses: actual spend against the plan, split across whoever has replied ── */
function ExpensesCard({ event, isHost, onPatch }: { event: AppEvent; isHost: boolean; onPatch: (patch: Partial<AppEvent>) => void }) {
  const [label, setLabel] = useState('')
  const [amt, setAmt] = useState('')
  const [needLabel, setNeedLabel] = useState(false)
  const [paidBy, setPaidBy] = useState(() => event.participants.find((p) => p.you)?.id ?? event.participants[0]?.id ?? '')

  const expenses = event.expenses ?? []
  const spent = expenses.reduce((s, x) => s + x.amount, 0)
  // the card only shows after lock-in, so costs split between the people actually going
  const goingCount = event.participants.filter((p) => p.rsvp === 'attending').length
  const heads = Math.max(1, goingCount)
  const perPerson = event.budgetMode === 'person'
  const budgetAmount = Number(event.budget || 0)
  const budgetTotal = budgetAmount > 0 ? (perPerson ? budgetAmount * heads : budgetAmount) : null
  const over = budgetTotal != null && spent > budgetTotal
  const share = spent > 0 ? spent / heads : null
  const byId = new Map(event.participants.map((p) => [p.id, p]))

  // who paid what, so the split reads as balances instead of a matrix
  const paidTotals = new Map<string, number>()
  for (const x of expenses) paidTotals.set(x.paidBy, (paidTotals.get(x.paidBy) ?? 0) + x.amount)

  function addExpense() {
    const a = Math.round(Number(amt))
    if (!label.trim()) { setNeedLabel(true); return }
    if (!Number.isFinite(a) || a <= 0) return
    onPatch({ expenses: [...expenses, { id: `x${Date.now().toString(36)}-${expenses.length}`, label: label.trim(), amount: a, paidBy }] })
    setLabel('')
    setAmt('')
  }
  function removeExpense(id: string) {
    onPatch({ expenses: expenses.filter((x) => x.id !== id) })
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-s1 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[14.5px] font-semibold">
        <Receipt size={17} className="text-dim" /> Expenses
        {/* the caption speaks the budget's own language: per-person budgets compare per head */}
        <span className="ml-auto text-[12.5px] font-normal text-dim">
          {spent > 0
            ? budgetTotal != null
              ? perPerson
                ? <>${Math.round(share ?? 0).toLocaleString()} of ${budgetAmount.toLocaleString()} per person</>
                : <>spent ${spent.toLocaleString()} of ${budgetTotal.toLocaleString()}</>
              : <>spent ${spent.toLocaleString()} so far</>
            : 'nothing spent yet'}
        </span>
      </div>

      {budgetTotal != null && spent > 0 && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-s2">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (spent / budgetTotal) * 100)}%`, background: over ? 'var(--brick)' : 'var(--teal)' }} />
        </div>
      )}
      {over && (
        <div className="mb-4 flex items-start gap-2 rounded-[10px] border border-brick-border bg-brick-bg px-3 py-2 text-[13px] leading-[1.5] text-brick-text">
          <TriangleAlert size={14} className="mt-0.5 flex-none" /> That is ${(spent - budgetTotal!).toLocaleString()} over the budget.
        </div>
      )}

      {expenses.length === 0 ? (
        <p className="text-[13.5px] text-dim">
          {isHost ? 'Nothing logged yet. Add what gets spent and the split works itself out.' : 'Nothing logged yet.'}
        </p>
      ) : (
        <div className="flex flex-col">
          {expenses.map((x, i) => {
            const payer = byId.get(x.paidBy)
            return (
              <div key={x.id} className={`flex items-center gap-2.5 py-2 ${i > 0 ? 'border-t border-border' : ''}`}>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{x.label}</span>
                {payer && (
                  <span className="flex flex-none items-center gap-1.5 text-[12.5px] text-dim">
                    <Avatar initials={payer.initials} color={payer.color} size={20} font={8.5} /> {payer.name.split(' ')[0]}
                  </span>
                )}
                <span className="w-[72px] flex-none text-right text-[13.5px] font-semibold">${x.amount.toLocaleString()}</span>
                {isHost && (
                  <button onClick={() => removeExpense(x.id)} title="Remove this expense" className="grid h-7 w-7 flex-none place-items-center rounded-[7px] text-faint hover:bg-brick-bg hover:text-brick-text">
                    <X size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {share != null && (
        <div className="mt-3 border-t border-border pt-3 text-[12.5px] leading-[1.6] text-dim">
          <div>Split between the {heads} {heads === 1 ? 'person' : 'people'} going, that&apos;s <span className="font-semibold text-text">${Math.round(share).toLocaleString()} each</span>.</div>
          {[...paidTotals.entries()].map(([pid, total]) => {
            const payer = byId.get(pid)
            if (!payer) return null
            const net = Math.round(total - share)
            return (
              <div key={pid}>
                {payer.name.split(' ')[0]} paid ${total.toLocaleString()}{net > 0 ? <> and is reimbursed <span className="font-semibold text-teal-text">${net.toLocaleString()}</span></> : net < 0 ? <> and still owes ${(-net).toLocaleString()}</> : <>, exactly their share</>}.
              </div>
            )
          })}
        </div>
      )}

      {isHost && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <input
            value={label} onChange={(e) => { setLabel(e.target.value); setNeedLabel(false) }} placeholder="What was it for? (required)" maxLength={60}
            onKeyDown={(e) => { if (e.key === 'Enter') addExpense() }}
            className={`h-9 min-w-[140px] flex-1 rounded-[9px] border bg-s0 px-3 text-[13.5px] outline-none ${needLabel ? 'border-brick-border' : 'border-border focus:border-border2'}`}
          />
          <label className="flex h-9 w-[96px] flex-none items-center rounded-[9px] border border-border bg-s0 px-2.5 focus-within:border-border2">
            <span className="text-[13px] text-dim">$</span>
            <input
              value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              inputMode="numeric" placeholder="0"
              onKeyDown={(e) => { if (e.key === 'Enter') addExpense() }}
              className="w-full min-w-0 bg-transparent px-1 text-[13.5px] font-medium outline-none"
            />
          </label>
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="h-9 flex-none rounded-[9px] border border-border bg-s0 px-2.5 text-[13px] outline-none focus:border-border2">
            {event.participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={addExpense} className="flex h-9 flex-none items-center gap-1.5 rounded-[9px] bg-accent px-3.5 text-[13px] font-semibold text-on-accent">
            <Plus size={14} /> Add
          </button>
          {needLabel && <p className="w-full text-[12.5px] text-brick-text">Say what it was for before adding it.</p>}
        </div>
      )}
    </div>
  )
}

/* deleting is a once-ever action, so it starts as one quiet row — the full card
   with the explanation and confirm flow only unfolds when asked (or when a card's
   delete shortcut sends someone here with spotlight on) */
// two clicks total: "Delete this event…" opens the full warning, "Yes, delete it" ends it
/* the guest-side mirror of delete: one quiet expand, one plain sentence, no alarm —
   leaving is reversible (the invite link brings it back) and touches nobody else */
function LeaveZone({ title, onLeave, spotlight = false }: { title: string; onLeave: () => void; spotlight?: boolean }) {
  const [open, setOpen] = useState(spotlight)
  const zone = useRef<HTMLDivElement>(null)

  // arriving via a card's remove shortcut: bring the zone into view
  useGSAP(() => {
    if (spotlight && zone.current) zone.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  if (!open) {
    return (
      <div className="w-full">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[9px] px-2.5 py-2 text-[13px] font-medium text-dim hover:bg-s2 hover:text-brick-text">
          <UserRoundX size={15} /> Remove from my events…
        </button>
      </div>
    )
  }
  return (
    <div ref={zone} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-border bg-s1 p-4">
      <p className="min-w-0 flex-1 text-[13px] leading-[1.55] text-dim">
        This takes <span className="font-semibold text-text">{title}</span> off your lists. The host&apos;s plan isn&apos;t touched, and the invite link can bring you back.
      </p>
      <div className="flex flex-none items-center gap-2">
        <button onClick={onLeave} className="h-8 rounded-[8px] px-3 text-[13px] font-semibold text-white" style={{ background: 'var(--brick)' }}>
          Remove
        </button>
        <button onClick={() => setOpen(false)} className="h-8 rounded-[8px] border border-border2 bg-s1 px-3 text-[13px] font-semibold text-dim hover:bg-s2">
          Keep it
        </button>
      </div>
    </div>
  )
}

function DangerZone({ title, onDelete, spotlight = false }: { title: string; onDelete: () => void; spotlight?: boolean }) {
  const [open, setOpen] = useState(spotlight)
  const box = useRef<HTMLDivElement>(null)
  const zone = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (open && box.current) gsap.fromTo(box.current, { y: -6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' })
  }, { dependencies: [open] })

  // arriving via a card's delete shortcut: bring the zone into view and pulse its edge once
  useGSAP(() => {
    if (!spotlight || !zone.current) return
    zone.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    gsap.fromTo(
      zone.current,
      { boxShadow: '0 0 0 3px var(--brick-border)' },
      { boxShadow: '0 0 0 0 rgba(0,0,0,0)', duration: 1.4, ease: 'power2.out', delay: 0.4, clearProps: 'boxShadow' },
    )
  }, [])

  if (!open) {
    return (
      <div className="w-full">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-[9px] px-2.5 py-2 text-[13px] font-medium text-brick-text hover:bg-brick-bg">
          <Trash2 size={15} /> Delete this event…
        </button>
      </div>
    )
  }
  return (
    <div ref={zone} className="relative w-full rounded-2xl border border-border bg-s1 p-5">
      <button
        onClick={() => setOpen(false)}
        aria-label="Close" title="Keep the event"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-[7px] text-faint hover:bg-s2 hover:text-dim"
      >
        <X size={15} />
      </button>
      <div ref={box} className="rounded-[11px] border border-brick-border bg-brick-bg p-4">
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
              <button onClick={() => setOpen(false)} className="flex h-9 items-center rounded-[9px] border border-border2 bg-s1 px-3.5 text-[13.5px] font-semibold hover:bg-s2">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
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

