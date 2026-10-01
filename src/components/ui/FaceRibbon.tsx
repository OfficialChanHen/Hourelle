import { Avatar } from './Avatar'
import { namesLabel } from './AvatarRow'
import type { Avatar as Person } from '@/lib/people'

/* The group's faces in a gentle wave, each tilted a little like a sticker: the
   plan header's picture of who is in it. Capped like every pile (six, then "+N"),
   so a plan with a hundred people draws seven things. Faces sit side by side, not
   overlapping, and bob up and down a few pixels in a fixed pattern.

   `flippable` makes each face a button that turns over to its initials; the row is
   then a group named for the people in it. For a moment surface only, never a list
   you work through. */
const BOB = [6, 0, 5, 1, 7, 2]
const TILT = [-3, 2, -2, 3, -1, 2]

export function FaceRibbon({
  people,
  size = 36,
  max = 6,
  flippable = false,
  className = '',
}: {
  people: (Person & { id?: string })[]
  size?: number
  max?: number
  flippable?: boolean
  className?: string
}) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  const label = namesLabel(shown.map((p) => p.name), extra)
  return (
    <div
      className={`flex items-start gap-1.5 ${className}`}
      style={{ height: size + 8 }}
      role={label ? (flippable ? 'group' : 'img') : undefined}
      aria-label={label || undefined}
    >
      {shown.map((p, i) => (
        <span key={p.id ?? i} className="flex" style={{ transform: `translateY(${BOB[i % BOB.length]}px)` }}>
          <Avatar
            initials={p.initials} color={p.color} face={p.face} size={size} title={p.name}
            font={Math.round(size * 0.34)} tilt={TILT[i % TILT.length]} flippable={flippable}
          />
        </span>
      ))}
      {extra > 0 && (
        <span
          aria-hidden
          className="grid flex-none place-items-center rounded-full bg-s3 font-semibold text-dim"
          style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.34)), transform: 'translateY(3px)' }}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
