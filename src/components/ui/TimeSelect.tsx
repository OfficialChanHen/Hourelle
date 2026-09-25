'use client'

import * as RSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { fmtMinute } from '@/lib/events'

/**
 * A time of day, picked from the times that are allowed. Bounds are enforced by
 * construction: only times in [min, max] at `step` increments are offered, so the
 * caller can't land outside the window it gives.
 *
 * ── why this sits on Radix Select ──
 * It was a hand-rolled button and a div of buttons, and it had every fault the old
 * dropdown had before that moved to Radix: nothing said the button opened a list or
 * which time was chosen, focus stayed on the trigger while the list sat open, arrow
 * keys did nothing, Escape and outside clicks were wired by hand, and the list was an
 * absolute div inside the page, so any parent with a hidden overflow cut it off. Its
 * trigger was 28px tall, well under a finger.
 *
 * A time list is a select, so it is Radix's Select: a listbox with the chosen option
 * marked, arrows and Home/End to move, typing "7" to jump to seven, the list opened
 * with the current time in view, and a portal nothing can clip. What stays ours is
 * the look: the hairline trigger with a clock, and the accent row for the chosen time.
 */
export function TimeSelect({
  value, onChange, min = 0, max = 24 * 60 - 15, step = 15, title, className,
}: {
  value: number // clock minutes
  onChange: (min: number) => void
  min?: number
  max?: number
  step?: number
  title?: string
  className?: string
}) {
  const lo = Math.min(min, max), hi = Math.max(min, max)
  const opts: number[] = []
  for (let t = lo; t <= hi; t += step) opts.push(t)
  if (!opts.length) opts.push(lo)
  // a value from outside the offered times still shows, as its own first option,
  // rather than leaving the trigger blank
  if (!opts.includes(value)) opts.unshift(value)

  return (
    <RSelect.Root value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <RSelect.Trigger
        aria-label={title ?? 'Time'}
        title={title}
        className={`flex h-11 items-center gap-1.5 rounded-[9px] border border-border bg-s1 px-2.5 text-[13.5px] font-medium tabular-nums outline-none hover:border-border2 focus-visible:border-accent data-[state=open]:border-accent-border sm:h-8 sm:rounded-[8px] sm:px-2 sm:text-[12.5px] ${className ?? ''}`}
      >
        <Clock size={13} className="flex-none text-dim" />
        <RSelect.Value>{fmtMinute(value)}</RSelect.Value>
        <RSelect.Icon><ChevronDown size={13} className="text-faint" /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          // over the full-screen phone surfaces and the popovers a picker can sit in
          className="z-[56] w-[128px] overflow-hidden rounded-[12px] border border-border bg-s1 shadow-soft"
          style={{ maxHeight: 'min(260px, var(--radix-select-content-available-height))' }}
        >
          <RSelect.ScrollUpButton className="flex h-6 items-center justify-center text-faint"><ChevronUp size={14} /></RSelect.ScrollUpButton>
          <RSelect.Viewport className="p-1">
            {opts.map((m) => (
              <RSelect.Item
                key={m}
                value={String(m)}
                className="relative flex h-10 cursor-pointer select-none items-center justify-between rounded-[7px] px-2.5 text-[13.5px] tabular-nums outline-none data-[highlighted]:bg-s2 data-[state=checked]:bg-accent data-[state=checked]:font-semibold data-[state=checked]:text-on-accent sm:h-8 sm:text-[13px]"
              >
                <RSelect.ItemText>{fmtMinute(m)}</RSelect.ItemText>
                <RSelect.ItemIndicator><Check size={13} /></RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
          <RSelect.ScrollDownButton className="flex h-6 items-center justify-center text-faint"><ChevronDown size={14} /></RSelect.ScrollDownButton>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}
