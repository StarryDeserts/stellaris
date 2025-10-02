// 市场页面相关类型定义
export interface MarketsPageProps {
  params: { id: string };
}

export interface PyStats {
  poolId: string;
  name: string;
  icon?: string;
  baseAPY: number;
  expiry: number;
  liquidity: number;
  pystats: string;
}

export interface PositionInfo {
  id: string;
  info: any;
}

export interface DetailedPositionInfo {
  id: string;
  description: string;
  expiry_days: string;
  pt_balance_display: string;
  yt_balance_display: string;
  yield_token: string;
  py_state_id: string;
}

export interface DataCache {
  positions: { 
    data: PositionInfo[]; 
    timestamp: number 
  };
  detailedPositions: { 
    data: DetailedPositionInfo[]; 
    timestamp: number; 
    positionIds: string[] 
  };
}

export interface CalculationCache {
  result: number;
  timestamp: number;
}

export type TabType = 'SY' | 'PT' | 'YT';
export type CalculationType = 'ptOut' | 'syIn';
export type InputType = 'A' | 'B';
