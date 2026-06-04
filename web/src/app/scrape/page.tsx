'use client';
import { useState, useEffect, useCallback } from 'react';

// 使用相对路径，通过 Next.js 反向代理转发到 Fastify 后端
const API_BASE = '';

// 刷新间隔
const REFRESH_RUNNING = 3000; // 运行时 3s
const REFRESH_IDLE = 15000;   // 空闲时 15s

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

interface ProgressData {
  current_task: {
    id: number;
    task_type: string;
    status: string;
    progress_pct: number;
    completed_items: number;
    total_items: number;
    success_count: number;
    started_at: string;
    by_category: {
      category: string;
      total_pages: number;
      success_pages: number;
      failed_pages: number;
      pending_pages: number;
      fetching_pages: number;
      new_records: number;
    }[];
  } | null;
  last_task: {
    id: number;
    task_type: string;
    status: string;
    progress_pct: number;
    success_count: number;
    total_items: number;
    started_at: string;
    finished_at: string;
    error_msg: string;
  } | null;
  data: {
    total_bids: number;
    scraped: number;
    pending: number;
  };
}

const TASK_TYPE_LABELS: Record<string, string> = {
  full_site: '全量抓取',
  incremental: '增量抓取',
  detail: '详情页抓取',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  queued: { label: '排队中', color: 'bg-gray-100 text-gray-600', icon: '⏳' },
  running: { label: '运行中', color: 'bg-blue-100 text-blue-700', icon: '🔄' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700', icon: '✅' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700', icon: '❌' },
  paused: { label: '已暂停', color: 'bg-yellow-100 text-yellow-700', icon: '⏸️' },
};

// ============ 组件 ============

