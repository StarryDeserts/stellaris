"use client"

import { useI18n } from "@/lib/i18n"

export default function LangSwitcher() {
  const { t, locale, setLocale } = useI18n()

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      className="px-3 py-2 border rounded"
    >
      {t("common.switchLang")}
    </button>
  )
}
