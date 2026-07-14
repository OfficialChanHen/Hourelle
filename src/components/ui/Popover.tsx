'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Small anchored dropdown for progressive disclosure — tuck secondary settings and controls
 * behind a trigger instead of laying them out inline. Closes on outside-click and Escape.
 * `trigger` is a render prop so the caller can reflect the open state (e.g. rotate a chevron);
 * `children` is a render prop handed a `close` so menu items can dismiss the popover.
 * The panel clamps itself inside the viewport, so it never bleeds off-screen no matter
 * where its trigger ends up after the toolbar wraps.
 */
export function Popover({
  trigger, children, align = 'end', width = 240, className,
}: {
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  width?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  // keep the panel on-screen: measure once per open and nudge it back inside the viewport
  // (styles the node directly — pure positioning, no re-render needed)
  useLayoutEffect(() => {
    const el = panel.current
    if (!open || !el) return
    el.style.transform = ''
    const r = el.getBoundingClientRect()
    const pad = 8
    const dx = r.left < pad ? pad - r.left : r.right > window.innerWidth - pad ? window.innerWidth - pad - r.right : 0
    if (dx) el.style.transform = `translateX(${dx}px)`
  }, [open])

  return (
    <div ref={wrap} className={`relative ${className ?? ''}`}>
      <button type="button" onClick={() => setOpen((o) => !o)}>{trigger(open)}</button>
      {open && (
        <div
          ref={panel}
          className={`absolute top-full z-30 mt-1.5 max-w-[calc(100vw-16px)] rounded-[13px] border border-border bg-s1 p-2.5 shadow-soft ${align === 'end' ? 'right-0' : 'left-0'}`}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
