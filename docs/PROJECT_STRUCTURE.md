# Anki Studio 项目文件结构与架构指南

本文档全面梳理了 **Anki Studio** 项目的文件目录组织、核心模块分层、数据流向以及开发规范。

---

## 1. 目录总览

```
anki-studio/
├── app/                  # Next.js App Router 页面与 API 路由
│   ├── (app)/            # 主应用路由组（带顶部/底部导航与布局外壳）
│   │   ├── notes/        # 笔记列表与单卡编辑路由 (/notes, /notes/[id])
│   │   ├── settings/     # 设置子页面 (/settings, /settings/ai, /settings/deck, /settings/study, /settings/sync)
│   │   ├── study/        # 全屏学习会话路由 (/study)
│   │   ├── templates/    # 模板路由（重定向到 /settings/deck/templates）
│   │   ├── layout.tsx    # 主应用外壳布局
│   │   └── page.tsx      # 学习主页（复习概览与今日学习入口）
│   ├── api/              # 服务端 API 接口（认证、Google Sheets、同步、TTS 等）
│   │   ├── auth/         # NextAuth 认证端点 (/api/auth/[...nextauth], /api/auth/account)
│   │   ├── google-sheets/# Google Sheets 选表与连接接口 (/connect, /create, /list, /picker)
│   │   ├── sync/         # 卡包同步与状态管理接口 (/sync, /sync/decks/[id], /sync/sheets, /sync/status)
│   │   └── tts/          # 文本转语音端点 (/api/tts)
│   ├── auth/             # 认证异常处理页面 (/auth/error)
│   ├── globals.css       # 全局样式与 Tailwind CSS v4 样式表
│   ├── icon.svg          # 矢量图标
│   ├── layout.tsx        # 根布局（字体、主题初始化、元信息）
│   └── manifest.ts       # PWA Web App Manifest 动态清单
│
├── components/           # React 组件库
│   ├── ui/               # 原子级 UI 组件库（基于 shadcn/ui 与 Radix UI）
│   │   ├── alert-dialog.tsx, badge.tsx, button.tsx, card.tsx, dialog.tsx,
│   │   ├── dropdown-menu.tsx, input.tsx, label.tsx, progress.tsx,
│   │   ├── scroll-area.tsx, select.tsx, separator.tsx, sheet.tsx,
│   │   └── slider.tsx, tabs.tsx, textarea.tsx, tooltip.tsx
│   ├── card-editor.tsx               # 笔记/卡片核心编辑器
│   ├── card-preview.tsx              # 闪卡正反面实时渲染预览
│   ├── code-editor.tsx               # 基于 CodeMirror 的模板 HTML/CSS 编辑器
│   ├── prompt-editor.tsx             # AI 提示词与批量生成配置器
│   ├── reference-notes-bar.tsx       # 参考笔记快速选取栏
│   ├── template-editor.tsx           # 模板设计与管理面板
│   ├── study-overview.tsx            # 学习概览与卡包待学统计卡片
│   ├── study-stage.tsx               # 学习答题卡片与正反面翻转舞台
│   ├── study-session.tsx             # 完整全屏学习流程控制器
│   ├── study-settings-panel.tsx      # FSRS 复习参数配置抽屉
│   ├── deck-switcher.tsx             # 卡包快速切换选择器
│   ├── deck-tools-panel.tsx          # 卡包新建、导出、导入与删除工具
│   ├── import-preview-dialog.tsx     # CSV / APKG 导入确认与字段映射对话框
│   ├── sync-conflict-dialog.tsx      # 云同步版本冲突选择与解决对话框
│   ├── google-account-panel.tsx      # Google 帐号授权与绑定面板（NextAuth 驱动）
│   ├── google-sheet-picker-panel.tsx # Google Drive / Sheets 文件选择器面板
│   ├── ai-settings-panel.tsx         # AI 接口服务商与 API Key 配置面板
│   ├── settings-overview.tsx         # 设置主菜单导航列表
│   ├── settings-form.tsx             # 设置各子模块表单外壳
│   ├── app-shell.tsx                 # 应用全局上下文与 SessionProvider 外壳
│   ├── studio.tsx                    # 状态总调度与视图分发中心
│   ├── studio-shell.tsx              # 页面级响应式外壳
│   ├── studio-loader.tsx             # 启动加载指示器
│   ├── system-theme.tsx              # 系统暗黑/明亮主题自动检测与同步
│   ├── offline-banner.tsx            # 离线工作状态提示条
│   ├── motion-provider.tsx           # 页面过渡动画 Provider
│   ├── pwa-register.tsx              # Service Worker 注册器
│   ├── tts-play-button.tsx           # TTS 语音播放触发按钮
│   ├── use-virtual-window.ts         # 虚拟长列表滚动 Hook
│   └── *.chrome.test.ts              # 界面集成与交互行为测试
│
├── lib/                  # 核心业务逻辑、数据模型、算法与工具库
│   ├── 1. 存储与状态 (Storage & State)
│   │   ├── studio-store.ts           # 存储层抽象接口与类型定义
│   │   ├── studio-store-idb.ts       # 本机 IndexedDB 持久化实现（真实数据源）
│   │   ├── editor-state.ts           # 笔记编辑器状态管理与草稿快照
│   │   ├── committed-draft.ts        # 提交态与草稿态一致性比对
│   │   └── transient-status.ts       # 瞬态提示与通知状态
│   │
│   ├── 2. 闪卡与 FSRS 算法 (Core Cards & FSRS)
│   │   ├── fsrs.ts                   # FSRS 间隔重复算法与调度逻辑
│   │   ├── deck.ts                   # 卡包与笔记的数据模型操作
│   │   ├── library.ts                # 卡包集合管理与切换
│   │   ├── template.ts               # Mustache 语法解析与模板渲染
│   │   ├── empty-note.ts             # 空笔记创建与初始字段生成
│   │   └── import-preview.ts         # 导入差异比对与校验
│   │
│   ├── 3. 云同步与 Google 表格 (Sync & Google Sheets)
│   │   ├── google-sheets-sync.ts     # Google Sheets 双向同步核心算法
│   │   ├── sync-client.ts            # 前端同步状态机与合并请求
│   │   ├── sync-server.ts            # 服务端同步请求处理与冲突判定
│   │   ├── sync-payload.ts           # 分块 Payload 序列化与反序列化
│   │   ├── sync-plan.ts              # 同步计划与变更集计算
│   │   ├── google-auth.ts            # NextAuth / Google OAuth 令牌与权限管理
│   │   ├── google-sheet-connection.ts# 表格连接状态与元信息
│   │   ├── google-picker-config.ts   # Google Picker 配置生成（环境变量驱动）
│   │   ├── google-sheet-id.ts        # 表格 URL 解析与 ID 提取
│   │   ├── sync-transport.ts         # 网络传输封装
│   │   └── sync-types.ts             # 同步协议类型定义
│   │
│   ├── 4. Anki 兼容与导入导出 (Anki & APKG)
│   │   ├── apkg.ts                   # APKG 导出（SQLite + ZIP 打包）
│   │   ├── anki-sync.ts              # 增量导出逻辑与 guid 跟踪
│   │   ├── csv.ts                    # CSV 解析与格式化
│   │   └── encoding.ts               # 文件编码探测（UTF-8, GBK 等）
│   │
│   ├── 5. AI 与大模型交互 (AI & LLMs)
│   │   ├── ai.ts                     # AI 补全与批量卡片生成入口
│   │   ├── ai-run.ts                 # 运行时调用调度
│   │   ├── ai-settings.ts            # AI 供应商（OpenAI 兼容/Gemini）配置
│   │   ├── ai-compat.ts              # 多厂商请求响应格式抹平
│   │   └── ai-upstream.ts            # 上游 API 校验与连通性测试
│   │
│   └── 6. 界面交互与公共工具 (UI Utils & Navigation)
│       ├── app-paths.ts              # 路由路径常量与重定向解析
│       ├── card-nav.ts               # 上一张/下一张/未审卡片导航计算
│       ├── card-motion.ts            # 卡片翻转与滑动手势动画参数
│       ├── study-transition.ts       # 学习进度过渡动效
│       ├── virtual-window.ts         # 虚拟列表视口计算纯函数
│       ├── rate-gate.ts              # 频率限制门控（防抖/限流）
│       ├── tts.ts                    # Google Translate TTS 音频合成与缓存
│       ├── codemirror.ts             # CodeMirror 语法高亮扩展
│       └── utils.ts                  # Tailwind 类名合并等通用函数
│
├── docs/                 # 架构设计与文档
│   ├── adr/              # 架构决策记录 (ADR 0001 - 0010)
│   └── PROJECT_STRUCTURE.md # 本项目结构说明文件
│
├── public/               # 静态资源
│   ├── sql-wasm.wasm     # SQLite WASM 二进制引擎（用于 APKG 导出与解析）
│   ├── sw.js             # PWA Service Worker 脚本
│   ├── apple-touch-icon.png, icon-192.png, icon-512.png
│
└── 配置文件
    ├── package.json          # 依赖管理与常用运行脚本
    ├── tsconfig.json         # TypeScript 编译配置
    ├── next.config.ts        # Next.js 配置（动态路由、Turbopack）
    ├── vitest.config.mts     # Vitest 单元测试配置
    ├── eslint.config.mjs     # ESLint 代码规范配置
    ├── components.json       # shadcn/ui 组件库配置
    ├── .env.example          # 环境变量示例文件
    ├── CONTEXT.md            # 核心业务术语与命名规范约束
    ├── AGENTS.md             # Next.js 智能体编码准则
    └── README.md             # 项目简介、部署说明与开发指南
```

