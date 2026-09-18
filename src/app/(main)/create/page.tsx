'use client'

import { use, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { pushFlash } from '@/components/ui/FlashToast'
import { CoverEditor, type ImageFit } from '@/components/ui/CoverEditor'
import Link from 'next/link'
import {
  Check, ChevronDown, ChevronUp, Search, Plus, X, MapPin, Video, Clock,
  Info, Vote, ArrowRight, Mail, CalendarRange, Route, GripVertical,
  Loader2, Link2, Copy, UserPlus, Users, PartyPopper, AlignLeft, Wallet, ImagePlus,
  Map, Presentation, Repeat, Utensils, Dices, CookingPot, type LucideIcon,
} from 'lucide-react'
import { personColors, type PersonColor } from '@/lib/colors'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { createEvent, draftFromEvent, getEvent, initialsOf, isOwnEmail, nowIn, maxPollDays, parseHM, fmtMinute, selectedDayKeys, type AppEvent, type AccountInvitee } from '@/lib/events'
import { lookupProfileByEmail, recentInvitees, type Invitee } from '@/lib/invitees'
import { centroidOf, searchPlaces } from '@/lib/geo'
import { canEmail, sendInvites } from '@/lib/mail'
import { InviteByEmail } from '@/components/InviteByEmail'
import { useAccount } from '@/hooks/useAccount'
import { OverflowText } from '@/components/ui/OverflowText'
import { DaysPicker } from '@/components/ui/DaysPicker'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { usePointerReorder } from '@/hooks/usePointerReorder'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

const TZ = [
  { v: 'America/Los_Angeles', l: 'Pacific Time (PT)' },
  { v: 'America/Denver', l: 'Mountain Time (MT)' },
  { v: 'America/Chicago', l: 'Central Time (CT)' },
  { v: 'America/New_York', l: 'Eastern Time (ET)' },
  { v: 'Europe/London', l: 'London (GMT/BST)' },
  { v: 'UTC', l: 'UTC' },
]
type Loc = { id: string; name: string; place: string; lat?: number; lng?: number }
type Stop = Loc & { uid: string }
type LocMode = 'vote' | 'remote' | 'later'
type PlanMode = 'vote' | 'itinerary'
type WinPreset = 'any' | 'morning' | 'afternoon' | 'evening' | 'custom'

// daily time-window presets — 'any' means the grid covers the whole day
const WIN_PRESETS: { v: WinPreset; l: string; s: string; e: string }[] = [
  { v: 'any', l: 'All day', s: '', e: '' },
  { v: 'morning', l: 'Mornings', s: '08:00', e: '12:00' },
  { v: 'afternoon', l: 'Afternoons', s: '12:00', e: '17:00' },
  { v: 'evening', l: 'Evenings', s: '17:00', e: '21:00' },
  { v: 'custom', l: 'Custom', s: '10:00', e: '14:00' },
]

// event-length presets, shown the same way as in the availability settings
const DUR_PRESETS = [30, 60, 90, 120, 180, 240]
const fmtDur = (m: number) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`)
// length of the daily time window in minutes — the whole day when no window is set;
// the event can't run longer than the window people are asked about
function winLenOf(preset: WinPreset, s: string, e: string): number {
  if (preset === 'any') return 24 * 60
  const ws = parseHM(s), we = parseHM(e)
  return ws !== null && we !== null && we > ws ? we - ws : 24 * 60
}

type Form = {
  title: string
  description: string
  scheduleMode: 'find' | 'set' // find a time together, or the date is already set
  fixedDay: string
  fixedStart: string
  fixedEnd: string
  rsvpBy: string // optional RSVP deadline — set-date events open the RSVP round at birth
  startDate: string
  endDate: string
  excludedDows: number[]  // weekdays turned off across the whole range (0=Sun … 6=Sat)
  excludedDays: string[]  // single dates turned off inside the range
  granularity: string
  windowPreset: WinPreset
  windowStart: string
  windowEnd: string
  durationMin: number
  timezone: string
  budget: string
  budgetMode: 'total' | 'person'
  capacity: string
  locMode: LocMode
  planMode: PlanMode
  locSettled: boolean // the place is chosen, not up for a vote
  picked: Stop[]
  platform: string
  meetingLink: string
  emails: string[]
  accounts: AccountInvitee[]
  image?: string
  imageFit?: ImageFit
}

const initialForm: Form = {
  title: '', description: '',
  scheduleMode: 'find', fixedDay: '', fixedStart: '18:00', fixedEnd: '21:00', rsvpBy: '',
  startDate: '', endDate: '', excludedDows: [], excludedDays: [], granularity: '30', windowPreset: 'any', windowStart: '', windowEnd: '', durationMin: 60,
  timezone: '', budget: '', budgetMode: 'total', capacity: '', // timezone deliberately unset: picking it is a required, conscious step
  locMode: 'vote', planMode: 'vote', locSettled: false, picked: [], platform: 'Google Meet', meetingLink: '',
  emails: [], accounts: [],
}

type Update = (patch: Partial<Form> | ((f: Form) => Partial<Form>)) => void
type BasicsErrs = { title: string; start: string; end: string; days: string; win: string; tz: string; fixed: string }

// template starting points (/create?template=…) — structure only; dates stay a conscious choice
const TEMPLATE_PRESETS: Record<string, Partial<Form>> = {
  offsite: { title: 'Team offsite', description: 'A few days of strategy and team time.', granularity: '60', locMode: 'vote', planMode: 'itinerary', budgetMode: 'person' },
  trip: { title: 'Weekend trip', description: 'Pick the dates together and vote on where to go.', granularity: 'day', locMode: 'vote', planMode: 'itinerary' },
  birthday: { title: 'Birthday party', description: 'One night, one spot.', granularity: '30', windowPreset: 'evening', windowStart: '17:00', windowEnd: '21:00', durationMin: 180, locMode: 'vote', planMode: 'vote' },
  conference: { title: 'Conference', granularity: '60', locMode: 'vote', planMode: 'itinerary' },
  'one-on-one': { title: 'Weekly 1:1', granularity: '15', durationMin: 30, locMode: 'remote' },
  dinner: { title: 'Dinner and drinks', granularity: '30', windowPreset: 'evening', windowStart: '17:00', windowEnd: '21:00', durationMin: 120, locMode: 'vote', planMode: 'vote' },
  'game-night': { title: 'Game night', description: 'Bring a game or just show up.', granularity: '30', windowPreset: 'evening', windowStart: '17:00', windowEnd: '21:00', durationMin: 180, locMode: 'vote', planMode: 'vote' },
  potluck: { title: 'Potluck', description: 'Everyone brings a dish.', granularity: '30', durationMin: 180, locMode: 'vote', planMode: 'vote' },
}

// the same presets, as tappable chips on the wizard's first step
// same order and identity hues as the templates page — keep the two in step
const WIZ_TEMPLATES: { key: string; label: string; icon: LucideIcon; chip: PersonColor }[] = [
  { key: 'dinner', label: 'Dinner', icon: Utensils, chip: 'coral' },
  { key: 'game-night', label: 'Game night', icon: Dices, chip: 'purple' },
  { key: 'birthday', label: 'Birthday', icon: PartyPopper, chip: 'pink' },
  { key: 'potluck', label: 'Potluck', icon: CookingPot, chip: 'amber' },
  { key: 'trip', label: 'Weekend trip', icon: Map, chip: 'green' },
  { key: 'offsite', label: 'Team offsite', icon: Route, chip: 'blue' },
  { key: 'one-on-one', label: '1:1', icon: Repeat, chip: 'teal' },
  { key: 'conference', label: 'Conference', icon: Presentation, chip: 'gray' },
]

export default function CreatePage({ searchParams }: { searchParams: Promise<{ template?: string; from?: string; created?: string }> }) {
  const { template, from, created: createdParam } = use(searchParams)
  const router = useRouter()
  const account = useAccount()
  const [created, setCreated] = useState<AppEvent | null>(null)
  // a ?created= link resolves after mount; until then nothing is drawn, so the empty
  // wizard never flashes before the event's own screen
  const [resolving, setResolving] = useState(!!createdParam)
  const [tpl, setTpl] = useState<string | null>(template && TEMPLATE_PRESETS[template] ? template : null)
  const [form, setForm] = useState<Form>(() => ({ ...initialForm, ...(template ? TEMPLATE_PRESETS[template] : undefined) }))
  const [attempted, setAttempted] = useState(false)
  const [today, setToday] = useState('')
  const stopUid = useRef(0)
  const panel = useRef<HTMLDivElement>(null)

  const update: Update = (patch) =>
    setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }))

  // quick create routes here (/create?created=…) so every new event ends on the same
  // "your event is live" page with the share link (localStorage read, so after mount)
  useEffect(() => {
    if (!createdParam) return
    const ev = getEvent(createdParam)
    if (ev) setCreated(ev)
    setResolving(false)
  }, [createdParam])

  // duplicate an event (/create?from=…): everything seeds the form, with the dates
  // moved to the next week that fits (see draftFromEvent); responses start fresh
  // (localStorage read, so it has to happen after mount)
  useEffect(() => {
    if (!from) return
    const d = draftFromEvent(from)
    if (!d) return
    // the daily window comes back as the preset it matches, or as Custom
    const winPreset: WinPreset = !d.windowStart || !d.windowEnd ? 'any' : (WIN_PRESETS.find((p) => p.v !== 'custom' && p.s === d.windowStart && p.e === d.windowEnd)?.v ?? 'custom')
    setForm((f) => ({
      ...f,
      title: d.title ?? f.title,
      description: d.description ?? f.description,
      timezone: d.timezone ?? f.timezone,
      granularity: d.granularity ?? f.granularity,
      durationMin: d.durationMin ?? f.durationMin,
      budget: d.budget ?? f.budget,
      budgetMode: d.budgetMode ?? f.budgetMode,
      capacity: d.capacity ?? f.capacity,
      image: d.image,
      imageFit: d.imageFit,
      startDate: d.startDate ?? f.startDate,
      endDate: d.endDate ?? f.endDate,
      excludedDows: d.excludedDows ?? f.excludedDows,
      windowPreset: winPreset,
      windowStart: d.windowStart ?? '',
      windowEnd: d.windowEnd ?? '',
      ...(d.fixed ? { scheduleMode: 'set' as const, fixedDay: d.fixed.day, fixedStart: d.fixed.start, fixedEnd: d.fixed.end } : {}),
      // 'set' comes back as the In person mode with the chosen-place flag on
      locMode: d.locMode ? (d.locMode === 'set' ? 'vote' : d.locMode) : f.locMode,
      locSettled: d.locMode ? d.locMode === 'set' : f.locSettled,
      planMode: d.planMode ?? f.planMode,
      picked: (d.picked ?? []).map((p) => ({ ...p, uid: `s${stopUid.current++}` })),
      platform: d.platform ?? f.platform,
      meetingLink: d.meetingLink ?? f.meetingLink,
      emails: d.emails ?? f.emails,
      accounts: d.accounts ?? f.accounts,
    }))
  }, [from])

  // today, the visitor's own zone, and the coming week as the starting window — all
  // detected after mount, so creating only asks for what a machine can't guess
  useEffect(() => {
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    const d = new Date()
    const week = new Date(d)
    week.setDate(week.getDate() + 6)
    const t = iso(d)
    setToday(t)
    let local = ''
    try { local = TZ.find((x) => x.v === Intl.DateTimeFormat().resolvedOptions().timeZone)?.v ?? '' } catch { /* the field still asks */ }
    setForm((f) => ({
      ...f,
      timezone: f.timezone || local,
      startDate: f.startDate || t,
      endDate: f.endDate || iso(week),
      fixedDay: f.fixedDay || t,
    }))
  }, [])

  useGSAP(() => { gsap.fromTo(panel.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }) }, [])

  if (created) return <Created event={created} />
  if (resolving) return <div className="mx-auto max-w-[560px] px-[26px] pt-[72px]"><div className="mx-auto h-8 w-56 animate-pulse rounded-lg bg-s2" /></div>

  // ── required-field validation ──
  // "now" is read in the zone the event runs in, not the browser's: a day that has
  // already ended there, or a time that has already passed there, cannot be planned
  const clock = today ? nowIn(form.timezone || undefined) : null
  const zToday = clock?.dayKey ?? today
  const zoneName = TZ.find((x) => x.v === form.timezone)?.l.replace(/ \(.*\)$/, '') ?? 'that time zone'
  const finding = form.scheduleMode === 'find' // the window fields only matter when a time is being found
  const startErr = !finding ? '' : !form.startDate ? 'Pick the earliest day.' : zToday && form.startDate < zToday ? `The earliest day has already passed in ${zoneName}.` : ''
  const endErr = !finding ? '' : !form.endDate ? 'Pick the latest day.' : form.startDate && form.endDate < form.startDate ? 'The latest day can’t be before the earliest day.' : zToday && form.endDate < zToday ? `The latest day has already passed in ${zoneName}.` : ''
  // the days actually being polled: the range minus turned-off weekdays and dates.
  // The grid holds 21 days, so long ranges pass by turning days off, not by truncation.
  const selKeys = finding && !startErr && !endErr && form.startDate && form.endDate
    ? selectedDayKeys(form.startDate, form.endDate, form.excludedDows, form.excludedDays)
    : null
  const basicsErr: BasicsErrs = {
    title: form.title.trim() ? '' : 'Add an event title.',
    start: startErr,
    end: endErr,
    days: !selKeys
      ? ''
      : selKeys.length === 0
        ? 'Every day is turned off. Turn at least one back on.'
        : selKeys.length > maxPollDays(form.granularity, form.startDate)
          ? `That's ${selKeys.length} days to poll. Keep it to ${maxPollDays(form.granularity, form.startDate)} or fewer by turning off the days that don't apply${form.granularity === 'day' ? '' : ', or switch to whole days'}. A range that starts on the 1st of a month may run to the end of ${form.granularity === 'day' ? 'the third month' : 'that month'}.`
          : '',
    win:
      finding && form.granularity !== 'day' && form.windowPreset === 'custom' && (parseHM(form.windowStart) === null || parseHM(form.windowEnd) === null)
        ? 'Pick both times for the custom window.'
        : finding && form.granularity !== 'day' && form.windowPreset === 'custom' && (parseHM(form.windowEnd) ?? 0) <= (parseHM(form.windowStart) ?? 0)
          ? 'The window has to end after it starts.'
          // a one-day poll for today whose window is already over has nothing left to ask
          : finding && form.granularity !== 'day' && clock && form.startDate === zToday && form.endDate === zToday && (parseHM(form.windowEnd) ?? 1440) <= clock.minute
            ? `That window has already passed today in ${zoneName}.`
            : '',
    tz: form.timezone ? '' : 'Pick the time zone this event runs in.',
    fixed: finding
      ? ''
      : !form.fixedDay
        ? 'Pick the day.'
        : zToday && form.fixedDay < zToday
          ? `That day has already passed in ${zoneName}.`
          : parseHM(form.fixedStart) === null || parseHM(form.fixedEnd) === null
            ? 'Pick both times.'
            : (parseHM(form.fixedEnd) as number) <= (parseHM(form.fixedStart) as number)
              ? 'It has to end after it starts.'
              : clock && form.fixedDay === zToday && (parseHM(form.fixedStart) as number) <= clock.minute
                ? `${fmtMinute(parseHM(form.fixedStart) as number)} has already passed today in ${zoneName}.`
                : '',
  }
  const basicsOk = !basicsErr.title && !basicsErr.start && !basicsErr.end && !basicsErr.days && !basicsErr.win && !basicsErr.tz && !basicsErr.fixed
  // the first thing still missing, in the order the form asks for it
  const firstMissing = [basicsErr.title, basicsErr.fixed, basicsErr.start, basicsErr.end, basicsErr.days, basicsErr.win, basicsErr.tz].find(Boolean) ?? ''

  // tap a template to seed the form; tap it again to start blank. The detected
  // defaults (dates, zone) survive the reset.
  function applyTemplate(key: string) {
    setForm((f) => ({
      ...initialForm,
      timezone: f.timezone, startDate: f.startDate, endDate: f.endDate, fixedDay: f.fixedDay,
      ...(tpl === key ? {} : TEMPLATE_PRESETS[key]),
    }))
    setTpl(tpl === key ? null : key)
  }

  function create() {
    if (!basicsOk) {
      setAttempted(true)
      panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const ev = createEvent({
      ...form,
      // the form tracks "already chosen" as a flag under In person; the event model
      // speaks one enum, where a chosen place is its own mode
      locMode: form.locMode === 'vote' && form.locSettled ? 'set' : form.locMode,
      fixed: form.scheduleMode === 'set' ? { day: form.fixedDay, start: form.fixedStart, end: form.fixedEnd } : undefined,
      // only a deadline that still makes sense travels: between today and the event day
      rsvpDeadline: form.scheduleMode === 'set' && form.rsvpBy && (!today || form.rsvpBy >= today) && form.rsvpBy <= form.fixedDay
        ? form.rsvpBy
        : undefined,
      // only pass an explicit day list when days were actually turned off
      pickedDays: finding && (form.excludedDows.length || form.excludedDays.length) ? selKeys ?? undefined : undefined,
    })
    // straight to the event: no screen in between. The email invitees get their
    // personal links in the background, the way the Created screen used to send them;
    // that screen still exists for a ?created= link.
    const emailed = ev.participants.filter((p) => p.guest && p.email).length
    const sending = emailed > 0 && canEmail(account.signedIn)
    if (sending) void sendInvites(ev.id)
    pushFlash(sending ? `Your event is live. Emailing ${emailed} ${emailed === 1 ? 'invite' : 'invites'}.` : 'Your event is live. Share the link so people can join.')
    router.push(`/events/${ev.id}`)
  }

  // one-line summaries so each closed drawer still says where it stands
  const inviteTotal = form.emails.length + form.accounts.length
  const placeSummary = form.locMode === 'remote'
    ? `Online on ${form.platform}`
    : form.locMode === 'later'
      ? 'Decide later'
      : form.locSettled
        ? form.picked[0]?.name ?? 'Pick the place'
        : form.planMode === 'itinerary'
          ? form.picked.length ? `${form.picked.length} ${form.picked.length === 1 ? 'stop' : 'stops'} planned` : 'Plan a route'
          : form.picked.length ? `${form.picked.length} on the ballot` : 'Guests vote'
  const peopleSummary = inviteTotal
    ? `${inviteTotal} ${inviteTotal === 1 ? 'person' : 'people'} added`
    : 'Invite now, or just share the link after'
  const moneySummary = [
    form.budget ? `$${Number(form.budget).toLocaleString()} ${form.budgetMode === 'person' ? 'per person' : 'total'}` : '',
    form.capacity ? `${form.capacity} spots` : '',
  ].filter(Boolean).join(', ') || 'No budget, no spot limit'

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-6 sm:px-[26px] sm:pt-[34px]">
      <div className="mb-4 text-center sm:mb-[22px]">
        <h1 className="font-serif sm:font-normal text-[27px] leading-[1.04] tracking-[-0.01em] sm:text-[33.5px]">Create event</h1>
        <p className="mt-1.5 hidden text-[13.5px] text-dim sm:block">Name it, check the days, create. Everything else can wait.</p>
      </div>

      {/* start from a template — one tap seeds the form, tap again to go blank */}
      <div className="mb-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Start from a template</div>
        <div className="flex flex-wrap gap-1.5">
          {WIZ_TEMPLATES.map((t) => {
            const Icon = t.icon
            const on = tpl === t.key
            const c = personColors[t.chip]
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => applyTemplate(t.key)}
                aria-pressed={on}
                // each chip wears its template's identity hue from the templates page;
                // the picked one steps forward with the accent ring
                className={`flex h-11 flex-none items-center gap-1.5 rounded-[9px] border px-3.5 text-[13px] font-medium transition-shadow sm:h-8 sm:px-3 ${on ? 'border-accent ring-1 ring-accent' : 'border-transparent hover:brightness-[.97]'}`}
                style={{ background: c.bg, color: c.text }}
              >
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div ref={panel} className="rounded-2xl border border-border bg-s1 px-4 py-[22px] sm:px-6">
        <StepBasics form={form} update={update} today={zToday} attempted={attempted} errs={basicsErr} />

        {/* everything optional lives in drawers — open what you need, skip the rest */}
        <div className="mt-5 border-t border-border pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">More options, all editable on the event page too</div>
          <Collapse icon={AlignLeft} title="Description" summary={form.description || 'What is it about?'}>
            <textarea
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="What's this event about?"
              className={`${inputCls(false)} h-[72px] resize-none py-[11px] leading-[1.5]`}
            />
          </Collapse>
          <Collapse icon={ImagePlus} title="Cover" summary={form.image?.startsWith('data:') ? `Your photo, ${form.imageFit === 'fit' ? 'fitted' : 'filling the frame'}` : form.image ? 'A scene' : 'A scene or a photo of your own'}>
            <CoverEditor image={form.image} fit={form.imageFit} title={form.title} onChange={(p) => update(p)} />
          </Collapse>
          <Collapse icon={MapPin} title="Place" summary={placeSummary}>
            <StepLocation form={form} update={update} stopUid={stopUid} />
          </Collapse>
          <Collapse icon={Users} title="People" summary={peopleSummary}>
            <StepInvite form={form} update={update} />
          </Collapse>
          <Collapse icon={Wallet} title="Budget and spots" summary={moneySummary}>
            <div className="flex flex-wrap gap-3.5">
              <div className="min-w-[200px] flex-1">
                <Label>Budget</Label>
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-dim">$</span>
                    <input inputMode="numeric" placeholder="0" value={form.budget} onChange={(e) => update({ budget: e.target.value.replace(/[^\d]/g, '') })} className={`${inputCls(false)} pl-7`} />
                  </div>
                  <Segmented value={form.budgetMode} onChange={(v) => update({ budgetMode: v as 'total' | 'person' })} options={[{ v: 'total', l: 'Total' }, { v: 'person', l: 'Per person' }]} />
                </div>
              </div>
              <div className="min-w-[140px] flex-1">
                <Label>Spots</Label>
                <input
                  inputMode="numeric" placeholder="No limit" value={form.capacity}
                  onChange={(e) => update({ capacity: e.target.value.replace(/[^\d]/g, '').slice(0, 4) })}
                  className={`${inputCls(false)} !w-[110px]`}
                />
              </div>
            </div>
          </Collapse>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link href="/home" className="flex h-11 sm:h-10 items-center rounded-[10px] border border-border2 bg-transparent px-4 text-[14px] font-semibold hover:bg-s2">
          Cancel
        </Link>
        {/* faded until every field is right; a tap on the faded button lights up the
            fields that still need something, since a disabled button says nothing */}
        <span onClick={() => { if (!basicsOk) setAttempted(true) }} className={basicsOk ? '' : 'cursor-not-allowed'}>
          <button onClick={create} disabled={!basicsOk} title={basicsOk ? undefined : firstMissing} className="flex h-11 sm:h-10 items-center gap-1.5 rounded-[10px] bg-accent px-[18px] text-[14px] font-semibold text-on-accent disabled:pointer-events-none disabled:opacity-40">
            <Check size={17} /> Create event
          </button>
        </span>
      </div>
      {!basicsOk && (
        <p className={`mt-2 text-right text-[12.5px] ${attempted ? 'text-brick-text' : 'text-dim'}`}>{attempted ? 'Fix the highlighted fields above first.' : firstMissing}</p>
      )}
    </div>
  )
}

/* a closed drawer shows its one-line state; open, it is the full section */
function Collapse({ icon: Icon, title, summary, children }: {
  icon: LucideIcon; title: string; summary?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border last:border-b-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2.5 py-3.5 text-left">
        <Icon size={16} className="flex-none text-dim" />
        <span className="flex-none text-[14px] font-semibold">{title}</span>
        <span className={`min-w-0 flex-1 truncate text-right text-[12.5px] text-dim ${open ? 'invisible' : ''}`}>{summary}</span>
        <ChevronDown size={16} className={`flex-none text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  )
}

