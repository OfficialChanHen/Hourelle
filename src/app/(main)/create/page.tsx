'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import type { PersonColor } from '@/lib/colors'

const STEPS = ['Basics', 'Invite', 'Share'] as const
type Invitee = { email: string; color: PersonColor; initials: string }

const palette: PersonColor[] = ['clay', 'plum', 'sky', 'rose', 'wheat', 'fern', 'stone', 'sage']

export default function CreatePage() {
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [start, setStart] = useState('2026-07-18')
  const [end, setEnd] = useState('2026-07-20')
  const [granularity, setGranularity] = useState('30 min')
  const [invitees, setInvitees] = useState<Invitee[]>([
    { email: 'avery@team.co', color: 'clay', initials: 'A' },
    { email: 'priya@team.co', color: 'plum', initials: 'P' },
  ])
  const [draft, setDraft] = useState('')

  const panel = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      gsap.fromTo(panel.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' })
    },
    { dependencies: [step] },
  )

  const slug = (title || 'your-event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const shareUrl = `aline.app/e/${slug}`

  function addInvitee() {
    const email = draft.trim()
    if (!email) return
    setInvitees((v) => [
      ...v,
      { email, color: palette[v.length % palette.length], initials: email[0]?.toUpperCase() ?? '?' },
    ])
    setDraft('')
  }

  const canNext = step === 0 ? title.trim().length > 0 : true

  return (
    <div className="mx-auto max-w-[760px] px-6 pb-24 pt-8 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">New event</p>
          <h1 className="mt-1 font-serif text-[36px] leading-tight tracking-[-0.01em]">Set up your event</h1>
        </div>
        <Link href="/home" className="text-[13px] font-semibold text-dim hover:text-text">Cancel</Link>
      </div>

      {/* step indicator — filled accent box for the active step */}
      <div className="mt-7 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                i === step
                  ? 'border-accent-border bg-accent text-on-accent'
                  : i < step
                  ? 'border-border bg-s1 text-text'
                  : 'border-border bg-s1 text-faint'
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  i === step ? 'bg-on-accent/20 text-on-accent' : i < step ? 'bg-accent text-on-accent' : 'bg-s2 text-faint'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </span>
              <span className="text-[13px] font-semibold">{s}</span>
            </button>
          </div>
        ))}
      </div>

      <div ref={panel} className="mt-6 rounded-2xl border border-border bg-s1 p-6 shadow-soft md:p-8">
        {step === 0 && (
          <div className="space-y-6">
            <Field label="Event name" hint="The headline everyone sees first.">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summer Team Offsite"
                className="w-full rounded-xl border border-border bg-s0 px-4 py-3 font-serif text-[22px] tracking-[-0.01em] outline-none placeholder:text-faint focus:border-accent-border"
              />
            </Field>
            <Field label="Description" hint="Optional — a sentence of context.">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Two days of planning, food, and a hike."
                className="w-full resize-none rounded-xl border border-border bg-s0 px-4 py-3 text-[14px] outline-none placeholder:text-faint focus:border-accent-border"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Earliest date">
                <DateInput value={start} onChange={setStart} />
              </Field>
              <Field label="Latest date">
                <DateInput value={end} onChange={setEnd} />
              </Field>
            </div>
            <Field label="Time granularity" hint="How finely people pick availability.">
              <Segmented options={['15 min', '30 min', '1 hr']} value={granularity} onChange={setGranularity} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <Field label="Invite by email" hint="They'll get a link to mark availability — no account needed.">
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInvitee())}
                  placeholder="name@team.co"
                  className="w-full rounded-xl border border-border bg-s0 px-4 py-3 text-[14px] outline-none placeholder:text-faint focus:border-accent-border"
                />
                <button
                  type="button"
                  onClick={addInvitee}
                  className="shrink-0 rounded-xl bg-accent px-4 text-[13px] font-semibold text-on-accent transition-transform hover:-translate-y-px"
                >
                  Add
                </button>
              </div>
            </Field>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">Invited · {invitees.length}</p>
                <Badge variant="neutral">Guests allowed</Badge>
              </div>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {invitees.map((inv, i) => (
                  <li key={i} className="flex items-center gap-3 bg-s0 px-4 py-3">
                    <Avatar initials={inv.initials} color={inv.color} size="md" />
                    <span className="text-[14px]">{inv.email}</span>
                    <button
                      type="button"
                      onClick={() => setInvitees((v) => v.filter((_, j) => j !== i))}
                      className="ml-auto text-[12px] font-semibold text-faint hover:text-brick-text"
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {invitees.length === 0 && (
                  <li className="bg-s0 px-4 py-6 text-center text-[13px] text-faint">No one invited yet — that's fine, share a link instead.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-accent-border bg-accent-bg p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-on-accent">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                <p className="font-serif text-[22px] tracking-[-0.01em] text-accent-text">You&apos;re all set</p>
              </div>
              <p className="mt-2 text-[13.5px] text-accent-text/80">
                <span className="font-semibold">{title || 'Your event'}</span> is ready. Share this link — anyone with it can join as a guest.
              </p>
            </div>

            <Field label="Share link">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-s0 px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-faint"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
                <span className="font-mono text-[13px] text-text">{shareUrl}</span>
                <button type="button" className="ml-auto rounded-lg border border-border bg-s1 px-3 py-1.5 text-[12px] font-semibold text-dim hover:text-text">Copy</button>
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Summary label="When" value={`${start} → ${end}`} />
              <Summary label="Granularity" value={granularity} />
              <Summary label="Invited" value={`${invitees.length} people`} />
              <Summary label="Status" value="Planning → Availability" />
            </div>
          </div>
        )}
      </div>

      {/* footer nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold text-dim enabled:hover:text-text disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => canNext && setStep((s) => s + 1)}
            disabled={!canNext}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-on-accent shadow-soft transition-transform enabled:hover:-translate-y-px disabled:opacity-40"
          >
            Continue
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        ) : (
          <Link
            href="/events/weekend-offsite?tab=availability"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-on-accent shadow-soft transition-transform hover:-translate-y-px"
          >
            Open event
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[.13em] text-faint">{label}</span>
      {hint && <span className="mt-0.5 block text-[12.5px] text-dim">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-border bg-s0 px-4 py-3 text-[14px] outline-none focus:border-accent-border"
    />
  )
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-s2 p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-md px-4 py-1.5 text-[13px] font-semibold transition-colors ${
            value === o ? 'bg-accent text-on-accent' : 'text-dim hover:text-text'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-s0 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-faint">{label}</p>
      <p className="mt-1 text-[14px] font-medium">{value}</p>
    </div>
  )
}
