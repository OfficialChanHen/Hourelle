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
  dot = false,
}: {
  children: React.ReactNode
  variant?: Variant
  dot?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold leading-none ${variants[variant]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  )
}