/* ── Step 1: Basics ── */
function StepBasics({ form, update, today, attempted, errs }: { form: Form; update: Update; today: string; attempted: boolean; errs: BasicsErrs }) {
  // events are hosted by whoever is logged in, so the field only shows the name
  const hostName = useAccount().name
  function onStart(v: string) {
    const clamped = today && v && v < today ? today : v
    update((f) => ({ startDate: clamped, endDate: f.endDate && clamped && f.endDate < clamped ? clamped : f.endDate }))
  }
  function onEnd(v: string) {
    const floor = form.startDate || today
    update({ endDate: floor && v && v < floor ? floor : v })
  }
  function pickWin(v: string) {
    const p = WIN_PRESETS.find((x) => x.v === v)!
    update((f) => {
      // returning to Custom keeps whatever times were already picked
      const ws = p.v === 'custom' && f.windowStart ? f.windowStart : p.s
      const we = p.v === 'custom' && f.windowEnd ? f.windowEnd : p.e
      return {
        windowPreset: p.v,
        windowStart: ws,
        windowEnd: we,
        durationMin: Math.min(f.durationMin, winLenOf(p.v, ws, we)), // keep the length inside the window
      }
    })
  }
  const show = (e: string) => attempted && !!e
  const [tune, setTune] = useState(false)
  const openTune = tune || (attempted && !!errs.win) // never hide a field that has an error
  const winS = parseHM(form.windowStart), winE = parseHM(form.windowEnd)
  const winText = form.windowPreset !== 'any' && winS !== null && winE !== null && winE > winS
    ? `${fmtMinute(winS)} and ${fmtMinute(winE)}`
    : ''
  // event length is bounded by the daily window: 1 minute up to the whole window
  const winLen = winLenOf(form.windowPreset, form.windowStart, form.windowEnd)
  const durH = Math.floor(form.durationMin / 60)
  const durM = form.durationMin % 60
  function setDur(h: number, m: number) {
    update({ durationMin: Math.min(winLen, Math.max(1, h * 60 + m)) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Event title <Req /></Label>
        <input value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. Team Meeting" className={inputCls(show(errs.title))} />
        {show(errs.title) && <FieldError>{errs.title}</FieldError>}
      </div>

      {/* events are hosted by the signed-in account — nothing to choose, the name is locked */}
      <div>
        <Label>Hosted by</Label>
        <input value={hostName} readOnly disabled className={`${inputCls(false)} max-w-[320px] cursor-not-allowed opacity-60`} />
      </div>

      <div>
        <Label>When does it happen? <Req /></Label>
        <SegmentedControl
          stretch
          className="mb-2.5 w-full"
          value={form.scheduleMode}
          onChange={(v) => update({ scheduleMode: v as 'find' | 'set' })}
          options={[{ v: 'find', l: 'Find a time together', icon: CalendarRange }, { v: 'set', l: 'The date is set', icon: Check }]}
        />
        {form.scheduleMode === 'set' ? (
          <div className="rounded-[12px] border border-border bg-s2 p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 sm:min-w-[150px]">
                <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.1em] text-faint"><CalendarRange size={13} /> Day</span>
                <input type="date" value={form.fixedDay} min={today || undefined} onChange={(e) => update({ fixedDay: e.target.value })} className={`${inputCls(show(errs.fixed) && !form.fixedDay)} cursor-pointer !bg-s1`} />
              </div>
              <div className="flex flex-none flex-wrap items-center gap-2.5 pb-px">
                <span className="text-[12.5px] text-dim">from</span>
                <TimeField value={form.fixedStart} onChange={(v) => update({ fixedStart: v })} err={show(errs.fixed) && !!form.fixedDay} label="Start time" />
                <span className="text-[12.5px] text-dim">to</span>
                <TimeField value={form.fixedEnd} onChange={(v) => update({ fixedEnd: v })} err={show(errs.fixed) && !!form.fixedDay} label="End time" />
              </div>
            </div>
            {show(errs.fixed) && <FieldError>{errs.fixed}</FieldError>}
            <div className="mt-3">
              <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.1em] text-faint">
                <Check size={13} /> RSVP by <span className="normal-case tracking-normal">(Optional)</span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={form.rsvpBy}
                  min={today || undefined}
                  max={form.fixedDay || undefined}
                  onChange={(e) => update({ rsvpBy: e.target.value })}
                  className={`${inputCls(false)} max-w-[220px] cursor-pointer !bg-s1`}
                />
                {form.rsvpBy && (
                  <button type="button" onClick={() => update({ rsvpBy: '' })} className="flex-none text-[12.5px] font-semibold text-dim hover:text-brick-text hover:underline">
                    Clear
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2.5 border-t border-border pt-2.5 text-[12.5px] leading-[1.5] text-faint">
              The plan starts out locked in. Invites skip the scheduling and go straight to yes or no{form.rsvpBy ? ', with a reminder before the RSVP date' : ''}.
            </p>
          </div>
        ) : (
        <div className="rounded-[12px] border border-border bg-s2 p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:min-w-[150px]">
              <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.1em] text-faint"><CalendarRange size={13} /> Earliest day</span>
              <input type="date" value={form.startDate} min={today || undefined} onChange={(e) => onStart(e.target.value)} className={`${inputCls(show(errs.start))} cursor-pointer !bg-s1`} />
            </div>
            <span className="hidden pb-[11px] text-faint sm:block">→</span>
            <div className="min-w-0 flex-1 sm:min-w-[150px]">
              <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.1em] text-faint"><CalendarRange size={13} /> Latest day</span>
              <input type="date" value={form.endDate} min={form.startDate || today || undefined} onChange={(e) => onEnd(e.target.value)} className={`${inputCls(show(errs.end))} cursor-pointer !bg-s1`} />
            </div>
          </div>
          {(show(errs.start) || show(errs.end)) && <FieldError>{errs.start || errs.end}</FieldError>}

          {/* which days inside the range are really being polled — weekends only,
              or single days turned off. Long ranges fit by turning days off. */}
          <DaysPicker
            startDate={form.startDate}
            endDate={form.endDate}
            excludedDows={form.excludedDows}
            excludedDays={form.excludedDays}
            onChange={(p) => update(p)}
          />
          {show(errs.days) && <FieldError>{errs.days}</FieldError>}

          {/* schedule fine-tuning starts collapsed — the defaults work, and a summary line
              keeps the choices visible without three rows of controls up front */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
            <span className="min-w-0 text-[12.5px] leading-[1.5] text-dim">
              {form.granularity === 'day'
                ? 'Full days, people tap the days they can make'
                : <>{WIN_PRESETS.find((p) => p.v === form.windowPreset)?.l ?? 'All day'}, {{ '15': '15 min', '30': '30 min', '60': '1 hour' }[form.granularity] ?? form.granularity} slots, {fmtDur(form.durationMin)} long</>}
            </span>
            <button type="button" onClick={() => setTune((t) => !t)} className="-my-2 flex-none py-2 text-[12.5px] font-semibold text-accent-text hover:underline">
              {openTune ? 'Hide options' : 'Change'}
            </button>
          </div>

          {openTune && (<>
          <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-[13px] text-dim"><Clock size={15} /> Asking about</span>
            <Segmented
              value={form.granularity === 'day' ? 'day' : 'times'}
              onChange={(v) => update({ granularity: v === 'day' ? 'day' : '30' })}
              options={[{ v: 'times', l: 'Times of day' }, { v: 'day', l: 'Whole days' }]}
            />
            {form.granularity === 'day' && <span className="text-[12.5px] text-faint">Good for trips. People tap the days they can make.</span>}
          </div>
          {form.granularity !== 'day' && (<>
          {/* optional daily time window */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-[13px] text-dim"><Clock size={15} /> Daily time window</span>
            <Segmented value={form.windowPreset} onChange={pickWin} options={WIN_PRESETS.map((p) => ({ v: p.v, l: p.l }))} />
          </div>
          {form.windowPreset === 'custom' && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <span className="text-[12.5px] text-dim">From</span>
              <TimeField value={form.windowStart} onChange={(v) => update((f) => ({ windowStart: v, durationMin: Math.min(f.durationMin, winLenOf(f.windowPreset, v, f.windowEnd)) }))} err={show(errs.win)} label="Window start" />
              <span className="text-faint">→</span>
              <span className="text-[12.5px] text-dim">to</span>
              <TimeField value={form.windowEnd} onChange={(v) => update((f) => ({ windowEnd: v, durationMin: Math.min(f.durationMin, winLenOf(f.windowPreset, f.windowStart, v)) }))} err={show(errs.win)} label="Window end" />
            </div>
          )}
          {show(errs.win) && <FieldError>{errs.win}</FieldError>}
          {winText && (
            <p className="mt-2 text-[12.5px] leading-[1.5] text-faint">People will only be asked when they&apos;re free between {winText} on each day.</p>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-[13px] text-dim"><Clock size={15} /> Time slot size</span>
            <Segmented value={form.granularity} onChange={(v) => update({ granularity: v })} options={[{ v: '15', l: '15 min' }, { v: '30', l: '30 min' }, { v: '60', l: '1 hour' }]} />
          </div>

          {/* how long the event needs — drives the best-time search on the grid */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-[13px] text-dim"><Clock size={15} /> Event length</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {DUR_PRESETS.map((m) => (
                <button key={m} type="button" disabled={m > winLen} onClick={() => update({ durationMin: m })} className={`rounded-[7px] border px-2 py-1 text-[12.5px] font-medium ${m === form.durationMin ? 'border-accent bg-accent text-on-accent' : 'border-border2 bg-s1 enabled:hover:bg-s2 disabled:opacity-35'}`}>{fmtDur(m)}</button>
              ))}
              <span className="ml-1 text-[12px] text-faint">Custom</span>
              <input
                type="number" min={0} max={Math.floor(winLen / 60)} value={durH}
                onChange={(e) => { const n = parseInt(e.target.value, 10); setDur(Number.isNaN(n) ? 0 : Math.max(0, n), durM) }}
                className="h-7 w-[52px] rounded-[7px] border border-border bg-s1 px-2 text-[13px] tabular-nums outline-none focus:border-accent-border"
                aria-label="Event length hours"
              />
              <span className="text-[12px] text-faint">hr</span>
              <input
                type="number" min={0} max={59} value={durM}
                onChange={(e) => { const n = parseInt(e.target.value, 10); setDur(durH, Number.isNaN(n) ? 0 : Math.min(59, Math.max(0, n))) }}
                className="h-7 w-[52px] rounded-[7px] border border-border bg-s1 px-2 text-[13px] tabular-nums outline-none focus:border-accent-border"
                aria-label="Event length minutes"
              />
              <span className="text-[12px] text-faint">min</span>
            </div>
          </div>
          </>)}
          </>)}
        </div>
        )}
      </div>

      {/* the zone defaults to the visitor's own — it's here to check, not to fill in */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-[13px] font-semibold text-dim">Times in</span>
        <div className="relative">
          <select
            value={form.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
            className={`h-11 sm:h-9 cursor-pointer appearance-none rounded-[9px] border ${show(errs.tz) ? 'border-brick-border' : 'border-border'} bg-s2 pl-3 pr-8 text-[13.5px] font-medium outline-none focus:border-accent-border`}
            style={form.timezone ? undefined : { color: 'var(--faint)' }}
          >
            <option value="" disabled>Choose a time zone…</option>
            {TZ.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-dim" />
        </div>
        {show(errs.tz)
          ? <FieldError>{errs.tz}</FieldError>
          : <span className="text-[12.5px] text-faint">Double-check it if people join from elsewhere.</span>}
      </div>
    </div>
  )
}

/* ── Step 2: Location ── */
function StepLocation({ form, update, stopUid }: { form: Form; update: Update; stopUid: RefObject<number> }) {
  const modes: { v: LocMode; l: string; icon: typeof MapPin }[] = [
    { v: 'vote', l: 'In person', icon: MapPin },
    { v: 'remote', l: 'Remote', icon: Video },
    { v: 'later', l: 'Decide later', icon: Clock },
  ]
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Loc[]>([])
  const [searching, setSearching] = useState(false)
  const pickFlip = useFlipReorder(form.picked.map((p) => p.uid).join('|'))
  const pickReorder = usePointerReorder((fromI, toI) => {
    pickFlip.capture()
    update((f) => { const a = [...f.picked]; const [m] = a.splice(fromI, 1); a.splice(toI, 0, m); return { picked: a } })
  })

  const term = query.trim()
  const timesInRoute = (id: string) => form.picked.filter((p) => p.id === id).length
  const shown = form.planMode === 'itinerary' ? results : results.filter((r) => !form.picked.some((p) => p.id === r.id))
  const allPicked = form.planMode === 'vote' && results.length > 0 && shown.length === 0

  useEffect(() => {
    if (term.length < 3) { setResults([]); setSearching(false); return }
    setSearching(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        setResults(await searchPlaces(term, ctrl.signal, centroidOf(form.picked)))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([])
      } finally { setSearching(false) }
    }, 350)
    return () => { ctrl.abort(); clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  // a settled place is singular — picking another swaps it out
  function add(l: Loc) { pickFlip.capture(); update((f) => ({ picked: [...(f.locSettled ? [] : f.picked), { ...l, uid: `s${stopUid.current++}` }] })); setQuery('') }
  function addCustom() { const name = term; if (name) add({ id: `custom:${name.toLowerCase()}`, name, place: 'Custom place' }) }
  function remove(uid: string) { pickFlip.capture(); update((f) => ({ picked: f.picked.filter((x) => x.uid !== uid) })) }
  function move(i: number, dir: -1 | 1) {
    pickFlip.capture()
    update((f) => { const j = i + dir; if (j < 0 || j >= f.picked.length) return {}; const a = [...f.picked]; ;[a[i], a[j]] = [a[j], a[i]]; return { picked: a } })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Where will you meet?</Label>
        <SegmentedControl
          stretch
          className="w-full"
          value={form.locMode}
          onChange={(v) => update({ locMode: v as LocMode })}
          options={modes.map((m) => ({ v: m.v, l: m.l, icon: m.icon }))}
        />
      </div>

      {form.locMode === 'vote' && (
        <div className="flex flex-col gap-3">
          <div>
            <Label>How is the location decided?</Label>
            <SegmentedControl
              stretch
              className="w-full"
              value={form.locSettled ? 'set' : form.planMode}
              onChange={(v) => {
                if (v === 'set') update((f) => ({ locSettled: true, planMode: 'vote', picked: f.picked.slice(0, 1) }))
                else update({ locSettled: false, planMode: v as PlanMode })
              }}
              options={[{ v: 'vote', l: 'Guests vote', icon: Vote }, { v: 'itinerary', l: 'Plan a route', icon: Route }, { v: 'set', l: 'Already chosen', icon: Check }]}
            />
          </div>

          <p className="flex items-start gap-1.5 text-[13px] leading-[1.5] text-dim">
            {form.locSettled
              ? <><MapPin size={16} className="mt-0.5 flex-none" /> Add the place. Guests see it as settled — no voting, no suggestions.</>
              : form.planMode === 'vote'
                ? <><Vote size={16} className="mt-0.5 flex-none" /> Add a few ideas to start the vote. The one with the most votes wins, and anyone can add more places on the Location tab later.</>
                : <><Route size={16} className="mt-0.5 flex-none" /> Add the places you&apos;ll visit in the order you&apos;ll go. The route stays editable on the Location tab.</>}
          </p>

          {/* search */}
          <div className="relative">
            <div className="flex h-[42px] items-center gap-2 rounded-[10px] border border-border bg-s2 px-[13px] focus-within:border-accent-border">
              <Search size={17} className="text-faint" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any place, address, or city…" className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
            </div>
            {term && (
              <div className="scroll-slim absolute left-0 right-0 top-full z-20 mt-1 max-h-[300px] overflow-auto overscroll-contain rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
                {term.length < 3 ? (
                  <div className="px-2.5 py-2 text-[13px] text-faint">Keep typing to search for a place…</div>
                ) : (
                  <>
                    {searching && <div className="flex items-center gap-2 px-2.5 py-2 text-[13px] text-faint"><Loader2 size={15} className="animate-spin" /> Searching…</div>}
                    {!searching && shown.map((l) => {
                      const count = timesInRoute(l.id)
                      return (
                        <button key={l.id} type="button" onClick={() => add(l)} className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left hover:bg-s2">
                          <MapPin size={16} className="flex-none text-dim" />
                          <span className="min-w-0 flex-1"><OverflowText className="text-[14px] font-medium">{l.name}</OverflowText><OverflowText className="text-[12px] text-faint">{l.place}</OverflowText></span>
                          {count > 0 && <span className="flex-none text-[12px] text-faint">{count === 1 ? 'already a stop' : `${count} stops`}</span>}
                          <span className="flex flex-none items-center gap-1 text-[12.5px] font-semibold text-accent-text"><Plus size={16} /> {count > 0 ? 'Again' : ''}</span>
                        </button>
                      )
                    })}
                    {!searching && allPicked && <div className="px-2.5 py-1.5 text-[13px] text-faint">Already on your list.</div>}
                    {!searching && shown.length === 0 && !allPicked && <div className="px-2.5 py-1.5 text-[13px] text-faint">No matches. Add it as a custom place below.</div>}
                    {!searching && (
                      <button type="button" onClick={addCustom} className="mt-0.5 flex w-full items-center gap-2.5 rounded-[7px] border-t border-border px-2.5 py-2 text-left hover:bg-s2">
                        <Plus size={16} className="flex-none text-accent-text" />
                        <span className="min-w-0 truncate text-[14px]">Add “<span className="font-semibold">{term}</span>” as a custom place</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* picked */}
          {form.picked.length === 0 ? (
            <div className="flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-[13px] py-[11px]">
              <Info size={16} className="mt-0.5 text-accent-text" />
              <span className="text-[13px] leading-[1.5] text-dim">
                {form.locSettled
                  ? 'No place yet. Search above to add where it happens.'
                  : 'No places yet. You can start the vote empty and let everyone add ideas on the Location tab, or search above to seed it.'}
              </span>
            </div>
          ) : (
            <div ref={pickFlip.scope} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-[.1em] text-faint">{form.locSettled ? 'The place' : form.planMode === 'vote' ? `${form.picked.length} on the ballot` : `${form.picked.length} ${form.picked.length === 1 ? 'stop' : 'stops'}`}</span>
                {form.planMode === 'itinerary' && <span className="flex items-center gap-1 text-[12px] text-faint"><GripVertical size={13} /> Drag or use the arrows to reorder</span>}
              </div>
              <div ref={pickReorder.scope} className="flex flex-col gap-2">
                {form.picked.map((l, i) => {
                  const itin = form.planMode === 'itinerary'
                  return (
                    <div
                      key={l.uid}
                      data-flip-id={l.uid}
                      data-reorder-item
                      className={`flex h-11 items-center gap-2 rounded-[10px] border bg-s2 pl-2 pr-2 ${itin && pickReorder.dragIndex === i ? 'border-accent-border opacity-60 shadow-soft' : 'border-border'}`}
                    >
                      {itin ? (
                        <button type="button" {...pickReorder.handleProps(i)} aria-label="Drag to reorder" className="flex-none text-faint hover:text-dim"><GripVertical size={17} /></button>
                      ) : (
                        <MapPin size={17} className="text-accent-text" />
                      )}
                      {itin && <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-[12.5px] font-bold text-on-accent">{i + 1}</span>}
                      <span className="min-w-0 flex-1"><OverflowText className="text-[14px] font-medium">{l.name}</OverflowText><OverflowText className="text-[12px] text-faint">{l.place}</OverflowText></span>
                      {itin && (
                        <div className="flex flex-none items-center">
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-6 w-6 place-items-center rounded-[6px] text-dim enabled:hover:text-text disabled:opacity-30" aria-label="Move up"><ChevronUp size={17} /></button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === form.picked.length - 1} className="grid h-6 w-6 place-items-center rounded-[6px] text-dim enabled:hover:text-text disabled:opacity-30" aria-label="Move down"><ChevronDown size={17} /></button>
                        </div>
                      )}
                      <button type="button" onClick={() => remove(l.uid)} className="grid h-7 w-7 flex-none place-items-center rounded-[7px] text-faint hover:text-brick-text" aria-label="Remove"><X size={17} /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {form.locMode === 'remote' && (
        <div className="flex flex-col gap-3">
          <div>
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = form.platform === p.name
                return (
                  <button key={p.name} type="button" onClick={() => update({ platform: p.name })} className={`flex h-[34px] items-center gap-1.5 rounded-[9px] px-3 text-[13.5px] font-semibold ${on ? 'border-[1.5px] border-accent-border bg-accent-bg text-accent-text' : 'border border-border bg-s2 text-dim'}`}>
                    {p.img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.img} alt="" width={16} height={16} className="rounded-[3px]" />
                    )}
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>
          <Field label="Meeting link (optional)">
            <div className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-s2 px-[13px] focus-within:border-accent-border">
              <Link2 size={17} className="text-accent-text" />
              <input value={form.meetingLink} onChange={(e) => update({ meetingLink: e.target.value })} placeholder={`Paste a ${form.platform} link, or add it later`} className="flex-1 bg-transparent font-mono text-[14px] outline-none placeholder:text-faint" />
            </div>
          </Field>
          <div className="flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-[13px] py-[11px]">
            <Info size={16} className="mt-0.5 text-accent-text" />
            <span className="text-[13px] leading-[1.5] text-dim">You don&apos;t need the link right away. Add it whenever you have it and everyone will see it on the event page and in their reminders. There&apos;s no map for online events.</span>
          </div>
        </div>
      )}

      {form.locMode === 'later' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-s2 p-4">
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-ochre-border bg-ochre-bg text-ochre-text"><Clock size={18} /></span>
          <div>
            <div className="mb-0.5 text-[14px] font-semibold">Decide the location later</div>
            <div className="text-[13px] leading-[1.5] text-dim">Invites still go out and people can say when they&apos;re free. You can add a place to vote on whenever you&apos;re ready.</div>
          </div>
        </div>
      )}
    </div>
  )
}

const PLATFORMS: { name: string; img?: string }[] = [
  { name: 'Google Meet', img: '/logos/meet.png' },
  { name: 'Zoom', img: '/logos/zoom.png' },
  { name: 'Teams', img: '/logos/teams.png' },
  { name: 'Discord', img: '/logos/discord.png' },
  { name: 'Other' },
]

/* ── Step 3: Invite ── */
function StepInvite({ form, update }: { form: Form; update: Update }) {
  const [draft, setDraft] = useState('')
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // the people from this host's earlier events, read once: the list should not
  // reshuffle while someone is picking from it
  const recent = useMemo(() => recentInvitees(), [])
  const hasAccount = (id: string) => form.accounts.some((a) => a.id === id)
  const hasEmail = (e: string) => form.emails.includes(e)

  // an address that belongs to an account is invited as that person, so their name
  // and colour come with them and they need no personal link; any other address
  // becomes an email invite with a link of its own
  async function addEmail() {
    const e = draft.trim().toLowerCase()
    if (!e) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setNote('That does not look like an email address.'); return }
    if (isOwnEmail(e)) { setNote('That is your own address. You are the host, so you are already in.'); return }
    setNote(null)
    setChecking(true)
    const found = await lookupProfileByEmail(e)
    setChecking(false)
    if (found) update((f) => ({ accounts: f.accounts.some((a) => a.id === found.id) ? f.accounts : [...f.accounts, { id: found.id, name: found.name, color: found.color, email: found.email }] }))
    else update((f) => ({ emails: f.emails.includes(e) ? f.emails : [...f.emails, e] }))
    setDraft('')
  }
  function toggleRecent(r: Invitee) {
    if (r.account) update((f) => ({ accounts: hasAccount(r.id) ? f.accounts.filter((a) => a.id !== r.id) : [...f.accounts, { id: r.id, name: r.name, color: r.color, email: r.email }] }))
    else if (r.email) { const e = r.email; update((f) => ({ emails: hasEmail(e) ? f.emails.filter((x) => x !== e) : [...f.emails, e] })) }
  }
  const isOn = (r: Invitee) => (r.account ? hasAccount(r.id) : !!r.email && hasEmail(r.email))
  const total = form.emails.length + form.accounts.length

  return (
    <div className="flex flex-col gap-5">
      <Field label="Invite by email">
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => { setDraft(e.target.value); setNote(null) }} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void addEmail())} placeholder="name@company.com" className={inputCls()} />
          <button type="button" onClick={() => void addEmail()} disabled={checking} className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:opacity-60">
            {checking ? <Loader2 size={15} className="animate-spin" /> : null} Add
          </button>
        </div>
        {note && <FieldError>{note}</FieldError>}
        {(form.emails.length > 0 || form.accounts.length > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {form.accounts.map((a) => (
              <span key={a.id} className="flex h-[30px] items-center gap-1.5 rounded-full border border-accent-border bg-accent-bg py-0 pl-1.5 pr-2 text-[13.5px]" title={a.email ? `${a.email} (has an account)` : 'Has an account'}>
                <Avatar initials={initialsOf(a.name)} color={a.color} size={20} font={8.5} /> {a.name}
                <button type="button" onClick={() => update((f) => ({ accounts: f.accounts.filter((x) => x.id !== a.id) }))} aria-label="Remove"><X size={15} className="text-faint hover:text-brick-text" /></button>
              </span>
            ))}
            {form.emails.map((e) => (
              <span key={e} className="flex h-[30px] items-center gap-1.5 rounded-full border border-border bg-s2 py-0 pl-2.5 pr-2 text-[13.5px]">
                <Mail size={13} className="text-dim" /> {e}
                <button type="button" onClick={() => update((f) => ({ emails: f.emails.filter((x) => x !== e) }))} aria-label="Remove"><X size={15} className="text-faint hover:text-brick-text" /></button>
              </span>
            ))}
          </div>
        )}
      </Field>

      {/* people from earlier events, one tap each */}
      {recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <UserPlus size={16} className="text-dim" />
            <span className="text-[13px] font-semibold text-dim">People from your other events</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            {recent.map((r, i) => {
              const on = isOn(r)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRecent(r)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-s2 ${i > 0 ? 'border-t border-border' : ''} ${on ? 'bg-accent-bg/50' : 'bg-s1'}`}
                >
                  <Avatar initials={initialsOf(r.name)} color={r.color} size={34} font={12.5} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-semibold">{r.name}{r.account && <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[11px] font-medium text-faint">has an account</span>}</div>
                    <div className="truncate text-[12.5px] text-faint">{r.email ?? 'joined by link'}</div>
                  </div>
                  <span className={`flex h-[26px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold ${on ? 'bg-accent text-on-accent' : 'border border-border2 text-dim'}`}>
                    {on ? <><Check size={15} /> Added</> : <><Plus size={15} /> Add</>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[13px] text-dim">
        <Users size={15} />
        {total === 0 ? 'No one added yet. You can also invite people after the event is created.' : `${total} ${total === 1 ? 'person' : 'people'} will be invited when you create the event.`}
      </div>
    </div>
  )
}

/* ── Confirmation (after submit) ── */
function Created({ event: initial }: { event: AppEvent }) {
  // people can still be added from here, so the screen keeps its own copy
  const [event, setEvent] = useState(initial)
  const slug = event.id
  // the email invitees get their personal links by email, once, as soon as the
  // browser knows it is a logged-in host with a backend to send from
  const emailCount = initial.participants.filter((p) => p.guest && p.email).length
  const account = useAccount()
  const mailOn = canEmail(account.signedIn)
  const [invites, setInvites] = useState<{ state: 'off' | 'sending' | 'sent' | 'failed'; sent: number; error?: string }>({ state: 'off', sent: 0 })
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current || emailCount === 0 || !mailOn) return
    asked.current = true
    setInvites({ state: 'sending', sent: 0 })
    void sendInvites(event.id).then((r) => {
      if (!r.ok) setInvites({ state: 'failed', sent: 0, error: r.error })
      else setInvites({ state: r.data.failed > 0 && r.data.sent + r.data.already === 0 ? 'failed' : 'sent', sent: r.data.sent + r.data.already, error: r.data.failed > 0 ? `${r.data.failed} could not be sent.` : undefined })
    })
  }, [mailOn, emailCount, event.id])
  // the real join URL — a guest opens it, adds their name, and is in
  const link = `${typeof window === 'undefined' ? '' : window.location.host}/events/${slug}/join`
  const toast = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useGSAP(() => {
    gsap.fromTo(card.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
    gsap.fromTo('.created-check', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.15 })
    // drops in from the top — the bottom is covered by the tab bar on mobile
    const tl = gsap.timeline({ delay: 0.5 })
    tl.fromTo(toast.current, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
      .to(toast.current, { y: -24, opacity: 0, duration: 0.4, ease: 'power3.in', delay: 4 })
  }, [])

  function copy() {
    navigator.clipboard?.writeText(`${window.location.origin}/events/${slug}/join`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }

  // one honest line about the invites that went with the event
  const inviteLine = emailCount > 0 && (
    invites.state === 'sending' ? `Emailing ${emailCount} ${emailCount === 1 ? 'invite' : 'invites'}…`
      : invites.state === 'sent' ? `${invites.sent} ${invites.sent === 1 ? 'invite' : 'invites'} emailed with a personal link.${invites.error ? ` ${invites.error}` : ''}`
        : invites.state === 'failed' ? `The invites could not be emailed${invites.error ? `: ${invites.error}` : '.'} Their personal links are on the event page.`
          : account.signedIn
            ? `Email is not switched on for this site yet, so the ${emailCount === 1 ? 'personal link is' : `${emailCount} personal links are`} waiting on the event page.`
            : `${emailCount} ${emailCount === 1 ? 'person has' : 'people have'} a personal link waiting on the event page. Log in to email invites.`
  )

  return (
    <div className="relative min-h-[calc(100vh-54px)]">
      <div className="mx-auto max-w-[560px] px-[26px] pb-[104px] pt-[64px]">
        <div ref={card} className="rounded-2xl border border-border bg-s1 px-7 py-9 text-center shadow-soft">
          <span className="created-check mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-teal-border bg-teal-bg text-teal-text"><Check size={34} /></span>
          <h1 className="font-serif font-normal text-[33.5px] leading-[1.05] tracking-[-0.01em]">Your event is live</h1>
          <p className="mx-auto mt-2 max-w-[380px] text-[14.5px] leading-[1.55] text-dim">
            <span className="font-semibold text-text">{event.title}</span> has been created. Share the link below so anyone can join, say when they&apos;re free, and chat.
          </p>

          <div className="mx-auto mt-6 flex h-11 w-full max-w-[420px] items-center gap-2 rounded-[11px] border border-border2 bg-s2 py-0 pl-3.5 pr-2">
            <Link2 size={17} className="flex-none text-accent-text" />
            <span className="flex-1 truncate text-left font-mono text-[14px]">{link}</span>
            <button type="button" onClick={copy} className="flex h-8 flex-none items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[13.5px] font-semibold text-on-accent">
              {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
            </button>
          </div>

          {inviteLine && (
            <p className={`mx-auto mt-3 max-w-[420px] text-[12.5px] leading-[1.5] ${invites.state === 'failed' ? 'text-brick-text' : 'text-dim'}`}>{inviteLine}</p>
          )}

          {mailOn && <InviteByEmail event={event} onAdded={setEvent} />}

          <div className="mt-7 flex items-center justify-center gap-2.5">
            <Link href={`/events/${slug}?tab=availability`} className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-on-accent">
              Go to event <ArrowRight size={17} />
            </Link>
            <Link href="/home" className="flex h-10 items-center rounded-[10px] border border-border2 px-4 text-[14px] font-semibold hover:bg-s2">Back home</Link>
          </div>
        </div>
      </div>

      {/* toast notification — anchored top so the mobile tab bar never hides it */}
      <div ref={toast} className="pointer-events-none absolute left-1/2 top-4 w-max max-w-[calc(100vw-24px)] -translate-x-1/2 opacity-0">
        <div className="flex items-center gap-2.5 rounded-xl border border-border2 bg-s1 px-4 py-3 shadow-soft">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-bg text-accent-text"><PartyPopper size={17} /></span>
          <span className="text-[14px] font-semibold">Event created</span>
        </div>
      </div>
    </div>
  )
}

/* ── shared bits ── */
function inputCls(err = false) {
  // 44px tall on phones, the tighter 40 from sm up
  return `w-full h-11 sm:h-10 rounded-[10px] border ${err ? 'border-brick-border' : 'border-border'} bg-s2 px-[13px] text-[14.5px] outline-none placeholder:text-faint focus:border-accent-border`
}
/* custom time picker: the whole field opens the popover (native inputs only open on the
   clock icon), and the columns clip mid-row with a visible scrollbar so scrolling is obvious */
const HOURS = Array.from({ length: 12 }, (_, i) => i) // 0 = 12 o'clock
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

function TimeField({ value, onChange, err, label }: { value: string; onChange: (v: string) => void; err?: boolean; label: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const hourCol = useRef<HTMLDivElement>(null)
  const minCol = useRef<HTMLDivElement>(null)
  const min = parseHM(value) ?? 10 * 60
  const hr12 = Math.floor(min / 60) % 12 // 0 = 12 o'clock
  const mm = min % 60
  const pm = min >= 12 * 60

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  // center the current values when the popover opens
  useEffect(() => {
    if (!open) return
    const center = (col: HTMLDivElement | null, idx: number) => { if (col) col.scrollTop = idx * 30 - col.clientHeight / 2 + 15 }
    center(hourCol.current, hr12)
    center(minCol.current, Math.round(mm / 5))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (h: number, m: number, isPm: boolean) => onChange(`${String((h % 12) + (isPm ? 12 : 0)).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  const colCls = 'scroll-slim max-h-[164px] w-[52px] overflow-y-auto pr-0.5'
  const itemCls = (on: boolean) => `flex h-[30px] w-full items-center justify-center rounded-[7px] text-[13.5px] font-medium ${on ? 'bg-accent text-on-accent' : 'text-dim hover:bg-s2 hover:text-text'}`

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className={`flex h-9 items-center gap-1.5 rounded-[10px] border ${err ? 'border-brick-border' : open ? 'border-accent-border' : 'border-border'} bg-s1 px-2.5 text-[14px] font-medium hover:border-border2`}
      >
        <Clock size={15} className="text-dim" /> {fmtMinute(min)} <ChevronDown size={15} className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-[10px] border border-border bg-s1 p-1.5 shadow-soft">
          <div ref={hourCol} className={colCls}>
            {HOURS.map((h) => (
              <button key={h} type="button" onClick={() => set(h, mm, pm)} className={itemCls(h === hr12)}>{h === 0 ? 12 : h}</button>
            ))}
          </div>
          <div ref={minCol} className={colCls}>
            {MINUTES.map((m) => (
              <button key={m} type="button" onClick={() => set(hr12, m, pm)} className={itemCls(m === mm)}>{String(m).padStart(2, '0')}</button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {(['AM', 'PM'] as const).map((ap) => (
              <button key={ap} type="button" onClick={() => set(hr12, mm, ap === 'PM')} className={`${itemCls((ap === 'PM') === pm)} !w-[42px]`}>{ap}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
function Req() {
  return <span className="font-bold text-brick-text">*</span>
}
function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 flex items-center gap-1 text-[12.5px] font-medium text-brick-text"><Info size={12} /> {children}</p>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-[7px] block text-[13px] font-semibold text-dim">{children}</label>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>
}
function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="flex flex-wrap rounded-[9px] border border-border bg-s1 p-0.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} className="flex h-11 sm:h-7 items-center rounded-[7px] px-3 text-[13px] font-semibold transition-colors" style={value === o.v ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { color: 'var(--dim)' }}>
          {o.l}
        </button>
      ))}
    </div>
  )
}
