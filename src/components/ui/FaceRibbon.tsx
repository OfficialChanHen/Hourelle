import { Avatar } from './Avatar'
import { namesLabel } from './AvatarRow'
import { FlipGroup } from './FlipGroup'
import type { Avatar as Person } from '@/lib/people'
import { useWide } from '@/hooks/useWide'

/* The group's faces in a gentle wave, each tilted a little like a sticker: the
   plan header's picture of who is in it. Capped like every pile (six, then "+N"),
   so a plan with a hundred people draws seven things. Faces sit side by side, not
   overlapping, and bob up and down a few pixels in a fixed pattern.

   `flippable` makes the whole ribbon one button that turns every face over to its
   initials in order (FlipGroup). For a moment surface only, never a list
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
  // the faces sit at small angles on a wide screen; straight on a phone
  const wide = useWide()
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  const label = namesLabel(shown.map((p) => p.name), extra)
  const faces = <>
      {shown.map((p, i) => (
        <span key={p.id ?? i} className="flex" style={{ transform: `translateY(${BOB[i % BOB.length]}px)` }}>
          <Avatar
            initials={p.initials} color={p.color} face={p.face} size={size} title={p.name}
            font={Math.round(size * 0.34)} tilt={wide ? TILT[i % TILT.length] : 0} flippable={flippable}
          />
        </span>
      ))}
      {extra > 0 && (
        <span
          aria-hidden
          className="grid flex-none place-items-center rounded-full bg-s3 font-semibold text-dim"
          style={{ width: size * 40 / 44, height: size * 40 / 44, margin: size / 22, boxShadow: `0 0 0 ${size / 20}px var(--face-edge)`, filter: 'var(--face-lift)', fontSize: Math.max(12, Math.round(size * 0.34)), transform: 'translateY(3px)' }}
        >
          +{extra}
        </span>
      )}
  </>
  // flippable: the whole ribbon is one button that turns every face over in order
  if (flippable) {
    return <FlipGroup names={label} className={`flex items-start gap-1.5 ${className}`} style={{ height: size + 8 }}>{faces}</FlipGroup>
  }
  return (
    <div
      className={`flex items-start gap-1.5 ${className}`}
      style={{ height: size + 8 }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
    >
      {faces}
    </div>
  )
}
