'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronDown, ChevronUp, Link2, Search, Plus, X, MapPin, Video, Clock,
  CalendarPlus, Info, Vote, ArrowLeft, ArrowRight, Mail, CalendarRange,
  Route, MessagesSquare, MoreHorizontal, GripVertical,
} from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { av } from '@/lib/people'

const STEPS = ['Basics', 'Location', 'Invite', 'Share'] as const
type LocMode = 'vote' | 'remote' | 'later'

// the signed-in user (host when "Hosted by You")
const USER_NAME = 'Jordan Miller'

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [hostMode, setHostMode] = useState<'you' | 'org'>('you')
  const [locMode, setLocMode] = useState<LocMode>('vote')
  const [invitees, setInvitees] = useState<string[]>([])
  const panel = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.fromTo(panel.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' })
    },
    { dependencies: [step] },
  )

  function next() { setStep((s) => Math.min(3, s + 1)) }
  function back() { step === 0 ? router.push('/home') : setStep((s) => s - 1) }

  return (
    <div className="mx-auto max-w-[760px] px-[26px] pb-[104px] pt-[34px]">
      <div className="mb-[22px] text-center">
        <h1 className="font-serif text-[30px] leading-[1.04] tracking-[-0.01em]">Create event</h1>
        <p className="mt-1.5 text-[12px] text-dim">
          Set the basics, invite people, and share a link — guests can join without an account.
        </p>
      </div>

      {/* step indicator */}
      <div className="mb-6 flex items-center justify-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-[9px]">
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold"
                style={{
                  background: i < step ? 'var(--teal)' : i === step ? 'var(--accent)' : 'var(--s2)',
                  color: i > step ? 'var(--faint)' : '#fff',
                  boxShadow: i === step ? '0 0 0 4px var(--accent-bg)' : undefined,
                }}
              >
                {i < step ? <Check size={15} /> : i + 1}
              </span>
              <span className="text-[12px] font-semibold" style={{ color: i > step ? 'var(--faint)' : 'var(--text)' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="mx-3 h-0.5 w-[46px]" style={{ background: i < step ? 'var(--teal)' : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>

      {/* card */}
      <div ref={panel} className="rounded-2xl border border-border bg-s1 px-6 py-[22px]">
        {step === 0 && <StepBasics hostMode={hostMode} setHostMode={setHostMode} />}
        {step === 1 && <StepLocation locMode={locMode} setLocMode={setLocMode} />}
        {step === 2 && <StepInvite invitees={invitees} setInvitees={setInvitees} />}
        {step === 3 && <StepShare invitees={invitees} />}
      </div>

      {/* footer nav */}
      <div className="mt-4 flex items-center justify-between">
        <button onClick={back} className="flex h-10 items-center gap-1.5 rounded-[10px] border border-border2 bg-transparent px-4 text-[12.5px] font-semibold hover:bg-s2">
          <ArrowLeft size={15} /> Back
        </button>
        {step < 3 ? (
          <button onClick={next} className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-[18px] text-[12.5px] font-semibold text-on-accent">
            Continue <ArrowRight size={15} />
          </button>
        ) : (
          <Link href="/events/q3-offsite?tab=availability" className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-[18px] text-[12.5px] font-semibold text-on-accent">
            Go to event <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </div>
  )
}

/* ── Step 1: Basics ── */
function StepBasics({ hostMode, setHostMode }: { hostMode: 'you' | 'org'; setHostMode: (m: 'you' | 'org') => void }) {
  const [gran, setGran] = useState('30')
  const [tz, setTz] = useState('America/Los_Angeles')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [budget, setBudget] = useState('')
  // today's local date (computed after mount to avoid SSR/client hydration drift)
  const [today, setToday] = useState('')
  useEffect(() => {
    const d = new Date()
    setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }, [])

  function onStartChange(v: string) {
    const clamped = today && v && v < today ? today : v
    setStart(clamped)
    // keep the window valid: latest can't precede earliest (same day is allowed)
    if (end && clamped && end < clamped) setEnd(clamped)
  }
  function onEndChange(v: string) {
    const floor = start || today
    setEnd(floor && v && v < floor ? floor : v)
  }
  const dateError =
    (today && start && start < today && 'The earliest day can’t be before today.') ||
    (start && end && end < start && 'The latest day can’t be before the earliest day.') ||
    ''

  return (
    <div className="flex flex-col gap-4">
      <Field label="Event title">
        <input placeholder="e.g. Team Meeting" className={inputCls} />
      </Field>

      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[200px] flex-1">
          <Label>Hosted by</Label>
          <div className="flex rounded-[10px] border border-border bg-s2 p-[3px]">
            {(['you', 'org'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setHostMode(m)}
                className="flex h-8 flex-1 items-center justify-center rounded-[7px] text-[12px] font-semibold transition-colors"
                style={hostMode === m ? { background: 'var(--s0)', color: 'var(--text)' } : { color: 'var(--dim)' }}
              >
                {m === 'you' ? 'You' : 'Organization'}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-[200px] flex-1">
          <Label>{hostMode === 'you' ? 'Host' : 'Organization name'}</Label>
          {hostMode === 'you' ? (
            <input key="host-you" value={USER_NAME} readOnly disabled className={`${inputCls} cursor-not-allowed opacity-60`} />
          ) : (
            <input key="host-org" placeholder="e.g. Acme Engineering Org" className={inputCls} />
          )}
        </div>
      </div>

      <Field label="Description">
        <textarea
          placeholder="What's this event about? (optional)"
          className={`${inputCls} h-[72px] resize-none py-[11px] leading-[1.5]`}
        />
      </Field>

      {/* date window + granularity */}
      <div>
        <Label>Date window</Label>
        <div className="rounded-[12px] border border-border bg-s2 p-3.5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[150px] flex-1">
              <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.1em] text-faint">
                <CalendarRange size={12} /> Earliest day
              </span>
              <input
                type="date"
                value={start}
                min={today || undefined}
                onChange={(e) => onStartChange(e.target.value)}
                className={`${inputCls} cursor-pointer bg-s1`}
              />
            </div>
            <span className="pb-[11px] text-faint">→</span>
            <div className="min-w-[150px] flex-1">
              <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.1em] text-faint">
                <CalendarRange size={12} /> Latest day
              </span>
              <input
                type="date"
                value={end}
                min={start || today || undefined}
                onChange={(e) => onEndChange(e.target.value)}
                className={`${inputCls} cursor-pointer bg-s1`}
              />
            </div>
          </div>
          {dateError && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-brick-text">
              <Info size={12} /> {dateError}
            </p>
          )}
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-[11.5px] text-dim"><Clock size={13} /> Time granularity</span>
            <Segmented
              value={gran}
              onChange={setGran}
              options={[{ v: '15', l: '15 min' }, { v: '30', l: '30 min' }, { v: '60', l: '1 hour' }]}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[200px] flex-1">
          <Label>Time zone</Label>
          <div className="relative">
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className={`${inputCls} cursor-pointer appearance-none pr-9`}
            >
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="UTC">UTC</option>
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-dim" />
          </div>
        </div>
        <div className="min-w-[200px] flex-1">
          <Label>Budget (optional)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-dim">$</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ''))}
              className={`${inputCls} pl-7`}
            />
            <span className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-[11px] text-faint">total</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Step 2: Location ── */
type Loc = { id: string; name: string; place: string }
type PlanMode = 'vote' | 'itinerary'

// mock place database the search filters over (stands in for geosearch)
const PLACES: Loc[] = [
  { id: 'cavallo', name: 'Cavallo Point Lodge', place: 'Sausalito, CA' },
  { id: 'terrapin', name: 'Terrapin Crossroads', place: 'San Rafael, CA' },
  { id: 'ferry', name: 'Ferry Building Marketplace', place: 'San Francisco, CA' },
  { id: 'exploratorium', name: 'Exploratorium', place: 'San Francisco, CA' },
  { id: 'fortmason', name: 'Fort Mason Center', place: 'San Francisco, CA' },
  { id: 'crissy', name: 'Crissy Field', place: 'San Francisco, CA' },
  { id: 'presidio', name: 'Presidio Tunnel Tops', place: 'San Francisco, CA' },
  { id: 'hmb', name: 'Half Moon Bay Golf Links', place: 'Half Moon Bay, CA' },
]

const PLATFORMS: { name: string; icon: typeof Video }[] = [
  { name: 'Google Meet', icon: Video },
  { name: 'Zoom', icon: Video },
  { name: 'Teams', icon: Video },
  { name: 'Discord', icon: MessagesSquare },
  { name: 'Other', icon: MoreHorizontal },
]

function StepLocation({ locMode, setLocMode }: { locMode: LocMode; setLocMode: (m: LocMode) => void }) {
  const modes: { v: LocMode; l: string; icon: typeof MapPin }[] = [
    { v: 'vote', l: 'In person', icon: MapPin },
    { v: 'remote', l: 'Remote', icon: Video },
    { v: 'later', l: 'Decide later', icon: Clock },
  ]

  const [planMode, setPlanMode] = useState<PlanMode>('vote')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Loc[]>([])
  const [platform, setPlatform] = useState('Google Meet')
  const [link, setLink] = useState('')

  const q = query.trim().toLowerCase()
  const results = q
    ? PLACES.filter((l) => !picked.some((p) => p.id === l.id) && (l.name.toLowerCase().includes(q) || l.place.toLowerCase().includes(q)))
    : []
  const exact = PLACES.some((l) => l.name.toLowerCase() === q) || picked.some((l) => l.name.toLowerCase() === q)

  function add(l: Loc) { setPicked((p) => [...p, l]); setQuery('') }
  function addCustom() {
    const name = query.trim()
    if (!name) return
    add({ id: `custom:${name.toLowerCase()}`, name, place: 'Custom place' })
  }
  function remove(id: string) { setPicked((p) => p.filter((x) => x.id !== id)) }
  function move(i: number, dir: -1 | 1) {
    setPicked((p) => {
      const j = i + dir
      if (j < 0 || j >= p.length) return p
      const a = [...p]
      ;[a[i], a[j]] = [a[j], a[i]]
      return a
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Where will you meet?</Label>
        <div className="flex rounded-[10px] border border-border bg-s2 p-[3px]">
          {modes.map((m) => {
            const on = locMode === m.v
            const Icon = m.icon
            return (
              <button
                key={m.v}
                type="button"
                onClick={() => setLocMode(m.v)}
                className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-[7px] text-[11.5px] font-semibold"
                style={on ? { background: 'var(--s0)', color: 'var(--text)' } : { color: 'var(--dim)' }}
              >
                <Icon size={14} /> {m.l}
              </button>
            )
          })}
        </div>
      </div>

      {locMode === 'vote' && (
        <div className="flex flex-col gap-3">
          {/* decide how the location gets chosen */}
          <div>
            <Label>How is the location decided?</Label>
            <div className="flex rounded-[10px] border border-border bg-s2 p-[3px]">
              {([
                { v: 'vote', l: 'Guests vote', icon: Vote },
                { v: 'itinerary', l: 'Plan a route', icon: Route },
              ] as const).map((m) => {
                const on = planMode === m.v
                const Icon = m.icon
                return (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setPlanMode(m.v)}
                    className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[7px] text-[11.5px] font-semibold"
                    style={on ? { background: 'var(--s0)', color: 'var(--text)' } : { color: 'var(--dim)' }}
                  >
                    <Icon size={13} /> {m.l}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-[11.5px] text-dim">
            {planMode === 'vote' ? (
              <><Vote size={14} /> Guests vote on the places you add — the top pick becomes the venue.</>
            ) : (
              <><Route size={14} /> Order the places you add into a route — stops run 1 → 2 → 3 on the day.</>
            )}
          </p>

          {/* location search */}
          <div className="relative">
            <div className="flex h-[42px] items-center gap-2 rounded-[10px] border border-border bg-s2 px-[13px] focus-within:border-accent-border">
              <Search size={15} className="text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a place to add…"
                className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
              />
            </div>
            {q && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-[10px] border border-border bg-s1 p-1 shadow-soft">
                {results.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => add(l)}
                    className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left hover:bg-s2"
                  >
                    <MapPin size={14} className="text-dim" />
                    <span className="flex-1 text-[12.5px] font-medium">
                      {l.name} <span className="font-normal text-faint">· {l.place}</span>
                    </span>
                    <Plus size={14} className="text-accent-text" />
                  </button>
                ))}
                {!exact && (
                  <button
                    type="button"
                    onClick={addCustom}
                    className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left hover:bg-s2"
                  >
                    <Plus size={14} className="text-accent-text" />
                    <span className="text-[12.5px]">Add “<span className="font-semibold">{query.trim()}</span>” as a place</span>
                  </button>
                )}
                {results.length === 0 && exact && (
                  <div className="px-2.5 py-2 text-[11.5px] text-faint">Already added.</div>
                )}
              </div>
            )}
          </div>

          {/* picked places */}
          {picked.length === 0 ? (
            <div className="flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-[13px] py-[11px]">
              <Info size={14} className="mt-0.5 text-accent-text" />
              <span className="text-[11.5px] leading-[1.5] text-dim">No places yet — search above to add your first one.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-faint">
                  {planMode === 'vote' ? `${picked.length} on the ballot` : `${picked.length} ${picked.length === 1 ? 'stop' : 'stops'}`}
                </span>
                {planMode === 'itinerary' && (
                  <span className="flex items-center gap-1 text-[10.5px] text-faint"><GripVertical size={12} /> Reorder with the arrows</span>
                )}
              </div>
              {picked.map((l, i) => (
                <div key={l.id} className="flex h-11 items-center gap-2.5 rounded-[10px] border border-border bg-s2 pl-2.5 pr-2">
                  {planMode === 'itinerary' ? (
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent text-[11px] font-bold text-on-accent">{i + 1}</span>
                  ) : (
                    <MapPin size={15} className="text-accent-text" />
                  )}
                  <span className="flex-1 truncate text-[12.5px] font-medium">
                    {l.name} <span className="font-normal text-faint">· {l.place}</span>
                  </span>
                  {planMode === 'itinerary' && (
                    <div className="flex flex-none items-center">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-6 w-6 place-items-center rounded-[6px] text-dim enabled:hover:text-text disabled:opacity-30" aria-label="Move up"><ChevronUp size={15} /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1} className="grid h-6 w-6 place-items-center rounded-[6px] text-dim enabled:hover:text-text disabled:opacity-30" aria-label="Move down"><ChevronDown size={15} /></button>
                    </div>
                  )}
                  <button type="button" onClick={() => remove(l.id)} className="grid h-7 w-7 flex-none place-items-center rounded-[7px] text-faint hover:text-brick-text" aria-label="Remove"><X size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {locMode === 'remote' && (
        <div className="flex flex-col gap-3">
          <div>
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = platform === p.name
                const Icon = p.icon
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setPlatform(p.name)}
                    className={`flex h-[34px] items-center gap-1.5 rounded-[9px] px-3 text-[12px] font-semibold ${
                      on ? 'border-[1.5px] border-accent-border bg-accent-bg text-accent-text' : 'border border-border bg-s2 text-dim'
                    }`}
                  >
                    <Icon size={14} /> {p.name}
                  </button>
                )
              })}
            </div>
          </div>
          <Field label="Meeting link (optional)">
            <div className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-s2 px-[13px] focus-within:border-accent-border">
              <Link2 size={15} className="text-accent-text" />
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={`Paste a ${platform} link — or add it later`}
                className="flex-1 bg-transparent font-mono text-[12.5px] outline-none placeholder:text-faint"
              />
            </div>
          </Field>
          <div className="flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-[13px] py-[11px]">
            <Info size={14} className="mt-0.5 text-accent-text" />
            <span className="text-[11.5px] leading-[1.5] text-dim">The link is optional — you can share it now or drop it in later. Guests get it on the event page and in every reminder. The location map stays off for remote events.</span>
          </div>
        </div>
      )}

      {locMode === 'later' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-s2 p-4">
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] border border-ochre-border bg-ochre-bg text-ochre-text"><Clock size={16} /></span>
          <div>
            <div className="mb-0.5 text-[12.5px] font-semibold">Decide the location later</div>
            <div className="text-[11.5px] leading-[1.5] text-dim">Invites still go out now and people can mark availability. The location map stays empty until you or a guest adds the first place to vote on.</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Step 3: Invite ── */
function StepInvite({ invitees, setInvitees }: { invitees: string[]; setInvitees: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Invite by email">
        <div className="flex gap-2">
          <input placeholder="name@company.com" className={inputCls} />
          <button className="h-10 rounded-[10px] bg-accent px-4 text-[12.5px] font-semibold text-on-accent">Add</button>
        </div>
      </Field>
      {invitees.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {invitees.map((id) => (
            <span key={id} className="flex h-[30px] items-center gap-1.5 rounded-full border border-border bg-s2 py-0 pl-1 pr-2.5 text-[12px]">
              <Avatar initials={id} color={av(id).color} size={22} font={8.5} />
              {av(id).name}
              <button onClick={() => setInvitees(invitees.filter((x) => x !== id))} aria-label="Remove">
                <X size={13} className="text-faint hover:text-brick-text" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11.5px] text-faint">No one invited yet — add emails above or just share the link below.</p>
      )}
      <div className="flex items-center gap-3 text-[11px] text-faint">
        <span className="h-px flex-1 bg-border" /> or share a link <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex items-center gap-2 rounded-[10px] border border-border bg-s2 py-0 pl-[13px] pr-2">
        <Link2 size={14} className="text-dim" />
        <span className="flex-1 py-3 font-mono text-[12px] text-dim">aline.app/e/your-event</span>
        <button className="h-[30px] rounded-lg border border-border2 bg-s1 px-3 text-[11.5px] font-semibold">Copy</button>
      </div>
      <Field label="Pull availability from a calendar">
        <div className="flex flex-wrap gap-2.5">
          <button className="flex h-[42px] min-w-[180px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-border2 bg-s1 text-[12.5px] font-semibold hover:border-border2">
            <CalendarPlus size={15} className="text-teal-text" /> Connect Google Calendar
          </button>
          <button className="flex h-[42px] min-w-[180px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-border2 bg-s1 text-[12.5px] font-semibold hover:border-border2">
            <CalendarPlus size={15} className="text-accent-text" /> Connect Outlook
          </button>
        </div>
      </Field>
    </div>
  )
}

/* ── Step 4: Share ── */
function StepShare({ invitees }: { invitees: string[] }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-0 py-1 text-center">
      <span className="mb-1 grid h-12 w-12 place-items-center rounded-full border border-teal-border bg-teal-bg text-teal-text"><Check size={24} /></span>
      <div className="text-[15px] font-semibold">Your event is ready</div>
      <div className="max-w-[420px] text-[12px] leading-[1.5] text-dim">
        Share the link below. Anyone can mark availability, vote on a location, and chat — no account needed.
      </div>
      <div className="mt-3.5 flex h-11 w-full max-w-[440px] items-center gap-2 rounded-[11px] border border-border2 bg-s2 py-0 pl-3.5 pr-2">
        <Link2 size={15} className="text-accent-text" />
        <span className="flex-1 text-left font-mono text-[12.5px]">aline.app/e/your-event</span>
        <button className="h-8 rounded-[9px] bg-accent px-3.5 text-[12px] font-semibold text-on-accent">Copy link</button>
      </div>
      <div className="mt-[18px] flex items-center gap-5">
        <div className="grid h-[104px] w-[104px] place-items-center rounded-xl bg-white p-[9px]">
          <div className="h-full w-full rounded" style={{ backgroundImage: 'repeating-conic-gradient(#1b1b19 0 25%, #fff 0 50%)', backgroundSize: '13px 13px' }} />
        </div>
        <div className="flex flex-col gap-2.5 text-left">
          <div className="text-[12px] font-semibold">Scan to join</div>
          <button className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-[13px] text-[12px] font-semibold">
            <Mail size={14} /> {invitees.length > 0 ? `Email invites to ${invitees.length} people` : 'Email an invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── shared bits ── */
const inputCls =
  'w-full h-10 rounded-[10px] border border-border bg-s2 px-[13px] text-[13px] outline-none placeholder:text-faint focus:border-accent-border'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-[7px] block text-[11.5px] font-semibold text-dim">{children}</label>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>
}
function Segmented({
  value, onChange, options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
}) {
  return (
    <div className="flex rounded-[9px] border border-border bg-s1 p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className="flex h-7 items-center rounded-[7px] px-3 text-[11.5px] font-semibold transition-colors"
          style={value === o.v ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { color: 'var(--dim)' }}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}
