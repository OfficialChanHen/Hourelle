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

   On a touch screen, while the faces are turned over, a small card lists them in the
   same order, each name beside the same initials disc its face has turned into. It
   floats beside the row, never over it: under the faces, or over them when there is
   no room below (`caption="above"` prefers over, for faces peeking over a card). A
   tap anywhere else puts it away and turns the faces back. With a mouse there is no
   card: every face shows its name on hover. */
type Who = { name: string; initials: string; color?: PersonColor }
const InGroup = createContext(false)
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
  // the card names everyone in the row, the ones past the "+N" too, up to a dozen
  const listed = people?.slice(0, 12) ?? []
  const rest = more + (people?.length ?? 0) - listed.length
  const card = (
    <RPopover.Portal>
      <RPopover.Content
        side={at === 'above' ? 'top' : 'bottom'} align="start" sideOffset={8}
        // clear of the header and the phone's tab bar, like every other floating panel
        collisionPadding={{ top: CHROME_TOP, bottom: 92, left: 12, right: 12 }}
        // the card is read, not used: focus stays on the row
        onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}
        // a tap on the row itself is the row's own toggle, not a tap away
        onPointerDownOutside={(e) => { if (root.current?.contains(e.target as Node)) e.preventDefault() }}
        aria-hidden
        className="min-w-[180px] max-w-[min(280px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-border bg-s1 p-1.5 shadow-soft"
        style={{ zIndex: z, maxHeight: 'var(--radix-popover-content-available-height)' }}
      >
        {listed.map((p, i) => {
          const c = personVar(p.color ?? 'gray')
          return (
            <span key={i} className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5">
              <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[9.5px] font-semibold" style={{ background: c.bg, color: c.text }}>{p.initials}</span>
              <span className="min-w-0 truncate text-[13.5px] font-medium text-text">{p.name}</span>
            </span>
          )
        })}
        {rest > 0 && <span className="block px-2 pb-1 pt-0.5 text-[12.5px] text-faint">and {rest} more</span>}
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
