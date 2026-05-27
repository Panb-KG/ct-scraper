'use client';
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Bid {
  id: number;
  source_id: string;
  title: string;
  category: string;
  publish_date: string | null;
  province: string;
  status: string;
  scraped_at: string | null;
  created_at: string;
  detail_url: string;
}

interface BidDetail {
  id: number;
  bid_id: number;
  content: string;
  buyer: string;
  agency: string;
  budget: string;
  location: string;
  deadline: string;
  scraped_at: string | null;
}

const CATEGORIES = ['资格预审公告', '招标公告', '询比公告', '谈判采购公告', '拍卖公告', '政企合作招募公告'];
const STATUS_OPTIONS = ['pending', 'scraped', 'error'];
const STATUS_LABELS: Record<string, string> = {
  pending: '待抓详情',
  scraped: '已抓详情',
  error: '抓取失败',
};

export default function DatabasePage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');

  // Selected bid detail
  const [selectedBid, setSelectedBid] = useState<{ bid: Bid; detail: BidDetail } | null>(null);

  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      if (keyword) params.set('keyword', keyword);

      const res = await fetch(`${API_BASE}/api/scrape/bids?${params}`);
      const data = await res.json();
      setBids(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (e) {
      console.error('获取数据失败', e);
    } finally {
      setLoading(false);
    }
  }, [page, category, status, keyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const viewDetail = async (bid: Bid) => {
    try {
      const res = await fetch(`${API_BASE}/api/scrape/bids/${bid.id}`);
      const data = await res.json();
      setSelectedBid(data);
    } catch (e) {
      console.error('获取详情失败', e);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const formatTime = (t: string | null) => {
    if (!t) return '-';
    return new Date(t + 'Z').toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">数据库浏览</h1>

      {/* 筛选栏 */}
      <form onSubmit={handleSearch} className="bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">分类</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">全部分类</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">全部状态</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">关键词</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索标题..."
              className="border rounded-lg px-3 py-2 text-sm w-48"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            搜索
          </button>
          {(category || status || keyword) && (
            <button
              type="button"
              onClick={() => { setCategory(''); setStatus(''); setKeyword(''); setPage(1); }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm"
            >
              清除筛选
            </button>
          )}
        </div>
      </form>

      {/* 统计 */}
      <div className="text-sm text-gray-500">
        共 <span className="font-medium text-gray-900">{total}</span> 条记录
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">标题</th>
                <th className="text-left px-4 py-3 font-medium w-32">分类</th>
                <th className="text-left px-4 py-3 font-medium w-28">省份</th>
                <th className="text-left px-4 py-3 font-medium w-28">发布日期</th>
                <th className="text-left px-4 py-3 font-medium w-24">状态</th>
                <th className="text-left px-4 py-3 font-medium w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">加载中...</td>
                </tr>
              )}
              {!loading && bids.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无数据</td>
                </tr>
              )}
              {bids.map((bid) => (
                <tr key={bid.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="max-w-md truncate font-medium text-gray-900">{bid.title}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{bid.category}</td>
                  <td className="px-4 py-3 text-gray-600">{bid.province || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{bid.publish_date || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      bid.status === 'scraped' ? 'bg-green-100 text-green-700' :
                      bid.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {STATUS_LABELS[bid.status] || bid.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewDetail(bid)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-gray-500">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedBid && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{selectedBid.bid.title}</h3>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                <span>{selectedBid.bid.category}</span>
                <span>{selectedBid.bid.province || '-'}</span>
                <span>发布: {selectedBid.bid.publish_date || '-'}</span>
              </div>
            </div>
            <button onClick={() => setSelectedBid(null)} className="text-gray-400 hover:text-gray-600 text-sm">
              关闭
            </button>
          </div>

          {selectedBid.detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedBid.detail.buyer && (
                  <div><span className="text-gray-500">招标人:</span> <span className="font-medium">{selectedBid.detail.buyer}</span></div>
                )}
                {selectedBid.detail.agency && (
                  <div><span className="text-gray-500">代理机构:</span> <span className="font-medium">{selectedBid.detail.agency}</span></div>
                )}
                {selectedBid.detail.budget && (
                  <div><span className="text-gray-500">预算金额:</span> <span className="font-medium">{selectedBid.detail.budget}</span></div>
                )}
                {selectedBid.detail.location && (
                  <div><span className="text-gray-500">地点:</span> <span className="font-medium">{selectedBid.detail.location}</span></div>
                )}
                {selectedBid.detail.deadline && (
                  <div><span className="text-gray-500">截止时间:</span> <span className="font-medium">{selectedBid.detail.deadline}</span></div>
                )}
              </div>
              {selectedBid.detail.content && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">公告内容</h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {selectedBid.detail.content}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8 text-sm">
              尚未抓取详情内容
            </div>
          )}
        </div>
      )}
    </div>
  );
}
