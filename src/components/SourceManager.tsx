import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiLock, FiExternalLink, FiInfo, FiSettings, FiSearch } from 'react-icons/fi';
import { DataSource } from '../types';

const AVAILABLE_SOURCES: DataSource[] = [
  {
    id: 'openalex',
    name: 'OpenAlex',
    type: 'free',
    status: 'connected',
    description: '开放学术图谱，覆盖2.5亿+学术作品，免费无限制',
    icon: '🔓',
  },
  {
    id: 'semantic-scholar',
    name: 'Semantic Scholar',
    type: 'free',
    status: 'connected',
    description: 'AI驱动的学术搜索引擎，2亿+论文，免费API',
    icon: '🧠',
  },
  {
    id: 'crossref',
    name: 'CrossRef',
    type: 'free',
    status: 'connected',
    description: '学术DOI注册机构，1.5亿+文献元数据',
    icon: '🔗',
  },
  {
    id: 'cnki',
    name: '中国知网 (CNKI)',
    type: 'login',
    status: 'disconnected',
    description: '中国最大的学术文献数据库。需在浏览器中手动搜索后导入',
    icon: '🇨🇳',
  },
  {
    id: 'web',
    name: '互联网资料',
    type: 'login',
    status: 'disconnected',
    description: '通过浏览器搜索获取公开学术资料和报告',
    icon: '🌐',
  },
];

const LOCAL_KEY = 'epis-source-keys';

interface SourceManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SourceManager({ isOpen, onClose }: SourceManagerProps) {
  const [sources] = useState<DataSource[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      return AVAILABLE_SOURCES.map((s) => {
        if (s.type === 'apikey' && saved[s.id]) {
          return { ...s, status: 'connected' as const };
        }
        return s;
      });
    } catch {
      return AVAILABLE_SOURCES;
    }
  });
  const [showGuidance, setShowGuidance] = useState<string | null>(null);

  const handleConfigure = (sourceId: string) => {
    setShowGuidance(showGuidance === sourceId ? null : sourceId);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col"
          style={{ background: 'var(--epis-bg)', backdropFilter: 'blur(24px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--epis-text)' }}>
              <FiSettings className="w-5 h-5" style={{ color: 'var(--epis-accent)' }} />
              数据源管理
            </h2>
            <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors" style={{ background: 'var(--epis-surface)' }}>
              <FiX className="w-5 h-5" style={{ color: 'var(--epis-text)' }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-8">
            <p className="text-sm mb-6" style={{ color: 'var(--epis-text-muted)' }}>
              配置学术数据源以丰富论文检索范围。免费源无需配置即可使用。
            </p>

            <div className="space-y-3">
              {sources.map((source) => (
                <motion.div
                  key={source.id}
                  layout
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}
                >
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--epis-surface)' }}>
                      {source.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm" style={{ color: 'var(--epis-text)' }}>{source.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                            source.status === 'connected'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {source.status === 'connected' ? (
                            <><FiCheck className="w-2.5 h-2.5" /> 已连接</>
                          ) : (
                            <><FiLock className="w-2.5 h-2.5" /> 未连接</>
                          )}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--epis-text-muted)' }}>{source.description}</p>
                    </div>

                    {source.type === 'login' && source.status === 'disconnected' && (
                      <button
                        onClick={() => handleConfigure(source.id)}
                        className="shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors"
                        style={{ background: 'var(--epis-accent-soft)', color: 'var(--epis-accent)' }}
                      >
                        {showGuidance === source.id ? '收起' : '使用说明'}
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {showGuidance === source.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ borderTop: '1px solid var(--epis-border)' }}
                      >
                        <div className="p-4 space-y-3">
                          <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--epis-text-muted)' }}>
                            <FiInfo className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--epis-accent)' }} />
                            <div>
                              <p className="text-sm font-medium mb-2" style={{ color: 'var(--epis-text)' }}>
                                {source.id === 'cnki' ? '如何使用中国知网' : '如何使用互联网资料'}
                              </p>
                              {source.id === 'cnki' ? (
                                <ol className="space-y-1.5 list-decimal list-inside">
                                  <li>在浏览器中打开 <a href="https://www.cnki.net" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--epis-accent)' }} className="underline">中国知网 (cnki.net)</a></li>
                                  <li>搜索你需要的论文或文献</li>
                                  <li>将论文的 DOI 或标题复制到 Epis 搜索框中</li>
                                  <li>Epis 将通过 CrossRef 等开放源获取元数据</li>
                                </ol>
                              ) : (
                                <ol className="space-y-1.5 list-decimal list-inside">
                                  <li>在浏览器中搜索你需要的学术资料</li>
                                  <li>将公开可访问的论文 URL 或 DOI 复制到 Epis</li>
                                  <li>Epis 会尝试通过开放 API 获取元数据</li>
                                </ol>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-2xl" style={{ background: 'var(--epis-accent-soft)', border: '1px solid var(--epis-border)' }}>
              <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--epis-accent)' }}>当前数据来源</h4>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--epis-text-muted)' }}>
                Epis 目前已接入 <strong style={{ color: 'var(--epis-text)' }}>OpenAlex</strong>（主数据源，覆盖全学科含政治学、国际关系、区域研究）。
                中国知网和互联网资料需手动导入。
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}