'use client'

import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      // the device decides until someone chooses: light or dark follows the system
      // setting, and a pick on the welcome step or in Settings overrides it from then on
      defaultTheme="system"
      enableSystem
      themes={['light', 'dark']}
    >
      {children}
    </ThemeProvider>
  )
}
