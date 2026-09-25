'use client'

import { useEffect, type RefObject } from 'react'

/* ── keeping the keyboard inside a modal while it is open ──
   On open, focus moves into the surface: to `initial` when one is given, else the first
   thing that takes Tab, else the surface itself. A field the surface already focused
   on its own (autoFocus) is left where it is. Tab and Shift+Tab then wrap inside it,
   and on close focus goes back to whatever had it before, when that is still on the
   page and nothing else has taken focus in the meantime.

   Only the newest open trap acts, so a confirm opened over a sheet owns the keys until
   it closes. Focus sitting somewhere outside the surface that is not the page itself
   (a popover portaled to the body, the tour card) is left alone: those keep their own
   order. Every move is made with preventScroll, so a phone sheet pinned to the visual
   viewport (usePhoneScreen) is never nudged by the browser reaching for a control.

   `media` limits the trap to a screen size, for a panel that is a modal sheet on a
   phone and a plain column on a desktop. */

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]',
  '[contenteditable]:not([contenteditable="false"])', '[tabindex]',
].join(',')

export function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.tabIndex < 0 || el.closest('[inert]')) return false
    // display:none on the element or anything above it leaves it no boxes at all
    if (!el.getClientRects().length) return false
    return getComputedStyle(el).visibility !== 'hidden'
  })
}

// the open traps, newest last
const stack: HTMLElement[] = []

// what last lost focus and when: a surface that autofocuses a field has already taken
// focus by the time the trap starts, so this is how it finds what to hand focus back to
let lastLeft: { el: HTMLElement; at: number } | null = null
if (typeof document !== 'undefined') {
  document.addEventListener('focusout', (e) => {
    if (e.target instanceof HTMLElement) lastLeft = { el: e.target, at: Date.now() }
  }, true)
}

const put = (el: HTMLElement) => el.focus({ preventScroll: true })

function engage(el: HTMLElement, initial: RefObject<HTMLElement | null> | 'first' | 'container') {
  const was = document.activeElement
  let back: HTMLElement | null = null
  if (was instanceof HTMLElement && was !== document.body && !el.contains(was)) back = was
  else if (was && el.contains(was) && lastLeft && !el.contains(lastLeft.el) && Date.now() - lastLeft.at < 1000) back = lastLeft.el

  // the surface itself can hold focus, so there is always somewhere to land
  const addedTabIndex = !el.hasAttribute('tabindex')
  if (addedTabIndex) el.setAttribute('tabindex', '-1')
  el.setAttribute('data-focus-root', '')
  stack.push(el)

  if (!el.contains(document.activeElement)) {
    const target = initial === 'container' ? null : initial === 'first' ? tabbablesIn(el)[0] : initial.current
    put(target ?? el)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.defaultPrevented || stack[stack.length - 1] !== el) return
    const cur = document.activeElement
    const inside = !!cur && el.contains(cur)
    if (!inside && cur && cur !== document.body) return
    const list = tabbablesIn(el)
    const go = (to: HTMLElement) => { e.preventDefault(); put(to) }
    if (!list.length) { go(el); return }
    const first = list[0], last = list[list.length - 1]
    if (!inside || !cur) { go(e.shiftKey ? last : first); return }
    const at = list.indexOf(cur as HTMLElement)
    if (at >= 0) {
      // the browser walks the middle itself (radio groups and all); only the ends wrap
      if (e.shiftKey && at === 0) go(last)
      else if (!e.shiftKey && at === list.length - 1) go(first)
      return
    }
    // the surface itself, or something inside it that Tab would skip: go on from there
    const follows = (n: HTMLElement) => !!(cur.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)
    const next = e.shiftKey ? [...list].reverse().find((n) => !follows(n)) : list.find(follows)
    go(next ?? (e.shiftKey ? last : first))
  }
  document.addEventListener('keydown', onKey)

  return () => {
    document.removeEventListener('keydown', onKey)
    const i = stack.lastIndexOf(el)
    if (i >= 0) stack.splice(i, 1)
    if (addedTabIndex) el.removeAttribute('tabindex')
    el.removeAttribute('data-focus-root')
    // hand focus back only while it is still ours to hand: in the closing surface, or
    // dropped to the page because what held it was removed with the surface
    const now = document.activeElement
    if (back && back.isConnected && (!now || now === document.body || el.contains(now))) put(back)
  }
}

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  { active = true, initial = 'first', media }: {
    active?: boolean
    initial?: RefObject<HTMLElement | null> | 'first' | 'container'
    media?: string
  } = {},
) {
  useEffect(() => {
    const el = ref.current
    if (!active || !el) return
    if (!media) return engage(el, initial)
    const mq = window.matchMedia(media)
    let off = mq.matches ? engage(el, initial) : null
    const change = () => {
      if (mq.matches && !off) off = engage(el, initial)
      else if (!mq.matches && off) { off(); off = null }
    }
    mq.addEventListener('change', change)
    return () => { mq.removeEventListener('change', change); off?.() }
    // `initial` is read once, when the trap starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, active, media])
}
