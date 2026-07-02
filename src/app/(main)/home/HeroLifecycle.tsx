'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { heroLifecycle, heroCurrentIdx } from '@/lib/home'

export function HeroLifecycle() {
  const root = useRef<HTMLDivElement>(null)
  const pct = (heroCurrentIdx / (heroLifecycle.length - 1)) * 100

  useGSAP(
    () => {
      gsap.fromTo('.hl-fill', { width: '0%' }, { width: `${pct}%`, duration: 0.9, ease: 'power3.out' })
      gsap.fromTo('.hl-dot.is-active', { scale: 0.5 }, { scale: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.3 })
    },
    { scope: root },
  )

  return (
    <div ref={root} className="relative flex justify-between px-1 pt-0.5">
      <div className="absolute left-3.5 right-3.5 top-[7px] h-0.5 bg-border" />
      <div className="hl-fill absolute left-3.5 top-[7px] h-0.5 bg-teal" style={{ width: 0 }} />
      {heroLifecycle.map((label, i) => {
        const done = i < heroCurrentIdx
        const active = i === heroCurrentIdx
        return (
          <div key={label} className="relative z-[1] flex flex-col items-center gap-[7px]">
            <span
              className={`hl-dot h-[11px] w-[11px] rounded-full ${active ? 'is-active' : ''}`}
              style={{
                background: done ? 'var(--teal)' : active ? 'var(--accent)' : 'var(--border2)',
                boxShadow: active ? '0 0 0 4px var(--accent-bg)' : undefined,
              }}
            />
            <span
              className="text-[11px]"
              style={{
                fontWeight: active ? 600 : 400,
                color: i <= heroCurrentIdx ? 'var(--text)' : 'var(--faint)',
              }}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
