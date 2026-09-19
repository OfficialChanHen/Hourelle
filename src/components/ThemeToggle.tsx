'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

/* Light or dark, one tap. The icon names the destination rather than the state: in
   light you see a moon, meaning "go dark".

   `mounted` exists because the server render cannot know the answer — the theme comes
   from a device setting or a stored choice, both of which only the browser can see.
   Rendering the moon until the browser has looked keeps the markup identical on both
   sides; the icon corrects itself on the first client paint. */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-border text-dim hover:text-text"
    >
      {mounted && isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
