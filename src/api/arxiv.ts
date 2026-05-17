import { Paper } from '../types';

const ARXIV_BASE = 'https://export.arxiv.org/api/query';

export interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  link: string;
  primaryCategory: string;
  categories: string[];
  doi?: string;
  comment?: string;
  pdfLink?: string;
}

function parseArxivXml(xmlText: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];

  // Simple XML parser using regex for arXiv's Atom format
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryXml = match[1];

    const extract = (tag: string, ns?: string): string => {
      const fullTag = ns ? `${ns}:${tag}` : tag;
      const m = entryXml.match(new RegExp(`<${fullTag}[^>]*>([\\s\\S]*?)<\\/${fullTag}>`));
      return m ? m[1].trim() : '';
    };

    const extractAll = (tag: string): string[] => {
      const results: string[] = [];
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
      let m;
      while ((m = regex.exec(entryXml)) !== null) {
        results.push(m[1].trim());
      }
      return results;
    };

    const id = extract('id').replace('http://arxiv.org/abs/', '').replace('https://arxiv.org/abs/', '');
    const title = extract('title').replace(/\s+/g, ' ').trim();
    const summary = extract('summary').replace(/\s+/g, ' ').trim();
    const published = extract('published');
    const link = extract('link');
    const doi = extract('doi', 'arxiv');
    const comment = extract('comment', 'arxiv');
    const primaryCategory = extract('primary_category', 'arxiv') || extract('term', 'arxiv');
    const pdfLink = `https://arxiv.org/pdf/${id}.pdf`;

    const authorNames = extractAll('name');

    // Extract categories
    const catRegex = /<category[^>]*term="([^"]+)"/g;
    const categories: string[] = [];
    let catMatch;
    while ((catMatch = catRegex.exec(entryXml)) !== null) {
      categories.push(catMatch[1]);
    }

    entries.push({
      id,
      title,
      summary,
      authors: authorNames,
      published,
      updated: extract('updated'),
      link,
      primaryCategory,
      categories,
      doi: doi || undefined,
      comment: comment || undefined,
      pdfLink,
    });
  }

  return entries;
}

function arxivEntryToPaper(entry: ArxivEntry): Paper {
  const year = new Date(entry.published).getFullYear();

  // Map arXiv category to display category
  const cat = entry.primaryCategory || 'cs.other';

  return {
    id: `arxiv-${entry.id}`,
    title: entry.title,
    authors: entry.authors,
    abstract: entry.summary,
    journal: `arXiv ${cat}`,
    year,
    citationCount: undefined, // Will be filled by Semantic Scholar
    url: `https://arxiv.org/abs/${entry.id}`,
    doi: entry.doi,
    category: cat,
    keywords: entry.categories,
    source: 'arxiv',
  };
}

export async function fetchPapersByCategory(
  category: string,
  start = 0,
  maxResults = 25
): Promise<Paper[]> {
  const catQuery = category === 'all'
    ? 'cat:cs.*'
    : `cat:${category}`;

  const url = `${ARXIV_BASE}?search_query=${encodeURIComponent(catQuery)}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  try {
    const response = await fetch(url);
    const xmlText = await response.text();
    const entries = parseArxivXml(xmlText);
    return entries.map(arxivEntryToPaper);
  } catch (error) {
    console.error('arXiv fetch error:', error);
    throw error;
  }
}

export async function searchPapers(
  query: string,
  start = 0,
  maxResults = 25
): Promise<Paper[]> {
  const url = `${ARXIV_BASE}?search_query=${encodeURIComponent(`all:${query}`)}&start=${start}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

  try {
    const response = await fetch(url);
    const xmlText = await response.text();
    const entries = parseArxivXml(xmlText);
    return entries.map(arxivEntryToPaper);
  } catch (error) {
    console.error('arXiv search error:', error);
    throw error;
  }
}

export async function fetchRecentPapers(
  start = 0,
  maxResults = 30
): Promise<Paper[]> {
  // Fetch from multiple CS categories to get a diverse feed
  const categories = ['cs.CL', 'cs.CV', 'cs.LG', 'cs.AI', 'cs.IR', 'cs.NE'];
  const perCat = Math.ceil(maxResults / categories.length);

  try {
    const results = await Promise.allSettled(
      categories.map((cat) => fetchPapersByCategory(cat, 0, perCat))
    );

    const allPapers: Paper[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPapers.push(...result.value);
      }
    }

    // Sort by date, newest first
    allPapers.sort((a, b) => b.year - a.year);

    // Deduplicate by arxiv ID
    const seen = new Set<string>();
    return allPapers.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  } catch (error) {
    console.error('arXiv recent fetch error:', error);
    throw error;
  }
}