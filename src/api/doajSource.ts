/**
 * DOAJ (Directory of Open Access Journals) API Client
 * API: https://doaj.org/api/v4/search/articles/query?page=N&pageSize=N
 * Public, free, no API key required for search
 */
import { Paper } from '../types';

const DOAJ_BASE = 'https://doaj.org/api/v4/search/articles';

interface DoajIdentifier {
  id: string;
  type: string;
}

interface DoajAuthor {
  name: string;
}

interface DoajSubject {
  code: string;
  scheme: string;
  term: string;
}

interface DoajLink {
  type: string;
  url: string;
}

interface DoajBibjson {
  identifier: DoajIdentifier[];
  title: string;
  author: DoajAuthor[];
  abstract?: string;
  year?: string;
  month?: string;
  start_page?: string;
  end_page?: string;
  keywords?: string[];
  subject?: DoajSubject[];
  link?: DoajLink[];
  journal?: {
    title?: string;
    volume?: string;
    number?: string;
    publisher?: string;
    country?: string;
    language?: string[];
    issns?: string[];
  };
}

interface DoajArticle {
  id: string;
  bibjson: DoajBibjson;
  created_date: string;
  last_updated: string;
}

interface DoajResponse {
  total: number;
  page: number;
  pageSize: number;
  query: string;
  results: DoajArticle[];
  next?: string;
  last?: string;
}

function getDoi(article: DoajArticle): string | undefined {
  const doiEntry = article.bibjson.identifier?.find(i => i.type === 'doi');
  return doiEntry?.id;
}

function getUrl(article: DoajArticle): string {
  const fullTextLink = article.bibjson.link?.find(l => l.type === 'fulltext');
  if (fullTextLink?.url) return fullTextLink.url;

  // Fallback to DOI
  const doi = getDoi(article);
  if (doi) return `https://doi.org/${doi}`;

  // Fallback to DOAJ page
  return `https://doaj.org/article/${article.id}`;
}

function getCategory(article: DoajArticle): string {
  const subjects = article.bibjson.subject || [];
  for (const s of subjects) {
    const term = s.term.toLowerCase();
    if (term.includes('international relations')) return 'international-relations';
    if (term.includes('political science') || term.includes('political')) return 'political-science';
    if (term.includes('security') || term.includes('defense')) return 'security-studies';
    if (term.includes('european') || term.includes('europe')) return 'european-studies';
  }
  // Use LCC code prefix
  for (const s of subjects) {
    const code = s.code || '';
    if (code.startsWith('JZ')) return 'international-relations';
    if (code.startsWith('JA') || code.startsWith('JC')) return 'political-science';
    if (code.startsWith('JN')) return 'european-studies';
    if (code.startsWith('JX')) return 'international-relations';
    if (code.startsWith('D')) return 'history-regional-studies';
  }
  return 'political-science';
}

function getLanguage(article: DoajArticle): string | undefined {
  const langs = article.bibjson.journal?.language;
  if (langs && langs.length > 0) {
    const lang = langs[0].toLowerCase();
    if (lang === 'en') return 'en';
    if (lang === 'zh' || lang === 'chi' || lang === 'zho') return 'zh';
    if (lang === 'ru' || lang === 'rus') return 'ru';
    return lang;
  }
  return undefined;
}

function doajToPaper(article: DoajArticle): Paper {
  const doi = getDoi(article);
  const url = getUrl(article);
  const year = article.bibjson.year ? parseInt(article.bibjson.year) : 0;
  const category = getCategory(article);
  const language = getLanguage(article);

  return {
    id: `doaj-${article.id}`,
    title: article.bibjson.title || 'Untitled',
    authors: article.bibjson.author?.map(a => a.name) || [],
    abstract: article.bibjson.abstract || 'No abstract available.',
    journal: article.bibjson.journal?.title || undefined,
    year,
    citationCount: undefined, // DOAJ doesn't provide citation counts
    url,
    doi: doi || undefined,
    category,
    keywords: article.bibjson.keywords || article.bibjson.subject?.map(s => s.term) || [],
    source: 'doaj',
    language,
  };
}

// Political/IR relevant search queries for DOAJ
const DOAJ_FEED_QUERIES = [
  'international relations',
  'political science',
  'security studies',
  'european politics',
  'democratization',
  'foreign policy',
  'conflict resolution',
  'peace studies',
  'governance',
  'comparative politics',
];

export async function searchDoaj(
  query: string,
  page = 1,
  pageSize = 25
): Promise<Paper[]> {
  const url = `${DOAJ_BASE}/${encodeURIComponent(query)}?page=${page}&pageSize=${pageSize}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`DOAJ HTTP ${response.status}`);
    const data: DoajResponse = await response.json();
    return (data.results || []).map(doajToPaper);
  } catch (error) {
    console.error('DOAJ search error:', error);
    throw error;
  }
}

export async function fetchDoajFeed(maxResults = 50, page = 1): Promise<Paper[]> {
  const queryCount = Math.min(DOAJ_FEED_QUERIES.length, 5);

  try {
    const allPapers: Paper[] = [];
    const seen = new Set<string>();

    // Randomize which queries we use for variety
    const shuffled = [...DOAJ_FEED_QUERIES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < queryCount; i++) {
      const query = shuffled[i];
      const perQuery = Math.ceil(maxResults / queryCount);

      try {
        const url = `${DOAJ_BASE}/${encodeURIComponent(query)}?page=${page}&pageSize=${perQuery}`;
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) continue;

        const data: DoajResponse = await response.json();
        for (const article of data.results || []) {
          if (!seen.has(article.id)) {
            seen.add(article.id);
            allPapers.push(doajToPaper(article));
          }
        }
      } catch (e) {
        console.warn(`DOAJ query "${query}" failed:`, e);
        continue;
      }
    }

    // Shuffle
    for (let i = allPapers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPapers[i], allPapers[j]] = [allPapers[j], allPapers[i]];
    }

    return allPapers.slice(0, maxResults);
  } catch (error) {
    console.error('DOAJ feed error:', error);
    throw error;
  }
}