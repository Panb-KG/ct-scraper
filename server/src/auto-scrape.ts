/**
 * AUTO_SCRAPE 启动引导脚本
 * 等待 Fastify 服务就绪后，通过 API 创建全量爬取任务
 * 由 start.sh 在后台调用
 */

const SERVER_PORT = parseInt(process.env.SERVER_PORT || '3001');
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 2000; // 2s

async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`http://localhost:${SERVER_PORT}/api/scrape/status`);
      if (res.ok) return true;
    } catch {
      // server not ready
    }
    console.log(`[auto-scrape] 等待 Fastify 启动... (${i + 1}/${MAX_RETRIES})`);
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  return false;
}

async function createFullTask(): Promise<void> {
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}/api/scrape/tasks/full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = (await res.json()) as { task_id?: string; pid?: number };
    if (res.ok) {
      console.log(`[auto-scrape] ✅ 全量爬取任务已创建: task_id=${data.task_id}, pid=${data.pid}`);
    } else {
      console.error(`[auto-scrape] ❌ 创建任务失败:`, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`[auto-scrape] ❌ 请求失败:`, err instanceof Error ? err.message : 'unknown');
  }
}

async function main() {
  console.log('[auto-scrape] AUTO_SCRAPE=true, 正在启动全量爬取...');

  const ready = await waitForServer();
  if (!ready) {
    console.error('[auto-scrape] ❌ Fastify 启动超时，放弃自动爬取');
    process.exit(1);
  }

  console.log('[auto-scrape] Fastify 已就绪，创建全量爬取任务...');
  await createFullTask();
}

main().catch((err) => {
  console.error('[auto-scrape] Fatal:', err);
  process.exit(1);
});
