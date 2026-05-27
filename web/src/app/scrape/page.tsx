'use client';
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Task {
  id: number;
  task_type: string;
  status: string;
  total_items: number;
  completed_items: number;
  success_count: number;
  fail_count: number;
  progress_pct: number;
  started_at: string | null;
  finished_at: string | null;
  error_msg: string | null;
  created_at: string;
}

interface TaskDetail {
  task: Task;
  by_category: {
    category: string;
    total_pages: number;
    success_pages: number;
    failed_pages: number;
    records_found: number;
    records_new: number;
  }[];
  recent_items: {
    category: string;
    page_num: number;
    status: string;
    records_found: number;
    records_new: number;
    finished_at: string | null;
  }[];
}

interface Stats {
  total_bids: number;
  scraped: number;
  pending: number;
  by_category: { category: string; count: number }[];
  recent_daily: { date: string; count: number }[];
  last_full_scrape: Task | null;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  full_site: '全量抓取',
  incremental: '增量抓取',
  detail: '详情页抓取',
};

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-gray-200 text-gray-700',
  running: 'bg-blue-100 text-blue-700 animate-pulse',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  paused: 'bg-yellow-100 text-yellow-700',
};

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const barColor = status === 'failed' ? 'bg-red-500' : status === 'completed' ? 'bg-green-500' : 'bg-blue-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function ScrapePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/scrape/stats`),
        fetch(`${API_BASE}/api/scrape/tasks`),
      ]);
      const statsData = await statsRes.json();
      const tasksData = await tasksRes.json();
      setStats(statsData);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (e) {
      console.error('获取数据失败', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 5000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const launchTask = async (type: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/scrape/tasks/${type === 'full' ? 'full' : type === 'incremental' ? 'incremental' : 'detail'}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error || '启动失败');
      }
    } catch (e) {
      alert('请求失败');
    } finally {
      setLoading(false);
    }
  };

  const viewTask = async (taskId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/scrape/tasks/${taskId}`);
      const data = await res.json();
      setSelectedTask(data);
    } catch (e) {
      console.error('获取任务详情失败', e);
    }
  };

  const formatTime = (t: string | null) => {
    if (!t) return '-';
    return new Date(t + 'Z').toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">抓取控制台</h1>
        <div className="flex gap-3">
          <button
            onClick={() => launchTask('full')}
            disabled={loading || running}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? '启动中...' : '全量抓取'}
          </button>
          <button
            onClick={() => launchTask('incremental')}
            disabled={loading || running}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {loading ? '启动中...' : '增量抓取'}
          </button>
          <button
            onClick={() => launchTask('detail')}
            disabled={loading || running}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            {loading ? '启动中...' : '抓取详情'}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-sm text-gray-500">总公告数</div>
            <div className="text-2xl font-bold text-blue-600">{stats.total_bids}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-sm text-gray-500">已抓详情</div>
            <div className="text-2xl font-bold text-green-600">{stats.scraped}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-sm text-gray-500">待抓详情</div>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-sm text-gray-500">上次全量</div>
            <div className="text-sm font-medium">
              {stats.last_full_scrape ? formatTime(stats.last_full_scrape.finished_at) : '暂无'}
            </div>
          </div>
        </div>
      )}

      {/* 分类分布 */}
      {stats && stats.by_category.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-700 mb-3">分类分布</h3>
          <div className="flex flex-wrap gap-3">
            {stats.by_category.map((c) => (
              <div key={c.category} className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">{c.category}</span>
                <span className="font-semibold text-blue-600">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-4 py-3 border-b">
          <h3 className="font-medium text-gray-900">任务列表</h3>
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {tasks.length === 0 && (
            <div className="p-6 text-center text-gray-400">暂无任务</div>
          )}
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => viewTask(task.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status] || 'bg-gray-100'}`}>
                    {task.status}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{formatTime(task.created_at)}</span>
              </div>
              <ProgressBar pct={task.progress_pct} status={task.status} />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{task.completed_items}/{task.total_items} 页</span>
                <span>新增 {task.success_count} 条</span>
                {task.fail_count > 0 && <span className="text-red-500">失败 {task.fail_count}</span>}
                <span>{task.progress_pct.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 任务详情弹窗 */}
      {selectedTask && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-900">
              {TASK_TYPE_LABELS[selectedTask.task.task_type]} — 详情 #{selectedTask.task.id}
            </h3>
            <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600 text-sm">
              关闭
            </button>
          </div>
          <ProgressBar pct={selectedTask.task.progress_pct} status={selectedTask.task.status} />
          <p className="text-sm text-gray-500 mt-2">
            {selectedTask.task.completed_items}/{selectedTask.task.total_items} 页完成，
            新增 {selectedTask.task.success_count} 条，
            失败 {selectedTask.task.fail_count} 条
          </p>

          {/* 分类进度 */}
          {selectedTask.by_category && selectedTask.by_category.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">各分类进度</h4>
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">分类</th>
                    <th className="text-center py-2">总页数</th>
                    <th className="text-center py-2">成功</th>
                    <th className="text-center py-2">失败</th>
                    <th className="text-center py-2">找到</th>
                    <th className="text-center py-2">新增</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTask.by_category.map((c) => (
                    <tr key={c.category} className="border-b">
                      <td className="py-2">{c.category}</td>
                      <td className="text-center py-2">{c.total_pages}</td>
                      <td className="text-center py-2 text-green-600">{c.success_pages}</td>
                      <td className="text-center py-2 text-red-500">{c.failed_pages}</td>
                      <td className="text-center py-2">{c.records_found}</td>
                      <td className="text-center py-2 font-medium">{c.records_new}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 最近完成的页 */}
          {selectedTask.recent_items && selectedTask.recent_items.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">最近完成</h4>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {selectedTask.recent_items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-gray-600">
                    <span className={`w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="w-32 truncate">{item.category}</span>
                    <span>第 {item.page_num} 页</span>
                    <span className="text-gray-400">{item.records_found} 条 ({item.records_new} 新)</span>
                    <span className="ml-auto text-gray-400">{item.finished_at}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
