'use client'

import { useEffect, useRef } from 'react'

/* Calls `open` when the address's hash is one of `ids`, on first draw and whenever it
   changes: a link that lands on a section someone came to change opens it. */
export function useHashOpen(ids: string[], open: () => void) {
  const latest = useRef(open)
  latest.current = open
  const key = ids.join(' ')
  useEffect(() => {
    const read = () => { if (hashOpens(key ? key.split(' ') : [], window.location.hash)) latest.current() }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [key])
}

// an empty hash never opens anything: with no ids, a joined key splits to [''] and
// would match a page loaded with no hash at all
export function hashOpens(ids: string[], hash: string): boolean {
  const id = hash.replace(/^#/, '')
  return id !== '' && ids.includes(id)
}
