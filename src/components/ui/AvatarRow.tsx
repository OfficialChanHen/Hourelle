import { Avatar } from './Avatar'
import type { Avatar as Person } from '@/lib/people'

/* A pile of faces, overlapping, capped. The cap is the point: a guest list is
   allowed to be long, and a row that grows with it would break the card it sits in
   and cost a DOM node per person. Past `max`, the rest become one "+N" chip.

   `ringColor` has to match the surface behind the pile (the page, a card, a hero),
   because the ring is what cuts each face out of the one beneath it. */
export function AvatarRow({
  people,
  size = 21,
  max = 6,
  overlap = 6,
  more,
  font,
  ringColor = 'var(--s1)',
}: {
  people: Person[]
  size?: number
  max?: number
  overlap?: number
  more?: string
  font?: number
  ringColor?: string
}) {
  const shown = people.slice(0, max)
  const extra = more ?? (people.length > max ? `+${people.length - max}` : '')
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={i} style={{ marginRight: i === shown.length - 1 && !extra ? 0 : -overlap }}>
          <Avatar initials={p.initials} color={p.color} size={size} font={font} ring ringColor={ringColor} title={p.name} />
        </span>
      ))}
      {extra && (
        <span
          style={{ width: size, height: size, fontSize: font ?? Math.round(size * 0.4 * 10) / 10, border: `2px solid ${ringColor}` }}
          className="inline-flex items-center justify-center rounded-full bg-s3 font-semibold text-dim"
        >
          {extra}
        </span>
      )}
    </div>
  )
}
