// 业务逻辑处理函数
import { useCallback } from "react";
import { useStellaris } from "@/contract/index";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { notifyError, notifySuccess, notifyWarning } from "@/components/ToastProvider";
import { PyStats, TabType, InputType } from './types';
import { VALUE_CONFIG, CONTRACT_ADDRESSES } from './constants';
import { validateCalculationInputs, toContractAmount } from './utils';

/**
 * 创建持仓处理逻辑
 */
export const useCreatePositionHandler = () => {
  const { account } = useWallet();
  const { pyInitPosition } = useStellaris();

  const handleCreatePosition = useCallback(async (
    poolData: PyStats,
    setIsLoading: (loading: boolean) => void,
    onSuccess?: () => void
  ) => {
    if (!account) return notifyWarning("Please connect wallet first");
    if (!poolData) return notifyError("Pool data not loaded");

    setIsLoading(true);
    try {
      await pyInitPosition(poolData.pystats);
      notifySuccess("Position created successfully!");
      
      // 延迟刷新数据
      if (onSuccess) {
        setTimeout(onSuccess, VALUE_CONFIG.REFRESH_DELAY_AFTER_CREATE);
      }
    } catch (err: any) {
      notifyError(`Failed to create position: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [account, pyInitPosition]);

  return handleCreatePosition;
};

/**
 * 交换处理逻辑
 */
export const useSwapHandler = () => {
  const { account } = useWallet();
  const { 
    syDeposit, 
    routerSwapExactSyForPt,
    routerGetPtOutForExactSyIn 
  } = useStellaris();

  const handleSwap = useCallback(async (
    poolData: PyStats,
    poolId: string,
    swapAmount: number | undefined,
    selectedTab: TabType,
    selectedPosition: string,
    slippage: number,
    setIsLoading: (loading: boolean) => void,
    setStatus: (status: string) => void,
    onSuccess?: () => void
  ) => {
    // 数据验证
    if (!account) return notifyWarning("Please connect wallet first");
    if (!poolData) return notifyError("Pool data not loaded");
    if (!swapAmount || swapAmount <= 0 || isNaN(swapAmount) || !isFinite(swapAmount)) {
      notifyWarning("Please enter a valid amount");
      return;
    }
    if (swapAmount > VALUE_CONFIG.MAX_AMOUNT) {
      notifyWarning("Amount too large, please enter a smaller amount");
      return;
    }

    setIsLoading(true);
    setStatus("Transaction in progress...");
    
    try {
      const realAmount = toContractAmount(swapAmount);
      let tx;
      
      if (selectedTab === 'SY') {
        tx = await syDeposit(
          realAmount,
          CONTRACT_ADDRESSES.DEFAULT_SY_ADDRESS,
          CONTRACT_ADDRESSES.DEFAULT_YIELD_TOKEN,
        );
      } else if (selectedTab === 'PT') {
        if (!selectedPosition) {
          notifyWarning("Please select a position first");
          return;
        }
        
        // 获取预期的PT输出
        const expectedPtOut = await routerGetPtOutForExactSyIn(
          realAmount,
          0,
          poolData.pystats,
          poolId
        );

        // 验证预期输出
        if (!expectedPtOut || expectedPtOut <= 0 || !isFinite(expectedPtOut)) {
          throw new Error("Invalid expected PT output");
        }

        // 计算最小PT输出（考虑滑点）
        const minPtOut = Math.floor(expectedPtOut * (1 - slippage));
        
        tx = await routerSwapExactSyForPt(
          minPtOut,
          expectedPtOut,
          realAmount,
          selectedPosition,
          poolData.pystats,
          poolId
        );
      } else if (selectedTab === 'YT') {
        notifyWarning("YT swap is not available yet");
        return;
      }

      if (tx) {
        notifySuccess(`Swap successful! Hash: ${tx.slice(0, 8)}...${tx.slice(-6)}`);
      } else {
        notifySuccess("Swap successful!");
      }
      setStatus("Swap successful!");

      // 延迟刷新数据
      if (onSuccess) {
        setTimeout(onSuccess, VALUE_CONFIG.REFRESH_DELAY_AFTER_SWAP);
      }
      
      setTimeout(() => setStatus(""), VALUE_CONFIG.STATUS_CLEAR_DELAY);
    } catch (err: any) {
      const errorMessage = err.message || "Unknown error";
      notifyError(`Swap failed: ${errorMessage}`);
      setStatus("Swap failed, please try again");
    } finally {
      setIsLoading(false);
    }
  }, [account, syDeposit, routerSwapExactSyForPt, routerGetPtOutForExactSyIn]);

  return handleSwap;
};

/**
 * 数量变化处理逻辑
 */
export const useAmountChangeHandler = (
  selectedTab: TabType,
  calculateWithCache: (type: 'ptOut' | 'syIn', amount: number, poolStats: string, poolId: string) => Promise<number | undefined>
) => {
  const handleAmountChange = useCallback(async (
    inputType: InputType,
    value: number,
    poolStats: string,
    poolId: string,
    setSwapAmount: (amount: number | undefined) => void,
    setConvertedAmount: (amount: number | undefined) => void
  ) => {
    // 数据验证
    if (!value || value <= 0 || isNaN(value) || !isFinite(value)) {
      if (inputType === 'A') {
        setConvertedAmount(undefined);
      } else {
        setSwapAmount(undefined);
      }
      return;
    }

    if (selectedTab === 'PT' && value > 0) {
      try {
        const calculationType = inputType === 'A' ? 'ptOut' : 'syIn';
        const result = await calculateWithCache(calculationType, value, poolStats, poolId);
        
        if (result !== undefined) {
          if (inputType === 'A') {
            setConvertedAmount(result);
          } else {
            setSwapAmount(result);
          }
        } else {
          // 计算失败时重置
          if (inputType === 'A') {
            setConvertedAmount(undefined);
          } else {
            setSwapAmount(undefined);
          }
        }
      } catch (err) {
        if (inputType === 'A') {
          setConvertedAmount(undefined);
        } else {
          setSwapAmount(undefined);
        }
      }
    } else if (selectedTab === 'SY') {
      // SY模式，1:1转换
      if (inputType === 'A') {
        setConvertedAmount(value);
      } else {
        setSwapAmount(value);
      }
    } else if (selectedTab === 'YT') {
      // YT模式，1:1转换但显示提示
      if (inputType === 'A') {
        setConvertedAmount(value);
      } else {
        setSwapAmount(value);
      }
    }
  }, [selectedTab, calculateWithCache]);

  return handleAmountChange;
};
