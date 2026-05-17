import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiBookmark, FiShare2, FiExternalLink, FiAward, FiGlobe, FiCalendar,
  FiUser, FiHash, FiBookOpen, FiMessageCircle, FiStar, FiCpu,
} from 'react-icons/fi';
import { Paper, PaperCommentary } from '../types';
import { fetchAICommentary, generateFallbackCommentary } from '../api/aiCommentary';

interface PaperDetailProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onShare: () => void;
  onExport?: () => void;
}

function getLanguageLabel(lang?: string): string {
  const labels: Record<string, string> = {
    en: 'English', ru: 'Русский', zh: '中文', fr: 'Français', de: 'Deutsch', es: 'Español',
  };
  return lang ? labels[lang] || lang : '';
}

const s = (colorVar: string, fallback?: string) => ({ color: `var(${colorVar})` as string, ...(fallback ? { fallback } : {}) });

export default function PaperDetail({
  paper, isOpen, onClose, isBookmarked, onToggleBookmark, onShare, onExport,
}: PaperDetailProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiCommentary, setAiCommentary] = useState(null);

  const handleAIAnalysis = async () => {
    if (aiCommentary || !paper) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await fetchAICommentary(paper);
      setAiCommentary(result);
    } catch (e) {
      setAiCommentary(generateFallbackCommentary(paper));
      setAiError(e.message || 'AI analysis error, using fallback');
    } finally {
      setAiLoading(false);
    }
  };

  const previousPaperIdRef = useRef<string | null>(null);

  // Reset AI state when paper changes
  useEffect(() => {
    if (paper && paper.id !== previousPaperIdRef.current) {
      setAiCommentary(null);
      setAiError(null);
      setAiLoading(false);
      previousPaperIdRef.current = paper.id;
    }
  }, [paper]);

  if (!paper) return null;


  const displayTitle = paper.isTranslated && paper.translatedTitle ? paper.translatedTitle : paper.title;
  const displayAbstract = paper.isTranslated && paper.translatedAbstract ? paper.translatedAbstract : paper.abstract;
  const keywords = paper.isTranslated && paper.translatedKeywords ? paper.translatedKeywords : paper.keywords;

  const formatCitation = (count?: number) => {
    if (!count) return '';
    return count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k` : count.toString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col"
          style={{ background: 'var(--epis-bg)' }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <button onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'var(--epis-surface)' }}>
              <FiX className="w-5 h-5" style={{ color: 'var(--epis-text)' }} />
            </button>
            <div className="flex items-center gap-3">
                <button
                onClick={handleAIAnalysis}
                disabled={aiLoading || !!aiCommentary}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                style={{
                  background: aiCommentary ? 'rgba(99,102,241,0.2)' : aiLoading ? 'rgba(99,102,241,0.1)' : 'var(--epis-surface)',
                  color: aiCommentary ? '#818cf8' : aiLoading ? '#818cf8' : 'var(--epis-text-muted)',
                }}
                title={aiCommentary ? 'AI analysis ready' : aiLoading ? 'Analyzing...' : 'AI paper analysis'}
              >
                {aiLoading ? (
                  <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#818cf8' }} />
                ) : (
                  <FiCpu className="w-4 h-4" />
                )}
              </button>
              <button onClick={onToggleBookmark}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{
                  background: isBookmarked ? 'rgba(52,211,153,0.2)' : 'var(--epis-surface)',
                  color: isBookmarked ? '#34d399' : 'var(--epis-text-muted)'
                }}>
                <FiBookmark className="w-5 h-5" />
              </button>
              <button onClick={onShare}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'var(--epis-surface)', color: 'var(--epis-text-muted)' }}>
                <FiShare2 className="w-5 h-5" />
              </button>
              <button onClick={onExport}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'var(--epis-surface)', color: 'var(--epis-text-muted)' }}>
                <FiBookOpen className="w-5 h-5" />
              </button>
              <a href={paper.url} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'var(--epis-surface)', color: 'var(--epis-text-muted)' }}>
                <FiExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-8">
            {/* Tags */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="tag-pill" style={{ background: 'var(--epis-accent-soft)', color: 'var(--epis-accent)', border: '1px solid var(--epis-border)' }}>{paper.category}</span>
              {paper.citationCount && (
                <span className="tag-pill flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid var(--epis-border)' }}>
                  <FiAward className="w-3 h-3" />{formatCitation(paper.citationCount)} 引用
                </span>
              )}
              {paper.isTranslated && (
                <span className="tag-pill flex items-center gap-1" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid var(--epis-border)' }}
                  title={`原文：${getLanguageLabel(paper.language)}`}>
                  <FiGlobe className="w-3 h-3" />🤖 机器翻译
                </span>
              )}
              {paper.language && (
                <span className="tag-pill flex items-center gap-1" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid var(--epis-border)' }}>
                  <FiGlobe className="w-3 h-3" />{getLanguageLabel(paper.language)}
                </span>
              )}
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs mb-4" style={{ color: 'var(--epis-text-muted)' }}>
              {paper.journal && <span className="flex items-center gap-1"><FiHash className="w-3 h-3" />{paper.journal}</span>}
              <span className="flex items-center gap-1"><FiCalendar className="w-3 h-3" />{paper.year}</span>
              <span className="flex items-center gap-1"><FiUser className="w-3 h-3" />{paper.authors.length} 位作者</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold leading-tight mb-3" style={{ color: 'var(--epis-text)' }}>{displayTitle}</h1>
            {paper.isTranslated && paper.translatedTitle && paper.title !== paper.translatedTitle && (
              <p className="text-xs italic mb-4" style={{ color: 'var(--epis-text-muted)' }}>原文：{paper.title}</p>
            )}

            {/* Authors */}
            <div className="mb-6">
              <h3 className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--epis-text-muted)' }}>作者</h3>
              <div className="flex flex-wrap gap-2">
                {paper.authors.map((author, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm"
                    style={{ background: 'var(--epis-surface)', color: 'var(--epis-text)' }}>{author}</span>
                ))}
              </div>
            </div>

            {/* Abstract */}
            <div className="mb-6">
              <h3 className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--epis-text-muted)' }}>
                摘要{paper.isTranslated && <span className="ml-2 font-normal" style={{ color: 'var(--epis-accent)' }}>(机器翻译)</span>}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--epis-text)' }}>{displayAbstract}</p>
            </div>

            {paper.isTranslated && paper.translatedAbstract && paper.abstract !== paper.translatedAbstract && (
              <div className="mb-6">
                <h3 className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--epis-text-muted)' }}>
                  原文摘要 ({getLanguageLabel(paper.language)})
                </h3>
                <p className="text-sm leading-relaxed italic" style={{ color: 'var(--epis-text-muted)' }}>{paper.abstract}</p>
              </div>
            )}

            {/* Keywords (translated) */}
            {keywords && keywords.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--epis-text-muted)' }}>关键词</h3>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw) => (
                    <span key={kw} className="px-3 py-1 rounded-full text-sm"
                      style={{ background: 'var(--epis-surface)', color: 'var(--epis-text-muted)' }}>#{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Commentary */}
            {(aiLoading || aiCommentary) && (
              <div className="mb-6">
                <h3 className="text-xs font-medium mb-2 uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--epis-text-muted)' }}>
                  <FiCpu className="w-3 h-3" style={{ color: 'var(--epis-accent)' }} /> AI 论文点评
                  <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--epis-text-muted)' }}>
                    &middot; DeepSeek-R1
                  </span>
                </h3>
                {aiLoading && (
                  <div className="p-6 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--epis-accent-soft)', border: '1px solid var(--epis-border)' }}>
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
                        style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#818cf8' }} />
                      <span className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>AI 正在分析论文...</span>
                    </div>
                  </div>
                )}
                {aiError && (
                  <div className="p-3 rounded-xl text-xs flex items-center gap-2 mb-3"
                    style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#f87171' }}>
                    {aiError}
                    <button onClick={handleAIAnalysis} className="ml-auto text-xs underline">重试</button>
                  </div>
                )}
                {aiCommentary && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--epis-accent-soft)', border: '1px solid var(--epis-border)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--epis-accent-soft)' }}>
                          <FiMessageCircle className="w-4 h-4" style={{ color: 'var(--epis-accent)' }} />
                        </div>
                        <div>
                          <span className="text-xs font-medium" style={{ color: 'var(--epis-accent)' }}>论文概要</span>
                          <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--epis-text)' }}>{aiCommentary.summary}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid var(--epis-border)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.1)' }}>
                          <FiAward className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>核心创新点</span>
                          <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--epis-text)' }}>{aiCommentary.innovation}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid var(--epis-border)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                          <FiStar className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <span className="text-xs font-medium" style={{ color: '#3b82f6' }}>研究意义</span>
                          <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--epis-text)' }}>{aiCommentary.significance}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid var(--epis-border)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.1)' }}>
                          <FiBookmark className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <span className="text-xs font-medium" style={{ color: '#34d399' }}>推荐阅读人群</span>
                          <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--epis-text)' }}>{aiCommentary.audience}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {paper.commentary && (
              <div className="mb-6">
                <h3 className="text-xs font-medium mb-2 uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--epis-text-muted)' }}>
                  <FiMessageCircle className="w-3 h-3" style={{ color: 'var(--epis-accent)' }} /> AI 论文点评
                </h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl" style={{ background: 'var(--epis-accent-soft)', border: '1px solid var(--epis-border)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--epis-accent-soft)' }}>
                        <FiMessageCircle className="w-4 h-4" style={{ color: 'var(--epis-accent)' }} />
                      </div>
                      <div>
                        <span className="text-xs font-medium" style={{ color: 'var(--epis-accent)' }}>论文概要</span>
                        <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--epis-text)' }}>{paper.commentary.summary}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid var(--epis-border)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.1)' }}>
                        <FiAward className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>核心创新点</span>
                        <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--epis-text)' }}>{paper.commentary.innovation}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid var(--epis-border)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                        <FiStar className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <span className="text-xs font-medium" style={{ color: '#3b82f6' }}>研究意义</span>
                        <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--epis-text)' }}>{paper.commentary.significance}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid var(--epis-border)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.1)' }}>
                        <FiBookmark className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-xs font-medium" style={{ color: '#34d399' }}>推荐阅读人群</span>
                        <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--epis-text)' }}>{paper.commentary.audience}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Source links */}
            <div className="mb-6">
              <h3 className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--epis-text-muted)' }}>来源</h3>
              <div className="space-y-2">
                <a href={paper.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm transition-colors"
                  style={{ color: 'var(--epis-accent)' }}>
                  <FiExternalLink className="w-4 h-4" />查看原文
                </a>
                {paper.doi && (
                  <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm transition-colors"
                    style={{ color: 'var(--epis-accent)' }}>
                    <FiExternalLink className="w-4 h-4" />DOI: {paper.doi}
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}