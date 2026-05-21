'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface Bid {
  id: number;
  title: string;
  category: string;
  publish_date: string;
  summary: string;
  status: string;
}

interface Stats {
  total_bids: number;
  scraped_bids: number;
  total_details: number;
  active_subscriptions: number;
  completed_scrapes: number;
  by_category: { category: string; count: number }[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBids, setRecentBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadStats();
    loadRecentBids();
  }, []);

  async function loadStats() {
    try {
      const res = await axios.get(`${API_URL}/api/stats`);
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function loadRecentBids() {
    try {
      const res = await axios.get(`${API_URL}/api/bids`, {
        params: { limit: 10, page: 1 },
      });
      setRecentBids(res.data.data || []);
    } catch (error) {
      console.error('Failed to load bids:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  }

  return (
    <div className="space-y-8">
      {/* 搜索区 */}
      <div className="text-center py-12 bg-white rounded-lg shadow-sm">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          招投标信息查询
        </h2>
        <p className="text-gray-600 mb-8">
          中国电信阳光采购网全量数据 · 智能搜索 · AI 对话查询
        </p>
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入关键词搜索招投标信息..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              搜索
            </button>
          </div>
        </form>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-3xl font-bold text-primary-600">
              {stats.total_bids.toLocaleString()}
            </div>
            <div className="text-gray-600 mt-1">总记录数</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-3xl font-bold text-green-600">
              {stats.scraped_bids.toLocaleString()}
            </div>
            <div className="text-gray-600 mt-1">已爬取</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-3xl font-bold text-purple-600">
              {stats.total_details.toLocaleString()}
            </div>
            <div className="text-gray-600 mt-1">详情页</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-3xl font-bold text-orange-600">
              {stats.active_subscriptions}
            </div>
            <div className="text-gray-600 mt-1">活跃订阅</div>
          </div>
        </div>
      )}

      {/* 分类统计 */}
      {stats && stats.by_category.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            分类统计
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {stats.by_category.map((cat) => (
              <div
                key={cat.category}
                className="text-center p-3 bg-gray-50 rounded-lg"
              >
                <div className="text-lg font-bold text-gray-900">
                  {cat.count}
                </div>
                <div className="text-sm text-gray-600">{cat.category}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最新招投标 */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            最新招投标信息
          </h3>
          <a
            href="/search"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            查看全部 →
          </a>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : recentBids.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无数据，请先运行爬虫
          </div>
        ) : (
          <div className="space-y-3">
            {recentBids.map((bid) => (
              <div
                key={bid.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {bid.title}
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {bid.category}
                      </span>
                      <span>{bid.publish_date}</span>
                    </div>
                  </div>
                  <a
                    href={`/bids/${bid.id}`}
                    className="ml-4 text-primary-600 hover:text-primary-700 text-sm font-medium whitespace-nowrap"
                  >
                    查看详情
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
