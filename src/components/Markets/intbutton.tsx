"use client"

import { useEffect, useState } from "react"
import { useStellaris } from "@/contract/index"
import { useWallet } from "@aptos-labs/wallet-adapter-react"

export default function PyPositionManager() {
  const { account } = useWallet()
  const { pyGetAllStates, pyInitPosition } = useStellaris()

  const [pyStates, setPyStates] = useState<string[]>([])
  const [selectedState, setSelectedState] = useState<string>("")
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 获取链上所有 PY 状态对象
  useEffect(() => {
    async function loadStates() {
      try {
        const result = await pyGetAllStates()
        setPyStates(result[0] || [])
      } catch (error) {
        console.error("加载状态对象失败:", error)
      }
    }
    loadStates()
  }, [pyGetAllStates])

  const handleCreatePosition = async () => {
    if (!selectedState) return alert("请选择一个 PY 状态对象")
    if (!account) return alert("请先连接钱包")

    setIsLoading(true)
    try {
      await pyInitPosition(selectedState)
      alert("头寸创建成功！")
      setIsOpen(false)
      setSelectedState("")
    } catch (err) {
      console.error(err)
      alert("创建头寸失败: " + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4">
      {/* 创建头寸按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        disabled={!account}
        className="bg-[#0B0C1D] text-[#E6E6FA] px-4 py-2 rounded-lg shadow-md 
                   hover:bg-[#FFD700] hover:text-black transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {account ? "创建头寸" : "请先连接钱包"}
      </button>

      {/* 弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-[#0B0C1D] text-[#E6E6FA] rounded-2xl p-6 w-96 shadow-lg">
            <h2 className="text-lg font-bold mb-4">选择 PY 状态对象</h2>

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="border border-gray-600 p-2 mb-4 w-full bg-[#0B0C1D] text-[#E6E6FA] rounded"
              disabled={isLoading}
            >
              <option value="">请选择一个状态对象</option>
              {pyStates.map((state) => (
                <option key={state} value={state} className="bg-[#0B0C1D] text-[#E6E6FA]">
                  {state}
                </option>
              ))}
            </select>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleCreatePosition}
                disabled={isLoading || !selectedState}
                className="px-4 py-2 rounded bg-[#FFD700] text-black hover:opacity-90 
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "创建中..." : "确认创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
