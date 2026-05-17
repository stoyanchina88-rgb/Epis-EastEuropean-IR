import { motion } from 'framer-motion';
import { FiClock, FiTrash2, FiBookmark, FiChevronRight, FiArrowDown } from 'react-icons/fi';
import { HistoryEntry } from '../hooks/useHistory';
import { Paper } from '../types';

interface HistoryPageProps {
  history: HistoryEntry[];
  onClear: () => void;
  onSelect: (paper: Paper) => void;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function HistoryPage({ history, onClear, onSelect }: HistoryPageProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FiClock className="w-5 h-5 text-blue-400" />
          历史
          <span className="text-sm font-normal text-epis-text-muted">
            ({history.length})
          </span>
        </h2>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="text-rose-400 text-xs hover:text-rose-300 transition-colors flex items-center gap-1"
          >
            <FiTrash2 className="w-3 h-3" />
            清空
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <FiClock className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">暂无浏览记录</h3>
            <p className="text-epis-text-muted text-sm">
              浏览论文后，记录会显示在这里
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry, i) => {
              const paper = entry.paper;
              const displayTitle = paper.isTranslated && paper.translatedTitle
                ? paper.translatedTitle
                : paper.title;

              return (
                <motion.div
                  key={`${paper.id}-${entry.timestamp}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  onClick={() => onSelect(paper)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            entry.action === 'saved'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {entry.action === 'saved' ? (
                            <><FiBookmark className="w-2.5 h-2.5" /> 已收藏</>
                          ) : (
                            <><FiArrowDown className="w-2.5 h-2.5" /> 已跳过</>
                          )}
                        </span>
                        <span className="text-epis-text-muted text-[10px]">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <h4 className="text-white font-medium text-sm leading-snug mb-1 line-clamp-2">
                        {displayTitle}
                      </h4>
                      <p className="text-epis-text-muted text-xs line-clamp-1">
                        {paper.authors.slice(0, 2).join(' · ')}
                        {paper.authors.length > 2 && ' 等'}
                        {' · '}{paper.year}
                      </p>
                    </div>
                    <FiChevronRight className="shrink-0 w-4 h-4 text-epis-text-muted/30 mt-1" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}