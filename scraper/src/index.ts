// CT-Scraper 入口
// 直接运行: npx tsx src/index.ts
// 带参数: npx tsx src/index.ts --category "招标公告" --keywords "安全" --pages 3 --skip-details

import { runScraper } from './scraper.js';

const args = process.argv.slice(2);
const opts: {
  categories?: string[];
  keywords?: string[];
  pages?: number;
  skipDetails?: boolean;
} = { pages: 3, skipDetails: false };

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--keywords' && args[i + 1]) {
    opts.keywords = args[i + 1].split(/[,，]/);
    i++;
  } else if (args[i] === '--pages' && args[i + 1]) {
    opts.pages = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--category' && args[i + 1]) {
    opts.categories = [args[i + 1]];
    i++;
  } else if (args[i] === '--skip-details') {
    opts.skipDetails = true;
  }
}

console.log('CT-Scraper 启动...');
console.log('配置:', JSON.stringify(opts, null, 2));

runScraper(opts).catch((err) => {
  console.error('爬取失败:', err);
  process.exit(1);
});
