<a id="readme-top"></a>

<div align="center">
  <a href="https://github.com/NakanoSanku/anki-studio">
    <img src="public/icon-maskable.svg" alt="Anki Studio logo" width="104" height="104">
  </a>

  <h1>Anki Studio</h1>

  <p>
    <strong>一个浏览器优先的 Anki 风格闪卡工作区，用于创建、审核、学习与同步。</strong>
  </p>

  <p>
    使用模板和 AI 创建笔记，在进入学习前完成审核，通过 FSRS 安排复习，并使用 Google Sheets 同步完整项目。
  </p>

  <p>
    <a href="#getting-started"><strong>快速开始 →</strong></a>
    &nbsp;·&nbsp;
    <a href="docs/PROJECT_STRUCTURE.md">文档</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/NakanoSanku/anki-studio/issues">Issues</a>
    &nbsp;·&nbsp;
    <a href="README.md">English</a>
    &nbsp;·&nbsp;
    <a href="README.zh-CN.md"><strong>简体中文</strong></a>
  </p>
</div>

<div align="center">

[![UI Checks][ui-checks-shield]][ui-checks-url]
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stars][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

</div>

<p align="center">
  <a href="#about">项目介绍</a> ·
  <a href="#built-with">技术栈</a> ·
  <a href="#getting-started">快速开始</a> ·
  <a href="#usage">使用方法</a> ·
  <a href="#google-sheets-sync">Google Sheets 同步</a> ·
  <a href="#deployment">部署</a> ·
  <a href="#contributing">参与贡献</a>
</p>

---

> [!NOTE]
> Anki Studio 是一个 **local-first（本地优先）** 应用。牌组和学习数据首先保存在 IndexedDB 中；Google Sheets 同步是可选功能，API Key 和生成的音频缓存始终保留在当前设备上。

<a id="about"></a>
## ✨ 项目介绍

Anki Studio 将内容创作和学习整合在一个浏览器优先的工作区中。它把笔记模板、AI 辅助创作、审核批准、FSRS 调度、导入导出工具以及可选的 Google Sheets 同步组合在一起，同时不会让电子表格成为学习调度数据的真实来源。

项目最重要的边界是 **先审核，再发布**：新建笔记、AI 生成笔记、AI 补全笔记以及从 Google Sheets 外部编辑的笔记，在获得批准前都会保持 Pending 状态。Pending 笔记仍然可以编辑和同步，但不会进入 Study、Voice Tutor、CSV 导出或 APKG 导出。

### 项目亮点

- ✅ **审核门控笔记** — AI 生成或外部编辑的内容必须经过审核后，才能成为正式学习材料。
- 🧠 **FSRS 调度** — 基于 `ts-fsrs` 提供每日新卡/复习上限、保留率控制、学习历史和到期队列。
- ✨ **AI 辅助创作** — 支持补全空字段、根据资料批量生成笔记、编辑模板，并通过 OpenAI-compatible endpoint 自定义提示词。
- 🎨 **Template Studio** — 可编辑字段、正反面 HTML、CSS、多卡片模板和 Anki `{{Field}}` 语法，并提供实时预览。
- 🔄 **Google Sheets 同步** — 基于 OAuth 的多设备同步，支持可编辑牌组预览、修订跟踪、冲突处理和稳定的牌组到表格映射。
- 🔊 **TTS 感知导出** — 可将生成的音频字段绑定到笔记字段，预览语音，并在 APKG 导出时打包音频。
- 💾 **本地优先存储** — 牌组和学习数据保存在 IndexedDB 中，同时应用支持安装为 PWA。
- 📦 **导入与导出** — 支持 CSV、JSON、APKG 和 COLPKG 导入，以及当前牌组 JSON 备份和仅导出已审核笔记的 CSV/APKG。

<a id="built-with"></a>
## 🧰 技术栈

[![Next.js][Next.js]][Next-url]
[![React][React.js]][React-url]
[![TypeScript][TypeScript]][TypeScript-url]
[![Tailwind CSS][TailwindCSS]][TailwindCSS-url]
[![Google Sheets][GoogleSheets]][GoogleSheets-url]
[![Docker][Docker]][Docker-url]

其他关键库与集成包括：用于模板/提示词编辑的 CodeMirror 6、用于调度的 `ts-fsrs`、用于 APKG 处理的 `sql.js` + JSZip、用于 Google OAuth 的 NextAuth，以及用于同步和表格选择的 Google Sheets、Drive 和 Picker APIs。

<a id="getting-started"></a>
## 🚀 快速开始

### 前置要求

- Node.js 22
- npm

仓库中的 `UI checks` 工作流同样使用 Node.js 22。

### 安装

1. 克隆仓库。

   ```bash
   git clone https://github.com/NakanoSanku/anki-studio.git
   cd anki-studio
   ```

2. 安装依赖。

   ```bash
   npm ci
   ```

3. 启动开发服务器。

   ```bash
   npm run dev
   ```

4. 打开 `http://localhost:3000`。

> [!TIP]
> 本地开发并不要求启用 Google Sheets 同步。AI Provider 在 **Settings → AI** 中配置，并保存在当前设备上。

<details>
<summary><strong>质量检查</strong></summary>
<br>

运行与 CI 相同的校验流程：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

</details>

<a id="usage"></a>
## 💡 使用方法

一个典型的 Anki Studio 工作流如下：

1. 创建或导入一个牌组。
2. 在 Template Studio 中配置笔记字段和卡片模板。
3. 手动创建笔记、使用 AI 补全缺失字段，或根据资料批量生成笔记。
4. 在发布到学习流程前审核 Pending 笔记。
5. 使用 FSRS 调度学习已审核卡片。
6. 可选地通过 Google Sheets 同步牌组状态，或将已审核笔记导出为 CSV/APKG。

### 审核生命周期

```text
Create / AI generate / AI fill / Sheets edit
                  │
                  ▼
             Pending review
                  │
             Review / approve
                  │
                  ▼
                Approved
          ┌───────┼────────┐
          ▼       ▼        ▼
        Study  Voice Tutor Export
```

编辑一条已审核笔记后，它会重新回到 **Pending review**。在引入审核元数据之前创建的旧牌组会迁移为已审核状态，因此升级后不会隐藏原本可用的笔记。

### 数据与导出语义

| 场景 | Pending 笔记 | 已审核笔记 | 学习历史 / 模板 |
| --- | --- | --- | --- |
| 本地 IndexedDB | 保留 | 保留 | 保留 |
| Google Sheets 同步 payload | 同步 | 同步 | 同步 |
| 可编辑 Google Sheets 预览 | 可见/可编辑 | 可见/可编辑 | 不存储在可见预览中 |
| 当前牌组 JSON 备份 | 包含 | 包含 | 包含当前牌组数据 |
| CSV 导出 | 排除 | 包含 | 不适用 |
| APKG 导出 | 排除 | 包含 | 作为 Anki 牌组数据导出 |
| Study / Voice Tutor | 排除 | 包含 | 使用 FSRS 状态 |

API Key 和生成的音频缓存只保存在当前设备上，不会随牌组同步上传。

<a id="google-sheets-sync"></a>
## 🔄 Google Sheets 同步

Anki Studio 直接使用 Google OAuth 和 Sheets API。一个 Spreadsheet 可以包含多个牌组，每个牌组包含：

- 一个用于人类可读笔记预览/编辑的可见 Worksheet；
- 一个保存当前完整牌组状态和修订元数据的隐藏 payload Worksheet；成功写入后会压缩旧 payload 修订；
- 隐藏 `_anki_studio_sync` 索引中的一条记录，用于稳定映射和 tombstone 管理。

可见 Worksheet 的第一列是隐藏列，用于保存稳定的 note ID。请不要重命名表头，也不要手动修改或删除隐藏的同步 Worksheet。

在可见 Worksheet 中进行的修改会在下一次同步时物化。**新增或修改的行会进入 Pending review**，只有完成审核后才能进入 Study 或正式导出流程。

<details>
<summary><strong>Google Cloud 配置</strong></summary>
<br>

### 1. 启用 APIs

在同一个 Google Cloud 项目中启用：

- [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
- [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
- [Google Picker API](https://console.cloud.google.com/apis/library/picker.googleapis.com)

为 Picker 创建一个浏览器 API Key，并将其限制到开发/生产 Origin 以及 Google Picker API。

### 2. 创建 OAuth 凭证

在 [Google Auth Platform](https://console.cloud.google.com/auth/overview) 中创建 **Web application** OAuth Client。

本地开发添加：

```text
Authorized JavaScript origin:
http://localhost:3000

Authorized redirect URI:
http://localhost:3000/api/auth/callback/google
```

生产环境需要加入对应的 Origin 和 Callback。

### 3. 配置环境变量

复制仓库中的示例：

```bash
cp .env.example .env.local
```

根据 `.env.example` 设置：

| 变量 | 用途 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_ALLOWED_EMAILS` | 可选，逗号分隔的登录邮箱白名单 |
| `GOOGLE_PICKER_API_KEY` | 限制到 Google Picker API 的浏览器 Key |
| `GOOGLE_CLOUD_PROJECT_NUMBER` | Picker 使用的 Google Cloud 数字项目编号 |
| `AUTH_SECRET` | NextAuth Session Secret |
| `NEXTAUTH_URL` | 应用公开 URL；示例默认是 `http://localhost:3000` |

生成 `AUTH_SECRET`：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

### 4. 连接 Spreadsheet

在 **Settings → Sync** 中：

1. 连接 Google 账号。
2. 使用 Google Picker 选择已有 Spreadsheet，或者粘贴已授权的 Spreadsheet 编辑链接。
3. 在另一台设备上选择同一个 Spreadsheet，即可共享同步库。

</details>

<a id="deployment"></a>
## 🚢 部署

Anki Studio 是标准 Next.js 应用，可以部署在 Vercel、Node.js Host 或 Docker 上。生产环境如果启用 Google 同步，需要配置与上文相同的环境变量，并在 Google Cloud 中注册生产 Origin/Callback。

### Docker 镜像

`main` 会发布多架构镜像到：

```text
ghcr.io/nakanosanku/anki-studio:latest
```

仓库提供 Compose 示例：

```bash
cp compose.example.yml compose.yml
cp .env.example .env
# 填写 .env 后：
docker compose up -d
```

也可以在本地构建：

```bash
docker build -t anki-studio .
docker run --env-file .env.local -p 3000:3000 anki-studio
```

### 仓库指南

- [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) — 模块布局和数据流
- [`docs/adr/`](docs/adr/) — Architecture Decision Records
- [`CONTEXT.md`](CONTEXT.md) — 领域术语和项目约束
- [`.env.example`](.env.example) — 支持的服务端环境变量
- [`compose.example.yml`](compose.example.yml) — Docker Compose 示例

<a id="contributing"></a>
## 🤝 参与贡献

准备修改时：

1. Fork 仓库，或从仓库创建功能分支。
2. 同步完成实现和文档修改。
3. 运行完整校验：

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

4. 创建 Pull Request，并说明行为变化和验证结果。

常用开发脚本：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 在 3000 端口启动开发服务器 |
| `npm run build` | 创建生产构建 |
| `npm run start` | 在 3000 端口启动生产服务器 |
| `npm run lint` | 运行 ESLint |
| `npm run typecheck` | 对应用和测试执行 TypeScript 检查 |
| `npm test` | 运行完整 Vitest 测试 |
| `npm run test:unit` | 运行单元测试 |
| `npm run test:contracts` | 运行 Contract Tests |
| `npm run test:watch` | 以 Watch 模式运行 Vitest |

### 贡献者

<a href="https://github.com/NakanoSanku/anki-studio/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=NakanoSanku/anki-studio" alt="Anki Studio 贡献者">
</a>

<a id="contact"></a>
## 📬 联系方式

项目地址：[github.com/NakanoSanku/anki-studio](https://github.com/NakanoSanku/anki-studio)  
Issues：[github.com/NakanoSanku/anki-studio/issues](https://github.com/NakanoSanku/anki-studio/issues)

<div align="center">
  <br>
  <a href="#readme-top"><strong>↑ 返回顶部</strong></a>
</div>

<!-- MARKDOWN LINKS & IMAGES -->
[ui-checks-shield]: https://github.com/NakanoSanku/anki-studio/actions/workflows/ui-checks.yml/badge.svg
[ui-checks-url]: https://github.com/NakanoSanku/anki-studio/actions/workflows/ui-checks.yml
[contributors-shield]: https://img.shields.io/github/contributors/NakanoSanku/anki-studio?style=flat-square
[contributors-url]: https://github.com/NakanoSanku/anki-studio/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/NakanoSanku/anki-studio?style=flat-square
[forks-url]: https://github.com/NakanoSanku/anki-studio/network/members
[stars-shield]: https://img.shields.io/github/stars/NakanoSanku/anki-studio?style=flat-square
[stars-url]: https://github.com/NakanoSanku/anki-studio/stargazers
[issues-shield]: https://img.shields.io/github/issues/NakanoSanku/anki-studio?style=flat-square
[issues-url]: https://github.com/NakanoSanku/anki-studio/issues

[Next.js]: https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[TypeScript]: https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[TailwindCSS]: https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white
[TailwindCSS-url]: https://tailwindcss.com/
[GoogleSheets]: https://img.shields.io/badge/Google_Sheets-Sync-34A853?style=flat-square&logo=googlesheets&logoColor=white
[GoogleSheets-url]: https://developers.google.com/workspace/sheets/api
[Docker]: https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white
[Docker-url]: https://docs.docker.com/
