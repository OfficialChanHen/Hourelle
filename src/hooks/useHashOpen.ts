'use client'

import { useEffect, useRef } from 'react'

/* Calls `open` when the address's hash is one of `ids`, on first draw and whenever it
   changes: a link that lands on a section someone came to change opens it. */
export function useHashOpen(ids: string[], open: () => void) {
  const latest = useRef(open)
  latest.current = open
  const key = ids.join(' ')
  useEffect(() => {
    const read = () => { if (key.split(' ').includes(window.location.hash.slice(1))) latest.current() }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [key])
}
