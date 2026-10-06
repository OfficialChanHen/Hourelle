'use client'

import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { reducedMotion } from '@/lib/prefs'
import { liftOff, peelable, type Peel } from '@/animations/deck'
import { PeelEdge } from './PeelEdge'

/* A stack you go through by taking the top thing off, the way you would by hand:
   the current card on top, the next one or two showing behind it as paper. The top
   card has a handle: on a photo stack the next card's edge peeks out on the right
   (the caller draws it in `behind(1)`) and tapping it brings it up; a post-it has an
   up chevron along its bottom. Swipe left or press Right does the same. A photo
   stack shows the motion once when it first appears: the top card lifts and slides
   a little aside, then settles. Taps in
   quick succession are fine: whatever is still coming off hurries away and the
   next card goes a little faster.

   How it comes off depends on what it is (`leave`):
     lift   a photo card: its pins pop out one at a time, its tape peels, its clip
            slides off, then it is lifted and set aside (animations/deck liftOff)
     peel   a post-it: it peels from the bottom up, curling towards you until only
            the glue holds, then comes away (peelable). Dragging the edge upwards
            peels it under your finger; let go early and it lays back down.

   Forward only, and it loops: the pile holds a few cards, so after the last one
   the first comes round again. There is no going back, the same as there is no
   un-peeling a post-it.

   Bounded however long the list is: only the card on top is drawn in full, the
   ones behind are blank paper from `behind(depth)`. The caller owns the index.
   `children` is a function handed the handle (a post-it's chevron) and "2/3", so
   the card sets both inside its own frame and they tilt with it. One card: no
   handle, no count, no paper behind.

   The card coming off is the very node that was on top: React detaches it when the
   index changes, and the stack lifts it into a layer of its own for the animation,
   then drops it. With reduced motion the cards simply swap. */
