export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  journal?: string;
  year: number;
  citationCount?: number;
  url: string;
  doi?: string;
  category: string;
  keywords?: string[];
  source?: 'openalex' | 'arxiv' | 'doaj' | 'mock';
  language?: string;
  // Translated content
  translatedTitle?: string;
  translatedAbstract?: string;
  translatedKeywords?: string[];
  isTranslated?: boolean;
  translationFailed?: boolean;
  // AI commentary
  commentary?: PaperCommentary;
}

export interface PaperCommentary {
  summary: string;
  innovation: string;
  significance: string;
  audience: string;
}

export interface ContentItem {
  id: string;
  type: 'paper' | 'news' | 'theory' | 'excerpt';
  paper?: Paper;
  news?: NewsItem;
  theory?: TheorySnippet;
  excerpt?: PaperExcerpt;
  timestamp: number;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  summary: string;
  content: string;
  publishedAt: string;
  region: string;
  imageUrl?: string;
}

export interface TheorySnippet {
  id: string;
  name: string;
  thinkers: string[];
  coreIdea: string;
  application: string;
  relevance: number;
  category: string;
}

export interface PaperExcerpt {
  id: string;
  title: string;
  authors: string[];
  excerpt: string;
  context: string;
  insight: string;
  source: string;
}

export interface SwipeDirection {
  direction: 'up' | 'down' | 'left' | 'right';
  label: string;
  icon: string;
  color: string;
}

export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export type ContentType = 'paper' | 'news' | 'theory' | 'excerpt';

export type CitationFormat = 'bibtex' | 'apa' | 'mla' | 'chicago';

export type Theme = 'dark' | 'light';

export interface DataSource {
  id: string;
  name: string;
  type: 'free' | 'apikey' | 'login';
  status: 'connected' | 'disconnected' | 'configuring';
  description: string;
  icon: string;
  configFields?: { key: string; label: string; placeholder: string; type: 'text' | 'password' }[];
}

export interface ImportedPaper {
  id: string;
  title: string;
  authors: string[];
  source: 'pdf' | 'docx';
  fileName: string;
  fileSize: number;
  fullText: string;
  abstract?: string;
  importedAt: number;
  language?: string;
  // Translation
  isTranslated?: boolean;
  translatedTitle?: string;
  translatedFullText?: string;
  originalLanguage?: string;
  translationFailed?: boolean;
  // Deep reading
  readingProgress: number;
  keyPoints: string[];
  aiSummary?: string;
  readingTime?: number;
  bookmarks: ReadingBookmark[];
}

export interface ReadingBookmark {
  id: string;
  text: string;
  position: number;
  note?: string;
  createdAt: number;
}

export interface AppSettings {
  theme: Theme;
  version: string;
  buildDate: string;
}