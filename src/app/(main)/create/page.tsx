'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check, Calendar, ChevronDown, Link2, Search, Plus, X, MapPin, Video, Clock,
  CalendarPlus, Info, Vote, ArrowLeft, ArrowRight, Mail,
} from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { av } from '@/lib/people'

const STEPS = ['Basics', 'Invite', 'Location', 'Share'] as const
type LocMode = 'vote' | 'remote' | 'later'

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [hostMode, setHostMode] = useState<'you' | 'org'>('org')
  const [locMode, setLocMode] = useState<LocMode>('vote')
  const [invitees, setInvitees] = useState<string[]>(['SR', 'AT', 'KL', 'PR', 'MN', 'CL'])
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
              <span className="text-[12px] font-semibold" style={{ color: i >= step ? undefined : 'var(--text)' }}>
                <span style={{ color: i > step ? 'var(--faint)' : 'var(--text)' }}>{label}</span>
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
        {step === 1 && <StepInvite invitees={invitees} setInvitees={setInvitees} />}
        {step === 2 && <StepLocation locMode={locMode} setLocMode={setLocMode} />}
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
  return (
    <div className="flex flex-col gap-4">
      <Field label="Event title">
        <input defaultValue="Q3 Team Offsite Planning" className={inputCls} />
      </Field>
      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[200px] flex-1">
          <Label>Hosted by</Label>
          <div className="flex rounded-[10px] border border-border bg-s2 p-[3px]">
            {(['you', 'org'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setHostMode(m)}
                className="flex h-8 flex-1 items-center justify-center rounded-[7px] text-[12px] font-semibold"
                style={hostMode === m ? { background: 'var(--s0)', color: 'var(--text)' } : { color: 'var(--dim)' }}
              >
                {m === 'you' ? 'You' : 'Organization'}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-[200px] flex-1">
          <Label>Organization name</Label>
          <input defaultValue="Acme Engineering Org" className={inputCls} />
        </div>
      </div>
      <Field label="Description">
        <textarea
          defaultValue="Two days of strategy, workshops, and a team dinner to align on Q3 goals."
          className={`${inputCls} h-[72px] resize-none py-[11px] leading-[1.5]`}
        />
      </Field>
      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[140px] flex-1">
          <Label>Date window</Label>
          <Faux><Calendar size={14} className="text-dim" /> Jun 30 – Jul 4</Faux>
        </div>
        <div className="min-w-[140px] flex-1">
          <Label>Time zone</Label>
          <Faux between>Pacific Time (PDT) <ChevronDown size={15} className="text-dim" /></Faux>
        </div>
        <div className="min-w-[140px] flex-1">
          <Label>Budget (optional)</Label>
          <Faux><span className="text-dim">$</span>4,200<span className="ml-auto text-[11px] text-faint">total</span></Faux>
        </div>
      </div>
    </div>
  )
}

/* ── Step 2: Invite ── */
function StepInvite({ invitees, setInvitees }: { invitees: string[]; setInvitees: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Invite by email">
        <div className="flex gap-2">
          <input placeholder="name@company.com" className={inputCls} />
          <button className="h-10 rounded-[10px] bg-accent px-4 text-[12.5px] font-semibold text-on-accent">Add</button>
        </div>
      </Field>
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
      <div className="flex items-center gap-3 text-[11px] text-faint">
        <span className="h-px flex-1 bg-border" /> or share a link <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex items-center gap-2 rounded-[10px] border border-border bg-s2 py-0 pl-[13px] pr-2">
        <Link2 size={14} className="text-dim" />
        <span className="flex-1 py-3 font-mono text-[12px] text-dim">gatherly.app/e/q3-offsite</span>
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

/* ── Step 3: Location ── */
function StepLocation({ locMode, setLocMode }: { locMode: LocMode; setLocMode: (m: LocMode) => void }) {
  const modes: { v: LocMode; l: string; icon: typeof MapPin }[] = [
    { v: 'vote', l: 'In person', icon: MapPin },
    { v: 'remote', l: 'Remote', icon: Video },
    { v: 'later', l: 'Decide later', icon: Clock },
  ]
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
        <div className="flex flex-col gap-2.5">
          <p className="flex items-center gap-1.5 text-[11.5px] text-dim">
            <Vote size={14} /> Add candidate places — guests vote, and the top pick becomes the venue.
          </p>
          {[
            { name: 'Cavallo Point Lodge', place: 'Sausalito, CA', color: '#3E6B54' },
            { name: 'Terrapin Crossroads', place: 'San Rafael, CA', color: '#2E4A3C' },
          ].map((l) => (
            <div key={l.name} className="flex h-11 items-center gap-2.5 rounded-[10px] border border-border bg-s2 py-0 pl-[13px] pr-2">
              <MapPin size={15} style={{ color: l.color }} />
              <span className="flex-1 text-[12.5px] font-medium">
                {l.name} <span className="font-normal text-faint">· {l.place}</span>
              </span>
              <button className="grid h-7 w-7 place-items-center rounded-[7px] text-faint hover:text-brick-text"><X size={15} /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <div className="flex h-[42px] flex-1 items-center gap-2 rounded-[10px] border border-dashed border-border2 px-[13px]">
              <Search size={14} className="text-faint" />
              <span className="text-[12.5px] text-faint">Search to add another place…</span>
            </div>
            <button className="flex h-[42px] items-center gap-1.5 rounded-[10px] bg-accent px-[15px] text-[12.5px] font-semibold text-on-accent"><Plus size={15} /> Add</button>
          </div>
        </div>
      )}

      {locMode === 'remote' && (
        <div className="flex flex-col gap-3">
          <Field label="Meeting link">
            <Faux><Video size={15} className="text-accent-text" /> <span className="font-mono text-[12.5px]">meet.google.com/q3-offsite</span></Faux>
          </Field>
          <div>
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              <span className="flex h-[34px] items-center gap-1.5 rounded-[9px] border-[1.5px] border-accent-border bg-accent-bg px-3 text-[12px] font-semibold text-accent-text"><Video size={14} /> Google Meet</span>
              <span className="flex h-[34px] items-center rounded-[9px] border border-border bg-s2 px-3 text-[12px] font-semibold text-dim">Zoom</span>
              <span className="flex h-[34px] items-center rounded-[9px] border border-border bg-s2 px-3 text-[12px] font-semibold text-dim">Teams</span>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-[10px] border border-border bg-s2 px-[13px] py-[11px]">
            <Info size={14} className="mt-0.5 text-accent-text" />
            <span className="text-[11.5px] leading-[1.5] text-dim">Guests get the link on the event page and in every reminder. The location map stays off for remote events.</span>
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
        <span className="flex-1 text-left font-mono text-[12.5px]">gatherly.app/e/q3-offsite</span>
        <button className="h-8 rounded-[9px] bg-accent px-3.5 text-[12px] font-semibold text-on-accent">Copy link</button>
      </div>
      <div className="mt-[18px] flex items-center gap-5">
        <div className="grid h-[104px] w-[104px] place-items-center rounded-xl bg-white p-[9px]">
          <div className="h-full w-full rounded" style={{ backgroundImage: 'repeating-conic-gradient(#1b1b19 0 25%, #fff 0 50%)', backgroundSize: '13px 13px' }} />
        </div>
        <div className="flex flex-col gap-2.5 text-left">
          <div className="text-[12px] font-semibold">Scan to join</div>
          <button className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-border2 bg-s1 px-[13px] text-[12px] font-semibold">
            <Mail size={14} /> Email invites to {invitees.length} people
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
function Faux({ children, between }: { children: React.ReactNode; between?: boolean }) {
  return (
    <div className={`flex h-10 items-center gap-2 rounded-[10px] border border-border bg-s2 px-[13px] text-[13px] ${between ? 'justify-between' : ''}`}>
      {children}
    </div>
  )
}
