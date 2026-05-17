import { Paper } from '../types';

const OPENALEX_BASE = 'https://api.openalex.org';

// OpenAlex concept IDs for political science & international relations
export const CONCEPT_IDS: Record<string, string> = {
  '国际关系': 'C557315563',
  '东欧研究': 'C2908647359',
  '政治学': 'C166752035',
  '安全研究': 'C2909354273',
  '欧盟研究': 'C2909097951',
  '比较政治': 'C2909998309',
};

export const CONCEPT_LABELS: Record<string, string> = {
  C557315563: 'International Relations',
  C2908647359: 'Eastern Europe',
  C166752035: 'Political Science',
  C2909354273: 'Security Studies',
  C2909097951: 'European Union',
  C2909998309: 'Comparative Politics',
  C2909799709: 'Post-communism',
  C2909207739: 'Soviet Union',
  C2909596304: 'Authoritarianism',
  C2909330176: 'Democratization',
};

interface OpenAlexWork {
  id: string;
  title: string;
  authorships?: Array<{
    author: { display_name: string };
  }>;
  primary_location?: {
    source?: {
      display_name?: string;
      type?: string;
    };
  };
  publication_year?: number;
  cited_by_count?: number;
  doi?: string;
  doi_url?: string;
  open_access?: {
    oa_url?: string;
  };
  concepts?: Array<{
    id: string;
    display_name: string;
    score: number;
  }>;
  abstract_inverted_index?: Record<string, number[]>;
  type?: string;
  language?: string;
  primary_topic?: {
    topic?: {
      display_name?: string;
    };
  };
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string {
  if (!invertedIndex) return '';

  const wordPositions: Array<{ pos: number; word: string }> = [];

  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push({ pos, word });
    }
  }

  wordPositions.sort((a, b) => a.pos - b.pos);
  return wordPositions.map((w) => w.word).join(' ');
}

function openAlexToPaper(work: OpenAlexWork): Paper {
  const openAlexId = work.id.replace('https://openalex.org/', '');
  const authors = work.authorships?.map((a) => a.author.display_name) || [];
  const journal = work.primary_location?.source?.display_name;
  const abstract = reconstructAbstract(work.abstract_inverted_index);
  const doi = work.doi?.replace('https://doi.org/', '');
  const concepts = work.concepts?.filter((c) => c.score > 30).map((c) => c.display_name) || [];
  const primaryConcept = work.concepts?.[0]?.id || '';

  // Determine display category
  let category = 'political-science';
  for (const [label, cid] of Object.entries(CONCEPT_IDS)) {
    if (work.concepts?.some((c) => c.id === cid && c.score > 20)) {
      category = cid;
      break;
    }
  }
  // Fallback to first high-score concept
  if (category === 'political-science' && work.concepts?.[0]) {
    category = work.concepts[0].id;
  }

  return {
    id: `openalex-${openAlexId}`,
    title: work.title || 'Untitled',
    authors,
    abstract: abstract || 'No abstract available.',
    journal: journal || undefined,
    year: work.publication_year || 0,
    citationCount: work.cited_by_count || 0,
    url: work.doi_url || `https://doi.org/${doi}` || work.open_access?.oa_url || `https://openalex.org/${openAlexId}`,
    doi: doi || undefined,
    category,
    keywords: concepts,
    source: 'openalex',
    language: work.language || 'en',
  };
}

export async function fetchPapersByConcept(
  conceptId: string,
  perPage = 25,
  search?: string,
  page = 1
): Promise<Paper[]> {
  let filter = `concepts.id:${conceptId}`;
  if (search) {
    filter += `,title_and_abstract.search:${encodeURIComponent(search)}`;
  }

  const url = `${OPENALEX_BASE}/works?filter=${filter}&sort=publication_date:desc&per_page=${perPage}&page=${page}&select=id,title,authorships,primary_location,publication_year,cited_by_count,doi,open_access,concepts,abstract_inverted_index,type,language,primary_topic`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(openAlexToPaper);
  } catch (error) {
    console.error('OpenAlex fetch error:', error);
    throw error;
  }
}

export async function searchPapers(
  query: string,
  perPage = 25,
  page = 1
): Promise<Paper[]> {
  const url = `${OPENALEX_BASE}/works?search=${encodeURIComponent(query)}&sort=relevance_score:desc&per_page=${perPage}&page=${page}&select=id,title,authorships,primary_location,publication_year,cited_by_count,doi,open_access,concepts,abstract_inverted_index,type,language,primary_topic`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`OpenAlex search HTTP ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(openAlexToPaper);
  } catch (error) {
    console.error('OpenAlex search error:', error);
    throw error;
  }
}

export async function fetchRecentFeed(perPage = 50, page = 1): Promise<Paper[]> {
  // Mix multiple concepts for a diverse feed
  const concepts = Object.values(CONCEPT_IDS).slice(0, 4);
  const perConcept = Math.ceil(perPage / concepts.length);

  try {
    const results = await Promise.allSettled(
      concepts.map((cid) => fetchPapersByConcept(cid, perConcept, undefined, page))
    );

    const allPapers: Paper[] = [];
    const seen = new Set<string>();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const paper of result.value) {
          if (!seen.has(paper.id)) {
            seen.add(paper.id);
            allPapers.push(paper);
          }
        }
      }
    }

    // Shuffle for variety
    for (let i = allPapers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPapers[i], allPapers[j]] = [allPapers[j], allPapers[i]];
    }

    return allPapers;
  } catch (error) {
    console.error('OpenAlex feed error:', error);
    throw error;
  }
}

export async function fetchPapersBySearchQuery(
  query: string,
  perPage = 50,
  page = 1
): Promise<Paper[]> {
  // Search for papers about a specific topic
  const url = `${OPENALEX_BASE}/works?search=${encodeURIComponent(query)}&sort=publication_date:desc&per_page=${perPage}&page=${page}&select=id,title,authorships,primary_location,publication_year,cited_by_count,doi,open_access,concepts,abstract_inverted_index,type,language,primary_topic`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`OpenAlex search HTTP ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(openAlexToPaper);
  } catch (error) {
    console.error('OpenAlex search error:', error);
    throw error;
  }
}