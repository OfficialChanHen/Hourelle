'use client'

import { use, useEffect, useRef, useState, type RefObject } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronDown, ChevronUp, Search, Plus, X, MapPin, Video, Clock,
  Info, Vote, ArrowLeft, ArrowRight, Mail, CalendarRange, Route, GripVertical,
  Loader2, Link2, Copy, Pencil, UserPlus, Users, PartyPopper,
  Map, Presentation, Repeat, Utensils, type LucideIcon,
} from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { av } from '@/lib/people'
import { createEvent, draftFromEvent, parseHM, fmtMinute, type AppEvent } from '@/lib/events'
import { useFlipReorder } from '@/hooks/useFlipReorder'
import { usePointerReorder } from '@/hooks/usePointerReorder'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

const STEPS = ['Basics', 'Location', 'Invite', 'Review'] as const
const USER_NAME = 'Jordan Miller'

// people with existing accounts you've invited before (hard-coded for now)
const RECENT_ACCOUNTS: { id: string; email: string }[] = [
  { id: 'SR', email: 'sarah.reyes@acme.co' },
  { id: 'AT', email: 'alex.tan@acme.co' },
  { id: 'KL', email: 'kyle.lee@acme.co' },
  { id: 'PR', email: 'priya.rao@acme.co' },
  { id: 'MN', email: 'mia.nakamura@acme.co' },
  { id: 'CL', email: 'chris.lopez@acme.co' },
]

const TZ = [
  { v: 'America/Los_Angeles', l: 'Pacific Time (PT)' },
  { v: 'America/Denver', l: 'Mountain Time (MT)' },
  { v: 'America/Chicago', l: 'Central Time (CT)' },
  { v: 'America/New_York', l: 'Eastern Time (ET)' },
  { v: 'Europe/London', l: 'London (GMT/BST)' },
  { v: 'UTC', l: 'UTC' },
]
const tzLabel = (v: string) => TZ.find((t) => t.v === v)?.l ?? v

type Loc = { id: string; name: string; place: string }
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
  startDate: string
  endDate: string
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
  accounts: string[]
}

const initialForm: Form = {
  title: '', description: '',
  scheduleMode: 'find', fixedDay: '', fixedStart: '18:00', fixedEnd: '21:00',
  startDate: '', endDate: '', granularity: '30', windowPreset: 'any', windowStart: '', windowEnd: '', durationMin: 60,
  timezone: '', budget: '', budgetMode: 'total', capacity: '', // timezone deliberately unset: picking it is a required, conscious step
  locMode: 'vote', planMode: 'vote', locSettled: false, picked: [], platform: 'Google Meet', meetingLink: '',
  emails: [], accounts: [],
}

type Update = (patch: Partial<Form> | ((f: Form) => Partial<Form>)) => void
type BasicsErrs = { title: string; start: string; end: string; win: string; tz: string; fixed: string }

// template starting points (/create?template=…) — structure only; dates stay a conscious choice
const TEMPLATE_PRESETS: Record<string, Partial<Form>> = {
  offsite: { title: 'Team offsite', description: 'A few days of strategy and team time.', granularity: '60', locMode: 'vote', planMode: 'itinerary', budgetMode: 'person' },
  trip: { title: 'Weekend trip', description: 'Pick the dates together and vote on where to go.', granularity: '60', locMode: 'vote', planMode: 'itinerary' },
  birthday: { title: 'Birthday party', description: 'One night, one spot.', granularity: '30', windowPreset: 'evening', windowStart: '17:00', windowEnd: '21:00', durationMin: 180, locMode: 'vote', planMode: 'vote' },
  conference: { title: 'Conference', granularity: '60', locMode: 'vote', planMode: 'itinerary' },
  'one-on-one': { title: 'Weekly 1:1', granularity: '15', durationMin: 30, locMode: 'remote' },
  dinner: { title: 'Dinner and drinks', granularity: '30', windowPreset: 'evening', windowStart: '17:00', windowEnd: '21:00', durationMin: 120, locMode: 'vote', planMode: 'vote' },
}

