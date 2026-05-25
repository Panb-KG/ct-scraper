'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';

interface Bid {
  id: number;
  title: string;
  category: string;
  publish_date: string;
  summary: string;
  buyer?: string;
  location?: string;
  budget?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buyer, setBuyer] = useState('');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);

  useEffect(() => {
    loadCategories();
    if (initialQuery) {
      doSearch(1);
    }
  }, [initialQuery]);

  async function loadCategories() {
    try {
      const res = await axios.get(`${API_URL}/api/bids/categories`);
      setCategories(res.data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async function doSearch(p: number = 1) {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: p.toString(),
        limit: '20',
      };
      if (query) params.q = query;
      if (category) params.category = category;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (buyer) params.buyer = buyer;
      if (location) params.location = location;

      const res = await axios.get(`${API_URL}/api/search`, { params });
      setResults(res.data.data || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(1);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">招投标搜索</h2>

      {/* 搜索表单 */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              关键词
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题、摘要、内容..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              公告分类
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input w-full"
            >
              <option value="">全部分类</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              招标人
            </label>
            <input
              type="text"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              placeholder="招标人名称..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              地区
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="项目地区..."
              className="input w-full"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('');
              setStartDate('');
              setEndDate('');
              setBuyer('');
              setLocation('');
              setResults([]);
            }}
            className="btn btn-secondary"
          >
            重置
          </button>
        </div>
      </form>

      {/* 搜索结果 */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            搜索结果
          </h3>
          <span className="text-gray-500 text-sm">
            共 {total} 条记录
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">搜索中...</div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {query || category ? '未找到匹配的结果' : '请输入搜索条件'}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {results.map((bid) => (
                <div
                  key={bid.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-2">
                        {bid.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {bid.category}
                        </span>
                        {bid.buyer && (
                          <span className="text-xs">招标人：{bid.buyer}</span>
                        )}
                        {bid.location && (
                          <span className="text-xs">地区：{bid.location}</span>
                        )}
                        {bid.budget && (
                          <span className="text-xs">预算：{bid.budget}</span>
                        )}
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

            {/* 分页 */}
            {total > 20 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => doSearch(page - 1)}
                  disabled={page <= 1}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-4 py-2 text-gray-600">
                  第 {page} 页 / 共 {Math.ceil(total / 20)} 页
                </span>
                <button
                  onClick={() => doSearch(page + 1)}
                  disabled={page >= Math.ceil(total / 20)}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
