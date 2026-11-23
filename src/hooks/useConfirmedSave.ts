'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { answerOf, saveErrorText, SAVED_MS, type Commit, type SaveStatus } from '@/lib/autosave'
import { refusalShownInline } from '@/lib/remote'

/* A Save button that says saved only once the database has the change. `run` sends
   the write and waits: true once it landed (the status reads Saved for a moment, then
   goes quiet), false when it did not, with the reason in `error`, so the editor can
   stay open with the draft still in it. Kept in the part that outlives the editor,
   so the Saved beside the value is still there after the editor closes. */
export function useConfirmedSave() {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false; clearTimeout(timer.current) }
  }, [])

  const run = useCallback(async (write: () => ReturnType<Commit<unknown>>): Promise<boolean> => {
    clearTimeout(timer.current)
    setError(null)
    setStatus('saving')
    const r = await answerOf(write)
    if (!live.current) return r.ok
    if (!r.ok) { setStatus('failed'); setError(saveErrorText(r.message)); refusalShownInline(); return false }
    setStatus('saved')
    timer.current = setTimeout(() => { if (live.current) setStatus('idle') }, SAVED_MS)
    return true
  }, [])

  // the editor was closed without saving: nothing to report any more
  const reset = useCallback(() => { clearTimeout(timer.current); setStatus('idle'); setError(null) }, [])

  return { status, error, saving: status === 'saving', run, reset }
}
