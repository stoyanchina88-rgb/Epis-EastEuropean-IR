import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBookmark, FiTrash2, FiChevronRight, FiChevronUp, FiChevronDown, FiCheck, FiCheckSquare, FiSquare, FiX, FiAlertTriangle } from 'react-icons/fi';
import { Paper } from '../types';

interface BookmarksPageProps {
  bookmarks: Paper[];
  onRemove: (id: string) => void;
  onSelect: (paper: Paper) => void;
  onClear: () => void;
}

type SortKey = 'added' | 'year' | 'title' | 'citations';

interface ConfirmState {
  type: 'single' | 'multi' | 'clear';
  paperId?: string;
  count: number;
}

export default function BookmarksPage({ bookmarks, onRemove, onSelect, onClear }: BookmarksPageProps) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>('added');
  const [showSort, setShowSort] = useState(false);

  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    if (sortBy === 'year') return (b.year || 0) - (a.year || 0);
    if (sortBy === 'title') {
      const ta = (a.translatedTitle || a.title).toLowerCase();
      const tb = (b.translatedTitle || b.title).toLowerCase();
      return ta.localeCompare(tb);
    }
    if (sortBy === 'citations') return (b.citationCount || 0) - (a.citationCount || 0);
    return 0;
  });

  const isMultiMode = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === bookmarks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookmarks.map((p) => p.id)));
    }
  };

  const confirmRemove = () => {
    if (!confirm) return;
    if (confirm.type === 'single' && confirm.paperId) {
      onRemove(confirm.paperId);
    } else if (confirm.type === 'multi') {
      selectedIds.forEach((id) => onRemove(id));
      setSelectedIds(new Set());
    } else if (confirm.type === 'clear') {
      onClear();
    }
    setConfirm(null);
  };

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'added', label: '添加时间' },
    { key: 'year', label: '出版年份' },
    { key: 'title', label: '标题' },
    { key: 'citations', label: '引用次数' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2" style={{ color: 'var(--epis-text)' }}>
          <FiBookmark className="w-5 h-5" style={{ color: 'var(--epis-accent)' }} />
          收藏
          <span className="text-sm font-normal" style={{ color: 'var(--epis-text-muted)' }}>
            ({bookmarks.length})
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowSort(!showSort)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'var(--epis-surface)' }}
            >
              <div className="flex flex-col items-center">
                <FiChevronUp className="w-3 h-3" style={{ color: 'var(--epis-text-muted)' }} />
                <FiChevronDown className="w-3 h-3" style={{ color: 'var(--epis-text-muted)', marginTop: -3 }} />
              </div>
            </button>
            {showSort && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowSort(false)} />
                <div
                  className="absolute right-0 top-10 z-30 w-36 rounded-xl overflow-hidden shadow-xl"
                  style={{ background: 'var(--epis-card)', border: '1px solid var(--epis-border)' }}
                >
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortBy(opt.key); setShowSort(false); }}
                      className="w-full px-4 py-2.5 text-sm text-left flex items-center justify-between transition-colors hover:bg-white/5"
                      style={{
                        color: sortBy === opt.key ? 'var(--epis-accent)' : 'var(--epis-text)',
                        background: sortBy === opt.key ? 'rgba(99,102,241,0.08)' : undefined,
                      }}
                    >
                      {opt.label}
                      {sortBy === opt.key && <FiCheck className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {bookmarks.length > 0 && !isMultiMode && (
            <button
              onClick={() => setConfirm({ type: 'clear', count: bookmarks.length })}
              className="text-xs transition-colors flex items-center gap-1"
              style={{ color: '#f43f5e' }}
            >
              <FiTrash2 className="w-3 h-3" />
              清空
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isMultiMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div
              className="px-6 py-2 flex items-center justify-between"
              style={{
                background: 'rgba(99,102,241,0.08)',
                borderTop: '1px solid var(--epis-border)',
                borderBottom: '1px solid var(--epis-border)',
              }}
            >
              <button onClick={selectAll}
                className="flex items-center gap-2 text-xs font-medium"
                style={{ color: 'var(--epis-accent)' }}
              >
                {selectedIds.size === bookmarks.length ? <FiCheckSquare className="w-4 h-4" /> : <FiSquare className="w-4 h-4" />}
                {selectedIds.size === bookmarks.length ? '取消全选' : `全选（${bookmarks.length}篇）`}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--epis-text-muted)' }}>已选 {selectedIds.size} 篇</span>
                <button
                  onClick={() => setConfirm({ type: 'multi', count: selectedIds.size })}
                  className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors"
                  style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}
                >
                  <FiTrash2 className="w-3 h-3" />删除选中
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs p-1.5 rounded-full"
                  style={{ color: 'var(--epis-text-muted)' }}
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(16,185,129,0.1)' }}
            >
              <FiBookmark className="w-7 h-7" style={{ color: 'var(--epis-accent)' }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--epis-text)' }}>还没有收藏</h3>
            <p className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>
              上划论文卡片即可收藏感兴趣的论文
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedBookmarks.map((paper, i) => {
              const displayTitle = paper.isTranslated && paper.translatedTitle
                ? paper.translatedTitle
                : paper.title;
              const isSelected = selectedIds.has(paper.id);

              return (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  layout
                >
                  <div className="relative overflow-hidden rounded-2xl">
                    <motion.div
                      className="absolute inset-y-0 right-0 flex items-center justify-center cursor-pointer"
                      style={{ background: 'rgba(244,63,94,0.2)', width: 80 }}
                      onClick={() => setConfirm({ type: 'single', paperId: paper.id, count: 1 })}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <FiTrash2 className="w-5 h-5" style={{ color: '#f43f5e' }} />
                        <span className="text-xs" style={{ color: '#fb7185' }}>删除</span>
                      </div>
                    </motion.div>

                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -80, right: 0 }}
                      dragElastic={0.1}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -50) {
                          setConfirm({ type: 'single', paperId: paper.id, count: 1 });
                        }
                      }}
                      className="relative p-4 rounded-2xl transition-colors cursor-pointer"
                      style={{
                        background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--epis-card)',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--epis-accent)' : 'var(--epis-border)',
                      }}
                      onClick={() => {
                        if (isMultiMode) {
                          toggleSelect(paper.id);
                        } else {
                          onSelect(paper);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(paper.id); }}
                          className="shrink-0 mt-1"
                          style={{ color: isSelected ? 'var(--epis-accent)' : 'var(--epis-text-muted)' }}
                        >
                          {isSelected ? <FiCheckSquare className="w-4 h-4" /> : <FiSquare className="w-4 h-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm leading-snug mb-1 line-clamp-2" style={{ color: 'var(--epis-text)' }}>
                            {displayTitle}
                          </h4>
                          <p className="text-xs line-clamp-1 mb-1" style={{ color: 'var(--epis-text-muted)' }}>
                            {paper.authors.slice(0, 3).join(' · ')}
                            {paper.authors.length > 3 && ' 等'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--epis-text-muted)' }}>
                            <span>{paper.year}</span>
                            {paper.citationCount != null && (
                              <>
                                <span>·</span>
                                <span>
                                  {paper.citationCount >= 1000
                                    ? `${(paper.citationCount / 1000).toFixed(1)}k`
                                    : paper.citationCount} 引用
                                </span>
                              </>
                            )}
                            {paper.isTranslated && (
                              <>
                                <span>·</span>
                                <span style={{ color: 'rgba(52,211,153,0.6)' }}>翻译</span>
                              </>
                            )}
                          </div>
                        </div>

                        {!isMultiMode && (
                          <FiChevronRight className="shrink-0 mt-2 w-4 h-4" style={{ color: 'var(--epis-text-muted)' }} />
                        )}
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-8"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setConfirm(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full sm:max-w-sm mx-4 rounded-2xl overflow-hidden"
              style={{ background: 'var(--epis-card)', border: '1px solid var(--epis-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div
                  className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(244,63,94,0.15)' }}
                >
                  <FiAlertTriangle className="w-6 h-6" style={{ color: '#f43f5e' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--epis-text)' }}>确认删除</h3>
                <p className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>
                  {confirm.type === 'clear'
                    ? `将清空全部 ${confirm.count} 篇收藏论文，此操作不可撤销。`
                    : `将删除 ${confirm.count} 篇收藏论文，此操作不可撤销。`}
                </p>
              </div>
              <div className="flex border-t" style={{ borderColor: 'var(--epis-border)' }}>
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 py-4 text-center font-medium text-sm transition-colors hover:bg-white/5"
                >
                  取消
                </button>
                <button
                  onClick={confirmRemove}
                  className="flex-1 py-4 text-center font-medium text-sm transition-colors"
                  style={{ color: '#f43f5e' }}
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}