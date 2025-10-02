// 市场页面工具函数

import { VALUE_CONFIG } from './constants';

/**
 * 格式化流动性显示
 */
export const formatLiquidity = (value: number): string => {
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}B`;
  if (value >= 1) return `${value.toFixed(1)}M`;
  return `$${value.toFixed(3)}M`;
};

/**
 * 格式化日期显示
 */
export const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

/**
 * 计算剩余天数
 */
export const getDaysLeft = (timestamp: number): string => {
  const now = Date.now();
  const diff = timestamp - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? `${days} days` : "Expired";
};

/**
 * 验证计算输入参数
 */
export const validateCalculationInputs = (
  amount: number,
  poolStats: string,
  poolId: string
): boolean => {
  if (!amount || amount <= 0 || isNaN(amount) || !isFinite(amount)) {
    console.warn("⚠️ Invalid amount for calculation:", amount);
    return false;
  }
  if (!poolStats || !poolId) {
    console.warn("⚠️ Missing pool data for calculation:", { poolStats, poolId });
    return false;
  }
  if (amount > VALUE_CONFIG.MAX_AMOUNT) {
    console.warn("⚠️ Amount too large for calculation:", amount);
    return false;
  }
  return true;
};

/**
 * 将数量转换为合约使用的整数格式
 */
export const toContractAmount = (amount: number): number => {
  return Math.floor(amount * VALUE_CONFIG.AMOUNT_MULTIPLIER);
};

/**
 * 将合约数量转换为显示格式
 */
export const fromContractAmount = (amount: number): number => {
  return amount / VALUE_CONFIG.AMOUNT_MULTIPLIER;
};

/**
 * 根据选择的标签页获取输入标签
 */
export const getInputLabel = (tab: string, tokenName: string = 'sthAPT'): string => {
  if (tab === 'SY') return tokenName;
  if (tab === 'PT') return `SY-${tokenName}`;
  if (tab === 'YT') return `SY-${tokenName}`;
  return 'Input';
};

/**
 * 根据选择的标签页获取输出标签
 */
export const getOutputLabel = (tab: string, tokenName: string = 'sthAPT'): string => {
  if (tab === 'SY') return `SY-${tokenName}`;
  if (tab === 'PT') return `PT-${tokenName}`;
  if (tab === 'YT') return `YT-${tokenName}`;
  return 'Output';
};

/**
 * 获取交换比率提示
 */
export const getExchangeRateHint = (tab: string, tokenName: string = 'sthAPT'): string => {
  return `1 ${getInputLabel(tab, tokenName)} = 1 ${getOutputLabel(tab, tokenName)}`;
};
