  "use client"

  import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
  import { messages } from "./messages"

  export type Locale = "en" | "zh"

  interface I18nContextProps {
    locale: Locale
    setLocale: (newLocale: Locale) => void
    t: (key: string) => string
  }

  export const I18nContext = createContext<I18nContextProps | undefined>(undefined)

  function getNestedValue(obj: any, key: string): string {
    return key.split(".").reduce((acc, part) => acc?.[part], obj) ?? key
  }

  export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>("en")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
      setMounted(true)
      const saved = localStorage.getItem("locale") as Locale
      if (saved && ["en", "zh"].includes(saved)) {
        setLocaleState(saved)
      }
    }, [])

    const handleSetLocale = (newLocale: Locale) => {
      setLocaleState(newLocale)
      localStorage.setItem("locale", newLocale)
    }

    const t = (key: string) => {
      const currentMessages = messages[locale] || messages.en
      return getNestedValue(currentMessages, key)
    }

    if (!mounted) return null // 避免 SSR 闪烁

    return (
      <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
        {children}
      </I18nContext.Provider>
    )
  }

  export const useI18n = () => {
    const context = useContext(I18nContext)
    if (!context) throw new Error("useI18n must be used within I18nProvider")
    return context
  }
