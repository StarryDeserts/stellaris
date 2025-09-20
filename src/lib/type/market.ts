// Market related types based on the contract ABI

export interface Position {
  player_address: string;
  direction: boolean; // true for A side, false for B side
  stake_amount: number; 
  effective_stake: number; 
}

export interface Market {
  id: string;
  description: string;
  treasury: string;
  winning_side: boolean | null; // Option<bool>
  create_time: number; // u64 as string (timestamp)
  close_time: number; // u64 as string (timestamp)
  a_pool: {
    id: string
  }
  b_pool: {
    id: string
  }
  total_a_effective_stake: number; // u64 as string
  total_b_effective_stake: number; // u64 as string
  status: boolean; // true = active, false = settled
}


export interface PositionView {
  id?: string;
  market_id: string;
  player: string;
  direction: boolean; // same as side
  side: boolean; // true for A side, false for B side
  stake_amount: string;
  effective_stake: string;
  create_time: string;
  claimed?: boolean;
}

export interface MarketHolder {
  signer_cap: string;
  markets: Record<string, Market>;
}

// UI helper types
export interface MarketView {
  id: string;
  description: string;
  treasury: string;
  winning_side: boolean | null;
  create_time: number;
  close_time: number;
  a_pool: { id: string };
  b_pool: { id: string };
  total_a_effective_stake: number;
  total_b_effective_stake: number;
  status: boolean;
}

export interface MarketListItem extends MarketView {
  timeRemaining?: number; // calculated field for UI
  totalStake?: string; // calculated field for UI
  odds?: {
    a: number;
    b: number;
  };
}

export interface CreateMarketForm {
  description: string;
  closeTime: Date;
  tokenMetadata: string; // Object address for fungible asset metadata
}

export interface EnterPositionForm {
  marketId: string;
  direction: boolean; // true for A, false for B
  amount: string;
}

export interface ClaimWinningsForm {
  marketId: string;
}

export interface SettleMarketForm {
  marketId: string;
  winningSide: boolean;
}