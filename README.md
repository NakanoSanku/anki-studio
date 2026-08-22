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

单人用，电脑 + 手机。卡包以分块数据保存在你自己的 Google Sheet；绑定表格的 Apps Script 使用脚本锁完成版本检查和写入，继续支持本机 / 云端 / 另存为冲突处理。

### 1. 创建同步表和 Apps Script

1. 新建一个 Google Sheet，在 `扩展程序 → Apps Script` 打开绑定脚本。
2. 将 [`google-sheets-sync/Code.gs`](./google-sheets-sync/Code.gs) 粘贴到 `Code.gs`，并将 [`google-sheets-sync/appsscript.json`](./google-sheets-sync/appsscript.json) 的内容粘贴到项目清单。
3. 在编辑器中运行 `setupGoogleSheetsSync` 并授权。执行日志会给出 `secret`；它只用于服务器与脚本之间的鉴权，不要放进前端代码或提交到 Git。
4. 选择 `部署 → 新建部署 → Web 应用`，执行身份选“我”，访问权限选“任何人”，然后复制以 `/exec` 结尾的 Web App 地址。部署新版本后仍使用同一个 `/exec` 地址。

同步数据写入隐藏工作表 `_anki_studio_sync`。单个卡包会被拆成多个单元格，避免 Google Sheets 的单元格字符限制；语音缓存和 OpenAI API Key 不会上传。不要手动编辑或删除隐藏工作表；脚本检测到表头、分块或既有数据被清空时会停止同步，不会把损坏误判成远端删除。

### 2. 本地开发

```powershell
Copy-Item .dev.vars.example .dev.vars
# 将 .dev.vars 中的地址和密钥替换为上一步得到的值
pnpm preview   # OpenNext 构建 + wrangler dev
```

### 3. Cloudflare 部署

将 Web App 地址与密钥保存为 Worker secret，再部署应用：

```bash
pnpm wrangler secret put GOOGLE_SHEETS_SYNC_URL
pnpm wrangler secret put GOOGLE_SHEETS_SYNC_SECRET
pnpm deploy
```

建议给 Worker 打开 Cloudflare Access，只允许你的邮箱。生产环境默认 `REQUIRE_ACCESS=1`，未带 Access 令牌的同步请求会被拒绝。
