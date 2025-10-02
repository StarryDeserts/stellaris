// 持仓选择器组件
import { PositionInfo, DetailedPositionInfo } from '../types';

interface PositionSelectorProps {
  selectedPosition: string;
  onPositionChange: (positionId: string) => void;
  positions: PositionInfo[];
  detailedPositions: DetailedPositionInfo[];
  isLoading: boolean;
}

// 格式化代币余额，与Pools页面保持一致
const formatTokenAmount = (amount: string): string => {
  const num = Number.parseFloat(amount);
  if (isNaN(num) || num === 0) return "0.0000";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(4);
};

export const PositionSelector: React.FC<PositionSelectorProps> = ({
  selectedPosition,
  onPositionChange,
  positions,
  detailedPositions,
  isLoading
}) => {
  return (
    <div className="bg-[#f8f8f8] rounded-xl p-4">
      <p className="text-sm font-medium text-gray-700 mb-2">Select Position</p>
      <select
        value={selectedPosition}
        onChange={(e) => onPositionChange(e.target.value)}
        disabled={isLoading || positions.length === 0}
        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 font-mono"
      >
        {!selectedPosition && (
          <option value="" disabled hidden>
            {positions.length === 0 ? "No positions" : "Select a position"}
          </option>
        )}
        {positions.map((position) => {
          const details = detailedPositions.find((d) => d.id === position.id);
          return (
            <option key={position.id} value={position.id}>
              {details 
                ? `PT: ${formatTokenAmount(details.pt_balance_display || "0")} | YT: ${formatTokenAmount(details.yt_balance_display || "0")}` 
                : `Position ${position.id.slice(0, 6)}...${position.id.slice(-4)}`
              }
            </option>
          );
        })}
      </select>
    </div>
  );
};
