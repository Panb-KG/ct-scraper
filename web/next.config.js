/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
  },
  // 信任代理的 Host 头，支持反向代理场景
  trustHostHeader: true,
  // 确保构建 ID 稳定
  generateBuildId: () => 'stable-build-id',
};

module.exports = nextConfig;
