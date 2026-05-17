import { Paper } from '../types';

const SS_BASE = 'https://api.semanticscholar.org/graph/v1';

interface SSResponse {
  data?: Array<{
    paperId: string;
    title: string;
    citationCount: number;
    influentialCitationCount: number;
    year?: number;
    externalIds?: Record<string, string>;
  }>;
}

export async function enrichWithCitations(
  papers: Paper[]
): Promise<Paper[]> {
  if (papers.length === 0) return papers;

  // Batch search by title (Semantic Scholar allows batch)
  const batchSize = 50;
  const enriched = [...papers];

  for (let i = 0; i < papers.length; i += batchSize) {
    const batch = papers.slice(i, i + batchSize);

    try {
      const results = await Promise.allSettled(
        batch.map((paper) => lookupPaper(paper))
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          const globalIdx = i + idx;
          enriched[globalIdx] = {
            ...enriched[globalIdx],
            citationCount: result.value.citationCount,
          };
        }
      });
    } catch {
      // Silently fail - citation data is optional
    }

    // Rate limiting: small delay between batches
    if (i + batchSize < papers.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return enriched;
}

async function lookupPaper(paper: Paper): Promise<{ citationCount: number } | null> {
  // Try by DOI first
  if (paper.doi) {
    try {
      const url = `${SS_BASE}/paper/DOI:${paper.doi}?fields=citationCount,influentialCitationCount`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return { citationCount: data.citationCount || 0 };
      }
    } catch {
      // Fall through to title search
    }
  }

  // Search by title
  try {
    const query = encodeURIComponent(paper.title.replace(/[^\w\s]/g, '').slice(0, 100));
    const url = `${SS_BASE}/paper/search?query=${query}&limit=3&fields=title,citationCount,year`;
    const res = await fetch(url);

    if (!res.ok) return null;

    const data: SSResponse = await res.json();
    if (!data.data || data.data.length === 0) return null;

    // Find best match by title similarity
    const best = data.data[0];
    if (!best) return null;

    return { citationCount: best.citationCount || 0 };
  } catch {
    return null;
  }
}

export async function fetchRecommendations(
  paperId: string,
  limit = 10
): Promise<string[]> {
  try {
    const url = `${SS_BASE}/paper/${paperId}/recommendations?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.recommendedPapers || []).map((p: any) => p.paperId);
  } catch {
    return [];
  }
}