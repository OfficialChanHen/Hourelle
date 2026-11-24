import { Repeat } from 'lucide-react'
import type { AppEvent } from '@/lib/events'
import { repeatLabel } from '@/lib/repeat'

/* The mark of a repeating plan (lib/repeat.ts): the cadence beside a loop. A pill on
   the plan page, plain words in a card's quiet line, and the loop alone where a card
   has no room, named for screen readers and on hover. Nothing for a one-off plan. */
export function RepeatTag({ e, variant = 'pill', className = '' }: { e: Pick<AppEvent, 'repeat' | 'confirmed' | 'startDate'>; variant?: 'pill' | 'inline' | 'icon'; className?: string }) {
  if (!e.repeat) return null
  const label = repeatLabel(e.repeat.every, e.confirmed?.dayKey ?? e.startDate)
  if (variant === 'icon') {
    return (
      <span title={`Repeats: ${label}`} className={`flex flex-none items-center text-dim ${className}`}>
        <Repeat size={13} aria-hidden />
        <span className="sr-only">Repeats {label.toLowerCase()}</span>
      </span>
    )
  }
  if (variant === 'inline') {
    return <span className={`flex min-w-0 items-center gap-1 ${className}`}><Repeat size={12} className="flex-none" aria-hidden /><span className="truncate">{label}</span></span>
  }
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full border border-border2 bg-s1 px-2.5 text-[12.5px] font-medium text-dim ${className}`}>
      <Repeat size={13} className="flex-none" aria-hidden /> {label}
    </span>
  )
}
