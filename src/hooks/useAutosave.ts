'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createAutosave, type Autosave, type Commit, type SaveStatus } from '@/lib/autosave'
import { refusalShownInline } from '@/lib/remote'

/* lib/autosave for a component: the status to show beside the field, and change /
   flush / cancel / retry. `commit` is read when the write happens, so it always sees the
   latest props. A change still waiting is written when the field unmounts or the
   page is hidden (tab closed, app switched on a phone). */
export function useAutosave<T>(commit: Commit<T>): Omit<Autosave<T>, 'dispose'> & { status: SaveStatus } {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const commitRef = useRef(commit)
  useEffect(() => { commitRef.current = commit })

  // made on first use, from a handler, so nothing reads a ref during render
  const autoRef = useRef<Autosave<T> | null>(null)
  const get = useCallback(() => {
    autoRef.current ??= createAutosave<T>({
      commit: (v) => commitRef.current(v),
      // the field says Not saved itself, so the notice for it stays away
      onStatus: (s) => { setStatus(s); if (s === 'failed') refusalShownInline() },
    })
    return autoRef.current
  }, [])

  useEffect(() => {
    const onHide = () => autoRef.current?.flush()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      autoRef.current?.dispose()
    }
  }, [])

  const change = useCallback((value: T) => get().change(value), [get])
  const flush = useCallback(() => autoRef.current?.flush(), [])
  const cancel = useCallback(() => get().cancel(), [get])
  const retry = useCallback(() => autoRef.current?.retry(), [])
  return { change, flush, cancel, retry, status }
}
