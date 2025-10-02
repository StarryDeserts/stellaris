import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { PyPosition, MarketPoistion } from "../type"
import {
  STELLARIS_MODULE_ADDRESS,
  STHAPT_FAUCET_MODULE_ADDRESS,
  SUSDE_FAUCET_MODULE_ADDRESS,
  TRUAPT_FAUCET_MODULE_ADDRESS,
  FaucetModule,
  MarketModule,
  MarketPositionModule,
  RouterModule,
  PyModule,
  SyModule,
  PyPositionModule,
  MarketGlobalModule,
} from "../constants";

// A general-purpose hook for interacting with the Stellaris protocol contracts.
export const useStellaris = () => {
  const config = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(config);
  const { account, signAndSubmitTransaction } = useWallet();

  // =================================================================
  //                      HELPER FUNCTIONS
  // =================================================================

  // Get coin balance for a specific address and coin type
  const getCoinBalance = async (address: string, coinType: string) => {
    console.log("address", address)
    console.log("coinType", coinType)
    try {
      const balance = await aptos.getBalance({
        accountAddress: address,
        asset: coinType
      });
      return balance.toString();
    } catch (error) {
      console.error(`Error getting balance for ${coinType}:`, error);
      return "0";
    }
  };

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

  const marketGetBindingPyState = (market_pool_object: string): Promise<[string]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketModule.MODULE_NAME}::${MarketModule.FUNCTIONS.GET_MARKET_BINDING_PY_STATE}`,
      functionArguments: [market_pool_object],
    }) as Promise<[string]>;
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

  
  const routerSwapExactSyForPt = (
    min_pt_out: number,
    exact_pt_out: number,
    sy_amount: number,
    user_py_position: string,
    py_state_object: string,
    market_pool_object: string
  ) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${RouterModule.MODULE_NAME}::${RouterModule.FUNCTIONS.SWAP_EXACT_SY_FOR_PT}`,
      functionArguments: [
        min_pt_out,
        exact_pt_out,
        sy_amount,
        user_py_position,
        py_state_object,
        market_pool_object
      ]
    });
  };
  

  const routerGetSyAmountInForExactPtOut = async (
    exact_pt_out: number,
    py_state_object: string,
    market_pool_object: string
  ): Promise<number> => {
    const sy_amount_in_info_payload = {
      function: `${STELLARIS_MODULE_ADDRESS}::${RouterModule.MODULE_NAME}::${RouterModule.FUNCTIONS.GET_SY_AMOUNT_IN_FOR_EXACT_PT_OUT_WITH_ORACLE_PRICE}`,
      functionArguments: [exact_pt_out, py_state_object, market_pool_object]
    };
    const sy_amount_in_info = await aptos.view({ payload: sy_amount_in_info_payload });
    console.log(sy_amount_in_info);
    const sy_amount_in = sy_amount_in_info[0] as unknown as number;
    return sy_amount_in
  }


  const routerGetPtOutForExactSyIn = async (
    sy_amount_in: number,
    min_pt_out: number,
    py_state_object: string,
    market_pool_object: string
  ): Promise<number> => {
    const pt_out_info_payload = {
      function: `${STELLARIS_MODULE_ADDRESS}::${RouterModule.MODULE_NAME}::${RouterModule.FUNCTIONS.GET_PT_OUT_FOR_EXACT_SY_IN_WITH_ORACLE_PRICE}`,
      functionArguments: [sy_amount_in, min_pt_out, py_state_object, market_pool_object]
    };
    const pt_out_info = await aptos.view({ payload: pt_out_info_payload });
    console.log(pt_out_info);
    const pt_out = pt_out_info[0] as unknown as number;
    return pt_out
  }


  // =================================================================
  //                      PY MODULE
  // =================================================================

  const pyInitPosition = (py_state_object: string) => {
    return submitTransaction({
      function: `${STELLARIS_MODULE_ADDRESS}::${PyModule.MODULE_NAME}::${PyModule.FUNCTIONS.INIT_PY_POSITION}`,
      functionArguments: [py_state_object],
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

  const pyPosGetPyStateId = (position_object: string): Promise<[string]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${PyPositionModule.MODULE_NAME}::${PyPositionModule.FUNCTIONS.PY_STATE_ID}`,
      functionArguments: [position_object]
    }) as Promise<[string]>;
  };

  const pyPosGetPositionInfo = async (position_object: string): Promise<PyPosition> => {
    const py_position_info_payload = {
      function: `${STELLARIS_MODULE_ADDRESS}::${PyPositionModule.MODULE_NAME}::${PyPositionModule.FUNCTIONS.GET_PY_POSITION_INFO}`,
      functionArguments: [position_object]
    };
    const py_position_info = await aptos.view({ payload: py_position_info_payload });
    const py_position = py_position_info[0] as unknown as PyPosition;
    return {
      py_state_id: py_position.py_state_id,
      description: py_position.description,
      yield_token: py_position.yield_token,
      pt_balance_display: py_position.pt_balance_display,
      yt_balance_display: py_position.yt_balance_display,
      expiry_days: py_position.expiry_days
    }
  }



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
  //                      MARKET POSITION MODULE
  // =================================================================

  const marketPosGetUserPositionAddress = (user_address: string): Promise<[string]> => {
    return viewFunction({
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketPositionModule.MODULE_NAME}::${MarketPositionModule.FUNCTIONS.GET_USER_PY_POSITION_ADDRESS}`,
      functionArguments: [user_address]
    }) as Promise<[string]>;
  };

  const marketPosGetPositionInfo = async (market_position_object: string): Promise<MarketPoistion> => {
    const market_position_info_payload = {
      function: `${STELLARIS_MODULE_ADDRESS}::${MarketPositionModule.MODULE_NAME}::${MarketPositionModule.FUNCTIONS.GET_MARKET_POSITION_INFO}`,
      functionArguments: [market_position_object]
    };
    const market_position_info = await aptos.view({ payload: market_position_info_payload });
    const market_position = market_position_info[0] as unknown as MarketPoistion;
    return {
      market_state_id: market_position.market_state_id,
      yield_token: market_position.yield_token,
      description: market_position.description,
      expiry_days: market_position.expiry_days,
      lp_amount_display: market_position.lp_amount_display
    }
  }

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

  const sthAptFaucetMint = (amount: number) => {
    return submitTransaction({
      function: `${STHAPT_FAUCET_MODULE_ADDRESS}::${FaucetModule.MODULE_NAME}::${FaucetModule.FUNCTIONS.FAUCET_MINT}`,
      functionArguments: [amount],
    })
  }

  const sUsdeFaucetMint = (amount: number) => {
    return submitTransaction({
      function: `${SUSDE_FAUCET_MODULE_ADDRESS}::${FaucetModule.MODULE_NAME}::${FaucetModule.FUNCTIONS.FAUCET_MINT}`,
      functionArguments: [amount],
    })
  }

  const truAptFaucetMint = (amount: number) => {
    return submitTransaction({
      function: `${TRUAPT_FAUCET_MODULE_ADDRESS}::${FaucetModule.MODULE_NAME}::${FaucetModule.FUNCTIONS.FAUCET_MINT}`,
      functionArguments: [amount],
    })
  }

  return {
    // Market
    marketMintLp,
    marketSeedLiquidity,
    marketGetTotalPt,
    marketGetBindingPyState,
    //查询sy
    marketGetTotalSy,
    marketGetExpiry,
    // Router
    routerAddLiquiditySingleSy,
    routerSwapExactSyForPt,
    routerGetSyAmountInForExactPtOut,
    routerGetPtOutForExactSyIn,
    // PY
    pyInitPosition,
    pyBurnPt,
    pyRedeemPt,
    pyGetAllStates,
    // PY Position
    pyPosGetUserPositionAddress,
    pyPosGetPyStateId,
    pyPosGetPositionInfo,
    // Market Global
    marketGlobalGetAllMarkets,
    // Market Position
    marketPosGetPositionInfo,
    marketPosGetUserPositionAddress,
    // SY
    syDeposit,
    syRedeem,
    // Faucet
    sthAptFaucetMint,
    sUsdeFaucetMint,
    truAptFaucetMint,
    // Balance
    getCoinBalance
  };
};