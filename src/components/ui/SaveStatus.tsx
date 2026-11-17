'use client'

import { Check } from 'lucide-react'
import type { SaveStatus as Status } from '@/lib/autosave'

/* The quiet word beside a field that saves itself: nothing while you type, "Saving…"
   once you pause, then "Saved", then nothing again. The live region stays mounted so
   a screen reader hears each change. */
export function SaveStatus({ status, className = '' }: { status: Status; className?: string }) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex flex-none items-center gap-1 whitespace-nowrap text-[12px] font-medium ${status === 'saved' ? 'text-teal-text' : 'text-faint'} ${className}`}>
      {status === 'saving' && 'Saving…'}
      {status === 'saved' && <><Check size={13} aria-hidden /> Saved</>}
    </span>
  )
}
