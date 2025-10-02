// 市场页面自定义hooks

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useStellaris } from "@/contract/index";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { notifyError, notifySuccess } from "@/components/ToastProvider";
import { 
  PositionInfo, 
  DetailedPositionInfo, 
  DataCache, 
  CalculationCache,
  CalculationType,
  TabType
} from './types';
import { 
  CACHE_CONFIG, 
  VALUE_CONFIG 
} from './constants';
import { 
  validateCalculationInputs, 
  toContractAmount, 
  fromContractAmount 
} from './utils';

/**
 * 用户持仓数据管理Hook
 */
export const useUserPositions = () => {
  const { account } = useWallet();
  const { pyPosGetUserPositionAddress, pyPosGetPyStateId } = useStellaris();
  
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const loadingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const pendingRequestsRef = useRef<Set<string>>(new Set());
  const dataCacheRef = useRef<DataCache>({
    positions: { data: [], timestamp: 0 },
    detailedPositions: { data: [], timestamp: 0, positionIds: [] }
  });

  const loadUserPositions = useCallback(async (forceRefresh = false) => {
    if (!account?.address) return;

    const now = Date.now();
    const cacheKey = `positions-${account.address}`;
    
    // 检查缓存是否有效（包括空结果的缓存）
    const cached = dataCacheRef.current.positions;
    if (!forceRefresh && cached.timestamp > 0 && (now - cached.timestamp) < CACHE_CONFIG.POSITIONS_CACHE_EXPIRY) {
      console.log("🎯 Using cached positions data");
      setPositions(cached.data);
      return;
    }

    // 防止重复请求
    if (pendingRequestsRef.current.has(cacheKey)) {
      console.log("⏳ Positions request already pending, skipping...");
      return;
    }

    if (loadingRef.current) return;

    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    if (!forceRefresh && timeSinceLastFetch < CACHE_CONFIG.MIN_FETCH_INTERVAL) {
      return;
    }

    try {
      pendingRequestsRef.current.add(cacheKey);
      loadingRef.current = true;
      
      console.log("🔄 Loading user positions...");
      const rawIds = await pyPosGetUserPositionAddress(account.address.toString());
      const ids = Array.isArray(rawIds[0]) ? rawIds[0] : [];

      const infos = await Promise.all(
        ids.map(async (id: string) => {
          const info = await pyPosGetPyStateId(id);
          return { id, info };
        }),
      );

      // 更新缓存和状态
      dataCacheRef.current.positions = { data: infos, timestamp: now };
      setPositions(infos);
      lastFetchTimeRef.current = now;
      
      console.log("✅ Positions loaded successfully");
    } catch (err) {
      console.error("❌ Error loading user positions:", err);
      notifyError("Failed to load user positions");
    } finally {
      loadingRef.current = false;
      pendingRequestsRef.current.delete(cacheKey);
    }
  }, [account?.address]);

  useEffect(() => {
    loadUserPositions();
  }, [loadUserPositions]);

  return {
    positions,
    loadUserPositions,
    isLoading: loadingRef.current
  };
};

/**
 * 详细持仓信息管理Hook
 */
