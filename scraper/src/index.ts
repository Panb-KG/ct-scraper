import { runScraperWithTask } from './engine.js';

// 支持 --task <id> 参数，按任务执行
const args = process.argv.slice(2);
const taskIdx = args.indexOf('--task');

if (taskIdx !== -1 && args[taskIdx + 1]) {
  const taskId = parseInt(args[taskIdx + 1]);
  console.log(`按任务执行: taskId=${taskId}`);
  runScraperWithTask(taskId).catch((err) => {
    console.error('任务执行失败:', err);
    process.exit(1);
  });
} else {
  console.error('用法: tsx src/index.ts --task <taskId>');
  console.error('任务由后端 API 创建并调度');
  process.exit(1);
}
