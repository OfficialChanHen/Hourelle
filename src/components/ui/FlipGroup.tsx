'use client'

import { createContext, useContext, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'

/* A row of faces as one button: a tap turns every face in it over to its initials, one
   after the other, and a second tap turns them back. The faces inside draw both sides
   but have no button of their own (Avatar reads this context), so a row is one thing
   to tap and to name, not six small targets.

   By default the row itself is the button. `overlay` lays the button over the faces
   instead, for a row that also holds things of its own to tap (names that open their
   times): give those `relative z-[2]` and they stay on top of it.

   While the faces are turned over, their names sit in a line under the row, in the
   same order, so each set of initials can be matched to a name. */
const InGroup = createContext(false)
export const useInFlipGroup = () => useContext(InGroup)

export function FlipGroup({ names, className = '', style, overlay = false, caption: at = 'below', children }: {
  names: string           // who is in the row, for the button's name ("Sam, Ava and 3 more")
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
  const { contextSafe } = useGSAP({ scope: root as React.RefObject<HTMLElement> })
  function toggle() {
    const next = !flipped
    setFlipped(next)
    const turns = root.current?.querySelectorAll('.face-flip')
    if (!turns?.length) return
    contextSafe(() => {
      if (reducedMotion()) gsap.set(turns, { rotateY: next ? 180 : 0 })
      else gsap.to(turns, { rotateY: next ? 180 : 0, duration: 0.55, ease: 'back.out(1.7)', stagger: 0.07, overwrite: true })
    })()
  }
  const label = names ? `Show initials for ${names}` : 'Show initials'
  // a row placed by its caller (absolute, sticky) is already a frame for the caption
  const placed = /(^|\s)(absolute|fixed|sticky|relative)(\s|$)/.test(className)
  const caption = flipped && names && at && (
    <span aria-hidden className={`pointer-events-none absolute left-0 z-30 ${at === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} w-max max-w-[min(320px,80vw)] rounded-[12px] border border-border2 bg-s1 px-2.5 py-1 text-[12px] font-semibold leading-[1.45] text-text shadow-soft`}>
      {names.charAt(0).toUpperCase() + names.slice(1)}
    </span>
  )
  if (overlay) {
    return (
      <InGroup.Provider value={true}>
        <div ref={(el) => { root.current = el }} className={`relative ${className}`} style={style}>
          {children}
          {caption}
          <button
            type="button" onClick={toggle} aria-pressed={flipped} aria-label={label}
            className="absolute inset-0 z-[1] cursor-pointer rounded-xl [-webkit-tap-highlight-color:transparent]"
          />
        </div>
      </InGroup.Provider>
    )
  }
  return (
    <InGroup.Provider value={true}>
      <button
        ref={(el) => { root.current = el }} type="button" onClick={toggle} aria-pressed={flipped} aria-label={label}
        className={`cursor-pointer rounded-xl p-0 text-left [-webkit-tap-highlight-color:transparent] ${placed ? '' : 'relative'} ${className}`} style={style}
      >
        {children}
        {caption}
      </button>
    </InGroup.Provider>
  )
}
