'use client';

import { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SubscribePage() {
  const [email, setEmail] = useState('');
  const [keywords, setKeywords] = useState('');
  const [categories, setCategories] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await axios.post(`${API_URL}/api/subscribe`, {
        email,
        keywords,
        categories,
        frequency,
      });

      setMessage(`订阅成功！管理链接：${res.data.manage_url}`);
      setEmail('');
      setKeywords('');
      setCategories('');
    } catch (err) {
      setError('订阅失败，请稍后重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">邮件订阅</h2>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <p className="text-gray-600 mb-6">
          订阅招投标信息，定期接收最新匹配的项目到邮箱
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址 *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              关键词（逗号分隔）
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="安全，等保，密评，云安全..."
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              公告分类（逗号分隔）
            </label>
            <input
              type="text"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              placeholder="招标公告，询比采购..."
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              发送频率
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="input w-full"
            >
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary disabled:opacity-50"
          >
            {loading ? '提交中...' : '创建订阅'}
          </button>
        </form>

        {message && (
          <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          使用说明
        </h3>
        <div className="space-y-3 text-gray-600">
          <p>• 订阅后，系统会定期根据你设置的关键词和分类筛选最新招投标信息</p>
          <p>• 邮件包含匹配的项目标题、发布日期和摘要</p>
          <p>• 每封邮件底部包含管理链接，可取消或修改订阅</p>
          <p>• 关键词和分类支持模糊匹配，留空表示接收所有分类</p>
        </div>
      </div>
    </div>
  );
}
