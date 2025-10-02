"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

type Props = {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  showClear?: boolean;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  inputName?: string;
  autoFocus?: boolean;
};

export default function SearchInput({
  value,
  defaultValue = "",
  placeholder = "搜索...",
  className = "",
  debounceMs = 150, // 降低默认防抖时间
  showClear = true,
  onChange,
  onSearch,
  inputName = "search",
  autoFocus = false,
}: Props) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(isControlled ? value! : defaultValue);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debouncedRef = useRef<number | null>(null);

  // 同步受控模式的值
  useEffect(() => {
    if (isControlled) setInternal(value!);
  }, [value, isControlled]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debouncedRef.current) window.clearTimeout(debouncedRef.current);
    };
  }, []);

  // 处理输入变化
  function handleChange(next: string) {
    setInternal(next); // 立即更新输入框显示值
    if (!isControlled) setInternal(next);

    if (debounceMs > 0 && onChange) {
      setIsDebouncing(true);
      if (debouncedRef.current) window.clearTimeout(debouncedRef.current);
      debouncedRef.current = window.setTimeout(() => {
        onChange(next);
        setIsDebouncing(false);
      }, debounceMs);
    } else {
      onChange?.(next);
    }
  }

  // 清除输入
  function handleClear() {
    setInternal("");
    if (!isControlled) setInternal("");
    onChange?.("");
    onSearch?.("");
  }

  // 处理回车键
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (debouncedRef.current) window.clearTimeout(debouncedRef.current);
      onChange?.(internal);
      onSearch?.(internal);
    }
  }

  // 处理搜索按钮点击
  function handleSearchClick() {
    if (!internal) {
      alert("请输入搜索内容");
      return;
    }
    if (debouncedRef.current) window.clearTimeout(debouncedRef.current);
    onChange?.(internal);
    onSearch?.(internal);
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-6">
      <div className={`flex items-center bg-white border border-gray-300 rounded-lg px-4 py-2 shadow-sm w-full max-w-md ${className}`}>
        <button
          type="button"
          aria-label="搜索"
          onClick={handleSearchClick}
          className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
          disabled={isDebouncing}
        >
          <Search size={18} />
        </button>

        <input
          name={inputName}
          autoFocus={autoFocus}
          value={internal}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 outline-none bg-transparent text-sm text-gray-900 placeholder-gray-400"
          aria-label={placeholder}
        />

        {showClear && internal.length > 0 && (
          <button
            type="button"
            aria-label="清除"
            onClick={handleClear}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        )}

        {isDebouncing && (
          <div className="ml-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
}