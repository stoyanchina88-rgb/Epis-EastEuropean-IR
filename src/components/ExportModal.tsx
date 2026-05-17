import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCopy, FiDownload, FiCheck } from 'react-icons/fi';
import { Paper } from '../types';
import { generateCitation, downloadBibTeX, CITATION_FORMATS, CitationFormat } from '../utils/citationExport';

interface ExportModalProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ paper, isOpen, onClose }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<CitationFormat>('bibtex');
  const [copied, setCopied] = useState(false);

  if (!paper) return null;

  const citation = generateCitation(paper, selectedFormat);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    if (selectedFormat === 'bibtex') {
      downloadBibTeX(paper);
    } else {
      const blob = new Blob([citation], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `citation-${selectedFormat}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col bg-epis-bg/98 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 className="text-lg font-bold text-white">导出引用</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <FiX className="w-5 h-5 text-epis-text" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-8">
            {/* Format selector */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              {CITATION_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`p-3 rounded-2xl text-left transition-all ${
                    selectedFormat === fmt.id
                      ? 'bg-purple-500/20 border border-purple-500/30'
                      : 'bg-white/5 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{fmt.label}</div>
                  <div className="text-[10px] text-epis-text-muted mt-0.5">{fmt.desc}</div>
                </button>
              ))}
            </div>

            {/* Citation preview */}
            <div className="mb-4">
              <div className="text-epis-text-muted text-xs mb-2 uppercase tracking-wider">
                预览
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <pre className="text-epis-text/80 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                  {citation}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-white/5 border border-white/10 text-epis-text hover:bg-white/10 transition-colors text-sm"
              >
                {copied ? (
                  <>
                    <FiCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">已复制</span>
                  </>
                ) : (
                  <>
                    <FiCopy className="w-4 h-4" />
                    复制
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-purple-500 text-white hover:bg-purple-600 transition-colors text-sm"
              >
                <FiDownload className="w-4 h-4" />
                下载
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}