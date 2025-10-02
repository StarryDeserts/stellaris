"use client";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// 提供全局错误通知的函数
export function notifyError(message: string){
  toast.error(message, {
    position: "top-center", // 让错误信息显示在屏幕顶部中央
    autoClose: 1000, // 1秒后自动关闭
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: "light",
  });
}

export function notifyWarning(message: string) {
    toast.warning(message, {
      position: "top-center", // 显示在顶部中央
      autoClose: 1000, // 1秒后自动关闭
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: "light",
    });
  }

export function notifySuccess(message: string) {
  toast.success(message, {
    position: "top-center", // 显示在顶部中央
    autoClose: 5000, // 5秒后自动关闭，让用户有足够时间看到完整消息
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: "light",
    });
  }

// 这个组件用于提供 Toast 组件
export default function ToastProvider() {
  return <ToastContainer />;
}
