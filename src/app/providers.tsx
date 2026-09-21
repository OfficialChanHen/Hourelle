'use client'

import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      // the house look in light is where everyone starts; the device's own setting
      // applies only when someone picks System on the welcome step or in Settings
      defaultTheme="light"
      enableSystem
      themes={['light', 'dark']}
    >
      {children}
    </ThemeProvider>
  )
}
