import * as pdfjs from 'pdfjs-dist';
import * as mammoth from 'mammoth';

// Set PDF.js worker via CDN (avoids bundling the worker file)
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export interface ParseResult {
  success: boolean;
  text: string;
  title?: string;
  error?: string;
  pageCount?: number;
}

/** Parse a File object (PDF or DOCX) and extract text content */
export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') return parsePDF(file);
  if (ext === 'docx') return parseDOCX(file);
  return { success: false, text: '', error: `不支持的文件格式: .${ext}，仅支持 PDF 和 DOCX` };
}

async function parsePDF(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    let fullText = '';
    let firstPageText = '';

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      if (i === 1) firstPageText = pageText;
      fullText += pageText + '\n\n';
    }

    // Try to extract title from the first page (usually the first few lines)
    const lines = firstPageText.split('\n').filter((l) => l.trim().length > 10);
    const title = lines.length > 0 ? lines[0].trim() : file.name.replace(/\.pdf$/i, '');

    return {
      success: true,
      text: fullText.trim(),
      title: title,
      pageCount,
    };
  } catch (err: any) {
    return { success: false, text: '', error: `PDF 解析失败: ${err.message || '未知错误'}` };
  }
}

async function parseDOCX(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value.trim();

    if (!text) {
      return { success: false, text: '', error: 'DOCX 文件内容为空，或解析失败' };
    }

    // Try to extract title from the first line
    const lines = text.split('\n').filter((l) => l.trim().length > 10);
    const title = lines.length > 0 ? lines[0].trim() : file.name.replace(/\.docx$/i, '');

    return {
      success: true,
      text,
      title,
    };
  } catch (err: any) {
    return { success: false, text: '', error: `DOCX 解析失败: ${err.message || '未知错误'}` };
  }
}

/** Generate a simple AI summary from the text (client-side, rule-based) */
export function generateSummary(text: string): string {
  if (!text || text.length < 100) return '文本过短，无法生成摘要。';

  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  const firstPara = sentences.slice(0, 5).join(' ');

  // Simple extractive summary: take first few meaningful sentences
  const meaningful = sentences.filter((s) => s.length > 30 && s.length < 300);
  const summary = meaningful.slice(0, 3).join(' ');

  return summary || firstPara.slice(0, 500);
}

/** Extract key points from text (rule-based) */
export function extractKeyPoints(text: string): string[] {
  if (!text) return [];

  const points: string[] = [];
  const clean = text.replace(/\s+/g, ' ').trim();

  // Look for sentences with indicative keywords
  const keywords = [
    'find', 'show', 'demonstrate', 'suggest', 'conclude', 'argue',
    '发现', '表明', '显示', '证明', '提出', '认为', '结论',
    'key', 'important', 'significant', '主要', '重要', '关键',
  ];

  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length < 30 || trimmed.length > 300) continue;

    const lower = trimmed.toLowerCase();
    const hasKeyword = keywords.some((kw) => lower.includes(kw));
    const isNew = !points.some((p) => {
      const words = trimmed.split(/\s+/).slice(0, 5).join(' ');
      return p.includes(words);
    });

    if (hasKeyword && isNew) {
      points.push(trimmed);
      if (points.length >= 10) break;
    }
  }

  // Fallback: use first few sentences if no keyword matches
  if (points.length === 0) {
    return sentences.slice(0, 5).map((s) => s.trim()).filter((s) => s.length > 30);
  }

  return points;
}

/** Estimate reading time in minutes */
export function estimateReadingTime(text: string): number {
  const wordCount = text.split(/\s+/).length;
  // Chinese reading speed ~300 chars/min, English ~200 words/min
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = wordCount - chineseChars;

  const chineseTime = chineseChars / 300;
  const englishTime = englishWords / 200;

  return Math.max(1, Math.ceil(chineseTime + englishTime));
}

/** Detect language of text */
export function detectLanguage(text: string): string {
  const zhCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const ruCount = (text.match(/[\u0400-\u04ff]/g) || []).length;
  const jaCount = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;

  if (zhCount / Math.max(text.length, 1) > 0.1) return 'zh';
  if (ruCount / Math.max(text.length, 1) > 0.05) return 'ru';
  if (jaCount / Math.max(text.length, 1) > 0.05) return 'ja';

  // Count English vs non-English characters
  const enChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars > 0 && enChars / totalChars > 0.5) return 'en';

  return 'other';
}

export function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
    en: '英文', zh: '中文', ru: '俄文', ja: '日文', fr: '法文', de: '德文', es: '西班牙文', other: '其他',
  };
  return labels[lang] || lang;
}