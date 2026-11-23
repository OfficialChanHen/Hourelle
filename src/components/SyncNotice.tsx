'use client'

// When the database refuses a write, the local copy has already changed and the UI
// has already moved on — so without this the change would look saved to you and be
// invisible to everyone else. This says Not saved, why, and reloads to the real state.

import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { PUSH_HANDLED, PUSH_REJECTED } from '@/lib/remote'
import { saveErrorText as humanize, SAVING_MS } from '@/lib/autosave'

const CLAIM_MS = SAVING_MS + 300

export function SyncNotice() {
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    // a field or editor that answers for its own save says Not saved beside itself; it
    // gets a moment to claim the refusal (autosave holds Saving for SAVING_MS) before
    // this says it again in the corner
    let wait: ReturnType<typeof setTimeout> | undefined
    const onRejected = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string; message: string }>).detail
      clearTimeout(wait)
      wait = setTimeout(() => setNotice(humanize(detail?.message ?? 'That change did not reach the server.')), CLAIM_MS)
    }
    const onHandled = () => { clearTimeout(wait); setNotice(null) }
    window.addEventListener(PUSH_REJECTED, onRejected)
    window.addEventListener(PUSH_HANDLED, onHandled)
    return () => {
      window.removeEventListener(PUSH_REJECTED, onRejected)
      window.removeEventListener(PUSH_HANDLED, onHandled)
      clearTimeout(wait)
    }
  }, [])

  if (!notice) return null

  return (
    // the tint is translucent in dark, so it sits on paper: a floating card must not
    // let the page show through it
    <div className="pointer-events-auto max-w-[420px] rounded-2xl bg-s1 shadow-soft">
      <div className="flex items-start gap-2.5 rounded-2xl border border-brick-border bg-brick-bg px-4 py-3">
        <TriangleAlert size={15} className="mt-0.5 flex-none text-brick-text" />
        <div className="min-w-0">
          <p className="text-[13px] leading-[1.5] text-brick-text"><span className="font-semibold">Not saved.</span> {notice}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 text-[12.5px] font-semibold text-brick-text underline underline-offset-2"
          >
            Reload to see what is saved
          </button>
        </div>
      </div>
    </div>
  )
}