export const useDetailedPositions = (positionIds: string[]) => {
  const { pyPosGetPositionInfo } = useStellaris();
  
  const [detailedPositions, setDetailedPositions] = useState<DetailedPositionInfo[]>([]);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRequestsRef = useRef<Set<string>>(new Set());
  const dataCacheRef = useRef<DataCache['detailedPositions']>({ 
    data: [], 
    timestamp: 0, 
    positionIds: [] 
  });

  const loadDetailedPositions = useCallback(async (ids: string[], forceRefresh = false) => {
    if (ids.length === 0) {
      setDetailedPositions([]);
      return;
    }

    const now = Date.now();
    const cacheKey = `detailed-${ids.sort().join(',')}`;
    
    // 检查缓存（包括空结果的缓存）
    const cached = dataCacheRef.current;
    if (!forceRefresh && 
        cached.timestamp > 0 && 
        (now - cached.timestamp) < CACHE_CONFIG.DETAILED_POSITIONS_CACHE_EXPIRY &&
        JSON.stringify(cached.positionIds.sort()) === JSON.stringify(ids.sort())) {
      console.log("🎯 Using cached detailed positions data");
      setDetailedPositions(cached.data);
      return;
    }

    // 防止重复请求
    if (pendingRequestsRef.current.has(cacheKey)) {
      console.log("⏳ Detailed positions request already pending, skipping...");
      return;
    }

    // 清除之前的定时器
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // 设置防抖延迟
    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        pendingRequestsRef.current.add(cacheKey);
        
        console.log("🔄 Loading detailed positions...");
        const detailed = await Promise.all(
          ids.map(async (positionId) => {
            try {
              const detailInfo = await pyPosGetPositionInfo(positionId);
              return {
                id: positionId,
                description: detailInfo?.description || "",
                expiry_days: String(detailInfo?.expiry_days || "0"),
                pt_balance_display: detailInfo?.pt_balance_display || "0",
                yt_balance_display: detailInfo?.yt_balance_display || "0",
                yield_token: detailInfo?.yield_token || "",
                py_state_id: detailInfo?.py_state_id || "",
              };
            } catch (err) {
              console.error(`Failed to get details for position ${positionId}:`, err);
              return {
                id: positionId,
                description: "",
                expiry_days: "0",
                pt_balance_display: "0",
                yt_balance_display: "0",
                yield_token: "",
                py_state_id: "",
              };
            }
          }),
        );
        
        // 更新缓存和状态
        dataCacheRef.current = { 
          data: detailed, 
          timestamp: now, 
          positionIds: [...ids] 
        };
        setDetailedPositions(detailed);
        
        console.log("✅ Detailed positions loaded successfully");
      } catch (err) {
        console.error("❌ Error loading position details:", err);
      } finally {
        pendingRequestsRef.current.delete(cacheKey);
      }
    }, CACHE_CONFIG.DEBOUNCE_DELAY);
  }, []);

  useEffect(() => {
    loadDetailedPositions(positionIds);
  }, [positionIds, loadDetailedPositions]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  return {
    detailedPositions,
    loadDetailedPositions
  };
};

/**
 * 交换计算Hook
 */
export const useSwapCalculation = () => {
  const { routerGetPtOutForExactSyIn, routerGetSyAmountInForExactPtOut } = useStellaris();
  
  const calculationCacheRef = useRef<Map<string, CalculationCache>>(new Map());
  const pendingCalculationsRef = useRef<Set<string>>(new Set());

  const calculateWithCache = useCallback(async (
    calculationType: CalculationType,
    amount: number,
    poolStats: string,
    poolId: string
  ): Promise<number | undefined> => {
    // 数据验证
    if (!validateCalculationInputs(amount, poolStats, poolId)) {
      return undefined;
    }

    const cacheKey = `${calculationType}-${amount}-${poolStats}-${poolId}`;
    const now = Date.now();

    // 检查缓存
    const cached = calculationCacheRef.current.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_CONFIG.CALCULATION_CACHE_EXPIRY) {
      console.log(`🎯 Using cached result for ${calculationType}:`, cached.result);
      return cached.result;
    }

    // 检查是否有相同请求正在进行
    if (pendingCalculationsRef.current.has(cacheKey)) {
      console.log(`⏳ Request already pending for ${calculationType}, skipping...`);
      return undefined;
    }

    try {
      pendingCalculationsRef.current.add(cacheKey);
      
      let result: number;
      const realAmount = toContractAmount(amount);
      
      console.log(`🔄 Calculating ${calculationType} for amount:`, amount);
      
      if (calculationType === 'ptOut') {
        result = await routerGetPtOutForExactSyIn(
          realAmount,
          0,
          poolStats,
          poolId
        );
        result = fromContractAmount(result);
      } else {
        result = await routerGetSyAmountInForExactPtOut(
          realAmount,
          poolStats,
          poolId
        );
        result = fromContractAmount(result);
      }

      // 验证结果
      if (!isFinite(result) || result < 0) {
        console.warn(`⚠️ Invalid calculation result for ${calculationType}:`, result);
        return undefined;
      }

      // 缓存结果
      calculationCacheRef.current.set(cacheKey, {
        result,
        timestamp: now
      });

      console.log(`✅ Calculated ${calculationType}:`, result);
      return result;
    } catch (err) {
      console.error(`❌ Error calculating ${calculationType}:`, err);
      return undefined;
    } finally {
      pendingCalculationsRef.current.delete(cacheKey);
    }
  }, []);

  const clearCache = useCallback(() => {
    calculationCacheRef.current.clear();
    pendingCalculationsRef.current.clear();
    console.log("🧹 Calculation cache cleared");
  }, []);

  return {
    calculateWithCache,
    clearCache
  };
};

