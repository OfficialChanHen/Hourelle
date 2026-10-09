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
   times): give those `relative z-[2]` and they stay on top of it. */
const InGroup = createContext(false)
export const useInFlipGroup = () => useContext(InGroup)

export function FlipGroup({ names, className = '', style, overlay = false, children }: {
  names: string           // who is in the row, for the button's name ("Sam, Ava and 3 more")
  className?: string
  style?: CSSProperties
  overlay?: boolean
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
  if (overlay) {
    return (
      <InGroup.Provider value={true}>
        <div ref={(el) => { root.current = el }} className={`relative ${className}`} style={style}>
          {children}
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
        className={`cursor-pointer rounded-xl p-0 text-left [-webkit-tap-highlight-color:transparent] ${className}`} style={style}
      >
        {children}
      </button>
    </InGroup.Provider>
  )
}
