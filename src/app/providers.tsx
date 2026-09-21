'use client'

import { ThemeProvider } from 'next-themes'

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
      {children}
    </ThemeProvider>
  )
}
