import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiBookmark, FiBookOpen, FiChevronDown, FiChevronUp, FiCopy, FiCheck, FiGlobe, FiMessageCircle, FiClock, FiFileText } from 'react-icons/fi';
import { ImportedPaper, ReadingBookmark } from '../types';
import { useImportedPapers } from '../hooks/useImportedPapers';
import { getLanguageLabel, detectLanguage } from '../api/fileParser';
import { translatePaperContent } from '../api/translation';

interface ImportedPaperDetailProps {
  paper: ImportedPaper;
  onClose: () => void;
}

export default function ImportedPaperDetail({ paper, onClose }: ImportedPaperDetailProps) {
  const { updatePaper } = useImportedPapers();
  const [scrollProgress, setScrollProgress] = useState(paper.readingProgress);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState(paper.translatedFullText || '');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<ReadingBookmark[]>(paper.bookmarks || []);
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const [copied, setCopied] = useState(false);
  const [startTime] = useState(Date.now());
  const contentRef = useRef<HTMLDivElement>(null);
  const readingTimeRef = useRef(0);

  // Track scroll progress
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const progress = Math.min(100, Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100));
    setScrollProgress(progress);
  }, []);

  // Save progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      readingTimeRef.current += 5;
      updatePaper(paper.id, {
        readingProgress: scrollProgress,
        readingTime: readingTimeRef.current,
        bookmarks,
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [paper.id, scrollProgress, bookmarks, updatePaper]);

  // Save on unmount
  useEffect(() => {
    return () => {
      updatePaper(paper.id, {
        readingProgress: scrollProgress,
        readingTime: readingTimeRef.current + Math.round((Date.now() - startTime) / 1000),
        bookmarks,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTranslate = async () => {
    if (translating || translatedText) return;
    setTranslating(true);
    try {
      const result = await translatePaperContent(paper.title, paper.fullText.slice(0, 3000));
      setTranslatedText(result.abstract);
      setShowTranslation(true);
      updatePaper(paper.id, {
        isTranslated: true,
        translatedTitle: result.title,
        translatedFullText: result.abstract,
        originalLanguage: result.originalLanguage,
      });
    } catch {
      updatePaper(paper.id, { translationFailed: true });
    } finally {
      setTranslating(false);
    }
  };

  const addBookmark = () => {
    const el = contentRef.current;
    if (!el) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    const position = el.scrollTop;

    const bookmark: ReadingBookmark = {
      id: `bm-${Date.now()}`,
      text: selectedText || paper.fullText.slice(Math.max(0, position), position + 100),
      position,
      createdAt: Date.now(),
    };

    const updated = [...bookmarks, bookmark];
    setBookmarks(updated);
    updatePaper(paper.id, { bookmarks: updated });
  };

  const removeBookmark = (id: string) => {
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
    updatePaper(paper.id, { bookmarks: updated });
  };

  const jumpToBookmark = (pos: number) => {
    contentRef.current?.scrollTo({ top: pos, behavior: 'smooth' });
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(showTranslation && translatedText ? translatedText : paper.fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const displayText = showTranslation && translatedText ? translatedText : paper.fullText;
  const lang = paper.language || detectLanguage(paper.fullText);
  const needsTranslation = lang !== 'zh';
  const readingTime = paper.readingTime || Math.max(1, Math.round(paper.fullText.split(/\s+/).length / 250));

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: 'var(--epis-bg)' }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3" style={{ borderBottom: '1px solid var(--epis-border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'var(--epis-surface)' }}>
            <FiX className="w-5 h-5" style={{ color: 'var(--epis-text)' }} />
          </button>
          <div>
            <span className="text-xs font-medium" style={{ color: 'var(--epis-accent)' }}>
              {paper.source.toUpperCase()} · {getLanguageLabel(lang)}
            </span>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>
              <FiClock className="w-3 h-3" /> {readingTime} 分钟
              <FiFileText className="w-3 h-3 ml-1" /> {paper.fullText.length.toLocaleString()} 字符
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopyText} className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--epis-surface)' }}>
            {copied ? <FiCheck className="w-4 h-4 text-emerald-400" /> : <FiCopy className="w-4 h-4" style={{ color: 'var(--epis-text-muted)' }} />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full" style={{ background: 'var(--epis-border)' }}>
        <div className="h-full transition-all duration-300" style={{ width: `${scrollProgress}%`, background: 'var(--epis-accent)' }} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-2 overflow-x-auto" style={{ borderBottom: '1px solid var(--epis-border)' }}>
        <button onClick={() => setShowKeyPoints(!showKeyPoints)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors"
          style={{ background: showKeyPoints ? 'var(--epis-accent-soft)' : 'var(--epis-surface)', color: showKeyPoints ? 'var(--epis-accent)' : 'var(--epis-text-muted)' }}>
          <FiMessageCircle className="w-3 h-3" /> 要点
        </button>
        {needsTranslation && (
          <button onClick={handleTranslate} disabled={translating}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors"
            style={{
              background: showTranslation ? 'rgba(16,185,129,0.15)' : 'var(--epis-surface)',
              color: showTranslation ? '#34d399' : 'var(--epis-text-muted)',
            }}>
            <FiGlobe className="w-3 h-3" /> {translating ? '翻译中...' : showTranslation ? '原文' : '翻译'}
          </button>
        )}
        {showTranslation && translatedText && (
          <button onClick={() => setShowTranslation(!showTranslation)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
            🤖 机器翻译
          </button>
        )}
        <button onClick={addBookmark}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors"
          style={{ background: 'var(--epis-surface)', color: 'var(--epis-text-muted)' }}>
          <FiBookmark className="w-3 h-3" /> 标记
        </button>
        <button onClick={() => setShowBookmarks(!showBookmarks)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors"
          style={{ background: showBookmarks ? 'rgba(245,158,11,0.15)' : 'var(--epis-surface)', color: showBookmarks ? '#f59e0b' : 'var(--epis-text-muted)' }}>
          <FiBookOpen className="w-3 h-3" /> 书签 ({bookmarks.length})
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div ref={contentRef} onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4">
          {/* Title */}
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--epis-text)' }}>
            {showTranslation && paper.translatedTitle ? paper.translatedTitle : paper.title}
          </h1>
          {showTranslation && paper.translatedTitle && (
            <p className="text-xs italic mb-4" style={{ color: 'var(--epis-text-muted)' }}>原文标题：{paper.title}</p>
          )}

          {/* Key points panel (inline) */}
          {showKeyPoints && paper.keyPoints.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="overflow-hidden mb-4">
              <div className="p-4 rounded-2xl" style={{ background: 'var(--epis-accent-soft)', border: '1px solid var(--epis-border)' }}>
                <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--epis-accent)' }}>📌 关键要点</h3>
                <ul className="space-y-2">
                  {paper.keyPoints.map((point, i) => (
                    <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: 'var(--epis-text)' }}>
                      <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                        style={{ background: 'var(--epis-accent-soft)', color: 'var(--epis-accent)' }}>{i + 1}</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* AI Summary */}
          {paper.aiSummary && (
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid var(--epis-border)' }}>
              <h3 className="text-[10px] font-medium mb-1" style={{ color: '#f59e0b' }}>💡 AI 摘要</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--epis-text)' }}>{paper.aiSummary}</p>
            </div>
          )}

          {/* Bookmarks section */}
          {showBookmarks && bookmarks.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="overflow-hidden mb-4">
              <div className="p-3 rounded-2xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid var(--epis-border)' }}>
                <h3 className="text-xs font-medium mb-2" style={{ color: '#f59e0b' }}>🔖 书签</h3>
                <div className="space-y-1.5">
                  {bookmarks.map((bm) => (
                    <div key={bm.id} className="flex items-start gap-2 p-2 rounded-lg cursor-pointer"
                      style={{ background: 'var(--epis-surface)' }}
                      onClick={() => jumpToBookmark(bm.position)}>
                      <p className="text-[10px] leading-relaxed flex-1 line-clamp-2" style={{ color: 'var(--epis-text)' }}>
                        {bm.text}
                      </p>
                      <button onClick={(e) => { e.stopPropagation(); removeBookmark(bm.id); }}
                        className="shrink-0 text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Full text */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap space-y-2" style={{ color: 'var(--epis-text)' }}>
            {displayText.split('\n').map((para, i) => (
              <p key={i}>{para || '\u00A0'}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom reading progress indicator */}
      <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: '1px solid var(--epis-border)', background: 'var(--epis-card)' }}>
        <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>
          阅读进度 {scrollProgress}%
        </span>
        <div className="flex gap-2 text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>
          <span>📌 {bookmarks.length} 个书签</span>
          <span>⏱ {readingTime} 分钟</span>
        </div>
      </div>
    </motion.div>
  );
}