'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/chat`, {
        message: userMessage.content,
        history: messages.slice(-10), // 保留最近 10 条对话历史
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: res.data.message,
        sources: res.data.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat failed:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，AI 服务暂时不可用，请稍后重试。',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">AI 招投标助手</h2>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* 消息列表 */}
        <div className="h-96 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg mb-2">👋 你好！我是招投标查询助手</p>
              <p className="text-sm">
                你可以问我关于招投标的任何问题，比如：
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <button
                  onClick={() => setInput('最近有哪些安全相关的招投标？')}
                  className="block w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100"
                >
                  "最近有哪些安全相关的招投标？"
                </button>
                <button
                  onClick={() => setInput('等保测评项目有哪些？')}
                  className="block w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100"
                >
                  "等保测评项目有哪些？"
                </button>
                <button
                  onClick={() => setInput('云安全相关的招标信息')}
                  className="block w-full text-left px-4 py-2 bg-gray-50 rounded hover:bg-gray-100"
                >
                  "云安全相关的招标信息"
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.sources !== undefined && (
                  <p className="text-xs mt-2 opacity-70">
                    基于 {msg.sources} 条相关数据
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-lg">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <form onSubmit={sendMessage} className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的问题..."
              className="input flex-1"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn btn-primary disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
