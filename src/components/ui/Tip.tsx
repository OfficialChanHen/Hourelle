'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Theme-aware tooltip for the places a native `title` falls short: it follows the
 * app's tokens in every look and mode (native tooltips are OS-drawn and ignore the
 * theme), and it works on touch — tap toggles it, tap elsewhere dismisses it, and
 * the tap never falls through to a parent card link. Fixed-positioned, so cards
 * with overflow-hidden can't clip it; flips below the trigger near the top edge.
 */
// w-fit keeps the bubble centered over the visible words, not a full-width row;
// max-w-full still lets inner `truncate` spans clip inside narrow cards
export function Tip({ text, children, className = 'block w-fit max-w-full' }: { text: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null)
  const wrap = useRef<HTMLSpanElement>(null)
  const touched = useRef(false) // the last pointer on us was a finger, not a mouse

  function show() {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    const below = r.top < 64
    setPos({
      // clamp the center so the bubble (max 260px wide) stays on-screen
      x: Math.min(Math.max(r.left + r.width / 2, 138), window.innerWidth - 138),
      y: below ? r.bottom + 6 : r.top - 6,
      below,
    })
    setOpen(true)
  }
  const hide = () => setOpen(false)

  // dismiss on tap-away, Escape, or scroll (a fixed bubble would drift while scrolling)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) hide() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
    }
  }, [open])

  return (
    <span
      ref={wrap}
      className={className}
      onMouseEnter={() => { if (!touched.current) show() }}
      onMouseLeave={() => { if (!touched.current) hide() }}
      onPointerDown={(e) => { touched.current = e.pointerType === 'touch' }}
      onClick={(e) => {
        // a finger has no hover: the tap belongs to the tooltip, not the card behind it
        if (!touched.current) return
        e.preventDefault()
        e.stopPropagation()
        if (open) hide()
        else show()
      }}
    >
      {children}
      {/* portal to <body>: position:fixed anchors to a transformed ancestor (Swiper
          slides, GSAP-moved panels), so the bubble must escape the subtree entirely */}
      {open && pos && createPortal(
        <span
          role="tooltip"
          className={`pointer-events-none fixed z-[60] max-w-[260px] -translate-x-1/2 rounded-[9px] border border-border2 bg-s1 px-2.5 py-1.5 text-[12px] font-medium leading-[1.45] text-text shadow-soft ${pos.below ? '' : '-translate-y-full'}`}
          style={{ left: pos.x, top: pos.y }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  )
}
