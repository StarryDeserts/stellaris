// 滑点控制组件
interface SlippageControlProps {
  slippage: number;
  onSlippageChange: (slippage: number) => void;
  minReceived: number | undefined;
}

export const SlippageControl: React.FC<SlippageControlProps> = ({
  slippage,
  onSlippageChange,
  minReceived
}) => {
  return (
    <div className="bg-[#f8f8f8] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">Slippage Protection</p>
        <span className="text-sm font-medium text-gray-600">{(slippage * 100).toFixed(1)}%</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min="0"
          max="0.1"
          step="0.001"
          value={slippage}
          onChange={(e) => onSlippageChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(slippage / 0.1) * 100}%, #e5e7eb ${(slippage / 0.1) * 100}%, #e5e7eb 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>5%</span>
          <span>10%</span>
        </div>
      </div>
      <div className="text-center text-xs text-gray-500 mt-2">
        Minimum received: {minReceived ? (minReceived * (1 - slippage)).toFixed(6) : '--'} PT
      </div>
    </div>
  );
};
