import { motion } from 'framer-motion';
import { FiBookOpen, FiArrowRight } from 'react-icons/fi';

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  return (
    <motion.div
      className="absolute inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'var(--epis-bg)' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Background gradient decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--epis-accent) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      </div>

      {/* Logo area */}
      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
          style={{
            background: 'linear-gradient(135deg, var(--epis-accent), #7c3aed)',
            boxShadow: '0 20px 60px rgba(168,85,247,0.3)',
          }}>
          <FiBookOpen className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--epis-text)' }}>
          Epis
        </h1>

        <div className="h-0.5 w-16 rounded-full mb-4" style={{ background: 'var(--epis-accent)' }} />

        <p className="text-lg font-medium mb-1" style={{ color: 'var(--epis-text)' }}>
          东欧政治研究 · 知识拓展包
        </p>
        <p className="text-sm mb-8" style={{ color: 'var(--epis-text-muted)' }}>
          论文 · 新闻 · 理论 · 精选
        </p>

        {/* Feature highlights */}
        <div className="space-y-3 mb-10 w-72">
          {[
            { icon: '📄', text: 'OpenAlex 学术论文智能推荐' },
            { icon: '📰', text: '东欧地区新闻实时聚合' },
            { icon: '📖', text: '国际关系经典理论速览' },
            { icon: '✨', text: '精选论文片段与核心洞见' },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--epis-surface)', border: '1px solid var(--epis-border)' }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm" style={{ color: 'var(--epis-text-muted)' }}>{item.text}</span>
            </motion.div>
          ))}
        </div>

        {/* Author info */}
        <p className="text-xs mb-6" style={{ color: 'var(--epis-text-muted)' }}>
          作者：<span style={{ color: 'var(--epis-accent)' }}>Stoyan</span>
        </p>

        {/* Start button */}
        <motion.button
          onClick={onDone}
          className="px-8 py-3.5 rounded-full font-medium text-base flex items-center gap-2 transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--epis-accent), #7c3aed)',
            color: '#fff',
            boxShadow: '0 8px 30px rgba(168,85,247,0.3)',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          开始探索
          <FiArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>

      {/* Version at bottom */}
      <motion.p
        className="absolute bottom-8 text-[10px]"
        style={{ color: 'var(--epis-text-muted)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        v1.0.0 · 专为东欧政治研究设计
      </motion.p>
    </motion.div>
  );
}