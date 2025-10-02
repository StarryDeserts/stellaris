// 数量输入组件

// 格式化余额显示，不显示小数
const formatBalance = (balance: string): string => {
  const num = Math.floor(Number(balance) / 100000000); // 假设余额是8位小数，取整数部分
  if (num >= 1000000) return `${Math.floor(num / 1000000)}M`;
  if (num >= 1000) return `${Math.floor(num / 1000)}K`;
  return num.toString();
};

interface AmountInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  placeholder: string;
  disabled: boolean;
  icon?: string;
  balance?: string;
  balanceLoading?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  icon,
  balance,
  balanceLoading
}) => {
  return (
    <div className="bg-[#f8f8f8] rounded-xl p-4 flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          {balance !== undefined && (
            <div className="text-xs">
              {balanceLoading ? (
                <span className="text-gray-400">Loading...</span>
              ) : (
                <span>
                  <span className="text-gray-500">Balance: </span>
                  <span className="text-blue-600 font-semibold">{formatBalance(balance)}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center">
          <input
            type="number"
            value={value || ""}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
      </div>
      {icon && (
        <img
          src={icon}
          alt={label}
          className="w-8 h-8 rounded-full self-center"
        />
      )}
    </div>
  );
};
