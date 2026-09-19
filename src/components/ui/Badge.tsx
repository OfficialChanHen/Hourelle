import type { LucideIcon } from 'lucide-react'

/* The one badge. Soft fill, matching text, hairline border, all from the role's own
   tokens, so light and dark and every appearance follow without a second thought.

   The variant is a MEANING, not a colour. Pick it by what the badge is saying and
   the palette takes care of itself:
     teal     confirmed, going, full attendance
     ochre    planning, partial, caution, arriving late
     brick    absent, conflict, declined, danger
     accent   selected, interactive, a date that is close
     neutral  a state with no weight to it */
type Variant = 'teal' | 'ochre' | 'brick' | 'accent' | 'neutral'

const variants: Record<Variant, string> = {
  teal: 'bg-teal-bg text-teal-text border-teal-border',
  ochre: 'bg-ochre-bg text-ochre-text border-ochre-border',
  brick: 'bg-brick-bg text-brick-text border-brick-border',
  accent: 'bg-accent-bg text-accent-text border-accent-border',
  neutral: 'bg-s2 text-dim border-border',
}

export function Badge({
  children,
  variant = 'neutral',
  icon: Icon,
}: {
  children: React.ReactNode
  variant?: Variant
  icon?: LucideIcon
}) {
  return (
    <span
      className={`inline-flex h-[21px] items-center gap-1 rounded-md border px-2 text-[12px] font-semibold leading-none ${variants[variant]}`}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}
