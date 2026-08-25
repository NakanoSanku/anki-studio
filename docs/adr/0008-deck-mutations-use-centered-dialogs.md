# 卡包 list stays a sheet; write actions are centered dialogs

The 卡包 picker is a phone-first bottom sheet for scanning and switching. A second nested bottom panel for 新建 / 改名 / 删除 hid the list and stacked poorly. Those write steps, and 复制, are centered Dialog / AlertDialog over the still-open list: name steps dismiss on overlay or Esc, delete does not. The list itself is not a Dialog.
