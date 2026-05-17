/**
 * Translation service for Epis.
 * 
 * Backend priority (auto-degrade):
 * 0. Native GGUF model (Capacitor plugin, offline, supports 33 languages auto-detect)
 * 1. Local translation server (http://<ip>:3456/translate)
 * 2. MyMemory API (with retry)
 * 3. DeepSeek-R1 (via SiliconFlow, for languages outside Hy-MT's 33)
 * 4. Fallback: return original text
 */

const MYMEMORY_BASE = 'https://api.mymemory.translated.net/get';
const STORAGE_KEY = 'epis-translate-server-url';
const SILICONFLOW_API_KEY = 'sk-nyyhtppuxrywqafedhbnevclactppzovbnxugakgsoajnkpkuhvbpvxnulppqjulbpwjgtw';
const SILICONFLOW_BASE = 'https://api.siliconflow.cn/v1';
const TRANSLATION_MODEL = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';

// ── Language detection ──────────────────────────────────────────────

// Support detection for 33+ languages (ISO 639-1 codes)
const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  zh: /[\u4e00-\u9fff\u3400-\u4dbf]/,
  ru: /[\u0400-\u04ff]/,
  ar: /[\u0600-\u06ff]/,
  ja: /[\u3040-\u309f\u30a0-\u30ff]/,
  ko: /[\uac00-\ud7af\u1100-\u11ff]/,
  th: /[\u0e00-\u0e7f]/,
  vi: /[\u00c0-\u024f]/,
  el: /[\u0370-\u03ff]/,
  he: /[\u0590-\u05ff]/,
  hi: /[\u0900-\u097f]/,
  // For Latin-script languages, use function-based detection
};

// Common stopwords per language for Latin-script language detection
const LATIN_LANG_SIGNALS: Record<string, string[]> = {
  en: ['the', 'and', 'this', 'that', 'with', 'from', 'which', 'from', 'their', 'about', 'would', 'could', 'should', 'also', 'been', 'were', 'there', 'these', 'have', 'been', 'study', 'results', 'analysis', 'research', 'paper', 'based', 'political', 'international', 'social'],
  fr: ['les', 'des', 'dans', 'une', 'pour', 'sur', 'avec', 'est', 'sont', 'leur', 'cette', 'plus', 'fait', 'comme', 'entre', 'aussi', 'peut', 'deux', 'autre', 'recherche', 'politique', 'analyse', 'international', 'étude'],
  de: ['der', 'die', 'das', 'und', 'mit', 'den', 'auf', 'für', 'ist', 'sind', 'nicht', 'sich', 'eine', 'einen', 'einer', 'auch', 'werden', 'wurde', 'dieser', 'diese', 'dieses', 'wird', 'zwischen', 'politik', 'forschung', 'analyse', 'internationale'],
  es: ['los', 'las', 'con', 'para', 'una', 'por', 'del', 'como', 'más', 'entre', 'según', 'este', 'esta', 'estos', 'estas', 'sobre', 'también', 'investigación', 'política', 'internacional', 'análisis'],
  pt: ['os', 'as', 'uma', 'para', 'com', 'por', 'como', 'mais', 'entre', 'este', 'esta', 'estes', 'estas', 'sobre', 'também', 'pesquisa', 'política', 'análise', 'internacional'],
  it: ['gli', 'della', 'delle', 'degli', 'una', 'con', 'per', 'come', 'più', 'tra', 'fra', 'questo', 'questa', 'anche', 'sulla', 'ricerca', 'politica', 'analisi', 'internazionale'],
  nl: ['het', 'een', 'voor', 'met', 'door', 'wordt', 'zijn', 'ook', 'deze', 'naar', 'tussen', 'deel', 'onderzoek', 'politiek', 'analyse', 'internationale'],
  pl: ['się', 'jest', 'nie', 'tym', 'przez', 'tych', 'badania', 'polityka', 'analiza', 'międzynarodowe'],
  tr: ['bir', 'olan', 'daha', 'gibi', 'kadar', 'araştırma', 'politika', 'analiz', 'uluslararası'],
};

// Script-based language detection score
const SCRIPT_SIGNALS: Record<string, RegExp> = {
  // Cyrillic: check if it's not Russian (which we already detect) — Ukrainian, Bulgarian, Serbian
  uk: /[\u0400-\u04ff]/,
  // Greek
  el: /[\u0370-\u03ff]/,
  // Arabic
  ar: /[\u0600-\u06ff]/,
  // CJK (Japanese / Chinese / Korean handled above)
};

