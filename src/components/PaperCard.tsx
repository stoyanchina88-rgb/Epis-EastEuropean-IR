import { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { FiBookmark, FiShare2, FiExternalLink, FiChevronUp, FiChevronDown, FiAward, FiGlobe, FiMessageCircle } from 'react-icons/fi';
import { Paper } from '../types';

interface PaperCardProps {
  paper: Paper;
  index: number;
  total: number;
  onSwipe: (direction: 'up' | 'down') => void;
  onBookmark?: (paper: Paper) => void;
  onDetail?: (paper: Paper) => void;
  isBookmarked?: boolean;
}

function getLanguageLabel(lang?: string): string {
  const labels: Record<string, string> = {
    en: 'English', ru: 'Русский', zh: '中文', fr: 'Français', de: 'Deutsch', es: 'Español',
  };
  return lang ? labels[lang] || lang : '';
}

export default function PaperCard({
  paper, index, total, onSwipe, onBookmark, onDetail, isBookmarked = false,
}: PaperCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const [exitY, setExitY] = useState(0);
  const [exitX, setExitX] = useState(0);
  const [showCopied, setShowCopied] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-10, 0, 10]);
  const dragOpacity = useTransform(y, [-300, -100, 0, 100, 300], [0.8, 1, 1, 1, 0.8]);

  const stackScale = 1 - index * 0.05;
  const stackY = index * 12;
  const stackOpacity = 1 - index * 0.2;
  const isTop = index === 0;

  const displayTitle = paper.isTranslated && paper.translatedTitle ? paper.translatedTitle : paper.title;
  const displayAbstract = paper.isTranslated && paper.translatedAbstract ? paper.translatedAbstract : paper.abstract;
  const keywords = paper.isTranslated && paper.translatedKeywords ? paper.translatedKeywords : paper.keywords;

  const handleDragEnd = (_: any, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
    const threshold = 120;
    const yVelocity = Math.abs(info.velocity.y);
    if (info.offset.y < -threshold || (info.offset.y < -60 && yVelocity > 500)) {
      setExitY(-500); setExitX(info.offset.x);
      setTimeout(() => onSwipe('up'), 100);
    } else if (info.offset.y > threshold || (info.offset.y > 60 && yVelocity > 500)) {
      setExitY(500); setExitX(info.offset.x);
      setTimeout(() => onSwipe('down'), 100);
    }
  };

  const handleShare = async () => {
    const shareData = { title: displayTitle, text: `${displayTitle} — ${paper.authors[0]} 等`, url: paper.url };
    if (navigator.share) { try { await navigator.share(shareData); } catch {} }
    else { try { await navigator.clipboard.writeText(paper.url); setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); } catch {} }
  };

  const formatCitation = (count?: number) => {
    if (!count) return null;
    return count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k` : count.toString();
  };

  const truncateText = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  };

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 flex items-center justify-center p-4"
        style={{ zIndex: total - index, scale: stackScale, y: stackY, opacity: stackOpacity }}
        animate={{ scale: stackScale, y: stackY, opacity: stackOpacity }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <motion.div
          className="relative w-full max-w-md h-[85vh] max-h-[700px] rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            x: isTop ? x : 0, y: isTop ? y : 0,
            rotate: isTop ? rotate : 0, opacity: isTop ? dragOpacity : 1,
            background: 'var(--epis-card)',
            border: '1px solid var(--epis-border)',
          }}
          drag={isTop}
          dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          exit={{ x: exitX, y: exitY, opacity: 0, scale: 0.85, transition: { duration: 0.3 } }}
          onTap={() => isTop && onDetail?.(paper)}
        >
          <div className="absolute inset-0 rounded-3xl" style={{ background: 'linear-gradient(to bottom, var(--epis-card), var(--epis-bg))' }} />

          {/* Swipe indicators */}
          {isTop && (
            <>
              <motion.div className="absolute top-8 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full glass text-emerald-400"
                style={{ opacity: useTransform(y, [0, -100], [0, 1]) }}>
                <FiBookmark className="w-4 h-4" /><span className="text-sm font-medium">收藏</span>
              </motion.div>
              <motion.div className="absolute top-8 right-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full glass text-rose-400"
                style={{ opacity: useTransform(y, [0, 100], [0, 1]) }}>
                <FiChevronDown className="w-4 h-4" /><span className="text-sm font-medium">跳过</span>
              </motion.div>
            </>
          )}

          <AnimatePresence>
            {showCopied && (
              <motion.div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full glass text-emerald-400 text-sm"
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                链接已复制
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative z-10 h-full flex flex-col p-6">
            {/* Tags */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="tag-pill" style={{ background: 'var(--epis-accent-soft)', color: 'var(--epis-accent)', border: '1px solid var(--epis-border)' }}>{paper.category}</span>
              {paper.citationCount && (
                <span className="tag-pill flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid var(--epis-border)' }}>
                  <FiAward className="w-3 h-3" />{formatCitation(paper.citationCount)} 引用
                </span>
              )}
              {paper.isTranslated && (
                <span className="tag-pill flex items-center gap-1" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid var(--epis-border)' }}
                  title={`原文：${getLanguageLabel(paper.language)}`}>
                  <FiGlobe className="w-3 h-3" />🤖 机器翻译
                </span>
              )}
              {paper.translationFailed && (
                <span className="tag-pill flex items-center gap-1" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid var(--epis-border)' }}>
                  ⚠️ 翻译暂不可用
                </span>
              )}
              {!paper.isTranslated && !paper.translationFailed && paper.language && paper.language !== 'zh' && (
                <span className="tag-pill flex items-center gap-1" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid var(--epis-border)' }}>
                  <FiGlobe className="w-3 h-3" />{getLanguageLabel(paper.language)}
                </span>
              )}
            </div>

            {/* Journal / Year */}
            <div className="text-xs mb-3" style={{ color: 'var(--epis-text-muted)' }}>{paper.journal} · {paper.year}</div>

            {/* Title */}
            <h2 className="text-xl font-bold leading-tight mb-3 line-clamp-3" style={{ color: 'var(--epis-text)' }}>{displayTitle}</h2>
            {paper.isTranslated && paper.translatedTitle && paper.title !== paper.translatedTitle && (
              <p className="text-xs italic mb-1" style={{ color: 'var(--epis-text-muted)' }}>原文：{paper.title}</p>
            )}

            {/* Authors */}
            <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--epis-text-muted)' }}>{paper.authors.join(' · ')}</p>

            {/* Abstract */}
            <div className="flex-1 overflow-hidden">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--epis-text)' }}>
                {isExpanded ? displayAbstract : truncateText(displayAbstract, 180)}
              </p>
              {displayAbstract.length > 180 && (
                <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                  className="text-xs mt-2 transition-colors" style={{ color: 'var(--epis-accent)' }}>
                  {isExpanded ? '收起' : '展开全文'}
                </button>
              )}
            </div>

            {/* Keywords (translated) */}
            {keywords && keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {keywords.slice(0, 5).map((kw) => (
                  <span key={kw} className="px-2 py-0.5 rounded-md text-xs" style={{ background: 'var(--epis-surface)', color: 'var(--epis-text-muted)' }}>
                    #{kw}
                  </span>
                ))}
              </div>
            )}

            {/* AI Commentary badge */}
            {paper.commentary && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowCommentary(!showCommentary); }}
                className="mt-2 flex items-center gap-1 text-[10px] transition-colors" style={{ color: 'var(--epis-accent)' }}
              >
                <FiMessageCircle className="w-3 h-3" />
                {showCommentary ? '收起 AI 点评' : '查看 AI 点评'}
              </button>
            )}

            {/* Commentary preview */}
            <AnimatePresence>
              {showCommentary && paper.commentary && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 rounded-xl space-y-2" style={{ background: 'var(--epis-accent-soft)', border: '1px solid var(--epis-border)' }}>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--epis-text-muted)' }}>
                      <span style={{ color: 'var(--epis-accent)' }}>💡 概要：</span>{paper.commentary.summary}
                    </p>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--epis-text-muted)' }}>
                      <span style={{ color: 'var(--epis-accent)' }}>✨ 创新：</span>{paper.commentary.innovation}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center justify-around mt-4 pt-4" style={{ borderTop: '1px solid var(--epis-border)' }}>
              <button onClick={(e) => { e.stopPropagation(); onSwipe('down'); }}
                className="flex flex-col items-center gap-1 group">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-rose-400" style={{ background: 'var(--epis-surface)' }}>
                  <FiChevronDown className="w-5 h-5" />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>跳过</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); onBookmark?.(paper); }}
                className="flex flex-col items-center gap-1 group">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isBookmarked ? 'bg-emerald-500/20 text-emerald-400' : ''
                }`} style={{ background: isBookmarked ? undefined : 'var(--epis-surface)' }}>
                  <FiBookmark className="w-5 h-5" style={{ color: isBookmarked ? '#34d399' : 'var(--epis-text-muted)' }} />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>{isBookmarked ? '已收藏' : '收藏'}</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleShare(); }}
                className="flex flex-col items-center gap-1 group">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--epis-surface)' }}>
                  <FiShare2 className="w-5 h-5" style={{ color: 'var(--epis-text-muted)' }} />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>分享</span>
              </button>
              <a href={paper.url} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--epis-surface)' }}>
                  <FiExternalLink className="w-5 h-5" style={{ color: 'var(--epis-text-muted)' }} />
                </div>
                <span className="text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>原文</span>
              </a>
            </div>
          </div>

          <div className="absolute top-4 right-4 z-20 text-xs" style={{ color: 'var(--epis-text-muted)' }}>
            {total - index}/{total}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}