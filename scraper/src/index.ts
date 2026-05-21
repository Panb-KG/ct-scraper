import { runScraper } from './scraper.js';

// 默认爬取配置
const options = {
  pages: 3,
  skipDetails: false,
};

console.log('CT-Scraper 启动...');
console.log('配置：', JSON.stringify(options, null, 2));

runScraper(options)
  .then((result) => {
    console.log('爬取完成：', result);
    process.exit(0);
  })
  .catch((err) => {
    console.error('爬取失败：', err);
    process.exit(1);
  });
