"use client"

import { useEffect, useState } from "react"
import { useStellaris } from "@/contract/index"
import { useWallet } from "@aptos-labs/wallet-adapter-react"

interface PositionInfo {
  id: string
  info: {
    description: string
    sy_state_id?: string
    pt_state_id?: string
    py_state_id?: string
    market_state_id?: string
    yield_token: string
    pt_balance_display?: string
    yt_balance_display?: string
    lp_amount_display?: string
  }
}

interface GroupedPositions {
  [stateId: string]: {
    description: string
    positions: PositionInfo[]
  }
}

export default function PositionManager() {
  const { account } = useWallet()
  const {
    pyPosGetPositionInfo,
    pyPosGetUserPositionAddress,
    marketPosGetPositionInfo,
    marketPosGetUserPositionAddress,
  } = useStellaris()

  const [syPositions, setSyPositions] = useState<PositionInfo[]>([])
  const [ptPositions, setPtPositions] = useState<PositionInfo[]>([])
  const [isSyLoading, setIsSyLoading] = useState(false)
  const [isPtLoading, setIsPtLoading] = useState(false)

  const [selectedSyPool, setSelectedSyPool] = useState<string | null>(null)
  const [selectedPtPool, setSelectedPtPool] = useState<string | null>(null)

  // Load SY positions (previously PY)
  useEffect(() => {
    if (!account?.address) return

    async function loadSyPositions() {
      try {
        setIsSyLoading(true)
        const rawIds = await pyPosGetUserPositionAddress(account!.address.toString())
        const ids = Array.isArray(rawIds[0]) ? rawIds[0] : []
        const infos = await Promise.all(
          ids.map(async (id: string) => {
            const info = await pyPosGetPositionInfo(id)
            console.log(info)
            return { id, info }
          }),
        )
        setSyPositions(infos)
      } catch (err) {
        console.error("Error loading SY positions:", err)
      } finally {
        setIsSyLoading(false)
      }
    }

    loadSyPositions()
  }, [account?.address])

  // Load PT positions (previously LP)
  useEffect(() => {
    if (!account?.address) return

    async function loadPtPositions() {
      try {
        setIsPtLoading(true)
        const rawIds = await marketPosGetUserPositionAddress(account!.address.toString())
        const ids = Array.isArray(rawIds[0]) ? rawIds[0] : []
        const infos = await Promise.all(
          ids.map(async (id: string) => {
            const info = await marketPosGetPositionInfo(id)
            return { id, info }
          }),
        )
        setPtPositions(infos)
      } catch (err) {
        console.error("Error loading PT positions:", err)
      } finally {
        setIsPtLoading(false)
      }
    }

    loadPtPositions()
  }, [account?.address])

  // Group positions by state ID
  const groupPositionsByStateId = (positions: PositionInfo[], isSy: boolean): GroupedPositions => {
    const grouped: GroupedPositions = {}

    positions.forEach((pos) => {
      const stateId = isSy
        ? pos.info.sy_state_id || pos.info.py_state_id || "unknown"
        : pos.info.pt_state_id || pos.info.market_state_id || "unknown"

      if (!grouped[stateId]) {
        grouped[stateId] = {
          description: pos.info.description || "Unnamed Group",
          positions: [],
        }
      }

      grouped[stateId].positions.push(pos)
    })

    return grouped
  }

  const formatAddress = (address: string) => {
    if (!address) return ""
    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }

  const formatBalance = (balance: string) => {
    if (!balance) return "0"
    const num = Number.parseFloat(balance)
    return num.toLocaleString("en-US", { maximumFractionDigits: 6 })
  }

  const renderEmptyState = () => (
    <div className="text-center py-10">
      <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Positions Found</h3>
      <p className="text-gray-500">You don't have any positions yet. Start your investment journey!</p>
    </div>
  )

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
      <p className="text-gray-500 mt-3 text-base">Loading position data...</p>
    </div>
  )

  const renderPositionCard = (pos: PositionInfo, index: number, isSy: boolean) => (
    <div key={pos.id} className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-gray-100/50 p-5 hover:shadow-lg hover:border-blue-200/50 transition-all duration-300">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 rounded-lg flex items-center justify-center font-bold text-sm">
            #{index + 1}
          </div>
          <h3 className="text-base font-semibold text-gray-900">Position {formatAddress(pos.id)}</h3>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4 bg-gray-50/80 rounded-lg px-3 py-2 inline-block">
        State ID:{" "}
        {formatAddress(
          isSy
            ? pos.info.sy_state_id || pos.info.py_state_id || ""
            : pos.info.pt_state_id || pos.info.market_state_id || "",
        )}
      </p>

      <div className="space-y-2">
        <div className="flex justify-between items-start gap-2">
          <span className="text-xs text-gray-600 flex-shrink-0">Yield Token</span>
          <span className="text-xs font-medium text-blue-600 text-right break-all max-w-[180px] truncate" title={pos.info.yield_token}>
            {pos.info.yield_token}
          </span>
        </div>
        {isSy ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-600 block mb-1">PT Balance</span>
              <span className="text-xs font-medium text-green-600">
                {formatBalance(pos.info.pt_balance_display || "0")}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-600 block mb-1">YT Balance</span>
              <span className="text-xs font-medium text-purple-600">
                {formatBalance(pos.info.yt_balance_display || "0")}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <span className="text-xs text-gray-600 block mb-1">LP Liquidity</span>
            <span className="text-xs font-medium text-green-600">
              {formatBalance(pos.info.lp_amount_display || "0")}
            </span>
          </div>
        )}
      </div>
    </div>
  )

  const renderGroupedPositions = (positions: PositionInfo[], isSy: boolean) => {
    const grouped = groupPositionsByStateId(positions, isSy)

    return (
      <div className="space-y-8">
        {Object.entries(grouped).map(([stateId, group]) => (
          <div key={stateId} className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-gray-900">{group.description}</h3>
              <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full text-xs font-medium">
                {group.positions.length} positions
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {group.positions.map((pos, index) => renderPositionCard(pos, index, isSy))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const getUniquePools = (positions: PositionInfo[], isSy: boolean) => {
    const poolMap = new Map<string, string>()

    positions.forEach((pos) => {
      const stateId = isSy
        ? pos.info.sy_state_id || pos.info.py_state_id || "unknown"
        : pos.info.pt_state_id || pos.info.market_state_id || "unknown"

      if (!poolMap.has(stateId)) {
        // 格式化 ID 地址为简短省略格式
        const shortId = stateId.length > 12 
          ? `${stateId.slice(0, 6)}...${stateId.slice(-4)}`
          : stateId
        poolMap.set(stateId, shortId)
      }
    })

    return Array.from(poolMap.entries()).map(([id, shortId]) => ({ id, description: shortId }))
  }

  const filterPositionsByPool = (positions: PositionInfo[], selectedPool: string | null, isSy: boolean) => {
    if (!selectedPool) return positions

    return positions.filter((pos) => {
      const stateId = isSy
        ? pos.info.sy_state_id || pos.info.py_state_id || "unknown"
        : pos.info.pt_state_id || pos.info.market_state_id || "unknown"
      return stateId === selectedPool
    })
  }

  const renderPoolSelector = (
    positions: PositionInfo[],
    selectedPool: string | null,
    setSelectedPool: (pool: string | null) => void,
    isSy: boolean,
  ) => {
    const pools = getUniquePools(positions, isSy)

    if (pools.length === 0) return null

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedPool(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            selectedPool === null 
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" 
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm"
          }`}
        >
          All
        </button>
        {pools.map((pool) => (
          <button
            key={pool.id}
            onClick={() => setSelectedPool(pool.id)}
            title={pool.id} // 悬停显示完整 ID
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              selectedPool === pool.id 
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" 
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm"
            }`}
          >
            {pool.description}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-100/50 overflow-hidden">
          {/* Header with pool selector */}
          <div className="p-5 border-b border-blue-100/50 bg-gradient-to-r from-blue-50/80 to-indigo-50/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">SY Positions</h2>
                {!isSyLoading && syPositions.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">{syPositions.length} positions total</p>
                )}
              </div>
              {!isSyLoading && syPositions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Pool Filter:</span>
                  {renderPoolSelector(syPositions, selectedSyPool, setSelectedSyPool, true)}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="p-5 max-h-[400px] overflow-y-auto">
            {isSyLoading ? (
              renderLoading()
            ) : syPositions.length === 0 ? (
              renderEmptyState()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filterPositionsByPool(syPositions, selectedSyPool, true).map((pos, index) =>
                  renderPositionCard(pos, index, true),
                )}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100/50 overflow-hidden">
          {/* Header with pool selector */}
          <div className="p-5 border-b border-purple-100/50 bg-gradient-to-r from-purple-50/80 to-pink-50/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">PT Positions</h2>
                {!isPtLoading && ptPositions.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">{ptPositions.length} positions total</p>
                )}
              </div>
              {!isPtLoading && ptPositions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Pool Filter:</span>
                  {renderPoolSelector(ptPositions, selectedPtPool, setSelectedPtPool, false)}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="p-5 max-h-[400px] overflow-y-auto">
            {isPtLoading ? (
              renderLoading()
            ) : ptPositions.length === 0 ? (
              renderEmptyState()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filterPositionsByPool(ptPositions, selectedPtPool, false).map((pos, index) =>
                  renderPositionCard(pos, index, false),
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
