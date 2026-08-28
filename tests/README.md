# Tests

所有自动化测试统一放在 `tests/`，运行时产品目录 `app/`、`components/`、`lib/` 不放 `*.test.ts` / `*.test.tsx`。

## 目录职责

```text
tests/
├── unit/
│   └── lib/          # 纯业务逻辑、数据模型、同步、FSRS、导入导出等单元测试
└── contracts/
    ├── helpers/      # 仅供契约测试复用的源码读取工具
    └── ui/           # UI chrome、导航性能、移动端布局等源码/结构契约测试
```

## 约定

- 单元测试通过 `@/lib/...` 导入产品代码，不依赖测试文件与产品文件的物理相对位置。
- `contracts/ui` 用于保护那些不能只靠纯函数单测覆盖的结构约束，例如静态路由、预加载策略、移动端 shell 与关键可访问性标记。
- 产品 TypeScript 与测试 TypeScript 分开检查：`tsconfig.json` 不包含 `tests/`，`tsconfig.test.json` 专门负责测试代码。
- Vitest 只扫描 `tests/**/*.test.ts`，新增测试必须进入该目录。

## 命令

```bash
npm test
npm run test:unit
npm run test:contracts
npm run typecheck
```
