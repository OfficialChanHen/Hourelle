'use client'

import { useRef } from 'react'
import { Check } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import type { Phase } from '@/lib/events'
import { reducedMotion } from '@/lib/prefs'

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

/* The five stages as a stepper, in the one accent colour: dots joined by a line,
   past steps filled and checked, the current one larger with a soft ring, the rest
   muted. An
   ordered list, so a screen reader hears each step and which one is current.
   `labels`: 'auto' names only the current step on a phone and every step from sm
   up; 'current' always names only the current one; 'all' always names them all.
   The current dot pops in when the stage changes; with reduced motion it just sits
   there. */
export function StageStepper({ phase, labels = 'auto', className = '' }: { phase: Phase; labels?: 'auto' | 'current' | 'all'; className?: string }) {
  const root = useRef<HTMLOListElement>(null)
  const idx = PHASE_STEP[phase]
  useGSAP(() => {
    if (reducedMotion()) return
    gsap.fromTo('.ss-now', { scale: 0.5 }, { scale: 1, duration: 0.45, ease: 'back.out(2.2)' })
    gsap.fromTo('.ss-line', { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.out', stagger: 0.06 })
  }, { scope: root, dependencies: [idx] })
  const other = labels === 'all' ? '' : labels === 'current' ? 'sr-only' : 'sr-only sm:not-sr-only'
  return (
    <ol ref={root} aria-label={`Stage ${idx + 1} of ${STEPS.length}: ${STEPS[idx]}`} className={`grid grid-cols-5 ${className}`}>
      {STEPS.map((label, i) => {
        const done = i < idx
        const now = i === idx
        return (
          <li key={label} aria-current={now ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center gap-1.5">
            {/* the line into this step from the one before, filled once it is reached */}
            {i > 0 && (
              <span aria-hidden className={`absolute right-1/2 top-[9px] h-[2px] origin-left rounded-full ${i <= idx ? 'ss-line bg-accent' : 'bg-border2'}`} style={{ marginRight: 11, width: 'calc(100% - 22px)' }} />
            )}
            {/* a 20px slot for every dot, so the line meets each one at its middle */}
            <span aria-hidden className="relative z-[1] grid h-5 w-5 place-items-center">
              <span className={`grid place-items-center rounded-full ${now ? 'ss-now h-5 w-5 bg-accent ring-4 ring-accent-bg' : done ? 'h-4 w-4 bg-accent text-on-accent' : 'h-4 w-4 border-2 border-border2 bg-s1'}`}>
                {done && <Check size={10} strokeWidth={3} />}
              </span>
            </span>
            <span className={`whitespace-nowrap text-[12px] leading-none sm:text-[11.5px] ${now ? 'font-semibold text-text' : `${other} ${done ? 'text-dim' : 'text-faint'}`}`}>
              {label}{done && <span className="sr-only">, done</span>}
            </span>
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
