'use client'

import { useAccount } from '@/hooks/useAccount'
import { initialsOf } from '@/lib/events'
import { defaultFace } from '@/lib/faces'
import { Avatar } from './Avatar'

/* Your own face, big, stuck on the page at an angle like a sticker on a desk: the
   one you made on your profile (or the one you were dealt), with its die-cut edge
   and a deeper lift than the small faces. Fills the space beside the post-its on
   Home. Tap it and it turns over to your initials, like every face that flips.

   The one thing on Home turned more than 3 degrees: the only control it holds is
   itself, and it sits on no decision surface, so the tilt cannot mislead a finger. */
export function FaceSticker({ size, tilt = -7, className = '' }: { size: number; tilt?: number; className?: string }) {
  const account = useAccount()
  const initials = initialsOf(account.name)
  const face = account.face ?? defaultFace(initials, account.color)
  return (
    <div className={`grid select-none place-items-center ${className}`}>
      <div style={{ transform: `rotate(${tilt}deg)`, filter: 'var(--sticker-lift)' }}>
        <Avatar initials={initials} color={account.color} face={face} size={size} label={account.name} flippable />
      </div>
    </div>
  )
}
