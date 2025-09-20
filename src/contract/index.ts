import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  STELLARIS_MODULE_ADDRESS,
  MarketModule,
  RouterModule,
  PyModule,
  SyModule,
  PyPositionModule,
  MarketGlobalModule,
} from "../constant";

// A general-purpose hook for interacting with the Stellaris protocol contracts.
export const useStellaris = () => {
  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);
  const { account, signAndSubmitTransaction } = useWallet();

  // =================================================================
  //                      HELPER FUNCTIONS
  // =================================================================

  const submitTransaction = async (payload: any) => {
    if (!account) throw new Error("Wallet not connected");
    const transaction = await signAndSubmitTransaction({
      sender: account.address,
      data: payload,
    });
    try {
      await aptos.waitForTransaction({
        transactionHash: transaction.hash,
      });
      return transaction.hash;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const viewFunction = async (payload: any) => {
    try {
      const result = await aptos.view({ payload });
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  // =================================================================
  //                      MARKET MODULE
  // =================================================================

  const marketMintLp = (
    sy_amount: number,
    pt_amount_to_add: number,
    min_lp_out: number,
    user_py_position: string,
    py_state: string,
    market_pool_object: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketModule.MODULE_NAME}::${MarketModule.FUNCTIONS.MINT_LP}`,
      functionArguments: [
        sy_amount,
        pt_amount_to_add,
        min_lp_out,
        user_py_position,
        py_state,
        market_pool_object,
      ],
    });
  };

  const marketSeedLiquidity = (
    sy_amount: number,
    user_py_position: string,
    py_state: string,
    market_pool_object: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketModule.MODULE_NAME}::${MarketModule.FUNCTIONS.SEED_LIQUIDITY}`,
      functionArguments: [
        sy_amount,
        user_py_position,
        py_state,
        market_pool_object,
      ],
    });
  };

  const marketGetTotalPt = (market_pool_object: string): Promise<[number]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketModule.MODULE_NAME}::${MarketModule.FUNCTIONS.GET_MARKET_TOTAL_PT}`,
      functionArguments: [market_pool_object],
    }) as Promise<[number]>;
  };

  const marketGetTotalSy = (market_pool_object: string): Promise<[number]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketModule.MODULE_NAME}::${MarketModule.FUNCTIONS.GET_MARKET_TOTAL_SY}`,
      functionArguments: [market_pool_object],
    }) as Promise<[number]>;
  };

  const marketGetExpiry = (market_pool_object: string): Promise<[number]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketModule.MODULE_NAME}::${MarketModule.FUNCTIONS.MARKET_EXPIRY}`,
      functionArguments: [market_pool_object],
    }) as Promise<[number]>;
  };

  // =================================================================
  //                      ROUTER MODULE
  // =================================================================

  const routerAddLiquiditySingleSy = (
    sy_amount: number,
    net_pt_amount: number,
    min_lp_out: number,
    user_py_position: string,
    py_state_object: string,
    market_pool_object: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${RouterModule.MODULE_NAME}::${RouterModule.FUNCTIONS.ADD_LIQUIDITY_SINGLE_SY}`,
      functionArguments: [
        sy_amount,
        net_pt_amount,
        min_lp_out,
        user_py_position,
        py_state_object,
        market_pool_object,
      ],
    });
  };

  const routerSwapExactSyForYt = (
    min_yt_out: number,
    yt_amount_out_approx: number,
    sy_in_for_py_mint: number,
    sy_amount: number,
    user_py_position: string,
    py_state_object: string,
    market_pool_object: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${RouterModule.MODULE_NAME}::${RouterModule.FUNCTIONS.SWAP_EXACT_SY_FOR_YT}`,
      functionArguments: [
        min_yt_out,
        yt_amount_out_approx,
        sy_in_for_py_mint,
        sy_amount,
        user_py_position,
        py_state_object,
        market_pool_object
      ]
    });
  };

  // =================================================================
  //                      PY MODULE
  // =================================================================

  const pyInitPosition = (sy_type_name: string, py_state_object: string) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${PyModule.MODULE_NAME}::${PyModule.FUNCTIONS.INIT_PY_POSITION}`,
      functionArguments: [sy_type_name, py_state_object],
    });
  };

  const pyBurnPt = (
    amount: number,
    pt_metadata_address: string,
    py_state_object: string,
    user_position: string,
    sy_type_name: string,
    pt_type_name: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${PyModule.MODULE_NAME}::${PyModule.FUNCTIONS.BURN_PT}`,
      functionArguments: [
        amount,
        pt_metadata_address,
        py_state_object,
        user_position,
        sy_type_name,
        pt_type_name,
      ],
    });
  };

  const pyRedeemPt = (
    user_position: string,
    py_state_object: string,
    sy_type_name: string,
    pt_type_name: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${PyModule.MODULE_NAME}::${PyModule.FUNCTIONS.REDEEM_PT}`,
      functionArguments: [
        user_position,
        py_state_object,
        sy_type_name,
        pt_type_name
      ],
    });
  };

  const pyGetAllStates = (): Promise<[string[]]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${PyModule.MODULE_NAME}::${PyModule.FUNCTIONS.GET_ALL_PY_STATES}`,
      functionArguments: []
    }) as Promise<[string[]]>;
  };

  // =================================================================
  //                      PY POSITION MODULE
  // =================================================================

  const pyPosGetUserPositionAddress = (user_address: string): Promise<[string]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${PyPositionModule.MODULE_NAME}::${PyPositionModule.FUNCTIONS.GET_USER_PY_POSITION_ADDRESS}`,
      functionArguments: [user_address]
    }) as Promise<[string]>;
  };

  const pyPosGetPyAmount = (position_object: string): Promise<[number, number]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${PyPositionModule.MODULE_NAME}::${PyPositionModule.FUNCTIONS.PY_AMOUNT}`,
      functionArguments: [position_object]
    }) as Promise<[number, number]>;
  };

  // =================================================================
  //                      MARKET GLOBAL MODULE
  // =================================================================

  const marketGlobalGetAllMarkets = (): Promise<[string[]]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketGlobalModule.MODULE_NAME}::${MarketGlobalModule.FUNCTIONS.GET_ALL_MARKETS}`,
      functionArguments: []
    }) as Promise<[string[]]>;
  };

  // =================================================================
  //                      SY MODULE
  // =================================================================

  const syDeposit = (
    amount: number,
    sy_metadata_address: string,
    origin_fa_address: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${SyModule.MODULE_NAME}::${SyModule.FUNCTIONS.DEPOSIT}`,
      functionArguments: [amount, sy_metadata_address, origin_fa_address],
    });
  };

  const syRedeem = (
    amount: number,
    sy_type_name: string,
    sy_metadata_address: string,
    origin_fa_address: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${SyModule.MODULE_NAME}::${SyModule.FUNCTIONS.REDEEM}`,
      functionArguments: [
        amount,
        sy_type_name,
        sy_metadata_address,
        origin_fa_address,
      ],
    });
  };

  const syRegisterWithYieldToken = (
    symbol: string,
    decimals: number,
    icon_uri: string,
    project_uri: string,
    sy_type_name: string,
    origin_fa_address: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${SyModule.MODULE_NAME}::${SyModule.FUNCTIONS.REGISTER_SY_WITH_YIELD_TOKEN}`,
      functionArguments: [
        symbol,
        decimals,
        icon_uri,
        project_uri,
        sy_type_name,
        origin_fa_address,
      ],
    });
  };

  const syRegisterWithUnderlyingToken = (
    sy_metadata_address: string,
    origin_initial_asset_fa_address: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${SyModule.MODULE_NAME}::${SyModule.FUNCTIONS.REGISTER_SY_WITH_UNDERLYING_TOKEN}`,
      functionArguments: [sy_metadata_address, origin_initial_asset_fa_address],
    });
  };

  const syRemoveBinding = (sy_metadata_address: string) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${SyModule.MODULE_NAME}::${SyModule.FUNCTIONS.REMOVE_SY_BINDING}`,
      functionArguments: [sy_metadata_address],
    });
  };

  return {
    // Market
    marketMintLp,
    marketSeedLiquidity,
    marketGetTotalPt,
    marketGetTotalSy,
    marketGetExpiry,
    // Router
    routerAddLiquiditySingleSy,
    routerSwapExactSyForYt,
    // PY
    pyInitPosition,
    pyBurnPt,
    pyRedeemPt,
    pyGetAllStates,
    // PY Position
    pyPosGetUserPositionAddress,
    pyPosGetPyAmount,
    // Market Global
    marketGlobalGetAllMarkets,
    // SY
    syDeposit,
    syRedeem,
    syRegisterWithYieldToken,
    syRegisterWithUnderlyingToken,
    syRemoveBinding,
  };
};