'use client'

import { useEffect, useState } from 'react'

// scrolling down tucks chrome away, scrolling up brings it back — the standard
// mobile pattern that gives the content the whole screen while reading. Small
// jitters (rubber-banding, sub-threshold moves) don't flip it, and the top of the
// page always shows it.
export function useHideOnScroll(threshold = 10): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - last
      if (Math.abs(dy) < threshold) return
      setHidden(dy > 0 && y > 64)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return hidden
}
