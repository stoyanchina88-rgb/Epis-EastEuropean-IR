import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSun, FiMoon, FiTrash2, FiInfo, FiSmartphone, FiDatabase, FiRefreshCw, FiCheck, FiServer, FiGlobe, FiDownload, FiCpu, FiAlertCircle, FiCheckCircle, FiMessageSquare, FiChevronRight } from 'react-icons/fi';
import { useTheme } from '../hooks/useTheme';
import { clearCache } from '../api/feedService';
import { clearNewsCache } from '../api/newsFeed';
import { setLocalTranslationServer, getLocalTranslationServerUrl, testLocalTranslationServer } from '../api/translation';
import nativeTranslation from '../api/nativeTranslation';

const APP_VERSION = '1.1.0';
const BUILD_DATE = '2026-05-17';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllData: () => void;
}

// ─── Single Settings Row ──────────────────────────────
function S(props: { label: string; value?: string; icon?: React.ReactNode; right?: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <div
      onClick={props.onClick}
      className="flex items-center justify-between px-4 py-3.5 active:opacity-60 transition-opacity cursor-pointer"
      style={{ borderBottom: '1px solid var(--epis-border)' }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {props.icon && (
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: props.danger ? 'rgba(244,63,94,0.12)' : 'rgba(99,102,241,0.12)',
              color: props.danger ? '#f87171' : 'var(--epis-accent)',
            }}>
            {props.icon}
          </span>
        )}
        <span className="text-sm truncate" style={{
          color: props.danger ? '#f87171' : 'var(--epis-text)',
          fontWeight: props.danger ? 500 : 400,
        }}>{props.label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {props.value && <span className="text-xs" style={{ color: 'var(--epis-text-muted)' }}>{props.value}</span>}
        {props.right}
        {!props.right && props.value && <FiChevronRight size={14} style={{ color: 'var(--epis-text-muted)' }} />}
      </div>
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────
function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wider px-1 mb-2" style={{ color: 'var(--epis-text-muted)' }}>
        {props.title}
      </h3>
      <div className="overflow-hidden rounded-xl" style={{
        background: 'var(--epis-surface)',
      }}>
        {props.children}
      </div>
    </div>
  );
}