function ProgressBar({ pct, status, height = 'h-3' }: { pct: number; status: string; height?: string }) {
  const barColor =
    status === 'failed' ? 'bg-red-500' :
    status === 'completed' ? 'bg-green-500' :
    status === 'running' ? 'bg-blue-500' : 'bg-gray-400';

  return (
    <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ============ 主页面 ============

export default function ScrapePage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const isRunning = progress?.current_task?.status === 'running';

  // 智能刷新
  const fetchData = useCallback(async () => {
    try {
      const [progressRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/scrape/progress`),
        fetch(`${API_BASE}/api/scrape/tasks`),
      ]);
      if (progressRes.ok) setProgress(await progressRes.json());
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(Array.isArray(data) ? data : []);
      }
      setLastUpdate(new Date());
    } catch (e) {
      console.error('获取数据失败', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, isRunning ? REFRESH_RUNNING : REFRESH_IDLE);
    return () => clearInterval(timer);
  }, [fetchData, isRunning]);

  const launchTask = async (type: 'full' | 'incremental' | 'detail') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/scrape/tasks/${type}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error || '启动失败');
      }
    } catch {
      alert('请求失败，请检查服务是否正常运行');
    } finally {
      setLoading(false);
    }
  };

  const viewTask = async (taskId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/scrape/tasks/${taskId}`);
      if (res.ok) setSelectedTask(await res.json());
    } catch (e) {
      console.error('获取任务详情失败', e);
    }
  };

  const formatTime = (t: string | null) => {
    if (!t) return '-';
    return new Date(t + 'Z').toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const elapsed = (start: string) => {
    const ms = Date.now() - new Date(start + 'Z').getTime();
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}分${s}秒`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🕷️ 抓取控制台</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理爬虫任务 · 实时监控进度
            {lastUpdate && <span className="ml-2 text-gray-400">· 更新于 {lastUpdate.toLocaleTimeString('zh-CN')}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => launchTask('full')}
            disabled={loading || isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {loading ? '⏳ 启动中...' : '🚀 全量抓取'}
          </button>
          <button
            onClick={() => launchTask('incremental')}
            disabled={loading || isRunning}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {loading ? '⏳ 启动中...' : '📥 增量抓取'}
          </button>
          <button
            onClick={() => launchTask('detail')}
            disabled={loading || isRunning}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {loading ? '⏳ 启动中...' : '📄 抓取详情'}
          </button>
        </div>
      </div>

      {/* 运行中任务横幅 */}
      {isRunning && progress?.current_task && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-xl animate-pulse">🔄</span>
              <div>
                <span className="font-semibold text-blue-900">
                  {TASK_TYPE_LABELS[progress.current_task.task_type] || progress.current_task.task_type}
                </span>
                <span className="ml-2 text-sm text-blue-600">运行中 · 已耗时 {elapsed(progress.current_task.started_at)}</span>
              </div>
            </div>
            <span className="text-2xl font-bold text-blue-700">
              {progress.current_task.progress_pct.toFixed(1)}%
            </span>
          </div>
          <ProgressBar pct={progress.current_task.progress_pct} status="running" height="h-4" />
          <div className="flex justify-between text-xs text-blue-600 mt-2">
            <span>{progress.current_task.completed_items} / {progress.current_task.total_items} 页</span>
            <span>已抓取 {progress.current_task.success_count} 条新记录</span>
          </div>

          {/* 各分类实时进度 */}
          {progress.current_task.by_category && progress.current_task.by_category.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {progress.current_task.by_category.map((cat) => {
                const catPct = cat.total_pages > 0
                  ? ((cat.success_pages + cat.failed_pages) / cat.total_pages * 100).toFixed(0)
                  : '0';
                return (
                  <div key={cat.category} className="bg-white rounded-lg p-3 border border-blue-100">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{cat.category}</span>
                      <span className="text-gray-500">{catPct}%</span>
                    </div>
                    <ProgressBar pct={parseInt(catPct)} status="running" height="h-2" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{cat.success_pages}/{cat.total_pages} 页</span>
                      <span className="text-green-600">+{cat.new_records} 条</span>
                      {cat.failed_pages > 0 && <span className="text-red-500">{cat.failed_pages} 失败</span>}
                      {cat.fetching_pages > 0 && <span className="text-blue-500">{cat.fetching_pages} 抓取中</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 数据统计卡片 */}
      {progress?.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="总记录" value={progress.data.total_bids} color="text-blue-600" />
          <StatCard label="已爬详情" value={progress.data.scraped} color="text-green-600"
            sub={progress.data.total_bids > 0 ? `${(progress.data.scraped / progress.data.total_bids * 100).toFixed(0)}%` : ''} />
          <StatCard label="待爬详情" value={progress.data.pending} color="text-orange-600" />
          <StatCard
            label="上次任务"
            value={progress.last_task ? TASK_TYPE_LABELS[progress.last_task.task_type] || progress.last_task.task_type : '暂无'}
            color="text-gray-700"
            sub={progress.last_task ? formatTime(progress.last_task.finished_at) : ''}
          />
        </div>
      )}

      {/* 任务列表 */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">📋 任务历史</h3>
          <span className="text-xs text-gray-400">{tasks.length} 个任务</span>
        </div>
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {tasks.length === 0 && (
            <div className="p-8 text-center text-gray-400">暂无任务，点击上方按钮开始爬取</div>
          )}
          {tasks.map((task) => {
            const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.queued;
            return (
              <div
                key={task.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedTask?.task.id === task.id ? 'bg-blue-50' : ''}`}
                onClick={() => viewTask(task.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">#{task.id}</span>
                    <span className="text-sm text-gray-700">{TASK_TYPE_LABELS[task.task_type] || task.task_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sc.color}`}>
                      {sc.icon} {sc.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(task.created_at)}</span>
                </div>
                <ProgressBar pct={task.progress_pct} status={task.status} />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{task.completed_items}/{task.total_items} 页</span>
                  <span>新增 {task.success_count} 条</span>
                  {task.fail_count > 0 && <span className="text-red-500">失败 {task.fail_count}</span>}
                  {task.error_msg && <span className="text-red-400 truncate max-w-xs ml-2">{task.error_msg}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 任务详情面板 */}
      {selectedTask && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                {TASK_TYPE_LABELS[selectedTask.task.task_type]} — 任务 #{selectedTask.task.id}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {selectedTask.task.completed_items}/{selectedTask.task.total_items} 页完成 ·
                新增 {selectedTask.task.success_count} 条 ·
                失败 {selectedTask.task.fail_count} 条
              </p>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              className="text-gray-400 hover:text-gray-600 text-sm px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              关闭 ✕
            </button>
          </div>
          <ProgressBar pct={selectedTask.task.progress_pct} status={selectedTask.task.status} height="h-4" />

          {/* 分类进度表 */}
          {selectedTask.by_category && selectedTask.by_category.length > 0 && (
            <div className="mt-5">
              <h4 className="text-sm font-medium text-gray-700 mb-3">各分类进度</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 border-b bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3">分类</th>
                      <th className="text-center py-2 px-3">总页数</th>
                      <th className="text-center py-2 px-3">成功</th>
                      <th className="text-center py-2 px-3">失败</th>
                      <th className="text-center py-2 px-3">找到记录</th>
                      <th className="text-center py-2 px-3">新增</th>
                      <th className="text-center py-2 px-3 w-32">进度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTask.by_category.map((c) => {
                      const pct = c.total_pages > 0 ? (c.success_pages / c.total_pages * 100) : 0;
                      return (
                        <tr key={c.category} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium">{c.category}</td>
                          <td className="text-center py-2 px-3">{c.total_pages}</td>
                          <td className="text-center py-2 px-3 text-green-600 font-medium">{c.success_pages}</td>
                          <td className="text-center py-2 px-3">{c.failed_pages > 0 ? <span className="text-red-500">{c.failed_pages}</span> : '0'}</td>
                          <td className="text-center py-2 px-3">{c.records_found}</td>
                          <td className="text-center py-2 px-3 font-semibold text-blue-600">{c.records_new}</td>
                          <td className="py-2 px-3">
                            <ProgressBar pct={pct} status={selectedTask.task.status} height="h-2" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 最近完成的抓取 */}
          {selectedTask.recent_items && selectedTask.recent_items.length > 0 && (
            <div className="mt-5">
              <h4 className="text-sm font-medium text-gray-700 mb-3">最近完成的抓取</h4>
              <div className="max-h-56 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-3">
                {selectedTask.recent_items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs py-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="w-28 truncate text-gray-600">{item.category}</span>
                    <span className="text-gray-500">第 {item.page_num} 页</span>
                    <span className="text-gray-400">{item.records_found} 条</span>
                    {item.records_new > 0 && <span className="text-green-600">+{item.records_new}</span>}
                    <span className="ml-auto text-gray-400 font-mono">{item.finished_at}</span>
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
