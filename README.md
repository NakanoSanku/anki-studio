# Anki Studio

浏览器里编辑一套词汇 Anki 卡包：改模板、改卡片、导入导出。卡包存在本机 IndexedDB（会从旧的 `localStorage` 自动迁入），语音文件缓存在 IndexedDB。部署到 Cloudflare 后，电脑和手机通过 Google Sheets 同步卡包。

## 功能

- 模板：字段、HTML/CSS、Anki `{{Field}}` 语法、AI 改模板
- 卡包：本机多卡包切换、新建 / 复制 / 删除；旧的单卡包数据会自动迁入
- 卡片：单卡编辑、搜索、当前卡片后插入、上一张/下一张审核、未审筛选、AI 批量生成；首字段去重
- 导入：CSV / JSON 先做编码和字段校验，确认后再写入；可合并、替换或新建卡包
- 推送到 Anki：只打包有变更的笔记和模板，Android 可分享给 AnkiDroid；按 `guid` 更新已有卡片，复习进度保留
- TTS 字段：绑定已有字段，Google Translate TTS；编辑器可试听，导出 APKG 时再按限速生成
- 设置：OpenAI 兼容接口和提示词。AI 请求从浏览器直连中转站，中转站需开启 CORS
- 云同步：卡包、模板与学习记录；冲突弹窗选云端 / 本机 / 另存为。语音和 API Key 不同步

默认字段：`Word` `Phonetic` `Translation` `Example` `ExampleTranslation` `Notes`

## 开发

需要 [pnpm](https://pnpm.io/)。

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 云同步（Google Sheets）

单人用，电脑 + 手机。卡包以分块数据保存在你自己的 Google Sheet；绑定表格的 Apps Script 使用脚本锁完成版本检查和写入，继续支持本机 / 云端 / 另存为冲突处理。Google OAuth 负责确认访问者身份，未登录时仍可离线编辑和学习，但不能访问云端同步数据。

### 1. 创建同步表和 Apps Script

1. 新建一个 Google Sheet，在 `扩展程序 → Apps Script` 打开绑定脚本。
2. 将 [`google-sheets-sync/Code.gs`](./google-sheets-sync/Code.gs) 粘贴到 `Code.gs`，并将 [`google-sheets-sync/appsscript.json`](./google-sheets-sync/appsscript.json) 的内容粘贴到项目清单。
3. 在编辑器中运行 `setupGoogleSheetsSync` 并授权。执行日志会给出 `secret`；它只用于服务器与脚本之间的鉴权，不要放进前端代码或提交到 Git。
4. 选择 `部署 → 新建部署 → Web 应用`，执行身份选“我”，访问权限选“任何人”，然后复制以 `/exec` 结尾的 Web App 地址。部署新版本后仍使用同一个 `/exec` 地址。

同步数据写入隐藏工作表 `_anki_studio_sync`。单个卡包会被拆成多个单元格，避免 Google Sheets 的单元格字符限制；语音缓存和 OpenAI API Key 不会上传。不要手动编辑或删除隐藏工作表；脚本检测到表头、分块或既有数据被清空时会停止同步，不会把损坏误判成远端删除。

### 2. 配置 Google OAuth

1. 在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 配置 OAuth 同意屏幕并创建“Web 应用”类型的 OAuth 客户端。
2. 添加已获授权的重定向 URI：
   - 本地：`http://localhost:3000/api/auth/callback/google`
   - 生产：`https://你的域名/api/auth/callback/google`
3. 保存客户端 ID、客户端密钥，并生成会话密钥：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

4. 配置 `GOOGLE_ALLOWED_EMAILS`。这是可登录帐号白名单，多个邮箱用逗号分隔；Google 返回的邮箱必须已经验证并出现在列表中。

OAuth 只申请 `openid`、`email`、`profile` 基本身份范围。Google Sheet 仍由服务器通过 Apps Script 网关访问，OAuth token 不会保存到 IndexedDB 或同步表。

### 3. 本地开发

```powershell
Copy-Item .dev.vars.example .env.local
# 编辑 .env.local 后运行 Next.js 开发服务
pnpm dev

Copy-Item .dev.vars.example .dev.vars
# 如需验证 Cloudflare 运行时，编辑 .dev.vars 后运行：
pnpm preview
```

### 4. Cloudflare 部署

将同步配置、OAuth 客户端密钥和会话密钥保存为 Worker secret，再部署应用；`NEXTAUTH_URL` 应设为正式域名：

```bash
pnpm wrangler secret put GOOGLE_SHEETS_SYNC_URL
pnpm wrangler secret put GOOGLE_SHEETS_SYNC_SECRET
pnpm wrangler secret put GOOGLE_CLIENT_ID
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
pnpm wrangler secret put AUTH_SECRET
pnpm wrangler secret put GOOGLE_ALLOWED_EMAILS
pnpm wrangler secret put NEXTAUTH_URL
pnpm deploy
```

Google OAuth 配置完整时，它会取代 `REQUIRE_ACCESS` 成为同步 API 的身份校验。未配置 OAuth 时，生产环境仍会回退到 `REQUIRE_ACCESS=1` 的 Cloudflare Access 校验。

### 5. Vercel 部署

项目也支持 Vercel。请在 Vercel 项目的 `Settings → Environment Variables` 中为 Production（以及需要的 Preview 环境）配置：

- `GOOGLE_SHEETS_SYNC_URL`
- `GOOGLE_SHEETS_SYNC_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `GOOGLE_ALLOWED_EMAILS`
- `NEXTAUTH_URL`（例如 `https://anki-studio.example.com`）

Vercel 运行时直接读取服务器环境变量，不需要配置 `REQUIRE_ACCESS`。Google Cloud Console 中的生产回调地址必须与 `NEXTAUTH_URL` 使用同一个域名；Vercel Deployment Protection 可按需保留。
