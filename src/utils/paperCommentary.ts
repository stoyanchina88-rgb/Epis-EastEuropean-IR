import { Paper, PaperCommentary } from '../types';

// Journal prestige signals (subjective mapping for Eastern Europe / IR)
const PRESTIGE_JOURNALS: Record<string, number> = {
  'international organization': 5,
  'international security': 5,
  'world politics': 5,
  'american political science review': 5,
  'journal of peace research': 4,
  'european journal of international relations': 4,
  'international studies quarterly': 4,
  'security studies': 4,
  'post-soviet affairs': 4,
  'europe-asia studies': 4,
  'journal of democracy': 4,
  'foreign affairs': 4,
  'survival': 3,
  'east european politics': 3,
  'european security': 3,
  'journal of eurasian studies': 3,
  'problems of post-communism': 3,
};

// Title patterns that indicate innovation
const INNOVATION_PATTERNS = [
  /new\s+(framework|approach|model|theory|paradigm|perspective)/i,
  /rethinking|reconsidering|revisiting|reframing/i,
  /challenge|critique|beyond|against/i,
  /toward|towards\s+a/i,
  /unpacking|uncovering|revealing|explaining/i,
  /novel|innovative|first|original/i,
];

// Keywords that indicate methodology
const EMPIRICAL_KEYWORDS = ['empirical', 'case study', 'fieldwork', 'survey', 'experiment', 'data', 'evidence', 'quantitative', 'qualitative'];
const THEORETICAL_KEYWORDS = ['theory', 'concept', 'framework', 'model', 'paradigm', 'approach', 'perspective', 'discourse', 'narrative'];

function detectPrestige(journal?: string): number {
  if (!journal) return 1;
  const lower = journal.toLowerCase();
  for (const [key, score] of Object.entries(PRESTIGE_JOURNALS)) {
    if (lower.includes(key)) return score;
  }
  return 1;
}

function detectInnovationSignals(title: string): string[] {
  const signals: string[] = [];
  for (const pattern of INNOVATION_PATTERNS) {
    const match = title.match(pattern);
    if (match) signals.push(match[0].toLowerCase());
  }
  return signals;
}

function hasEmpiricalApproach(keywords?: string[]): boolean {
  if (!keywords) return false;
  return keywords.some((kw) =>
    EMPIRICAL_KEYWORDS.some((e) => kw.toLowerCase().includes(e))
  );
}

function hasTheoreticalApproach(keywords?: string[]): boolean {
  if (!keywords) return false;
  return keywords.some((kw) =>
    THEORETICAL_KEYWORDS.some((t) => kw.toLowerCase().includes(t))
  );
}

function extractKeySentence(abstract: string): string {
  // Try to find the most informative sentence
  const sentences = abstract.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 1) return abstract.slice(0, 200);

  // Usually the first 1-2 sentences state the problem, last 1-2 state the finding
  const intro = sentences.slice(0, 2).join(' ');
  const conclusion = sentences.slice(-2).join(' ');

  // Pick the shorter one that's more than 30 chars
  if (intro.length <= conclusion.length && intro.length > 30) return intro;
  if (conclusion.length > 30) return conclusion;
  return intro;
}

function getRecencySignal(year: number): string {
  const currentYear = new Date().getFullYear();
  const diff = currentYear - year;
  if (diff <= 1) return '最新研究';
  if (diff <= 3) return '近期热点';
  if (diff <= 8) return '近年重要研究';
  if (diff <= 15) return '该领域奠基性研究';
  return '经典文献';
}

function getCategoryAudience(category: string): string {
  const audiences: Record<string, string> = {
    'political-science': '政治学研究者、国际关系学者',
    'international-relations': '国际关系学者、外交政策分析者',
    'eastern-europe': '东欧研究学者、区域研究专家',
    'security-studies': '安全研究学者、军事分析师',
    'comparative-politics': '比较政治学研究者',
    'economics': '政治经济学家、发展研究者',
    'sociology': '社会学者、民族关系研究者',
    'history': '历史学者、苏联/东欧史研究者',
  };
  return audiences[category] || '相关领域研究者和政策分析者';
}

export function generateCommentary(paper: Paper): PaperCommentary {
  const prestige = detectPrestige(paper.journal);
  const innovationSignals = detectInnovationSignals(paper.title);
  const isEmpirical = hasEmpiricalApproach(paper.keywords);
  const isTheoretical = hasTheoreticalApproach(paper.keywords);
  const recency = getRecencySignal(paper.year);
  const keySentence = extractKeySentence(paper.abstract);
  const audience = getCategoryAudience(paper.category);

  // Summary
  const summary = `本文${isEmpirical ? '基于实证分析' : isTheoretical ? '从理论层面' : '系统性地'}探讨了${
    paper.title.length > 50 ? paper.title.slice(0, 50) + '…' : paper.title
  }问题。${
    paper.citationCount && paper.citationCount > 50
      ? '作为该领域的高引文献，'
      : ''
  }核心观点可从摘要中提炼：${keySentence}`;

  // Innovation
  let innovation = '';
  if (innovationSignals.length > 0) {
    innovation = `本文在方法论上${innovationSignals.includes('new') ? '提出了新的分析框架' : '进行了创新性的理论重构'}。`;
  } else if (isEmpirical && isTheoretical) {
    innovation = '本文的创新之处在于将理论分析与实证数据相结合，提供了既有理论深度又有经验依据的分析视角。';
  } else if (isEmpirical) {
    innovation = '本文基于第一手数据和/或最新案例，为既有理论提供了新的经验证据。';
  } else if (isTheoretical) {
    innovation = '本文对既有理论进行了批判性审视，提出了新的概念框架或分析路径。';
  } else {
    innovation = '本文对相关议题进行了全面系统的梳理和分析，为后续研究奠定了坚实基础。';
  }

  // Add citation-based signal
  if (paper.citationCount && paper.citationCount > 100) {
    innovation += ' 其高被引次数（' + paper.citationCount + '次）表明该研究在学术界产生了广泛影响。';
  } else if (paper.citationCount && paper.citationCount > 20) {
    innovation += ' 被引' + paper.citationCount + '次，反映了其在领域内的学术影响力。';
  }

  // Significance
  let significance = '';
  if (prestige >= 4) {
    significance = `发表于顶级期刊${paper.journal ? '《' + paper.journal + '》' : ''}，${recency}，`;
  } else if (paper.journal) {
    significance = `发表于${paper.journal}，${recency}，`;
  } else {
    significance = `${recency}，`;
  }

  significance += `对${audience}具有重要参考价值。`;
  if (paper.citationCount && paper.citationCount > 20) {
    significance += ' 该论文已被多次引用，说明其观点在学界得到了广泛关注和讨论。';
  }

  // Audience
  const audienceText = `适合${audience}阅读。${
    isEmpirical
      ? '文中包含丰富的实证数据和分析，对从事经验研究的学者尤其有参考价值。'
      : isTheoretical
      ? '文章理论深度较高，适合有一定理论基础的研究者深入研读。'
      : '内容覆盖面广，适合对该议题感兴趣的各类读者。'
  }`;

  return { summary, innovation, significance, audience: audienceText };
}