# Anki Studio

浏览器里编辑一套词汇 Anki 卡包：改模板、改卡片、导入导出。数据存在本机 `localStorage`，语音文件缓存在 IndexedDB。

## 功能

- 模板：字段、HTML/CSS、Anki `{{Field}}` 语法、AI 改模板
- 卡片：单卡 / 表格、搜索、首字段去重、CSV / JSON / `.apkg`
- TTS 字段：绑定已有字段，Google Translate TTS；编辑器可试听，导出 APKG 时再按限速生成
- 设置：OpenAI 兼容接口和提示词

默认字段：`Word` `Phonetic` `Translation` `Example` `ExampleTranslation` `Notes`

## 开发

需要 [pnpm](https://pnpm.io/)。

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。
