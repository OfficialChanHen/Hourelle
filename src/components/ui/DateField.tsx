'use client'

import { CalendarDays } from 'lucide-react'

/* ── a date field that looks the same in every browser ──
   A native date input draws its own value, and every browser draws it somewhere
   else: Chrome on Android centres the text in whatever its calendar button leaves,
   iOS Safari centres it in the whole box, desktop Chrome packs it against the button.
   Two of them side by side never agreed, and neither sat in the middle of anything.

   So the field draws its own text: a calendar icon and the day as people say it
   ("Tue, Sep 22", or "Jan 5, 2027" when it is not this year, which trades the weekday
   for the year so a phone's half-row still fits it), left-aligned after the
   icon so a pair of them reads as one row. The real input lies over it, invisible,
   and still does all the work: a tap opens the phone's own picker, a click asks
   for the desktop one with showPicker(), min and max still hold, and the keyboard
   still types into it. The box shows focus for it. */
export function DateField({ value, onChange, label, min, max, invalid, describedBy, empty = 'Not set', className = '' }: {
  value: string
  onChange: (v: string) => void
  label: string
  min?: string
  max?: string
  invalid?: boolean
  // the id of the message that explains an error, when one is showing
  describedBy?: string
  empty?: string
  className?: string
}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
  const text = d
    ? d.getFullYear() === new Date().getFullYear()
      ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  return (
    <span className={`@container relative flex min-w-0 items-center gap-2 rounded-[10px] border ${invalid ? 'border-brick-border' : 'border-border'} bg-s2 px-3 focus-within:border-accent-border ${className}`}>
      {/* the icon gives way before the date does: a pair of fields on a 360 phone is
          too narrow for both */}
      <CalendarDays size={15} className="hidden flex-none text-dim @[108px]:block" aria-hidden />
      <span className={`min-w-0 flex-1 truncate text-[14px] ${text ? 'font-medium' : 'text-faint'}`} aria-hidden>{text || empty}</span>
      <input
        type="date"
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { try { e.currentTarget.showPicker() } catch { /* older browsers open it themselves */ } }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  )
}
