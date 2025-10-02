export interface PyPosition {
    py_state_id: string;
    description: string;
    yield_token: string;
    pt_balance_display: string;
    yt_balance_display: string;
    expiry_days: number;
}

export interface MarketPoistion {
    market_state_id: string;
    yield_token: string;
    description: string;
    expiry_days: number;
    lp_amount_display: string;
}