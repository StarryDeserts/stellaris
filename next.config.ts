import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ 跳过 ESLint 报错
  },
  typescript: {
    ignoreBuildErrors: true,  // ✅ 跳过 TypeScript 报错
  },
  /* 其他 next 配置 */
};

export default nextConfig;
