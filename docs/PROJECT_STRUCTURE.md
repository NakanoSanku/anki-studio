# Anki Studio 项目结构

Anki Studio 按“运行时代码、文档与静态资源”分区。运行时代码分为路由入口、界面组件和业务逻辑三层。

## 目录总览

```text
anki-studio/
├── app/                         # Next.js App Router：页面、布局、Route Handlers、PWA 元信息
│   ├── (app)/                   # 学习 / 笔记 / 设置等用户界面路由壳
│   ├── api/                     # NextAuth、Google Sheets、同步、TTS API
│   └── auth/                    # 认证错误页面
│
├── components/                  # React 展示与交互层
│   ├── ui/                      # shadcn/Radix 基础组件
│   ├── card-editor.tsx          # 笔记编辑器
│   ├── study-session.tsx        # 学习会话
│   ├── template-editor.tsx      # 模板设计器
│   ├── settings-*.tsx           # 设置相关视图
│   ├── app-shell.tsx            # 顶栏、底部导航、安全区与页面外壳
│   └── studio.tsx               # 客户端状态编排与视图分发
│
├── lib/                         # 与 React 展示解耦的业务/基础设施代码
│   ├── deck.ts / library.ts     # 卡包、笔记、模板模型与本机库管理
│   ├── fsrs.ts                  # FSRS 调度
│   ├── editor-state.ts          # 编辑器状态
│   ├── sync-*.ts                # 同步计划、协议、服务端/客户端流程
│   ├── google-*.ts              # Google OAuth / Sheets / Picker
│   ├── apkg.ts / anki-sync.ts   # Anki 导入导出
│   ├── ai*.ts                   # AI 请求、兼容层、Prompt 配置
│   └── *-utils / navigation     # 路由、动画、虚拟列表等纯工具
│
├── public/                      # Service Worker、WASM、PWA 静态资源
├── docs/                        # 架构说明与 ADR
│   ├── adr/
│   └── PROJECT_STRUCTURE.md
│
├── package.json                 # 开发、构建与质量检查脚本
├── tsconfig.json                # TypeScript 配置
├── next.config.ts               # Next.js 配置
└── eslint.config.mjs            # ESLint 配置
```

## 分层职责

### `app/` — 路由与服务端边界

只负责 Next.js 路由、布局、Route Handler 和框架级入口。复杂业务逻辑应下沉到 `lib/`，可复用 UI 下沉到 `components/`。

### `components/` — React 交互与展示

负责界面、用户交互以及把业务能力组合成页面。组件可以调用 `lib/`，但不应把独立的领域算法重新实现在 JSX 中。

### `lib/` — 业务与基础设施

这里放与 React 组件树解耦的模型、算法、存储、同步、导入导出和 API 辅助逻辑。

## 依赖方向

```text
app ───────► components ───────► lib
  └────────────────────────────► lib
```

## 质量检查

```bash
npm run lint            # ESLint
npm run typecheck       # TypeScript
npm run build           # 生产构建
```

## 开发原则

1. 页面入口保持薄：框架路由留在 `app/`，业务下沉。
2. React 组件专注展示和交互，独立的算法进入 `lib/`。
3. 产品代码使用 `@/...` 别名跨目录引用，降低物理目录耦合。
4. 结构调整后必须通过 lint、typecheck 和 production build。
