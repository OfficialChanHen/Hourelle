'use client'

// When the database refuses a write, the local copy has already changed and the UI
// has already moved on — so without this the change would look saved to you and be
// invisible to everyone else. This says so plainly and reloads to the real state.

import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { PUSH_REJECTED } from '@/lib/remote'

/* The field trigger raises sentences meant to be read; a bare policy refusal does
   not, so it gets one. "Violates" alone was too wide a net: a foreign key that is
   not there yet also violates something, and a change that arrived a moment early
   was being reported to the person as a change they were not allowed to make. */
function humanize(message: string): string {
  if (/row-level security|policy/i.test(message)) return 'You do not have permission to make that change.'
  if (/foreign key|is not present in table/i.test(message)) return 'That change arrived before the event did. It is still on this device; reload to send it again.'
  return message
}

export function SyncNotice() {
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const onRejected = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string; message: string }>).detail
      setNotice(humanize(detail?.message ?? 'That change could not be saved.'))
    }
    window.addEventListener(PUSH_REJECTED, onRejected)
    return () => window.removeEventListener(PUSH_REJECTED, onRejected)
  }, [])

  if (!notice) return null

  return (
    // the tint is translucent in dark, so it sits on paper: a floating card must not
    // let the page show through it
    <div className="pointer-events-auto max-w-[420px] rounded-2xl bg-s1 shadow-soft">
      <div className="flex items-start gap-2.5 rounded-2xl border border-brick-border bg-brick-bg px-4 py-3">
        <TriangleAlert size={15} className="mt-0.5 flex-none text-brick-text" />
        <div className="min-w-0">
          <p className="text-[13px] leading-[1.5] text-brick-text">{notice}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 text-[12.5px] font-semibold text-brick-text underline underline-offset-2"
          >
            Reload to see what everyone else sees
          </button>
        </div>
      </div>
    </div>
  )
}