export function Deck({
  count,
  index,
  onIndex,
  label,
  itemLabel = 'plan',
  leave = 'lift',
  nextAt = 'top-0 bottom-0',
  behind,
  children,
  className = '',
}: {
  count: number
  index: number
  onIndex: (i: number) => void
  label: string
  itemLabel?: string
  leave?: 'lift' | 'peel'
  // where the tap target over the peeking next card runs, top to bottom (lift only)
  nextAt?: string
  behind?: (depth: number) => React.ReactNode
  children: (corner: React.ReactNode, pos: string | null) => React.ReactNode
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const fly = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement | null>(null)
  const prevTop = useRef<HTMLDivElement | null>(null)
  const last = useRef(index)
  // how the next index change should play: on its own, held by a finger, or not at all
  const intent = useRef<'auto' | 'drag' | 'silent'>('auto')
  const peel = useRef<Peel | null>(null)
  const dragged = useRef(false)
  // what is still coming off (a way to hurry each), and when the last one started
  const leaving = useRef<(() => void)[]>([])
  const lastLeave = useRef(0)
  const hinted = useRef(false)
  const hint = useRef<gsap.core.Timeline | null>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const many = count > 1

  const { contextSafe } = useGSAP(() => {
    const moved = index !== last.current
    last.current = index
    const how = intent.current
    intent.current = 'auto'
    if (!moved) {
      // the one hint on a photo stack: the top card lifts and slides a little left,
      // showing the next one, then settles back. Once, when the stack first shows.
      if (leave === 'lift' && many && !hinted.current && top.current && !reducedMotion()) {
        // marked as shown once it starts, not before: a run that is torn down during
        // the delay (React's dev double effects) must not use the hint up
        hint.current = gsap.timeline({ delay: 1.1, onStart: () => { hinted.current = true } })
          .to(top.current, { x: -18, y: -5, rotation: -1.8, duration: 0.35, ease: 'power2.out' })
          .to(top.current, { x: 0, y: 0, rotation: 0, duration: 0.5, ease: 'back.out(1.5)', clearProps: 'transform' })
      }
      return
    }
    hint.current?.kill()
    hint.current = null
    if (how === 'silent') {
      // a peel laid back down: the note is back in place, so drop the copy
      peel.current?.remove()
      peel.current = null
      return
    }
    const card = top.current
    const old = prevTop.current
    if (!card || !old || old === card || !fly.current || reducedMotion()) return
    old.setAttribute('inert', '')
    old.setAttribute('aria-hidden', 'true')
    gsap.set(old, { position: 'absolute', top: 0, left: 0, right: 0 })
    // quick taps: anything still coming off hurries out of the way, and a card taken
    // off hard on the heels of the last one goes a little faster itself
    const now = performance.now()
    const quick = now - lastLeave.current < 700
    lastLeave.current = now
    for (const r of leaving.current) r()
    leaving.current = []
    if (leave === 'peel') {
      // back in the page first, so the note can be measured before it is sliced
      fly.current.prepend(old)
      const p = peelable(old, fly.current)
      if (quick) p.hurry()
      if (how === 'drag') peel.current = p
      else p.finish()
      leaving.current.push(() => p.hurry())
    } else {
      // in front of anything still coming off: what came off first stays on top
      fly.current.prepend(old)
      const tl = liftOff(old).eventCallback('onComplete', () => old.remove())
      if (quick) tl.timeScale(1.7)
      leaving.current.push(() => tl.timeScale(4))
    }
    gsap.fromTo('[data-deck-behind]', { y: 5 }, { y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.04 })
  }, { scope: root, dependencies: [index] })

  const next = () => { if (many) onIndex((index + 1) % count) }

  // the post-it's corner can be pulled: upwards peels it under the finger. The moves
  // are followed on the window, because the corner's own node is let go of by React
  // the moment the peel starts (it becomes the note being peeled).
  const grab = leave === 'peel' && many ? {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      dragged.current = false
      if (reducedMotion() || e.button !== 0) return
      const d = { y: e.clientY, from: index, on: false, h: top.current?.offsetHeight ?? 200 }
      const reach = (y: number) => (d.y - y) / (d.h * 0.75)
      const move = (ev: PointerEvent) => {
        if (!d.on && d.y - ev.clientY > 6) {
          d.on = true
          dragged.current = true
          intent.current = 'drag'
          onIndex((d.from + 1) % count)
        }
        if (d.on) peel.current?.set(reach(ev.clientY))
      }
      const end = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
        const p = peel.current
        if (!d.on || !p) return
        if (ev.type === 'pointerup' && reach(ev.clientY) > 0.35) { peel.current = null; p.finish() }
        else p.cancel(() => { intent.current = 'silent'; onIndex(d.from) })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    },
  } : undefined

  // the handle: a post-it's lifted bottom edge (it peels from the bottom up), a photo
  // card's turned-up corner
  const handleProps = {
    onClick: () => { if (dragged.current) { dragged.current = false; return } next() },
    label: `Next ${itemLabel}, ${((index + 1) % count) + 1} of ${count}`,
  }
  const corner = many && leave === 'peel' ? <PeelEdge {...handleProps} grab={grab} /> : null

  // a photo card: a mouse over the next card's edge lifts the top one a little, the
  // start of the motion that sets it aside
  const preview = contextSafe((on: boolean) => {
    if (!top.current || reducedMotion()) return
    gsap.to(top.current, on ? { x: -10, y: -3, rotation: -1, duration: 0.22, ease: 'power2.out', overwrite: true } : { x: 0, y: 0, rotation: 0, duration: 0.3, ease: 'power2.out', overwrite: true })
  })

  return (
    <div
      ref={root}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={many ? 0 : undefined}
      onKeyDown={(e) => {
        if (many && e.target === e.currentTarget && e.key === 'ArrowRight') { e.preventDefault(); next() }
      }}
      className={`relative rounded-2xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      <div
        className="relative"
        // a sideways swipe takes the top card off; up and down still scroll the page
        style={many ? { touchAction: 'pan-y' } : undefined}
        onPointerDown={(e) => {
          if ((e.target as Element).closest('.peel-edge, .deck-next')) return
          dragged.current = false
          if (many && e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s || dragged.current) return
          const dx = e.clientX - s.x, dy = e.clientY - s.y
          if (dx < -48 && Math.abs(dx) > Math.abs(dy) * 1.5) next()
        }}
        onPointerCancel={() => { swipe.current = null }}
      >
        {many && behind && [2, 1].filter((d) => d < count).map((d) => (
          <div key={d} data-deck-behind aria-hidden className="pointer-events-none absolute inset-0 z-0">{behind(d)}</div>
        ))}
        <div
          key={index}
          ref={(el) => { if (el && el !== top.current) { prevTop.current = top.current; top.current = el } }}
          className="relative z-[1]"
        >
          {children(corner, many ? `${index + 1}/${count}` : null)}
        </div>
        {many && leave === 'lift' && (
          /* the next card's edge peeks out on the right: tapping it brings it up */
          <button
            type="button" onClick={handleProps.onClick} aria-label={handleProps.label} title={handleProps.label}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') preview(true) }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') preview(false) }}
            className={`deck-next absolute -right-6 z-[3] w-11 cursor-pointer rounded-xl outline-offset-2 [-webkit-tap-highlight-color:transparent] ${nextAt}`}
          />
        )}
        {/* the card coming off is moved here, above the pile, and takes no pointer */}
        <div ref={fly} aria-hidden className="pointer-events-none absolute inset-0 z-[5]" />
      </div>
      {many && <span aria-live="polite" className="sr-only">{`${itemLabel[0].toUpperCase()}${itemLabel.slice(1)} ${index + 1} of ${count}`}</span>}
    </div>
  )
}
