'use client'

import { useEffect, useRef } from 'react'
import { holdDraft, type Guard } from '@/lib/leave-guard'

/* Holds a draft open while `dirty`, so leaving the page first asks Save or Don't save
   (lib/leave-guard). `save` returns false when the draft cannot be saved as it is; it
   and `discard` are read when the question is answered, so they always see the latest
   draft. Unmounting lets go: whatever was not saved by then is gone, like a closed tab. */
export function useLeaveGuard(dirty: boolean, save: Guard['save'], discard?: Guard['discard']) {
  const ref = useRef<Guard>({ save, discard })
  useEffect(() => { ref.current = { save, discard } })
  useEffect(() => {
    if (!dirty) return
    return holdDraft({ save: () => ref.current.save(), discard: () => ref.current.discard?.() })
  }, [dirty])
}
