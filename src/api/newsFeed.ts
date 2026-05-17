import { NewsItem } from '../types';

// Real RSS feeds for Eastern Europe news
const RSS_FEEDS: { url: string; region: string; source: string }[] = [
  // Using rss2json.com free converter to handle CORS
  { url: 'https://www.rferl.org/api/zpqpeeyqipqmv', region: 'general', source: 'Radio Free Europe / Radio Liberty' },
  { url: 'https://carnegieendowment.org/rss.xml', region: 'general', source: 'Carnegie Endowment for International Peace' },
  { url: 'https://www.euractiv.com/feed/', region: 'eu', source: 'Euractiv' },
  { url: 'https://www.chathamhouse.org/rss.xml', region: 'general', source: 'Chatham House' },
];

// RSS-to-JSON converter services (fallback chain)
const RSS_CONVERTERS = [
  'https://api.rss2json.com/v1/api.json?rss_url=',
  'https://rss-to-json-serverless-api.vercel.app/api?rss_url=',
];

// Cache
let newsCache: NewsItem[] | null = null;
let lastFetch = 0;
const CACHE_DURATION = 30 * 60 * 1000;

export async function fetchNews(limit = 15): Promise<NewsItem[]> {
  const now = Date.now();
  if (newsCache && now - lastFetch < CACHE_DURATION) {
    return newsCache.slice(0, limit);
  }

  const results: NewsItem[] = [];

  for (const feed of RSS_FEEDS) {
    for (const converter of RSS_CONVERTERS) {
      try {
        const url = `${converter}${encodeURIComponent(feed.url)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.items || !Array.isArray(data.items)) continue;

        for (const item of data.items.slice(0, 5)) {
          const description = (item.description || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

          // Get full content if available
          const fullContent = (item.content || item.description || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

          // Extract image from content
          let imageUrl: string | undefined;
          if (item.thumbnail) imageUrl = item.thumbnail;
          else if (item.enclosure?.link) imageUrl = item.enclosure.link;
          else {
            const imgMatch = (item.content || item.description || '').match(/<img[^>]+src=["']([^"']+)["']/);
            if (imgMatch) imageUrl = imgMatch[1];
          }

          results.push({
            title: item.title || 'Untitled',
            source: feed.source,
            url: item.link || '',
            summary: description.slice(0, 500) || '',
            content: fullContent.slice(0, 3000) || description.slice(0, 3000) || '',
            publishedAt: item.pubDate || new Date().toISOString(),
            region: feed.region,
            imageUrl,
          });
        }
        break; // Success with this converter, move to next feed
      } catch {
        continue; // Try next converter
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = results.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  newsCache = deduped;
  lastFetch = now;

  return deduped.slice(0, limit);
}

export function clearNewsCache() {
  newsCache = null;
  lastFetch = 0;
}

export function getNewsByRegion(region: string, limit = 10): NewsItem[] {
  if (!newsCache) return [];
  if (region === 'all') return newsCache.slice(0, limit);
  return newsCache.filter((n) => n.region === region).slice(0, limit);
}