function detectLatinLanguage(text: string): string {
  const lower = text.toLowerCase();
  // Remove punctuation, split into words (keep short words for stopword matching)
  const words = lower.split(/[^a-zà-ÿ]+/).filter(w => w.length > 1);
  if (words.length < 3) return 'en'; // Not enough data, default to English

  const scores: Record<string, number> = {};
  for (const [lang, signals] of Object.entries(LATIN_LANG_SIGNALS)) {
    scores[lang] = 0;
    for (const word of words) {
      if (signals.includes(word)) scores[lang] += 1;
    }
    // Normalize by word count
    scores[lang] = scores[lang] / words.length;
  }

  // If English has the highest score and a reasonable threshold, return it
  // If another language has a significantly higher score, return that
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1] || ['', 0];

  // If top is clearly English with good score, or top score is very low, default to English
  if (top[0] === 'en' && top[1] > 0.02) return 'en';
  if (top[1] > 0.05 && top[1] > second[1] * 2) return top[0];

  return 'en';
}

export function detectLanguage(text: string): string {
  if (!text || text.length < 10) return 'en';
  
  // 1. Check by script (CJK, Cyrillic, Arabic, etc.)
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(text)) {
      const count = (text.match(pattern) || []).length;
      const ratio = count / text.length;
      if (ratio > 0.05) return lang; // >= 5% chars in this script
    }
  }

  // 2. For Latin-script, use stopword-based detection
  return detectLatinLanguage(text);
}

// ── Translation backends ────────────────────────────────────────────

/** Map detected language code to MyMemory langpair format */
function toMyMemoryLang(lang: string): string {
  if (lang === 'zh') return 'zh-CN';
  return lang;
}

/** Try native GGUF model via Capacitor plugin */
async function tryNative(text: string, targetLang: string): Promise<string | null> {
  try {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.() || !cap.Plugins?.Translation) return null;
    const plugin = cap.Plugins.Translation;
    const status = await plugin.getStatus();
    if (!status.modelReady) return null;
    // Hy-MT auto-detects the source language — we just tell it where to go
    const ret = await plugin.translate({ text, targetLang });
    return ret.result || null;
  } catch {
    // If native plugin fails (e.g. for languages it doesn't support), 
    // the error propagates and we try the next backend
    return null;
  }
}

/** Try local translation server */
async function tryLocalServer(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  const serverUrl = getLocalServerUrl();
  if (!serverUrl) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: sourceLang, target: targetLang }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return data.translatedText || null;
  } catch {
    return null;
  }
}

/** Try MyMemory API with retry */
async function tryMyMemory(text: string, sourceLang: string, targetLang: string, retries = 2): Promise<string | null> {
  const src = toMyMemoryLang(sourceLang);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const url = `${MYMEMORY_BASE}?q=${encodeURIComponent(text)}&langpair=${src}|${targetLang}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText;
      }
      throw new Error(data.responseDetails || 'Unknown error');
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      return null;
    }
  }
  return null;
}

/** Try DeepSeek-R1 via SiliconFlow as final fallback (for any language) */
async function tryDeepSeek(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  const langNames: Record<string, string> = {
    en: 'English', zh: 'Chinese', ru: 'Russian', fr: 'French', de: 'German',
    es: 'Spanish', pt: 'Portuguese', it: 'Italian', nl: 'Dutch', pl: 'Polish',
    tr: 'Turkish', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', vi: 'Vietnamese',
    th: 'Thai', el: 'Greek', he: 'Hebrew', hi: 'Hindi', uk: 'Ukrainian',
    cs: 'Czech', ro: 'Romanian', sv: 'Swedish', da: 'Danish', fi: 'Finnish',
  };
  const targetName = langNames[targetLang] || targetLang;
  const sourceName = langNames[sourceLang] || sourceLang;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(`${SILICONFLOW_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: TRANSLATION_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${sourceName} to ${targetName}. 
Only output the translation, nothing else. Do NOT add explanations, notes, or quotes.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return content || null;
  } catch {
    return null;
  }
}

// ── Local server URL management ───────────────────────────────────

function getLocalServerUrl(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); }
  catch { return null; }
}

