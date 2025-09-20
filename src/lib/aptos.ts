import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { createSurfClient } from "@thalalabs/surf";

import { ABI } from "@/lib/abi/market_abi";

export const NETWORK = process.env.NEXT_PUBLIC_NETWORK! as Network;

export const getAptosClient = () =>
  new Aptos(
    new AptosConfig({
      network: NETWORK,
    })
  );

export const getSurfClient = () =>
  createSurfClient(getAptosClient()).useABI(ABI);
