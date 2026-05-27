import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CT-Scraper 招投标查询平台',
  description: '中国电信阳光采购网招投标信息爬取与智能查询',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                CT-Scraper 招投标查询平台
              </h1>
              <nav className="flex gap-4">
                <a href="/" className="text-gray-600 hover:text-gray-900">
                  首页
                </a>
                <a href="/search" className="text-gray-600 hover:text-gray-900">
                  搜索
                </a>
                <a href="/chat" className="text-gray-600 hover:text-gray-900">
                  AI 对话
                </a>
                <a href="/subscribe" className="text-gray-600 hover:text-gray-900">
                  订阅
                </a>
                <a href="/scrape" className="text-gray-600 hover:text-gray-900">
                  抓取
                </a>
                <a href="/database" className="text-gray-600 hover:text-gray-900">
                  数据库
                </a>
              </nav>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="bg-white border-t mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-gray-500 text-sm">
              CT-Scraper © 2026 | 数据来源：中国电信阳光采购网
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
