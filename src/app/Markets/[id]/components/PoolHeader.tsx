// 池子头部信息组件
import Link from "next/link";
import { PyStats } from '../types';
import { formatDate, getDaysLeft } from '../utils';

interface PoolHeaderProps {
  poolData: PyStats;
}

export const PoolHeader: React.FC<PoolHeaderProps> = ({ poolData }) => {
  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/Markets">
          <button className="py-2 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-md flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Markets
          </button>
        </Link>
        
        <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
          Pool ID: {poolData.poolId.slice(0, 8)}...
        </span>
      </div>

      {/* 池子信息卡片 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-md p-6 border border-blue-100 dark:border-blue-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{poolData.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">APY: {poolData.baseAPY}%</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-purple-100 rounded-lg p-3 shadow-sm">
              <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Expiry Date</p>
              <p className="text-xl font-bold text-purple-700">{formatDate(poolData.expiry)}</p>
              <p className="text-sm font-medium text-purple-600">({getDaysLeft(poolData.expiry)})</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
