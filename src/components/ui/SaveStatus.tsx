'use client'

import { Check, TriangleAlert } from 'lucide-react'
import type { SaveStatus as Status } from '@/lib/autosave'

/* The quiet word beside a field that saves itself: nothing while you type, "Saving…"
   once you pause, "Saved" only after the database has the change, then nothing again.
   A save that did not land says so and stays, with a way to send it again. The live
   region stays mounted so a screen reader hears each change. */
export function SaveStatus({ status, onRetry, className = '' }: { status: Status; onRetry?: () => void; className?: string }) {
  const tone = status === 'saved' ? 'text-teal-text' : status === 'failed' ? 'text-brick-text' : 'text-faint'
  return (
    <span role="status" aria-live="polite" className={`inline-flex flex-none items-center gap-1 whitespace-nowrap text-[12px] font-medium ${tone} ${className}`}>
      {status === 'saving' && 'Saving…'}
      {status === 'saved' && <><Check size={13} aria-hidden /> Saved</>}
      {status === 'failed' && (
        <>
          <TriangleAlert size={13} aria-hidden /> Not saved
          {onRetry && (
            <button type="button" onClick={onRetry} className="hit-area ml-1 font-semibold underline underline-offset-2">
              Try again
            </button>
          )}
        </>
      )}
    </span>
  )
}
