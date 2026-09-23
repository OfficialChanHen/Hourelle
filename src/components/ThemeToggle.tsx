'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

/* Light or dark, one tap. The icon names the destination rather than the state: in
   light you see a moon, meaning "go dark".

   `mounted` exists because the server render cannot know the answer — the theme comes
   from a device setting or a stored choice, both of which only the browser can see.
   Rendering the moon until the browser has looked keeps the markup identical on both
   sides; the icon corrects itself on the first client paint.

   A tap that lands on the device's own setting stores "system" rather than the
   colour. Storing the colour pinned it for good, and this toggle is all a visitor or
   a guest has (Settings, with its System option, is an account's): one tap to try
   dark and one back left a phone in light forever, deaf to its own dark mode. */
export function ThemeToggle() {
  const { setTheme, resolvedTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => { const next = isDark ? 'light' : 'dark'; setTheme(next === systemTheme ? 'system' : next) }}
      className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-border text-dim hover:text-text"
    >
      {mounted && isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
