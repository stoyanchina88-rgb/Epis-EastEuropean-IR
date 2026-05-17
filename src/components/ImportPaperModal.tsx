import { useState, useRef, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUpload, FiX, FiFileText, FiFile, FiCheck, FiAlertCircle, FiLoader, FiTrash2 } from 'react-icons/fi';
import { ImportedPaper } from '../types';
import { parseFile, generateSummary, extractKeyPoints, estimateReadingTime, detectLanguage, getLanguageLabel, ParseResult } from '../api/fileParser';
import { translatePaperContent } from '../api/translation';
import { useImportedPapers } from '../hooks/useImportedPapers';

interface ImportPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportState = 'idle' | 'dragging' | 'parsing' | 'success' | 'error';

export default function ImportPaperModal({ isOpen, onClose }: ImportPaperModalProps) {
  const [state, setState] = useState<ImportState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importedPaper, setImportedPaper] = useState<ImportedPaper | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addPaper } = useImportedPapers();

  const reset = () => {
    setState('idle');
    setDragOver(false);
    setSelectedFile(null);
    setParseResult(null);
    setImportedPaper(null);
    setErrorMsg('');
    setTranslating(false);
    setTranslated(false);
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      setState('error');
      setErrorMsg(`不支持的文件格式: .${ext}，仅支持 PDF 和 DOCX`);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setState('error');
      setErrorMsg('文件过大，请上传小于 50MB 的文件');
      return;
    }

    setSelectedFile(file);
    setState('parsing');
    setParseResult(null);

    try {
      const result = await parseFile(file);
      setParseResult(result);

      if (!result.success) {
        setState('error');
        setErrorMsg(result.error || '解析失败');
        return;
      }

      // Build ImportedPaper
      const lang = detectLanguage(result.text);
      const keyPoints = extractKeyPoints(result.text);
      const readingTime = estimateReadingTime(result.text);

      const paper: ImportedPaper = {
        id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: result.title || file.name.replace(/\.(pdf|docx)$/i, ''),
        authors: [],
        source: ext === 'pdf' ? 'pdf' : 'docx',
        fileName: file.name,
        fileSize: file.size,
        fullText: result.text,
        importedAt: Date.now(),
        language: lang,
        readingProgress: 0,
        keyPoints,
        readingTime,
        bookmarks: [],
      };

      setImportedPaper(paper);
      setState('success');
    } catch (err: any) {
      setState('error');
      setErrorMsg(`处理失败: ${err.message || '未知错误'}`);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleFileSelect = () => fileInputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleTranslate = async () => {
    if (!importedPaper || translating) return;
    setTranslating(true);
    try {
      const result = await translatePaperContent(importedPaper.title, importedPaper.fullText.slice(0, 2000));
      addPaper({
        ...importedPaper,
        isTranslated: true,
        translatedTitle: result.title,
        translatedFullText: result.abstract, // We only translate first 2000 chars
        originalLanguage: result.originalLanguage,
        aiSummary: generateSummary(importedPaper.fullText),
      });
      setTranslated(true);
    } catch {
      addPaper({
        ...importedPaper,
        translationFailed: true,
        aiSummary: generateSummary(importedPaper.fullText),
      });
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = () => {
    if (importedPaper) {
      if (!translated && !translating) {
        // Save without translation
        addPaper({
          ...importedPaper,
          aiSummary: generateSummary(importedPaper.fullText),
        });
      }
      reset();
      onClose();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--epis-text)' }}>
              <FiUpload className="w-5 h-5" style={{ color: 'var(--epis-accent)' }} />
              导入论文
            </h2>
            <button onClick={() => { reset(); onClose(); }}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'var(--epis-surface)' }}>
              <FiX className="w-5 h-5" style={{ color: 'var(--epis-text)' }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-8">
            {/* Drop zone */}
            {(state === 'idle' || state === 'dragging') && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleFileSelect}
                className="relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all"
                style={{
                  borderColor: dragOver ? 'var(--epis-accent)' : 'var(--epis-border)',
                  background: dragOver ? 'var(--epis-accent-soft)' : 'var(--epis-surface)',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={handleInputChange}
                />
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--epis-accent-soft)' }}>
                  <FiUpload className="w-7 h-7" style={{ color: 'var(--epis-accent)' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--epis-text)' }}>
                  {dragOver ? '松开上传' : '拖拽文件到此处'}
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--epis-text-muted)' }}>
                  或点击选择文件
                </p>
                <div className="flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--epis-text-muted)' }}>
                  <span className="flex items-center gap-1"><FiFileText className="w-3.5 h-3.5" /> PDF</span>
                  <span className="flex items-center gap-1"><FiFile className="w-3.5 h-3.5" /> DOCX</span>
                </div>
                <p className="text-[10px] mt-4" style={{ color: 'var(--epis-text-muted)' }}>
                  最大 50MB · 所有数据仅在本地处理，不上传服务器
                </p>
              </div>
            )}

            {/* Parsing state */}
            {state === 'parsing' && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'var(--epis-accent-soft)' }}>
                  <FiLoader className="w-7 h-7 animate-spin" style={{ color: 'var(--epis-accent)' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--epis-text)' }}>正在解析</h3>
                <p className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>
                  {selectedFile?.name} ({selectedFile ? formatFileSize(selectedFile.size) : ''})
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--epis-text-muted)' }}>
                  提取文本内容...
                </p>
              </div>
            )}

            {/* Error state */}
            {state === 'error' && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'rgba(244,63,94,0.1)' }}>
                  <FiAlertCircle className="w-7 h-7 text-rose-400" />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--epis-text)' }}>处理失败</h3>
                <p className="text-sm mb-6 text-center" style={{ color: 'var(--epis-text-muted)' }}>{errorMsg}</p>
                <button onClick={reset}
                  className="px-6 py-3 rounded-full font-medium transition-colors"
                  style={{ background: 'var(--epis-accent)', color: '#fff' }}>
                  重新选择
                </button>
              </div>
            )}

            {/* Success state */}
            {state === 'success' && importedPaper && (
              <div className="space-y-4">
                {/* Success banner */}
                <div className="p-4 rounded-2xl flex items-center gap-3"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <FiCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-400">解析成功</p>
                    <p className="text-xs" style={{ color: 'var(--epis-text-muted)' }}>
                      {importedPaper.fileName} · {importedPaper.fullText.length.toLocaleString()} 字符
                      {parseResult?.pageCount ? ` · ${parseResult.pageCount} 页` : ''}
                    </p>
                  </div>
                </div>

                {/* Paper info */}
                <div className="p-4 rounded-2xl" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--epis-text)' }}>{importedPaper.title}</h4>
                  <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--epis-text-muted)' }}>
                    <span className="px-2 py-0.5 rounded-md" style={{ background: 'var(--epis-accent-soft)', color: 'var(--epis-accent)' }}>
                      {importedPaper.source.toUpperCase()}
                    </span>
                    <span>{getLanguageLabel(importedPaper.language || 'other')}</span>
                    <span>{importedPaper.keyPoints.length} 个关键点</span>
                    <span>{importedPaper.readingTime} 分钟阅读</span>
                  </div>
                </div>

                {/* Key points preview */}
                {importedPaper.keyPoints.length > 0 && (
                  <div className="p-4 rounded-2xl" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}>
                    <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--epis-accent)' }}>📌 关键要点</h4>
                    <ul className="space-y-1.5">
                      {importedPaper.keyPoints.slice(0, 5).map((point, i) => (
                        <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: 'var(--epis-text)' }}>
                          <span style={{ color: 'var(--epis-accent)' }}>•</span>
                          <span>{point.slice(0, 120)}{point.length > 120 ? '...' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Content preview */}
                <div className="p-4 rounded-2xl" style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}>
                  <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--epis-accent)' }}>📄 内容预览</h4>
                  <p className="text-xs leading-relaxed line-clamp-8" style={{ color: 'var(--epis-text)' }}>
                    {importedPaper.fullText.slice(0, 1500)}
                  </p>
                  {importedPaper.fullText.length > 1500 && (
                    <p className="text-xs mt-2" style={{ color: 'var(--epis-text-muted)' }}>
                      ... 共 {importedPaper.fullText.length.toLocaleString()} 字符
                    </p>
                  )}
                </div>

                {/* Translate button */}
                <div className="flex gap-3">
                  <button
                    onClick={handleTranslate}
                    disabled={translating || translated}
                    className="flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                    style={{
                      background: translated ? 'rgba(16,185,129,0.15)' : translating ? 'var(--epis-surface)' : 'var(--epis-accent)',
                      color: translated ? '#34d399' : translating ? 'var(--epis-text-muted)' : '#fff',
                      border: translated ? '1px solid rgba(16,185,129,0.2)' : 'none',
                    }}
                  >
                    {translating ? (
                      <><FiLoader className="w-4 h-4 animate-spin" /> 翻译中...</>
                    ) : translated ? (
                      <><FiCheck className="w-4 h-4" /> 已翻译</>
                    ) : (
                      <>🤖 自动翻译为中文</>
                    )}
                  </button>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  className="w-full py-4 rounded-2xl text-base font-semibold transition-all"
                  style={{ background: 'var(--epis-accent)', color: '#fff' }}
                >
                  ✅ 保存到文库
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}