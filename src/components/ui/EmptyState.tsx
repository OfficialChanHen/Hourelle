import Link from 'next/link'
import { Plus, type LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: { label: string; href: string }
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
          <Icon size={20} />
        </span>
        <p className="font-serif text-[22px] tracking-[-0.01em]">{title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-[1.5] text-dim">{body}</p>
        {action && (
          <Link
            href={action.href}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[12.5px] font-semibold text-on-accent"
          >
            <Plus size={15} /> {action.label}
          </Link>
        )}
      </div>
    </div>
  )
}
