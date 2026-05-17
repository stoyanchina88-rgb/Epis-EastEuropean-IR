import { Paper } from '../types';

const OPENALEX_BASE = 'https://api.openalex.org';

interface ConceptScore {
  id: string;
  display_name: string;
  score: number;
}

// Extract top concepts from a set of papers
function extractConcepts(papers: Paper[]): ConceptScore[] {
  const conceptMap = new Map<string, { display_name: string; score: number; count: number }>();

  for (const paper of papers) {
    if (paper.keywords) {
      // Use keywords as concept signals
      for (const kw of paper.keywords) {
        const existing = conceptMap.get(kw);
        if (existing) {
          existing.count += 1;
        } else {
          conceptMap.set(kw, { display_name: kw, score: 50, count: 1 });
        }
      }
    }
  }

  return Array.from(conceptMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({ id: c.display_name, display_name: c.display_name, score: c.score }));
}

export async function getRecommendations(
  bookmarkedPapers: Paper[],
  seenIds: Set<string>,
  limit = 25
): Promise<Paper[]> {
  if (bookmarkedPapers.length === 0) return [];

  const concepts = extractConcepts(bookmarkedPapers);

  if (concepts.length === 0) {
    // Fallback: search by most recent bookmarked paper's title keywords
    const latest = bookmarkedPapers[0];
    const keywords = latest.title.split(' ').filter((w) => w.length > 3).slice(0, 3);
    if (keywords.length === 0) return [];

    const query = keywords.join(' ');
    return searchRelated(query, seenIds, limit);
  }

  // Build search query from top concepts
  const queryTerms = concepts.map((c) => c.display_name).slice(0, 3);
  const query = queryTerms.join(' ');

  return searchRelated(query, seenIds, limit);
}

async function searchRelated(
  query: string,
  excludeIds: Set<string>,
  limit: number
): Promise<Paper[]> {
  const url = `${OPENALEX_BASE}/works?search=${encodeURIComponent(query)}&sort=relevance_score:desc&per_page=${limit + 20}&select=id,title,authorships,primary_location,publication_year,cited_by_count,doi,open_access,concepts,abstract_inverted_index,type,language`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];

    const data = await res.json();
    const results = data.results || [];

    // Convert to Paper format (reuse openAlex parsing logic)
    const papers: Paper[] = [];
    for (const work of results) {
      const openAlexId = work.id.replace('https://openalex.org/', '');
      const paperId = `openalex-${openAlexId}`;
      if (excludeIds.has(paperId)) continue;

      const invertedIndex = work.abstract_inverted_index;
      const abstract = invertedIndex
        ? reconstructAbstract(invertedIndex)
        : 'No abstract available.';

      const concepts = work.concepts
        ?.filter((c: any) => c.score > 30)
        .map((c: any) => c.display_name) || [];

      papers.push({
        id: paperId,
        title: work.title || 'Untitled',
        authors: work.authorships?.map((a: any) => a.author.display_name) || [],
        abstract,
        journal: work.primary_location?.source?.display_name || undefined,
        year: work.publication_year || 0,
        citationCount: work.cited_by_count || 0,
        url: work.doi_url || `https://openalex.org/${openAlexId}`,
        doi: work.doi?.replace('https://doi.org/', ''),
        category: concepts[0] || 'political-science',
        keywords: concepts,
        source: 'openalex',
        language: work.language || 'en',
      });

      if (papers.length >= limit) break;
    }

    return papers;
  } catch {
    return [];
  }
}

function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  const wordPositions: Array<{ pos: number; word: string }> = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push({ pos, word });
    }
  }
  wordPositions.sort((a, b) => a.pos - b.pos);
  return wordPositions.map((w) => w.word).join(' ');
}