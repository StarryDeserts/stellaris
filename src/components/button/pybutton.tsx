"use client"

import { useEffect, useState } from "react"
import { useStellaris } from "@/contract/index"
import { useWallet } from "@aptos-labs/wallet-adapter-react"

export default function PyButton({ pystats }: { pystats: string }) {
  const { account } = useWallet()
  const { pyGetAllStates, pyInitPosition } = useStellaris()

  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)


  const handleCreatePosition = async () => {
    if (!account) return alert("请先连接钱包")

    setIsLoading(true)
    try {
      await pyInitPosition(pystats)
      alert("头寸创建成功！")
      setIsOpen(false)

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
                disabled={isLoading}
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
