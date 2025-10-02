// =================================================================
//                      模块地址 (Module Addresses)
// =================================================================

export const STELLARIS_MODULE_ADDRESS = "0xa2924718273531062e31da5f4004ffc444541fde123874a9cd945384d9eda83c";
export const STHAPT_FAUCET_MODULE_ADDRESS = "0x50282d41bb177c6436e730879095fdd458288c6c66e81fa31d23346d2ecf93a5";
export const SUSDE_FAUCET_MODULE_ADDRESS = "0x7e48a71fc767714d19da551420f838ae357c4288e60c74852b810ae0e778aa21";
export const TRUAPT_FAUCET_MODULE_ADDRESS = "0xcb80bf47b91d79b94726d63303f6933155f1cfc8fc425b7b35395cf44dc5efce";

// =================================================================
//                      Stellaris 核心模块
// =================================================================

export const MarketModule = {
  MODULE_NAME: "market",
  FUNCTIONS: {
    // Entry functions
    MINT_LP: "mint_lp",
    SWAP_SY_FOR_EXACT_PT: "swap_sy_for_exact_pt",
    SWAP_EXACT_PT_FOR_SY: "swap_exact_pt_for_sy",
    SEED_LIQUIDITY: "seed_liquidity",

    // View functions
    GET_MARKET_TOTAL_PT: "get_market_total_pt",
    GET_MARKET_TOTAL_SY: "get_market_total_sy",
    MARKET_EXPIRY: "market_expiry",
    GET_MARKET_BINDING_PY_STATE: "get_market_binding_py_state"
  },
} as const;

export const RouterModule = {
  MODULE_NAME: "router",
  FUNCTIONS: {
    // Entry functions
    ADD_LIQUIDITY_SINGLE_SY: "add_liquidity_single_sy",
    SWAP_EXACT_SY_FOR_PT: "swap_exact_sy_for_pt",
    SWAP_EXACT_SY_FOR_YT: "swap_exact_sy_for_yt",
    SWAP_EXACT_YT_FOR_SY: "swap_exact_yt_for_sy",

    // View functions
    GET_APPROX_PT_OUT_FOR_NET_SY_IN_WITH_ORACLE_PRICE: "get_approx_pt_out_for_net_sy_in_with_oracle_price",
    GET_LP_OUT_FOR_SINGLE_SY_IN: "get_lp_out_for_single_sy_in",
    GET_PT_OUT_FOR_EXACT_SY_IN_WITH_ORACLE_PRICE: "get_pt_out_for_exact_sy_in_with_oracle_price",
    GET_SY_AMOUNT_IN_FOR_EXACT_PT_OUT_WITH_ORACLE_PRICE: "get_sy_amount_in_for_exact_pt_out_with_oracle_price",
    GET_SY_AMOUNT_IN_FOR_EXACT_YT_OUT_WITH_ORACLE_PRICE: "get_sy_amount_in_for_exact_yt_out_with_oracle_price",
    GET_SY_AMOUNT_OUT_FOR_EXACT_PT_IN_WITH_ORACLE_PRICE: "get_sy_amount_out_for_exact_pt_in_with_oracle_price",
    GET_SY_AMOUNT_OUT_FOR_EXACT_YT_IN_WITH_ORACLE_PRICE: "get_sy_amount_out_for_exact_yt_in_with_oracle_price",
    GET_YT_OUT_FOR_EXACT_SY_IN_WITH_ORACLE_PRICE: "get_yt_out_for_exact_sy_in_with_oracle_price",
  },
} as const;

export const MarketFactoryModule = {
  MODULE_NAME: "market_factory",
  FUNCTIONS: {
    // Entry functions
    CREATE_NEW_MARKET_WITH_RAW_VALUES: "create_new_market_with_raw_values",
  },
} as const;

export const MarketPositionModule = {
  MODULE_NAME: "market_position",
  FUNCTIONS: {
    // View functions
    GET_USER_PY_POSITION_ADDRESS: "get_user_py_position_address",
    GET_MARKET_POSITION_INFO: "get_market_position_info",
  },
} as const;

