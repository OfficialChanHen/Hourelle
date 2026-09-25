'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

type Option = { v: string; l: string; icon?: React.ComponentType<{ size?: number | string }> }

/**
 * Segmented mode switch with a GSAP-driven pill that slides to the active option, so the
 * change reads as motion rather than a snap. Reserve it for prominent 2–3 way mode switches;
 * micro-toggles stay instant. Honors prefers-reduced-motion (pill jumps, no slide).
 */
export function SegmentedControl({ value, onChange, options, size = 'md', stretch = false, className, label }: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  size?: 'sm' | 'md'
  stretch?: boolean // equal-width segments (fills its container)
  className?: string
  label?: string // names the group for screen readers ("Mode", "Theme")
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const btns = useRef<(HTMLButtonElement | null)[]>([])
  const first = useRef(true)
  const activeIndex = Math.max(0, options.findIndex((o) => o.v === value))

  function position(animate: boolean) {
    const el = btns.current[activeIndex], p = pill.current, w = wrap.current
    if (!el || !p || !w) return
    // fractional rects (not integer offsetLeft) so the pill sits pixel-exact over the button
    const er = el.getBoundingClientRect(), wr = w.getBoundingClientRect()
    const reduce = reducedMotion()
    const to = { x: er.left - wr.left, y: er.top - wr.top, width: er.width, height: er.height }
    if (animate && !reduce) gsap.to(p, { ...to, duration: 0.34, ease: 'power3.out' })
    else gsap.set(p, to)
  }

  // slide on value change; snap on first paint
  useGSAP(() => { position(!first.current); first.current = false }, { dependencies: [value, options.length] })

  // keep the pill aligned when the control resizes (toolbar wraps, container grows)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => position(false))
    ro.observe(el)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // min-height (not fixed) so a segment grows and keeps its padding when the label wraps.
  // Phones get thumb-sized segments; the compact desktop heights return at sm.
  const h = size === 'sm' ? 'min-h-11 sm:min-h-7' : 'min-h-11 sm:min-h-[34px]'
  const txt = size === 'sm' ? 'text-[13px]' : 'text-[13.5px]'
  const pad = size === 'sm' ? 'px-3 py-1' : 'px-3.5 py-1.5'
  const iconSize = size === 'sm' ? 13 : 14

  return (
    <div ref={wrap} role="group" aria-label={label} className={`relative flex rounded-[9px] bg-s2 p-0.5 ${className ?? ''}`}>
      {/* bg-raised, not bg-s0: dark surfaces ascend the other way, and an s0 pill
          there sat below its track — the active chip read as a dent, so a hovered
          neighbor looked more active than the real one */}
      <span ref={pill} className="pointer-events-none absolute left-0 top-0 rounded-[7px] bg-raised shadow-raised" style={{ width: 0, height: 0 }} />
      {options.map((o, i) => {
        const on = o.v === value
        const Icon = o.icon
        return (
          <button
            key={o.v}
            ref={(el) => { btns.current[i] = el }}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.v)}
            className={`relative z-[1] flex items-center justify-center gap-1.5 rounded-[7px] text-center font-semibold leading-tight transition-colors ${h} ${txt} ${pad} ${stretch ? 'flex-1' : ''} ${on ? 'text-text' : 'text-dim hover:text-text'}`}
          >
            {Icon && <Icon size={iconSize} />}
            {o.l}
          </button>
        )
      })}
    </div>
  )
}
