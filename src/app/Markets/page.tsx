"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { CryptoAPYBanner } from "@/components/Markets/pho"
import DefiTable from "@/components/Markets/table"

function Positions() {
  return (
    <div className="mt-6">
      <p className="light:text-black dark:text-white">User position management content will be displayed here</p>
    </div>
  )
}

function MarketsTable() {
  return <DefiTable />
}

export default function Page() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = searchParams.get("tab")

  const showMarkets = !tab || tab.toLowerCase() === "markets"
  const showPositions = tab?.toLowerCase() === "positions"

  const handleTabClick = (tabName: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set("tab", tabName)
    router.push(url.toString())
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-36">
      {/* 标题区域 */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Explore Markets
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl">
          Browse available liquidity pools and yield markets. Select any market to view details, create positions, or perform token swaps.
        </p>
      </div>

      {/* 功能说明 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 mb-8">
        <ul className="space-y-2 text-gray-600 dark:text-gray-300">
          <li className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Browse the markets table below to view available pools</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Click on any market to view detailed information and trading options</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-blue-500">•</span>
            <span>Create positions to provide liquidity and earn yield</span>
          </li>
        </ul>
      </div>

      {/* Tab 切换按钮 - 保留注释以便将来可能的恢复 */}
      {/* <div className="mt-6 flex gap-6">
        <button
          className={`relative pb-1 font-bold text-2xl text-text ${
            showMarkets ? "text-blue-500" : "text-gray-500"
          }`}
          onClick={() => handleTabClick("markets")}
        >
          Markets
          {showMarkets && (
            <span className="absolute left-0 bottom-0 w-full h-1 bg-blue-500 rounded"></span>
          )}
        </button>

        <button
          className={`relative pb-1 font-bold text-2xl light:text-black dark:text-white ${
            showPositions ? "text-blue-500" : "text-gray-500"
          }`}
          onClick={() => handleTabClick("positions")}
        >
          Positions
          {showPositions && (
            <span className="absolute left-0 bottom-0 w-full h-1 bg-blue-500 rounded"></span>
          )}
        </button>
      </div> */}

      {/* 内容区域 */}
      <div>
        {showMarkets && <MarketsTable />}
        {showPositions && <Positions />}
      </div>
    </div>
  )
}
