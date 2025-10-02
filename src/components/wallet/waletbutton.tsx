"use client"

import {
  APTOS_CONNECT_ACCOUNT_URL,
  type AdapterWallet,
  type AdapterNotDetectedWallet,
  AptosPrivacyPolicy,
  WalletItem,
  getAptosConnectWallets,
  isAptosConnectWallet,
  isInstallRequired,
  partitionWallets,
  truncateAddress,
  useWallet,
} from "@aptos-labs/wallet-adapter-react"
import { ChevronDown, Copy, LogOut, User, Wallet, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Portal } from "./Portal" // 导入 Portal 组件

export function WalletSelector() {
  const { account, connected, disconnect, wallet } = useWallet()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const closeDialog = useCallback(() => setIsDialogOpen(false), [])

  const copyAddress = useCallback(async () => {
    if (!account?.address) return
    try {
      await navigator.clipboard.writeText(account.address.toStringLong())
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      console.error("Failed to copy wallet address.")
    }
  }, [account?.address])

  const handleMouseLeave = useCallback(() => {
    setIsDropdownOpen(false)
  }, [])

  // 阻止背景滚动当弹窗打开时
  useEffect(() => {
    if (isDialogOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isDialogOpen])

  return connected ? (
    <div className="relative inline-block" onMouseLeave={handleMouseLeave}>
      <button
        className="group relative px-6 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl border border-slate-700 hover:border-[#FFD700] transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-3 min-w-[200px]"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
        <span className="font-medium text-sm">
          {account?.ansName || truncateAddress(account?.address.toStringLong()) || "Unknown"}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""} group-hover:text-[#FFD700]`}
        />
      </button>

      {isDropdownOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-slate-50 to-[#E6E6FA]/20 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#FFD700] to-yellow-400 rounded-full flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-slate-900" />
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">Connected</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {account?.ansName || truncateAddress(account?.address.toStringLong())}
                  </p>
                </div>
              </div>
            </div>

            <div className="py-2">
              <button
                onClick={copyAddress}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#FFD700]/10 w-full text-left transition-colors duration-200 group"
              >
                <Copy className="h-4 w-4 text-slate-500 group-hover:text-[#FFD700] transition-colors" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {copySuccess ? "Copied!" : "Copy address"}
                </span>
                {copySuccess && <span className="text-xs text-emerald-500 ml-auto">✓</span>}
              </button>

              {wallet && isAptosConnectWallet(wallet) && (
                <a
                  href={APTOS_CONNECT_ACCOUNT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#FFD700]/10 w-full transition-colors duration-200 group"
                >
                  <User className="h-4 w-4 text-slate-500 group-hover:text-[#FFD700] transition-colors" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Account</span>
                </a>
              )}

              <button
                onClick={() => {
                  disconnect()
                  setIsDropdownOpen(false)
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left transition-colors duration-200 group"
              >
                <LogOut className="h-4 w-4 text-slate-500 group-hover:text-red-500 transition-colors" />
                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400">
                  Disconnect
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  ) : (
    <div>
      <button
        className="group relative px-8 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl border border-slate-700 hover:border-[#FFD700] transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-[#FFD700]/20 flex items-center gap-3 font-medium"
        onClick={() => setIsDialogOpen(true)}
      >
        <Wallet className="h-5 w-5 group-hover:text-[#FFD700] transition-colors" />
        Connect Wallet
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFD700]/0 to-[#FFD700]/0 group-hover:from-[#FFD700]/5 group-hover:to-[#FFD700]/10 rounded-xl transition-all duration-300" />
      </button>
      {isDialogOpen && <ConnectWalletDialog close={closeDialog} />}
    </div>
  )
}

interface ConnectWalletDialogProps {
  close: () => void
}

function ConnectWalletDialog({ close }: ConnectWalletDialogProps) {
  const { wallets = [] } = useWallet()

  const { aptosConnectWallets, otherWallets } = getAptosConnectWallets(wallets)
  const { defaultWallets, moreWallets } = partitionWallets(otherWallets)

  const [isMoreWalletsOpen, setIsMoreWalletsOpen] = useState(false)

  // 点击背景关闭弹窗
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      close()
    }
  }, [close])

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [close])

  return (
    <Portal>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-200"
        onClick={handleBackdropClick}
      >
        <div 
          className="bg-white dark:bg-slate-900 rounded-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()} // 阻止点击内容区域关闭
        >
          <div className="relative p-6 bg-gradient-to-r from-slate-50 to-[#E6E6FA]/30 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-600">
            <button
              onClick={close}
              className="absolute top-4 right-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors z-10"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-[#FFD700] to-yellow-400 rounded-full flex items-center justify-center mb-4">
                <Wallet className="h-6 w-6 text-slate-900" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Connect Your Wallet</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Choose your preferred wallet to get started</p>
            </div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {aptosConnectWallets.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#FFD700] rounded-full"></span>
                  Social Login
                </h3>
                <div className="space-y-3">
                  {aptosConnectWallets.map((wallet) => (
                    <AptosConnectWalletRow key={wallet.name} wallet={wallet} onConnect={close} />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <AptosPrivacyPolicy>
                <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                  <AptosPrivacyPolicy.Disclaimer />{" "}
                  <AptosPrivacyPolicy.Link className="underline hover:text-[#FFD700] transition-colors" />
                  <span>.</span>
                </p>
                <AptosPrivacyPolicy.PoweredBy className="flex gap-1.5 items-center justify-center mt-2 text-xs text-slate-500" />
              </AptosPrivacyPolicy>
            </div>

            {aptosConnectWallets.length > 0 && defaultWallets.length > 0 && (
              <div className="flex items-center gap-4 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
                <span className="text-xs text-slate-500 font-medium">OR</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
              </div>
            )}

            <div className="space-y-3">
              {defaultWallets.map((wallet) => (
                <WalletRow key={wallet.name} wallet={wallet} onConnect={close} />
              ))}

              {!!moreWallets.length && (
                <div className="space-y-3">
                  <button
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors duration-200 border border-dashed border-slate-300 dark:border-slate-600"
                    onClick={() => setIsMoreWalletsOpen(!isMoreWalletsOpen)}
                  >
                    <span className="text-sm font-medium">More wallets</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${isMoreWalletsOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isMoreWalletsOpen && (
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                      {moreWallets.map((wallet) => (
                        <WalletRow key={wallet.name} wallet={wallet} onConnect={close} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}

interface WalletRowProps {
  wallet: AdapterWallet | AdapterNotDetectedWallet
  onConnect?: () => void
}

function WalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem
      wallet={wallet}
      onConnect={onConnect}
      className="group flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-[#FFD700] hover:bg-[#FFD700]/5 transition-all duration-200 hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <WalletItem.Icon className="h-8 w-8 group-hover:scale-110 transition-transform duration-200" />
          <div className="absolute inset-0 bg-[#FFD700]/20 rounded-full scale-0 group-hover:scale-100 transition-transform duration-200" />
        </div>
        <WalletItem.Name className="text-base font-medium text-slate-900 dark:text-white" />
      </div>

      {isInstallRequired(wallet) ? (
        <WalletItem.InstallLink>
          <button className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-[#FFD700] border border-slate-300 dark:border-slate-600 hover:border-[#FFD700] rounded-lg transition-all duration-200">
            Install
          </button>
        </WalletItem.InstallLink>
      ) : (
        <WalletItem.ConnectButton>
          <button className="px-6 py-2 text-sm bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-[#FFD700] hover:to-yellow-500 hover:text-slate-900 rounded-lg transition-all duration-200 font-medium shadow-md hover:shadow-lg">
            Connect
          </button>
        </WalletItem.ConnectButton>
      )}
    </WalletItem>
  )
}

function AptosConnectWalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem wallet={wallet} onConnect={onConnect}>
      <WalletItem.ConnectButton>
        <button className="group w-full p-4 border-2 border-slate-200 dark:border-slate-700 hover:border-[#FFD700] rounded-xl flex items-center gap-4 transition-all duration-200 hover:bg-[#FFD700]/5 hover:shadow-md">
          <div className="relative">
            <WalletItem.Icon className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
            <div className="absolute inset-0 bg-[#FFD700]/20 rounded-full scale-0 group-hover:scale-100 transition-transform duration-200" />
          </div>
          <WalletItem.Name className="text-base font-medium text-slate-900 dark:text-white" />
        </button>
      </WalletItem.ConnectButton>
    </WalletItem>
  )
}