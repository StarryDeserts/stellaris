// 池子详情组件
import { PyStats } from '../types';
import { formatLiquidity } from '../utils';

interface PoolDetailsProps {
  poolData: PyStats;
}

export const PoolDetails: React.FC<PoolDetailsProps> = ({ poolData }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 流动性卡片 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700 flex items-center">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">Total Liquidity</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatLiquidity(poolData.liquidity)}</p>
        </div>
      </div>

      {/* 资产信息卡片 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Pool Assets</h3>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mr-2">
              <span className="text-xs font-bold text-emerald-600">PT</span>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Principal Token</span>
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">PT-{poolData.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center mr-2">
              <span className="text-xs font-bold text-amber-600">YT</span>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Yield Token</span>
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">YT-{poolData.name}</span>
        </div>
      </div>

      {/* 协议信息卡片 */}
      <div className="md:col-span-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500">Protocol Information</h3>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Aptos Testnet</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This pool allows you to deposit {poolData.name} tokens and receive Principal Tokens (PT) and Yield Tokens (YT).
          You can trade these tokens or provide liquidity to earn rewards.
        </p>
      </div>
    </div>
  );
};
