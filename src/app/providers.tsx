'use client'

import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ThemeProvider } from 'next-themes'
import { PREFS_CHANGED, reducedMotion } from '@/lib/prefs'

/* Reduced motion for the animations that do not ask for themselves. The ones that
   matter (the tour, the landing demos, segmented pills) check reducedMotion() and skip;
   everything else runs so fast it lands in its end state at once, which keeps any
   onComplete work happening instead of dropping it. */
function MotionPref() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => gsap.globalTimeline.timeScale(reducedMotion() ? 40 : 1)
    sync()
    window.addEventListener(PREFS_CHANGED, sync)
    mq.addEventListener('change', sync)
    return () => { window.removeEventListener(PREFS_CHANGED, sync); mq.removeEventListener('change', sync) }
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      // the device decides until someone chooses, and an account that ends puts this
      // back (resetAppearance); the house warm neutral is the palette either way
      defaultTheme="system"
      enableSystem
      themes={['light', 'dark']}
    >
      <MotionPref />
      {children}
    </ThemeProvider>
  )
}
