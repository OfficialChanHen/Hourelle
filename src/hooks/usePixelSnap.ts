import { useEffect, type RefObject } from 'react'

/* Nudges every [data-pixel-snap] element inside `root` onto whole device pixels.
   Text above a grid often leaves it at a fractional offset (a card at 540.25px),
   and a small face drawn there has its 1.5px edge split across pixel rows, so
   it blurs. The nudge is under one device pixel, so nothing visibly moves.

   It re-measures after every render, when the root resizes (anything above it can
   shift it), and after a scroll inside it settles. The work is one read and one
   write per marked element, and grids only mark their capped face piles. */
export function usePixelSnap(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    let frame = 0
    const snap = () => {
      frame = 0
      const marked = el.querySelectorAll<HTMLElement>('[data-pixel-snap]')
      const d = window.devicePixelRatio || 1
      // clear first, so each element is measured where the layout put it
      marked.forEach((m) => { m.style.translate = '' })
      const rects = Array.from(marked, (m) => m.getBoundingClientRect())
      marked.forEach((m, i) => {
        const r = rects[i]
        const x = Math.round(r.left * d) / d - r.left
        const y = Math.round(r.top * d) / d - r.top
        if (Math.abs(x) > 0.01 || Math.abs(y) > 0.01) m.style.translate = `${x}px ${y}px`
      })
    }
    const queue = () => { if (!frame) frame = requestAnimationFrame(snap) }
    queue()
    const ro = new ResizeObserver(queue)
    ro.observe(el)
    ro.observe(document.body)
    el.addEventListener('scroll', queue, { passive: true, capture: true })
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      el.removeEventListener('scroll', queue, { capture: true })
    }
  })
}
