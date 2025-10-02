"use client"
// 移除未使用的导入
// import { CryptoAPYBanner } from "@/components/pool/pho";
import DefiTable from "@/components/pool/table";

export default function () {
    return (
        <div className="max-w-6xl mx-auto px-4 pt-20">
            {/* 标题区域 */}
            <div className="mb-10">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                    Liquidity Pools
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl">
                    Explore available liquidity pools where you can provide assets and earn yield. Select any pool to view details or add liquidity.
                </p>
            </div>

            {/* 功能说明 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 mb-8">
                <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li className="flex items-start">
                        <span className="mr-2 text-blue-500">•</span>
                        <span>View all available liquidity pools and their key metrics</span>
                    </li>
                    <li className="flex items-start">
                        <span className="mr-2 text-blue-500">•</span>
                        <span>Select a pool to manage your positions or add new liquidity</span>
                    </li>
                    <li className="flex items-start">
                        <span className="mr-2 text-blue-500">•</span>
                        <span>Monitor performance metrics including APY and total liquidity</span>
                    </li>
                </ul>
            </div>

            <DefiTable />
        </div>
    )
}