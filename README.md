# Anki Studio

浏览器里编辑一套词汇 Anki 卡包：改模板、改卡片、导入导出。数据存在本机 `localStorage`，语音文件缓存在 IndexedDB。

## 功能

- 模板：字段、HTML/CSS、Anki `{{Field}}` 语法、AI 改模板
- 卡包：本机多卡包切换、新建 / 复制 / 删除；旧的单卡包数据会自动迁入
- 卡片：单卡 / 表格、搜索、当前卡片后插入、上一张/下一张审核、未审/标记筛选；首字段去重
- 导入：CSV / JSON 先做编码和字段校验，确认后再写入；可合并、替换或新建卡包
- 推送到 Anki：只打包有变更的笔记和模板，Android 可分享给 AnkiDroid；按 `guid` 更新已有卡片，复习进度保留
- TTS 字段：绑定已有字段，Google Translate TTS；编辑器可试听，导出 APKG 时再按限速生成
- 设置：OpenAI 兼容接口和提示词。AI 请求从浏览器直连中转站，中转站需开启 CORS

默认字段：`Word` `Phonetic` `Translation` `Example` `ExampleTranslation` `Notes`

## 开发

需要 [pnpm](https://pnpm.io/)。

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。
