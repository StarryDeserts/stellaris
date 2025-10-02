"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useStellaris } from "@/contract/index"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { notifyError, notifySuccess, notifyWarning } from "@/components/ToastProvider"
import { useTokenBalance } from "@/app/Markets/[id]/hooks/useTokenBalance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, TrendingUp, DollarSign, Calendar, Clock, Loader2 } from "lucide-react"

interface MarketsPageProps {
  params: { poolId: string }
}

interface PyStats {
  poolId: string
  name: string
  icon?: string
  baseAPY: number
  expiry: number
  liquidity: number
  pystats: string
  [key: string]: any
}

interface PositionInfo {
  id: string
  info: {
    py_state_id: string
    [key: string]: any
  }
}

interface DetailedPositionInfo {
  id: string
  description?: string
  expiry_days?: string
  pt_balance_display?: string
  yt_balance_display?: string
  yield_token?: string
  py_state_id?: string
}

export default function PoolDetailsPage({ params }: MarketsPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { account } = useWallet()
  const {
    marketSeedLiquidity,
    pyPosGetUserPositionAddress,
    pyPosGetPyStateId,
    marketGetBindingPyState,
    pyPosGetPositionInfo,
  } = useStellaris()

  const [poolData, setPoolData] = useState<PyStats | null>(null)
  const [liquidityAmount, setLiquidityAmount] = useState<number>()
  const [selectedPosition, setSelectedPosition] = useState<string>("")
  const [positions, setPositions] = useState<PositionInfo[]>([])
  const [detailedPositions, setDetailedPositions] = useState<DetailedPositionInfo[]>([])
  const [poolidlist, setPoolidlist] = useState<string>()
  const [isLoadingPositions, setIsLoadingPositions] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const loadingRef = useRef(false)
  const lastFetchTimeRef = useRef<number>(0)

  // Get poolId from search params or params
  const poolId = searchParams.get("poolId") || params?.poolId || ""

  // 获取代币余额
  const { sthBalance, syBalance, isLoading: balanceLoading, refreshBalances } = useTokenBalance(poolId)

  // Load pool data from search params
  useEffect(() => {
    const pyStatsParam = searchParams.get("pystats")
    const data: PyStats = {
      poolId: params?.poolId || "",
      name: searchParams.get("name") || "",
      liquidity: Number(searchParams.get("liquidity")) || 0,
      baseAPY: Number(searchParams.get("baseAPY")) || 0,
      expiry: Number(searchParams.get("expiry")) || 0,
      icon: searchParams.get("icon") || undefined,
      pystats: pyStatsParam || params?.poolId || "",
    }
    setPoolData(data)
  }, [searchParams, params?.poolId])

  // Load user positions and poolidlist
  useEffect(() => {
    if (!account?.address) {
      setIsLoadingPositions(false)
      return
    }

    if (loadingRef.current) {
      return
    }

    const currentPoolId = searchParams.get("poolId") || params?.poolId || ""
    if (!currentPoolId) {
      setIsLoadingPositions(false)
      return
    }

    // Prevent loading too frequently
    const now = Date.now()
    if (lastFetchTimeRef.current && (now - lastFetchTimeRef.current) < 5000) {
      return
    }

    async function loadUserPositions() {
      loadingRef.current = true
      setIsLoadingPositions(true)

      try {
        const bindingPyState = await marketGetBindingPyState(currentPoolId)
        setPoolidlist(bindingPyState[0])

        const rawIds = await pyPosGetUserPositionAddress(account!.address.toString())
        const ids = Array.isArray(rawIds[0]) ? rawIds[0] : []

        const infos = await Promise.all(
          ids.map(async (id: string) => {
            const info = await pyPosGetPyStateId(id)
            return {
              id,
              info: {
                py_state_id: info[0] || "",
                ...info,
              },
            }
          })
        )

        setPositions(infos)
        lastFetchTimeRef.current = Date.now()
      } catch (err) {
        console.error("Error loading user positions:", err)
        notifyError("Failed to load user positions")
      } finally {
        setIsLoadingPositions(false)
        loadingRef.current = false
      }
    }

    loadUserPositions()
  }, [account?.address, searchParams, params?.poolId])

  // Memoized filtered positions
  const filteredPositions = useMemo(() => {
    return positions.filter((position) => position.info?.py_state_id === poolidlist)
  }, [positions, poolidlist])

  // Check if user has no positions or no matching positions
  const hasNoPositions = !isLoadingPositions && (!account?.address || positions.length === 0 || filteredPositions.length === 0)

  // Load detailed positions when filtered positions change
  useEffect(() => {
    if (filteredPositions.length === 0) return

    async function loadDetailedPositions() {
      setIsLoadingDetails(true)

      try {
        const detailed = await Promise.all(
          filteredPositions.map(async (position) => {
            try {
              const detailInfo = await pyPosGetPositionInfo(position.id)

              return {
                id: position.id,
                description: detailInfo?.description || "",
                expiry_days: String(detailInfo?.expiry_days || "0"),
                pt_balance_display: detailInfo?.pt_balance_display || "0",
                yt_balance_display: detailInfo?.yt_balance_display || "0",
                yield_token: detailInfo?.yield_token || "",
                py_state_id: detailInfo?.py_state_id || "",
              }
            } catch (err) {
              console.error(`Failed to get details for position ${position.id}:`, err)
              return {
                id: position.id,
                description: "",
                expiry_days: "0",
                pt_balance_display: "0",
                yt_balance_display: "0",
                yield_token: "",
                py_state_id: "",
              }
            }
          })
        )

        setDetailedPositions(detailed)
      } catch (err) {
        console.error("Error loading position details:", err)
      } finally {
        setIsLoadingDetails(false)
      }
    }

    loadDetailedPositions()
  }, [filteredPositions])

  // Reset selected position if not in filtered
  useEffect(() => {
    if (selectedPosition && !filteredPositions.some((pos) => pos.id === selectedPosition)) {
      setSelectedPosition("")
    }
  }, [filteredPositions, selectedPosition])

  const formatLiquidity = useCallback((value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
    return `$${value.toFixed(3)}`
  }, [])

  const formatTokenAmount = useCallback((amount: string) => {
    const num = Number.parseFloat(amount)
    if (isNaN(num) || num === 0) return "0.0000"
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
    return num.toFixed(4)
  }, [])

  // 格式化余额显示，与Markets页面保持一致
  const formatBalance = useCallback((balance: string): string => {
    const num = Math.floor(Number(balance) / 100000000); // 假设余额是8位小数，取整数部分
    if (num >= 1000000) return `${Math.floor(num / 1000000)}M`;
    if (num >= 1000) return `${Math.floor(num / 1000)}K`;
    return num.toString();
  }, [])

  const formatDate = useCallback((timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    , [])

  const getDaysLeft = useCallback((timestamp: number) => {
    const now = Date.now()
    const diff = timestamp - now
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days > 0 ? `${days} days` : "Expired"
  }, [])

  const handleSeedLiquidity = useCallback(async () => {
    if (!liquidityAmount || liquidityAmount <= 0) {
      notifyWarning("Please enter a valid amount")
      return
    }
    if (!selectedPosition) {
      notifyWarning("Please select a position")
      return
    }
    if (!poolData) return

    try {
      setIsSubmitting(true)
      const realAmount = liquidityAmount * 100_000_000
      await marketSeedLiquidity(
        realAmount,
        selectedPosition,
        poolData.pystats,
        poolId,
      )
      notifySuccess(`🎉 Added successfully!`)
      setLiquidityAmount(undefined)
      setSelectedPosition("")
      
      // 刷新余额数据
      await refreshBalances()
      
      // 重新加载位置数据
      if (account?.address) {
        try {
          setIsLoadingPositions(true)
          const rawIds = await pyPosGetUserPositionAddress(account.address.toString())
          const ids = Array.isArray(rawIds[0]) ? rawIds[0] : []

          const infos = await Promise.all(
            ids.map(async (id: string) => {
              const info = await pyPosGetPyStateId(id)
              return {
                id,
                info: {
                  py_state_id: info[0] || "",
                  ...info,
                },
              }
            })
          )

          setPositions(infos)
          lastFetchTimeRef.current = Date.now()
        } catch (refreshErr) {
          console.error("Error refreshing positions:", refreshErr)
        } finally {
          setIsLoadingPositions(false)
        }
      }
    } catch (err) {
      console.error(err)
      notifyError("Transaction failed, please try again")
    } finally {
      setIsSubmitting(false)
    }
  }, [liquidityAmount, selectedPosition, poolData, poolId, account?.address, pyPosGetUserPositionAddress, pyPosGetPyStateId])

  const handleBack = useCallback(() => {
    router.push("/Pools")
  }, [router])

  const handleCreatePosition = useCallback(() => {
    // Navigate to Markets page with current pool data
    const queryParams = new URLSearchParams({
      poolId: poolData?.poolId || "",
      name: poolData?.name || "",
      liquidity: poolData?.liquidity?.toString() || "0",
      baseAPY: poolData?.baseAPY?.toString() || "0",
      expiry: poolData?.expiry?.toString() || "0",
      icon: poolData?.icon || "",
      pystats: poolData?.pystats || ""
    })
    router.push(`/Markets/${poolData?.poolId || params?.poolId}?${queryParams.toString()}`)
  }, [router, poolData, params?.poolId])

  if (!poolData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Header Navigation */}
        <div className="mb-4">
          <Button
            onClick={handleBack}
            variant="outline"
            className="bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-700 dark:text-gray-200 hover:text-gray-800 dark:hover:text-gray-100 border-0 px-6 py-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 text-sm font-medium"
          >
            Back
          </Button>
        </div>

        {/* Pool Information Header */}
        <PoolHeader
          poolData={poolData}
          poolId={poolId}
          formatLiquidity={formatLiquidity}
          formatDate={formatDate}
          getDaysLeft={getDaysLeft}
        />

        {/* 简短信息提示 */}
        <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700 flex items-center">
          <div className="flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="ml-2 text-sm text-gray-600 dark:text-gray-300">
            Select a position from the dropdown and enter the amount to add liquidity to this pool.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Liquidity Section - 占据左侧2/3 */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <AddLiquidity
              isLoadingPositions={isLoadingPositions}
              isLoadingDetails={isLoadingDetails}
              filteredPositions={filteredPositions}
              detailedPositions={detailedPositions}
              selectedPosition={selectedPosition}
              setSelectedPosition={setSelectedPosition}
              liquidityAmount={liquidityAmount}
              setLiquidityAmount={setLiquidityAmount}
              isSubmitting={isSubmitting}
              handleSeedLiquidity={handleSeedLiquidity}
              formatTokenAmount={formatTokenAmount}
              formatBalance={formatBalance}
              hasNoPositions={hasNoPositions}
              handleCreatePosition={handleCreatePosition}
              balanceLoading={balanceLoading}
              syBalance={syBalance}
            />
          </div>

          {/* Position Details Sidebar - 占据右侧1/3 */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <PositionDetails
              selectedPosition={selectedPosition}
              detailedPositions={detailedPositions}
              formatTokenAmount={formatTokenAmount}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface PoolHeaderProps {
  poolData: PyStats
  poolId: string
  formatLiquidity: (value: number) => string
  formatDate: (timestamp: number) => string
  getDaysLeft: (timestamp: number) => string
}

function PoolHeader({ poolData, poolId, formatLiquidity, formatDate, getDaysLeft }: PoolHeaderProps) {
  return (
    <Card className="mb-6 border-0 shadow-md bg-white dark:bg-gray-900 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* 左侧：池子信息 */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={poolData.icon || "/placeholder.svg?height=48&width=48&query=crypto token"}
                alt={poolData.name}
                className="w-14 h-14 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                {poolData.name}
              </h1>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono cursor-help"
                  title={poolId || 'Loading...'}
                >
                  {poolId ? poolId.slice(0, 8) + '...' + poolId.slice(-6) : 'Loading...'}
                </Badge>
              </div>
            </div>
          </div>

          {/* 右侧：统计卡片 */}
          <div className="flex flex-wrap gap-3 mt-2 md:mt-0">
            {/* APY 标签 */}
            <div className="flex items-center bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-xs font-medium text-green-800 dark:text-green-300 mr-1">APY:</span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">{poolData.baseAPY}%</span>
            </div>

            {/* 流动性标签 */}
            <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-xs font-medium text-blue-800 dark:text-blue-300 mr-1">Liquidity:</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatLiquidity(poolData.liquidity)}</span>
            </div>

            {/* 到期时间标签 */}
            <div className="flex items-center bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-800">
              <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-2" />
              <span className="text-xs font-medium text-purple-800 dark:text-purple-300 mr-1">Expires:</span>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 leading-tight">{formatDate(poolData.expiry)}</span>
                <span className="text-xs text-purple-500 dark:text-purple-400 font-medium leading-tight">{getDaysLeft(poolData.expiry)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface AddLiquidityProps {
  isLoadingPositions: boolean
  isLoadingDetails: boolean
  filteredPositions: PositionInfo[]
  detailedPositions: DetailedPositionInfo[]
  selectedPosition: string
  setSelectedPosition: (value: string) => void
  liquidityAmount: number | undefined
  setLiquidityAmount: (value: number | undefined) => void
  isSubmitting: boolean
  handleSeedLiquidity: () => void
  formatTokenAmount: (amount: string) => string
  formatBalance: (balance: string) => string
  hasNoPositions: boolean
  handleCreatePosition: () => void
  balanceLoading: boolean
  syBalance: string
}

function AddLiquidity({
  isLoadingPositions,
  isLoadingDetails,
  filteredPositions,
  detailedPositions,
  selectedPosition,
  setSelectedPosition,
  liquidityAmount,
  setLiquidityAmount,
  isSubmitting,
  handleSeedLiquidity,
  formatTokenAmount,
  formatBalance,
  hasNoPositions,
  handleCreatePosition,
  balanceLoading,
  syBalance,
}: AddLiquidityProps) {
  return (
    <div className="xl:col-span-3">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            Add Liquidity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="position" className="text-sm font-medium text-foreground">
              Select Position
            </Label>
            {isLoadingPositions ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Loading positions...
              </div>
            ) : (
              <Select value={selectedPosition} onValueChange={setSelectedPosition} disabled={hasNoPositions || isLoadingDetails}>
                <SelectTrigger id="position" className="h-12">
                  <SelectValue placeholder={hasNoPositions ? "No positions available" : "Select a position to add liquidity"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto bg-background border border-border rounded-lg shadow-lg">
                  {isLoadingDetails && filteredPositions.length > 0 ? (
                    <div className="flex items-center justify-center py-6 px-4 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span>Loading position details...</span>
                    </div>
                  ) : filteredPositions.length === 0 ? (
                    <div className="py-6 px-4 text-center text-muted-foreground">
                      <DollarSign className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <span>No positions available</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredPositions.map((position) => {
                        const details = detailedPositions.find((d) => d.id === position.id)
                        const ptBalance = details?.pt_balance_display || "0"
                        const ytBalance = details?.yt_balance_display || "0"
                        const formattedPtBalance = formatTokenAmount(ptBalance)
                        const formattedYtBalance = formatTokenAmount(ytBalance)

                        return (
                          <SelectItem
                            key={position.id}
                            value={position.id}
                            className="py-3 px-4 hover:bg-accent/10 focus:bg-accent/20 transition-colors cursor-pointer"
                          >
                            <div className="grid grid-cols-2 gap-8 items-center w-full text-sm">
                              {/* 左侧 PT */}
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-emerald-600 min-w-[24px]">PT:</span>
                                <span className="font-semibold font-mono text-right min-w-[60px]">{formattedPtBalance}</span>
                              </div>

                              {/* 右侧 YT */}
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-amber-600 min-w-[24px]">YT:</span>
                                <span className="font-semibold font-mono text-right min-w-[60px]">{formattedYtBalance}</span>
                              </div>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount" className="text-sm font-medium text-foreground">
                SY Amount
              </Label>
              {balanceLoading ? (
                <span className="text-gray-400 text-sm">Loading...</span>
              ) : (
                <span className="text-sm">
                  <span className="text-gray-500">Balance: </span>
                  <span className="text-blue-600 font-semibold">{formatBalance(syBalance)}</span>
                </span>
              )}
            </div>
            <Input
              id="amount"
              type="number"
              value={liquidityAmount || ""}
              onChange={(e) => setLiquidityAmount(e.target.value ? Number(e.target.value) : undefined)}
              placeholder={hasNoPositions ? "Position required" : "Enter amount to add"}
              disabled={hasNoPositions || !selectedPosition || isLoadingDetails}
              className="h-12"
            />
          </div>

          {hasNoPositions ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm mb-4">
                  No positions found for this pool. Create a position first to add liquidity.
                </p>
                <Button
                  onClick={handleCreatePosition}
                  className="w-auto px-8 h-12 text-base font-medium"
                  size="lg"
                >
                  Create Position
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleSeedLiquidity}
              disabled={isSubmitting || !liquidityAmount || liquidityAmount <= 0 || !selectedPosition || isLoadingDetails}
              className="w-auto px-8 h-12 text-base font-medium mx-auto"
              size="lg"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </div>
              ) : (
                "Confirm Add Liquidity"
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface PositionDetailsProps {
  selectedPosition: string
  detailedPositions: DetailedPositionInfo[]
  formatTokenAmount: (amount: string) => string
}

function PositionDetails({ selectedPosition, detailedPositions, formatTokenAmount }: PositionDetailsProps) {
  const selectedPositionDetails = detailedPositions.find((pos) => pos.id === selectedPosition)

  return (
    <div className="xl:col-span-2">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Position Details</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPosition && selectedPositionDetails ? (
            <div className="space-y-4">
              <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                <h4 className="text-sm font-medium mb-3 text-foreground">Selected Position</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Position ID:</span>
                    <span 
                      className="font-mono text-xs bg-muted px-2 py-1 rounded cursor-help"
                      title={selectedPosition || 'N/A'}
                    >
                      {selectedPosition ? selectedPosition.slice(0, 8) + '...' : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Description:</span>
                    <span className="text-right max-w-32 truncate">
                      {selectedPositionDetails.description || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Days Remaining:</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedPositionDetails.expiry_days} days
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="text-sm font-medium text-foreground">Token Balances</h5>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-0 bg-emerald-50 dark:bg-emerald-950/20">
                    <CardContent className="p-3 text-center">
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">PT</div>
                      <div className="text-sm font-bold text-emerald-600">
                        {formatTokenAmount(selectedPositionDetails.pt_balance_display || "0")}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 bg-amber-50 dark:bg-amber-950/20">
                    <CardContent className="p-3 text-center">
                      <div className="text-xs text-amber-700 dark:text-amber-400 mb-1">YT</div>
                      <div className="text-sm font-bold text-amber-600">
                        {formatTokenAmount(selectedPositionDetails.yt_balance_display || "0")}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <DollarSign className="h-8 w-8" />
              </div>
              <p className="text-sm">Select a position to view details</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}