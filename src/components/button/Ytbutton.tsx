"use client"

import React, { useState } from "react";

export type YTButtonProps = {
  id: string;
  label?: string; // 默认为 YT
  data?: string | number; // 按钮右侧显示的数据
  className?: string;
};

export default function YTButton({ id, label = "YT", data, className = "" }: YTButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "group inline-flex items-center gap-3 px-4 py-2 rounded-lg transition-shadow shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2" +
          " " +
          className
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {/* 左侧：小图标，hover 高亮为星光金 #FFD700 */}
        <span
          className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-semibold"
          style={{ background: "transparent" }}
        >
          <svg
            className="w-5 h-5 transform transition-colors group-hover:fill-[\#FFD700]"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path d="M12 2l2.9 6.21L21 9.27l-5 4.87L17.9 22 12 18.56 6.1 22 7 14.14 2 9.27l6.1-1.06L12 2z" />
          </svg>
        </span>

        {/* 中间文本 YT */}
        <span className="text-sm font-semibold" style={{ color: "#E6E6FA" }}>
          {label}
        </span>

        {/* 右侧内部数据 */}
        {data !== undefined && (
          <span className="ml-2 text-xs font-medium text-gray-300 bg-gray-800/30 px-2 py-0.5 rounded-md">
            {data}
          </span>
        )}
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          {/* overlay */}
          <div
            className="absolute inset-0 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          />

          {/* content */}
          <div className="relative z-10 w-full max-w-md p-6 rounded-xl bg-gray-900 border border-gray-800 shadow-2xl">
            <h3 className="text-lg font-bold mb-3" style={{ color: "#E6E6FA" }}>
              池子信息
            </h3>
            <div className="text-sm text-gray-200 mb-4">
              传入的 ID：
              <div className="mt-2 p-3 bg-gray-800 rounded text-xs font-mono break-all" style={{ color: "#FFD700" }}>
                {id}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-md text-sm font-medium bg-transparent border border-gray-700 hover:bg-gray-800/60"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
              <button
                className="px-4 py-2 rounded-md text-sm font-medium text-black bg-[\#FFD700] hover:bg-yellow-500"
                onClick={() => {
                  // 示例：也可以在这里做复制、跳转等动作
                  navigator.clipboard?.writeText(id);
                }}
              >
                复制 ID
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
