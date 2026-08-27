# Anki Studio 项目结构

Anki Studio 按“运行时代码、测试代码、文档与静态资源”分区。最重要的边界是：**产品目录不混放测试文件，测试统一进入 `tests/`。**

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
├── tests/                       # 所有自动化测试
│   ├── unit/
│   │   └── lib/                 # lib 业务逻辑单元测试
│   ├── contracts/
│   │   ├── helpers/             # 契约测试辅助工具
│   │   └── ui/                  # UI/导航/性能源码契约测试
│   └── README.md                # 测试分层与新增测试约定
│
├── public/                      # Service Worker、WASM、PWA 静态资源
├── docs/                        # 架构说明与 ADR
│   ├── adr/
│   └── PROJECT_STRUCTURE.md
│
├── package.json                 # 开发、构建、测试脚本
├── tsconfig.json                # 产品代码 TypeScript 配置（排除 tests）
├── tsconfig.test.json           # 测试代码 TypeScript 配置
├── vitest.config.mts            # 仅扫描 tests/**/*.test.ts
├── next.config.ts               # Next.js 配置
└── eslint.config.mjs            # ESLint 配置
```

## 分层职责

### `app/` — 路由与服务端边界

只负责 Next.js 路由、布局、Route Handler 和框架级入口。复杂业务逻辑应下沉到 `lib/`，可复用 UI 下沉到 `components/`。

### `components/` — React 交互与展示

负责界面、用户交互以及把业务能力组合成页面。组件可以调用 `lib/`，但不应把可独立测试的领域算法重新实现在 JSX 中。

### `lib/` — 业务与基础设施

这里放与 React 组件树解耦的模型、算法、存储、同步、导入导出和 API 辅助逻辑。测试从 `tests/unit/lib` 通过 `@/lib/...` 引用这些模块。

### `tests/unit/` — 单元测试

验证纯函数、业务规则、数据迁移、FSRS、同步计划、Google Sheets 适配、APKG 等。测试位置不再与产品模块同目录绑定。

### `tests/contracts/` — 结构与回归契约

用于保护跨文件、源码结构或框架配置层的约束，例如：

- 主导航必须保持静态路由和预加载策略；
- Notes 列表必须保持内部滚动与 viewport lock；
- Study Session 必须保留关键可访问性和 motion wiring；
- 卡包 Sheet 不得重新引入嵌套 Sheet 或旧管理入口。

这类测试与真正的浏览器 E2E 不同，因此单独命名为 `contracts`，避免和普通单元测试混在一起。

## 依赖方向

```text
app ───────► components ───────► lib
  └────────────────────────────► lib

tests/unit ────────────────────► lib
tests/contracts ───────────────► app / components / config（只做测试侧检查）
```

产品代码不得反向依赖 `tests/`。

## 测试与类型检查

```bash
npm run typecheck        # 产品 + 测试 TypeScript
npm run typecheck:app    # 仅产品代码
npm run typecheck:tests  # 仅 tests/
npm test                 # 全部 Vitest
npm run test:unit        # 仅 tests/unit
npm run test:contracts   # 仅 tests/contracts
```

Vitest 的扫描范围固定为 `tests/**/*.test.ts`。新增测试不要放回 `app/`、`components/` 或 `lib/`。

## 开发原则

1. 页面入口保持薄：框架路由留在 `app/`，业务下沉。
2. React 组件专注展示和交互，可测试的算法进入 `lib/`。
3. 所有测试集中在 `tests/`，用 `unit` 与 `contracts` 表达测试类型，而不是通过和产品代码混放表达关联。
4. 产品代码使用 `@/...` 别名跨目录引用；单元测试使用 `@/lib/...`，降低物理目录耦合。
5. 结构调整后必须通过 lint、产品/测试 typecheck、完整测试和 production build。
