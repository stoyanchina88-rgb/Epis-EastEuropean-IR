import { Paper } from '../types';
import {
  fetchRecentFeed as fetchOpenAlexFeed,
  fetchPapersByConcept,
  searchPapers as searchOpenAlex,
  CONCEPT_IDS,
} from './openAlex';
import { fetchArxivFeed, searchArxiv } from './arxivSource';
import { fetchDoajFeed, searchDoaj } from './doajSource';
import { translatePaperContent, translateKeywords } from './translation';
import { generateCommentary } from '../utils/paperCommentary';

export type FeedMode = 'recent' | 'category' | 'search';

interface FeedOptions {
  mode: FeedMode;
  category?: string;
  query?: string;
  page?: number;
  maxResults?: number;
  translate?: boolean;
}

const CACHE_DURATION = 5 * 60 * 1000;
const feedCache = new Map<string, { papers: Paper[]; timestamp: number }>();

function cacheKey(options: FeedOptions): string {
  return `merged:${options.mode}:${options.category || ''}:${options.query || ''}:${options.page || 1}`;
}

function getFromCache(key: string): Paper[] | null {
  const entry = feedCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_DURATION) {
    feedCache.delete(key);
    return null;
  }
  return entry.papers;
}

function setCache(key: string, papers: Paper[]) {
  feedCache.set(key, { papers, timestamp: Date.now() });
}

async function applyTranslations(papers: Paper[]): Promise<Paper[]> {
  const translated = await Promise.allSettled(
    papers.map(async (paper) => {
      if (paper.language === 'zh') return { ...paper, isTranslated: false, commentary: generateCommentary(paper) };

      try {
        const result = await translatePaperContent(paper.title, paper.abstract);

        let translatedKeywords: string[] | undefined;
        if (result.isTranslated && paper.keywords && paper.keywords.length > 0) {
          translatedKeywords = await translateKeywords(paper.keywords, result.originalLanguage);
        }

        const updatedPaper: Paper = {
          ...paper,
          language: result.originalLanguage,
          isTranslated: result.isTranslated,
          translationFailed: false,
          ...(result.isTranslated ? {
            translatedTitle: result.title,
            translatedAbstract: result.abstract,
            translatedKeywords,
          } : {}),
        };

        updatedPaper.commentary = generateCommentary(updatedPaper);
        return updatedPaper;
      } catch (err) {
        return {
          ...paper,
          isTranslated: false,
          translationFailed: true,
          commentary: generateCommentary(paper),
        } as Paper;
      }
    })
  );

  return translated.map((r) =>
    r.status === 'fulfilled' ? r.value : { ...papers[0], translationFailed: true, commentary: generateCommentary(papers[0]) }
  );
}

/**
 * Interleave papers from multiple sources for a diverse feed
 */
function interleaveSources(...sourceArrays: Paper[][]): Paper[] {
  const seen = new Set<string>();
  const result: Paper[] = [];

  // Remove empty arrays
  const sources = sourceArrays.filter(arr => arr.length > 0);
  if (sources.length === 0) return result;

  const maxLen = Math.max(...sources.map(s => s.length));

  for (let i = 0; i < maxLen; i++) {
    for (const arr of sources) {
      if (i < arr.length) {
        const paper = arr[i];
        if (!seen.has(paper.id)) {
          seen.add(paper.id);
          result.push(paper);
        }
      }
    }
  }

  return result;
}

/**
 * Fetch from OpenAlex, arXiv, and DOAJ, interleaving results for diversity.
 * Falls back gracefully if any source fails.
 */
async function fetchMultiSourceFeed(
  maxResults: number,
  page: number,
  searchQuery?: string,
  category?: string,
): Promise<Paper[]> {
  const perSource = Math.ceil(maxResults / 3);

  const promises = [
    // OpenAlex (primary source)
    (async () => {
      try {
        if (searchQuery) {
          return await searchOpenAlex(searchQuery, perSource, page);
        }
        if (category && category !== 'all') {
          const conceptId = CONCEPT_IDS[category] || category;
          return await fetchPapersByConcept(conceptId, perSource, undefined, page);
        }
        return await fetchOpenAlexFeed(perSource, page);
      } catch (e) {
        console.warn('OpenAlex feed error:', e);
        return [] as Paper[];
      }
    })(),

    // arXiv
    (async () => {
      try {
        if (searchQuery) {
          return await searchArxiv(searchQuery, perSource, (page - 1) * perSource);
        }
        return await fetchArxivFeed(perSource, page);
      } catch (e) {
        console.warn('arXiv feed error:', e);
        return [] as Paper[];
      }
    })(),

    // DOAJ
    (async () => {
      try {
        if (searchQuery) {
          return await searchDoaj(searchQuery, page, perSource);
        }
        return await fetchDoajFeed(perSource, page);
      } catch (e) {
        console.warn('DOAJ feed error:', e);
        return [] as Paper[];
      }
    })(),
  ];

  const results = await Promise.allSettled(promises);
  const allSourceResults: Paper[][] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      allSourceResults.push(r.value);
    } else {
      console.error('Source failed:', r.reason);
      allSourceResults.push([]);
    }
  }

  return interleaveSources(...allSourceResults).slice(0, maxResults);
}

export async function fetchFeed(options: FeedOptions): Promise<Paper[]> {
  const key = cacheKey(options);
  const cached = getFromCache(key);
  if (cached) return cached;

  let papers: Paper[];
  const page = options.page || 1;

  try {
    switch (options.mode) {
      case 'recent':
        papers = await fetchMultiSourceFeed(options.maxResults || 50, page);
        break;
      case 'category':
        papers = await fetchMultiSourceFeed(
          options.maxResults || 50,
          page,
          undefined,
          options.category
        );
        break;
      case 'search':
        papers = await fetchMultiSourceFeed(
          options.maxResults || 50,
          page,
          options.query
        );
        break;
      default:
        papers = await fetchMultiSourceFeed(options.maxResults || 50, page);
    }

    if (papers.length === 0) {
      throw new Error('No papers found from any source');
    }

    if (options.translate !== false) {
      papers = await applyTranslations(papers);
    } else {
      papers = papers.map((p) => ({
        ...p,
        commentary: generateCommentary(p),
      }));
    }

    setCache(key, papers);
    return papers;
  } catch (error) {
    console.error('Feed fetch error:', error);
    throw error;
  }
}

export function clearCache() {
  feedCache.clear();
}