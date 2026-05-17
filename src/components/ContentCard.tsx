import { motion } from 'framer-motion';
import { FiExternalLink, FiBookmark, FiGlobe, FiAward, FiChevronRight } from 'react-icons/fi';
import { ContentItem, NewsItem, TheorySnippet, Paper } from '../types';

interface ContentCardProps {
  item: ContentItem;
  onSelect?: (item: ContentItem) => void;
  onBookmark?: (paper: Paper) => void;
  isBookmarked?: boolean;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

export default function ContentCard({ item, onSelect, onBookmark, isBookmarked }: ContentCardProps) {
  switch (item.type) {
    case 'paper':
      return <PaperContentCard paper={item.paper!} onSelect={() => onSelect?.(item)} onBookmark={onBookmark} isBookmarked={isBookmarked} />;
    case 'news':
      return <NewsContentCard news={item.news!} onSelect={() => onSelect?.(item)} />;
    case 'theory':
      return <TheoryContentCard theory={item.theory!} onSelect={() => onSelect?.(item)} />;
    case 'excerpt':
      return <ExcerptContentCard excerpt={item.excerpt!} onSelect={() => onSelect?.(item)} />;
  }
}

/* Paper Card (compact version for mixed feed) */
function PaperContentCard({ paper, onSelect, onBookmark, isBookmarked }: {
  paper: Paper;
  onSelect: () => void;
  onBookmark?: (paper: Paper) => void;
  isBookmarked?: boolean;
}) {
  const displayTitle = paper.isTranslated && paper.translatedTitle ? paper.translatedTitle : paper.title;
  const keywords = paper.isTranslated && paper.translatedKeywords ? paper.translatedKeywords : paper.keywords;

  return (
    <motion.div
      className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer"
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="tag-pill bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px]">
          📄 论文
        </span>
        {paper.isTranslated && (
          <span className="tag-pill bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px]">
            🤖 翻译
          </span>
        )}
      </div>
      <h4 className="text-white font-medium text-sm leading-snug mb-1 line-clamp-2">{displayTitle}</h4>
      <p className="text-epis-text-muted text-xs line-clamp-1 mb-1">
        {paper.authors.slice(0, 2).join(' · ')}{paper.authors.length > 2 && ' 等'} · {paper.year}
      </p>
      {paper.commentary && (
        <p className="text-purple-300/60 text-[10px] leading-relaxed line-clamp-2 mt-1">
          💡 {paper.commentary.summary}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2">
        {keywords && keywords.slice(0, 3).map((kw) => (
          <span key={kw} className="text-[10px] text-epis-text-muted bg-white/5 px-2 py-0.5 rounded-full">
            #{kw}
          </span>
        ))}
        {paper.citationCount && (
          <span className="text-[10px] text-amber-400/60 flex items-center gap-0.5 ml-auto">
            <FiAward className="w-2.5 h-2.5" />{paper.citationCount >= 1000 ? `${(paper.citationCount / 1000).toFixed(1)}k` : paper.citationCount}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* News Card */
function NewsContentCard({ news, onSelect }: { news: NewsItem; onSelect: () => void }) {
  const regionLabels: Record<string, string> = {
    ukraine: '🇺🇦 乌克兰', russia: '🇷🇺 俄罗斯', belarus: '🇧🇾 白俄罗斯',
    poland: '🇵🇱 波兰', balkans: '🌍 巴尔干', eu: '🇪🇺 欧盟', general: '🌐 东欧综合',
  };

  return (
    <motion.div
      className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer"
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="tag-pill bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px]">
          📰 新闻
        </span>
        <span className="text-[10px] text-epis-text-muted">{regionLabels[news.region] || news.region}</span>
      </div>
      <h4 className="text-white font-medium text-sm leading-snug mb-1 line-clamp-2">{news.title}</h4>
      <p className="text-epis-text-muted text-xs line-clamp-2 leading-relaxed">{news.summary}</p>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-epis-text-muted">
        <span>{news.source}</span>
        <span>·</span>
        <span>{new Date(news.publishedAt).toLocaleDateString('zh-CN')}</span>
      </div>
    </motion.div>
  );
}

/* Theory Card */
function TheoryContentCard({ theory, onSelect }: { theory: TheorySnippet; onSelect: () => void }) {
  const categoryLabels: Record<string, string> = {
    realism: '🛡️ 现实主义', liberalism: '🤝 自由主义',
    constructivism: '🏛️ 建构主义', geopolitics: '🌍 地缘政治', critical: '🔍 批判理论',
  };

  const stars = '⭐'.repeat(theory.relevance);

  return (
    <motion.div
      className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer"
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="tag-pill bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px]">
          📖 理论
        </span>
        <span className="text-[10px] text-epis-text-muted">
          {categoryLabels[theory.category] || theory.category}
        </span>
        <span className="text-[10px] ml-auto">{stars}</span>
      </div>
      <h4 className="text-white font-medium text-sm leading-snug mb-1">{theory.name}</h4>
      <p className="text-epis-text-muted text-xs mb-1">{theory.thinkers.join('、')}</p>
      <p className="text-epis-text/70 text-xs leading-relaxed line-clamp-2">{theory.coreIdea}</p>
    </motion.div>
  );
}

/* Excerpt Card */
function ExcerptContentCard({ excerpt, onSelect }: {
  excerpt: { id: string; title: string; authors: string[]; excerpt: string; context: string; insight: string; source: string };
  onSelect: () => void;
}) {
  return (
    <motion.div
      className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer"
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="tag-pill bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px]">
          ✨ 精选
        </span>
      </div>
      <h4 className="text-white font-medium text-sm leading-snug mb-1">{excerpt.title}</h4>
      <p className="text-epis-text-muted text-xs mb-1">{excerpt.authors.join(' · ')}</p>
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 mb-2">
        <p className="text-epis-text/70 text-xs leading-relaxed italic line-clamp-3">"{excerpt.excerpt}"</p>
      </div>
      <p className="text-purple-300/60 text-[10px] leading-relaxed line-clamp-2">
        💡 {excerpt.insight}
      </p>
    </motion.div>
  );
}