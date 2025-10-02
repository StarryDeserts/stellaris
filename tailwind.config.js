/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // 使用 class 切换暗黑模式
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 自定义颜色，映射到 CSS 变量
        bg: {
          DEFAULT: 'var(--color-bg)', // 默认背景色
        },
        text: {
          DEFAULT: 'var(--color-text)', // 默认文字色
        },
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'], // 与 body 的字体保持一致
      },
    },
  },
  plugins: [],
};