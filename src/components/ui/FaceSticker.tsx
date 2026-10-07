'use client'

import { useAccount } from '@/hooks/useAccount'
import { initialsOf } from '@/lib/events'
import { defaultFace } from '@/lib/faces'
import { Avatar } from './Avatar'

/* Your own face, big, stuck on the page at an angle like a sticker on a desk: the
   one you made on your profile (or the one you were dealt), with its die-cut edge
   and a deeper lift than the small faces. Fills the space beside the post-its on
   Home. Tap it and it turns over to your initials, like every face that flips;
   `flippable={false}` where it sits inside a link (the blank template).

   The one thing on Home turned more than 3 degrees: the only control it holds is
   itself, and it sits on no decision surface, so the tilt cannot mislead a finger. */
export function FaceSticker({ size, tilt = -7, flippable = true, className = '' }: { size: number; tilt?: number; flippable?: boolean; className?: string }) {
  const account = useAccount()
  const initials = initialsOf(account.name)
  const face = account.face ?? defaultFace(initials, account.color)
  return (
    <div aria-hidden={flippable ? undefined : true} className={`grid select-none place-items-center ${flippable ? '' : 'pointer-events-none'} ${className}`}>
      <div style={{ transform: `rotate(${tilt}deg)`, filter: 'var(--sticker-lift)' }}>
        <Avatar initials={initials} color={account.color} face={face} size={size} label={flippable ? account.name : undefined} flippable={flippable} />
      </div>
    </div>
  )
}
