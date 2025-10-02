// 标签页选择器组件
import { TabType } from '../types';

interface TabSelectorProps {
  selectedTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TabSelector: React.FC<TabSelectorProps> = ({ selectedTab, onTabChange }) => {
  return (
    <div className="flex justify-center mb-6 bg-gray-200 rounded-full p-1">
      <div className="flex w-full justify-between">
        <button
          onClick={() => onTabChange('SY')}
          className={`flex-1 py-2 px-4 font-semibold rounded-full transition-colors text-center ${
            selectedTab === 'SY'
              ? 'text-blue-500 border-2 border-blue-500 bg-blue-100'
              : 'text-blue-500'
          }`}
        >
          SY
        </button>
        <button
          onClick={() => onTabChange('PT')}
          className={`flex-1 py-2 px-4 font-semibold rounded-full transition-colors text-center ${
            selectedTab === 'PT'
              ? 'text-purple-500 border-2 border-purple-500 bg-purple-100'
              : 'text-purple-500'
          }`}
        >
          PT
        </button>
        <button
          onClick={() => onTabChange('YT')}
          className={`flex-1 py-2 px-4 font-semibold rounded-full transition-colors text-center ${
            selectedTab === 'YT'
              ? 'text-green-500 border-2 border-green-500 bg-green-100'
              : 'text-green-500'
          }`}
        >
          YT
        </button>
      </div>
    </div>
  );
};
