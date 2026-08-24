# Anki Studio

A personal, local-first studio for making and reviewing one's own vocabulary flashcards.

## Language

**卡包**:
A named collection of notes, templates, and study records. It can be switched, copied, imported, exported, and synced as one unit.
_Avoid_: 牌组, 书库

**笔记**:
The editable record: a stable id, a guid, and field values. It is what you add, search, and correct.
_Avoid_: 卡片 as the name of this record, 条目

**卡片**:
The front and back produced by rendering a 笔记 through a 模板. It is what you see during 学习.
_Avoid_: 笔记 as the name of the rendered faces

**学习**:
An in-app FSRS session of due and new cards from the active 卡包.
_Avoid_: 复习 as the screen name (复习 is a count inside 学习); 复习笔记

**模板**:
The HTML and CSS that turn a note into the front and back shown during 学习.
_Avoid_: 样式, 皮肤

**本机**:
The device-local IndexedDB copy of 卡包 data. Edits land here first; it is the source of truth, not a cache.
_Avoid_: 本地缓存, 草稿

**云同步**:
Copying 卡包 contents, templates, and study records through the user's Google Spreadsheet, with explicit conflict choices.
_Avoid_: 备份, 上传, 云盘

**推送到 Anki**:
Exporting an incremental APKG so Anki or AnkiDroid can update notes by guid. It is not a live connection.
_Avoid_: AnkiConnect, 同步到 Anki

**未审**:
A content-QA filter in the note editor. It is not an FSRS due state.
_Avoid_: 新卡 (新卡 is FSRS)

**会话**:
The full-screen 学习 in progress, at `/study`. Leaving 会话 returns to the 学习 home at `/`.
_Avoid_: 学习 as the name of this layer only (学习 is the whole activity, including the home queue)

**设置**:
The drawer for tools that are not daily. It has an overview plus subpages: 卡包, 模板, 复习参数, AI, and 云同步.
_Avoid_: 更多, 工具

**复习参数**:
The 设置 subpage for FSRS retention, daily limits, and max interval. It is not the 学习 tab.
_Avoid_: 学习 as this page's name; FSRS as the only on-screen label
