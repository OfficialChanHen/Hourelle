'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import type { Phase } from '@/lib/events'

// how each phase reads on cards and headers — one badge, strict role colors
export const PHASE_BADGE: Record<Phase, { label: string; variant: 'teal' | 'ochre' | 'brick' | 'accent' | 'neutral' }> = {
  planning: { label: 'Planning', variant: 'ochre' },
  upcoming: { label: 'Confirmed', variant: 'teal' },
  soon: { label: 'Confirmed', variant: 'teal' },
  today: { label: 'Today', variant: 'accent' },
  past: { label: 'Past', variant: 'neutral' },
}

const STEPS = ['Plan', 'Lock in', 'Remind', 'Event', 'Done'] as const
const PHASE_STEP: Record<Phase, number> = { planning: 0, upcoming: 1, soon: 2, today: 3, past: 4 }

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
    <div ref={root} className={className}>
      <div className="relative flex items-center justify-between" style={{ height: dot }}>
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
        <div className="relative mt-1.5 h-[15px]">
          <span
            className="absolute top-0 whitespace-nowrap text-[12px] font-semibold"
            style={{
              left: `${pct}%`,
              transform: idx === 0 ? 'none' : idx === STEPS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {STEPS[idx]}
          </span>
        </div>
      )}
    </div>
  )
}
