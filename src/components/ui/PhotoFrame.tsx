'use client'

import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '@/lib/prefs'
import { Tape } from './Tape'

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
  className = '',
}: {
  children: React.ReactNode
  tilt?: number
  tape?: 'left' | 'center' | 'right' | 'corner' | false
  size?: 'sm' | 'md'
  settle?: boolean
  // the white border's width, so cards in a group need not all match
  pad?: 'thin' | 'mid' | 'thick'
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const deg = Math.max(-MAX_TILT, Math.min(MAX_TILT, tilt))

  useGSAP(() => {
    if (!settle || reducedMotion() || !root.current) return
    gsap.fromTo(root.current, { rotate: 0, y: 10, opacity: 0 }, { rotate: deg, y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.6)' })
  }, { scope: root, dependencies: [settle, deg] })

  // 'corner' runs across the bottom right corner, for a frame whose top edge is busy
  // (faces peeking over it) and whose button sits at the bottom left
  const tapeAt = tape === 'left' ? 'left-6 -top-2.5' : tape === 'center' ? 'left-1/2 -ml-9 -top-2.5' : tape === 'corner' ? '-right-4 bottom-3' : 'right-8 -top-2.5'
  const tapeTilt = tape === 'corner' ? -42 : tape === 'left' ? -5 : 5
  return (
    <div ref={root} className={`relative ${className}`} style={{ transform: `rotate(${deg}deg)` }}>
      {tape && <Tape className={tapeAt} tilt={tapeTilt} width={size === 'sm' ? 52 : tape === 'corner' ? 56 : 72} />}
      <div className={`bg-frame shadow-frame ${size === 'sm' ? `rounded-[10px] ${pad === 'thin' ? 'p-1 pb-1.5' : pad === 'thick' ? 'p-2.5 pb-3' : 'p-1.5 pb-2'}` : pad === 'thin' ? 'rounded-[12px] p-2 pb-3' : pad === 'thick' ? 'rounded-[16px] p-3.5 pb-4' : 'rounded-[14px] p-2.5 pb-3.5'}`}>
        {children}
      </div>
    </div>
  )
}
