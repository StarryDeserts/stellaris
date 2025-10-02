"use client"

import { useI18n } from "@/lib/i18n"
import LangSwitcher from "@/components/LangSwitcher"
import { useTheme } from "next-themes"
import DotMatrixUFO from "@/components/Markets/spaceship"

export default function Home() {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()

  return (
    <div className="min-h-screen pt-20"> {/* 给整个页面加顶部内边距，避免被导航栏覆盖 */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[80vh]">
          {/* 左侧主要内容 */}
          <div className="flex flex-col justify-center items-center text-center h-full py-10">
            {/* 主标题文字 */}
            <div className="max-w-3xl">
              <h1 className="text-6xl lg:text-8xl font-extrabold leading-tight text-gray-900 dark:text-white mb-8">
                Tokenize
                <br />
                Tomorrow's
                <br />
                Yield
              </h1>
              
              <div className="text-3xl lg:text-4xl font-medium text-gray-900 dark:text-white mt-6">
                Powered by
                <span className="ml-3 text-blue-600 dark:text-blue-400 font-bold">
                  Aptos
                </span>
              </div>
            </div>
          </div>

          {/* 右侧 UFO 组件 */}
          <div className="relative flex items-center justify-center">
            <div className="w-full h-[500px] lg:h-[600px] flex items-center justify-center">
              <DotMatrixUFO />
            </div>
            {/* 装饰性元素 */}
            <div className="absolute -top-4 -right-4 w-8 h-8 bg-blue-500 rounded-full opacity-60 animate-pulse"></div>
            <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-purple-500 rounded-full opacity-40 animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 -right-8 w-4 h-4 bg-green-500 rounded-full opacity-50 animate-pulse delay-500"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
