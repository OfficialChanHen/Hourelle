'use client'

import { forwardRef } from 'react'
import { Caveat } from 'next/font/google'
import type { Ink } from './Pencil'

/* A few handwritten words in the margin, in Caveat: "your times are missing".
   Only for a note that points at something you still owe, next to a pencil arrow
   (Pencil.tsx). The face loads only where this file is used, and it never goes
   under 17px. It repeats something the card already says in plain type, so a
   screen reader skips it. */
const caveat = Caveat({ subsets: ['latin'], weight: ['500', '600'], display: 'swap' })
const INK: Record<Ink, string> = { accent: 'text-accent-text', moment: 'text-moment-text', graphite: 'text-dim' }

export const HandNote = forwardRef<HTMLSpanElement, { children: React.ReactNode; ink?: Ink; className?: string }>(
  function HandNote({ children, ink = 'moment', className = '' }, ref) {
    return (
      <span ref={ref} aria-hidden className={`${caveat.className} inline-block text-[20px] font-semibold leading-none ${INK[ink]} ${className}`}>
        {children}
      </span>
    )
  },
)
