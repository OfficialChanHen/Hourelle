import { Avatar } from './Avatar'
import type { Avatar as Person } from '@/lib/people'

/* A pile of faces, overlapping, capped. The cap is the point: a guest list is
   allowed to be long, and a row that grows with it would break the card it sits in
   and cost a DOM node per person. Past `max`, the rest become one "+N" chip.

   `ringColor` has to match the surface behind the pile (the page, a card, a hero),
   because the ring is what cuts each face out of the one beneath it.

   To a screen reader the pile is one image named for the people in it ("Jane Miller,
   Alex Tan and 3 more"). `decorative` hides it instead, for piles whose meaning is
   already carried by text beside them, like the count in a grid cell. */

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
  ringColor = 'var(--s1)',
  decorative = false,
}: {
  people: Person[]
  size?: number
  max?: number
  overlap?: number
  more?: string
  font?: number
  ringColor?: string
  decorative?: boolean
}) {
  const shown = people.slice(0, max)
  const extra = more ?? (people.length > max ? `+${people.length - max}` : '')
  const extraCount = more != null ? parseInt(more.replace(/[^\d]/g, ''), 10) || 0 : Math.max(0, people.length - max)
  const label = namesLabel(shown.map((p) => p.name), extraCount)
  return (
    <div
      className="flex items-center"
      role={decorative || !label ? undefined : 'img'}
      aria-label={decorative || !label ? undefined : label}
      aria-hidden={decorative || !label ? true : undefined}
    >
      {shown.map((p, i) => (
        <span key={i} style={{ marginRight: i === shown.length - 1 && !extra ? 0 : -overlap }}>
          <Avatar initials={p.initials} color={p.color} size={size} font={font} ring ringColor={ringColor} title={p.name} />
        </span>
      ))}
      {extra && (
        <span
          style={{ width: size, height: size, fontSize: font ?? Math.round(size * 0.4 * 10) / 10, border: `2px solid ${ringColor}` }}
          className="inline-flex items-center justify-center rounded-full bg-s3 font-semibold text-dim"
          aria-hidden
        >
          {extra}
        </span>
      )}
    </div>
  )
}
