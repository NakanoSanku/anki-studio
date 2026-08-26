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

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 常用命令

- `npm run dev`: 启动本地开发服务
- `npm run build`: 生产环境打包
- `npm run typecheck`: 静态类型检查
- `npm run lint`: 代码规范检查
- `npm test`: 运行单元测试套件

## 云同步（Google Sheets）

单人用，电脑 + 手机。应用通过 Google OAuth 和 Sheets API 直接读写用户选择的表格，不再需要 Apps Script 网关。设置页优先使用 Google Picker 选择并授权文件，也支持粘贴已授权表格的编辑链接。每台新设备选择或粘贴一次同一张表格即可。

一份 Google Spreadsheet 可以同步多个卡包：每个有效卡包对应一个以卡包名命名的可见工作表，列是笔记字段、行是笔记，可直接在 Google Sheets 中预览和编辑；编辑文本字段、增加行或删除行会在网站下一次同步时回写为卡包内容，TTS 字段仍由应用管理。真正用于冲突检测和 FSRS 数据恢复的分块 payload 保存在同卡包的隐藏工作表中，隐藏工作表 `_anki_studio_sync` 只保存稳定映射、版本和删除墓碑。可见笔记表的首列是隐藏的稳定卡片 ID，请不要取消隐藏或修改；表头也不要改动。卡包改名时对应预览标签会一起改名；名称重复时自动添加序号。旧版集中存放在隐藏页的数据会在首次连接时自动迁移。

卡包内容会拆成多个单元格，继续支持本机 / 云端 / 另存为冲突处理；语音缓存和 OpenAI API Key 不会上传。不要手动编辑或删除隐藏卡包数据工作表及隐藏索引；表头或既有数据异常时同步会停止，不会把损坏误判成远端删除。

### 1. 配置 Google Cloud API

在同一个 Google Cloud 项目中启用：

- [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
- [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
- [Google Picker API](https://console.cloud.google.com/apis/library/picker.googleapis.com)

然后创建一个浏览器 API Key，建议：

1. “应用限制”选择“网站”，加入 `http://localhost:3000/*` 和正式站点域名。
2. “API 限制”只允许 Google Picker API。
3. 将 Key 保存为 `GOOGLE_PICKER_API_KEY`。
4. 从 Cloud 项目概览复制纯数字“项目编号”，保存为 `GOOGLE_CLOUD_PROJECT_NUMBER`。它不是项目 ID。

### 2. 配置 Google OAuth

1. 在 [Google Auth Platform](https://console.cloud.google.com/auth/overview) 配置 OAuth 同意屏幕，并创建“Web 应用”类型的 OAuth 客户端。
2. 添加已获授权的 JavaScript 来源：
   - 本地：`http://localhost:3000`
   - 生产：`https://你的域名`
3. 添加已获授权的重定向 URI：
   - 本地：`http://localhost:3000/api/auth/callback/google`
   - 生产：`https://你的域名/api/auth/callback/google`
4. 保存客户端 ID、客户端密钥，并生成会话密钥：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

5. 配置 `GOOGLE_ALLOWED_EMAILS`。这是可登录帐号白名单，多个邮箱用逗号分隔；Google 返回的邮箱必须已经验证并出现在列表中。

OAuth 同时申请 Google Sheets 的编辑权限与 Picker 所需的 `drive.file` 权限：前者让用户可以直接粘贴自己有权限的表格链接，后者用于 Picker 选表。短期访问令牌由服务端会话续期，不会保存到 IndexedDB 或同步表。升级授权范围后，已有登录需要重新连接 Google 帐号一次。

### 3. 本地环境配置

```powershell
Copy-Item .env.example .env.local
# 编辑 .env.local 后运行 Next.js 开发服务
npm run dev
```

### 4. 部署 (Vercel / Node.js / Docker)

项目为标准 Next.js 全栈应用，推荐部署到 Vercel 或支持 Node.js 的容器平台。请在环境变量中配置：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `GOOGLE_ALLOWED_EMAILS`
- `GOOGLE_PICKER_API_KEY`
- `GOOGLE_CLOUD_PROJECT_NUMBER`
- `NEXTAUTH_URL`（例如 `https://anki-studio.example.com`）

Google Cloud Console 中的 JavaScript 来源、生产回调地址和 API Key 网站限制必须与 `NEXTAUTH_URL` 使用同一个域名。

### 6. 在应用中连接表格

1. 打开 `设置 → 同步`，连接 Google 帐号并同意表格文件权限。
2. 点击“选择 Google 表格”，选择现有表格；也可以先新建一张空表再选择。
3. 应用验证文件后会自动创建隐藏索引；同步时每个卡包会创建自己的工作表，并显示表格名称和可点击链接。
4. 其他设备登录同一帐号，再选择同一张表；如果已经授权，也可直接粘贴其编辑链接。

## 项目结构与架构设计

- 详细文件目录组织、核心模块分层与数据流向说明：请查阅 [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)
- 核心架构设计决策记录：请查阅 [ADR 文档目录](docs/adr/)
- 领域专业术语与规范约束：请查阅 [CONTEXT.md](CONTEXT.md)

