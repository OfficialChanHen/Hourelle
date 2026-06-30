import { Avatar } from './Avatar'
import type { PersonColor } from '@/lib/colors'

export type Person = { initials: string; color: PersonColor; name?: string }

export function AvatarRow({
  people,
  size = 'sm',
  max = 6,
}: {
  people: Person[]
  size?: 'sm' | 'md' | 'lg'
  max?: number
}) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  const overlap = size === 'lg' ? '-ml-2.5' : '-ml-2'
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={i} className={i === 0 ? '' : overlap}>
          <Avatar initials={p.initials} color={p.color} size={size} ring title={p.name} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className={`${overlap} inline-flex h-[22px] items-center justify-center rounded-full border border-border bg-s2 px-1.5 text-[10px] font-semibold text-dim ring-2 ring-[--color-s1]`}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
