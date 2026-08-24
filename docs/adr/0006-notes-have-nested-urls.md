# 笔记 list and editor are nested URLs

`/notes` is the list. `/notes/[id]` is the editor for that 笔记. A new 笔记 is inserted locally first, then the editor opens at `/notes/[id]`; if it is still empty when the user leaves, it is deleted. The tab bar is hidden on `/notes/[id]` and on `/study`, so a pushed editor is full screen.
