import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHome, FiFileText, FiBookmark, FiSettings, FiSearch, FiBookmark as FiBookmarkIcon, FiExternalLink, FiGlobe, FiX, FiRefreshCw, FiUpload, FiTrash2, FiClock, FiBookOpen, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { Paper, NewsItem, TheorySnippet, PaperExcerpt, ImportedPaper } from './types';
import { fetchFeed } from './api/feedService';
import PaperCard from './components/PaperCard';
import PaperDetail from './components/PaperDetail';
import SourceManager from './components/SourceManager';
import ForYouPage from './components/ForYouPage';
import SettingsPage from './components/SettingsPage';
import ImportPaperModal from './components/ImportPaperModal';
import ImportedPaperDetail from './components/ImportedPaperDetail';
import SplashScreen from './components/SplashScreen';
import { useBookmarks } from './hooks/useBookmarks';
import { useHistory } from './hooks/useHistory';
import { useOfflineCache } from './hooks/useOfflineCache';
import { useImportedPapers } from './hooks/useImportedPapers';
import { getLanguageLabel } from './api/fileParser';
import { translatePaperContent } from './api/translation';
import { ThemeProvider } from './hooks/useTheme';
import BookmarksPage from './components/BookmarksPage';

const APP_VERSION = '1.1.0';

type Tab = 'foryou' | 'papers' | 'library' | 'bookmarks' | 'settings';



function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('foryou');
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedImported, setSelectedImported] = useState<ImportedPaper | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [translating, setTranslating] = useState(false);

  const [detailPaper, setDetailPaper] = useState<Paper | null>(null);
  const [detailNews, setDetailNews] = useState<NewsItem | null>(null);
  const [detailTheory, setDetailTheory] = useState<TheorySnippet | null>(null);
  const [detailExcerpt, setDetailExcerpt] = useState<PaperExcerpt | null>(null);

  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();
  const { addEntry: addHistoryEntry } = useHistory();
  const { isOnline } = useOfflineCache();
  const { papers: importedPapers, removePaper, clearAll: clearImported } = useImportedPapers();
  const fetchPageRef = useRef(1);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const listEndRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const splashShown = localStorage.getItem('epis-splash-shown');
    if (splashShown) setShowSplash(false);
  }, []);

  const handleSplashDone = () => {
    setShowSplash(false);
    localStorage.setItem('epis-splash-shown', 'true');
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('epis-paper-seen-ids');
      if (saved) seenIdsRef.current = new Set(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const loadPapers = useCallback(async (page = 1, append = false, forceRefresh = false) => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    fetchPageRef.current = page;

    if (forceRefresh) {
      seenIdsRef.current = new Set();
    }

    try {
      const fetched = await fetchFeed({ mode: 'recent', maxResults: 15, translate: false, page });
      const newPapers = append
        ? fetched.filter((p) => !seenIdsRef.current.has(p.id))
        : fetched;

      if (append) {
        setAllPapers((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const trulyNew = newPapers.filter((p) => !existingIds.has(p.id));
          const combined = [...prev, ...trulyNew];
          return combined.length > 200 ? combined.slice(combined.length - 200) : combined;
        });
      } else {
        setAllPapers(newPapers);
        setCurrentIndex(0);
      }

      newPapers.forEach((p) => seenIdsRef.current.add(p.id));
      try {
        const arr = Array.from(seenIdsRef.current);
        localStorage.setItem('epis-paper-seen-ids', JSON.stringify(arr.length > 2000 ? arr.slice(-2000) : arr));
      } catch { /* ignore */ }
    } catch (err) {
      if (!append) { setError('加载论文失败，请检查网络连接'); console.error('Feed error:', err); }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const handleRefreshPapers = useCallback(() => {
    seenIdsRef.current = new Set();
    loadPapers(1, false, true);
  }, []);

  useEffect(() => { loadPapers(1, false); }, [loadPapers]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!listEndRef.current || loading || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) {
          loadPapers(fetchPageRef.current + 1, true);
        }
      },
      { threshold: 0.1 }
    );
    observerRef.current.observe(listEndRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, allPapers.length, loadPapers]);

  const handlePaperDetail = (paper: Paper) => {
    addHistoryEntry(paper, 'saved');
    setSelectedPaper(paper);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await fetchFeed({ mode: 'search', query: searchQuery, maxResults: 20, translate: false });
      setSearchResults(results);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const handleClearAllData = () => {
    setAllPapers([]); setCurrentIndex(0); setSearchResults([]); clearImported();
    fetchPageRef.current = 1;
    loadPapers(1, false, true);
  };

  const handleShare = (paper: Paper | null) => {
    if (paper?.url) navigator.share?.({ title: paper.title, url: paper.url }).catch(() => {});
  };

  // Global translate: translate the currently viewed content in-place
  const handleTranslate = useCallback(async () => {
    const paper = selectedPaper || detailPaper;
    if (!paper) return;

    if (paper.isTranslated) {
      const restored = { ...paper, isTranslated: false };
      if (selectedPaper) setSelectedPaper(restored);
      if (detailPaper) setDetailPaper(restored);
      setAllPapers(prev => prev.map(p => p.id === paper.id ? { ...p, isTranslated: false } : p));
    } else {
      setTranslating(true);
      try {
        const result = await translatePaperContent(paper.title, paper.abstract);
        if (result.isTranslated) {
          const translated = {
            ...paper,
            translatedTitle: result.title,
            translatedAbstract: result.abstract,
            isTranslated: true,
            originalLanguage: result.originalLanguage,
          };
          if (selectedPaper) setSelectedPaper(translated);
          if (detailPaper) setDetailPaper(translated);
          setAllPapers(prev => prev.map(p => p.id === paper.id ? {
            ...p,
            translatedTitle: result.title,
            translatedAbstract: result.abstract,
            isTranslated: true,
          } : p));
        }
      } catch (e) {
        console.error('Translate error:', e);
      } finally {
        setTranslating(false);
      }
    }
  }, [selectedPaper, detailPaper]);

  const visiblePapers = currentIndex >= 0 && currentIndex < allPapers.length
    ? allPapers.slice(currentIndex, currentIndex + 4) : [];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'foryou', label: '推荐', icon: <FiHome className="w-5 h-5" /> },
    { id: 'papers', label: '论文', icon: <FiFileText className="w-5 h-5" /> },
    { id: 'library', label: '文库', icon: <FiBookOpen className="w-5 h-5" /> },
    { id: 'bookmarks', label: '收藏', icon: <FiBookmark className="w-5 h-5" /> },
    { id: 'settings', label: '设置', icon: <FiSettings className="w-5 h-5" /> },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--epis-bg)' }}>
      <AnimatePresence>{showSplash && <SplashScreen onDone={handleSplashDone} />}</AnimatePresence>

      <div className="flex items-center justify-between px-6 pt-6 pb-2 safe-top shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold" style={{ color: 'var(--epis-text)' }}>Epis</h1>
          {!isOnline && <span className="offline-dot" title="离线模式" />}
        </div>
        <div className="flex items-center gap-3">
