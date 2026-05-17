/**
 * arXiv API Client
 * API: https://export.arxiv.org/api/query
 * Returns Atom XML, parsed with DOMParser
 */
import { Paper } from '../types';

const ARXIV_BASE = 'https://export.arxiv.org/api/query';

interface ArxivEntry {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  doi?: string;
  link: string;
  categories: string[];
  journal_ref?: string;
}

function parseArxivAtom(xml: string): ArxivEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const entries = doc.querySelectorAll('entry');
  const results: ArxivEntry[] = [];

  entries.forEach((entry) => {
    const id = entry.querySelector('id')?.textContent || '';
    const title = (entry.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim();
    const summary = (entry.querySelector('summary')?.textContent || '').replace(/\s+/g, ' ').trim();
    const published = entry.querySelector('published')?.textContent || '';
    const link = entry.querySelector('link[title="pdf"]')?.getAttribute('href')
      || entry.querySelector('link')?.getAttribute('href') || '';

    const authors: string[] = [];
    entry.querySelectorAll('author name').forEach((n) => {
      const name = n.textContent?.trim();
      if (name) authors.push(name);
    });

    const categories: string[] = [];
    entry.querySelectorAll('category').forEach((c) => {
      const term = c.getAttribute('term');
      if (term) categories.push(term);
    });

    const doiEl = entry.querySelector('arxiv\\:doi, doi');
    const doi = doiEl?.textContent || undefined;

    const journalRef = entry.querySelector('arxiv\\:journal_ref')?.textContent || undefined;

    // ArXiv ID from the URL
    const arxivId = id.replace('http://arxiv.org/abs/', '').replace('https://arxiv.org/abs/', '');

    results.push({
      id: arxivId,
      title,
      authors,
      summary,
      published,
      doi,
      link,
      categories,
      journal_ref: journalRef,
    });
  });

  return results;
}

const POLITICAL_CATEGORIES = [
  'cs.CY', 'cs.SI',       // Computers & Society / Social & Information
  'physics.soc-ph',       // Physics and Society
  'q-fin.GN',             // General Finance (political economy)
  'stat.AP',              // Statistics Applications
];

function getCategory(arxivCategories: string[]): string {
  const catMap: Record<string, string> = {
    'cs.CY': 'political-science',
    'cs.SI': 'political-science',
    'physics.soc-ph': 'political-science',
  };
  for (const c of arxivCategories) {
    if (catMap[c]) return catMap[c];
  }
  if (arxivCategories.some(c => c.startsWith('stat'))) return 'political-science';
  return 'political-science';
}

function arxivToPaper(entry: ArxivEntry): Paper {
  // Extract ArXiv ID from e-print
  const eprintId = entry.id;

  // Determine language (arXiv is mostly English)
  const language = 'en';

  // Year from published date
  const year = entry.published ? parseInt(entry.published.substring(0, 4)) : 0;

  // Category mapping
  const category = getCategory(entry.categories);

  // Build URL
  const url = `https://arxiv.org/abs/${entry.id}`;

  return {
    id: `arxiv-${entry.id}`,
    title: entry.title,
    authors: entry.authors,
    abstract: entry.summary || 'No abstract available.',
    journal: entry.journal_ref || undefined,
    year,
    citationCount: undefined, // arXiv doesn't provide citation counts
    url,
    doi: entry.doi || undefined,
    category,
    keywords: entry.categories,
    source: 'arxiv',
    language,
  };
}

export async function searchArxiv(
  query: string,
  maxResults = 25,
  start = 0
): Promise<Paper[]> {
  const url = `${ARXIV_BASE}?search_query=all:${encodeURIComponent(query)}&start=${start}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/atom+xml' },
    });
    if (!response.ok) throw new Error(`arXiv HTTP ${response.status}`);
    const xml = await response.text();
    const entries = parseArxivAtom(xml);

    // Mix with political science queries if too few results
    if (entries.length < 5) {
      const politicalQueries = [
        'international relations',
        'political science',
        'security studies',
        'democracy',
        'governance',
      ];
      const extraUrl = `${ARXIV_BASE}?search_query=all:${encodeURIComponent(politicalQueries[Math.floor(Math.random() * politicalQueries.length)])}&start=${start}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
      const extraResponse = await fetch(extraUrl, {
        headers: { 'Accept': 'application/atom+xml' },
      });
      if (extraResponse.ok) {
        const extraXml = await extraResponse.text();
        const extraEntries = parseArxivAtom(extraXml);
        entries.push(...extraEntries);
      }
    }

    return entries.map(arxivToPaper);
  } catch (error) {
    console.error('arXiv search error:', error);
    throw error;
  }
}

export async function fetchArxivFeed(maxResults = 50, page = 1): Promise<Paper[]> {
  const queries = [
    'international relations AND politics',
    'security studies AND (conflict OR peace)',
    'political economy AND democracy',
    'governance AND policy',
    'european union AND integration',
    'authoritarianism AND democracy',
  ];

  const perQuery = Math.ceil(maxResults / queries.length);
  const start = (page - 1) * perQuery;

  try {
    const results = await new Promise(r => setTimeout(r, 3000)); // arXiv rate limit: 3s between requests

    const allPapers: Paper[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < queries.length; i++) {
      if (allPapers.length >= maxResults) break;

      const url = `${ARXIV_BASE}?search_query=all:${encodeURIComponent(queries[i])}&start=${start}&max_results=${perQuery}&sortBy=submittedDate&sortOrder=descending`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/atom+xml' },
      });
      if (!response.ok) continue;

      const xml = await response.text();
      const entries = parseArxivAtom(xml);

      for (const entry of entries) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          allPapers.push(arxivToPaper(entry));
        }
      }

      // Rate limit between queries
      if (i < queries.length - 1) {
        await new Promise(r => setTimeout(r, 4000));
      }
    }

    // Shuffle
    for (let i = allPapers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPapers[i], allPapers[j]] = [allPapers[j], allPapers[i]];
    }

    return allPapers.slice(0, maxResults);
  } catch (error) {
    console.error('arXiv feed error:', error);
    throw error;
  }
}