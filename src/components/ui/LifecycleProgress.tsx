'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

export type Stage = 'planning' | 'availability' | 'location' | 'confirmed' | 'complete'

const STAGES: { key: Stage; label: string }[] = [
  { key: 'planning', label: 'Invitations' },
  { key: 'availability', label: 'Availability' },
  { key: 'location', label: 'Location' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'complete', label: 'Complete' },
]

export function LifecycleProgress({ currentStage }: { currentStage: Stage }) {
  const root = useRef<HTMLDivElement>(null)
  const idx = STAGES.findIndex((s) => s.key === currentStage)
  const pct = STAGES.length > 1 ? (idx / (STAGES.length - 1)) * 100 : 0

  useGSAP(
    () => {
      gsap.fromTo(
        '.lc-fill',
        { width: '0%' },
        { width: `${pct}%`, duration: 0.9, ease: 'power3.out' },
      )
      gsap.fromTo(
        '.lc-dot.is-done',
        { scale: 0.4, opacity: 0.2 },
        { scale: 1, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(2)', delay: 0.15 },
      )
    },
    { scope: root, dependencies: [pct] },
  )

  return (
    <div ref={root} className="w-full">
      <div className="relative mx-1 mb-3 h-0.5 bg-border">
        <div className="lc-fill absolute inset-y-0 left-0 bg-accent" style={{ width: 0 }} />
        <div className="absolute inset-0 flex items-center justify-between">
          {STAGES.map((s, i) => {
            const done = i <= idx
            return (
              <span
                key={s.key}
                className={`lc-dot ${done ? 'is-done' : ''} h-2.5 w-2.5 rounded-full border-2 ${
                  done ? 'border-accent bg-accent' : 'border-border bg-s1'
                }`}
              />
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-between">
        {STAGES.map((s, i) => (
          <span
            key={s.key}
            className={`text-[10px] font-semibold tracking-[.04em] ${
              i === idx ? 'text-accent-text' : i < idx ? 'text-dim' : 'text-faint'
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
