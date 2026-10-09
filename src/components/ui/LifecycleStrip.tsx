'use client'

import { useRef } from 'react'
import { PencilCircle } from './Pencil'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import type { Phase } from '@/lib/events'

// how each phase reads on cards and headers — one badge, strict role colors.
// Labels echo the strip steps (Deciding/RSVP/Soon/Today/Done) so the two never disagree.
export const PHASE_BADGE: Record<Phase, { label: string; variant: 'teal' | 'ochre' | 'brick' | 'accent' | 'neutral' }> = {
  planning: { label: 'Deciding', variant: 'ochre' },
  upcoming: { label: 'RSVPs open', variant: 'teal' },
  soon: { label: 'Coming up', variant: 'teal' },
  today: { label: 'Today', variant: 'accent' },
  past: { label: 'Past', variant: 'neutral' },
}

// the quieter phase cues cards use instead of badge chips: a small status dot and a
// tinted border wash. Past events stay neutral — no border entry means the default.
export const PHASE_TINT: Record<Phase, { dot: string; border?: string }> = {
  planning: { dot: 'var(--ochre)', border: 'var(--ochre-border)' },
  upcoming: { dot: 'var(--teal)', border: 'var(--teal-border)' },
  soon: { dot: 'var(--teal)', border: 'var(--teal-border)' },
  today: { dot: 'var(--accent)', border: 'var(--accent-border)' },
  past: { dot: 'var(--faint)' },
}

// five states of the event, all in one voice. "RSVP" is the stretch the lock-in
// button opens — going/not-going answers coming in — and only starts once BOTH the
// time and the place are answered (a fixed date with a live place vote is still Plan).
// It ends on its own: the host's RSVP deadline or the day before, whichever first.
const STEPS = ['Deciding', 'RSVP', 'Soon', 'Today', 'Done'] as const
const PHASE_STEP: Record<Phase, number> = { planning: 0, upcoming: 1, soon: 2, today: 3, past: 4 }

/* The five stages as five words, the current one circled in pencil: planning on
   paper. No dots and no ticks: the words carry it. Finished stages sit a little
   dimmer than the current one, the ones to come dimmer again. An ordered list, so a
   screen reader hears each step and which one is current (`aria-current="step"`).
   The circle draws itself once (Pencil.tsx), and just sits there with reduced
   motion. `labels` is kept for callers; every stage is always named now. */
/* Only the current stage, circled in pencil the way the stepper circles it: for a
   compact row with no room for all five words */
export function StageWord({ phase, className = '' }: { phase: Phase; className?: string }) {
  const idx = PHASE_STEP[phase]
  return (
    <span className={`flex-none px-1 font-semibold text-text ${className}`}>
      <span className="sr-only">Stage: </span><PencilCircle>{STEPS[idx]}</PencilCircle>
    </span>
  )
}

export function StageStepper({ phase, className = '' }: { phase: Phase; labels?: 'auto' | 'current' | 'all'; className?: string }) {
  const idx = PHASE_STEP[phase]
  return (
    <ol aria-label={`Stage ${idx + 1} of ${STEPS.length}: ${STEPS[idx]}`} className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] sm:gap-x-5 sm:text-[13.5px] ${className}`}>
      {STEPS.map((label, i) => {
        const now = i === idx
        return (
          <li key={label} aria-current={now ? 'step' : undefined} className={now ? 'px-1 font-semibold text-text' : i < idx ? 'text-dim' : 'text-faint'}>
            {now ? <PencilCircle>{label}</PencilCircle> : label}
            {i < idx && <span className="sr-only">, done</span>}
          </li>
        )
      })}
    </ol>
  )
}

// a quiet hint at where the event sits in its life: hairline + dots, only the
// current step labeled. `sm` drops the label entirely for cards.
export function LifecycleStrip({ phase, size = 'md', className = '' }: { phase: Phase; size?: 'sm' | 'md'; className?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const idx = PHASE_STEP[phase]
  const pct = (idx / (STEPS.length - 1)) * 100
  const dot = size === 'sm' ? 5 : 7

  useGSAP(
    () => {
      if (size === 'sm') return
      gsap.fromTo('.ls-fill', { width: '0%' }, { width: `${pct}%`, duration: 0.8, ease: 'power3.out' })
      gsap.fromTo('.ls-dot.is-active', { scale: 0.5 }, { scale: 1, duration: 0.45, ease: 'back.out(2)', delay: 0.25 })
    },
    { scope: root, dependencies: [pct, size] },
  )

  return (
    // read as one picture of where the event is ("Stage 2 of 5: RSVP"); the dots and
    // the labels under them only draw that
    <div ref={root} className={className} role="img" aria-label={`Stage ${idx + 1} of ${STEPS.length}: ${STEPS[idx]}`}>
      <div className="relative flex items-center justify-between" style={{ height: dot }} aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <div
          className="ls-fill absolute top-1/2 h-px -translate-y-1/2"
          style={{ background: 'var(--teal)', width: size === 'sm' ? `${pct}%` : 0 }}
        />
        {STEPS.map((label, i) => {
          const done = i < idx
          const active = i === idx
          return (
            <span
              key={label}
              title={label}
              className={`ls-dot relative z-[1] rounded-full ${active ? 'is-active' : ''}`}
              style={{
                width: dot,
                height: dot,
                background: done ? 'var(--teal)' : active ? 'var(--accent)' : 'var(--border2)',
                boxShadow: active && size === 'md' ? '0 0 0 3px var(--accent-bg)' : undefined,
              }}
            />
          )
        })}
      </div>
      {size === 'md' && (
        <div className="relative mt-1.5 h-[15px]" aria-hidden>
          {/* phones: just the current step; wider screens: every step, current bold —
              the strip teaches the whole process at a glance */}
          <span
            className="absolute top-0 whitespace-nowrap text-[12px] font-semibold sm:hidden"
            style={{
              left: `${pct}%`,
              transform: idx === 0 ? 'none' : idx === STEPS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {STEPS[idx]}
          </span>
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`absolute top-0 hidden whitespace-nowrap text-[11.5px] sm:block ${i === idx ? 'font-semibold text-text' : i < idx ? 'text-dim' : 'text-faint'}`}
              style={{
                left: `${(i / (STEPS.length - 1)) * 100}%`,
                transform: i === 0 ? 'none' : i === STEPS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
