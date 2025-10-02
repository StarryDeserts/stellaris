import { POOLS, PoolInfo } from "@/config/pools";

export interface PoolExtended extends PoolInfo {
  liquidity: number;
  expiry: number;
}

// marketGetTotalSy 和 marketGetExpiry 由组件调用 useStellaris 后传入
export async function getPoolsWithData(
  marketGetTotalSy: (poolId: string) => Promise<number | number[]>,
  marketGetExpiry: (poolId: string) => Promise<number | number[]>
): Promise<PoolExtended[]> {
  const results: PoolExtended[] = [];

  for (const pool of POOLS) {
    try {
      // 先请求 liquidity
      const liquidityArray = await marketGetTotalSy(pool.poolId);
      const liquidity = Array.isArray(liquidityArray) ? liquidityArray[0] : liquidityArray;

      // 可加延迟，避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 再请求 expiry
      const expiryArray = await marketGetExpiry(pool.poolId);
      const expiry = Array.isArray(expiryArray) ? expiryArray[0] : expiryArray;

      results.push({
        ...pool,
        liquidity,
        expiry,
      });
    } catch (err) {
      console.error(`获取池子 ${pool.poolId} 数据失败`, err);
      results.push({
        ...pool,
        liquidity: 0,
        expiry: 0,
      });
    }
  }

  return results;
}