/**
 * 交换状态管理Hook - 支持独立的标签页状态
 */
export const useSwapState = () => {
  // 为每个标签页维护独立的状态
  const [syState, setSyState] = useState<{input: number | undefined, output: number | undefined}>({
    input: undefined,
    output: undefined
  });
  const [ptState, setPtState] = useState<{input: number | undefined, output: number | undefined}>({
    input: undefined,
    output: undefined
  });
  const [ytState, setYtState] = useState<{input: number | undefined, output: number | undefined}>({
    input: undefined,
    output: undefined
  });

  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<TabType>('SY');
  const [selectedPosition, setSelectedPosition] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(VALUE_CONFIG.DEFAULT_SLIPPAGE);

  // 获取当前标签页的状态
  const getCurrentState = useCallback(() => {
    switch (selectedTab) {
      case 'SY': return syState;
      case 'PT': return ptState;
      case 'YT': return ytState;
      default: return syState;
    }
  }, [selectedTab, syState, ptState, ytState]);

  // 更新当前标签页的输入值
  const setCurrentInput = useCallback((value: number | undefined) => {
    switch (selectedTab) {
      case 'SY':
        setSyState(prev => ({ ...prev, input: value }));
        break;
      case 'PT':
        setPtState(prev => ({ ...prev, input: value }));
        break;
      case 'YT':
        setYtState(prev => ({ ...prev, input: value }));
        break;
    }
  }, [selectedTab]);

  // 更新当前标签页的输出值
  const setCurrentOutput = useCallback((value: number | undefined) => {
    switch (selectedTab) {
      case 'SY':
        setSyState(prev => ({ ...prev, output: value }));
        break;
      case 'PT':
        setPtState(prev => ({ ...prev, output: value }));
        break;
      case 'YT':
        setYtState(prev => ({ ...prev, output: value }));
        break;
    }
  }, [selectedTab]);

  // 重置当前标签页的数量
  const resetCurrentAmounts = useCallback(() => {
    switch (selectedTab) {
      case 'SY':
        setSyState({ input: undefined, output: undefined });
        break;
      case 'PT':
        setPtState({ input: undefined, output: undefined });
        break;
      case 'YT':
        setYtState({ input: undefined, output: undefined });
        break;
    }
  }, [selectedTab]);

  const resetStatus = useCallback(() => {
    setSwapStatus("");
  }, []);

  const currentState = getCurrentState();

  return {
    // 当前标签页的状态
    swapAmount: currentState.input,
    convertedAmount: currentState.output,
    setSwapAmount: setCurrentInput,
    setConvertedAmount: setCurrentOutput,
    
    // 所有标签页的状态（用于调试或特殊需求）
    syState,
    ptState,
    ytState,
    
    // 通用状态
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
    resetAmounts: resetCurrentAmounts,
    resetStatus
  };
};
