import Link from 'next/link'
import { Plus, type LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  secondary,
  compact = false,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: { label: string; href: string }
  // a quieter second way out (e.g. the demo shelf), under the primary button
  secondary?: { label: string; href: string }
  compact?: boolean
}) {
  return (
    <div
      className={`grid place-items-center rounded-[14px] border border-dashed border-border2 bg-s1 px-6 text-center ${
        compact ? 'py-10' : 'py-14'
      }`}
    >
      <div>
        <span className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-[11px] border border-border bg-s2 text-dim">
          <Icon size={22} />
        </span>
        <p className="font-serif text-[24.5px] tracking-[-0.01em]">{title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-[1.5] text-dim">{body}</p>
        {action && (
          <Link
            href={action.href}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent"
          >
            <Plus size={17} /> {action.label}
          </Link>
        )}
        {secondary && (
          <div className="mt-3">
            <Link href={secondary.href} className="text-[13px] font-semibold text-accent-text hover:underline">
              {secondary.label}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