<button
            onClick={handleTranslate}
            disabled={translating || (!selectedPaper && !detailPaper)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
            style={{
              background: (selectedPaper?.isTranslated || detailPaper?.isTranslated)
                ? 'rgba(16,185,129,0.15)' : 'var(--epis-surface)'
            }}
            title={(selectedPaper?.isTranslated || detailPaper?.isTranslated) ? '显示原文' : '翻译为中文'}
          >
            {translating ? (
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--epis-accent)', borderTopColor: 'transparent' }} />
            ) : (
              <span className="text-xs font-bold" style={{
                color: (selectedPaper?.isTranslated || detailPaper?.isTranslated) ? '#34d399' : 'var(--epis-text-muted)'
              }}>译</span>
            )}
          </button>
          <button onClick={() => setShowImport(true)} className="w-9 h-9 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--epis-surface)' }} title="导入论文"><FiUpload className="w-4 h-4" style={{ color: 'var(--epis-text-muted)' }} /></button>
          <button onClick={() => setShowSearch(true)} className="w-9 h-9 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--epis-surface)' }}><FiSearch className="w-4 h-4" style={{ color: 'var(--epis-text-muted)' }} /></button>
          <button onClick={() => setShowSourceManager(true)} className="w-9 h-9 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--epis-surface)' }}title="数据源管理"><FiGlobe className="w-4 h-4" style={{ color: 'var(--epis-text-muted)' }} /></button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {activeTab === 'foryou' && (
          <ForYouPage
            onPaperDetail={(p) => setDetailPaper(p)}
            onNewsDetail={(n) => setDetailNews(n)}
            onTheoryDetail={(t) => setDetailTheory(t)}
            onExcerptDetail={(e) => setDetailExcerpt(e)}
          />
        )}

        {activeTab === 'papers' && (
          <div className="h-full flex flex-col">
            <div className="px-6 pt-2 pb-2 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--epis-text)' }}>
                <FiFileText className="w-5 h-5" style={{ color: 'var(--epis-accent)' }} />论文
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--epis-text-muted)' }}>
                  {allPapers.length > 0 ? `${currentIndex + 1}/${allPapers.length}` : '0'}
                </span>
                <button onClick={handleRefreshPapers} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--epis-surface)' }}><FiRefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--epis-text-muted)' }} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--epis-accent)', borderTopColor: 'transparent' }} />
                    <span className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>加载论文...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4"><FiRefreshCw className="w-7 h-7 text-rose-400" /></div>
                  <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--epis-text)' }}>出错了</h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--epis-text-muted)' }}>{error}</p>
                  <button onClick={handleRefreshPapers} className="px-6 py-3 rounded-full font-medium transition-colors flex items-center gap-2" style={{ background: 'var(--epis-accent)', color: '#fff' }}><FiRefreshCw className="w-4 h-4" />重试</button>
                </div>
              ) : allPapers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--epis-text)' }}>暂无论文</h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--epis-text-muted)' }}>点击刷新获取最新论文</p>
                  <button onClick={handleRefreshPapers} className="px-6 py-3 rounded-full font-medium transition-colors" style={{ background: 'var(--epis-accent)', color: '#fff' }}>刷新</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {allPapers.map((paper, i) => (
                    <motion.div
                      key={paper.id}
                      className="p-4 rounded-2xl cursor-pointer transition-colors"
                      style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}
                      onClick={() => handlePaperDetail(paper)}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5) }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--epis-accent-soft)', color: 'var(--epis-accent)' }}>{paper.category}</span>
                            {paper.isTranslated && (
                              <span className="text-[10px]" style={{ color: '#34d399' }}>🤖 翻译</span>
                            )}
                            <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>{paper.year}</span>
                          </div>
                          <h4 className="font-medium text-sm leading-snug mb-1 line-clamp-2" style={{ color: 'var(--epis-text)' }}>
                            {paper.isTranslated && paper.translatedTitle ? paper.translatedTitle : paper.title}
                          </h4>
                          <p className="text-xs line-clamp-1 mb-1" style={{ color: 'var(--epis-text-muted)' }}>
                            {paper.authors.slice(0, 2).join(' · ')}{paper.authors.length > 2 && ' 等'}
                          </p>
                          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--epis-text-muted)' }}>
                            {paper.isTranslated && paper.translatedAbstract ? paper.translatedAbstract : paper.abstract}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBookmark(paper); }}
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                          style={{ background: isBookmarked(paper.id) ? 'rgba(16,185,129,0.15)' : 'var(--epis-surface)' }}
                        >
                          <FiBookmarkIcon className="w-4 h-4" style={{ color: isBookmarked(paper.id) ? '#34d399' : 'var(--epis-text-muted)' }} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={listEndRef} className="h-4" />
                  {loadingMore && (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--epis-accent)', borderTopColor: 'transparent' }} />
                      <span className="text-xs ml-2" style={{ color: 'var(--epis-text-muted)' }}>加载更多...</span>
                    </div>
                  )}
                  {!loadingMore && allPapers.length > 0 && (
                    <div className="text-center py-3">
                      <button
                        onClick={() => loadPapers(fetchPageRef.current + 1, true)}
                        className="text-xs px-4 py-2 rounded-full transition-colors"
                        style={{ background: 'var(--epis-surface)', color: 'var(--epis-accent)', border: '1px solid var(--epis-border)' }}
                      >
                        加载更多
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="h-full flex flex-col">
            <div className="px-6 pt-2 pb-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--epis-text)' }}><FiBookOpen className="w-5 h-5" style={{ color: 'var(--epis-accent)' }} />我的文库</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--epis-text-muted)' }}>{importedPapers.length === 0 ? '还没有导入论文' : `共 ${importedPapers.length} 篇`}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-colors" style={{ background: 'var(--epis-accent)', color: '#fff' }}><FiUpload className="w-3.5 h-3.5" /> 导入</button>
                {importedPapers.length > 0 && <button onClick={clearImported} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs transition-colors" style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}><FiTrash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {importedPapers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--epis-accent-soft)' }}><FiUpload className="w-7 h-7" style={{ color: 'var(--epis-accent)' }} /></div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--epis-text)' }}>文库为空</h3>
                  <p className="text-sm mb-6" style={{ color: 'var(--epis-text-muted)' }}>导入 PDF 或 DOCX 论文文件，即可开始阅读</p>
                  <button onClick={() => setShowImport(true)} className="px-6 py-3 rounded-full font-medium transition-colors flex items-center gap-2" style={{ background: 'var(--epis-accent)', color: '#fff' }}><FiUpload className="w-4 h-4" />导入论文</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {importedPapers.map((paper) => (
                    <motion.div key={paper.id} layout className="p-4 rounded-2xl cursor-pointer transition-colors" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }} onClick={() => setSelectedImported(paper)} whileTap={{ scale: 0.98 }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm leading-snug mb-1 line-clamp-2" style={{ color: 'var(--epis-text)' }}>{paper.isTranslated && paper.translatedTitle ? paper.translatedTitle : paper.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] mb-1" style={{ color: 'var(--epis-text-muted)' }}>
                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--epis-accent-soft)', color: 'var(--epis-accent)' }}>{paper.source.toUpperCase()}</span>
                            <span>{paper.fullText.length.toLocaleString()} 字符</span>
                            {paper.readingTime && <span><FiClock className="w-2.5 h-2.5 inline" /> {paper.readingTime} 分钟</span>}
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removePaper(paper.id); }} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: 'rgba(239,68,68,0.1)' }}><FiTrash2 className="w-4 h-4 text-rose-400" /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}{activeTab === 'bookmarks' && (
          <BookmarksPage
            bookmarks={bookmarks}
            onRemove={(id) => toggleBookmark(bookmarks.find(b => b.id === id)!)}
            onSelect={(paper) => handlePaperDetail(paper)}
            onClear={() => bookmarks.forEach(b => toggleBookmark(b))}
          />
        )}

        {activeTab === 'settings' && <SettingsPage isOpen={true} onClose={() => setActiveTab('foryou')} onClearAllData={handleClearAllData} />}

        <PaperDetail paper={selectedPaper} isOpen={!!selectedPaper} onClose={() => setSelectedPaper(null)}
          onToggleBookmark={() => { if (selectedPaper) toggleBookmark(selectedPaper); }}
          onShare={() => handleShare(selectedPaper)}
          isBookmarked={selectedPaper ? isBookmarked(selectedPaper.id) : false} />

        <PaperDetail paper={detailPaper} isOpen={!!detailPaper} onClose={() => setDetailPaper(null)}
          onToggleBookmark={() => { if (detailPaper) toggleBookmark(detailPaper); }}
          onShare={() => handleShare(detailPaper)}
          isBookmarked={detailPaper ? isBookmarked(detailPaper.id) : false} />

        <AnimatePresence>{selectedImported && <ImportedPaperDetail paper={selectedImported} onClose={() => setSelectedImported(null)} />}</AnimatePresence>
        <ImportPaperModal isOpen={showImport} onClose={() => setShowImport(false)} />

        <AnimatePresence>{detailNews && (
          <motion.div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'var(--epis-bg)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <button onClick={() => setDetailNews(null)} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--epis-surface)' }}><FiX className="w-5 h-5" style={{ color: 'var(--epis-text)' }} /></button>
              <a href={detailNews.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--epis-surface)' }}><FiExternalLink className="w-4 h-4" style={{ color: 'var(--epis-text-muted)' }} /></a>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-8">
              <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--epis-text)' }}>{detailNews.title}</h1>
              <p className="text-xs mb-6" style={{ color: 'var(--epis-text-muted)' }}>{detailNews.source} · {new Date(detailNews.publishedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--epis-text)' }}>{detailNews.content || detailNews.summary}</p>
            </div>
          </motion.div>
        )}</AnimatePresence>

        <AnimatePresence>{detailTheory && (
          <motion.div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'var(--epis-bg)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <button onClick={() => setDetailTheory(null)} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--epis-surface)' }}><FiX className="w-5 h-5" style={{ color: 'var(--epis-text)' }} /></button>
              <span className="text-xs" style={{ color: 'var(--epis-text-muted)' }}>{'⭐'.repeat(detailTheory.relevance)} 相关度 {detailTheory.relevance}/5</span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-8">
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--epis-text)' }}>{detailTheory.name}</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--epis-text-muted)' }}>主要学者：{detailTheory.thinkers.join('、')}</p>
              <div className="space-y-4">
                <div className="p-4 rounded-2xl" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}><h3 className="text-sm font-medium mb-2" style={{ color: 'var(--epis-accent)' }}>核心思想</h3><p className="text-sm leading-relaxed" style={{ color: 'var(--epis-text)' }}>{detailTheory.coreIdea}</p></div>
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid var(--epis-border)' }}><h3 className="text-sm font-medium mb-2" style={{ color: '#f59e0b' }}>在东欧研究中的应用</h3><p className="text-sm leading-relaxed" style={{ color: 'var(--epis-text)' }}>{detailTheory.application}</p></div>
              </div>
            </div>
          </motion.div>
        )}</AnimatePresence>

        <AnimatePresence>{detailExcerpt && (
          <motion.div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'var(--epis-bg)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <button onClick={() => setDetailExcerpt(null)} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ background: 'var(--epis-surface)' }}><FiX className="w-5 h-5" style={{ color: 'var(--epis-text)' }} /></button>
              <span className="text-xs" style={{ color: 'var(--epis-text-muted)' }}>✨ 精选片段</span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-8">
              <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--epis-text)' }}>{detailExcerpt.title}</h1>
              <p className="text-sm mb-2" style={{ color: 'var(--epis-text-muted)' }}>{detailExcerpt.authors.join(' · ')}</p>
              <p className="text-xs mb-6" style={{ color: 'var(--epis-text-muted)' }}>{detailExcerpt.source}</p>
              <div className="p-4 rounded-2xl mb-4" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}><h3 className="text-sm font-medium mb-2" style={{ color: 'var(--epis-accent)' }}>精选原文</h3><p className="text-sm leading-relaxed italic" style={{ color: 'var(--epis-text)' }}>"{detailExcerpt.excerpt}"</p></div>
              <div className="p-4 rounded-2xl" style={{ background: 'var(--epis-accent-soft)', border: '1px solid var(--epis-border)' }}><h3 className="text-sm font-medium mb-2" style={{ color: 'var(--epis-accent)' }}>核心洞见</h3><p className="text-sm leading-relaxed" style={{ color: 'var(--epis-text)' }}>{detailExcerpt.insight}</p></div>
            </div>
          </motion.div>
        )}</AnimatePresence>

        <AnimatePresence>{showSearch && (
          <motion.div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'var(--epis-bg)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}>
                  <FiSearch className="w-5 h-5" style={{ color: 'var(--epis-text-muted)' }} />
                  <input autoFocus type="text" placeholder="搜索论文标题、关键词..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--epis-text)' }} />
                </div>
                <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }} className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>取消</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {searching ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--epis-accent)', borderTopColor: 'transparent' }} /></div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((paper) => (
                    <motion.div key={paper.id} className="p-4 rounded-2xl cursor-pointer transition-colors" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }} onClick={() => { setSelectedPaper(paper); setShowSearch(false); }} whileTap={{ scale: 0.98 }}>
                      <h4 className="font-medium text-sm leading-snug mb-1 line-clamp-2" style={{ color: 'var(--epis-text)' }}>{paper.isTranslated && paper.translatedTitle ? paper.translatedTitle : paper.title}</h4>
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--epis-text-muted)' }}>{paper.authors.slice(0, 2).join(' · ')}{paper.authors.length > 2 && ' 等'} · {paper.year}</p>
                    </motion.div>
                  ))}
                </div>
              ) : searchQuery && !searching ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>按回车搜索</p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}</AnimatePresence>
      </div>

      {/* Bottom Tab Bar */}
      <div className="flex items-center justify-around px-4 py-2 safe-bottom shrink-0" style={{ background: 'var(--epis-surface)', borderTop: '1px solid var(--epis-border)' }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors relative"
            style={{ color: activeTab === tab.id ? 'var(--epis-accent)' : 'var(--epis-text-muted)' }}>
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div layoutId="tab-indicator" className="absolute -bottom-1 w-6 h-0.5 rounded-full" style={{ background: 'var(--epis-accent)' }} />
            )}
          </button>
        ))}
      </div>


    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}