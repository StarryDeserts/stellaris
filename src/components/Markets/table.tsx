"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import type React from "react"

import { useRouter } from "next/navigation"
import { useStellaris } from "@/contract"
import { getPoolsWithData, type PoolExtended } from "@/lib/pooldata"
import { useI18n } from "@/lib/i18n"

type SortableColumn = "liquidity" | "baseAPY" | "expiry"

export default function DefiTable() {
  const router = useRouter()
  const { marketGetTotalSy, marketGetExpiry } = useStellaris()
  const [cryptoData, setCryptoData] = useState<PoolExtended[]>([])
  const [sortBy, setSortBy] = useState<SortableColumn>("baseAPY")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [isLoading, setIsLoading] = useState(false)
  const { t, locale, setLocale } = useI18n()
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastFetchTimeRef = useRef<number>(0)

  const fetchPools = useCallback(async (force = false) => {
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTimeRef.current
    
    // 如果不是强制刷新且距离上次请求不到30秒，则跳过
    if (!force && timeSinceLastFetch < 30000) {
      return
    }

    // 清除之前的定时器
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }

    // 设置防抖延迟
    fetchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const data = await getPoolsWithData(marketGetTotalSy, marketGetExpiry)
        const adjustedData = data.map((pool) => ({
          ...pool,
          liquidity: pool.liquidity / 100000000,
        }))
        setCryptoData(adjustedData)
        lastFetchTimeRef.current = Date.now()
      } catch (error) {
        console.error("Failed to fetch pool data:", error)
      } finally {
        setIsLoading(false)
      }
    }, 500) // 500ms 防抖延迟
  }, []) // 移除函数依赖项

  useEffect(() => {
    fetchPools()
    
    // 清理定时器
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [fetchPools])

  const handleSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("desc")
    }
  }

  const getSortIcon = (column: SortableColumn) => {
    if (sortBy === column) return sortOrder === "asc" ? "▲" : "▼"
    return (
      <div className="flex flex-col items-center justify-center h-4 w-3">
        <span className="text-xs leading-none mb-0.5 opacity-50">▲</span>
        <span className="text-xs leading-none opacity-50">▼</span>
      </div>
    )
  }

  const getSortIconStyle = (column: SortableColumn) =>
    sortBy === column ? "text-blue-600 font-bold" : "text-gray-600"

  const sortedData = [...cryptoData].sort((a, b) => {
    let aValue: number, bValue: number
    switch (sortBy) {
      case "liquidity":
        aValue = a.liquidity
        bValue = b.liquidity
        break
      case "baseAPY":
        aValue = a.baseAPY
        bValue = b.baseAPY
        break
      case "expiry":
        aValue = a.expiry
        bValue = b.expiry
        break
      default:
        return 0
    }
    return sortOrder === "asc" ? aValue - bValue : bValue - aValue
  })

  const formatLiquidity = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B `
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M `
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K `
    if (value >= 1) return `${value.toFixed(2)} `
    return `${value.toFixed(6)} `
  }

  const formatRawLiquidity = (value: number) => {
    return value.toLocaleString("en-US"); // Thousands separator
  }

  const formatDate = (timestamp: number | string) => {
    const ts = Number(timestamp)
    const date = new Date(ts < 1e12 ? ts * 1000 : ts)
    if (isNaN(date.getTime())) return "Invalid Date"
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const getDaysLeft = (timestamp: number | string) => {
    const ts = Number(timestamp) < 1e12 ? Number(timestamp) * 1000 : Number(timestamp)
    const now = Date.now()
    const diff = ts - now
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days > 0 ? `${days} days` : "Expired"
  }

  const handleRowClick = (crypto: PoolExtended, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) {
      return
    }

    const queryParams = new URLSearchParams({
      poolId: crypto.poolId,
      name: crypto.name || "",
      liquidity: crypto.liquidity.toString(),
      baseAPY: crypto.baseAPY.toString(),
      expiry: crypto.expiry.toString(),
      icon: crypto.icon || "",
      pystats: crypto.pystats
    })
    router.push(`/Markets/${crypto.poolId}?${queryParams.toString()}`)
  }

  return (
    <main className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Markets</h1>
          <button
            onClick={() => fetchPools(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-100 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
        <div className=" rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading && (
            <div className="text-gray-600 p-4 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
              Loading data...
            </div>
          )}
          {cryptoData.length === 0 && !isLoading && (
            <div className="text-gray-600 p-4 text-center">No data available</div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="text-left py-5 px-6 text-gray-800 font-semibold text-base">
                    {t("markets.assent")}
                  </th>
                  <th
                    className="text-left py-5 px-6 text-gray-800 font-semibold text-base cursor-pointer hover:text-blue-600 transition-colors select-none"
                    onClick={() => handleSort("expiry")}
                  >
                    <div className="flex items-center gap-2">
                      {t("markets.endtime")}
                      <span className={getSortIconStyle("expiry")}>{getSortIcon("expiry")}</span>
                    </div>
                  </th>
                  <th
                    className="text-left py-5 px-6 text-gray-800 font-semibold text-base cursor-pointer hover:text-blue-600 transition-colors select-none"
                    onClick={() => handleSort("liquidity")}
                  >
                    <div className="flex items-center gap-2">
                      {t("markets.liquidity")}
                      <span className={getSortIconStyle("liquidity")}>{getSortIcon("liquidity")}</span>
                    </div>
                  </th>
                  <th 
                    className="text-left py-5 px-6 text-gray-800 font-semibold text-base cursor-pointer hover:text-blue-600 transition-colors select-none"
                    onClick={() => handleSort("baseAPY")}
                  >
                    <div className="flex items-center gap-2">
                      APY
                      <span className={getSortIconStyle("baseAPY")}>{getSortIcon("baseAPY")}</span>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedData.map((crypto, index) => (
                  <tr
                    key={crypto.poolId}
                    className={`border-b border-gray-100 transition-all duration-200 cursor-pointer 
      hover:bg-blue-50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    onClick={(e) => handleRowClick(crypto, e)}
                  >
                    <td className="py-5 px-5">
                      <div className="flex items-center gap-4">
                        <img
                          src={crypto.icon || "/placeholder.svg"}
                          alt={crypto.name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div>
                          <div className="font-semibold text-gray-800 text-lg">{crypto.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-5 text-base">
                      <div className="text-gray-600">
                        {formatDate(crypto.expiry)} ({getDaysLeft(crypto.expiry)})
                      </div>
                    </td>
                    <td className="py-5 px-5 text-base">
                      <div
                        className="font-semibold text-gray-800"
                        title={formatRawLiquidity(crypto.liquidity )} // Hover to show raw value
                      >
                        {formatLiquidity(crypto.liquidity)}
                      </div>
                    </td>
                    <td className="py-5 px-5 text-base">
                    <div className="inline-flex items-center justify-center min-w-[80px] w-20 h-8 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-sm font-bold border border-emerald-200 shadow-sm">
  {crypto.baseAPY}%
</div>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}