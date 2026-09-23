'use client'

import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import * as RPopover from '@radix-ui/react-popover'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

/**
 * Small anchored dropdown for progressive disclosure — tuck secondary settings and controls
 * behind a trigger instead of laying them out inline.
 * `trigger` is a render prop so the caller can reflect the open state (e.g. rotate a chevron);
 * `children` is a render prop handed a `close` so menu items can dismiss the popover.
 *
 * One voice for every dropdown: the panel carries the chrome (surface, hairline,
 * shadow, entrance), and the pieces below carry the inner language — a Title up top,
 * Items as rows, a Sep between groups. Title and Item alone should give the user all
 * the context an action needs; a Note is reserved for confirmations and committal
 * actions (deleting, locking in) where the consequence must be spelled out.
 *
 * ── why this sits on Radix ──
 * It used to be hand-rolled, and the hand-rolled version was quietly inaccessible. The
 * trigger never said it was one: no aria-expanded, no aria-haspopup, no link between it
 * and the thing it opened. Focus never entered the panel when it opened and never came
 * back to the trigger when it closed, so a keyboard left the panel behind and a screen
 * reader was never told anything had happened. Tab walked straight out of an open panel
 * into the page underneath. The panel was a bare div with no role. It rendered inline,
 * so any ancestor with a hidden overflow — the availability grid, for one — could clip
 * it. And it re-derived its own collision maths against window.innerWidth every time.
 *
 * Radix brings all of that and keeps it correct: the aria wiring, focus in and focus
 * back, dismissal on Escape and on an outside press, a portal nothing can clip, and
 * collision handling that flips and shifts the panel to fit. What stays ours is the
 * look, the inner language below, and the entrance.
 */

// z-55: over the tab bar (40) and over the surfaces that take a phone's whole screen
// (the discussion, the places panel, both 50), since a panel opened inside one of
// those has to land on top of it. Under tooltips (60) and the reading sheets (70).
// a phone's bottom bar and the chat button own the last stretch of the screen, so the
// panel is told to treat that as the edge and flip upward rather than open beneath it
const NARROW = '(max-width: 1023px)'
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function Popover({
  trigger, children, align = 'end', width = 240, className,
}: {
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  // a number is a fixed width; 'fit' sizes the panel to what is in it, up to 300
  width?: number | 'fit'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false)
  const panel = useRef<HTMLDivElement>(null)

  // the entrance: a breath of scale and lift from the corner the panel grew out of.
  // Radix decides where it lands and hands back the origin; this only plays it in.
  useGSAP(() => {
    if (!open || !panel.current) return
    gsap.fromTo(panel.current, { opacity: 0, y: -5, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power3.out' })
  }, { dependencies: [open] })

  return (
    <RPopover.Root open={open} onOpenChange={setOpen}>
      <RPopover.Trigger asChild>
        <button type="button" className={className}>{trigger(open)}</button>
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content
          ref={panel}
          align={align}
          sideOffset={6}
          collisionPadding={{ top: 8, right: 8, bottom: narrow ? 92 : 8, left: 8 }}
          className="z-[55] max-w-[calc(100vw-16px)] rounded-[14px] border border-border bg-s1 p-1.5 shadow-soft"
          style={{ width: width === 'fit' ? 'max-content' : width, ...(width === 'fit' ? { maxWidth: 'min(300px, calc(100vw - 16px))' } : {}), transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
        >
          {children(() => setOpen(false))}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
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