// the same presets, as tappable chips on the wizard's first step
const WIZ_TEMPLATES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'offsite', label: 'Team offsite', icon: Route },
  { key: 'trip', label: 'Weekend trip', icon: Map },
  { key: 'birthday', label: 'Birthday', icon: PartyPopper },
  { key: 'conference', label: 'Conference', icon: Presentation },
  { key: 'one-on-one', label: '1:1', icon: Repeat },
  { key: 'dinner', label: 'Dinner', icon: Utensils },
]

export default function CreatePage({ searchParams }: { searchParams: Promise<{ template?: string; from?: string }> }) {
  const { template, from } = use(searchParams)
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState<AppEvent | null>(null)
  const [tpl, setTpl] = useState<string | null>(template && TEMPLATE_PRESETS[template] ? template : null)
  const [form, setForm] = useState<Form>(() => ({ ...initialForm, ...(template ? TEMPLATE_PRESETS[template] : undefined) }))
  const [attempted, setAttempted] = useState(false)
  const [today, setToday] = useState('')
  const stopUid = useRef(0)
  const panel = useRef<HTMLDivElement>(null)

  const update: Update = (patch) =>
    setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }))

  // reuse a past event (/create?from=…): its structure seeds the form, dates and
  // responses start fresh (localStorage read, so it has to happen after mount)
  useEffect(() => {
    if (!from) return
    const d = draftFromEvent(from)
    if (!d) return
    setForm((f) => ({
      ...f,
      title: d.title ?? f.title,
      description: d.description ?? f.description,
      timezone: d.timezone ?? f.timezone,
      granularity: d.granularity ?? f.granularity,
      durationMin: d.durationMin ?? f.durationMin,
      budget: d.budget ?? f.budget,
      budgetMode: d.budgetMode ?? f.budgetMode,
      locMode: d.locMode ?? f.locMode,
      planMode: d.planMode ?? f.planMode,
      picked: (d.picked ?? []).map((p) => ({ ...p, uid: `s${stopUid.current++}` })),
      platform: d.platform ?? f.platform,
      meetingLink: d.meetingLink ?? f.meetingLink,
      emails: d.emails ?? f.emails,
      accounts: d.accounts ?? f.accounts,
    }))
  }, [from])

  useEffect(() => {
    const d = new Date()
    setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }, [])
  useEffect(() => { setAttempted(false) }, [step]) // clear errors when moving between steps

  useGSAP(
    () => { gsap.fromTo(panel.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }) },
    { dependencies: [step] },
  )

  if (created) return <Created event={created} />

  // ── required-field validation ──
  const finding = form.scheduleMode === 'find' // the window fields only matter when a time is being found
  const basicsErr: BasicsErrs = {
    title: form.title.trim() ? '' : 'Add an event title.',
    start: !finding ? '' : !form.startDate ? 'Pick the earliest day.' : today && form.startDate < today ? 'The earliest day can’t be before today.' : '',
    end: !finding ? '' : !form.endDate ? 'Pick the latest day.' : form.startDate && form.endDate < form.startDate ? 'The latest day can’t be before the earliest day.' : '',
    win:
      finding && form.windowPreset === 'custom' && (parseHM(form.windowStart) === null || parseHM(form.windowEnd) === null)
        ? 'Pick both times for the custom window.'
        : finding && form.windowPreset === 'custom' && (parseHM(form.windowEnd) ?? 0) <= (parseHM(form.windowStart) ?? 0)
          ? 'The window has to end after it starts.'
          : '',
    tz: form.timezone ? '' : 'Pick the time zone this event runs in.',
    fixed: finding
      ? ''
      : !form.fixedDay
        ? 'Pick the day.'
        : today && form.fixedDay < today
          ? 'The day can’t be before today.'
          : parseHM(form.fixedStart) === null || parseHM(form.fixedEnd) === null
            ? 'Pick both times.'
            : (parseHM(form.fixedEnd) as number) <= (parseHM(form.fixedStart) as number)
              ? 'It has to end after it starts.'
              : '',
  }
  // an empty ballot is fine: the Location tab handles it, and guests can add places later
  function stepValid(s: number) {
    if (s === 0) return !basicsErr.title && !basicsErr.start && !basicsErr.end && !basicsErr.win && !basicsErr.tz && !basicsErr.fixed
    return true
  }

  // tap a template to seed the form; tap it again to start blank
  function applyTemplate(key: string) {
    if (tpl === key) { setForm(initialForm); setTpl(null); return }
    setForm({ ...initialForm, ...TEMPLATE_PRESETS[key] })
    setTpl(key)
  }

  function next() {
    if (!stepValid(step)) { setAttempted(true); return }
    setStep((s) => Math.min(3, s + 1))
  }
  function back() { step === 0 ? router.push('/home') : setStep((s) => s - 1) }
  const canCreate = form.title.trim().length > 0

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-[104px] pt-6 sm:px-[26px] sm:pt-[34px]">
      {/* compact on phones: the stepper below already tells the story */}
      <div className="mb-4 text-center sm:mb-[22px]">
        <h1 className="font-serif text-[27px] leading-[1.04] tracking-[-0.01em] sm:text-[33.5px]">Create event</h1>
        <p className="mt-1.5 hidden text-[13.5px] text-dim sm:block">Fill in a few details, invite people, then review and create it.</p>
      </div>

      {/* step indicator — labels collapse to the current step on mobile so it never overflows */}
      <div className="mb-6 flex items-center justify-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <button type="button" onClick={() => i < step && setStep(i)} className="flex items-center gap-[7px] sm:gap-[9px]" disabled={i >= step}>
              <span
                className="grid h-7 w-7 flex-none place-items-center rounded-full text-[13.5px] font-bold"
                style={{
                  background: i < step ? 'var(--teal)' : i === step ? 'var(--accent)' : 'var(--s2)',
                  color: i > step ? 'var(--faint)' : '#fff',
                  boxShadow: i === step ? '0 0 0 4px var(--accent-bg)' : undefined,
                }}
              >
                {i < step ? <Check size={17} /> : i + 1}
              </span>
              {/* full labels on sm+, only the current step's label on mobile */}
              <span className={`text-[13.5px] font-semibold ${i === step ? '' : 'hidden'} sm:inline`} style={{ color: i > step ? 'var(--faint)' : 'var(--text)' }}>{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="mx-2 h-0.5 w-5 sm:mx-3 sm:w-[46px]" style={{ background: i < step ? 'var(--teal)' : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>

      {/* start from a template — one tap seeds the form, tap again to go blank */}
      {step === 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Start from a template</div>
          <div className="flex flex-wrap gap-1.5">
            {WIZ_TEMPLATES.map((t) => {
              const Icon = t.icon
              const on = tpl === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => applyTemplate(t.key)}
                  aria-pressed={on}
                  className={`flex h-8 flex-none items-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-medium ${on ? 'border-accent bg-accent-bg text-accent-text' : 'border-border bg-s1 text-dim hover:border-border2 hover:text-text'}`}
                >
                  <Icon size={14} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div ref={panel} className="rounded-2xl border border-border bg-s1 px-4 py-[22px] sm:px-6">
        {step === 0 && <StepBasics form={form} update={update} today={today} attempted={attempted} errs={basicsErr} />}
        {step === 1 && <StepLocation form={form} update={update} stopUid={stopUid} />}
        {step === 2 && <StepInvite form={form} update={update} />}
        {step === 3 && <StepReview form={form} goStep={setStep} />}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={back} className="flex h-10 items-center gap-1.5 rounded-[10px] border border-border2 bg-transparent px-4 text-[14px] font-semibold hover:bg-s2">
          <ArrowLeft size={17} /> Back
        </button>
        {step < 3 ? (
          <button onClick={next} className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-[18px] text-[14px] font-semibold text-on-accent">
            Continue <ArrowRight size={17} />
          </button>
        ) : (
          <button
            onClick={() => {
              if (!canCreate) return
              setCreated(createEvent({
                ...form,
                fixed: form.scheduleMode === 'set' ? { day: form.fixedDay, start: form.fixedStart, end: form.fixedEnd } : undefined,
              }))
            }}
            disabled={!canCreate}
            className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-[18px] text-[14px] font-semibold text-on-accent disabled:opacity-40"
          >
            <Check size={17} /> Create event
          </button>
        )}
      </div>
      {step === 3 && !canCreate && (
        <p className="mt-2 text-right text-[12.5px] text-brick-text">Add an event title in Basics before creating.</p>
      )}
    </div>
  )
}

/* ── Step 1: Basics ── */
function StepBasics({ form, update, today, attempted, errs }: { form: Form; update: Update; today: string; attempted: boolean; errs: BasicsErrs }) {
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
  // the visitor's own zone, when it's one we list — powers the one-tap suggestion.
  // Resolved after mount only: the server can't know it, and guessing there mismatches hydration
  const [localTzOpt, setLocalTzOpt] = useState<{ v: string; l: string } | null>(null)
  useEffect(() => {
    try { setLocalTzOpt(TZ.find((t) => t.v === Intl.DateTimeFormat().resolvedOptions().timeZone) ?? null) } catch { /* keep the plain helper text */ }
  }, [])
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
        <input value={USER_NAME} readOnly disabled className={`${inputCls(false)} max-w-[320px] cursor-not-allowed opacity-60`} />
      </div>

      <div>
        <Label>Description <span className="font-normal text-faint">(optional)</span></Label>
        <textarea
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="What's this event about?"
          className={`${inputCls(false)} h-[72px] resize-none py-[11px] leading-[1.5]`}
        />
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
            <p className="mt-2.5 border-t border-border pt-2.5 text-[12.5px] leading-[1.5] text-faint">
              The plan starts out locked in. Invites skip the scheduling and go straight to yes or no.
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

          {/* schedule fine-tuning starts collapsed — the defaults work, and a summary line
              keeps the choices visible without three rows of controls up front */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
            <span className="min-w-0 text-[12.5px] leading-[1.5] text-dim">
              {WIN_PRESETS.find((p) => p.v === form.windowPreset)?.l ?? 'All day'} · {{ '15': '15 min', '30': '30 min', '60': '1 hour' }[form.granularity] ?? form.granularity} slots · {fmtDur(form.durationMin)} long
            </span>
            <button type="button" onClick={() => setTune((t) => !t)} className="flex-none text-[12.5px] font-semibold text-accent-text hover:underline">
              {openTune ? 'Hide options' : 'Change'}
            </button>
          </div>

          {openTune && (<>
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
        </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[200px] flex-1">
          <Label>Time zone <Req /></Label>
          <div className="relative">
            <select
              value={form.timezone}
              onChange={(e) => update({ timezone: e.target.value })}
              className={`${inputCls(show(errs.tz))} cursor-pointer appearance-none pr-9`}
              style={form.timezone ? undefined : { color: 'var(--faint)' }}
            >
              <option value="" disabled>Choose a time zone…</option>
              {TZ.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <ChevronDown size={17} className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-dim" />
          </div>
          {show(errs.tz)
            ? <FieldError>{errs.tz}</FieldError>
            : localTzOpt && !form.timezone
              // picking a zone stays a conscious step, but the common answer is one tap away
              ? <button type="button" onClick={() => update({ timezone: localTzOpt.v })} className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-bg px-2.5 py-1 text-[12px] font-semibold text-accent-text">
                  Use my time zone · {localTzOpt.l}
                </button>
              : <p className="mt-1.5 text-[12.5px] leading-[1.5] text-faint">Every time on this event uses this zone. Double-check it if people join from elsewhere.</p>}
        </div>
        <div className="min-w-[200px] flex-1">
          <Label>Budget (optional)</Label>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-dim">$</span>
              <input inputMode="numeric" placeholder="0" value={form.budget} onChange={(e) => update({ budget: e.target.value.replace(/[^\d]/g, '') })} className={`${inputCls(false)} pl-7`} />
            </div>
            <Segmented value={form.budgetMode} onChange={(v) => update({ budgetMode: v as 'total' | 'person' })} options={[{ v: 'total', l: 'Total' }, { v: 'person', l: 'Per person' }]} />
          </div>
        </div>
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
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=${encodeURIComponent(term)}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
        const data: { place_id: number; name?: string; display_name: string }[] = await res.json()
        setResults(data.map((d) => {
          const parts = d.display_name.split(', ')
          return { id: String(d.place_id), name: d.name && d.name.trim() ? d.name : parts[0], place: (d.name ? parts : parts.slice(1)).slice(0, 3).join(', ') }
        }))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([])
      } finally { setSearching(false) }
    }, 350)
    return () => { ctrl.abort(); clearTimeout(t) }
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
                          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{l.name} <span className="font-normal text-faint">· {l.place}</span></span>
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
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{l.name} <span className="font-normal text-faint">· {l.place}</span></span>
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
  function addEmail() {
    const e = draft.trim()
    if (!e) return
    update((f) => ({ emails: f.emails.includes(e) ? f.emails : [...f.emails, e] }))
    setDraft('')
  }
  function toggleAccount(id: string) {
    update((f) => ({ accounts: f.accounts.includes(id) ? f.accounts.filter((x) => x !== id) : [...f.accounts, id] }))
  }
  const total = form.emails.length + form.accounts.length

  return (
    <div className="flex flex-col gap-5">
      <Field label="Invite by email">
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())} placeholder="name@company.com" className={inputCls()} />
          <button type="button" onClick={addEmail} className="h-10 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent">Add</button>
        </div>
        {form.emails.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {form.emails.map((e) => (
              <span key={e} className="flex h-[30px] items-center gap-1.5 rounded-full border border-border bg-s2 py-0 pl-2.5 pr-2 text-[13.5px]">
                <Mail size={13} className="text-dim" /> {e}
                <button type="button" onClick={() => update((f) => ({ emails: f.emails.filter((x) => x !== e) }))} aria-label="Remove"><X size={15} className="text-faint hover:text-brick-text" /></button>
              </span>
            ))}
          </div>
        )}
      </Field>

      {/* recently-invited accounts */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <UserPlus size={16} className="text-dim" />
          <span className="text-[13px] font-semibold text-dim">Add people you&apos;ve invited before</span>
          <span className="rounded-full border border-border bg-s2 px-[7px] py-px text-[11px] text-faint">has an account</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          {RECENT_ACCOUNTS.map((a, i) => {
            const p = av(a.id)
            const on = form.accounts.includes(a.id)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAccount(a.id)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-s2 ${i > 0 ? 'border-t border-border' : ''} ${on ? 'bg-accent-bg/50' : 'bg-s1'}`}
              >
                <Avatar initials={a.id} color={p.color} size={34} font={12.5} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">{p.name}</div>
                  <div className="truncate text-[12.5px] text-faint">{a.email}</div>
                </div>
                <span className={`flex h-[26px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold ${on ? 'bg-accent text-on-accent' : 'border border-border2 text-dim'}`}>
                  {on ? <><Check size={15} /> Added</> : <><Plus size={15} /> Add</>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* optional spot limit — first come, first served */}
      <div>
        <Label>Spots <span className="font-normal text-faint">(optional)</span></Label>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            inputMode="numeric" placeholder="No limit" value={form.capacity}
            onChange={(e) => update({ capacity: e.target.value.replace(/[^\d]/g, '').slice(0, 4) })}
            className={`${inputCls(false)} !w-[110px]`}
          />
          <span className="text-[12.5px] leading-[1.5] text-faint">Cap how many people can say they&apos;re going. Spots go to whoever replies first.</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[13px] text-dim">
        <Users size={15} />
        {total === 0 ? 'No one added yet. You can also invite people after the event is created.' : `${total} ${total === 1 ? 'person' : 'people'} will be invited when you create the event.`}
      </div>
    </div>
  )
}

/* ── Step 4: Review ── */
function StepReview({ form, goStep }: { form: Form; goStep: (n: number) => void }) {
  const total = form.emails.length + form.accounts.length
  const dateText = form.startDate ? (form.endDate && form.endDate !== form.startDate ? `${form.startDate} → ${form.endDate}` : form.startDate) : 'Not set'
  const granLabel = { '15': '15 min', '30': '30 min', '60': '1 hour' }[form.granularity] ?? form.granularity
  const ws = parseHM(form.windowStart), we = parseHM(form.windowEnd)
  const winLabel = form.windowPreset === 'any' || ws === null || we === null || we <= ws
    ? 'All day'
    : `${form.windowPreset === 'custom' ? '' : `${WIN_PRESETS.find((p) => p.v === form.windowPreset)?.l} · `}${fmtMinute(ws)} – ${fmtMinute(we)}`

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] text-dim">Give everything a last look. When you create the event, invites go out and you&apos;ll get a link to share.</p>

      {/* Basics */}
      <ReviewCard title="Basics" onEdit={() => goStep(0)}>
        <Row k="Title" v={form.title || <span className="text-faint">Untitled event</span>} />
        <Row k="Hosted by" v={USER_NAME} />
        {form.description && <Row k="Description" v={form.description} />}
        {form.scheduleMode === 'set' ? (
          <Row k="When" v={(() => {
            const s = parseHM(form.fixedStart), e = parseHM(form.fixedEnd)
            const t = s !== null && e !== null && e > s ? ` · ${fmtMinute(s)} – ${fmtMinute(e)}` : ''
            return form.fixedDay ? <>{form.fixedDay}{t} <span className="text-faint">· locked in from the start</span></> : <span className="text-brick-text">Not set — pick the day in Basics</span>
          })()} />
        ) : (<>
        <Row k="Date window" v={dateText} />
        <Row k="Time window" v={winLabel} />
        <Row k="Time slots" v={granLabel} />
        <Row k="Event length" v={fmtDur(form.durationMin)} />
        </>)}
        <Row k="Time zone" v={form.timezone ? tzLabel(form.timezone) : <span className="text-brick-text">Not set — pick one in Basics</span>} />
        <Row k="Budget" v={form.budget ? `$${form.budget} ${form.budgetMode === 'person' ? 'per person' : 'total'}` : <span className="text-faint">None</span>} />
        <Row k="Spots" v={form.capacity ? `${form.capacity} · first come, first served` : <span className="text-faint">No limit</span>} />
      </ReviewCard>

      {/* Location */}
      <ReviewCard title="Location" onEdit={() => goStep(1)}>
        {form.locMode === 'later' && <Row k="Where" v="Decide later" />}
        {form.locMode === 'remote' && (
          <>
            <Row k="Where" v={`Remote · ${form.platform}`} />
            <Row k="Link" v={form.meetingLink || <span className="text-faint">Add later</span>} />
          </>
        )}
        {form.locMode === 'vote' && (
          <>
            <Row k="Where" v={`In person · ${form.locSettled ? 'place is set' : form.planMode === 'vote' ? 'guests vote' : 'planned route'}`} />
            <Row
              k={form.locSettled ? 'Place' : form.planMode === 'vote' ? 'Candidates' : 'Stops'}
              v={form.picked.length === 0 ? <span className="text-faint">None added yet</span> : (
                <div className="flex flex-col gap-1">
                  {form.picked.map((l, i) => (
                    <span key={l.uid} className="flex items-center gap-1.5">
                      {form.planMode === 'itinerary' && <span className="grid h-4 w-4 flex-none place-items-center rounded-full bg-accent text-[10px] font-bold text-on-accent">{i + 1}</span>}
                      <span className="font-medium">{l.name}</span> <span className="text-faint">· {l.place}</span>
                    </span>
                  ))}
                </div>
              )}
            />
          </>
        )}
      </ReviewCard>

      {/* Invites */}
      <ReviewCard title="Invites" onEdit={() => goStep(2)}>
        {total === 0 ? (
          <Row k="People" v={<span className="text-faint">No one yet</span>} />
        ) : (
          <>
            {form.accounts.length > 0 && (
              <Row k="Accounts" v={
                <div className="flex flex-wrap items-center gap-1.5">
                  {form.accounts.map((id) => <span key={id} className="flex items-center gap-1 rounded-full border border-border bg-s2 py-0.5 pl-0.5 pr-2 text-[12.5px]"><Avatar initials={id} color={av(id).color} size={20} font={9} /> {av(id).name}</span>)}
                </div>
              } />
            )}
            {form.emails.length > 0 && <Row k="Emails" v={form.emails.join(', ')} />}
          </>
        )}
      </ReviewCard>
    </div>
  )
}

/* ── Confirmation (after submit) ── */
function Created({ event }: { event: AppEvent }) {
  const total = event.participants.filter((p) => !p.you).length
  const slug = event.id
  const link = `aline.app/e/${slug}`
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
    navigator.clipboard?.writeText(`https://${link}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }

  return (
    <div className="relative min-h-[calc(100vh-54px)]">
      <div className="mx-auto max-w-[560px] px-[26px] pb-[104px] pt-[64px]">
        <div ref={card} className="rounded-2xl border border-border bg-s1 px-7 py-9 text-center shadow-soft">
          <span className="created-check mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-teal-border bg-teal-bg text-teal-text"><Check size={34} /></span>
          <h1 className="font-serif text-[33.5px] leading-[1.05] tracking-[-0.01em]">Your event is live</h1>
          <p className="mx-auto mt-2 max-w-[380px] text-[14.5px] leading-[1.55] text-dim">
            <span className="font-semibold text-text">{event.title}</span> has been created{total > 0 ? ` and ${total} ${total === 1 ? 'invite is' : 'invites are'} on the way` : ''}. Share the link below so anyone can join, say when they&apos;re free, and chat.
          </p>

          <div className="mx-auto mt-6 flex h-11 w-full max-w-[420px] items-center gap-2 rounded-[11px] border border-border2 bg-s2 py-0 pl-3.5 pr-2">
            <Link2 size={17} className="flex-none text-accent-text" />
            <span className="flex-1 truncate text-left font-mono text-[14px]">{link}</span>
            <button type="button" onClick={copy} className="flex h-8 flex-none items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[13.5px] font-semibold text-on-accent">
              {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2.5">
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
          <span className="text-[14px] font-semibold">Event created{total > 0 ? ` · ${total} ${total === 1 ? 'invite' : 'invites'} sent` : ''}</span>
        </div>
      </div>
    </div>
  )
}

/* ── shared bits ── */
function inputCls(err = false) {
  return `w-full h-10 rounded-[10px] border ${err ? 'border-brick-border' : 'border-border'} bg-s2 px-[13px] text-[14.5px] outline-none placeholder:text-faint focus:border-accent-border`
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
        <button key={o.v} type="button" onClick={() => onChange(o.v)} className="flex h-7 items-center rounded-[7px] px-3 text-[13px] font-semibold transition-colors" style={value === o.v ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { color: 'var(--dim)' }}>
          {o.l}
        </button>
      ))}
    </div>
  )
}
function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-s0 p-4">
      <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2">
        <span className="text-[12px] font-semibold uppercase tracking-[.13em] text-faint">{title}</span>
        <button type="button" onClick={onEdit} className="flex items-center gap-1 text-[13px] font-semibold text-accent-text hover:underline"><Pencil size={13} /> Edit</button>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[14px]">
      <span className="w-[92px] flex-none text-dim">{k}</span>
      <span className="min-w-0 flex-1 font-medium text-text">{v}</span>
    </div>
  )
}
