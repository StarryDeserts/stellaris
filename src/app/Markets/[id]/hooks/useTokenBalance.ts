// 代币余额获取Hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useStellaris } from '@/contract/index';
import { POOLS } from '@/config/pools';

interface TokenBalances {
  sthBalance: string;
  syBalance: string;
  isLoading: boolean;
  refreshBalances: () => Promise<void>;
}

export const useTokenBalance = (poolId: string): TokenBalances => {
  const { account } = useWallet();
  const { getCoinBalance } = useStellaris();
  const hasInitializedRef = useRef(false);
  
  const [balances, setBalances] = useState<{
    sthBalance: string;
    syBalance: string;
    isLoading: boolean;
  }>({
    sthBalance: '0',
    syBalance: '0',
    isLoading: false
  });

  const loadBalances = useCallback(async () => {
    // 检查必要的参数
    if (!poolId) {
      console.warn('Pool ID is undefined');
      setBalances({
        sthBalance: '0',
        syBalance: '0',
        isLoading: false
      });
      return;
    }

    if (!account?.address) {
      setBalances({
        sthBalance: '0',
        syBalance: '0',
        isLoading: false
      });
      return;
    }

    const poolInfo = POOLS.find(pool => pool.poolId === poolId);
    if (!poolInfo) {
      console.warn('Pool info not found for poolId:', poolId);
      setBalances({
        sthBalance: '0',
        syBalance: '0',
        isLoading: false
      });
      return;
    }

    setBalances(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('🔄 Loading token balances...');
      const [sthBalance, syBalance] = await Promise.all([
        getCoinBalance(account.address.toString(), poolInfo.coin),
        getCoinBalance(account.address.toString(), poolInfo.sycoin)
      ]);

      setBalances({
        sthBalance: sthBalance || '0',
        syBalance: syBalance || '0',
        isLoading: false
      });
      console.log('✅ Token balances loaded successfully');
    } catch (error) {
      console.error('❌ Error loading token balances:', error);
      setBalances({
        sthBalance: '0',
        syBalance: '0',
        isLoading: false
      });
    }
  }, [account?.address, poolId, getCoinBalance]);

  // 只在组件初始化时调用一次
  useEffect(() => {
    if (!hasInitializedRef.current && account?.address && poolId) {
      hasInitializedRef.current = true;
      loadBalances();
    }
  }, [account?.address, poolId, loadBalances]);

  // 重置初始化标志当账户或池子改变时
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [account?.address, poolId]);

  return {
    ...balances,
    refreshBalances: loadBalances
  };
};
