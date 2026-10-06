import { Avatar } from './Avatar'
import type { Avatar as Person } from '@/lib/people'

/* A pile of faces, overlapping, capped. The cap is the point: a guest list is
   allowed to be long, and a row that grows with it would break the card it sits in
   and cost a DOM node per person. Past `max`, the rest become one "+N" chip.

   Each face is a sticker with its own die-cut edge (FaceSvg), so the next one in the
   pile sits on top of it like a sticker on a sticker, whatever is behind the pile.

   To a screen reader the pile is one image named for the people in it ("Jane Miller,
   Alex Tan and 3 more"). `decorative` hides it instead, for piles whose meaning is
   already carried by text beside them, like the count in a grid cell.

   `flippable` turns each face into a button that shows the initials on its back.
   The pile is then a group of named buttons rather than one image. Never inside a
   link or a button. */

// "Jane", "Jane and Alex", "Jane, Alex and Sam", "Jane, Alex and 3 more"
export function namesLabel(names: string[], extra = 0): string {
  const parts = extra > 0 ? [...names, `${extra} more`] : names
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function AvatarRow({
  people,
  size = 21,
  max = 6,
  overlap = 6,
  more,
  font,
  decorative = false,
  flippable = false,
}: {
  people: Person[]
  size?: number
  max?: number
  overlap?: number
  more?: string
  font?: number
  decorative?: boolean
  flippable?: boolean
}) {
  const shown = people.slice(0, max)
  const extra = more ?? (people.length > max ? `+${people.length - max}` : '')
  const extraCount = more != null ? parseInt(more.replace(/[^\d]/g, ''), 10) || 0 : Math.max(0, people.length - max)
  const label = namesLabel(shown.map((p) => p.name), extraCount)
  return (
    <div
      className="flex items-center"
      role={decorative || !label ? undefined : flippable ? 'group' : 'img'}
      aria-label={decorative || !label ? undefined : label}
      aria-hidden={decorative || !label ? true : undefined}
    >
      {shown.map((p, i) => (
        <span key={i} className="flex" style={{ marginRight: i === shown.length - 1 && !extra ? 0 : -overlap }}>
          <Avatar
            initials={p.initials} color={p.color} face={p.face} size={size} font={font} title={p.name} flippable={flippable && !decorative}
          />
        </span>
      ))}
      {extra && (
        <span
          // the same sticker as a face: a disc the size of the drawn face, with its edge
          style={{ width: size * 40 / 44, height: size * 40 / 44, margin: size / 22, boxShadow: `0 0 0 ${size / 20}px var(--face-edge)`, filter: 'var(--face-lift)', fontSize: font ?? Math.round(size * 0.4 * 10) / 10 }}
          className="inline-flex flex-none items-center justify-center rounded-full bg-s3 font-semibold text-dim"
          aria-hidden
        >
          {extra}
        </span>
      )}
    </div>
  )
}
