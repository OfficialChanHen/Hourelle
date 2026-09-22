'use client'

import { useEffect, type RefObject } from 'react'

/* ── a surface that is the whole phone screen while it is open ──
   On a phone "the screen" is the visual viewport: the part actually visible above the
   keyboard and between the browser's own bars. The layout viewport that
   position:fixed measures against is taller whenever either is showing, and the
   browser scrolls it to reach a focused field, which is what lifted a fixed sheet and
   showed the page beneath. So the element is pinned to the visual viewport for as
   long as `active` holds, re-pinned on every resize and scroll of it, and the page
   behind stops scrolling. From lg up it is a drawer or a column in a desktop window
   and is not pinned; `lockWide` still holds the page still there, for a modal.

   Pair it with a band of the surface's own colour past its bottom edge (see the chat
   and the venue sheet): the pin follows the viewport a frame late, and that frame
   should show more surface rather than the page. */
export function usePhoneScreen(ref: RefObject<HTMLElement | null>, { active = true, lockWide = false } = {}) {
  useEffect(() => {
    const vv = window.visualViewport
    const el = ref.current
    if (!active || !vv || !el) return
    const wide = window.matchMedia('(min-width: 1024px)')
    // the page behind does not scroll while the surface is up, which on a phone is
    // what let a tap near the edge slide the whole app about
    const b = document.body
    const was = { overflow: b.style.overflow, over: b.style.overscrollBehavior }
    const fit = () => {
      const pin = !wide.matches
      el.style.top = pin ? `${vv.offsetTop}px` : ''
      el.style.height = pin ? `${vv.height}px` : ''
      el.style.bottom = pin ? 'auto' : ''
      const lock = pin || lockWide
      b.style.overflow = lock ? 'hidden' : was.overflow
      b.style.overscrollBehavior = lock ? 'none' : was.over
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    wide.addEventListener('change', fit)
    return () => {
      vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); wide.removeEventListener('change', fit)
      el.style.top = ''; el.style.height = ''; el.style.bottom = ''
      b.style.overflow = was.overflow; b.style.overscrollBehavior = was.over
    }
  }, [ref, active, lockWide])
}
