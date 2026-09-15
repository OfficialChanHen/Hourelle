import { Avatar } from './Avatar'
import type { Avatar as Person } from '@/lib/people'

// Overlapping avatar pile — matches the reference (2px surface ring, -Npx overlap, +N chip)
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
