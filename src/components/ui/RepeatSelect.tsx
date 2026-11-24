'use client'

import { ChevronDown } from 'lucide-react'
import { CADENCES, repeatLabel, type Cadence } from '@/lib/repeat'

/* How often a locked plan comes back (lib/repeat.ts), as one native select: in the
   lock-in modal and on the Details tab. Monthly names its weekday from `dayKey`. */
export function RepeatSelect({ value, dayKey, onChange, className = '' }: { value: Cadence | ''; dayKey: string; onChange: (v: Cadence | '') => void; className?: string }) {
  return (
    <span className={`relative block ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Cadence | '')}
        aria-label="Repeats"
        className="h-11 w-full appearance-none rounded-[9px] border border-border bg-s1 pl-3 pr-8 text-[13.5px] font-medium outline-none focus:border-accent sm:h-9"
      >
        <option value="">Doesn&apos;t repeat</option>
        {CADENCES.map((c) => <option key={c} value={c}>{repeatLabel(c, dayKey)}</option>)}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint" />
    </span>
  )
}
