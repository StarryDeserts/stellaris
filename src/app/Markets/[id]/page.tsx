"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MarketsPageProps } from './types';
import { sliderStyles } from './constants';
import { getInputLabel, getOutputLabel, getExchangeRateHint } from './utils';
import { 
  useUserPositions, 
  useDetailedPositions, 
  useSwapCalculation, 
  useSwapState 
} from './hooks';
import { useTokenBalance } from './hooks/useTokenBalance';
import { 
  useCreatePositionHandler, 
  useSwapHandler, 
  useAmountChangeHandler 
} from './handlers';
import {
  PoolHeader,
  PoolDetails,
  TabSelector,
  PositionSelector,
  AmountInput,
  SlippageControl
} from './components';

export default function MarketsPage({ params }: MarketsPageProps) {
  const searchParams = useSearchParams();
  
  // 获取正确的 poolId
  const poolId = searchParams.get("poolId") || params.id;
  
  // 使用自定义hooks
  const { positions, loadUserPositions } = useUserPositions();
  const { calculateWithCache } = useSwapCalculation();
  const { sthBalance, syBalance, isLoading: balanceLoading, refreshBalances } = useTokenBalance(poolId);
  const {
    swapAmount,
    setSwapAmount,
    convertedAmount,
    setConvertedAmount,
    isSwapLoading,
    setIsSwapLoading,
    swapStatus,
    setSwapStatus,
    selectedTab,
    setSelectedTab,
    selectedPosition,
    setSelectedPosition,
    slippage,
    setSlippage,
    resetAmounts
  } = useSwapState();

  // 使用防抖ref
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 池子数据
  const poolData = useMemo(() => {
    const pyStatsParam = searchParams.get("pystats");
    return {
      poolId: poolId,
      name: searchParams.get("name") || "",
      liquidity: Number(searchParams.get("liquidity")) || 0,
      baseAPY: Number(searchParams.get("baseAPY")) || 0,
      expiry: Number(searchParams.get("expiry")) || 0,
      icon: searchParams.get("icon") || undefined,
      pystats: pyStatsParam || poolId,
    };
  }, [searchParams, poolId]);

  // 过滤相关持仓
  const filteredPositions = useMemo(() => {
    if (!poolData?.pystats || positions.length === 0) return [];
    return positions.filter((position) => position.info?.[0] === poolData.pystats);
  }, [positions, poolData?.pystats]);

  // 加载详细持仓信息
  const { detailedPositions } = useDetailedPositions(
    filteredPositions.map(pos => pos.id)
  );

  // 处理选中持仓重置
  useEffect(() => {
    if (selectedPosition && !filteredPositions.some((pos) => pos.id === selectedPosition)) {
      setSelectedPosition("");
    }
  }, [selectedPosition, filteredPositions, setSelectedPosition]);

  // 业务逻辑处理函数
  const handleCreatePosition = useCreatePositionHandler();
  const handleSwap = useSwapHandler();
  const handleAmountChange = useAmountChangeHandler(selectedTab, calculateWithCache);

  // 统一数据刷新函数
  const refreshData = useCallback(async () => {
    await Promise.all([
      loadUserPositions(true),
      refreshBalances()
    ]);
  }, [loadUserPositions, refreshBalances]);

  // 处理创建持仓
  const onCreatePosition = useCallback(async () => {
    await handleCreatePosition(poolData, setIsSwapLoading, () => {
      refreshData();
    });
  }, [handleCreatePosition, poolData, setIsSwapLoading, refreshData]);

  // 处理交换
  const onSwap = useCallback(async () => {
    await handleSwap(
      poolData,
      poolId,
      swapAmount,
      selectedTab,
      selectedPosition,
      slippage,
      setIsSwapLoading,
      setSwapStatus,
      () => {
        resetAmounts();
        refreshData();
      }
    );
  }, [
    handleSwap, 
    poolData, 
    poolId, 
    swapAmount, 
    selectedTab, 
    selectedPosition, 
    slippage, 
    setIsSwapLoading, 
    setSwapStatus, 
    resetAmounts, 
    refreshData
  ]);

  // 处理输入A变化
  const handleAChange = useCallback(async (value: number) => {
    const poolStats = poolData?.pystats;
    
    // 立即更新输入框显示
    setSwapAmount(value);
    
    if (!poolStats || !poolId) {
      setConvertedAmount(undefined);
      return;
    }

    // 清除之前的防抖定时器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 对计算逻辑进行防抖（减少到200ms）
      debounceTimeoutRef.current = setTimeout(async () => {
      await handleAmountChange('A', value, poolStats, poolId, setSwapAmount, setConvertedAmount);
    }, 200);
  }, [poolData?.pystats, poolId, handleAmountChange, setSwapAmount, setConvertedAmount]);

  // 处理输入B变化
  const handleBChange = useCallback(async (value: number) => {
    const poolStats = poolData?.pystats;
    
    // 立即更新输入框显示
    setConvertedAmount(value);
    
    if (!poolStats || !poolId) {
      setSwapAmount(undefined);
      return;
    }
    
    // 清除之前的防抖定时器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 对计算逻辑进行防抖（减少到200ms）
    debounceTimeoutRef.current = setTimeout(async () => {
      await handleAmountChange('B', value, poolStats, poolId, setSwapAmount, setConvertedAmount);
    }, 200);
  }, [poolData?.pystats, poolId, handleAmountChange, setSwapAmount, setConvertedAmount]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // 根据标签页获取对应的余额
  const getTokenBalance = useCallback((tab: string, isInput: boolean) => {
    if (tab === 'SY') {
      return isInput ? sthBalance : syBalance;
    } else if (tab === 'PT') {
      return isInput ? syBalance : undefined; // PT输出暂时不显示余额
    } else if (tab === 'YT') {
      return isInput ? syBalance : undefined; // YT输出暂时不显示余额
    }
    return undefined;
  }, [sthBalance, syBalance]);

  if (!poolData) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-gray-900 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <style jsx>{sliderStyles}</style>
      <div className="min-h-screen pt-20 bg-gradient-to-br from-gray-50 to-blue-50/20 dark:from-gray-900 dark:to-blue-900/10">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 左侧内容 - 调整为5列宽度 */}
          <div className="lg:col-span-7 space-y-6">
              <PoolHeader poolData={poolData} />
              <PoolDetails poolData={poolData} />
            </div>

            {/* 右侧交易面板 - 调整为7列宽度 */}
          <div className="lg:col-span-5 space-y-6">
              {/* 创建持仓按钮 */}
            <div className="flex items-center gap-4">
              <button
                  onClick={onCreatePosition}
                  disabled={isSwapLoading}
                className="py-3 px-5 border-2 border-blue-500 text-blue-500 font-semibold rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50 shadow-md whitespace-nowrap"
              >
                {isSwapLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </div>
                  ) : "Create New Position"}
              </button>
              <span className="text-sm text-gray-600">Initialize a new position in the pool</span>
            </div>

              {/* 交易面板 */}
            <div className="bg-[#eeeeee] rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Deposit Amount</h2>

                {/* 标签选择器 */}
                <TabSelector selectedTab={selectedTab} onTabChange={setSelectedTab} />

                <div className="space-y-4">
                  {/* PT模式下的持仓选择器 */}
                  {selectedTab === 'PT' && (
                    <PositionSelector
                      selectedPosition={selectedPosition}
                      onPositionChange={setSelectedPosition}
                      positions={filteredPositions}
                      detailedPositions={detailedPositions}
                      isLoading={isSwapLoading}
                    />
                  )}

                  {/* 输入数量 */}
                  <AmountInput
                    label={getInputLabel(selectedTab, poolData.name)}
                    value={swapAmount}
                    onChange={handleAChange}
                    placeholder={selectedTab === 'PT' && filteredPositions.length === 0 ? "No positions available" : "Enter amount"}
                    disabled={isSwapLoading || (selectedTab === 'PT' && filteredPositions.length === 0)}
                    balance={getTokenBalance(selectedTab, true)}
                    balanceLoading={balanceLoading}
                  />

                  {/* 箭头 */}
                <div className="flex justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                  {/* 输出数量 */}
                  <AmountInput
                    label={getOutputLabel(selectedTab, poolData.name)}
                    value={convertedAmount}
                    onChange={handleBChange}
                    placeholder={selectedTab === 'PT' && filteredPositions.length === 0 ? "Position required" : "Output amount"}
                    disabled={isSwapLoading || (selectedTab === 'PT' && filteredPositions.length === 0)}
                    balance={getTokenBalance(selectedTab, false)}
                    balanceLoading={balanceLoading}
                  />


                  {/* PT模式下的滑点控制 */}
                {selectedTab === 'PT' && (
                    <SlippageControl
                      slippage={slippage}
                      onSlippageChange={setSlippage}
                      minReceived={convertedAmount}
                    />
                  )}

                  {/* 确认按钮 */}
                <div className="flex justify-center">
                  <button
                      onClick={onSwap}
                      disabled={isSwapLoading || !swapAmount || swapAmount <= 0 || selectedTab === 'YT'}
                      className={`py-3 px-5 font-semibold rounded-xl transition-colors shadow-md whitespace-nowrap ${
                        selectedTab === 'YT' 
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 disabled:opacity-50'
                      }`}
                  >
                    {isSwapLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </div>
                      ) : selectedTab === 'YT' ? (
                        "YT Swap Coming Soon"
                    ) : (
                      "Confirm Swap"
                    )}
                  </button>
                </div>

                  {/* 状态显示 */}
                  {swapStatus && (
                    <div className="text-center text-sm text-gray-600 mt-2">
                      {swapStatus}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}