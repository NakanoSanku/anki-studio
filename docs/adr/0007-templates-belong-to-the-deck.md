# 模板 is entered from 卡包, not from 设置

A 模板 cannot be reused across 卡包: it is HTML/CSS for that 卡包's fields. The settings overview therefore must not list 模板 beside 卡包, which looked like a global skin. The 卡包 screen has a 模板 row that pushes to `/settings/deck/templates` (fields, HTML/CSS, and preview stay on that one screen). `/settings/templates` and `/templates` redirect there. Copying a 卡包 already copies its 模板; a shared template library is out of scope.
