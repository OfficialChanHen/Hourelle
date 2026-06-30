import { personColors, type PersonColor } from '@/lib/colors'

const sizes = {
  sm: 'h-[22px] w-[22px] text-[9px]',
  md: 'h-[26px] w-[26px] text-[9.5px]',
  lg: 'h-[35px] w-[35px] text-[12px]',
} as const

export function Avatar({
  initials,
  color = 'stone',
  size = 'md',
  ring = false,
  title,
}: {
  initials: string
  color?: PersonColor
  size?: keyof typeof sizes
  ring?: boolean
  title?: string
}) {
  const c = personColors[color] ?? personColors.stone
  return (
    <span
      title={title}
      style={{ background: c.bg, color: c.text }}
      className={`${sizes[size]} inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none select-none ${
        ring ? 'ring-2 ring-[--color-s1]' : ''
      }`}
    >
      {initials}
    </span>
  )
}
