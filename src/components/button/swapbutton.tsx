"use client"

import { useEffect, useState } from "react"
import { useStellaris } from "@/contract/index"

export default function SwapDepositModal() {
  const { syDeposit, pyGetAllStates } = useStellaris()
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState<number>()
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {}, [pyGetAllStates])

  const handleDeposit = async () => {
    if (!amount || amount <= 0) {
      setStatus("请输入有效数量")
      return
    }

    try {
      const realAmount = amount * 100000000
      setIsLoading(true)
      setStatus("交易进行中...")
      const txHash = await syDeposit(
        realAmount,
        "0xdb4660e349e5c784a9d4ad93fa157fa9d3651c6b1af0b1ece5a44d5350fc36e",
        "0xf36349bfb5b8a9f7f26417c596d349c0136de5d831c55f3d5432bd254ce832ef",
      )
      setStatus(`交易成功！TxHash: ${txHash}`)
      setTimeout(() => {
        setIsOpen(false)
        setAmount(undefined)
        setStatus("")
      }, 3000)
    } catch (err) {
      console.error(err)
      setStatus("交易失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  const closeModal = () => {
    if (!isLoading) {
      setIsOpen(false)
      setAmount(undefined)
      setStatus("")
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#FFD700]/20 focus:outline-none focus:ring-4 focus:ring-[#FFD700]/30"
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <span className="relative z-10 flex items-center gap-3">
          <svg
            className="w-5 h-5 transition-colors duration-300 group-hover:text-[#FFD700]"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          兑换 SY-sthAPT
        </span>
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFD700]/0 via-[#FFD700]/10 to-[#FFD700]/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={closeModal}
          ></div>

          {/* Modal Content */}
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
            {/* Header */}
            <div className="relative p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">SY Token 兑换</h3>
                    <p className="text-sm" style={{ color: "#E6E6FA" }}>
                      sthAPT → SY-sthAPT (1:1)
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  disabled={isLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Exchange Info */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">兑换比例</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">1 sthAPT = 1 SY-sthAPT</span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">兑换数量</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="请输入 sthAPT 数量"
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 disabled:opacity-50"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">sthAPT</span>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {amount && amount > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">消耗</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">-{amount} sthAPT</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">获得</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">+{amount} SY-sthAPT</span>
                  </div>
                </div>
              )}

              {/* Status Message */}
              {status && (
                <div
                  className={`p-3 rounded-lg text-sm font-medium ${
                    status.includes("成功")
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700"
                      : status.includes("失败")
                        ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700"
                        : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700"
                  }`}
                >
                  {status}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={closeModal}
                disabled={isLoading}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 font-medium disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDeposit}
                disabled={isLoading || !amount || amount <= 0}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-[#FFD700]/20 focus:outline-none focus:ring-4 focus:ring-[#FFD700]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    处理中...
                  </div>
                ) : (
                  "确认兑换"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
