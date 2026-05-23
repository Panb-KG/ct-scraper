'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BidDetail {
  id: number;
  title: string;
  category: string;
  keywords: string;
  publish_date: string;
  summary: string;
  status: string;
  detail_url: string;
  detail: {
    content: string;
    buyer: string;
    agency: string;
    budget: string;
    location: string;
    deadline: string;
  } | null;
}

export default function BidDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [bid, setBid] = useState<BidDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    axios.get(`${API_URL}/api/bids/${id}`)
      .then((res) => setBid(res.data))
      .catch((err) => console.error('Failed to load bid:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  if (!bid || ('error' in bid)) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">未找到该招投标信息</h2>
        <a href="/" className="text-primary-600 hover:text-primary-700">← 返回首页</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 返回链接 */}
      <a href="/" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
        ← 返回首页
      </a>

      {/* 标题区 */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
            {bid.category}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            bid.status === 'scraped' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {bid.status === 'scraped' ? '已抓取' : '待抓取'}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">{bid.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          {bid.publish_date && <span>发布日期：{bid.publish_date}</span>}
          {bid.keywords && <span>关键词：{bid.keywords}</span>}
        </div>
      </div>

      {/* 详情信息 */}
      {bid.detail ? (
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">详细信息</h2>

          {/* 结构化字段 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bid.detail.buyer && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">招标人</div>
                <div className="font-medium text-gray-900">{bid.detail.buyer}</div>
              </div>
            )}
            {bid.detail.agency && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">代理机构</div>
                <div className="font-medium text-gray-900">{bid.detail.agency}</div>
              </div>
            )}
            {bid.detail.budget && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">预算金额</div>
                <div className="font-medium text-gray-900">{bid.detail.budget}</div>
              </div>
            )}
            {bid.detail.location && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">地区</div>
                <div className="font-medium text-gray-900">{bid.detail.location}</div>
              </div>
            )}
            {bid.detail.deadline && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">截止时间</div>
                <div className="font-medium text-gray-900">{bid.detail.deadline}</div>
              </div>
            )}
          </div>

          {/* 正文内容 */}
          {bid.detail.content && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">正文内容</h3>
              <pre className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed bg-gray-50 p-4 rounded-lg">
                {bid.detail.content}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-gray-500">详情页尚未抓取，请稍后查看或手动触发爬取。</p>
        </div>
      )}

      {/* 原文链接 */}
      {bid.detail_url && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <a
            href={bid.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            查看原文链接 →
          </a>
        </div>
      )}
    </div>
  );
}
