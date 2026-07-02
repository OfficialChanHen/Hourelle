import { personColors, type PersonColor } from '@/lib/colors'

// px sizes so avatars match the reference exactly at any context
export function Avatar({
  initials,
  color = 'gray',
  size = 26,
  font,
  ring = false,
  ringColor = 'var(--s1)',
  title,
}: {
  initials: string
  color?: PersonColor
  size?: number
  font?: number
  ring?: boolean
  ringColor?: string
  title?: string
}) {
  const c = personColors[color] ?? personColors.gray
  return (
    <span
      title={title}
      style={{
        background: c.bg,
        color: c.text,
        width: size,
        height: size,
        fontSize: font ?? Math.round(size * 0.36 * 10) / 10,
        border: ring ? `2px solid ${ringColor}` : undefined,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none select-none"
    >
      {initials}
    </span>
  )
}
