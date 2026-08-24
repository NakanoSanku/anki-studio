# 本机 stays IndexedDB; Context is chrome only

卡包 contents, 笔记, 模板, study records, and TTS clips remain in IndexedDB. React Context holds only chrome: active 卡包 id, sync status, list filters, and whether a 会话 is open. localStorage holds those UI preferences, not deck data. Do not treat Context as a copy of 本机.
