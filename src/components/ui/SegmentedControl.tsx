'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

type Option = { v: string; l: string; icon?: React.ComponentType<{ size?: number | string }> }

/**
 * Segmented mode switch with a GSAP-driven pill that slides to the active option, so the
 * change reads as motion rather than a snap. Reserve it for prominent 2–3 way mode switches;
 * micro-toggles stay instant. Honors prefers-reduced-motion (pill jumps, no slide).
 */
export function SegmentedControl({ value, onChange, options, size = 'md', stretch = false, className }: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  size?: 'sm' | 'md'
  stretch?: boolean // equal-width segments (fills its container)
  className?: string
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
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
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

  const h = size === 'sm' ? 'h-7' : 'h-[34px]'
  const txt = size === 'sm' ? 'text-[11.5px]' : 'text-[12px]'
  const pad = size === 'sm' ? 'px-3' : 'px-3.5'
  const iconSize = size === 'sm' ? 13 : 14

  return (
    <div ref={wrap} className={`relative flex rounded-[9px] bg-s2 p-0.5 ${className ?? ''}`}>
      <span ref={pill} className="pointer-events-none absolute left-0 top-0 rounded-[7px] bg-s0 shadow-soft" style={{ width: 0, height: 0 }} />
      {options.map((o, i) => {
        const on = o.v === value
        const Icon = o.icon
        return (
          <button
            key={o.v}
            ref={(el) => { btns.current[i] = el }}
            type="button"
            onClick={() => onChange(o.v)}
            className={`relative z-[1] flex items-center justify-center gap-1.5 rounded-[7px] font-semibold transition-colors ${h} ${txt} ${pad} ${stretch ? 'flex-1' : ''} ${on ? 'text-text' : 'text-dim hover:text-text'}`}
          >
            {Icon && <Icon size={iconSize} />}
            {o.l}
          </button>
        )
      })}
    </div>
  )
}
