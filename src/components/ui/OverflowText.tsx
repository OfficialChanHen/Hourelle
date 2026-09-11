'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

/* ── one line of text that may be longer than its box ──
   Instead of cutting it with an ellipsis: on a pointer device, hovering slides the
   line to its end and back so the whole thing can be read; on a touch screen the
   line can be dragged sideways by hand. A soft fade on the right edge says there
   is more, on both. Measures itself, so it costs nothing when the text fits. */
export function OverflowText({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const line = useRef<HTMLSpanElement>(null)
  const [hidden, setHidden] = useState(0) // px past the right edge
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setHidden(Math.max(0, el.scrollWidth - el.clientWidth)))
    ro.observe(el)
    if (line.current) ro.observe(line.current)
    return () => ro.disconnect()
  }, [])
  // the hover slide lives inside the GSAP hook so its tweens belong to this box's
  // context and are cleaned up with it
  useGSAP(() => {
    const el = box.current, ln = line.current
    if (!el || !ln) return
    const slide = () => { if (hidden > 0) gsap.to(ln, { x: -hidden, duration: Math.max(0.5, hidden / 70), ease: 'none', overwrite: true }) }
    const back = () => { gsap.to(ln, { x: 0, duration: 0.35, ease: 'power2.out', overwrite: true }) }
    el.addEventListener('mouseenter', slide)
    el.addEventListener('mouseleave', back)
    return () => { el.removeEventListener('mouseenter', slide); el.removeEventListener('mouseleave', back) }
  }, { scope: box, dependencies: [hidden] })
  return (
    <span
      ref={box}
      title={title}
      className={`scroll-none block min-w-0 overflow-x-auto whitespace-nowrap ${className}`}
      style={hidden ? { maskImage: 'linear-gradient(90deg, #000 calc(100% - 22px), transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 calc(100% - 22px), transparent)' } : undefined}
    >
      <span ref={line} className="inline-block">{children}</span>
    </span>
  )
}
