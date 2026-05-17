import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiRefreshCw, FiBookmark, FiExternalLink, FiChevronDown, FiChevronUp, FiAward, FiMessageCircle, FiStar } from 'react-icons/fi';
import { ContentItem, Paper, NewsItem, TheorySnippet, PaperExcerpt } from '../types';
import { fetchFeed } from '../api/feedService';
import { fetchNews } from '../api/newsFeed';
import { theorySnippets as THEORY_SNIPPETS } from '../data/irTheorySnippets';
import { paperExcerpts as PAPER_EXCERPTS } from '../data/paperExcerpts';
import { useBookmarks } from '../hooks/useBookmarks';

interface ForYouPageProps {
  onPaperDetail: (paper: Paper) => void;
  onNewsDetail: (news: NewsItem) => void;
  onTheoryDetail: (theory: TheorySnippet) => void;
  onExcerptDetail: (excerpt: PaperExcerpt) => void;
}

const PRELOAD_THRESHOLD = 5;
const MAX_ITEMS = 200;
const BATCH_SIZE = 15;
const NEWS_PER_BATCH = 8;
const CACHE_KEY = 'epis-foryou-items';
const SEEN_KEY = 'epis-seen-ids';

export default function ForYouPage({ onPaperDetail, onNewsDetail, onTheoryDetail, onExcerptDetail }: ForYouPageProps) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [showCommentary, setShowCommentary] = useState<Record<string, boolean>>({});
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const fetchPageRef = useRef(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const preloadingRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEEN_KEY);
      if (saved) seenIdsRef.current = new Set(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const markAsSeen = useCallback((id: string) => {
    if (seenIdsRef.current.has(id)) return;
    seenIdsRef.current.add(id);
    try {
      const arr = Array.from(seenIdsRef.current);
      if (arr.length > 1000) {
        const trimmed = arr.slice(arr.length - 1000);
        localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
        seenIdsRef.current = new Set(trimmed);
      } else {
        localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
      }
    } catch { /* localStorage full */ }
  }, []);

  useEffect(() => {
    if (items[currentIndex]) {
      markAsSeen(items[currentIndex].id);
    }
  }, [currentIndex, items, markAsSeen]);

  const toContentItems = useCallback((
    papers: Paper[], news: NewsItem[], page: number
  ): ContentItem[] => {
    let theoryItems: ContentItem[] = [];
    let excerptItems: ContentItem[] = [];
    if (page === 0) {
      theoryItems = THEORY_SNIPPETS.map((t) => ({
        id: `theory-${t.id}`,
        type: 'theory' as const,
        theory: t,
        timestamp: Date.now() - Math.random() * 86400000,
      }));
      excerptItems = PAPER_EXCERPTS.map((e) => ({
        id: `excerpt-${e.id}`,
        type: 'excerpt' as const,
        excerpt: e,
        timestamp: Date.now() - Math.random() * 86400000,
      }));
    }

    const newsItems: ContentItem[] = news.map((n) => ({
      id: `news-${n.url}`,
      type: 'news' as const,
      news: n,
      timestamp: new Date(n.publishedAt).getTime(),
    }));

    const paperItems: ContentItem[] = papers.map((p) => ({
      id: `paper-${p.id}`,
      type: 'paper' as const,
      paper: p,
      timestamp: Date.now() - Math.random() * 86400000,
    }));

    const all = [...paperItems, ...newsItems, ...theoryItems, ...excerptItems];
    const unseen = all.filter((item) => !seenIdsRef.current.has(item.id));

    if (unseen.length === 0 && all.length > 0) {
      return all.slice(0, BATCH_SIZE);
    }

    for (let i = unseen.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unseen[i], unseen[j]] = [unseen[j], unseen[i]];
    }

    return unseen;
  }, []);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    fetchPageRef.current = 0;

    try {
      let cached: ContentItem[] = [];
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          cached = JSON.parse(raw);
          cached = cached.filter((item) => !seenIdsRef.current.has(item.id));
        }
      } catch { /* ignore */ }

      if (cached.length >= 10) {
        setItems(cached);
        setCurrentIndex(0);
        setLoading(false);
        loadMore(0);
        return;
      }

      const [papers, news] = await Promise.all([
        fetchFeed({ mode: 'recent', maxResults: BATCH_SIZE, translate: false }),
        fetchNews(NEWS_PER_BATCH),
      ]);

      const newItems = toContentItems(papers, news, 0);
      setItems(newItems);
      setCurrentIndex(0);
      
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newItems.slice(0, 50)));
      } catch { /* ignore */ }
    } catch (err) {
      setError('加载内容失败，请检查网络连接');
      console.error('ForYou load error:', err);
    } finally {
      setLoading(false);
    }
  }, [toContentItems]);

  const loadMore = useCallback(async (page: number) => {
    if (preloadingRef.current) return;
    preloadingRef.current = true;
    setLoadingMore(true);

    try {
      const [papers, news] = await Promise.all([
        fetchFeed({ mode: 'recent', maxResults: BATCH_SIZE, translate: false, page }),
        fetchNews(NEWS_PER_BATCH),
      ]);

      const newItems = toContentItems(papers, news, page);

      if (newItems.length === 0 && page < 5) {
        preloadingRef.current = false;
        setLoadingMore(false);
        loadMore(page + 1);
        return;
      }

      setItems((prev) => {
        const combined = [...prev, ...newItems];
        if (combined.length > MAX_ITEMS) {
          return combined.slice(combined.length - MAX_ITEMS);
        }
        return combined;
      });

      fetchPageRef.current = page;

      try {
        const allItems = [...items, ...newItems];
        localStorage.setItem(CACHE_KEY, JSON.stringify(allItems.slice(-50)));
      } catch { /* ignore */ }
    } catch (err) {
      console.error('ForYou loadMore error:', err);
    } finally {
      setLoadingMore(false);
      preloadingRef.current = false;
    }
  }, [toContentItems, items]);

  useEffect(() => {
    if (!mountedRef.current) return;
    loadContent();
    return () => { mountedRef.current = false; };
  }, [loadContent]);

  useEffect(() => {
    if (items.length === 0 || loading || loadingMore) return;
    const remaining = items.length - currentIndex;
    if (remaining <= PRELOAD_THRESHOLD) {
      loadMore(fetchPageRef.current + 1);
    }
  }, [currentIndex, items.length, loading, loadingMore, loadMore]);

  const currentItem = items[currentIndex];
  const hasNext = currentIndex < items.length - 1;
  const hasPrev = currentIndex > 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const absY = Math.abs(deltaY);
    const absX = Math.abs(deltaX);

    if (absY > 60 && absY > absX * 1.5) {
      if (deltaY < 0 && hasNext) {
        setCurrentIndex((i) => i + 1);
      } else if (deltaY > 0 && hasPrev) {
        setCurrentIndex((i) => i - 1);
      }
    }
  };

  const handleSwipe = (direction: 'up' | 'down') => {
    if (direction === 'up' && hasNext) {
      setCurrentIndex((i) => i + 1);
    } else if (direction === 'down' && hasPrev) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleTap = () => {
    if (!currentItem) return;
    if (currentItem.type === 'paper' && currentItem.paper) onPaperDetail(currentItem.paper);
    else if (currentItem.type === 'news' && currentItem.news) onNewsDetail(currentItem.news);
    else if (currentItem.type === 'theory' && currentItem.theory) onTheoryDetail(currentItem.theory);
    else if (currentItem.type === 'excerpt' && currentItem.excerpt) onExcerptDetail(currentItem.excerpt);
  };

  if (loading && items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--epis-accent)', borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>为你编排内容...</span>
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
          <FiRefreshCw className="w-7 h-7 text-rose-400" />
        </div>
        <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--epis-text)' }}>加载失败</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--epis-text-muted)' }}>{error}</p>
        <button onClick={loadContent} className="px-6 py-3 rounded-full font-medium transition-colors flex items-center gap-2"
          style={{ background: 'var(--epis-accent)', color: '#fff' }}>
          <FiRefreshCw className="w-4 h-4" />重试
        </button>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--epis-text)' }}>暂无新内容</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--epis-text-muted)' }}>点击刷新获取更多内容</p>
        <button onClick={loadContent} className="px-6 py-3 rounded-full font-medium transition-colors"
          style={{ background: 'var(--epis-accent)', color: '#fff' }}>
          刷新
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}>
      <div className="px-6 pt-4 pb-2 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--epis-text)' }}>
          <FiStar className="w-5 h-5" style={{ color: 'var(--epis-accent)' }} />
          为你推荐
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--epis-text-muted)' }}>
            {currentIndex + 1}/{items.length}
            {loadingMore && <span className="ml-1 inline-block w-3 h-3 border-2 rounded-full animate-spin align-middle" style={{ borderColor: 'var(--epis-accent)', borderTopColor: 'transparent' }} />}
          </span>
          <button onClick={loadContent} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'var(--epis-surface)' }}>
            <FiRefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--epis-text-muted)' }} />
          </button>
        </div>
      </div>

      <div className="px-6 pb-1 flex items-center justify-center gap-4 text-[10px] shrink-0" style={{ color: 'var(--epis-text-muted)' }}>
        <span className="flex items-center gap-1"><FiChevronUp className="w-3 h-3" />上滑切换</span>
        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--epis-border)' }} />
        <span className="flex items-center gap-1">点击查看详情</span>
        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--epis-border)' }} />
        <span className="flex items-center gap-1"><FiChevronDown className="w-3 h-3" />下滑切换</span>
      </div>

      <div className="flex-1 relative overflow-hidden px-4 pb-4 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            className="absolute inset-2 rounded-3xl overflow-hidden cursor-pointer"
            style={{ background: 'var(--epis-card)', border: '1px solid var(--epis-border)' }}
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -100, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={handleTap}
          >
            <div className="absolute top-4 left-4 z-10">
              <span className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: currentItem.type === 'paper' ? 'rgba(168,85,247,0.15)' :
                    currentItem.type === 'news' ? 'rgba(59,130,246,0.15)' :
                    currentItem.type === 'theory' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                  color: currentItem.type === 'paper' ? '#a855f7' :
                    currentItem.type === 'news' ? '#3b82f6' :
                    currentItem.type === 'theory' ? '#f59e0b' : '#f43f5e',
                }}
              >
                {currentItem.type === 'paper' ? '📄 论文' :
                 currentItem.type === 'news' ? '📰 新闻' :
                 currentItem.type === 'theory' ? '📖 理论' : '✨ 精选'}
              </span>
            </div>

            <div className="h-full flex flex-col p-6 pt-14 overflow-hidden">
              {currentItem.type === 'paper' && currentItem.paper && (
                <PaperContent paper={currentItem.paper} showCommentary={showCommentary[currentItem.id] || false}
                  onToggleCommentary={() => setShowCommentary((p) => ({ ...p, [currentItem.id]: !p[currentItem.id] }))} />
              )}
              {currentItem.type === 'news' && currentItem.news && (
                <NewsContent news={currentItem.news} />
              )}
              {currentItem.type === 'theory' && currentItem.theory && (
                <TheoryContent theory={currentItem.theory} />
              )}
              {currentItem.type === 'excerpt' && currentItem.excerpt && (
                <ExcerptContent excerpt={currentItem.excerpt} />
              )}
            </div>

            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-around px-6">
              <button onClick={(e) => { e.stopPropagation(); handleSwipe('down'); }}
                className="flex flex-col items-center gap-1 group">
                <div className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'var(--epis-surface)' }}>
                  <FiChevronDown className="w-5 h-5 text-rose-400" />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>上一个</span>
              </button>

              <button onClick={(e) => {
                e.stopPropagation();
                if (currentItem.type === 'paper' && currentItem.paper) {
                  toggleBookmark(currentItem.paper);
                }
              }}
                className="flex flex-col items-center gap-1 group">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                  currentItem.type === 'paper' && currentItem.paper && isBookmarked(currentItem.paper.id)
                    ? 'bg-emerald-500/20' : ''
                }`}
                  style={{
                    background: currentItem.type === 'paper' && currentItem.paper && isBookmarked(currentItem.paper.id)
                      ? undefined : 'var(--epis-surface)',
                    opacity: currentItem.type !== 'paper' ? 0.4 : 1,
                  }}>
                  <FiBookmark className={`w-5 h-5 ${
                    currentItem.type === 'paper' && currentItem.paper && isBookmarked(currentItem.paper.id)
                      ? 'text-emerald-400' : ''
                  }`}
                    style={{
                      color: currentItem.type === 'paper' && currentItem.paper && isBookmarked(currentItem.paper.id)
                        ? undefined : 'var(--epis-text-muted)',
                    }} />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>
                  {currentItem.type === 'paper' && currentItem.paper && isBookmarked(currentItem.paper.id)
                    ? '已收藏' : '收藏'}
                </span>
              </button>

              <button onClick={(e) => { e.stopPropagation(); handleSwipe('up'); }}
                className="flex flex-col items-center gap-1 group">
                <div className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--epis-surface)' }}>
                  <FiChevronUp className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>下一个</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function PaperContent({ paper, showCommentary, onToggleCommentary }: { paper: Paper; showCommentary: boolean; onToggleCommentary: () => void }) {
  const displayTitle = paper.isTranslated && paper.translatedTitle ? paper.translatedTitle : paper.title;
  const displayAbstract = paper.isTranslated && paper.translatedAbstract ? paper.translatedAbstract : paper.abstract;
  const keywords = paper.isTranslated && paper.translatedKeywords ? paper.translatedKeywords : paper.keywords;
  const translationNote = !paper.isTranslated && !paper.translationFailed ? '⏳ 翻译中...' :
    paper.translationFailed ? '⚠️ 翻译暂不可用' : '';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-2 flex-wrap shrink-0">
        <span className="tag-pill text-xs" style={{ background: 'var(--epis-accent-soft)', color: 'var(--epis-accent)', border: '1px solid var(--epis-border)' }}>{paper.category}</span>
        {paper.citationCount && (
          <span className="tag-pill text-xs flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid var(--epis-border)' }}>
            <FiAward className="w-3 h-3" />{paper.citationCount >= 1000 ? `${(paper.citationCount / 1000).toFixed(1)}k` : paper.citationCount}
          </span>
        )}
        {translationNote && (
          <span className="tag-pill text-xs" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid var(--epis-border)' }}>
            {translationNote}
          </span>
        )}
      </div>
      <p className="text-xs mb-2 shrink-0" style={{ color: 'var(--epis-text-muted)' }}>{paper.journal} · {paper.year}</p>
      <h3 className="text-lg font-bold leading-tight mb-2 line-clamp-2 shrink-0" style={{ color: 'var(--epis-text)' }}>{displayTitle}</h3>
      <p className="text-xs mb-2 line-clamp-1 shrink-0" style={{ color: 'var(--epis-text-muted)' }}>{paper.authors.slice(0, 3).join(' · ')}{paper.authors.length > 3 && ' 等'}</p>
      <div className="flex-1 overflow-hidden min-h-0">
        <p className="text-sm leading-relaxed line-clamp-5" style={{ color: 'var(--epis-text)' }}>{displayAbstract}</p>
      </div>
      {keywords && keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 shrink-0">
          {keywords.slice(0, 4).map((kw) => (
            <span key={kw} className="px-2 py-0.5 rounded-md text-xs" style={{ background: 'var(--epis-surface)', color: 'var(--epis-text-muted)' }}>#{kw}</span>
          ))}
        </div>
      )}
      {paper.commentary && (
        <button onClick={(e) => { e.stopPropagation(); onToggleCommentary(); }}
          className="mt-2 flex items-center gap-1 text-[10px] transition-colors shrink-0" style={{ color: 'var(--epis-accent)' }}>
          <FiMessageCircle className="w-3 h-3" />{showCommentary ? '收起 AI 点评' : '查看 AI 点评'}
        </button>
      )}
      {showCommentary && paper.commentary && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          className="overflow-hidden shrink-0">
          <div className="p-2 rounded-xl space-y-1 mt-1" style={{ background: 'var(--epis-accent-soft)', border: '1px solid var(--epis-border)' }}>
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--epis-text-muted)' }}>
              <span style={{ color: 'var(--epis-accent)' }}>💡 概要：</span>{paper.commentary.summary}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function NewsContent({ news }: { news: NewsItem }) {
  const regionLabels: Record<string, string> = {
    ukraine: '🇺🇦 乌克兰', russia: '🇷🇺 俄罗斯', belarus: '🇧🇾 白俄罗斯',
    poland: '🇵🇱 波兰', balkans: '🌍 巴尔干', eu: '🇪🇺 欧盟', general: '🌐 东欧综合',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="text-xs">{regionLabels[news.region] || '🌐 东欧'}</span>
        <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>{news.source}</span>
      </div>
      <h3 className="text-lg font-bold leading-tight mb-2 line-clamp-2 shrink-0" style={{ color: 'var(--epis-text)' }}>{news.title}</h3>
      <p className="text-[10px] mb-3 shrink-0" style={{ color: 'var(--epis-text-muted)' }}>
        {new Date(news.publishedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
      <div className="flex-1 overflow-hidden min-h-0">
        <p className="text-sm leading-relaxed line-clamp-10" style={{ color: 'var(--epis-text)' }}>
          {news.content || news.summary}
        </p>
      </div>
      <a href={news.url} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-3 inline-flex items-center gap-1 text-xs transition-colors shrink-0"
        style={{ color: 'var(--epis-accent)' }}>
        <FiExternalLink className="w-3 h-3" />阅读原文
      </a>
    </div>
  );
}

function TheoryContent({ theory }: { theory: TheorySnippet }) {
  const catLabels: Record<string, string> = {
    realism: '🛡️ 现实主义', liberalism: '🤝 自由主义', constructivism: '🏛️ 建构主义',
    geopolitics: '🌍 地缘政治', critical: '🔍 批判理论',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="text-xs">{catLabels[theory.category] || theory.category}</span>
        <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>相关度 {'⭐'.repeat(theory.relevance)}</span>
      </div>
      <h3 className="text-lg font-bold leading-tight mb-1 shrink-0" style={{ color: 'var(--epis-text)' }}>{theory.name}</h3>
      <p className="text-xs mb-3 shrink-0" style={{ color: 'var(--epis-text-muted)' }}>{theory.thinkers.join('、')}</p>
      <div className="flex-1 overflow-hidden min-h-0 space-y-2">
        <div className="p-2 rounded-xl" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}>
          <h4 className="text-xs font-medium mb-1" style={{ color: 'var(--epis-accent)' }}>核心思想</h4>
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--epis-text)' }}>{theory.coreIdea}</p>
        </div>
        <div className="p-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid var(--epis-border)' }}>
          <h4 className="text-xs font-medium mb-1" style={{ color: '#f59e0b' }}>东欧应用</h4>
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--epis-text)' }}>{theory.application}</p>
        </div>
      </div>
    </div>
  );
}

function ExcerptContent({ excerpt }: { excerpt: PaperExcerpt }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <h3 className="text-lg font-bold leading-tight mb-1 shrink-0" style={{ color: 'var(--epis-text)' }}>{excerpt.title}</h3>
      <p className="text-xs mb-2 shrink-0" style={{ color: 'var(--epis-text-muted)' }}>{excerpt.authors.join(' · ')}</p>
      <p className="text-[10px] mb-3 shrink-0" style={{ color: 'var(--epis-text-muted)' }}>{excerpt.source}</p>
      <div className="flex-1 overflow-hidden min-h-0 space-y-2">
        <div className="p-2 rounded-xl" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}>
          <h4 className="text-xs font-medium mb-1" style={{ color: 'var(--epis-accent)' }}>精选原文</h4>
          <p className="text-sm leading-relaxed italic line-clamp-3" style={{ color: 'var(--epis-text)' }}>"{excerpt.excerpt}"</p>
        </div>
        <div className="p-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid var(--epis-border)' }}>
          <h4 className="text-xs font-medium mb-1" style={{ color: '#f59e0b' }}>核心洞见</h4>
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--epis-text)' }}>{excerpt.insight}</p>
        </div>
      </div>
    </div>
  );
}