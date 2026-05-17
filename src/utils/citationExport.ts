import { Paper } from '../types';

export type CitationFormat = 'bibtex' | 'apa' | 'mla' | 'chicago';

function sanitizeAuthor(name: string): string {
  return name.replace(/[{}~^\\]/g, '').trim();
}

function formatAuthorsBibTeX(authors: string[]): string {
  return authors
    .map((name) => {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      const last = parts.pop()!;
      const first = parts.join(' ');
      return `${last}, ${first}`;
    })
    .join(' and ');
}

function formatAuthorsAPA(authors: string[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return sanitizeAuthor(authors[0]);
  if (authors.length === 2) {
    return `${sanitizeAuthor(authors[0])}, & ${sanitizeAuthor(authors[1])}`;
  }
  if (authors.length <= 7) {
    const listed = authors.slice(0, -1).map((a) => sanitizeAuthor(a)).join(', ');
    return `${listed}, & ${sanitizeAuthor(authors[authors.length - 1])}`;
  }
  const first3 = authors.slice(0, 3).map((a) => sanitizeAuthor(a)).join(', ');
  return `${first3}, ... ${sanitizeAuthor(authors[authors.length - 1])}`;
}

function formatAuthorsMLA(authors: string[]): string {
  if (authors.length === 0) return '';
  if (authors.length === 1) return sanitizeAuthor(authors[0]);

  const first = sanitizeAuthor(authors[0]);
  const parts = first.split(/\s+/);
  let formatted = '';
  if (parts.length > 1) {
    const last = parts.pop()!;
    formatted = `${last}, ${parts.join(' ')}`;
  } else {
    formatted = first;
  }

  if (authors.length === 2) {
    return `${formatted}, and ${sanitizeAuthor(authors[1])}`;
  }
  return `${formatted}, et al.`;
}

function generateBibTeXKey(paper: Paper): string {
  const firstAuthor = paper.authors[0]?.split(/\s+/).pop()?.toLowerCase() || 'unknown';
  const year = paper.year || 0;
  const titleWords = paper.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w))
    .slice(0, 3)
    .join('');
  return `${firstAuthor}${year}${titleWords}`;
}

export function generateBibTeX(paper: Paper): string {
  const key = generateBibTeXKey(paper);
  const author = formatAuthorsBibTeX(paper.authors);
  const title = paper.title.replace(/[{}]/g, '').replace(/[&]/g, '{\\&}');
  const journal = paper.journal ? paper.journal.replace(/[{}]/g, '') : '';
  const doi = paper.doi || '';
  const url = paper.url || '';

  return `@article{${key},
  author  = {${author}},
  title   = {${title}},
  journal = {${journal}},
  year    = {${paper.year || 'n.d.'}},
  doi     = {${doi}},
  url     = {${url}},
}`;
}

export function generateAPA(paper: Paper): string {
  const author = formatAuthorsAPA(paper.authors);
  const year = paper.year || 'n.d.';
  const title = paper.title;
  const journal = paper.journal ? ` ${paper.journal}.` : '';
  const doi = paper.doi ? ` https://doi.org/${paper.doi}` : '';
  const url = !paper.doi && paper.url ? ` ${paper.url}` : '';

  return `${author} (${year}). ${title}.${journal}${doi}${url}`;
}

export function generateMLA(paper: Paper): string {
  const author = formatAuthorsMLA(paper.authors);
  const title = `"${paper.title}."`;
  const journal = paper.journal ? ` ${paper.journal},` : '';
  const year = paper.year || 'n.d.';
  const doi = paper.doi ? ` doi:${paper.doi}.` : '';
  const url = !paper.doi && paper.url ? ` ${paper.url}.` : '';

  return `${author} ${title}${journal} ${year},${doi}${url}`;
}

export function generateChicago(paper: Paper): string {
  const author = formatAuthorsAPA(paper.authors);
  const year = paper.year || 'n.d.';
  const title = `"${paper.title}."`;
  const journal = paper.journal ? ` ${paper.journal}` : '';
  const doi = paper.doi ? ` https://doi.org/${paper.doi}` : '';
  const url = !paper.doi && paper.url ? ` ${paper.url}` : '';

  return `${author} ${year}. ${title}${journal}.${doi}${url}`;
}

export function generateCitation(paper: Paper, format: CitationFormat): string {
  switch (format) {
    case 'bibtex':
      return generateBibTeX(paper);
    case 'apa':
      return generateAPA(paper);
    case 'mla':
      return generateMLA(paper);
    case 'chicago':
      return generateChicago(paper);
  }
}

export function downloadBibTeX(paper: Paper) {
  const bib = generateBibTeX(paper);
  const key = generateBibTeXKey(paper);
  const blob = new Blob([bib], { type: 'application/x-bibtex;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${key}.bib`;
  a.click();
  URL.revokeObjectURL(url);
}

export const CITATION_FORMATS: { id: CitationFormat; label: string; desc: string }[] = [
  { id: 'bibtex', label: 'BibTeX', desc: '.bib 文件格式' },
  { id: 'apa', label: 'APA 7th', desc: '美国心理学会格式' },
  { id: 'mla', label: 'MLA 9th', desc: '现代语言协会格式' },
  { id: 'chicago', label: 'Chicago', desc: '芝加哥格式手册' },
];