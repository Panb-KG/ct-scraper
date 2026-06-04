import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body.message as string;
  const history = (body.history || []) as Array<{ role: string; content: string }>;

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // 先搜索数据库获取相关数据
  const db = getDb();
  const searchResults = db.prepare(`
    SELECT b.title, b.category, b.summary, bd.buyer, bd.budget, bd.location
    FROM bids b
    LEFT JOIN bid_details bd ON b.id = bd.bid_id
    WHERE b.title LIKE ? OR b.summary LIKE ? OR bd.content LIKE ?
    ORDER BY b.publish_date DESC
    LIMIT 10
  `).all(`%${message}%`, `%${message}%`, `%${message}%`);

  db.close();

  // 构建 AI 上下文
  const context = `
你是一个招投标信息查询助手。基于以下数据库查询结果回答用户问题：

## 相关招投标数据
${JSON.stringify(searchResults, null, 2)}

## 可用查询维度
- 关键词搜索（标题、摘要、内容）
- 公告分类（招标公告、资格预审、询比采购、谈判采购、拍卖公告、评价检测、政企合作招募）
- 时间范围
- 招标人
- 地区
- 预算金额

## 回答要求
1. 基于数据回答，不要编造信息
2. 如果数据不足，说明需要补充哪些信息
3. 提供具体的招投标标题和发布日期
4. 如果用户需要更详细信息，建议他们使用搜索功能
`;

  // 从环境变量获取 API 配置
  const apiKey = process.env.BAILIAN_API_KEY || '';
  const baseUrl = process.env.BAILIAN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const apiUrl = baseUrl.replace(/\/$/, '') + '/chat/completions';

  if (!apiKey) {
    return NextResponse.json({
      error: '未配置 BAILIAN_API_KEY 环境变量',
      sources: searchResults.length,
      fallback: '已找到 ' + searchResults.length + ' 条相关记录，请使用搜索功能查看',
    }, { status: 500 });
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: context },
          ...history,
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bailian API error:', response.status, errorText);
      return NextResponse.json({
        error: `AI 服务返回错误: ${response.status}`,
        sources: searchResults.length,
        fallback: '已找到 ' + searchResults.length + ' 条相关记录，请使用搜索功能查看',
      }, { status: 500 });
    }

    const data = await response.json() as Record<string, unknown>;
    const choices = (data.choices as Array<Record<string, unknown>>) || [];
    const assistantMessage = (choices[0]?.message as Record<string, unknown>)?.content || '抱歉，无法生成回答';

    return NextResponse.json({
      message: assistantMessage,
      sources: searchResults.length,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({
      error: 'AI 服务不可用',
      sources: searchResults.length,
      fallback: '已找到 ' + searchResults.length + ' 条相关记录，请使用搜索功能查看',
    }, { status: 500 });
  }
}
