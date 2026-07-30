'use client'

import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      // light stays the default for anyone who never chose; "System" is an explicit
      // pick in Settings that follows the device from then on
      defaultTheme="light"
      enableSystem
      themes={['light', 'dark']}
    >
      {children}
    </ThemeProvider>
  )
}
