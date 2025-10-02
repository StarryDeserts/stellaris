"use client"

import { Globe, Sun, Moon } from "lucide-react"
import { WalletSelector } from "./Wallet/waletbutton"
import { useI18n } from "@/lib/i18n"
import { useTheme } from "next-themes"

export function Navigation() {
  const { theme, setTheme } = useTheme()
  const { t, locale, setLocale } = useI18n()

  const menuItems = [
    { key: "markets", href: "/Markets" },
    { key: "pools", href: "/Pools" },
    { key: "dashboard", href: "/Dashboard" },
    { key: "faucet", href: "/Faucet" },
  ]

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-bg/70 dark:bg-gray-900 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-2">
        <div className="flex items-center h-20">
          {/* Left: Logo + Menu */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              {/* <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">*/}
                <img src="/logo/logo4.png" alt="stellari" className="w-24 h-auto" style={{ objectFit: 'contain' }} /> 
              {/* </div> */}
              <img src="/logo/logotext.svg" alt="stellari" className="w-40 h-auto ml-0" />
            </div>

            <div className="hidden md:flex items-center space-x-8 pl-24">
              {menuItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className="relative text-gray-800 dark:text-white hover:text-yellow-400 dark:hover:text-yellow-300 font-medium text-base tracking-wide transition-all duration-300 px-5 py-3 group"
                >
                  {t(`navbar.${item.key}`)}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-yellow-400 to-pink-500 group-hover:w-full transition-all duration-500 ease-out"></span>
                </a>
              ))}
            </div>
          </div>

          {/* Right: Buttons */}
          <div className="ml-auto flex items-center space-x-3">
            {/* Language Switch */}
            {/* <button
              onClick={() => setLocale(locale === "en" ? "zh" : "en")}
              className="flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-yellow-400/20 hover:text-yellow-500 dark:hover:text-yellow-300 transition-all duration-300 shadow-sm"
            >
              <Globe className="w-4 h-4" />
              <span>{locale === "en" ? "EN" : "中文"}</span>
            </button> */}

            {/* Theme Switch */}
            {/* <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="flex items-center justify-center p-2 text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-yellow-400/20 hover:text-yellow-500 dark:hover:text-yellow-300 transition-all duration-300 shadow-sm"
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button> */}

            <WalletSelector />
          </div>
        </div>
      </div>
    </nav>
  )
}