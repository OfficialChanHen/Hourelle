'use client'

import { createContext, useContext, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import * as RPopover from '@radix-ui/react-popover'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'
import { useNoHover } from '@/hooks/useNoHover'
import { personVar, type PersonColor } from '@/lib/colors'
import { CHROME_TOP, LAYER_Z, layerOf } from '@/lib/layers'

/* A row of faces as one button: a tap turns every face in it over to its initials, one
   after the other, and a second tap turns them back. The faces inside draw both sides
   but have no button of their own (Avatar reads this context), so a row is one thing
   to tap and to name, not six small targets.

   By default the row itself is the button. `overlay` lays the button over the faces
   instead, for a row that also holds things of its own to tap (names that open their
   times): give those `relative z-[2]` and they stay on top of it.

   On a touch screen, while the faces are turned over, a strip of names runs beside the
   row in the same order, each name beside the same initials disc its face has turned
   into. It is one line tall whatever the group's size (more names scroll sideways), so
   it always fits under the faces, or above them (`caption="above"` prefers above, for
   faces peeking over a card), and never has to slide over them. A tap anywhere else
   puts it away and turns the faces back. With a mouse there is no strip: every face
   shows its name on hover. */
type Who = { name: string; initials: string; color?: PersonColor }
const InGroup = createContext(false)

// which edges of a sideways row have more past them, for its fade
function fadeEdges(el: HTMLElement) {
  const start = el.scrollLeft > 4
  const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
  el.dataset.fade = start && end ? 'both' : start ? 'start' : end ? 'end' : 'none'
}
export const useInFlipGroup = () => useContext(InGroup)

export function FlipGroup({ names, people, more = 0, className = '', style, overlay = false, caption: at = 'below', children }: {
  names: string           // who is in the row, for the button's name ("Sam, Ava and 3 more")
  people?: Who[]          // everyone in the row, in order (the ones past a "+N" too), for the card of names
  more?: number           // how many more there are that `people` does not hold
  className?: string
  style?: CSSProperties
  overlay?: boolean
  // where the names go while the faces are turned: under the row, over it (faces that
  // peek over a card, which covers what is below them), or nowhere (names already shown)
  caption?: 'below' | 'above' | false
  children: ReactNode
}) {
  const root = useRef<HTMLElement | null>(null)
  const [flipped, setFlipped] = useState(false)
  // the card's layer, worked out from where the row sits when it is turned
  const [z, setZ] = useState(LAYER_Z.page)
  const { contextSafe } = useGSAP({ scope: root as React.RefObject<HTMLElement> })
  function toggle() {
    const next = !flipped
    setFlipped(next)
    if (next) setZ(LAYER_Z[layerOf(root.current)])
    const turns = root.current?.querySelectorAll('.face-flip')
    if (!turns?.length) return
    contextSafe(() => {
      if (reducedMotion()) gsap.set(turns, { rotateY: next ? 180 : 0 })
      else gsap.to(turns, { rotateY: next ? 180 : 0, duration: 0.55, ease: 'back.out(1.7)', stagger: 0.07, overwrite: true })
    })()
  }
  const label = names ? `Show initials for ${names}` : 'Show initials'
  const touch = useNoHover()
  const showCard = touch && flipped && !!at && !!people?.length
  // the strip names everyone in the row, the ones past the "+N" too (it scrolls, so a
  // long group costs no height); only people the row was never given names for are a count
  const listed = people ?? []
  const rest = more
  const card = (
    <RPopover.Portal>
      <RPopover.Content
        side={at === 'above' ? 'top' : 'bottom'} align="start" sideOffset={8}
        // clear of the header and the phone's tab bar, like every other floating panel
        collisionPadding={{ top: CHROME_TOP, bottom: 92, left: 12, right: 12 }}
        // the strip is read, not used: focus stays on the row
        onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}
        // a tap on the row itself is the row's own toggle, not a tap away
        onPointerDownOutside={(e) => { if (root.current?.contains(e.target as Node)) e.preventDefault() }}
        aria-hidden
        className="max-w-[calc(100vw-24px)] overflow-hidden rounded-full border border-border bg-s1 p-1 shadow-soft"
        style={{ zIndex: z }}
      >
        {/* the names scroll inside the pill; an edge with more past it fades, like the
            create page's template row, so the strip reads as more to see */}
        <div
          ref={(el) => { if (el) requestAnimationFrame(() => fadeEdges(el)) }}
          onScroll={(e) => fadeEdges(e.currentTarget)}
          className="flex gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden data-[fade=end]:[mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)] data-[fade=both]:[mask-image:linear-gradient(to_right,transparent,#000_32px,#000_calc(100%-40px),transparent)] data-[fade=start]:[mask-image:linear-gradient(to_right,transparent,#000_32px)]"
        >
          {listed.map((p, i) => {
            const c = personVar(p.color ?? 'gray')
            return (
              <span key={i} className="flex flex-none items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5">
                <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[9.5px] font-semibold" style={{ background: c.bg, color: c.text }}>{p.initials}</span>
                <span className="max-w-[140px] truncate text-[13px] font-medium text-text">{p.name}</span>
              </span>
            )
          })}
          {rest > 0 && <span className="flex flex-none items-center whitespace-nowrap pl-1 pr-3 text-[12.5px] text-faint">and {rest} more</span>}
        </div>
      </RPopover.Content>
    </RPopover.Portal>
  )
  const onCardChange = (open: boolean) => { if (!open && flipped) toggle() }

  if (overlay) {
    return (
      <InGroup.Provider value={true}>
        <RPopover.Root open={showCard} onOpenChange={onCardChange}>
          <RPopover.Anchor asChild>
            <div ref={(el) => { root.current = el }} className={`relative ${className}`} style={style}>
              {children}
              <button
                type="button" onClick={toggle} aria-pressed={flipped} aria-label={label}
                className="absolute inset-0 z-[1] cursor-pointer rounded-xl [-webkit-tap-highlight-color:transparent]"
              />
            </div>
          </RPopover.Anchor>
          {card}
        </RPopover.Root>
      </InGroup.Provider>
    )
  }
  return (
    <InGroup.Provider value={true}>
      <RPopover.Root open={showCard} onOpenChange={onCardChange}>
        <RPopover.Anchor asChild>
          <button
            ref={(el) => { root.current = el }} type="button" onClick={toggle} aria-pressed={flipped} aria-label={label}
            className={`cursor-pointer rounded-xl p-0 text-left [-webkit-tap-highlight-color:transparent] ${className}`} style={style}
          >
            {children}
          </button>
        </RPopover.Anchor>
        {card}
      </RPopover.Root>
    </InGroup.Provider>
  )
}
