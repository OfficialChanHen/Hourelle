'use client'

import { useEffect, type RefObject } from 'react'

/* ── a surface that is the whole phone screen while it is open ──
   On a phone "the screen" is the visual viewport: the part actually visible above the
   keyboard and between the browser's own bars. The layout viewport that
   position:fixed measures against is taller whenever either is showing, and the
   browser scrolls it to reach a focused field, which is what lifted a fixed sheet and
   showed the page beneath. So the element is pinned to the visual viewport for as
   long as `active` holds, re-pinned on every resize and scroll of it, and the page
   behind is frozen. From lg up it is a drawer or a column in a desktop window and is
   not pinned; `lockWide` still holds the page still there, for a modal.

   Freezing the page on a phone takes more than overflow:hidden on the body, which
   iOS Safari ignores in the two cases that matter. Focusing a field still scrolls the
   document to bring it into view, and a drag on any part of the sheet that cannot
   scroll itself hands the scroll on to the page underneath. Both showed the page
   through the sheet. So on a phone:

     the body is pinned in place (position:fixed at minus the scroll it had), which
     leaves the document nothing to scroll, and put back where it was on close;

     a drag inside the surface is let through only when it lands on something that
     can scroll (the message list, a textarea, a row of chips that runs sideways),
     and is cancelled everywhere else, so a drag on the header or the composer's
     frame goes nowhere instead of into the page.

   Pair it with a band of the surface's own colour past its bottom edge (see the chat
   and the venue sheet): the pin follows the viewport a frame late, and that frame
   should show more surface rather than the page. */

// a drag is the surface's own when something between the finger and the surface can
// scroll in either direction; otherwise it would only ever reach the page
function scrollsWithin(target: EventTarget | null, surface: HTMLElement): boolean {
  let n = target instanceof Element ? target : null
  while (n && n !== surface) {
    if (n instanceof HTMLElement) {
      const st = getComputedStyle(n)
      const y = /(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight
      const x = /(auto|scroll)/.test(st.overflowX) && n.scrollWidth > n.clientWidth
      if (x || y || n instanceof HTMLTextAreaElement) return true
    }
    n = n.parentElement
  }
  return false
}

export function usePhoneScreen(ref: RefObject<HTMLElement | null>, { active = true, lockWide = false } = {}) {
  useEffect(() => {
    const vv = window.visualViewport
    const el = ref.current
    if (!active || !vv || !el) return
    const wide = window.matchMedia('(min-width: 1024px)')
    const b = document.body, html = document.documentElement
    const was = {
      overflow: b.style.overflow, over: b.style.overscrollBehavior, position: b.style.position,
      top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width, htmlOver: html.style.overflow,
    }

    // the phone freeze: the body pinned where it stood, and the scroll it had kept
    let frozenAt: number | null = null
    const freeze = () => {
      if (frozenAt !== null) return
      frozenAt = window.scrollY
      Object.assign(b.style, { position: 'fixed', top: `-${frozenAt}px`, left: '0', right: '0', width: '100%', overflow: 'hidden', overscrollBehavior: 'none' })
      html.style.overflow = 'hidden'
    }
    const thaw = () => {
      if (frozenAt === null) return
      const y = frozenAt
      frozenAt = null
      Object.assign(b.style, { position: was.position, top: was.top, left: was.left, right: was.right, width: was.width, overflow: was.overflow, overscrollBehavior: was.over })
      html.style.overflow = was.htmlOver
      window.scrollTo(0, y)
    }
    // the desktop hold for a modal: the plain one is enough where there is a mouse
    const hold = (on: boolean) => {
      b.style.overflow = on ? 'hidden' : was.overflow
      b.style.overscrollBehavior = on ? 'none' : was.over
    }

    const fit = () => {
      const pin = !wide.matches
      el.style.top = pin ? `${vv.offsetTop}px` : ''
      el.style.height = pin ? `${vv.height}px` : ''
      el.style.bottom = pin ? 'auto' : ''
    }
    const mode = () => {
      if (wide.matches) { thaw(); hold(lockWide) } else { hold(false); freeze() }
      fit()
    }
    const onMove = (e: TouchEvent) => {
      if (!wide.matches && !scrollsWithin(e.target, el)) e.preventDefault()
    }

    mode()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    wide.addEventListener('change', mode)
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => {
      vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); wide.removeEventListener('change', mode)
      el.removeEventListener('touchmove', onMove)
      el.style.top = ''; el.style.height = ''; el.style.bottom = ''
      thaw(); hold(false)
    }
  }, [ref, active, lockWide])
}
