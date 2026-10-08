'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'
import { Tape } from './Tape'
import { useWide } from '@/hooks/useWide'

/* A photo on the page: a cover (or anything picture-like) inside a white border
   (--frame, a lifted card on charcoal), with an optional strip of tape and a small
   tilt. For moments only: covers, the Home Up next card, empty states. Never around
   a grid, a map, a list of people or anything you tap to answer.

   The tilt is capped at 3 degrees either way so nothing inside drifts far from where
   it looks. `settle` lets the frame land on mount, from straight to its tilt; with
   reduced motion it simply sits there. */
const MAX_TILT = 3

export function PhotoFrame({
  children,
  tilt = -1.5,
  tape = 'right',
  size = 'md',
  settle = false,
  pad = 'mid',
  onClick,
  className = '',
}: {
  children: React.ReactNode
  tilt?: number
  tape?: 'left' | 'center' | 'right' | 'corners' | false
  size?: 'sm' | 'md'
  settle?: boolean
  // the white border's width, so cards in a group need not all match
  pad?: 'thin' | 'mid' | 'thick'
  onClick?: React.MouseEventHandler<HTMLDivElement>
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  // the frame hangs from its tape, so the tape decides the way it turns and `tilt`
  // only says how far: a strip at the top left lets the right side drop (clockwise),
  // one at the top right lets the left side drop, and a strip in the middle or a pair
  // across opposite corners holds it straight. With no tape, `tilt` is used as given.
  const turn = tape === 'left' ? Math.abs(tilt) : tape === 'right' ? -Math.abs(tilt) : tape === 'center' || tape === 'corners' ? 0 : tilt
  // and only on a wide screen: on a phone every frame lies straight
  const wide = useWide()
  const deg = wide ? Math.max(-MAX_TILT, Math.min(MAX_TILT, turn)) : 0

  useGSAP(() => {
    if (!settle || reducedMotion() || !root.current) return
    gsap.fromTo(root.current, { rotate: 0, y: 10, opacity: 0 }, { rotate: deg, y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.6)' })
  }, { scope: root, dependencies: [settle, deg] })

  // 'corners' is a pair across opposite corners, top left and bottom right: never the
  // bottom one alone, which could not hold a card up
  const tapeAt = tape === 'left' ? 'left-6 -top-2.5' : tape === 'center' ? 'left-1/2 -ml-9 -top-2.5' : 'right-8 -top-2.5'
  const tapeTilt = tape === 'left' ? -5 : 5
  return (
    <div ref={root} onClick={onClick} className={`relative ${onClick ? 'cursor-pointer' : ''} ${className}`} style={{ transform: `rotate(${deg}deg)` }}>
      {tape === 'corners' ? (
        <>
          <Tape className="-left-4 top-3" tilt={-42} width={56} />
          <Tape className="-right-4 bottom-3" tilt={-42} width={56} />
        </>
      ) : tape && <Tape className={tapeAt} tilt={tapeTilt} width={size === 'sm' ? 52 : 72} />}
      <div className={`bg-frame shadow-frame ${size === 'sm' ? `rounded-[10px] ${pad === 'thin' ? 'p-1 pb-1.5' : pad === 'thick' ? 'p-2.5 pb-3' : 'p-1.5 pb-2'}` : pad === 'thin' ? 'rounded-[12px] p-2 pb-3' : pad === 'thick' ? 'rounded-[16px] p-3.5 pb-4' : 'rounded-[14px] p-2.5 pb-3.5'}`}>
        {children}
      </div>
    </div>
  )
}
