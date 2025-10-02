// 市场页面常量定义

// 滑动条样式
export const sliderStyles = `
  .slider::-webkit-slider-thumb {
    appearance: none;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  .slider::-moz-range-thumb {
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

// 缓存过期时间配置（毫秒）
export const CACHE_CONFIG = {
  POSITIONS_CACHE_EXPIRY: 5 * 60 * 1000, // 5分钟
  DETAILED_POSITIONS_CACHE_EXPIRY: 2 * 60 * 1000, // 2分钟
  CALCULATION_CACHE_EXPIRY: 30 * 1000, // 30秒
  MAX_DATA_CACHE_AGE: 10 * 60 * 1000, // 10分钟
  MIN_FETCH_INTERVAL: 30 * 1000, // 30秒
  DEBOUNCE_DELAY: 300, // 300ms
  CALCULATION_DEBOUNCE_DELAY: 500, // 500ms
} as const;

// 数值配置
export const VALUE_CONFIG = {
  DEFAULT_SLIPPAGE: 0.005, // 默认滑点 0.5%
  AMOUNT_MULTIPLIER: 100000000, // 数量倍数
  MAX_AMOUNT: 1000000, // 最大允许数量
  REFRESH_DELAY_AFTER_CREATE: 1000, // 创建位置后刷新延迟
  REFRESH_DELAY_AFTER_SWAP: 2000, // 交换后刷新延迟
  STATUS_CLEAR_DELAY: 3000, // 状态清除延迟
} as const;

// 合约地址配置
export const CONTRACT_ADDRESSES = {
  DEFAULT_SY_ADDRESS: "0xdb4660e349e5c784a9d4ad93fa157fa9d3651c6b1af0b1ece5a44d5350fc36e",
  DEFAULT_YIELD_TOKEN: "0xf36349bfb5b8a9f7f26417c596d349c0136de5d831c55f3d5432bd254ce832ef",
} as const;
