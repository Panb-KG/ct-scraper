export const CONFIG = {
  // 目标网站
  BASE_URL: 'https://caigou.chinatelecom.com.cn',

  // 公告分类（对应网站左侧导航）
  CATEGORIES: [
    '招标公告',
    '资格预审',
    '询比采购',
    '谈判采购',
    '拍卖公告',
    '评价检测',
    '政企合作招募',
  ],

  // 默认搜索关键词
  DEFAULT_KEYWORDS: ['安全', '等保', '密评', '云安全', '天翼云', '合规', '风险评估'],

  // 爬取配置
  DEFAULT_PAGES: 3,
  MAX_PAGES: 50,

  // 反爬策略
  DELAY_MIN: 3000,    // 最小延迟（毫秒）
  DELAY_MAX: 8000,    // 最大延迟（毫秒）
  DETAIL_DELAY_MIN: 5000,  // 详情页延迟
  DETAIL_DELAY_MAX: 10000,

  // 数据库路径
  DB_PATH: '../server/data/ct-scraper.db',

  // 日志
  LOG_LEVEL: 'info',  // debug | info | warn | error
};

export function getDelay(): number {
  return CONFIG.DELAY_MIN + Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN);
}

export function getDetailDelay(): number {
  return CONFIG.DETAIL_DELAY_MIN + Math.random() * (CONFIG.DETAIL_DELAY_MAX - CONFIG.DETAIL_DELAY_MIN);
}
