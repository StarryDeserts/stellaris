"use client"

import { ReactNode, useEffect, useState } from "react"
import { ThemeProvider } from "next-themes"
import { I18nProvider } from "@/lib/i18n"

export function AppProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  )
}
