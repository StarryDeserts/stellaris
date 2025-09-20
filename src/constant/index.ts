// =================================================================
//                      模块地址 (Module Addresses)
// =================================================================

export const STELLARIS_MODULE_ADDRESS = "0x615a80e404fa62871e1927c8674ce737b8c01989ccf1d02943a3bcf940acb67b";

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
  },
} as const;

export const MarketFactoryModule = {
  MODULE_NAME: "market_factory",
  FUNCTIONS: {
    // Entry functions
    CREATE_NEW_MARKET_WITH_RAW_VALUES: "create_new_market_with_raw_values",
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
    INIT_PY_POSITION: "init_py_position",
    BURN_PT: "burn_pt",
    REDEEM_PT: "redeem_pt",

    // View functions
    EXPIRY: "expiry",
    FIRST_PY_INDEX: "first_py_index",
    SY_METADATA_ADDRESS: "sy_metadata_address",
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
  },
} as const;

export const MarketGlobalModule = {
  MODULE_NAME: "market_global",
  FUNCTIONS: {
    // View functions
    GET_ALL_MARKETS: "get_all_markets",
  },
} as const;