export const SyModule = {
  MODULE_NAME: "sy",
  FUNCTIONS: {
    // Entry functions
    DEPOSIT: "deposit",
    REDEEM: "redeem",
    REGISTER_SY_WITH_YIELD_TOKEN: "register_sy_with_yield_token",
    REGISTER_SY_WITH_UNDERLYING_TOKEN: "register_sy_with_underlying_token",
    REMOVE_SY_BINDING: "remove_sy_binding",

    // View functions
    GET_TYPE_TABLE_ALL_KEYS: "get_type_table_all_keys",
  },
} as const;

export const PyModule = {
  MODULE_NAME: "py",
  FUNCTIONS: {
    // Entry functions
    INIT_PY_POSITION: "init_py_position_v2",
    BURN_PT: "burn_pt",
    REDEEM_PT: "redeem_pt",

    // View functions
    EXPIRY: "expiry",
    FIRST_PY_INDEX: "first_py_index",
    SY_METADATA_ADDRESS: "sy_metadata_address",
    SY_NAME: "sy_name",
    GET_PY_INDEX: "get_py_index",
    GET_ALL_PY_STATES: "get_all_py_states",
  },
} as const;

export const YieldFactoryModule = {
  MODULE_NAME: "yield_factory",
  FUNCTIONS: {
    // Entry functions
    CREATE: "create",
    UPDATE_CONFIG: "update_config",
  },
} as const;

export const OracleModule = {
  MODULE_NAME: "oracle",
  FUNCTIONS: {
    // Entry functions
    SET_ASSET_FEED_ID: "set_asset_feed_id",

    // View functions
    GET_ASSET_PRICE: "get_asset_price",
    GET_ASSET_PRICE_AND_TIMESTAMP: "get_asset_price_and_timestamp",
  },
} as const;

export const TokenRegistryModule = {
  MODULE_NAME: "token_registry",
  FUNCTIONS: {
    // Entry functions
    REGISTER_TOKEN_WITH_EXPIRY: "register_token_with_expiry",
  },
} as const;

export const PyPositionModule = {
  MODULE_NAME: "py_position",
  FUNCTIONS: {
    // View functions
    GET_USER_PY_POSITION_ADDRESS: "get_user_py_position_address",
    PY_STATE_ID: "py_state_id",
    NAME: "name",
    DESCRIPTION: "description",
    PT_BALANCE: "pt_balance",
    YT_BALANCE: "yt_balance",
    PY_AMOUNT: "py_amount",
    YIELD_TOKEN: "yield_token",
    EXPIRY: "expiry",
    INDEX: "index",
    PY_INDEX: "py_index",
    ACCURED: "accured",
    GET_PY_POSITION_INFO: "get_py_position_info"
  },
} as const;

export const MarketGlobalModule = {
  MODULE_NAME: "market_global",
  FUNCTIONS: {
    // View functions
    GET_ALL_MARKETS: "get_all_markets",
  },
} as const;

export const FaucetModule = {
  MODULE_NAME: "test_module",
  FUNCTIONS: {
    // Entry functions
    FAUCET_MINT: "faucet_mint",
  },
}

export const UnderlyingAssetType = {
  STH_APT: "0xf36349bfb5b8a9f7f26417c596d349c0136de5d831c55f3d5432bd254ce832ef",
  SUSDE: "0x1299e41a3f7af94f8f0026f8471964f1aa900e9e9d2987913f5cadd0f5bb2c3f",
  TRU_APT: "0x9e7366bfb1d6a0379a41379fe755accf0828fe4a63ea4e8abdd3711ae39822fa"
}

export const StandardizedYieldAssetType = {
  SY_STH_APT: "0xdb4660e349e5c784a9d4ad93fa157fa9d3651c6b1af0b1ece5a44d5350fc36e",
  SY_SUSDE: "0xef995a94d983d402098c496127bc7158b65447ce79f707515fc5dda8a262a0a",
  SY_TRU_APT: "0xb6f93cf75c168335d2366be10c3689b25c0c6b133ccf22693d3ce418595a159e"
}

