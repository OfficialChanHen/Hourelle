'use client'

import * as RSwitch from '@radix-ui/react-switch'

/* The one switch: 22 by 38, accent when on, with an invisible halo that grows the
   touch target to 44px without changing how it looks.

   On Radix's Switch rather than a hand-made button with role="switch": the role and
   aria-checked were right, but Radix also carries the state as data-state for the
   styling below, answers Space and Enter the way a platform switch does, and keeps
   a hidden checkbox in step when the switch sits inside a form. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <RSwitch.Root
      checked={on}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-[22px] w-[38px] flex-none rounded-full border border-border2 bg-s2 outline-none transition-colors after:absolute after:-inset-[11px] after:content-[''] focus-visible:ring-2 focus-visible:ring-accent-border data-[state=checked]:border-accent data-[state=checked]:bg-accent"
    >
      <RSwitch.Thumb className="block h-[16px] w-[16px] translate-x-[2px] rounded-full bg-s1 shadow-raised transition-transform data-[state=checked]:translate-x-[18px]" />
    </RSwitch.Root>
  )
}
