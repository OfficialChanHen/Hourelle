'use client'

import { Pencil } from 'lucide-react'

/* The one way to say a value can be changed in place: a round pencil right after the
   value, on its first line (at the end of the last line when the value wraps). Card
   and object edits (a profile card, a plan card's corner) keep their own buttons. */
export function EditPencil({ label, onClick, size = 'md' }: { label: string; onClick: () => void; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-8 w-8' : 'h-7 w-7'
  return (
    <button
      type="button" onClick={onClick} title={label} aria-label={label}
      className={`hit-area ml-1 inline-grid ${box} flex-none place-items-center rounded-full align-middle text-faint hover:bg-s2 hover:text-dim`}
    >
      <Pencil size={size === 'lg' ? 15 : 13} aria-hidden />
    </button>
  )
}
