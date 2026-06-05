/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
  },
  // 信任代理的 Host 头，支持反向代理场景
  trustHostHeader: true,
  // 确保构建 ID 稳定
  generateBuildId: () => 'stable-build-id',
  // 使用 standalone 输出减少运行时依赖
  output: 'standalone',
};

module.exports = nextConfig;