---

## 2. 核心架构与数据流

### 2.1 本地优先（Local-First）原则
1. **本机数据源（IndexedDB）** 是唯一的真实数据源（Source of Truth）。
2. 用户在界面上的所有编辑（修改笔记、切换卡包、调整模板）首先实时写入本地 IndexedDB，即便离线也能正常学习与编辑。
3. 外部同步（Google Sheets）与导出（APKG）均为本地数据的增量投影。

### 2.2 云同步（Google Sheets Sync）机制
- **可见工作表**：以卡包名命名，包含明文字段内容，允许用户在 Google Sheets 网页端直接阅读与编辑。
- **隐藏工作表（`_anki_studio_sync`）**：保存稳定卡包映射、字段哈希、删除墓碑与分块加密 Payload。
- **冲突检测**：在设备同步时自动比对本地时间戳与远端版本，发生冲突时通过 `SyncConflictDialog` 提供“保留本地 / 使用云端 / 另存为副本”选项。

### 2.3 学习会话（FSRS 算法）
- 基于 `ts-fsrs` 算法进行间隔重复调度。
- 每次答题（Again / Hard / Good / Easy）后计算下一次复习时间，并即时更新卡片状态持久化到 IndexedDB。

---

## 3. 脚本与开发命令

| 命令 | 描述 |
| :--- | :--- |
| `npm run dev` | 启动 Next.js 本地开发服务器（默认端口 3000） |
| `npm run build` | 执行 Next.js 生产环境构建 |
| `npm run typecheck` | 执行 TypeScript 静态类型检查 |
| `npm run lint` | 执行 ESLint 代码检查 |
| `npm test` | 执行 Vitest 自动化单元测试集 |
| `npm run test:watch` | 以监视模式运行 Vitest 单元测试 |

---

## 4. 术语与命名准则

请严格遵循 `CONTEXT.md` 中的标准术语：
- **卡包**（Deck）：由笔记、模板与学习记录组成的集合。（避免使用“牌组”或“书库”）
- **笔记**（Note）：可编辑的数据记录，包含稳定 ID、GUID 与各字段值。（避免用“卡片”称呼此数据记录）
- **卡片**（Card）：通过模板渲染笔记后生成的正反两面。（避免用“笔记”称呼呈现面）
- **学习**（Study）：针对到期与新卡片的 FSRS 学习会话。（避免用“复习”代指整个活动）
- **模板**（Template）：负责将笔记转化为卡片正反面的 HTML/CSS。
- **参考笔记**（Reference Notes）：用户在卡包中置顶作为 AI 编写范例的笔记。
