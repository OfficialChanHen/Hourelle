'use client'

import { useAccount } from '@/hooks/useAccount'
import { initialsOf } from '@/lib/events'
import { defaultFace } from '@/lib/faces'
import { FaceSvg } from './FaceSvg'

/* Your own face, big, stuck on the page at an angle like a sticker on a desk: the
   one you made on your profile (or the one you were dealt), with its die-cut edge
   and a deeper lift than the small faces. Fills the space beside the post-its on
   Home. Decoration only: no words, nothing to tap, hidden from screen readers.

   The one thing on Home turned more than 3 degrees: it holds no control and sits
   on no decision surface, so the tilt cannot mislead a finger. */
export function FaceSticker({ size, tilt = -7, className = '' }: { size: number; tilt?: number; className?: string }) {
  const account = useAccount()
  const face = account.face ?? defaultFace(initialsOf(account.name), account.color)
  return (
    <div aria-hidden className={`pointer-events-none grid select-none place-items-center ${className}`}>
      <div style={{ transform: `rotate(${tilt}deg)`, filter: 'var(--sticker-lift)' }}>
        <FaceSvg face={face} color={account.color} size={size} />
      </div>
    </div>
  )
}