export default function SettingsPage({ isOpen, onClose, onClearAllData }: SettingsPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [cleared, setCleared] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [serverStatus, setServerStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [modelStatus, setModelStatus] = useState<string>('checking');
  const [modelReady, setModelReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setServerUrl(getLocalTranslationServerUrl() || '');
    checkNativeStatus();
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const checkNativeStatus = async () => {
    const available = nativeTranslation.isNativeAvailable();
    setNativeAvailable(available);
    if (!available) { setModelStatus('unavailable'); return; }
    try {
      await nativeTranslation.initialize();
      const status = await nativeTranslation.getStatus();
      const exists = await nativeTranslation.checkModelExists();
      if (exists.exists && !status.modelReady) {
        setModelStatus('downloaded');
      } else if (status.modelReady) {
        setModelStatus('ModelReady');
        setModelReady(true);
      } else {
        setModelStatus('not_downloaded');
      }
    } catch { setModelStatus('error'); }
  };

  const handleDownloadModel = async () => {
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);
    setDownloadSuccess(false);

    const progressTimer = setInterval(() => {
      setDownloadProgress(p => {
        const inc = p < 30 ? 5 : p < 60 ? 3 : p < 85 ? 1 : 0;
        return Math.min(p + inc, 90);
      });
    }, 2000);

    try {
      const result = await nativeTranslation.downloadModel();
      clearInterval(progressTimer);
      setDownloadProgress(100);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);

      try {
        await nativeTranslation.loadModel(result.path);
        setModelReady(true);
        setModelStatus('ModelReady');
      } catch { setModelStatus('downloaded'); }
    } catch (e: any) {
      clearInterval(progressTimer);
      setDownloadError(e.message || '下载失败');
      setModelStatus('error');
    } finally { setDownloading(false); }
  };

  const handleLoadModel = async () => {
    setModelLoading(true);
    setDownloadError(null);
    try {
      const status = await nativeTranslation.getStatus();
      await nativeTranslation.loadModel(status.modelPath);
      setModelReady(true);
      setModelStatus('ModelReady');
    } catch (e: any) {
      setDownloadError('加载失败: ' + (e.message || ''));
      setModelStatus('error');
    } finally { setModelLoading(false); }
  };

  const handleUnloadModel = async () => {
    await nativeTranslation.unload();
    setModelReady(false);
    setModelStatus('downloaded');
  };

  const handleClearCache = () => {
    clearCache();
    clearNewsCache();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  const handleClearAll = () => {
    localStorage.removeItem('epis-bookmarks');
    localStorage.removeItem('epis-history');
    localStorage.removeItem('epis-offline-cache');
    localStorage.removeItem('epis-subscriptions');
    clearCache();
    clearNewsCache();
    onClearAllData();
    setShowConfirm(false);
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  const handleTestServer = async () => {
    if (!serverUrl.trim()) return;
    setServerStatus('testing');
    const ok = await testLocalTranslationServer(serverUrl.trim());
    setServerStatus(ok ? 'ok' : 'fail');
    if (ok) setLocalTranslationServer(serverUrl.trim());
  };

  const handleRemoveServer = () => {
    setServerUrl('');
    setLocalTranslationServer(null);
    setServerStatus('idle');
  };

  const handleRedownload = async () => {
    await nativeTranslation.unload();
    setModelReady(false);
    setModelStatus('not_downloaded');
    setDownloadError(null);
    setDownloadProgress(0);
  };

  const modelBadge = () => {
    const s = modelStatus;
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
        background: modelReady ? 'rgba(52,211,153,0.15)' : s === 'downloaded' ? 'rgba(96,165,250,0.15)' : s === 'not_downloaded' ? 'rgba(156,163,175,0.15)' : s === 'checking' ? 'rgba(167,139,250,0.15)' : 'rgba(248,113,113,0.15)',
        color: modelReady ? '#34d399' : s === 'downloaded' ? '#60a5fa' : s === 'not_downloaded' ? '#9ca3af' : s === 'checking' ? '#a78bfa' : '#f87171',
      }}>
        {modelReady ? '已加载' : s === 'downloaded' ? '已下载' : s === 'not_downloaded' ? '未安装' : s === 'checking' ? '检查中' : '异常'}
      </span>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col"
          style={{ background: 'var(--epis-bg)' }}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0">
            <h2 className="text-lg font-bold" style={{ color: 'var(--epis-text)' }}>设置</h2>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'var(--epis-surface)' }}>
              <FiX className="w-4 h-4" style={{ color: 'var(--epis-text)' }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-8">

            {/* ── 离线翻译模型 ── */}
            {nativeAvailable && (
              <Section title="离线翻译">
                {/* Status row */}
                <div className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: '1px solid var(--epis-border)' }}>
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: modelReady ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.12)', color: modelReady ? '#34d399' : 'var(--epis-accent)' }}>
                      <FiCpu size={14} />
                    </span>
                    <span className="text-sm" style={{ color: 'var(--epis-text)' }}>模型状态</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {modelBadge()}
                    {modelStatus === 'not_downloaded' && !downloading && (
                      <button onClick={handleDownloadModel}
                        className="text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: 'var(--epis-accent)', color: '#fff' }}>
                        <FiDownload size={12} className="inline mr-1" />下载
                      </button>
                    )}
                    {modelStatus === 'downloaded' && !modelReady && !modelLoading && (
                      <button onClick={handleLoadModel}
                        className="text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: 'var(--epis-accent)', color: '#fff' }}>
                        加载
                      </button>
                    )}
                    {modelLoading && (
                      <span className="text-xs flex items-center gap-1.5 px-3 py-1 rounded-full"
                        style={{ background: 'var(--epis-accent)', color: '#fff' }}>
                        <span className="inline-block w-3 h-3 rounded-full border-2 animate-spin"
                          style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                        加载中
                      </span>
                    )}
                    {downloading && (
                      <span className="text-xs px-3 py-1 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--epis-accent)' }}>
                        {downloadProgress}%
                      </span>
                    )}
                    {modelReady && (
                      <button onClick={handleUnloadModel}
                        className="text-xs px-3 py-1 rounded-full"
                        style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                        卸载
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress */}
                {(downloading && downloadProgress < 100) && (
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--epis-border)' }}>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--epis-border)' }}>
                      <motion.div className="h-full rounded-full"
                        style={{ background: 'var(--epis-accent)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${downloadProgress}%` }}
                        transition={{ duration: 0.3 }} />
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: 'var(--epis-text-muted)' }}>
                      模型 461MB，已下载 {downloadProgress}%
                    </p>
                  </div>
                )}

                {/* Success/Error */}
                {downloadSuccess && (
                  <div className="px-4 py-2.5 text-xs flex items-center gap-2"
                    style={{ borderBottom: '1px solid var(--epis-border)', color: '#34d399' }}>
                    <FiCheckCircle size={12} /> 下载完成
                  </div>
                )}
                {downloadError && (
                  <div className="px-4 py-2.5 text-xs flex items-center gap-2"
                    style={{ borderBottom: '1px solid var(--epis-border)', color: '#f87171' }}>
                    <FiAlertCircle size={12} /> {downloadError}
                  </div>
                )}

                {/* Redownload */}
                {(modelReady || modelStatus === 'downloaded') && (
                  <S label="重新下载" onClick={handleRedownload} />
                )}
              </Section>
            )}

            {/* ── 翻译服务 ── */}
            <Section title="翻译服务">
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--epis-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--epis-accent)' }}>
                    <FiGlobe size={14} />
                  </span>
                  <span className="text-sm" style={{ color: 'var(--epis-text)' }}>本地翻译服务器</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://192.168.1.100:3456/translate"
                    className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--epis-bg)', color: 'var(--epis-text)', border: '1px solid var(--epis-border)' }}
                  />
                  <button onClick={handleTestServer}
                    disabled={serverStatus === 'testing' || !serverUrl.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--epis-accent)', color: '#fff' }}>
                    测试
                  </button>
                </div>
                {serverStatus === 'ok' && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: '#34d399' }}><FiCheck size={12} /> 连接正常</p>}
                {serverStatus === 'fail' && <p className="text-xs mt-2" style={{ color: '#f87171' }}>无法连接</p>}
                {serverStatus === 'testing' && <p className="text-xs mt-2" style={{ color: 'var(--epis-text-muted)' }}>测试中...</p>}
                {serverStatus === 'idle' && getLocalTranslationServerUrl() && (
                  <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--epis-text-muted)' }}>
                    <FiServer size={12} /> {getLocalTranslationServerUrl()}
                    <button onClick={handleRemoveServer} className="ml-auto" style={{ color: '#f87171' }}>移除</button>
                  </div>
                )}
              </div>
              <S label="离线模型 → 本地服务器 → MyMemory" icon={<FiServer size={14} style={{ color: 'var(--epis-accent)' }} />} />
            </Section>

            {/* ── AI 点评 ── */}
            <Section title="AI 论文点评">
              <S label="模型" value="DeepSeek-R1" icon={<FiMessageSquare size={14} style={{ color: '#34d399' }} />} />
              <S label="供应商" value="SiliconFlow" onClick={() => window.open('https://siliconflow.cn', '_blank')} />
              <S label="模型 ID" value="deepseek-ai/DeepSeek-R1-0528-Qwen3-8B" />
            </Section>

            {/* ── 外观主题 ── */}
            <Section title="外观">
              <div className="flex items-center justify-between px-4 py-3.5 cursor-pointer"
                onClick={toggleTheme}>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--epis-accent)' }}>
                    {theme === 'dark' ? <FiMoon size={14} /> : <FiSun size={14} style={{ color: '#f59e0b' }} />}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--epis-text)' }}>
                    主题
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--epis-text-muted)' }}>
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                  <div className="w-11 h-6 rounded-full relative transition-colors"
                    style={{ background: theme === 'dark' ? 'var(--epis-accent)' : '#d1d5db' }}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>
              </div>
            </Section>

            {/* ── 数据源 ── */}
            <Section title="数据源">
              <S label="OpenAlex API" value="已接入" icon={<FiDatabase size={14} style={{ color: '#818cf8' }} />} />
              <S label="arXiv" value="已接入" icon={<FiDatabase size={14} style={{ color: '#34d399' }} />} />
              <S label="DOAJ (开放获取期刊)" value="已接入" icon={<FiDatabase size={14} style={{ color: '#f59e0b' }} />} />
            </Section>

            {/* ── 缓存 ── */}
            <Section title="缓存与数据">
              <S label="清除 API 缓存" icon={<FiRefreshCw size={14} />} onClick={handleClearCache} right={cleared ? <FiCheck size={14} style={{ color: '#34d399' }} /> : undefined} />
              <S label="清除所有数据" danger onClick={() => setShowConfirm(true)} icon={<FiTrash2 size={14} />} />
            </Section>

            {/* Confirm dialog */}
            <AnimatePresence>
              {showConfirm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 rounded-xl mb-6"
                  style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}
                >
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--epis-text)' }}>确认清除所有数据？</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--epis-text-muted)' }}>
                    将清除收藏、浏览历史、离线缓存、订阅设置。此操作不可撤销。
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowConfirm(false)}
                      className="flex-1 py-2 rounded-lg text-sm"
                      style={{ background: 'var(--epis-surface)', color: 'var(--epis-text)' }}>
                      取消
                    </button>
                    <button onClick={handleClearAll}
                      className="flex-1 py-2 rounded-lg text-sm text-white"
                      style={{ background: '#e11d48' }}>
                      确认清除
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── 关于 ── */}
            <Section title="关于">
              <S label="应用名称" value="Epis" icon={<FiInfo size={14} style={{ color: 'var(--epis-accent)' }} />} />
              <S label="版本" value={`v${APP_VERSION}`} />
              <S label="构建日期" value={BUILD_DATE} />
              <S label="作者" value="Stoyan" />
              <S label="研究方向" value="东欧政治 · 国际关系" />
              <S label="数据来源" value="OpenAlex + arXiv + DOAJ" />
              <S label="翻译服务" value="离线 + 本地 + MyMemory" />
              <S label="AI 点评" value="DeepSeek-R1" />
            </Section>

            {/* ── 底部 ── */}
            <div className="flex items-start gap-3 px-4 py-4 rounded-xl"
              style={{ background: 'var(--epis-accent-soft)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.12)' }}>
                <FiSmartphone size={16} style={{ color: 'var(--epis-accent)' }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--epis-text)' }}>本地优先应用</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--epis-text-muted)' }}>
                  所有数据保存在设备本地，无需注册
                </p>
              </div>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}