export function setLocalTranslationServer(url: string | null) {
  try {
    if (url) localStorage.setItem(STORAGE_KEY, url);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function getLocalTranslationServerUrl(): string | null {
  return getLocalServerUrl();
}

// ── Main translation orchestrator ─────────────────────────────────

async function translateChunk(
  text: string,
  sourceLang: string,
  targetLang: string,
  targetLangHuman: string
): Promise<string> {
  const errors: string[] = [];

  // 1. Native GGUF (Hy-MT) — auto-detects source language, just needs target
  const nativeResult = await tryNative(text, targetLangHuman);
  if (nativeResult) {
    console.log(`[翻译] 使用Hy-MT完成 (${sourceLang}→${targetLangHuman})`);
    return nativeResult;
  }

  // 2. Local server
  const localResult = await tryLocalServer(text, sourceLang, 'zh-CN');
  if (localResult) {
    console.log(`[翻译] 使用本地服务器完成 (${sourceLang}→zh-CN)`);
    return localResult;
  }

  // 3. MyMemory
  const myMemoryResult = await tryMyMemory(text, sourceLang, 'zh-CN');
  if (myMemoryResult) {
    console.log(`[翻译] 使用MyMemory完成 (${sourceLang}→zh-CN)`);
    return myMemoryResult;
  }

  // 4. DeepSeek-R1 — last resort for any language
  const deepseekResult = await tryDeepSeek(text, sourceLang, 'zh');
  if (deepseekResult) {
    console.log(`[翻译] 使用DeepSeek-R1完成 (${sourceLang}→zh)`);
    return deepseekResult;
  }

  throw new Error(`翻译失败: 所有后端均失败 (${sourceLang}→zh-CN)`);
}

export interface TranslatedContent {
  title: string;
  abstract: string;
  originalLanguage: string;
  isTranslated: boolean;
  translationFailed?: boolean;
}

export async function translatePaperContent(
  title: string,
  abstract: string
): Promise<TranslatedContent> {
  const fullText = title + ' ' + abstract;
  const lang = detectLanguage(fullText);

  // If already Chinese, no translation needed
  if (lang === 'zh') {
    return { title, abstract, originalLanguage: 'zh', isTranslated: false };
  }

  const sourceLang = lang;
  const targetLang = 'zh-CN';
  const targetLangHuman = 'Chinese';

  try {
    // Translate title (short, single chunk)
    const translatedTitle = await translateChunk(title.slice(0, 500), sourceLang, targetLang, targetLangHuman);

    // Translate abstract (may need chunking for long texts)
    let translatedAbstract = '';
    const maxChunkSize = 400;

    if (abstract.length <= maxChunkSize) {
      translatedAbstract = await translateChunk(abstract, sourceLang, targetLang, targetLangHuman);
    } else {
      // Split by sentences for more coherent translation
      const chunks: string[] = [];
      const sentences = abstract.split(/(?<=[.!?])\s+/);
      let currentChunk = '';
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
      if (currentChunk) chunks.push(currentChunk);

      const translatedChunks: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 200));
        const translated = await translateChunk(chunks[i], sourceLang, targetLang, targetLangHuman);
        translatedChunks.push(translated);
      }
      translatedAbstract = translatedChunks.join(' ');
    }

    return {
      title: translatedTitle || title,
      abstract: translatedAbstract || abstract,
      originalLanguage: lang,
      isTranslated: true,
    };
  } catch {
    return {
      title,
      abstract,
      originalLanguage: lang,
      isTranslated: false,
      translationFailed: true,
    };
  }
}

export async function translateKeywords(
  keywords: string[],
  sourceLang: string
): Promise<string[]> {
  if (!keywords || keywords.length === 0 || sourceLang === 'zh') return keywords;
  const translated: string[] = [];
  for (let i = 0; i < keywords.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 100));
    try {
      const result = await translateChunk(keywords[i], sourceLang, 'zh-CN', 'Chinese');
      translated.push(result || keywords[i]);
    } catch {
      translated.push(keywords[i]);
    }
  }
  return translated;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: '英文', zh: '中文', ru: '俄文', fr: '法文', de: '德文',
  es: '西班牙文', pt: '葡萄牙文', it: '意大利文', nl: '荷兰文',
  pl: '波兰文', tr: '土耳其文', ja: '日文', ko: '韩文', ar: '阿拉伯文',
  vi: '越南文', th: '泰文', el: '希腊文', he: '希伯来文', hi: '印地文',
  uk: '乌克兰文', cs: '捷克文', ro: '罗马尼亚文', sv: '瑞典文',
  da: '丹麦文', fi: '芬兰文', id: '印尼文', ms: '马来文',
};

export function getLanguageLabel(lang: string): string {
  return LANGUAGE_LABELS[lang] || lang;
}

export async function testLocalTranslationServer(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ text: 'Hello', source: 'en', target: 'zh-CN' }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.translatedText;
  } catch {
    return false;
  }
}