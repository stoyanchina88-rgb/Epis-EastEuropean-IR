# Epis — 学术论文精选

> **政治学·国际关系·区域研究** — 抖音式刷论文，让文献阅读像刷短视频一样上瘾。

---

## 简介

Epis 是一个专注于**政治学、国际关系与区域研究**领域的学术论文移动端 App。采用抖音式卡片滑动交互，让你在碎片时间里高效浏览、收藏和阅读最新学术论文。

数据来自 OpenAlex、arXiv、DOAJ 多个学术开放数据库，覆盖国际政治、安全研究、比较政治、区域研究等方向。无需注册，即装即用。

## 特色功能

| 功能 | 说明 |
|------|------|
| **卡片滑动** | 左滑忽略，右滑收藏，就像刷短视频一样刷论文 |
| **多数据源** | 聚合 OpenAlex + arXiv + DOAJ，论文量充足 |
| **智能推荐** | 「为你推荐」混合流，自动去重+交织排列 |
| **一键翻译** | 离线 Hy-MT 模型（33语言）→ MyMemory → DeepSeek-R1 三级翻译管线 |
| **AI 点评** | DeepSeek-R1 自动生成论文概要、创新点、研究意义、推荐受众 |
| **收藏管理** | 排序 + 多选批量删除 + 左滑确认删除 |
| **离线缓存** | LRU 缓存机制，150 篇论文本地缓存，无网络也能阅读 |
| **分类订阅** | 政治科学 / 国际关系 / 安全研究 / 区域研究等 |
| **引用导出** | 支持 BibTeX、APA、MLA 格式 |
| **深色/浅色主题** | 跟随系统或手动切换 |
| **PWA 支持** | Service Worker 缓存，可添加到桌面 |
| **原生打包** | Capacitor Android 原生 APK |

## 技术栈

```
前端      Vite + React + TypeScript + Tailwind CSS + framer-motion
原生层    Capacitor (Android)
翻译      Hy-MT GGUF (离线) / MyMemory API / DeepSeek-R1
AI 点评   DeepSeek-R1 (SiliconFlow API)
数据源    OpenAlex / arXiv / DOAJ
缓存      LRU + localStorage
打包      780kB JS bundle (gzip ~400kB)
```

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# Android APK 构建（需 JDK 21）
npx cap sync android
cd android && ./gradlew assembleDebug
```

### 环境要求

- Node.js 18+
- JDK 21 (Capacitor Android 构建)
- Android SDK (API 33+)

## 离线翻译模型

Epis 支持离线翻译，基于 Hy-MT 1.5B GGUF 量化模型：

- **模型**：AngelSlim/Hy-MT1.5-1.8B-1.25bit-GGUF (~461MB)
- **支持语言**：33种语言自动检测翻译
- **安装方式**：App 内「设置 → 离线翻译 → 下载模型」
- **兜底机制**：离线模型不可用时自动降级到 MyMemory 在线翻译，仍不支持的语种由 DeepSeek-R1 兜底

## 数据来源

| 源 | 覆盖范围 | 特点 |
|-----|---------|------|
| [OpenAlex](https://openalex.org/) | 政治科学、国际关系、安全研究等 | 最全面的学术图谱，带引用统计 |
| [arXiv](https://arxiv.org/) | 计算机/物理/数学/经济 | 预印本快速更新 |
| [DOAJ](https://doaj.org/) | 开放获取期刊 | 同行评审，覆盖广泛 |

所有数据源均为公开免费 API，无需 API Key。

## 截图

> 🚧 即将补充

## 路线图

- [x] 卡片滑动 + 无限滚动
- [x] 收藏 / 浏览历史 / 离线缓存
- [x] AI 智能点评
- [x] 离线翻译 (Hy-MT)
- [x] 多数据源融合
- [x] 深色/浅色主题
- [ ] 论文全文阅读
- [ ] 中国知网 (CNKI) 数据集成
- [ ] 手动导入 (PDF/DOCX)
- [ ] iOS 版本
- [ ] 本地知识库构建

## 构建信息

当前版本：**1.1.0** | 构建日期：2026-05-17

## 声明

- 所有论文数据来自公开学术 API，版权归原作者/出版商所有
- 翻译结果仅供参考，不保证完全准确
- 本项目为个人学习交流项目，非商业用途

## 许可证

MIT
