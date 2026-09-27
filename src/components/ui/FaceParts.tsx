'use client'

import { useId } from 'react'
import type { PersonColor } from '@/lib/colors'
import { FACE_PARTS, type Face } from '@/lib/faces'
import { FaceSvg } from './FaceSvg'

/* The part choices for a face: one row per part, each option drawn as the face with
   that one part swapped, so a row shows what a tap does without words. Shared by the
   profile's Your face and the event page's Change face popover.

   `wide` puts the row name in a column on the left from sm up (the profile card);
   `compact` keeps it above the row at every width (a popover). Options are 44px
   targets either way. */

export const FACE_ROWS: { key: keyof Face; label: string }[] = [
  { key: 'shape', label: 'Shape' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'mouth', label: 'Mouth' },
  { key: 'hair', label: 'Hair' },
  { key: 'accessory', label: 'Extra' },
]

export function FaceParts({ face, color, onPick, layout = 'wide' }: {
  face: Face
  color: PersonColor
  onPick: (next: Face) => void
  layout?: 'wide' | 'compact'
}) {
  const ids = useId()
  const wide = layout === 'wide'
  return (
    <>
      {FACE_ROWS.map((row) => (
        <div
          key={row.key} role="group" aria-labelledby={`${ids}-${row.key}`}
          className={`flex flex-col gap-1.5 ${wide ? 'sm:flex-row sm:items-center sm:gap-3' : ''}`}
        >
          <span id={`${ids}-${row.key}`} className={`text-[12.5px] font-semibold text-dim ${wide ? 'sm:w-[52px] sm:flex-none' : ''}`}>{row.label}</span>
          <div className="flex flex-wrap gap-1.5">
            {FACE_PARTS[row.key].map(([value, label]) => {
              const on = face[row.key] === value
              return (
                <button
                  key={value} type="button" aria-pressed={on} aria-label={label} title={label}
                  onClick={() => onPick({ ...face, [row.key]: value })}
                  className={`grid h-11 w-11 place-items-center rounded-[10px] border ${on ? 'border-accent bg-accent-bg' : 'border-border bg-s0 hover:border-border2'}`}
                >
                  <FaceSvg face={{ ...face, [row.key]: value }} color={color} size={32} />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
