/**
 * AI 论文点评服务
 * 通过 SiliconFlow API 调用 DeepSeek-R1 模型生成论文点评
 * 模型: deepseek-ai/DeepSeek-R1-0528-Qwen3-8B
 * 兼容 OpenAI API 格式
 */

import { Paper, PaperCommentary } from '../types';

const API_BASE = 'https://api.siliconflow.cn/v1';
const MODEL = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';
const API_KEY = 'sk-nyyhtppuxrywqafedhbnevclactppzovbnxugakchbowhpcf';

// Cache commentary by paper ID
const commentaryCache = new Map<string, PaperCommentary>();

// Track in-flight requests to avoid duplicate calls
const pendingRequests = new Map<string, Promise<PaperCommentary>>();

function buildSystemPrompt(): string {
  return `你是一位精通国际关系、政治学和区域研究的学术评论家。你的任务是为一篇学术论文撰写专业、有深度的中文点评。

请严格按照以下JSON格式回复，不要包含其他内容：
{
  "summary": "用2-3句话概括论文的核心内容和主要发现",
  "innovation": "分析论文的创新点和学术贡献（2-3句话）",
  "significance": "评价论文在相关领域的研究意义和学术价值（2-3句话）",
  "audience": "说明适合哪些研究者和读者阅读（1-2句话）"
}

要求：点评要具体、有深度，避免泛泛而谈。如果论文涉及具体地区（如东欧、俄罗斯、乌克兰等），应在点评中体现区域背景。`;
}

function buildUserPrompt(paper: Paper): string {
  const title = paper.translatedTitle || paper.title;
  const abstract = paper.translatedAbstract || paper.abstract;
  const keywords = paper.isTranslated && paper.translatedKeywords
    ? paper.translatedKeywords.join(', ')
    : (paper.keywords || []).join(', ');

  return `请为以下学术论文撰写点评：

标题：${title}
作者：${paper.authors.join(', ')}
发表年份：${paper.year}
期刊：${paper.journal || '未注明'}
引用次数：${paper.citationCount || 0}
分类：${paper.category}
关键词：${keywords || '无'}

摘要：
${abstract}`;
}

export async function fetchAICommentary(paper: Paper): Promise<PaperCommentary> {
  // Return cached if available
  if (commentaryCache.has(paper.id)) {
    return commentaryCache.get(paper.id)!;
  }

  // Return in-flight request to avoid duplicates
  if (pendingRequests.has(paper.id)) {
    return pendingRequests.get(paper.id)!;
  }

  const promise = callDeepSeekAPI(paper);
  pendingRequests.set(paper.id, promise);

  try {
    const result = await promise;
    commentaryCache.set(paper.id, result);
    return result;
  } finally {
    pendingRequests.delete(paper.id);
  }
}

async function callDeepSeekAPI(paper: Paper): Promise<PaperCommentary> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(paper) },
        ],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('API返回为空');
    }

    // Parse JSON response
    const parsed: PaperCommentary = JSON.parse(content);

    // Validate required fields
    if (!parsed.summary || !parsed.innovation || !parsed.significance || !parsed.audience) {
      throw new Error('API返回格式不完整');
    }

    return parsed;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearCommentaryCache() {
  commentaryCache.clear();
  pendingRequests.clear();
}

// Generate fallback commentary when API is unavailable
export function generateFallbackCommentary(paper: Paper): PaperCommentary {
  const currentYear = new Date().getFullYear();
  const yearsSince = currentYear - paper.year;

  let recencyLabel = '近年研究';
  if (yearsSince <= 2) recencyLabel = '最新研究';
  else if (yearsSince <= 5) recencyLabel = '近期热点';
  else if (yearsSince <= 10) recencyLabel = '近年重要研究';
  else recencyLabel = '经典文献';

  const titleShort = (paper.translatedTitle || paper.title).slice(0, 60);
  const abstractFirstSentence = (paper.translatedAbstract || paper.abstract || '').split(/[.!?。！？]/)[0] || '';

  return {
    summary: `本文为${recencyLabel}，主题为「${titleShort}」。${abstractFirstSentence ? `摘要指出：${abstractFirstSentence}。` : ''}${paper.citationCount && paper.citationCount > 20 ? `该论文被引${paper.citationCount}次，对该领域有重要学术影响。` : ''}`,
    innovation: `该论文在${paper.category || '相关'}领域${paper.citationCount && paper.citationCount > 50 ? '具有较高的学术影响力' : '做出了有价值的学术贡献'}。`,
    significance: `对${paper.category === 'political-science' ? '政治学' : paper.category === 'international-relations' ? '国际关系' : '相关领域'}研究者和政策分析者具有参考价值。`,
    audience: `适合${paper.category === 'political-science' ? '政治学' : paper.category === 'international-relations' ? '国际关系' : '相关领域'}研究者和对${paper.category || '该领域'}感兴趣的学生阅读。`,
  };
}