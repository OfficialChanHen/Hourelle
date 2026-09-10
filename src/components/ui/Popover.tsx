'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

/**
 * Small anchored dropdown for progressive disclosure — tuck secondary settings and controls
 * behind a trigger instead of laying them out inline. Closes on outside-click and Escape.
 * `trigger` is a render prop so the caller can reflect the open state (e.g. rotate a chevron);
 * `children` is a render prop handed a `close` so menu items can dismiss the popover.
 * The panel clamps itself inside the viewport, so it never bleeds off-screen no matter
 * where its trigger ends up after the toolbar wraps.
 *
 * One voice for every dropdown: the panel carries the chrome (surface, hairline,
 * shadow, entrance), and the pieces below carry the inner language — a Title up top,
 * Items as rows, a Sep between groups. Title and Item alone should give the user all
 * the context an action needs; a Note is reserved for confirmations and committal
 * actions (deleting, locking in) where the consequence must be spelled out.
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

  // keep the panel on-screen: measure once per open and nudge it back inside the viewport.
  // The nudge lives on `left`, NOT transform — GSAP animates transform for the entrance
  // and would stomp a transform-based clamp.
  useLayoutEffect(() => {
    const el = panel.current
    if (!open || !el) return
    el.style.left = ''
    el.style.right = align === 'end' ? '0' : ''
    const r = el.getBoundingClientRect()
    const pad = 8
    const dx = r.left < pad ? pad - r.left : r.right > window.innerWidth - pad ? window.innerWidth - pad - r.right : 0
    if (dx) {
      el.style.left = `${el.offsetLeft + dx}px`
      el.style.right = 'auto'
    }
  }, [open, align])

  // the entrance: a breath of scale and lift from the trigger's corner — enough to
  // feel physical, quick enough to never be waited on
  useGSAP(() => {
    if (!open || !panel.current) return
    gsap.fromTo(
      panel.current,
      { opacity: 0, y: -5, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power3.out' },
    )
  }, { dependencies: [open] })

  return (
    <div ref={wrap} className={`relative ${className ?? ''}`}>
      <button type="button" onClick={() => setOpen((o) => !o)}>{trigger(open)}</button>
      {open && (
        <div
          ref={panel}
          className={`absolute top-full z-30 mt-1.5 max-w-[calc(100vw-16px)] rounded-[14px] border border-border bg-s1 p-1.5 shadow-soft ${align === 'end' ? 'right-0' : 'left-0'}`}
          style={{ width, transformOrigin: align === 'end' ? 'top right' : 'top left' }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

/* ── the shared inner language ── */

// where the menu says what it is: an eyebrow, optionally a stronger line under it.
// Hairline below separates the naming from the doing.
export function PopoverTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-1 border-b border-border px-2.5 pb-2 pt-1.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-faint">{children}</div>
      {sub && <div className="mt-0.5 text-[13.5px] font-semibold text-text">{sub}</div>}
    </div>
  )
}

// one actionable row: icon in the quiet color, label carrying the meaning.
// `tone="brick"` is for the exits (remove, sign out); `href` renders a Link.
export function PopoverItem({ icon, children, onClick, href, tone = 'default', disabled, trailing }: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  href?: string
  tone?: 'default' | 'brick' | 'accent'
  disabled?: boolean
  trailing?: ReactNode
}) {
  const toneCls = tone === 'brick'
    ? 'text-brick-text hover:bg-brick-bg/50'
    : tone === 'accent'
      ? 'text-accent-text hover:bg-accent-bg/60'
      : 'text-text hover:bg-s2'
  const cls = `flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-left text-[13px] font-medium transition-colors sm:py-2 ${toneCls} ${disabled ? 'pointer-events-none opacity-45' : ''}`
  const inner = (
    <>
      {icon && <span className={`flex-none ${tone === 'default' ? 'text-dim' : ''}`}>{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing && <span className="flex-none text-[12px] text-faint">{trailing}</span>}
    </>
  )
  if (href) return <Link href={href} onClick={onClick} className={cls}>{inner}</Link>
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{inner}</button>
}

// the pause between groups of rows
export function PopoverSep() {
  return <div className="mx-1 my-1 h-px bg-border" />
}

// the quiet print — reserved for confirmations and committal actions (deletion,
// lock-in) where the consequence needs saying. Everyday menus don't get captions.
export function PopoverNote({ children }: { children: ReactNode }) {
  return <p className="px-2.5 py-1.5 text-[12px] leading-[1.55] text-faint">{children}</p>
}
